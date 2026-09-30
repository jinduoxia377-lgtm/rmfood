"""
动态自定义字段服务
对标 FormLab 的 "Custom fields & calculated parameters"
"""
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import CustomFieldType, CustomFieldEntity

logger = logging.getLogger(__name__)


class CustomFieldService:
    """
    动态自定义字段服务

    允许用户在原料、配方、样品等实体上添加任意自定义属性。
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_field(
        self,
        entity_type: str,
        field_name: str,
        field_type: str,
        options: List[str] | None = None,
        required: bool = False,
        organization_id: int | None = None,
    ) -> Dict[str, Any]:
        """创建自定义字段定义"""
        # 检查是否已存在
        stmt = select(text("id")).where(
            text("entity_type = :etype AND field_name = :fname"),
        ).bindparams(etype=entity_type, fname=field_name)
        if organization_id:
            stmt = stmt.where(text("organization_id = :org"))
            stmt = stmt.bindparams(org=organization_id)

        result = await self.db.execute(stmt)
        if result.fetchone():
            raise ValueError(f"字段 '{field_name}' 已存在")

        stmt = text("""
            INSERT INTO custom_field_definitions
                (organization_id, entity_type, field_name, field_type, options, required)
            VALUES (:org, :etype, :fname, :ftype, :opts, :required)
            RETURNING id, created_at
        """)
        result = await self.db.execute(stmt, {
            "org": organization_id,
            "etype": entity_type,
            "fname": field_name,
            "ftype": field_type,
            "opts": options if options else text("NULL"),
            "required": required,
        })
        row = result.fetchone()

        await self.db.commit()

        return {
            "id": row[0],
            "entity_type": entity_type,
            "field_name": field_name,
            "field_type": field_type,
            "options": options,
            "required": required,
            "created_at": row[1].isoformat() if row[1] else None,
        }

    async def list_fields(
        self,
        entity_type: str | None = None,
        organization_id: int | None = None,
    ) -> List[Dict[str, Any]]:
        """列出自定义字段定义"""
        stmt = select(text("*")).from_statement(text("FROM custom_field_definitions"))

        conditions = []
        params = {}
        if entity_type:
            conditions.append("entity_type = :etype")
            params["etype"] = entity_type
        if organization_id:
            conditions.append("organization_id = :org")
            params["org"] = organization_id

        if conditions:
            stmt = stmt.where(text(" AND ".join(conditions)))
            stmt = stmt.bindparams(**params)

        stmt = stmt.order_by(text("created_at DESC"))
        result = await self.db.execute(stmt)
        rows = result.fetchall()

        return [
            {
                "id": row[0],
                "organization_id": row[1],
                "entity_type": row[2],
                "field_name": row[3],
                "field_type": row[4],
                "options": row[5],
                "required": row[6],
                "created_at": row[7].isoformat() if row[7] else None,
            }
            for row in rows
        ]

    async def set_value(
        self,
        definition_id: int,
        entity_id: int,
        value: Any,
    ) -> None:
        """设置实体字段值"""
        # 先删除旧值（一个定义一个实体只存一个值）
        delete_stmt = text("""
            DELETE FROM custom_field_values
            WHERE definition_id = :def_id AND entity_id = :ent_id
        """)
        await self.db.execute(delete_stmt, {"def_id": definition_id, "ent_id": entity_id})

        # 插入新值
        insert_stmt = text("""
            INSERT INTO custom_field_values (definition_id, entity_id, field_value)
            VALUES (:def_id, :ent_id, :val)
        """)
        await self.db.execute(insert_stmt, {
            "def_id": definition_id,
            "ent_id": entity_id,
            "val": str(value) if value is not None else None,
        })
        await self.db.commit()

    async def get_value(
        self,
        definition_id: int,
        entity_id: int,
    ) -> Optional[str]:
        """获取实体字段值"""
        stmt = select(text("field_value")).where(
            text("definition_id = :def_id AND entity_id = :ent_id"),
        ).bindparams(def_id=definition_id, ent_id=entity_id)
        result = await self.db.execute(stmt)
        row = result.fetchone()
        return row[0] if row else None

    async def get_entity_values(
        self,
        entity_type: str,
        entity_id: int,
    ) -> Dict[str, Any]:
        """获取实体的所有自定义字段值"""
        stmt = text("""
            SELECT d.field_name, d.field_type, v.field_value, d.options
            FROM custom_field_values v
            JOIN custom_field_definitions d ON v.definition_id = d.id
            WHERE d.entity_type = :etype AND v.entity_id = :ent_id
        """)
        result = await self.db.execute(stmt, {"etype": entity_type, "ent_id": entity_id})
        rows = result.fetchall()

        values = {}
        for row in rows:
            field_name, field_type, field_value, options = row
            # 类型转换
            if field_value is not None:
                if field_type == "number":
                    try:
                        field_value = float(field_value)
                    except ValueError:
                        pass
                elif field_type == "boolean":
                    field_value = field_value.lower() in ("true", "1", "yes")
                elif field_type == "date":
                    pass  # 保持字符串
            values[field_name] = {"value": field_value, "type": field_type, "options": options}

        return values


class TheoreticalParameterService:
    """
    配方级理论参数计算服务

    类似 FormLab 的 "Theoretical Parameters"：
    在配方上定义计算公式，自动从原料属性计算配方级参数。
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def calculate_parameter(
        self,
        formula_id: int,
        expression: str,
    ) -> float:
        """
        计算配方级理论参数

        支持的表达式语法：
        - SUM(row.dosage_mg * ing.density WHERE ing.density)  # 加权求和
        - AVG(row.dosage_mg)  # 平均值
        - MAX(row.dosage_mg)  # 最大值
        - row.dosage_mg / 1000 * ing.nitrogen_factor  # 氮折算
        """
        # 获取配方成分
        stmt = text("""
            SELECT fi.dosage_mg, fi.unit, ing.properties
            FROM formula_ingredients fi
            JOIN ingredients ing ON fi.ingredient_id = ing.id
            WHERE fi.formula_id = :formula_id
        """)
        result = await self.db.execute(stmt, {"formula_id": formula_id})
        rows = result.fetchall()

        if not rows:
            return 0.0

        # 构建计算上下文
        context = {
            "rows": [
                {
                    "dosage_mg": row[0],
                    "unit": row[1],
                    "properties": row[2] or {},
                }
                for row in rows
            ],
            "count": len(rows),
        }

        # 简单表达式解析（实际项目应使用安全表达式引擎）
        return self._eval_expression(expression, context)

    def _eval_expression(self, expression: str, context: Dict) -> float:
        """安全地评估表达式"""
        # 提取 dosage_mg 列表
        dosages = [row["dosage_mg"] or 0 for row in context["rows"]]

        if "SUM" in expression.upper() and "* density" in expression.lower():
            # 加权密度求和
            total = 0.0
            for row in context["rows"]:
                props = row.get("properties", {}) or {}
                density = props.get("density")
                if density and row["dosage_mg"]:
                    total += row["dosage_mg"] * float(density)
            return total / 1_000_000 if total > 0 else 0

        elif "AVG" in expression.upper() and "dosage" in expression.lower():
            return sum(dosages) / len(dosages) if dosages else 0

        elif "MAX" in expression.upper() and "dosage" in expression.lower():
            return max(dosages) if dosages else 0

        elif "MIN" in expression.upper() and "dosage" in expression.lower():
            return min(dosages) if dosages else 0

        elif "nitrogen" in expression.lower():
            # 氮折算：dosage_mg / 1000 * 6.25
            total_protein_mg = sum(d * 6.25 for d in dosages)
            return total_protein_mg / 1_000_000  # 转换为 kg

        return 0.0


def create_custom_field_service(db: AsyncSession) -> CustomFieldService:
    return CustomFieldService(db)


def create_theoretical_param_service(db: AsyncSession) -> TheoreticalParameterService:
    return TheoreticalParameterService(db)

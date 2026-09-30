"""
批记录生成服务
从配方自动生成可称重批记录
"""
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Batch, Formula, Ingredient, FormulaVersion, IngredientLot, BatchStatus
from app.models.enums import BatchStatus as BatchStatusEnum

logger = logging.getLogger(__name__)


class BatchRecordService:
    """
    配方 → 批记录 转换服务

    功能：
    1. 根据目标产量放大配方各成分用量
    2. 生成可打印的批记录（含称重量）
    3. 自动关联原料批号（如果可用）
    4. 生成唯一批号
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_batch(
        self,
        formula_id: int,
        target_weight_kg: float,
        preparer_id: int | None = None,
        notes: str | None = None,
        ingredient_lot_assignments: Dict[int, int] | None = None,  # ingredient_id -> ingredient_lot_id
    ) -> Dict[str, Any]:
        """
        创建批记录

        Args:
            formula_id: 配方 ID
            target_weight_kg: 目标产量(kg)
            preparer_id: 配制人员 ID
            notes: 备注
            ingredient_lot_assignments: 原料批号分配 {ingredient_id: ingredient_lot_id}
        """
        # 1. 获取配方
        formula_stmt = select(Formula).where(
            Formula.id == formula_id,
            Formula.deleted_at.is_(None)
        ).options(
            selectinload(Formula.ingredients)
        )
        formula_result = await self.db.execute(formula_stmt)
        formula = formula_result.scalar_one_or_none()

        if not formula:
            raise ValueError(f"配方不存在: {formula_id}")

        # 2. 计算放大比例
        total_dosage_mg = sum(
            ing.dosage_mg or 0 for ing in formula.ingredients
        )
        if total_dosage_mg <= 0:
            raise ValueError("配方总用量无效")

        # 单位转换: mg → kg, 然后计算放大比例
        total_dosage_kg = total_dosage_mg / 1_000_000
        scale_factor = target_weight_kg / total_dosage_kg if total_dosage_kg > 0 else 1.0

        # 3. 生成批号
        batch_code = await self._generate_batch_code(formula.code)

        # 4. 创建批记录
        batch = Batch(
            organization_id=formula.organization_id,
            batch_code=batch_code,
            formula_id=formula_id,
            target_weight_kg=target_weight_kg,
            prepared_by=preparer_id,
            preparation_date=datetime.now(timezone.utc),
            notes=notes,
            status=BatchStatusEnum.PLANNED,
        )
        self.db.add(batch)
        await self.db.flush()

        # 5. 关联原料批号
        if ingredient_lot_assignments:
            for ing_id, lot_id in ingredient_lot_assignments.items():
                stmt = select(IngredientLot).where(
                    IngredientLot.id == lot_id,
                    IngredientLot.ingredient_id == ing_id,
                    IngredientLot.status == "available"
                )
                lot_result = await self.db.execute(stmt)
                lot = lot_result.scalar_one_or_none()
                if lot:
                    batch.ingredient_lots.append(lot)

        await self.db.commit()
        await self.db.refresh(batch)

        logger.info(f"创建批记录: {batch_code} (配方: {formula.code}, 产量: {target_weight_kg}kg)")

        return {
            "id": batch.id,
            "batch_code": batch.batch_code,
            "formula_id": formula_id,
            "formula_code": formula.code,
            "formula_name": formula.name,
            "target_weight_kg": target_weight_kg,
            "scale_factor": round(scale_factor, 4),
            "status": batch.status.value,
            "ingredient_lots": [lot.id for lot in batch.ingredient_lots],
        }

    async def get_batch(self, batch_id: int) -> Optional[Batch]:
        """获取批记录详情"""
        stmt = select(Batch).where(Batch.id == batch_id).options(
            sqlalchemy.orm.selectinload(Batch.formula),
            sqlalchemy.orm.selectinload(Batch.samples),
            sqlalchemy.orm.selectinload(Batch.ingredient_lots).selectinload(IngredientLot.ingredient),
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_batches(
        self,
        organization_id: int | None = None,
        formula_id: int | None = None,
        status: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """列出批记录"""
        stmt = select(Batch)

        if organization_id:
            stmt = stmt.where(Batch.organization_id == organization_id)
        if formula_id:
            stmt = stmt.where(Batch.formula_id == formula_id)
        if status:
            stmt = stmt.where(Batch.status == status)

        # 总数
        count_stmt = select(func.count()).select_from(stmt.subquery())
        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar_one()

        # 分页
        stmt = stmt.order_by(Batch.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(stmt)
        batches = result.scalars().all()

        return {
            "items": [b.to_dict() for b in batches],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def update_batch_status(
        self,
        batch_id: int,
        status: str,
        actual_weight_kg: float | None = None,
    ) -> Dict[str, Any]:
        """更新批记录状态"""
        batch = await self.get_batch(batch_id)
        if not batch:
            raise ValueError(f"批记录不存在: {batch_id}")

        batch.status = BatchStatusEnum(status)
        if actual_weight_kg is not None:
            batch.actual_weight_kg = actual_weight_kg
            if batch.target_weight_kg > 0:
                batch.yield_rate = round(actual_weight_kg / batch.target_weight_kg * 100, 2)

        await self.db.commit()
        await self.db.refresh(batch)

        return batch.to_dict()

    async def _generate_batch_code(self, formula_code: str) -> str:
        """生成批号: B-{formula_code}-{YYYYMMDD}-{seq}"""
        date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        prefix = f"B-{formula_code}-{date_str}-"

        stmt = select(func.count()).where(Batch.batch_code.like(f"{prefix}%"))
        result = await self.db.execute(stmt)
        seq = result.scalar_one() + 1

        return f"{prefix}{seq:03d}"


# 工厂函数
def create_batch_service(db: AsyncSession) -> BatchRecordService:
    return BatchRecordService(db)

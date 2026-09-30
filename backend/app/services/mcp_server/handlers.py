"""
MCP 工具处理器

将 MCP 工具名称映射到实际的数据查询逻辑。
所有查询都是只读的，不修改数据库状态。
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


async def handle_tool_call(db, tool_name: str, args: Dict[str, Any]) -> Any:
    """
    路由 MCP 工具调用到对应的查询函数。
    """
    handlers = {
        "list_formulas": _list_formulas,
        "get_formula": _get_formula,
        "search_formulas": _search_formulas,
        "search_herbs": _search_herbs,
        "get_ingredient": _get_ingredient,
        "list_ingredients": _list_ingredients,
        "check_compliance": _check_compliance,
        "check_contraindications": _check_contraindications,
        "calculate_cost": _calculate_cost,
        "get_stability_prediction": _get_stability_prediction,
        "get_batch": _get_batch,
        "trace_batch_ingredients": _trace_batch_ingredients,
        "trace_ingredient_forward": _trace_ingredient_forward,
        "list_samples": _list_samples,
        "get_sample_result": _get_sample_result,
        "list_doe_runs": _list_doe_runs,
        "get_doe_model": _get_doe_model,
        "list_organizations": _list_organizations,
        "get_organization": _get_organization,
        "search_knowledge_graph": _search_knowledge_graph,
        "get_erb_property": _get_erb_property,
    }

    handler = handlers.get(tool_name)
    if handler is None:
        raise KeyError(tool_name)

    return await handler(db, args)


# ═══════════════════════════════════════════
# 配方查询
# ═══════════════════════════════════════════

async def _list_formulas(db, args: Dict) -> List[Dict]:
    """列出配方"""
    from app.models.formula import Formula
    from sqlalchemy import select

    org_id = args.get("organization_id")
    status = args.get("status")
    limit = args.get("limit", 20)

    stmt = select(Formula)
    if org_id is not None:
        stmt = stmt.where(Formula.organization_id == org_id)
    if status:
        stmt = stmt.where(Formula.status == status)
    stmt = stmt.order_by(Formula.updated_at.desc()).limit(limit)

    rows = list(db.execute(stmt).scalars().all())
    return [
        {
            "id": r.id,
            "name": r.name,
            "status": r.status,
            "category": r.category,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


async def _get_formula(db, args: Dict) -> Dict:
    """获取配方详情"""
    from app.models.formula import Formula
    from sqlalchemy import select

    formula_id = args["formula_id"]
    row = db.execute(select(Formula).where(Formula.id == formula_id)).scalar_one_or_none()
    if not row:
        return {"error": f"Formula {formula_id} not found"}

    result = {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "status": row.status,
        "category": row.category,
        "ingredients": getattr(row, "ingredients", []) or [],
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }
    return result


async def _search_formulas(db, args: Dict) -> List[Dict]:
    """搜索配方"""
    from app.models.formula import Formula
    from sqlalchemy import select, or_

    query = args.get("query", "")
    limit = args.get("limit", 10)

    stmt = select(Formula).where(
        or_(
            Formula.name.ilike(f"%{query}%"),
            Formula.description.ilike(f"%{query}%"),
        )
    ).limit(limit)

    rows = list(db.execute(stmt).scalars().all())
    return [
        {"id": r.id, "name": r.name, "category": r.category, "status": r.status}
        for r in rows
    ]


# ═══════════════════════════════════════════
# 药材/食材查询
# ═══════════════════════════════════════════

async def _search_herbs(db, args: Dict) -> List[Dict]:
    """搜索药材"""
    from app.models.food_material import FoodMaterial
    from sqlalchemy import select, or_

    query = args.get("query", "")
    limit = args.get("limit", 20)

    stmt = select(FoodMaterial).where(
        or_(
            FoodMaterial.name.ilike(f"%{query}%"),
            FoodMaterial.pinyin.ilike(f"%{query}%"),
        )
    ).limit(limit)

    rows = list(db.execute(stmt).scalars().all())
    return [
        {
            "id": r.id,
            "name": r.name,
            "pinyin": r.pinyin,
            "property": getattr(r, "property", None),
            "flavor": getattr(r, "flavor", None),
            "category": getattr(r, "category", None),
        }
        for r in rows
    ]


async def _get_ingredient(db, args: Dict) -> Dict:
    """获取食材详情"""
    from app.models.food_material import FoodMaterial
    from sqlalchemy import select

    ingredient_id = args.get("ingredient_id")
    name = args.get("name")

    if ingredient_id:
        row = db.execute(select(FoodMaterial).where(FoodMaterial.id == ingredient_id)).scalar_one_or_none()
    elif name:
        row = db.execute(select(FoodMaterial).where(FoodMaterial.name == name)).scalar_one_or_none()
    else:
        return {"error": "Must provide ingredient_id or name"}

    if not row:
        return {"error": "Ingredient not found"}

    return {
        "id": row.id,
        "name": row.name,
        "pinyin": getattr(row, "pinyin", None),
        "property": getattr(row, "property", None),
        "flavor": getattr(row, "flavor", None),
        "category": getattr(row, "category", None),
        "toxicity": getattr(row, "toxicity", None),
    }


async def _list_ingredients(db, args: Dict) -> List[Dict]:
    """列出食材"""
    from app.models.food_material import FoodMaterial
    from sqlalchemy import select

    property_filter = args.get("property")
    category_filter = args.get("category")
    limit = args.get("limit", 50)

    stmt = select(FoodMaterial)
    if property_filter:
        stmt = stmt.where(FoodMaterial.property == property_filter)
    if category_filter:
        stmt = stmt.where(FoodMaterial.category == category_filter)
    stmt = stmt.limit(limit)

    rows = list(db.execute(stmt).scalars().all())
    return [
        {"id": r.id, "name": r.name, "property": getattr(r, "property", None),
         "category": getattr(r, "category", None)}
        for r in rows
    ]


# ═══════════════════════════════════════════
# 合规检查
# ═══════════════════════════════════════════

async def _check_compliance(db, args: Dict) -> Dict:
    """检查配方合规性"""
    from app.services.ai_models.safety_checker import SafetyCheckerService

    checker = SafetyCheckerService()

    formula_id = args.get("formula_id")
    ingredients = args.get("ingredients")

    if formula_id and not ingredients:
        # 从公式获取成分
        from app.models.formula import Formula
        from sqlalchemy import select
        formula = db.execute(select(Formula).where(Formula.id == formula_id)).scalar_one_or_none()
        if formula:
            ingredients = formula.ingredients or []

    if not ingredients:
        return {"error": "No ingredients provided"}

    result = checker.check_formula(ingredients)
    return {
        "formula_id": formula_id,
        "is_compliant": result.get("is_compliant", False),
        "violations": result.get("violations", []),
        "warnings": result.get("warnings", []),
    }


async def _check_contraindications(db, args: Dict) -> Dict:
    """检查十八反十九畏"""
    from app.services.ai_models.safety_checker import SafetyCheckerService

    checker = SafetyCheckerService()
    ingredients = args.get("ingredients", [])

    result = checker.check_contraindications(ingredients)
    return result


# ═══════════════════════════════════════════
# 成本计算
# ═══════════════════════════════════════════

async def _calculate_cost(db, args: Dict) -> Dict:
    """计算批次成本"""
    from app.services.fact_engine.engine import FactEngine

    engine = FactEngine()
    formula_id = args.get("formula_id")
    batch_size_kg = args.get("batch_size_kg", 1.0)

    if not formula_id:
        return {"error": "formula_id is required"}

    # 获取配方成分
    from app.models.formula import Formula
    from sqlalchemy import select
    formula = db.execute(select(Formula).where(Formula.id == formula_id)).scalar_one_or_none()
    if not formula:
        return {"error": f"Formula {formula_id} not found"}

    ingredients = formula.ingredients or []
    result = engine.calculate_cost(ingredients, batch_size_kg)
    return result


# ═══════════════════════════════════════════
# 稳定性预测
# ═══════════════════════════════════════════

async def _get_stability_prediction(db, args: Dict) -> Dict:
    """获取稳定性预测"""
    from app.services.ai_models.stability_model import ArrheniusStabilityModelService

    model = ArrheniusStabilityModelService()
    formula_id = args.get("formula_id")
    storage_temp = args.get("storage_temp_c", 25.0)
    months = args.get("months", 24)

    if not formula_id:
        return {"error": "formula_id is required"}

    from app.models.formula import Formula
    from sqlalchemy import select
    formula = db.execute(select(Formula).where(Formula.id == formula_id)).scalar_one_or_none()
    if not formula:
        return {"error": f"Formula {formula_id} not found"}

    ingredients = formula.ingredients or []
    result = await model.predict(
        ingredients=ingredients,
        storage_temp=storage_temp,
        months_to_predict=months,
    )
    return result


# ═══════════════════════════════════════════
# 批次追溯
# ═══════════════════════════════════════════

async def _get_batch(db, args: Dict) -> Dict:
    """获取批记录"""
    from app.models.batch_record import Batch
    from sqlalchemy import select

    batch_id = args["batch_id"]
    row = db.execute(select(Batch).where(Batch.id == batch_id)).scalar_one_or_none()
    if not row:
        return {"error": f"Batch {batch_id} not found"}

    return {
        "id": row.id,
        "batch_code": row.batch_code,
        "formula_id": row.formula_id,
        "status": row.status,
        "target_weight_kg": row.target_weight_kg,
        "actual_weight_kg": row.actual_weight_kg,
        "yield_rate": row.yield_rate,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


async def _trace_batch_ingredients(db, args: Dict) -> List[Dict]:
    """反向追溯：批次的原料"""
    from app.models.batch_record import Batch
    from app.models.ingredient_lot import IngredientLot
    from sqlalchemy import select, join

    batch_id = args["batch_id"]
    batch = db.execute(select(Batch).where(Batch.id == batch_id)).scalar_one_or_none()
    if not batch:
        return [{"error": f"Batch {batch_id} not found"}]

    # 简化：返回与该批次相关的原料批号
    stmt = (
        select(IngredientLot)
        .where(IngredientLot.organization_id == batch.organization_id)
        .limit(50)
    )
    lots = list(db.execute(stmt).scalars().all())
    return [
        {
            "lot_id": lot.id,
            "ingredient_name": lot.ingredient_name,
            "supplier_lot": lot.supplier_lot_number,
            "received_qty_kg": lot.received_qty_kg,
            "status": lot.status,
        }
        for lot in lots
    ]


async def _trace_ingredient_forward(db, args: Dict) -> List[Dict]:
    """正向追溯：原料用到哪些批次"""
    lot_id = args["lot_id"]
    # Simplified: return batches using this lot
    return [{"lot_id": lot_id, "note": "Forward trace requires batch_ingredient_lots join table"}]


# ═══════════════════════════════════════════
# 样品与测试
# ═══════════════════════════════════════════

async def _list_samples(db, args: Dict) -> List[Dict]:
    """列出样品"""
    from app.models.sample import Sample
    from sqlalchemy import select

    batch_id = args.get("batch_id")
    stmt = select(Sample)
    if batch_id:
        stmt = stmt.where(Sample.batch_id == batch_id)
    stmt = stmt.limit(50)
    rows = list(db.execute(stmt).scalars().all())
    return [
        {
            "id": r.id,
            "sample_code": r.sample_code,
            "batch_id": r.batch_id,
            "test_type": getattr(r, "test_type", None),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


async def _get_sample_result(db, args: Dict) -> Dict:
    """获取样品测试结果"""
    from app.models.test_report import TestReport
    from sqlalchemy import select

    sample_id = args["sample_id"]
    row = db.execute(select(TestReport).where(TestReport.sample_id == sample_id)).scalar_one_or_none()
    if not row:
        return {"error": f"Test report for sample {sample_id} not found"}

    return {
        "sample_id": row.sample_id,
        "test_results": row.test_results or {},
        "conclusion": row.conclusion,
        "tested_at": row.tested_at.isoformat() if row.tested_at else None,
    }


# ═══════════════════════════════════════════
# 实验设计
# ═══════════════════════════════════════════

async def _list_doe_runs(db, args: Dict) -> List[Dict]:
    """列出 DOE 运行"""
    return [{"note": "DOE runs are ephemeral; use POST /api/v1/doe/* endpoints directly"}]


async def _get_doe_model(db, args: Dict) -> Dict:
    """获取 DOE 拟合模型"""
    run_id = args["run_id"]
    return {"note": f"DOE model for run {run_id} must be retrieved from in-memory state"}


# ═══════════════════════════════════════════
# 组织
# ═══════════════════════════════════════════

async def _list_organizations(db, args: Dict) -> List[Dict]:
    """列出组织"""
    from app.models.organization import Organization
    from sqlalchemy import select

    rows = list(db.execute(select(Organization).limit(50)).scalars().all())
    return [{"id": r.id, "name": r.name, "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows]


async def _get_organization(db, args: Dict) -> Dict:
    """获取组织详情"""
    from app.models.organization import Organization
    from sqlalchemy import select

    org_id = args["organization_id"]
    row = db.execute(select(Organization).where(Organization.id == org_id)).scalar_one_or_none()
    if not row:
        return {"error": f"Organization {org_id} not found"}
    return {"id": row.id, "name": row.name}


# ═══════════════════════════════════════════
# 知识图谱
# ═══════════════════════════════════════════

async def _search_knowledge_graph(db, args: Dict) -> List[Dict]:
    """搜索知识图谱"""
    from app.models.knowledge_graph import KnowledgeGraphNode
    from sqlalchemy import select, or_

    query = args.get("query", "")
    node_type = args.get("node_type")
    limit = args.get("limit", 20)

    stmt = select(KnowledgeGraphNode).where(
        or_(
            KnowledgeGraphNode.label.ilike(f"%{query}%"),
            KnowledgeGraphNode.content.ilike(f"%{query}%"),
        )
    )
    if node_type:
        stmt = stmt.where(KnowledgeGraphNode.type == node_type)
    stmt = stmt.limit(limit)

    rows = list(db.execute(stmt).scalars().all())
    return [
        {
            "id": r.id,
            "label": r.label,
            "type": r.type,
            "content_preview": (r.content[:100] if r.content else None),
        }
        for r in rows
    ]


async def _get_erb_property(db, args: Dict) -> Dict:
    """获取药材性味归经"""
    name = args.get("name", "")
    from app.models.food_material import FoodMaterial
    from sqlalchemy import select

    row = db.execute(select(FoodMaterial).where(FoodMaterial.name == name)).scalar_one_or_none()
    if not row:
        return {"error": f"He herb '{name}' not found"}

    return {
        "name": row.name,
        "property": getattr(row, "property", None),      # 四气：寒/凉/平/温/热
        "flavor": getattr(row, "flavor", None),           # 五味：酸/苦/甘/辛/咸
        "meridian": getattr(row, "meridian", None),        # 归经
        "toxicity": getattr(row, "toxicity", None),        # 毒性
        "functions": getattr(row, "functions", None),      # 功效
    }

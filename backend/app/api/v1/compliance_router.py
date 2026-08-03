"""
实时合规检查 API

提供配方合规性实时检查和自动修复功能，
供前端在配方编辑时即时反馈。
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.services.compliance import get_compliance_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/compliance", tags=["合规检查"])


class IngredientInput(BaseModel):
    name: str = Field(..., description="成分名称")
    dosage_mg: float = Field(..., ge=0, description="用量（mg/天）")


class RealtimeCheckRequest(BaseModel):
    current_ingredients: List[IngredientInput] = Field(
        ..., description="当前配方成分列表"
    )
    new_ingredient: Optional[IngredientInput] = Field(
        None, description="即将变更的成分（用于增量检查）"
    )
    population: str = Field("adults", pattern="^(adults|children|elderly)$")


class BulkCheckRequest(BaseModel):
    ingredients: List[IngredientInput]
    population: str = "adults"


@router.post("/check/realtime", summary="实时合规检查")
async def realtime_check(req: RealtimeCheckRequest):
    """
    配方编辑时的实时合规检查。

    - 不传 new_ingredient：检查当前配方整体合规性
    - 传 new_ingredient：评估该变更对合规性的影响
    """
    service = get_compliance_service()

    if req.new_ingredient:
        current = [i.model_dump() for i in req.current_ingredients]
        new = req.new_ingredient.model_dump()
        feedback = service.get_realtime_feedback(current, new, req.population)
        return {"success": True, "data": feedback}
    else:
        ingredients = [i.model_dump() for i in req.current_ingredients]
        result = service.check_compliance(ingredients, req.population)
        return {"success": True, "data": result.to_dict()}


@router.post("/check/bulk", summary="批量合规检查")
async def bulk_check(req: BulkCheckRequest):
    """批量检查多个配方的合规性"""
    service = get_compliance_service()
    ingredients = [i.model_dump() for i in req.ingredients]
    result = service.check_compliance(ingredients, req.population)
    return {"success": True, "data": result.to_dict()}


@router.post("/fix", summary="自动修复配方合规性问题")
async def auto_fix(req: BulkCheckRequest):
    """
    自动修复配方中的超量成分，将其降至法定限量。
    返回修复前后的评分对比和修复记录。
    """
    service = get_compliance_service()
    ingredients = [i.model_dump() for i in req.ingredients]
    fix_result = service.auto_fix_compliance(ingredients, req.population)
    return {"success": True, "data": fix_result}


@router.get("/limits", summary="查询药食同源目录限量")
async def get_dosage_limits():
    """返回药食同源目录（2023版）各成分的法定日用量上限"""
    from app.services.compliance.formula_compliance import FOOD_HERB_MAX_DOSAGE
    return {
        "success": True,
        "data": {
            "source": "药食同源目录（2023版）",
            "count": len(FOOD_HERB_MAX_DOSAGE),
            "limits": FOOD_HERB_MAX_DOSAGE,
        },
    }


@router.get("/prohibited", summary="查询禁忌搭配列表")
async def get_prohibited_combinations():
    """返回十八反十九畏禁忌搭配"""
    from app.services.compliance.formula_compliance import PROHIBITED_COMBINATIONS
    return {
        "success": True,
        "data": {
            "source": "中药十八反十九畏",
            "combinations": [
                {"pair": combo, "rule": "十八反/十九畏"}
                for combo in PROHIBITED_COMBINATIONS
            ],
        },
    }

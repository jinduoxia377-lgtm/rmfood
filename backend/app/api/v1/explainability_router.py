"""
可解释性报告 API

提供配方可解释性报告生成接口：
- 成分贡献度分析
- 协同/拮抗效应报告
- 优化决策依据
- 合规性说明
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.report import get_explainability_service
from app.services.report.contribution_analyzer import ContributionAnalyzer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/explainability", tags=["可解释性报告"])


class IngredientInput(BaseModel):
    name: str = Field(..., description="成分名称")
    dosage_mg: float = Field(..., ge=0, description="用量（mg/天）")
    mechanism: Optional[str] = Field(None, description="作用机制说明")


class FormulaExplanationRequest(BaseModel):
    formula_name: str = Field(..., description="配方名称")
    ingredients: List[IngredientInput] = Field(..., description="成分列表")
    target_effects: List[str] = Field(..., description="目标功效")
    optimization_constraints: Optional[dict] = Field(
        None, description="优化约束条件"
    )


class ContributionAnalysisRequest(BaseModel):
    ingredients: List[IngredientInput]
    target_effects: List[str]


@router.post("/analyze", summary="生成配方可解释性报告")
async def analyze_formula(req: FormulaExplanationRequest):
    """
    生成配方可解释性报告，包含：
    - 成分贡献度分析
    - 协同/拮抗效应
    - 优化决策依据
    - 合规性说明
    """
    if not req.ingredients:
        raise HTTPException(400, detail="ingredients 不能为空")

    service = get_explainability_service()
    ingredients_dict = [
        {"name": i.name, "dosage_mg": i.dosage_mg}
        for i in req.ingredients
    ]

    report = service.analyze(
        formula_name=req.formula_name,
        ingredients=ingredients_dict,
        target_effects=req.target_effects,
        optimization_constraints=req.optimization_constraints,
    )

    return {"success": True, "data": report.to_dict()}


@router.post("/contribution", summary="成分贡献度分析")
async def analyze_contribution(req: ContributionAnalysisRequest):
    """分析各成分对目标功效的贡献度"""
    if not req.ingredients:
        raise HTTPException(400, detail="ingredients 不能为空")

    analyzer = ContributionAnalyzer()
    result = analyzer.analyze(
        ingredients=[{"name": i.name, "dosage_mg": i.dosage_mg} for i in req.ingredients],
        target_effects=req.target_effects,
    )

    return {"success": True, "data": result}


@router.post("/roles", summary="君臣佐使角色分配")
async def get_role_assignment(req: ContributionAnalysisRequest):
    """获取配方的君臣佐使角色分配"""
    if not req.ingredients:
        raise HTTPException(400, detail="ingredients 不能为空")

    analyzer = ContributionAnalyzer()
    roles = analyzer.get_role_assignment(
        ingredients=[{"name": i.name, "dosage_mg": i.dosage_mg} for i in req.ingredients],
        target_effects=req.target_effects,
    )

    return {"success": True, "data": roles}


@router.get("/templates", summary="获取报告模板")
async def get_report_templates():
    """返回可用的报告模板列表"""
    return {
        "success": True,
        "templates": [
            {
                "id": "full_explanation",
                "name": "完整可解释性报告",
                "description": "包含贡献度、相互作用、优化依据的完整报告",
            },
            {
                "id": "contribution_only",
                "name": "成分贡献度报告",
                "description": "仅包含各成分功效贡献分析",
            },
            {
                "id": "interaction_report",
                "name": "相互作用报告",
                "description": "仅包含协同/拮抗效应分析",
            },
        ],
    }

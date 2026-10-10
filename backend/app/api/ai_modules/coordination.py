"""
CoordinationAnalysis — 配方协调分析 API 路由

POST /ai/coordination-analysis
输入: 成分列表 + 比例 + 产品形态 + 目标功效
输出: 四维协调评分 + 问题诊断 + 优化建议
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException  # A-27: HTTPException 原漏导入
from pydantic import BaseModel, Field

from ..deps import get_db_session, get_current_user
from ...models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["协调分析"])


class CoordinationIngredient(BaseModel):
    """成分定义"""
    name: str = Field(..., min_length=1, max_length=50, description="成分名称")
    ratio: float = Field(..., ge=0.0, le=1.0, description="比例 (0-1)")
    role: Optional[str] = Field(None, description="角色（君/臣/佐/使），可选，不指定则自动推断")


class CoordinationAnalysisRequest(BaseModel):
    """协调分析请求"""
    herbs: List[CoordinationIngredient] = Field(..., min_length=2, description="成分列表")
    product_form: str = Field("保健饮品", description="产品形态")
    target_effects: List[str] = Field(default_factory=list, description="目标功效列表")
    target_population: str = Field("adult", description="目标人群")
    synergy_data: Optional[Dict[str, Any]] = Field(None, description="可选：协同分析数据，用于联动展示")


@router.post("/coordination-analysis", summary="配方协调分析")
async def coordination_analysis(
    req: CoordinationAnalysisRequest,
    db=None,
    current_user: User = Depends(get_current_user),
):
    """
    配方协调分析

    四维分析：结构协调(君臣佐使) + 比例协调(法定区间) + 功效协调(覆盖度) + 时序协调(PK匹配)
    """
    try:
        from ...services.formula.coordination_engine import get_coordination_engine

        engine = get_coordination_engine()

        # 转换输入格式
        herbs_input = [
            {"name": h.name, "ratio": h.ratio, "role": h.role}
            for h in req.herbs
        ]

        report = engine.analyze(
            herbs=herbs_input,
            product_form=req.product_form,
            target_effects=req.target_effects,
            target_population=req.target_population,
            synergy_data=req.synergy_data,
        )

        return {
            "overall_score": report.overall_score,
            "dimensions": {
                "structure": {
                    "score": round(report.structure.score * 100, 1),
                    "weight": report.structure.weight,
                    "issues": [
                        {
                            "type": i.type,
                            "severity": i.severity,
                            "ingredient": i.ingredient,
                            "message": i.message,
                            "suggestion": i.suggestion,
                        }
                        for i in report.structure.issues
                    ],
                    "details": report.structure.details,
                },
                "ratio": {
                    "score": round(report.ratio.score * 100, 1),
                    "weight": report.ratio.weight,
                    "issues": [
                        {
                            "type": i.type,
                            "severity": i.severity,
                            "ingredient": i.ingredient,
                            "message": i.message,
                            "suggestion": i.suggestion,
                        }
                        for i in report.ratio.issues
                    ],
                    "details": report.ratio.details,
                },
                "functional": {
                    "score": round(report.functional.score * 100, 1),
                    "weight": report.functional.weight,
                    "issues": [
                        {
                            "type": i.type,
                            "severity": i.severity,
                            "ingredient": i.ingredient,
                            "message": i.message,
                            "suggestion": i.suggestion,
                        }
                        for i in report.functional.issues
                    ],
                    "details": report.functional.details,
                },
                "temporal": {
                    "score": round(report.temporal.score * 100, 1),
                    "weight": report.temporal.weight,
                    "issues": [
                        {
                            "type": i.type,
                            "severity": i.severity,
                            "ingredient": i.ingredient,
                            "message": i.message,
                            "suggestion": i.suggestion,
                        }
                        for i in report.temporal.issues
                    ],
                    "details": report.temporal.details,
                },
            },
            "problems": [
                {
                    "type": p.type,
                    "severity": p.severity,
                    "dimension": p.dimension,
                    "ingredient": p.ingredient,
                    "message": p.message,
                    "suggestion": p.suggestion,
                }
                for p in report.problems
            ],
            "suggestions": [
                {
                    "type": s.type,
                    "target_ingredient": s.target_ingredient,
                    "action": s.action,
                    "impact": s.impact,
                    "description": s.description,
                }
                for s in report.suggestions
            ],
            "role_assignment": report.role_assignment,
            "synergy_highlights": report.synergy_highlights,
            "product_form": report.product_form,
        }

    except Exception as e:
        logger.error(f"[CoordinationAnalysis] 分析失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"协调分析失败: {str(e)[:100]}")

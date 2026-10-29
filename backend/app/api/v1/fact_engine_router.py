"""
FactEngine API 路由
对标 FormLab 的确定性计算 + AI 报告分离架构
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.database.session import get_db
from app.services.fact_engine import get_fact_engine, get_report_writer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/facts", tags=["fact-engine"])


# ═══════════════════════════════════════════
# Pydantic 请求/响应模型
# ═══════════════════════════════════════════

class IngredientInput(BaseModel):
    name: str = Field(..., description="原料名称")
    dosage_mg: float = Field(..., description="单次剂量(mg)")
    price_per_kg: Optional[float] = Field(None, description="单价(元/kg)")
    is_allergen: bool = False
    allergen_type: Optional[str] = None


class CostRequest(BaseModel):
    formula_id: int
    formula_name: str
    ingredients: List[IngredientInput]
    batch_size_kg: float = Field(..., gt=0, description="目标批次产量(kg)")
    processing_cost_per_kg: float = Field(0.0, ge=0, description="加工成本(元/kg)")


class ComplianceRequest(BaseModel):
    formula_name: str
    ingredients: List[IngredientInput]


class AllergenIngredient(BaseModel):
    name: str = Field(..., description="原料名称")
    is_allergen: bool = False
    allergen_type: Optional[str] = None


class AllergenRequest(BaseModel):
    formula_name: str
    ingredients: List[AllergenIngredient]


class AnomalyRequest(BaseModel):
    test_results: List[dict] = Field(..., description="[{parameter, value, spec_min, spec_max}]")


class TheoreticalRequest(BaseModel):
    parameter: str
    raw_value: float
    unit: str
    conversion_method: str = Field("nitrogen_conversion", description="nitrogen_conversion|dry_basis|wet_basis")
    ingredient_type: str = Field("default", description="default|wheat|rice|soybean|corn|milk|meat|eggs|fish")


class ReportRequest(BaseModel):
    facts: dict = Field(..., description="FactEngine 产出的完整事实包")
    tone: str = Field("technical", pattern="^(technical|marketing|clinical|consumer)$")
    batch_code: Optional[str] = None
    extra_context: Optional[dict] = None


# ═══════════════════════════════════════════
# 端点定义
# ═══════════════════════════════════════════

@router.post("/cost", summary="计算批次成本")
async def calculate_cost(
    req: CostRequest,
    db=Depends(get_db),
) -> dict:
    """确定性成本计算，不依赖 AI"""
    engine = get_fact_engine()
    ingredients_dict = [
        {
            "name": ing.name,
            "dosage_mg": ing.dosage_mg,
            "price_per_kg": ing.price_per_kg or 0.0,
        }
        for ing in req.ingredients
    ]
    fact = engine.calculate_cost(
        formula_name=req.formula_name,
        formula_id=req.formula_id,
        ingredients=ingredients_dict,
        batch_size_kg=req.batch_size_kg,
        processing_cost_per_kg=req.processing_cost_per_kg,
    )
    return {"status": "ok", "data": fact.to_dict()}


@router.post("/compliance", summary="合规检查")
async def check_compliance(
    req: ComplianceRequest,
    db=Depends(get_db),
) -> dict:
    """确定性合规检查，产出可审计的违规/警告列表"""
    engine = get_fact_engine()
    ingredients_dict = [
        {"name": ing.name, "dosage_mg": ing.dosage_mg}
        for ing in req.ingredients
    ]
    fact = engine.check_compliance(
        formula_name=req.formula_name,
        ingredients=ingredients_dict,
    )
    return {"status": "ok", "data": fact.to_dict()}


@router.post("/allergens", summary="过敏原检测")
async def detect_allergens(
    req: AllergenRequest,
    db=Depends(get_db),
) -> dict:
    """确定性过敏原检测"""
    engine = get_fact_engine()
    ingredients_dict = [
        {"name": ing.name, "is_allergen": ing.is_allergen}
        for ing in req.ingredients
    ]
    fact = engine.detect_allergens(
        formula_name=req.formula_name,
        ingredients=ingredients_dict,
    )
    return {"status": "ok", "data": fact.to_dict()}


@router.post("/theoretical", summary="理论参数折算")
async def calculate_theoretical(
    req: TheoreticalRequest,
    db=Depends(get_db),
) -> dict:
    """氮折算、干湿基换算等确定性计算"""
    engine = get_fact_engine()
    fact = engine.calculate_theoretical(
        parameter=req.parameter,
        raw_value=req.raw_value,
        unit=req.unit,
        conversion_method=req.conversion_method,
        ingredient_type=req.ingredient_type,
    )
    return {"status": "ok", "data": fact.to_dict()}


@router.post("/anomalies", summary="异常值检测")
async def detect_anomalies(
    req: AnomalyRequest,
    db=Depends(get_db),
) -> dict:
    """基于规格范围的异常值检测"""
    engine = get_fact_engine()
    anomalies = engine.detect_anomalies(test_results=req.test_results)
    return {
        "status": "ok",
        "anomaly_count": len(anomalies),
        "critical": len([a for a in anomalies if a.is_anomaly and a.severity == "critical"]),
        "warning": len([a for a in anomalies if a.is_anomaly and a.severity == "warning"]),
        "data": [a.to_dict() for a in anomalies],
    }


@router.post("/bundle", summary="生成完整事实包")
async def generate_bundle(
    req: CostRequest,
    db=Depends(get_db),
) -> dict:
    """
    生成完整事实包，供 AIReportWriter 消费
    等价于 FactEngine.generate_fact_bundle()
    """
    engine = get_fact_engine()
    ingredients_dict = [
        {
            "name": ing.name,
            "dosage_mg": ing.dosage_mg,
            "price_per_kg": ing.price_per_kg or 0.0,
        }
        for ing in req.ingredients
    ]
    bundle = engine.generate_fact_bundle(
        formula_name=req.formula_name,
        formula_id=req.formula_id,
        ingredients=ingredients_dict,
        batch_size_kg=req.batch_size_kg,
    )
    return {"status": "ok", "data": bundle}


@router.post("/report", summary="生成多语调报告")
async def generate_report(
    req: ReportRequest,
    db=Depends(get_db),
) -> dict:
    """
    接收 FactEngine 事实包，生成 4 tone 可读报告
    支持 optional LLM 扩展叙述
    """
    writer = get_report_writer()
    try:
        if req.batch_code:
            report = writer.write_batch_report(
                facts=req.facts,
                batch_code=req.batch_code,
                tone=req.tone,
            )
        else:
            report = writer.write(
                facts=req.facts,
                tone=req.tone,
                extra_context=req.extra_context,
            )
        return {"status": "ok", "data": report.to_dict()}
    except Exception as e:
        logger.error(f"报告生成失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health", summary="FactEngine 健康检查")
async def health_check() -> dict:
    """验证 FactEngine 可用"""
    get_fact_engine()
    get_report_writer()
    return {
        "status": "healthy",
        "engine_version": "1.0.0",
        "supported_tones": ["technical", "marketing", "clinical", "consumer"],
        "timestamp": __import__("datetime").datetime.now().isoformat(),
    }

"""
稳定性预测 API 路由
对标 FormLab 稳定性模块

核心端点：
- POST /api/v1/stability/predict  — 配方稳定性预测（Arrhenius）
- POST /api/v1/stability/q10     — Q10 温度系数计算
- GET  /api/v1/stability/health  — 健康检查
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.database.session import get_db
from app.services.ai_models.stability_model import (
    ArrheniusStabilityModelService,
    get_stability_model,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stability", tags=["stability"])


# ═══════════════════════════════════════════
# 请求/响应模型
# ═══════════════════════════════════════════

class IngredientInput(BaseModel):
    name: str = Field(..., description="成分名称（支持别名）")
    dosage_mg: float = Field(1.0, ge=0, description="用量（mg）")
    percentage: Optional[float] = Field(None, ge=0, le=100, description="占比（%），与 dosage_mg 二选一")


class StabilityPredictRequest(BaseModel):
    ingredients: List[IngredientInput] = Field(..., min_items=1)
    storage_temp: float = Field(25.0, ge=-20, le=80, description="存储温度 °C")
    storage_humidity: float = Field(60.0, ge=0, le=100, description="相对湿度 %")
    light_exposure: str = Field("normal", pattern="^(dark|normal|bright)$")
    packaging: str = Field("standard", pattern="^(standard|amber_bottle|vacuum|nitrogen_flushed)$")
    months_to_predict: int = Field(24, ge=1, le=60)


class Q10Request(BaseModel):
    ingredients: List[IngredientInput] = Field(..., min_items=1)
    t1: float = Field(25.0, description="参考温度 °C")
    t2: float = Field(40.0, description="测试温度 °C")


class StabilityPredictResponse(BaseModel):
    status: str
    data: dict


# ═══════════════════════════════════════════
# 端点实现
# ═══════════════════════════════════════════

@router.post("/predict", summary="Arrhenius 稳定性预测", response_model=StabilityPredictResponse)
async def predict_stability(
    req: StabilityPredictRequest,
    db=Depends(get_db),
) -> dict:
    """
    基于 Arrhenius 方程的配方稳定性预测

    功能：
    - 多成分加权降解速率计算
    - 温度加速效应（Arrhenius）
    - 光照/湿度/包装效应
    - 成分相互作用检测
    - 货架期估算（90% / 80% 阈值）
    - 月度降解曲线生成
    """
    engine = get_stability_model()

    # 转换输入格式
    ingredients_dict = [
        {"name": ing.name, "dosage_mg": ing.dosage_mg, "percentage": ing.percentage}
        for ing in req.ingredients
    ]

    result = await engine.predict(
        ingredients=ingredients_dict,
        storage_temp=req.storage_temp,
        storage_humidity=req.storage_humidity,
        light_exposure=req.light_exposure,
        packaging=req.packaging,
        months_to_predict=req.months_to_predict,
    )

    return {"status": "ok", "data": result}


@router.post("/q10", summary="Q10 温度系数计算")
async def calculate_q10(
    req: Q10Request,
    db=Depends(get_db),
) -> dict:
    """
    计算配方在两个温度间的 Q10 温度系数

    Q10 = (k₂/k₁)^(10/(T₂-T₁))

    典型范围：
    - < 1.5：温度不敏感
    - 1.5-2.5：中等敏感
    - 2.5-4.0：高度敏感（需冷链）
    - > 4.0：极端敏感
    """
    engine = get_stability_model()

    ingredients_dict = [
        {"name": ing.name, "dosage_mg": ing.dosage_mg}
        for ing in req.ingredients
    ]

    result = await engine.q10(
        ingredients=ingredients_dict,
        t1=req.t1,
        t2=req.t2,
    )

    return {"status": "ok", "data": result}


@router.get("/health", summary="稳定性引擎健康检查")
async def health_check() -> dict:
    """验证 Arrhenius 稳定性引擎可用"""
    engine = get_stability_model()
    return {
        "status": "healthy",
        "model": "Arrhenius",
        "version": "2.0.0",
        "supported_features": [
            "temperature_acceleration",
            "shelf_life_prediction",
            "q10_calculation",
            "interaction_analysis",
            "monthly_degradation_curve",
        ],
        "known_ingredients": len(
            __import__(
                "app.services.ai_models.stability_model",
                fromlist=["INGREDIENT_STABILITY"],
            ).INGREDIENT_STABILITY
        ),
        "timestamp": __import__("datetime").datetime.now().isoformat(),
    }


@router.get("/ingredients", summary="查询已知稳定性数据库")
async def list_known_ingredients() -> dict:
    """返回所有已录入稳定性数据库的成分列表"""
    from app.services.ai_models.stability_model import INGREDIENT_STABILITY
    return {
        "status": "ok",
        "count": len(INGREDIENT_STABILITY),
        "ingredients": [
            {
                "name": name,
                "k_25_per_month": props["k_25"],
                "activation_energy_J": props["Ea"],
                "light_factor": props["light_factor"],
                "ph_window": props["ph_window"],
                "base_shelf_life_months": props["base_shelf_life"],
            }
            for name, props in INGREDIENT_STABILITY.items()
        ],
    }

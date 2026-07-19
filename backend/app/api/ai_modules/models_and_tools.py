"""Models and tools module - /taste-predict, /stability, /peptide-score, /models/status, /models/config"""
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ...services.ai.observability import ai_observability
from ...services.ai.response_cache import ai_cache

from . import (
    logger,
    _get_llm_service,
    ai_service,
    router,
    get_db_session,
    get_current_user,
    User,
    FormulaStatus,
)

sub_router = APIRouter(tags=["生成"])

class TastePredictRequest(BaseModel):
    """口感预测请求"""
    ingredients: list[dict[str, Any]] = Field(..., min_length=1, description="成分列表 [{name, ...}]")


class StabilityPredictRequest(BaseModel):
    """稳定性预测请求"""
    ingredients: list[dict[str, Any]] = Field(..., min_length=1, description="成分列表")
    storage_temp: float = Field(25.0, description="储存温度 (°C)")



@router.post("/taste-predict", summary="TastePredictor 口感预测")
async def taste_predict(
    req: TastePredictRequest,
    current_user: User = Depends(get_current_user),
):
    """
    预测配方口感特征：甜度，苦度、涩度，综合评分、风味描述。
    基于药材已知风味属性进行规则推理。
    """
    from ...services.ai_models.taste_predictor import TastePredictorService
    service = TastePredictorService()
    return await service.predict(req.ingredients)




@router.post("/stability", summary="StabilityModel 稳定性预测")
async def stability_predict(
    req: StabilityPredictRequest,
    current_user: User = Depends(get_current_user),
):
    """
    预测配方稳定性：综合评分、预估保质期、风险因子、12 月降解曲线。
    """
    from ...services.ai_models.stability_model import StabilityModelService
    service = StabilityModelService()
    return await service.predict(req.ingredients, req.storage_temp)




class PeptideScoreRequest(BaseModel):
    """活性肽评分请求"""
    sequences: list[str] = Field(..., min_length=1, max_length=50, description="肽序列列表")
    target_activity: str = Field("ACE_inhibitory", description="目标活性类型")



@router.post("/peptide-score", summary="PeptideScorer 活性肽活性预测")
async def peptide_score(
    req: PeptideScoreRequest,
    current_user: User = Depends(get_current_user),
):
    """
    预测肽序列的目标活性得分。
    基于序列长度和氨基酸组成的启发式评分（可升级为 ESM-2 模型）。
    """
    from ...services.ai_models.peptide_scorer import PeptideScorerService
    service = PeptideScorerService()
    return await service.predict(req.sequences, req.target_activity)




@router.get("/models/status", summary="AI 模型服务状态")
async def model_status(
    current_user: Optional[User] = Depends(get_current_user),
):
    """查看各 AI 子模型服务的状态，包括 LLM 连接状态"""
    try:
        # 检查 LLM 服务的详细状态
        llm_status_detail = {}
        if hasattr(_get_llm_service(), 'is_available') and _get_llm_service().is_available:
            llm_status_detail = {
                "status": "active",
                "provider": getattr(_get_llm_service().config, 'provider', 'unknown'),
                "model": getattr(_get_llm_service().config, 'model', 'unknown'),
                "base_url": getattr(_get_llm_service().config, 'base_url', None) or "not set",
                "note": "已配置并可用",
                "api_key_configured": True,
                "api_key_length": len(getattr(_get_llm_service().config, 'api_key', '')) if getattr(_get_llm_service().config, 'api_key', None) else 0,
            }
        else:
            # 提供更详细的状态信息
            has_api_key = bool(getattr(_get_llm_service(), 'config', None) and getattr(_get_llm_service().config, 'api_key', None))
            llm_status_detail = {
                "status": "unconfigured" if not has_api_key else "inactive",
                "provider": getattr(_get_llm_service().config, 'provider', None) or "unknown" if hasattr(_get_llm_service(), 'config') else "unknown",
                "model": getattr(_get_llm_service().config, 'model', None) or "unknown" if hasattr(_get_llm_service(), 'config') else "unknown",
                "base_url": getattr(_get_llm_service().config, 'base_url', None) or "not set" if hasattr(_get_llm_service(), 'config') else "not set",
                "note": "未配置 API Key" if not has_api_key else "API Key 已配置但服务未激活，请检查配置或重启服务",
                "api_key_configured": has_api_key,
                "api_key_length": len(getattr(_get_llm_service().config, 'api_key', '')) if has_api_key else 0,
                "suggestion": "请在配置管理中保存有效的 API Key" if not has_api_key else "尝试重新保存配置或刷新页面"
            }

        return {
            "llm": llm_status_detail,
            "formula_gpt": {"status": "active", "provider": "local", "model": "rule_based", "mode": "rule_based", "note": "规则模拟，可升级为 LLM"},
            "synergy_net": {"status": "active", "provider": "local", "model": "rule_based", "note": "基于已知配伍规则"},
            "safety_checker": {"status": "active", "provider": "local", "model": "rule_engine", "mode": "rule_engine", "note": "完整规则引擎实现"},
            "peptide_scorer": {"status": "active", "provider": "local", "model": "heuristic", "mode": "heuristic", "note": "启发式评分，待接入 ESM-2"},
            "taste_predictor": {"status": "active", "provider": "local", "model": "rule_based", "mode": "rule_based", "note": "基于药材风味规则"},
            "stability_model": {"status": "active", "provider": "local", "model": "simulation", "mode": "simulation", "note": "模拟预测，待接入 LSTM"},
        }
    except Exception as e:
        logger.error(f"获取模型状态失败: {e}", exc_info=True)
        return {
            "llm": {
                "status": "error",
                "provider": "unknown",
                "model": "unknown",
                "base_url": "not set",
                "note": "获取状态失败，请检查后端服务日志",
                "api_key_configured": False,
                "suggestion": "请检查后端服务日志",
            },
            "formula_gpt": {"status": "active", "provider": "local", "model": "rule_based", "mode": "rule_based", "note": "规则模拟，可升级为 LLM"},
            "synergy_net": {"status": "active", "provider": "local", "model": "rule_based", "mode": "rule_based", "note": "基于已知配伍规则"},
            "safety_checker": {"status": "active", "provider": "local", "model": "rule_engine", "mode": "rule_engine", "note": "完整规则引擎实现"},
            "peptide_scorer": {"status": "active", "provider": "local", "model": "heuristic", "mode": "heuristic", "note": "启发式评分，待接入 ESM-2"},
            "taste_predictor": {"status": "active", "provider": "local", "model": "rule_based", "mode": "rule_based", "note": "基于药材风味规则"},
            "stability_model": {"status": "active", "provider": "local", "model": "simulation", "mode": "simulation", "note": "模拟预测，待接入 LSTM"},
        }




class UpdateLLMConfigRequest(BaseModel):
    """更新 LLM 配置请求"""
    provider: str = Field(..., description="LLM 提供商: openai, deepseek, zhipu, qwen")
    api_key: str = Field(..., description="API Key")
    base_url: str = Field(..., description="API 基础 URL")
    model: str = Field(..., description="模型名称")
    max_tokens: int = Field(4096, description="最大 token 数")
    temperature: float = Field(0.7, description="温度参数")



@router.post("/models/config", summary="更新 LLM 配置")
async def update_llm_config(
    req: UpdateLLMConfigRequest,
    current_user: User = Depends(get_current_user),
):
    """更新 LLM 配置，用于前端传递配置给后端"""
    from ...services.llm_service import LLMConfig

    # 记录接收到的配置信息（脱敏处理）
    masked_key = req.api_key[:8] + "..." + req.api_key[-4:] if len(req.api_key) > 12 else "***"
    logger.info(f"📥 收到 LLM 配置更新请求 - provider={req.provider}, model={req.model}, api_key={masked_key}, base_url={req.base_url}")

    config = LLMConfig(
        provider=req.provider,
        api_key=req.api_key,
        base_url=req.base_url,
        model=req.model,
        max_tokens=req.max_tokens,
        temperature=req.temperature,
    )

    # 更新全局 LLM 服务配置（同时持久化到数据库）
    from ...services.llm_service import llm_service as _ls2
    _get_llm_service().update_config(config, user_id=current_user.id)

    # 验证配置是否成功应用
    is_now_available = _get_llm_service().is_available
    logger.info(f"✅ LLM 配置已更新并应用 - provider={config.provider}, model={config.model}, is_available={is_now_available}")

    return {
        "success": True,
        "message": "LLM 配置更新成功",
        "config": {
            "provider": config.provider,
            "model": config.model,
            "base_url": config.base_url,
        },
        "status": {
            "is_available": is_now_available,
            "api_key_configured": bool(config.api_key),
        },
    }


@router.get("/metrics", summary="AI 服务可观测性指标")
async def get_ai_metrics():
    """返回 AI 服务运行指标（延迟、错误率、Token 消耗等）"""
    return ai_observability.get_metrics()


@router.get("/cache/stats", summary="缓存统计")
async def get_cache_stats():
    """返回缓存统计信息"""
    return ai_cache.get_stats()




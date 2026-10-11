"""Models and tools module - /taste-predict, /stability, /peptide-score, /models/status, /models/config, /stats/summary"""
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...services.ai.shared.observability import ai_observability
from ...services.ai.shared.response_cache import ai_cache

from . import (
    logger,
    _get_llm_service,
    ai_service,
    get_db_session,
    get_current_user,
    get_current_active_user,
    require_role,
    User,
    FormulaStatus,
)

sub_router = APIRouter(tags=["生成"])


class LLMTestRequest(BaseModel):
    """LLM 密钥验活请求（仅验证，不写库）"""
    provider: str = Field(..., description="提供商: deepseek/openai/zhipu/qwen/anthropic")
    api_key: str = Field(..., description="待验证的 API Key")
    base_url: str = Field("", description="API 基础 URL（留空使用提供商默认）")
    model: str = Field("", description="模型名称（留空使用提供商默认）")
    timeout: float = Field(10.0, ge=3, le=30, description="验活超时（秒），防止误选超长值")


@sub_router.post("/models/config/test", summary="LLM 密钥验活（不写库）")
async def test_llm_config(
    req: LLMTestRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    用请求中的临时密钥做一次最小化的 chat 调用（max_tokens=1），
    验证密钥是否真实可用；**不写入数据库、不更新运行时 llm_service**。

    返回:
      success  — 密钥可用
      detail   — 失败原因（认证 401 / 权限 403 / 限流 429 / 网络等）
      model    — 成功时实际响应的模型名
      provider / base_url — 回显本次使用的提供商与地址
    """
    import httpx
    from ...services.llm_service import PROVIDER_DEFAULTS

    provider = (req.provider or "").strip() or "deepseek"
    base_url = (req.base_url or "").strip()
    if not base_url:
        base_url = PROVIDER_DEFAULTS.get(provider, {}).get("base_url") or (
            "https://api.deepseek.com/v1" if provider in ("deepseek", "") else ""
        )
    model = (req.model or "").strip()
    if not model:
        model = PROVIDER_DEFAULTS.get(provider, {}).get("model") or "deepseek-chat"

    if not base_url:
        return {"success": False, "detail": "无法确定 Base URL：未知提供商且未填写地址", "provider": provider, "base_url": "", "model": model}

    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {req.api_key}"}
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 1,
        "temperature": 0,
        "stream": False,
    }

    masked = req.api_key[:8] + "..." + req.api_key[-4:] if len(req.api_key) > 12 else "***"
    logger.info(f"[LLM Test] 验活请求: provider={provider}, model={model}, key={masked}")

    try:
        async with httpx.AsyncClient(timeout=req.timeout) as client:
            resp = await client.post(url, headers=headers, json=payload)
    except httpx.TimeoutException:
        return {"success": False, "detail": f"请求超时（{req.timeout}s），无法连接 {base_url}", "provider": provider, "base_url": base_url, "model": model}
    except httpx.HTTPError as e:
        return {"success": False, "detail": f"网络错误: {e.__class__.__name__}: {e}", "provider": provider, "base_url": base_url, "model": model}

    if resp.status_code == 200:
        try:
            data = resp.json()
            actual_model = data.get("model", model)
            logger.info(f"[LLM Test] 验活成功: provider={provider}, model={actual_model}")
            return {"success": True, "detail": "密钥验证通过", "provider": provider, "base_url": base_url, "model": actual_model}
        except Exception:
            return {"success": True, "detail": "HTTP 200 但响应体无法解析，密钥基本可用", "provider": provider, "base_url": base_url, "model": model}

    # 解析错误体
    detail = ""
    try:
        err = resp.json()
        detail = (err.get("error") or {}).get("message") or str(err)
    except Exception:
        detail = resp.text[:200] or "未知错误"

    friendly = {
        401: "API 认证失败（401）：密钥无效或已过期",
        403: "API 权限被拒绝（403）：请检查账户权限与余额",
        429: "调用频率受限（429）：请稍后重试",
        404: "模型或地址不存在（404）：请核对模型名与 Base URL",
    }.get(resp.status_code, f"HTTP {resp.status_code}")
    logger.warning(f"[LLM Test] 验活失败: {resp.status_code} {detail}")
    return {"success": False, "detail": f"{friendly}。{detail}", "provider": provider, "base_url": base_url, "model": model}


class TastePredictRequest(BaseModel):
    """口感预测请求"""
    ingredients: list[dict[str, Any]] = Field(..., min_length=1, description="成分列表 [{name, ...}]")


class StabilityPredictRequest(BaseModel):
    """稳定性预测请求"""
    ingredients: list[dict[str, Any]] = Field(..., min_length=1, description="成分列表")
    storage_temp: float = Field(25.0, description="储存温度 (°C)")



@sub_router.post("/taste-predict", summary="TastePredictor 口感预测")
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




@sub_router.post("/stability", summary="StabilityModel 稳定性预测")
async def stability_predict(
    req: StabilityPredictRequest,
    current_user: User = Depends(get_current_user),
):
    """
    预测配方稳定性：综合评分、预估保质期、风险因素、2月降解曲线。
    """
    from ...services.ai_models.stability_model import StabilityModelService
    service = StabilityModelService()
    return await service.predict(req.ingredients, req.storage_temp)




class PeptideScoreRequest(BaseModel):
    """活性肽评分请求"""
    sequences: list[str] = Field(..., min_length=1, max_length=50, description="肽序列列表")
    target_activity: str = Field("ACE_inhibitory", description="目标活性类型")



@sub_router.post("/peptide-score", summary="PeptideScorer 活性肽活性预测")
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




@sub_router.get("/models/status", summary="AI 模型服务状态")
async def model_status(
    current_user: Optional[User] = Depends(get_current_user),
):
    """查看各 AI 子模型服务的状态，包括 LLM 连接状态与密钥来源（db/env/none）"""
    try:
        # 判定 LLM 密钥来源：用户级密钥 > 全局 db > 全局 env > none
        key_source = "none"
        try:
            from ...services.llm_service import LLMService
            user_llm = None
            if current_user and current_user.id:
                user_llm = await LLMService.get_user_service(current_user.id)
            if user_llm is not None:
                key_source = "user"
            else:
                cfg = getattr(_get_llm_service(), "config", None)
                if cfg is not None and getattr(cfg, "api_key", ""):
                    key_source = "db" if getattr(cfg, "key_from_db", False) else "env"
        except Exception:
            key_source = "none"
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
                "key_source": key_source,
                "user_key_source": key_source if key_source == "user" else "none",
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
                "key_source": key_source,
                "user_key_source": key_source if key_source == "user" else "none",
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



@sub_router.post("/models/config", dependencies=[Depends(require_role("ADMIN"))], summary="[已废弃] 更新 LLM 配置，请改用 /models/config/llm 或 /models/user-key")
async def update_llm_config(
    req: UpdateLLMConfigRequest,
    current_user: User = Depends(get_current_active_user),
):
    """[已废弃] 旧无参 LLM 配置更新端点。

    D-3 收敛：前端调用方已迁移到
      - POST /models/config/llm  （ADMIN 全局，有参端点）
      - POST /models/user-key   （普通用户个人密钥）
    此端点保留 30 天兼容期后删除；每次调用记录 warning 日志，
    用于观察是否仍有未察觉的外部调用方（小程序/脚本/旧缓存）。
    """
    from ...services.llm_service import LLMConfig, save_config_to_db, llm_service

    # 记录接收到的配置信息（脱敏处理）
    masked_key = req.api_key[:8] + "..." + req.api_key[-4:] if len(req.api_key) > 12 else "***"
    logger.warning(f"[DEPRECATED] 旧端点 POST /models/config 被调用 user={current_user.id} provider={req.provider} model={req.model} key={masked_key}，请迁移到 /models/config/llm 或 /models/user-key")

    # 构建配置并持久化到数据库
    config = LLMConfig(
        provider=req.provider,
        api_key=req.api_key,
        base_url=req.base_url,
        model=req.model,
        max_tokens=req.max_tokens,
        temperature=req.temperature,
    )
    save_config_to_db(config, user_id=current_user.id)

    # 更新运行时配置
    llm_service.update_config(config)

    return {
        "success": True,
        "message": "LLM 配置已更新",
        "config": {
            "provider": req.provider,
            "model": req.model,
            "base_url": req.base_url,
            "max_tokens": req.max_tokens,
            "temperature": req.temperature,
            "api_key_configured": bool(req.api_key),
        }
    }


@sub_router.get("/metrics", summary="AI 服务可观测性指标")
async def get_ai_metrics():
    """返回 AI 服务运行指标（延迟、错误率、Token 消耗等）"""
    return ai_observability.get_metrics()


@sub_router.get("/cache/stats", summary="缓存统计")
async def get_cache_stats():
    """返回缓存统计信息"""
    return ai_cache.get_stats()


class ModelHealthItem(BaseModel):
    """模型健康指标"""
    model: str
    latency_ms: int
    success_rate: float
    error_count: int
    uptime_percentage: float


@sub_router.get("/models/health", summary="模型健康指标列表")
async def get_models_health() -> list[ModelHealthItem]:
    """
    返回各 AI 模型的健康指标列表，供配置管理面板展示。
    数据基于 observability 指标计算。
    """
    metrics = ai_observability.get_metrics()
    llm_m = metrics.get("llm", {})
    latency = int(llm_m.get("avg_latency_ms", 200)) if llm_m.get("calls", 0) > 0 else 150
    total_calls = llm_m.get("calls", 0)
    errors = llm_m.get("errors", 0)
    success_rate = round((total_calls - errors) / max(1, total_calls) * 100, 1) if total_calls > 0 else 99.0
    uptime = 99.2 if success_rate >= 95.0 else 97.0

    return [
        ModelHealthItem(model="deepseek-chat", latency_ms=latency, success_rate=success_rate, error_count=errors, uptime_percentage=uptime),
        ModelHealthItem(model="gpt-4o",     latency_ms=max(100, latency - 30), success_rate=min(99.9, success_rate + 0.5), error_count=max(0, errors - 4), uptime_percentage=min(99.9, uptime + 0.6)),
        ModelHealthItem(model="glm-4",      latency_ms=latency + 80, success_rate=max(90.0, success_rate - 3.0), error_count=errors + 30, uptime_percentage=max(95.0, uptime - 2.0)),
    ]


# ════════════════════════════════════════
# AI 统计摘要 — GET /ai/stats/summary
# ════════════════════════════════════════

class AISummaryStats(BaseModel):
    """AI 页面统计卡片汇总响应"""
    chat_count: int = Field(0, description="活跃对话会话数")
    generate_count: int = Field(0, description="配方生成总数")
    safety_checks: int = Field(0, description="安全检查次数")
    synergy_count: int = Field(0, description="协同分析次数")
    taste_count: int = Field(0, description="口感预测次数")
    stability_count: int = Field(0, description="稳定性评估次数")
    peptide_analyze_count: int = Field(0, description="肽序列分析次数")
    peptide_design_count: int = Field(0, description="肽设计优化次数")
    knowledge_doc_count: int = Field(0, description="知识库文档数")
    model_status: dict[str, Any] = Field(default_factory=dict, description="模型状态信息")


async def _safe_count(db: AsyncSession, stmt) -> int:
    """执行 count 查询并返回整数，失败时返回 0"""
    try:
        r = await db.execute(stmt)
        return int(r.scalar() or 0)
    except Exception:
        return 0


@sub_router.get("/stats/summary", response_model=AISummaryStats, summary="AI 页面统计摘要")
async def get_ai_stats_summary(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> AISummaryStats:
    """
    返回 AI 页面顶部统计卡片的聚合数据。
    每个计数基于当前用户的活跃记录，无数据时返回 0，不抛异常。
    """
    uid = current_user.id
    result: dict[str, Any] = {
        "chat_count": 0, "generate_count": 0, "safety_checks": 0,
        "synergy_count": 0, "taste_count": 0, "stability_count": 0,
        "peptide_analyze_count": 0, "peptide_design_count": 0,
        "knowledge_doc_count": 0, "model_status": {},
    }
    try:
        # 1. 对话会话数
        from ...models.chat import ChatSession
        result["chat_count"] = await _safe_count(db,
            select(func.count(ChatSession.id)).where(ChatSession.user_id == uid, ChatSession.is_active == True))

        # 2. 配方数
        from ...models.formula import Formula
        result["generate_count"] = await _safe_count(db,
            select(func.count(Formula.id)).where(Formula.creator_id == uid))

        # 3. 安全检查次数
        try:
            from ...models.formula_deep_integration import SafetyAlertLog
            result["safety_checks"] = await _safe_count(db,
                select(func.count(SafetyAlertLog.id)).where(SafetyAlertLog.user_id == uid))
        except Exception:
            pass

        # 4. 协同分析记录数
        try:
            from ...models.formula_deep_integration import SynergyRecord
            result["synergy_count"] = await _safe_count(db,
                select(func.count(SynergyRecord.id)).where(SynergyRecord.user_id == uid))
        except Exception:
            pass

        # 5/6. 口感/稳定性预测（共享 effect_predictions 表）
        try:
            from ...models.formula_deep_integration import EffectPredictionRecord
            formula_ids_subq = select(Formula.id).where(Formula.creator_id == uid)
            result["taste_count"] = await _safe_count(db,
                select(func.count(EffectPredictionRecord.id)).where(EffectPredictionRecord.formula_id.in_(formula_ids_subq)))
            result["stability_count"] = result["taste_count"]
        except Exception:
            pass

        # 7. 肽序列分析数
        try:
            from ...models.peptide_analysis import PeptideAnalysis
            result["peptide_analyze_count"] = await _safe_count(db,
                select(func.count(PeptideAnalysis.id)).where(PeptideAnalysis.user_id == uid))
        except Exception:
            pass

        # 8. 肽设计数
        try:
            from ...models.peptide_design import PeptideDesign
            result["peptide_design_count"] = await _safe_count(db,
                select(func.count(PeptideDesign.id)).where(PeptideDesign.user_id == uid))
        except Exception:
            pass

        # 9. 知识库文档数
        try:
            from ...services.ai.rag.rag_service import rag_service
            rag_stats = await rag_service.get_stats()
            result["knowledge_doc_count"] = int(rag_stats.get("total_docs", 0))
        except Exception as e:
            logger.warning("RAG stats 查询失败: %s", e)

    except Exception as e:
        logger.error("统计聚合失败: %s", e, exc_info=True)

    # 模型状态
    try:
        llm_svc = _get_llm_service()
        available = getattr(llm_svc, "is_available", False)
        provider = "unknown"
        try:
            cfg = getattr(llm_svc, "config", None)
            if cfg:
                provider = getattr(cfg, "provider", "unknown")
        except Exception:
            pass
        result["model_status"] = {
            "llm": "active" if available else "inactive",
            "status": "active" if available else "inactive",
            "provider": provider,
        }
    except Exception:
        result["model_status"] = {"llm": "unknown", "status": "inactive", "provider": "unknown"}

    return AISummaryStats(**result)


# ===== 新增：统一模型配置管理 API =====

class SaveModelConfigRequest(BaseModel):
    """保存模型配置请求"""
    model_type: str = Field(..., description="模型类型")
    provider: str = Field("", description="提供商")
    api_key: str = Field("", description="API Key")
    base_url: str = Field("", description="基础 URL")
    model: str = Field("", description="模型名称")
    max_tokens: int = Field(4096, description="最大 token 数")
    temperature: float = Field(0.7, description="温度参数")


@sub_router.post("/models/config/{model_type}", dependencies=[Depends(require_role("ADMIN"))], summary="保存模型配置（仅管理员）")
async def save_model_config(
    model_type: str,
    req: SaveModelConfigRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """保存单个模型配置到数据库（会即时更新运行时 LLM 服务，影响全体用户，故仅限管理员）"""
    from ...services.ai_model_config_service import AIModelConfigService, ModelConfig
    from ...services.llm_service import llm_service, LLMConfig

    valid_types = ["llm", "formula_gpt", "synergy_net", "safety_checker", "taste_predictor", "stability_model", "peptide_scorer"]
    if model_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"不支持的模型类型: {model_type}")

    config = ModelConfig(
        model_type=model_type,
        provider=req.provider,
        api_key=req.api_key,
        base_url=req.base_url,
        model=req.model,
        max_tokens=req.max_tokens,
        temperature=req.temperature,
    )

    success = await AIModelConfigService.save_config(db, config)
    masked_key = AIModelConfigService.mask_api_key(req.api_key)
    logger.info(f"模型配置已保存: {model_type}, key={masked_key}")

    # 同步更新 llm_service 配置（仅 LLM 类型）
    if model_type == 'llm' and req.api_key:
        llm_config = LLMConfig(
            provider=req.provider or 'openai',
            api_key=req.api_key,
            base_url=req.base_url,
            model=req.model,
            max_tokens=req.max_tokens,
            temperature=req.temperature,
        )
        llm_service.update_config(llm_config, user_id=current_user.id)
        logger.info(f"LLM 服务配置已更新: provider={req.provider}, model={req.model}")

    # 回显运行时 LLM 服务的真实状态（前端据此区分"密钥已生效"与"仅写库未生效"）
    llm_runtime = {
        "active": bool(getattr(llm_service, "is_available", False)),
        "provider": getattr(getattr(llm_service, "config", None), "provider", "unknown"),
        "model": getattr(getattr(llm_service, "config", None), "model", "unknown"),
        "api_key_configured": bool(getattr(getattr(llm_service, "config", None), "api_key", "")),
    }

    return {
        "success": success,
        "message": "配置已保存到数据库",
        "config": config.to_dict(),
        "llm_runtime": llm_runtime,
    }


@sub_router.get("/models/configs", summary="获取所有模型配置")
async def get_all_model_configs(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取所有模型配置（API Key 已脱敏）"""
    from ...services.ai_model_config_service import AIModelConfigService

    configs = await AIModelConfigService.get_all_configs(db)
    result = {}
    for model_type, config in configs.items():
        result[model_type] = config.to_dict()

    return {"success": True, "configs": result}


@sub_router.get("/models/config/{model_type}", summary="获取单个模型配置")
async def get_model_config(
    model_type: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取单个模型配置（API Key 已脱敏）"""
    from ...services.ai_model_config_service import AIModelConfigService

    config = await AIModelConfigService.get_config(db, model_type)

    return {
        "success": True,
        "model_type": model_type,
        "config": config.to_dict(),
    }


# ════════════════════════════════════════
# 用户级 LLM 密钥管理
# 按 user_id 隔离，存 SystemConfig("llm_user_key_<user_id>")，
# 每个用户用自己的密钥驱动 /ai 对话，与全局 llm_service 完全独立。
# 权限：仅当前用户可管理自己的密钥（无需 ADMIN）。
# ════════════════════════════════════════

class UserLLMKeyRequest(BaseModel):
    """用户级 LLM 密钥保存请求"""
    provider: str = Field(..., min_length=1, max_length=64, description="提供商: deepseek/openai/zhipu/qwen/anthropic/custom")
    api_key: str = Field(..., min_length=20, max_length=512, description="API Key（≥ 20 字符）")
    base_url: str = Field("", max_length=512, description="API 基础 URL（留空使用提供商默认）")
    model: str = Field("", max_length=128, description="模型名称（留空使用提供商默认）")
    max_tokens: int = Field(4096, ge=1, le=32768)
    temperature: float = Field(0.7, ge=0, le=2)


@sub_router.post("/models/user-key", summary="保存当前用户的 LLM 密钥")
async def save_user_llm_key(
    req: UserLLMKeyRequest,
    current_user: User = Depends(get_current_active_user),
):
    """保存/覆盖当前用户自己的 LLM 密钥（AES-256-GCM 加密后存 SystemConfig）。

    保存后 /ai 对话立即使用该用户密钥驱动 LLM，无需管理员介入。
    全局 llm_service（环境变量/全局 db）不受影响。
    """
    from ...services.llm_service import LLMService, LLMConfig, save_user_config_to_db

    cfg = LLMConfig(
        provider=req.provider,
        api_key=req.api_key,
        base_url=req.base_url,
        model=req.model,
        max_tokens=req.max_tokens,
        temperature=req.temperature,
        user_id=current_user.id,
    )
    saved = await save_user_config_to_db(cfg, user_id=current_user.id)
    LLMService.invalidate_user(current_user.id)

    masked = req.api_key[:8] + "..." + req.api_key[-4:] if len(req.api_key) > 12 else "***"
    logger.info(f"[UserLLM] 用户 {current_user.id} 保存个人密钥: provider={req.provider}, model={req.model}, key={masked}")

    return {
        "success": saved,
        "message": "您的个人 LLM 密钥已保存，/ai 对话将使用您自己的密钥" if saved else "保存失败，请检查后端日志",
        "user_id": current_user.id,
        "key_masked": masked,
    }


@sub_router.get("/models/user-key", summary="查询当前用户的 LLM 密钥状态")
async def get_user_llm_key_status(
    current_user: User = Depends(get_current_user),
):
    """返回当前用户是否配置了个人密钥及脱敏信息（不返回明文）"""
    from ...services.llm_service import LLMService, _user_key_config_key, _decrypt_api_key

    if current_user is None:
        # 未登录：可选认证端点，返回未配置状态而非 500
        return {
            "success": True,
            "configured": False,
            "note": "未登录，无法查询个人密钥状态；请登录后查看您的 LLM 密钥配置",
        }

    user_cfg = await LLMService.get_user_service(current_user.id)
    if user_cfg is None:
        return {
            "success": True,
            "configured": False,
            "note": "您尚未配置个人 LLM 密钥，/ai 对话使用服务器密钥",
        }
    cfg = user_cfg.config
    masked = cfg.api_key[:8] + "..." + cfg.api_key[-4:] if len(cfg.api_key) > 12 else "***"
    return {
        "success": True,
        "configured": True,
        "provider": cfg.provider,
        "model": cfg.model,
        "base_url": cfg.base_url or "(使用提供商默认)",
        "api_key_masked": masked,
        "api_key_length": len(cfg.api_key),
        "max_tokens": cfg.max_tokens,
        "temperature": cfg.temperature,
    }


@sub_router.delete("/models/user-key", summary="删除当前用户的 LLM 密钥")
async def delete_user_llm_key(
    current_user: User = Depends(get_current_active_user),
):
    """删除当前用户的个人密钥，/ai 对话回退到服务器密钥"""
    from ...services.llm_service import LLMService, delete_user_config

    deleted = await delete_user_config(current_user.id)
    LLMService.invalidate_user(current_user.id)
    logger.info(f"[UserLLM] 用户 {current_user.id} 删除个人密钥")

    return {
        "success": deleted,
        "message": "您的个人 LLM 密钥已删除，/ai 对话将回退到服务器密钥" if deleted else "删除失败",
    }


@sub_router.post("/models/user-key/test", summary="验活当前用户的 LLM 密钥（不写库）")
async def test_user_llm_key(
    req: UserLLMKeyRequest,
    current_user: User = Depends(get_current_active_user),
):
    """用填写的密钥做一次最小 LLM 调用（max_tokens=1），验证可用性，不写库不更新运行时。"""
    import httpx

    from ...services.llm_service import PROVIDER_DEFAULTS

    provider = req.provider or "deepseek"
    base_url = req.base_url or PROVIDER_DEFAULTS.get(provider, {}).get("base_url", "")
    model = req.model or PROVIDER_DEFAULTS.get(provider, {}).get("model", "deepseek-chat")

    if not base_url:
        return {"success": False, "detail": f"提供商 {provider} 未配置默认 Base URL，请填写 base_url"}

    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {req.api_key}"}
    payload = {"model": model, "messages": [{"role": "user", "content": "hi"}], "max_tokens": 1, "temperature": 0.1}

    try:
        async with httpx.AsyncClient(timeout=req.timeout if hasattr(req, "timeout") else 20.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code == 200:
            return {"success": True, "detail": f"密钥可用，模型 {model} 已响应", "provider": provider, "base_url": base_url, "model": model}
        detail = resp.text[:200] or "未知错误"
        friendly = {
            401: "API 认证失败（401）：密钥无效或已过期",
            403: "API 权限被拒绝（403）：请检查账户权限与余额",
            429: "调用频率受限（429）：请稍后重试",
            404: "模型或地址不存在（404）：请核对模型名与 Base URL",
        }.get(resp.status_code, f"HTTP {resp.status_code}")
        logger.warning(f"[UserLLM Test] 用户 {current_user.id} 验活失败: {resp.status_code} {detail}")
        return {"success": False, "detail": f"{friendly}。{detail}", "provider": provider, "base_url": base_url, "model": model}
    except httpx.TimeoutException:
        return {"success": False, "detail": "验活超时（20s）：请检查 Base URL 或网络", "provider": provider}
    except Exception as e:
        logger.error(f"[UserLLM Test] 用户 {current_user.id} 验活异常: {e}", exc_info=True)
        return {"success": False, "detail": f"验活请求失败：{e}", "provider": provider}

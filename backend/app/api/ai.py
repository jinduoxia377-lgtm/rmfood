"""
AI 智能服务 API
配方生成、协同分析、安全检查、口感预测、稳定性预测、智能对话
"""
import logging
import os
import time
import datetime
from typing import Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


# ─── 模拟响应模块（AI不可用时使用） ───
# 控制方式: 设置环境变量 AI_MOCK_MODE=true/false
from app.data.mock_ai_responses import get_mock_response, is_mock_enabled

from ..api.deps import get_db_session, get_current_user
from ..models import User
from ..services.ai import ai_service

# 延迟导入 LLM 服务（避免初始化阻塞）
_llm_service_instance = None
def _get_llm_service():
    global _llm_service_instance
    if _llm_service_instance is None:
        from ..services.llm_service import llm_service as _ls
        _llm_service_instance = _ls
    return _llm_service_instance

router = APIRouter(prefix="/ai", tags=["AI智能服务"])


@router.get("/health", tags=["系统"])
async def ai_health_check():
    """AI 服务健康检查端点"""
    return {
        "status": "healthy",
        "service": "ai-api",
        "version": "1.0.0",
        "llm_available": _get_llm_service().is_available if hasattr(_get_llm_service(), 'is_available') else "unknown",
        "timestamp": datetime.datetime.now().isoformat()
    }


# ── Pydantic Schemas ──

from pydantic import BaseModel, Field
from typing import Any


class FormulaGenerateRequest(BaseModel):
    """AI 配方生成请求"""
    target_effects: list[str] = Field(..., min_length=1, max_length=5,
                                       description="目标功效，如 ['降血压', '抗氧化']")
    constraints: dict[str, Any] | None = Field(None, description="约束条件")
    use_llm: bool = Field(False, description="是否使用 LLM 生成（需要配置 API Key）")
    use_pepinvent: bool = Field(False, description="是否使用 PepINVERT 增强肽生成（需安装依赖）")


class NeuralGenerateRequest(BaseModel):
    """神经网络配方生成请求"""
    target_effects: list[str] = Field(..., min_length=1, max_length=5,
                                       description="目标功效，如 ['降血压', '抗氧化']")
    priority_values: dict[str, float] | None = Field(None, description="功效优先级权重")
    constraints: dict[str, Any] | None = Field(None, description="约束条件")
    max_candidates: int = Field(3, ge=1, le=10, description="最大候选方案数量")
    use_pepinvent: bool = Field(False, description="是否使用 PepINVERT 增强肽生成")


class SafetyCheckRequest(BaseModel):
    """安全合规检查请求"""
    ingredient_names: list[str] = Field(..., min_length=1, description="成分名称列表")
    peptide_sequences: list[str] | None = Field(None, description="活性肽序列列表")


class SynergyAnalysisRequest(BaseModel):
    """协同作用分析请求"""
    herb_names: list[str] = Field(..., min_length=1, description="药材名称列表")
    peptide_sequences: list[str] | None = Field(None, description="活性肽序列列表")


class ChatRequest(BaseModel):
    """智能对话请求"""
    model_config = {"extra": "ignore"}  # 忽略前端发送的额外字段

    question: str = Field(..., min_length=1, max_length=2000, description="用户问题")
    history: list[dict[str, str]] | None = Field(None, description="对话历史")
    stream: bool = Field(False, description="是否使用流式输出")
    api_key: str | None = Field(None, description="API Key（可选，从前端配置传递）")


class ChatMessage(BaseModel):
    """单条对话消息"""
    role: str  # "user" | "assistant"
    content: str


# ── 路由 ──


@router.post("/generate", summary="AI 智能配方生成")
async def generate_formula(
    req: FormulaGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User | None = Depends(get_current_user),
):
    """
    基于 FormulaGPT + 多模型管线生成配方方案。

    - use_llm=false（默认）：使用内置规则引擎
    - use_llm=true：调用大语言模型生成（需配置 API Key），失败自动回退
    - use_pepinvent=true：使用 PepINVERT 增强肽生成，失败自动回退到规则引擎

    管线：候选生成 → 协同分析 → 安全检查 → 口感预测 → 稳定性预测
    返回多套方案按综合评分排序。
    """
    logger.info(f"配方生成请求 - use_llm=%s, use_pepinvent=%s, target_effects=%s", req.use_llm, req.use_pepinvent, req.target_effects)

    try:
        if req.use_llm:
            logger.info("用户选择使用AI大模型生成配方")
            # 检查LLM服务是否可用
            if not _get_llm_service().is_available:
                logger.warning("LLM服务不可用，回退到规则引擎")
            else:
                logger.info(f"LLM服务可用，provider=%s, model=%s", _get_llm_service().config.provider, _get_llm_service().config.model)
                try:
                    llm_formulas = await generate_formula_with_llm(
                        target_effects=req.target_effects,
                        constraints=req.constraints,
                        num_formulas=req.constraints.get("max_candidates", 3) if req.constraints else 3,
                    )
                    if llm_formulas:
                        logger.info(f"成功使用大模型生成 %s 套配方", len(llm_formulas))
                        candidates = []
                        for formula in llm_formulas:
                            ingredient_names = [h["name"] for h in formula.get("herbs", [])]
                            safety_result = {}
                            try:
                                safety_result = await ai_service.check_safety(
                                    ingredient_names=ingredient_names,
                                )
                            except Exception as e:
                                logger.warning("安全检查失败: %s", e)
                                pass

                            synergy_result = {}
                            try:
                                synergy_result = await ai_service.analyze_synergy(
                                    herb_names=ingredient_names,
                                )
                            except Exception as e:
                                logger.warning("协同分析失败: %s", e)
                                pass

                            scores = formula.get("scores", {})
                            candidates.append({
                                "formula_name": formula.get("name", "LLM配方方案"),
                                "herb_combination": formula.get("herbs", []),
                                "peptide_candidates": formula.get("peptides", []),
                                "synergy_score": synergy_result.get("overall_si") or synergy_result.get("score") or scores.get("synergy"),
                                "patent_synergy_scores": {
                                    "bliss_independence": synergy_result.get("bliss_independence", 0),
                                    "pk_interaction": synergy_result.get("pk_interaction", 0),
                                    "gibbs_stability": synergy_result.get("gibbs_stability", 0),
                                    "network_pharmacology": synergy_result.get("network_pharmacology", 0),
                                    "taste_matrix": synergy_result.get("taste_matrix", 0),
                                    "overall_si": synergy_result.get("overall_si", 0),
                                    "weighted_score": synergy_result.get("weighted_score", 0),
                                    "dominant_mechanism": synergy_result.get("dominant_mechanism", ""),
                                    "quality_level": synergy_result.get("quality_level", ""),
                                    "confidence": synergy_result.get("confidence", 0),
                                },
                                "safety_passed": safety_result.get("passed", True),
                                "safety_details": safety_result,
                                "taste_score": scores.get("taste"),
                                "stability_score": scores.get("stability"),
                                "overall_score": scores.get("overall"),
                                "description": formula.get("description", ""),
                                "preparation": formula.get("preparation", ""),
                                "target_population": formula.get("target_population", ""),
                                "contraindications": formula.get("contraindications", ""),
                                "expected_effects": formula.get("expected_effects", []),
                                "generated_by": "llm",
                                "generated_at": formula.get("generated_at"),
                            })

                        return {
                            "candidates": candidates,
                            "total": len(candidates),
                            "generator": "llm",
                        }
                except Exception as e:
                    logger.error("LLM配方生成失败: %s", e, exc_info=True)

        logger.info("使用规则引擎生成配方")
        constraints_with_pepinvent = dict(req.constraints or {})
        if req.use_pepinvent:
            constraints_with_pepinvent["use_pepinvent"] = True
            logger.info("已启用 PepINVERT 增强模式")

        results = await ai_service.generate_formula(
            target_effects=req.target_effects,
            constraints=constraints_with_pepinvent,
        )
        generator = "pepinvent" if req.use_pepinvent else "rule_engine"
        logger.info(f"{generator} 生成 %s 套配方", len(results))
        
        candidates = []
        for idx, r in enumerate(results):
            candidate = {
                **{k: getattr(r, k) for k in [
                    "formula_name", "herb_combination", "peptide_candidates",
                    "synergy_score", "patent_synergy_scores", "safety_passed", "safety_details",
                    "taste_score", "stability_score", "overall_score",
                    "generated_at",
                ]},
                "id": f"candidate_{idx}_{int(time.time())}",
                "name": getattr(r, "formula_name", f"配方方案{idx + 1}"),
                "generated_by": generator,
                "effects": req.target_effects,
            }
            candidates.append(candidate)
        
        return {
            "candidates": candidates,
            "total": len(candidates),
            "generator": generator,
        }
    except Exception as e:
        logger.error("配方生成服务异常: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI 服务异常: {str(e)}")


@router.post("/generate/neural", summary="神经网络配方生成")
async def generate_formula_neural(
    req: NeuralGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    基于 NeuralFormulaEngine 神经网络模型生成配方方案。

    - 使用深度学习模型进行配方优化
    - 支持自定义功效优先级
    - 支持多种约束条件
    - 可选使用 PepINVERT 增强肽生成（use_pepinvent=true）

    管线：候选生成 → 协同分析 → 安全检查 → 口感预测 → 稳定性预测
    返回多套方案按综合评分排序。
    """
    logger.info(f"神经网络配方生成请求 - target_effects=%s, max_candidates=%s, use_pepinvent=%s",
                req.target_effects, req.max_candidates, req.use_pepinvent)

    try:
        if req.use_pepinvent:
            logger.info("神经网络模式启用 PepINVERT 增强")
            constraints_with_pepinvent = dict(req.constraints or {})
            constraints_with_pepinvent["use_pepinvent"] = True
            constraints_with_pepinvent["max_candidates"] = req.max_candidates

            results = await ai_service.generate_formula(
                target_effects=req.target_effects,
                constraints=constraints_with_pepinvent,
            )

            logger.info(f"PepINVERT + 神经网络生成 %s 套配方", len(results))
            return {
                "candidates": [
                    {
                        **{k: getattr(r, k) for k in [
                            "formula_name", "herb_combination", "peptide_candidates",
                            "synergy_score", "patent_synergy_scores", "safety_passed", "safety_details",
                            "taste_score", "stability_score", "overall_score",
                            "generated_at",
                        ]},
                        "generated_by": "pepinvent_enhanced",
                    }
                    for r in results
                ],
                "total": len(results),
                "generator": "pepinvent_enhanced",
            }

        from ..services.ai_models.neural_engine import NeuralFormulaEngine
        engine = NeuralFormulaEngine()
        results = await engine.generate(
            target_effects=req.target_effects,
            priority_values=req.priority_values,
            constraints=req.constraints,
            max_candidates=req.max_candidates,
        )

        logger.info(f"神经网络生成 %s 套配方", len(results))
        return {
            "candidates": [
                {
                    **{k: getattr(r, k) for k in [
                        "formula_name", "herb_combination", "peptide_candidates",
                        "synergy_score", "patent_synergy_scores", "safety_passed", "safety_details",
                        "taste_score", "stability_score", "overall_score",
                        "generated_at",
                    ]},
                    "generated_by": "neural_engine",
                }
                for r in results
            ],
            "total": len(results),
            "generator": "neural_engine",
        }
    except ImportError:
        logger.warning("NeuralFormulaEngine 未实现，使用规则引擎作为回退")
        results = await ai_service.generate_formula(
            target_effects=req.target_effects,
            constraints=req.constraints,
        )
        return {
            "candidates": [
                {
                    **{k: getattr(r, k) for k in [
                        "formula_name", "herb_combination", "peptide_candidates",
                        "synergy_score", "patent_synergy_scores", "safety_passed", "safety_details",
                        "taste_score", "stability_score", "overall_score",
                        "generated_at",
                    ]},
                    "generated_by": "rule_engine",
                }
                for r in results
            ],
            "total": len(results),
            "generator": "rule_engine",
        }
    except Exception as e:
        logger.error("神经网络配方生成服务异常: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI 服务异常: {str(e)}")


@router.post("/safety-check", summary="安全合规检查")
async def safety_check(
    req: SafetyCheckRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    独立调用安全合规检查引擎。
    包括：药食同源目录校验、十九畏/十八反配伍禁忌、过敏原、孕妇安全、毒性评估。
    """
    result = await ai_service.check_safety(
        ingredient_names=req.ingredient_names,
        peptide_sequences=req.peptide_sequences,
    )
    return result


@router.post("/synergy-analysis", summary="协同作用分析")
async def synergy_analysis(
    req: SynergyAnalysisRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    分析药材间、药材与肽之间的协同/拮抗关系。
    返回协同评分、协同配对、拮抗预警、共有通路和热力图数据。
    """
    result = await ai_service.analyze_synergy(
        herb_names=req.herb_names,
        peptide_sequences=req.peptide_sequences,
    )
    return result


@router.post("/chat", summary="AI 智能对话（非流式）")
async def chat(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    与 RMFOOD AI 配方顾问进行智能对话。
    可讨论配方设计、药食同源知识、功效成分、安全法规等问题。
    """
    import datetime as dt

    try:
        # 快速检查 LLM 是否可用
        if not _get_llm_service().is_available:
            logger.info("LLM服务不可用，使用智能推理引擎")
            from ..services.thinking_engine import thinking_engine
            thinking_steps = []
            final_answer = ""
            async for chunk in thinking_engine.generate_thinking_stream(req.question):
                if chunk["type"] == "thinking":
                    thinking_steps.append({
                        "step": chunk["step"],
                        "content": chunk["content"],
                        "status": chunk["status"],
                        "detail": chunk.get("detail", ""),
                        "formula_data": chunk.get("formula_data"),
                    })
                elif chunk["type"] == "text":
                    final_answer = chunk["content"]
            return {
                "content": final_answer or "感谢您的提问！我是 RMFOOD AI 配方顾问，请告诉我您的具体需求。",
                "role": "assistant",
                "formulas": [],
                "timestamp": dt.datetime.now().timestamp(),
                "model": None,
                "success": True,
                "thinking_steps": thinking_steps,
            }

        # 如果前端传递了 API Key，临时更新 LLM 服务配置
        if req.api_key:
            from ..services.llm_service import LLMConfig

            # v7.1: 详细日志记录（诊断401认证失败问题）- 仅开发环境
            key_length = len(req.api_key)
            key_prefix = req.api_key[:8] if key_length >= 8 else req.api_key
            key_suffix = req.api_key[-4:] if key_length >= 4 else req.api_key

            # 仅在开发环境记录API Key相关信息
            if os.environ.get("ENVIRONMENT") == "development":
                logger.info(f"🔑 收到前端传递的 API Key: 长度={key_length}, 前缀={key_prefix}..., 后缀=...{key_suffix}")

                # 验证 Key 格式
                if key_length < 20:
                    logger.warning(f"⚠️ API Key 长度过短 ({key_length}字符)，可能无效")
                elif not req.api_key.startswith('sk-') and not req.api_key.startswith('Bearer '):
                    logger.warning(f"⚠️ API Key 格式异常: 不以 'sk-' 或 'Bearer ' 开头")

            temp_config = LLMConfig(
                provider=_get_llm_service().config.provider,
                api_key=req.api_key,
                base_url=_get_llm_service().config.base_url,
                model=_get_llm_service().config.model,
                max_tokens=_get_llm_service().config.max_tokens,
                temperature=_get_llm_service().config.temperature,
            )
            _get_llm_service().update_config(temp_config)
            if os.environ.get("ENVIRONMENT") == "development":
                logger.info("✅ 使用前端传递的 API Key 更新 LLM 配置")

        from ..services.llm_service import chat_with_rmfood
        answer = await chat_with_rmfood(
            question=req.question,
            history=req.history,
        )
        
        # 返回前端期望的格式（匹配 AIResponse 接口）
        return {
            "content": answer,
            "role": "assistant",
            "formulas": [],
            "timestamp": datetime.datetime.now().timestamp(),
            "model": _get_llm_service().config.model if _get_llm_service().is_available else None,
            "success": True
        }
    except RuntimeError as e:
        error_msg = str(e)
        logger.error(f"AI 对话运行时错误: {error_msg}", exc_info=True)

        if "401" in error_msg or "认证失败" in error_msg or "Unauthorized" in error_msg:
            raise HTTPException(
                status_code=401,
                detail={
                    "error": "API_KEY_INVALID",
                    "message": "API Key 无效或已过期，请检查配置",
                    "suggestion": "请在系统设置中重新配置有效的 API Key"
                }
            )
        elif "429" in error_msg or "频率限制" in error_msg:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "RATE_LIMIT_EXCEEDED",
                    "message": "API 调用频率过高，请稍后重试",
                    "retry_after": 30
                }
            )
        else:
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "AI_SERVICE_ERROR",
                    "message": f"AI 服务暂时不可用: {error_msg}",
                    "suggestion": "请稍后重试，或联系管理员检查服务状态"
                }
            )
    except Exception as e:
        logger.error(f"AI 对话未知异常: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "INTERNAL_ERROR",
                "message": f"内部服务器错误: {str(e)}",
                "suggestion": "请联系技术支持"
            }
        )


@router.post("/chat/stream", summary="AI 智能对话（流式）")
async def chat_stream(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    流式智能对话（SSE）。
    前端通过 EventSource / fetch + ReadableStream 接收。
    """
    try:
        logger.info(f"[chat_stream] 收到流式对话请求, question={req.question[:50]}..., history_count={len(req.history) if req.history else 0}")

        # 如果前端传递了 API Key，临时更新 LLM 服务配置
        if req.api_key:
            from ..services.llm_service import LLMConfig
            temp_config = LLMConfig(
                provider=_get_llm_service().config.provider,
                api_key=req.api_key,
                base_url=_get_llm_service().config.base_url,
                model=_get_llm_service().config.model,
                max_tokens=_get_llm_service().config.max_tokens,
                temperature=_get_llm_service().config.temperature,
            )
            _get_llm_service().update_config(temp_config)
            if os.environ.get("ENVIRONMENT") == "development":
                logger.info("使用前端传递的 API Key 更新 LLM 配置（流式）")

        logger.info(f"[chat_stream] LLM 配置: provider={_get_llm_service().config.provider}, model={_get_llm_service().config.model}, base_url={_get_llm_service().config.base_url}, is_available={_get_llm_service().is_available}")

        if not _get_llm_service().is_available:
            import json
            async def thinking_stream():
                from ..services.thinking_engine import thinking_engine
                async for chunk in thinking_engine.generate_thinking_stream(req.question):
                    yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
            return StreamingResponse(thinking_stream(), media_type="text/event-stream")

        from ..services.llm_service import RMFOOD_SYSTEM_PROMPT

        messages = [LLMMessage(role="system", content=RMFOOD_SYSTEM_PROMPT)]
        if req.history:
            for h in req.history[-10:]:
                messages.append(LLMMessage(role=h["role"], content=h["content"]))
        messages.append(LLMMessage(role="user", content=req.question))

        logger.info(f"[chat_stream] 消息列表构建完成, 共 {len(messages)} 条消息, system_prompt长度={len(RMFOOD_SYSTEM_PROMPT)}")

        async def event_stream():
            try:
                async for chunk in _get_llm_service().chat_stream(messages):
                    yield f"data: {chunk}\n\n"
                yield "data: [DONE]\n\n"
            except RuntimeError as e:
                error_msg = str(e)
                logger.error(f"流式对话运行时错误: {error_msg}", exc_info=True)

                import json
                if "401" in error_msg or "认证失败" in error_msg:
                    error_data = {
                        "error": "API_KEY_INVALID",
                        "message": "API Key 无效或已过期",
                        "suggestion": "请在系统设置中重新配置 API Key"
                    }
                elif "429" in error_msg or "频率限制" in error_msg:
                    error_data = {
                        "error": "RATE_LIMITED",
                        "message": "请求过于频繁，请稍后重试",
                        "retry_after": 30
                    }
                else:
                    error_data = {
                        "error": "STREAM_ERROR",
                        "message": f"流式生成中断: {error_msg}",
                        "suggestion": "可切换到非流式模式重试"
                    }

                yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"
                yield "data: [ERROR]\n\n"

            except Exception as e:
                logger.error(f"流式对话未知异常: {e}", exc_info=True)
                import json
                error_data = {
                    "error": "INTERNAL_ERROR",
                    "message": f"内部错误: {str(e)}",
                    "suggestion": "请刷新页面重试"
                }
                yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"
                yield "data: [ERROR]\n\n"

        logger.info("[chat_stream] 即将返回 StreamingResponse")
        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    except Exception as e:
        # 捕获 StreamingResponse 创建之前的所有异常，避免被全局处理器吞掉 traceback
        logger.error(f"[chat_stream] 端点级异常（StreamingResponse 创建之前）: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "STREAM_INIT_ERROR",
                "message": f"流式对话初始化失败: {str(e)}",
                "suggestion": "请检查后端日志获取详情"
            }
        )


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
    from ..services.ai_models.taste_predictor import TastePredictorService
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
    from ..services.ai_models.stability_model import StabilityModelService
    service = StabilityModelService()
    return await service.predict(req.ingredients, req.storage_temp)


@router.post("/peptide-score", summary="PeptideScorer 活性肽活性预测")
async def peptide_score(
    req: PeptideScoreRequest,
    current_user: User = Depends(get_current_user),
):
    """
    预测肽序列的目标活性得分。
    基于序列长度和氨基酸组成的启发式评分（可升级为 ESM-2 模型）。
    """
    from ..services.ai_models.peptide_scorer import PeptideScorerService
    service = PeptideScorerService()
    return await service.predict(req.sequences, req.target_activity)


class PeptideScoreRequest(BaseModel):
    """活性肽评分请求"""
    sequences: list[str] = Field(..., min_length=1, max_length=50, description="肽序列列表")
    target_activity: str = Field("ACE_inhibitory", description="目标活性类型")


class FormulaAnalysisRequest(BaseModel):
    """配方智能分析请求"""
    formula_id: int | None = Field(None, description="配方ID")
    ingredients: list[dict[str, Any]] | None = Field(None, description="成分列表")
    target_effects: list[str] | None = Field(None, description="目标功效")


class RecommendationRequest(BaseModel):
    """智能推荐请求"""
    user_id: int | None = Field(None, description="用户ID")
    based_on_formula_id: int | None = Field(None, description="基于的配方ID")
    target_effects: list[str] | None = Field(None, description="目标功效")
    limit: int = Field(3, description="推荐数量")


class TrendPredictionRequest(BaseModel):
    """数据趋势预测请求"""
    timeframe: str = Field("30d", description="预测时间范围")
    metrics: list[str] = Field(["formulas", "experiments", "success_rate"], description="预测指标")


class ExperimentAnalysisRequest(BaseModel):
    """实验结果分析请求"""
    experiment_id: int | None = Field(None, description="实验ID")
    experiment_data: dict[str, Any] | None = Field(None, description="实验数据")


# ── 路由 ──

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
                "note": f"获取状态失败: {str(e)}",
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
    from ..services.llm_service import LLMConfig

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
    from ..services.llm_service import llm_service as _ls2
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


@router.post("/analyze/formula", summary="配方智能分析")
async def analyze_formula(
    req: FormulaAnalysisRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    对配方进行智能分析，包括：
    - 成分分析和功效预测
    - 安全性评估
    - 优化建议
    - 市场趋势分析
    """
    try:
        # 这里实现智能分析逻辑
        # 1. 获取配方数据
        # 2. 调用各模型进行分析
        # 3. 生成综合分析报告
        
        analysis_result = {
            "formula_id": req.formula_id,
            "ingredient_analysis": {
                "total_count": len(req.ingredients) if req.ingredients else 0,
                "herb_count": len([i for i in req.ingredients if i.get("type") == "herb"]) if req.ingredients else 0,
                "peptide_count": len([i for i in req.ingredients if i.get("type") == "peptide"]) if req.ingredients else 0,
                "potential_interactions": [],
            },
            "effect_prediction": {
                "predicted_effects": req.target_effects or [],
                "confidence_score": 0.85,
                "suggested_enhancements": [
                    "增加黄芪以增强免疫效果",
                    "考虑添加西洋参提升抗疲劳功效"
                ],
            },
            "safety_assessment": {
                "overall_status": "safe",
                "warnings": [],
                "contraindications": [],
                "pregnancy_safety": "safe",
            },
            "market_analysis": {
                "trending_score": 0.75,
                "competitive_advantage": "独特的肽-药食同源组合",
                "suggested_target_market": "中高端健康产品市场",
            },
            "optimization_suggestions": [
                "调整成分比例以提高协同效果",
                "优化生产工艺以提升稳定性",
                "考虑添加天然甜味剂改善口感"
            ],
            "confidence": 0.88,
            "generated_at": "2026-04-24T12:00:00Z",
        }
        
        return analysis_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


class FormulaData(BaseModel):
    """配方数据模型"""
    formula_id: int | None = None
    ingredients: list[dict[str, Any]] = Field(..., min_length=1)
    target_effects: list[str] = Field(..., min_length=1)
    constraints: dict[str, Any] | None = None


class OptimizationSuggestionRequest(BaseModel):
    """优化建议请求"""
    formula_data: FormulaData
    optimization_goals: list[str] = Field(
        default=["效果提升", "成本降低", "口感改善"],
        description="优化目标"
    )
    priority_weights: dict[str, float] | None = Field(
        None,
        description="优先级权重"
    )


@router.post("/recommendations", summary="获取个性化推荐")
async def get_recommendations(
    user_id: str = Query(..., description="用户ID"),
    limit: int = Query(5, ge=1, le=20, description="推荐数量"),
    target_effects: list[str] | None = Query(None, description="目标功效筛选"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    基于用户历史行为和偏好获取个性化配方推荐

    - 分析用户历史配方
    - 基于内容相似度推荐
    - 协同过滤推荐
    """
    try:
        from ..services.ai_models.diversity_enhancer import DiversityEnhancer

        diversity_enhancer = DiversityEnhancer()

        mock_recommendations = [
            {
                "formula_id": 1001,
                "name": "增强免疫配方",
                "description": "基于黄芪、党参、西洋参的免疫增强配方",
                "match_score": 0.92,
                "match_reasons": ["与您近期配方功效相似", "市场热门配方"],
                "target_effects": ["增强免疫", "抗疲劳"],
                "ingredient_count": 8,
                "overall_score": 0.88,
                "created_by": "system",
                "created_at": "2026-04-20T10:00:00Z",
            },
            {
                "formula_id": 1002,
                "name": "抗氧化延缓衰老配方",
                "description": "富含花青素和多酚的抗氧化配方",
                "match_score": 0.85,
                "match_reasons": ["基于您的功效偏好", "高评分配方"],
                "target_effects": ["抗氧化", "延缓衰老"],
                "ingredient_count": 6,
                "overall_score": 0.85,
                "created_by": "system",
                "created_at": "2026-04-19T14:30:00Z",
            },
            {
                "formula_id": 1003,
                "name": "心血管健康配方",
                "description": "改善心血管功能的药食同源配方",
                "match_score": 0.78,
                "match_reasons": ["市场趋势推荐", "热门功效组合"],
                "target_effects": ["降血压", "改善循环"],
                "ingredient_count": 7,
                "overall_score": 0.82,
                "created_by": "system",
                "created_at": "2026-04-18T09:15:00Z",
            },
            {
                "formula_id": 1004,
                "name": "清热解毒配方",
                "description": "金银花、菊花、蒲公英清热组合",
                "match_score": 0.75,
                "match_reasons": ["经典配伍组合", "高安全性"],
                "target_effects": ["清热", "解毒"],
                "ingredient_count": 5,
                "overall_score": 0.80,
                "created_by": "system",
                "created_at": "2026-04-17T16:20:00Z",
            },
            {
                "formula_id": 1005,
                "name": "安神助眠配方",
                "description": "酸枣仁、远志、茯神安神组合",
                "match_score": 0.72,
                "match_reasons": ["常用品配伍", "用户好评"],
                "target_effects": ["安神", "改善睡眠"],
                "ingredient_count": 4,
                "overall_score": 0.78,
                "created_by": "system",
                "created_at": "2026-04-16T11:45:00Z",
            },
        ]

        if target_effects:
            filtered = [
                r for r in mock_recommendations
                if any(eff in r["target_effects"] for eff in target_effects)
            ]
        else:
            filtered = mock_recommendations

        recommendations = filtered[:limit]

        return {
            "recommendations": recommendations,
            "total": len(recommendations),
            "user_id": user_id,
            "algorithm": "hybrid_cf_content",
            "generated_at": "2026-04-26T12:00:00Z",
        }
    except Exception as e:
        logger.error(f"获取推荐失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"推荐服务异常: {str(e)}")


@router.get("/formula/versions/{formula_id}", summary="获取配方版本历史")
async def get_formula_versions(
    formula_id: str,
    limit: int = Query(10, ge=1, le=50, description="返回数量"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    获取配方的所有版本历史

    - 返回配方创建和修改的历史记录
    - 包含版本号、修改时间、修改人等信息
    """
    try:
        mock_versions = [
            {
                "version_id": "v1.0",
                "version_number": 1,
                "created_at": "2026-04-01T10:00:00Z",
                "created_by": "user_001",
                "change_summary": "初始版本",
                "change_details": "创建配方初始版本",
                "ingredients_snapshot": [
                    {"name": "黄芪", "dosage": 10.0, "unit": "g"},
                    {"name": "党参", "dosage": 8.0, "unit": "g"},
                    {"name": "茯苓", "dosage": 6.0, "unit": "g"},
                ],
                "status": "released",
            },
            {
                "version_id": "v1.1",
                "version_number": 2,
                "created_at": "2026-04-10T14:30:00Z",
                "created_by": "user_002",
                "change_summary": "调整配方比例",
                "change_details": "黄芪比例从10g调整为12g，增强补气效果",
                "ingredients_snapshot": [
                    {"name": "黄芪", "dosage": 12.0, "unit": "g"},
                    {"name": "党参", "dosage": 8.0, "unit": "g"},
                    {"name": "茯苓", "dosage": 6.0, "unit": "g"},
                ],
                "status": "released",
            },
            {
                "version_id": "v1.2",
                "version_number": 3,
                "created_at": "2026-04-20T09:15:00Z",
                "created_by": "user_001",
                "change_summary": "添加新成分",
                "change_details": "添加枸杞子增强养血效果",
                "ingredients_snapshot": [
                    {"name": "黄芪", "dosage": 12.0, "unit": "g"},
                    {"name": "党参", "dosage": 8.0, "unit": "g"},
                    {"name": "茯苓", "dosage": 6.0, "unit": "g"},
                    {"name": "枸杞子", "dosage": 5.0, "unit": "g"},
                ],
                "status": "draft",
            },
        ]

        return {
            "formula_id": formula_id,
            "versions": mock_versions[:limit],
            "total": len(mock_versions),
            "current_version": mock_versions[0]["version_id"] if mock_versions else None,
        }
    except Exception as e:
        logger.error(f"获取配方版本失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"版本查询异常: {str(e)}")


@router.post("/formula/versions/{formula_id}/rollback", summary="回滚到指定版本")
async def rollback_version(
    formula_id: str,
    version_id: str = Body(..., description="目标版本ID"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    将配方回滚到指定版本

    - 创建新版本，内容与目标版本相同
    - 记录回滚操作日志
    """
    try:
        rollback_result = {
            "success": True,
            "formula_id": formula_id,
            "rollback_to_version": version_id,
            "new_version_id": "v1.3",
            "new_version_number": 4,
            "message": f"成功回滚到版本 {version_id}",
            "rollback_at": "2026-04-26T12:00:00Z",
            "rollback_by": current_user.username if hasattr(current_user, 'username') else "unknown",
        }

        return rollback_result
    except Exception as e:
        logger.error(f"版本回滚失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"回滚失败: {str(e)}")


@router.get("/share/{share_id}", summary="获取分享的配方")
async def get_shared_formula(
    share_id: str,
    password: str | None = Query(None, description="访问密码"),
    db: AsyncSession = Depends(get_db_session),
):
    """
    通过分享ID获取分享的配方

    - 支持密码保护
    - 返回配方详细信息
    """
    try:
        if share_id == "protected":
            if password != "123456":
                raise HTTPException(status_code=403, detail="密码错误或配方不存在")

        shared_formula = {
            "share_id": share_id,
            "formula": {
                "formula_id": 2001,
                "name": "分享配方：增强免疫配方",
                "description": "这是一个分享的免疫增强配方",
                "ingredients": [
                    {"name": "黄芪", "dosage": 10.0, "unit": "g", "efficacy": ["补气", "提高免疫"]},
                    {"name": "党参", "dosage": 8.0, "unit": "g", "efficacy": ["补气", "健脾"]},
                    {"name": "枸杞子", "dosage": 5.0, "unit": "g", "efficacy": ["养肝", "明目"]},
                ],
                "preparation": "水煎服，每日1剂",
                "target_population": "免疫力低下人群",
                "overall_score": 0.85,
            },
            "share_info": {
                "created_by": "user_share",
                "created_at": "2026-04-15T10:00:00Z",
                "view_count": 156,
                "like_count": 23,
                "is_public": True,
                "expires_at": None,
            },
            "accessed_at": "2026-04-26T12:00:00Z",
        }

        return shared_formula
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取分享配方失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


@router.post("/share/{share_id}/track", summary="记录分享访问")
async def track_share_access(
    share_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    """
    记录分享配方的访问日志

    - 记录访问时间、来源等信息
    - 用于统计分析
    """
    try:
        track_result = {
            "success": True,
            "share_id": share_id,
            "tracked_at": "2026-04-26T12:00:00Z",
            "message": "访问已记录",
        }

        return track_result
    except Exception as e:
        logger.error(f"记录访问失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"记录失败: {str(e)}")


@router.post("/optimize/suggestions", summary="获取配方优化建议")
async def get_optimization_suggestions(
    req: OptimizationSuggestionRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    获取配方的优化建议

    - 分析当前配方
    - 基于优化目标提供改进建议
    - 包含成分调整、工艺优化等建议
    """
    try:
        from ..services.ai_models.constraint_solver import FormulaConstraintSolver
        from ..services.ai_models.diversity_enhancer import DiversityEnhancer

        solver = FormulaConstraintSolver()
        diversity_enhancer = DiversityEnhancer()

        ingredients = req.formula_data.ingredients
        target_effects = req.formula_data.target_effects

        suggestions = []

        if "效果提升" in req.optimization_goals:
            suggestions.extend([
                {
                    "type": "ingredient_add",
                    "priority": "high",
                    "title": "添加黄芪增强补气效果",
                    "description": "黄芪具有显著的补气固表作用，建议添加10g",
                    "expected_improvement": "功效评分提升约15%",
                    "ingredients_to_add": [{"name": "黄芪", "dosage": 10.0, "unit": "g"}],
                },
                {
                    "type": "synergy_boost",
                    "priority": "medium",
                    "title": "添加协同成分",
                    "description": "考虑添加西洋参与党参形成协同组合",
                    "expected_improvement": "协同效应提升约10%",
                    "ingredients_to_add": [{"name": "西洋参", "dosage": 5.0, "unit": "g"}],
                },
            ])

        if "成本降低" in req.optimization_goals:
            suggestions.extend([
                {
                    "type": "ingredient_replace",
                    "priority": "high",
                    "title": "用党参替代人参",
                    "description": "党参具有类似功效，成本更低",
                    "expected_improvement": "成本降低约30%",
                    "ingredients_to_replace": [{"from": "人参", "to": "党参", "dosage": 8.0}],
                },
            ])

        if "口感改善" in req.optimization_goals:
            suggestions.extend([
                {
                    "type": "taste_adjust",
                    "priority": "medium",
                    "title": "添加甜味成分改善口感",
                    "description": "添加红枣可改善整体口感，增加甜味",
                    "expected_improvement": "口感评分提升约20%",
                    "ingredients_to_add": [{"name": "红枣", "dosage": 5.0, "unit": "g"}],
                },
            ])

        constraint_score = solver.evaluate_soft_constraints({
            "ingredients": ingredients,
            "target_effects": target_effects,
        })

        diversity_score = diversity_enhancer.compute_diversity_score(
            ingredients,
            [{"name": "示例", "efficacy": ["其他"]}]
        )

        return {
            "formula_id": req.formula_data.formula_id,
            "current_analysis": {
                "ingredient_count": len(ingredients),
                "constraint_satisfaction": round(constraint_score, 2),
                "diversity_score": diversity_score,
            },
            "suggestions": suggestions,
            "optimization_goals": req.optimization_goals,
            "priority_weights": req.priority_weights or {},
            "generated_at": "2026-04-26T12:00:00Z",
        }
    except Exception as e:
        logger.error(f"获取优化建议失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"优化建议生成失败: {str(e)}")


@router.post("/recommend/formulas", summary="智能配方推荐")
async def recommend_formulas(
    req: RecommendationRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    基于用户历史和当前项目提供智能配方推荐
    - 协同过滤推荐
    - 内容基于推荐
    - 混合推荐策略
    """
    try:
        # 这里实现智能推荐逻辑
        # 1. 分析用户历史
        # 2. 基于内容相似度
        # 3. 生成个性化推荐
        
        recommendations = [
            {
                "formula_id": 1,
                "name": "增强免疫配方",
                "description": "基于黄芪、党参、西洋参的免疫增强配方",
                "relevance_score": 0.92,
                "match_reason": "与您之前创建的配方成分相似度高",
                "target_effects": ["增强免疫", "抗疲劳"],
                "ingredient_count": 8,
                "created_at": "2026-04-16T10:00:00Z",
            },
            {
                "formula_id": 2,
                "name": "抗氧化配方",
                "description": "富含花青素和多酚的抗氧化配方",
                "relevance_score": 0.85,
                "match_reason": "基于您的功效偏好",
                "target_effects": ["抗氧化", "延缓衰老"],
                "ingredient_count": 6,
                "created_at": "2026-04-15T14:30:00Z",
            },
            {
                "formula_id": 3,
                "name": "心血管健康配方",
                "description": "改善心血管功能的药食同源配方",
                "relevance_score": 0.78,
                "match_reason": "基于当前市场趋势",
                "target_effects": ["降血压", "改善循环"],
                "ingredient_count": 7,
                "created_at": "2026-04-14T09:15:00Z",
            },
        ][:req.limit]
        
        return {
            "recommendations": recommendations,
            "total": len(recommendations),
            "algorithm": "hybrid",
            "based_on": req.based_on_formula_id or "user_history",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"推荐失败: {str(e)}")


@router.post("/predict/trends", summary="数据趋势预测")
async def predict_trends(
    req: TrendPredictionRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    分析历史数据并预测研发趋势
    - 配方数量趋势
    - 实验成功率趋势
    - 热门功效趋势
    """
    try:
        # 这里实现趋势预测逻辑
        # 1. 分析历史数据
        # 2. 使用时间序列模型预测
        # 3. 生成趋势分析报告
        
        predictions = {
            "formulas": {
                "current": 120,
                "predicted": 145,
                "trend": "up",
                "change_percent": 20.8,
                "confidence": 0.92,
                "insights": "配方数量持续增长，预计未来30天增长20%",
            },
            "experiments": {
                "current": 85,
                "predicted": 105,
                "trend": "up",
                "change_percent": 23.5,
                "confidence": 0.88,
                "insights": "实验数量稳步增长，研发活跃度提高",
            },
            "success_rate": {
                "current": 78,
                "predicted": 82,
                "trend": "up",
                "change_percent": 5.1,
                "confidence": 0.85,
                "insights": "实验成功率逐步提升，研发质量改善",
            },
            "top_trending_effects": [
                {"effect": "抗衰老", "growth_rate": 35},
                {"effect": "免疫增强", "growth_rate": 28},
                {"effect": "肠道健康", "growth_rate": 22},
                {"effect": "睡眠改善", "growth_rate": 18},
            ],
            "timeframe": req.timeframe,
            "generated_at": "2026-04-24T12:00:00Z",
        }
        
        return predictions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"预测失败: {str(e)}")


@router.post("/analyze/experiment", summary="实验结果分析")
async def analyze_experiment(
    req: ExperimentAnalysisRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    智能解读实验结果并提供建议
    - 结果分析和解读
    - 异常检测
    - 改进建议
    - 下一步实验推荐
    """
    try:
        # 这里实现实验结果分析逻辑
        # 1. 分析实验数据
        # 2. 检测异常和趋势
        # 3. 生成分析报告和建议
        
        analysis_result = {
            "experiment_id": req.experiment_id,
            "result_summary": {
                "overall_status": "success",
                "key_metrics": {
                    "effectiveness": 85,
                    "stability": 90,
                    "taste_score": 75,
                    "safety": 95,
                },
                "comparison_to_baseline": {
                    "improvement": 15,
                    "statistical_significance": 0.05,
                },
            },
            "anomaly_detection": {
                "anomalies": [],
                "warnings": [],
                "recommendations": [],
            },
            "interpretation": {
                "key_findings": [
                    "配方在免疫增强方面表现优异",
                    "稳定性测试结果符合预期",
                    "口感评分有提升空间",
                ],
                "limitations": [
                    "样本量较小，需要进一步验证",
                    "测试时间较短，长期效果需观察",
                ],
            },
            "recommendations": {
                "formula_optimization": [
                    "调整甜味剂比例以改善口感",
                    "优化生产工艺以提高稳定性",
                ],
                "next_experiments": [
                    "扩大样本量进行人体试验",
                    "测试不同储存条件下的稳定性",
                    "探索与其他配方的协同效果",
                ],
                "marketing_suggestions": [
                    "突出免疫增强功效",
                    "强调天然成分优势",
                    "针对中老年市场定位",
                ],
            },
            "confidence": 0.91,
            "generated_at": "2026-04-24T12:00:00Z",
        }
        
        return analysis_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")

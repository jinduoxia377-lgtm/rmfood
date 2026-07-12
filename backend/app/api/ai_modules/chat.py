"""Chat module - /chat, /chat/stream"""
import logging
import datetime
import json
import os
import time

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from . import (
    logger,
    _get_llm_service,
    ai_service,
    router,
    get_db_session,
    get_current_user,
    User,
)
from ...services.llm_service import LLMMessage
from ...services.ai.response_cache import ai_cache
from ...services.ai.observability import ai_observability

sub_router = APIRouter(tags=["生成"])

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
        start_time = time.time()

        # 检查缓存
        cached = ai_cache.get(req.question)
        if cached:
            logger.info("缓存命中: %s", req.question[:50])
            ai_observability.track_call("llm", (time.time() - start_time) * 1000, error=False)
            return {
                "content": cached,
                "role": "assistant",
                "formulas": [],
                "timestamp": datetime.datetime.now().timestamp(),
                "model": _get_llm_service().config.model if _get_llm_service().is_available else None,
                "success": True,
                "cached": True,
            }
        if not _get_llm_service().is_available:
            logger.info("LLM服务不可用，使用智能推理引擎")
            from ...services.thinking_engine import thinking_engine
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
            from ...services.llm_service import LLMConfig

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

        from ...services.llm_service import chat_with_rmfood
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
            "success": True,
            "cached": False,
        }

        # 缓存响应
        ai_cache.set(req.question, answer)
        ai_observability.track_call("llm", (time.time() - start_time) * 1000, error=False)
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
                    "message": "AI 服务暂时不可用，请稍后重试",
                    "suggestion": "请稍后重试，或联系管理员检查服务状态"
                }
            )
    except Exception as e:
        logger.error("AI 对话未知异常: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "INTERNAL_ERROR",
                "message": "服务器内部错误，请稍后重试",
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
            from ...services.llm_service import LLMConfig
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
                from ...services.thinking_engine import thinking_engine
                async for chunk in thinking_engine.generate_thinking_stream(req.question):
                    yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
            return StreamingResponse(thinking_stream(), media_type="text/event-stream")

        from ...services.llm_service import RMFOOD_SYSTEM_PROMPT

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
                        "message": "流式生成中断，请稍后重试",
                        "suggestion": "可切换到非流式模式重试"
                    }

                yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"
                yield "data: [ERROR]\n\n"

            except Exception as e:
                logger.error("流式对话未知异常: %s", e, exc_info=True)
                import json
                error_data = {
                    "error": "INTERNAL_ERROR",
                    "message": "服务器内部错误，请稍后重试",
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
        logger.error("[chat_stream] 端点级异常（StreamingResponse 创建之前）: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "STREAM_INIT_ERROR",
                "message": "流式对话初始化失败，请稍后重试",
                "suggestion": "请检查后端日志获取详情"
            }
        )




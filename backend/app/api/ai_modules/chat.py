"""Chat module - /chat, /chat/stream"""
import logging
import datetime
import json
import os
import time

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
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
from ...core.resilience import get_ai_rate_limiter
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

        # 如果前端传递了 API Key，拒绝并记录安全事件
        if hasattr(req, 'api_key') and req.api_key:
            logger.warning("安全事件: 前端尝试传递 API Key，已被拒绝")
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "INVALID_REQUEST",
                    "message": "不支持从前端传递 API Key",
                    "suggestion": "请在系统设置中配置 API Key"
                }
            )

        from ...services.llm_service import chat_with_rmfood
        answer = await chat_with_rmfood(
            question=req.question,
            history=req.history,
        )
        
        # 构建返回结果（匹配前端 AIResponse 接口）
        result = {
            "content": answer,
            "role": "assistant",
            "formulas": [],
            "timestamp": datetime.datetime.now().timestamp(),
            "model": _get_llm_service().config.model if _get_llm_service().is_available else None,
            "success": True,
            "cached": False,
        }

        # 写入缓存 + 记录指标（在 return 之前）
        ai_cache.set(req.question, answer)
        ai_observability.track_call("llm", (time.time() - start_time) * 1000, error=False)
        return result
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
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    流式智能对话（SSE）。
    前端通过 EventSource / fetch + ReadableStream 接收。
    """
    try:
        logger.info(f"[chat_stream] 收到流式对话请求, question={req.question[:50]}..., history_count={len(req.history) if req.history else 0}")

        # ── Step 1: Rate Limit 检查 ──
        limiter = get_ai_rate_limiter()
        allowed, error_msg = await limiter.check_request(current_user.id)
        if not allowed:
            logger.warning(f"[chat_stream] 用户 {current_user.id} 触发限流: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "RATE_LIMIT_EXCEEDED",
                    "message": error_msg,
                    "retry_after": 60,
                },
                headers={"Retry-After": "60"},
            )

        # ── Step 2: SSE 连接数检查 ──
        import uuid
        conn_id = int(uuid.uuid4().hex[:8], 16)
        connected = await limiter.register_sse_connection(current_user.id)
        if not connected:
            await limiter.unregister_sse_connection(current_user.id, conn_id)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "TOO_MANY_SSE_CONNECTIONS",
                    "message": f"每个用户最多同时打开 {_get_llm_service().config.model if False else 5} 个流式连接",
                    "retry_after": 30,
                },
            )

        # 如果前端传递了 API Key，拒绝并记录安全事件
        if hasattr(req, 'api_key') and req.api_key:
            logger.warning("安全事件: 前端尝试传递 API Key（流式），已被拒绝")
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "INVALID_REQUEST",
                    "message": "不支持从前端传递 API Key",
                    "suggestion": "请在系统设置中配置 API Key"
                }
            )

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
        # 在响应发送完成后，后台清理 SSE 连接计数
        background_tasks.add_task(limiter.unregister_sse_connection, current_user.id, conn_id)
        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    except HTTPException:
        raise  # HTTP 异常已由具体 handler 处理，直接重抛
    except Exception as e:
        # 捕获 StreamingResponse 创建之前的所有异常
        logger.error("[chat_stream] 端点级异常（StreamingResponse 创建之前）: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "STREAM_INIT_ERROR",
                "message": "流式对话初始化失败，请稍后重试",
                "suggestion": "请检查后端日志获取详情"
            }
        )




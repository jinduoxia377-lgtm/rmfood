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
from ...core.performance.resilience import get_ai_rate_limiter
from ...core.multi_tenant.tenant_security import TenantContext, require_tenant
from ...services.llm_service import LLMMessage, LLMService


async def _get_user_llm(user_id: int):
    """获取用户级 LLMService（按 user_id 缓存）；该用户未配置自己的密钥则返回 None。

    优先级：用户级密钥（SystemConfig llm_user_key_<user_id>）> 全局 llm_service。
    调用方拿到非 None 实例时用它的密钥发起对话；拿到 None 时回退到全局实例。
    """
    return await LLMService.get_user_service(user_id)
from ...services.ai.prompt_service import get_prompt_service
from ...services.ai.shared.response_cache import ai_cache
from ...services.ai.shared.observability import ai_observability


@router.get("/debug/prompt", summary="Debug: check current prompt")
async def debug_prompt(
    current_user: User = Depends(get_current_user),
):
    from ...services.ai.prompt_service import get_prompt_service
    svc = get_prompt_service()
    p = svc.get_scenario_prompt("formula_design")
    return {
        "prompt_length": len(p),
        "has_blocks_keyword": "blocks" in p,
        "has_json_codeblock": "```json" in p,
        "first_300": p[:300],
        "last_200": p[-200:],
        "config_path": str(svc.config_path),
        "config_hash": svc._config_hash,
        "prompt_count": len(svc._config.system_prompts),
        "academician_len": len(svc._config.system_prompts.get("academician", "")),
    }


@router.get("/debug/llm-test", summary="Debug: test LLM directly")
async def debug_llm_test(
    current_user: User = Depends(get_current_user),
):
    from ...services.ai.prompt_service import get_prompt_service
    from ...services.llm_service import llm_service, LLMMessage
    import json as _json
    
    prompt = get_prompt_service().get_scenario_prompt("formula_design")
    messages = [
        LLMMessage(role="system", content=prompt),
        LLMMessage(role="user", content="帮我设计一款针对高血糖人群的饮品配方"),
    ]
    
    # Call LLM non-streaming
    result = await llm_service.chat(messages)
    content = result.content
    
    return {
        "prompt_length": len(prompt),
        "response_length": len(content),
        "has_blocks": "blocks" in content,
        "has_json_codeblock": "```json" in content,
        "first_500": content[:500],
        "model": result.model,
    }

sub_router = APIRouter(tags=["生成"])


def _format_sse_event(event_type: str, data: dict) -> str:
    """将数据格式化为 SSE event 行"""
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


class ChatRequest(BaseModel):
    """智能对话请求"""
    model_config = {"extra": "ignore"}  # 忽略前端发送的额外字段

    question: str = Field(..., min_length=1, max_length=2000, description="用户问题")
    history: list[dict[str, str]] | None = Field(None, description="对话历史")
    stream: bool = Field(False, description="是否使用流式输出")
    scenario_mode: str = Field("formula_design", description="场景模式")
    user_profile_context: str | None = Field(
        None,
        max_length=2000,
        description="用户画像摘要（健康目标/过敏原/饮食禁忌/体质）",
    )


class ChatMessage(BaseModel):
    """单条对话消息"""
    role: str  # "user" | "assistant"
    content: str


# 用户画像中需要触发「指令覆盖」过滤的句式
_PROFILE_INJECTION_PATTERNS = [
    # 指令覆盖类：允许中间插入任意修饰词（如「上述」「所有」「之前」）
    r"(忽略|无视|忘记|跳过|抛弃)[^。；\n]{0,12}?(指令|规则|提示|设定|要求|限制)",
    r"(你|你现在)\s*(是|变成|扮演)\s*[^。；\n]{1,20}(?=[。；\n]|$)",
    r"(system|assistant|developer)\s*[:：]",
    r"</?\s*(system|instruction|prompt)\s*>",
]


def _sanitize_profile(raw: str | None) -> str:
    """
    净化用户画像文本，防止 Prompt 注入。

    画像来自前端 localStorage，属不可信输入。这里做最小必要的清洗：
      1. 移除控制字符
      2. 替换明显的指令覆盖句式
      3. 折叠换行，限制长度
    """
    if not raw:
        return ""

    import re as _re

    text = str(raw)
    # 1. 移除控制字符（保留常规空白）
    text = _re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    # 2. 替换注入句式
    for pattern in _PROFILE_INJECTION_PATTERNS:
        text = _re.sub(pattern, "[已过滤]", text, flags=_re.IGNORECASE)
    # 3. 折叠换行与多余空白
    text = _re.sub(r"\s*\n\s*", "；", text)
    text = _re.sub(r"[ \t]{2,}", " ", text).strip()
    # 4. 兜底限长
    return text[:2000]


def _build_system_prompt(scenario_mode: str, profile_raw: str | None) -> str:
    """
    构建 System Prompt，并将用户画像作为「用户约束」注入。

    安全设计：
      - 画像注入 System 层而非 User 层，获得更高指令优先级
      - 明确要求遵守过敏/禁忌，无法满足时必须说明而非忽略
    """
    base_prompt = get_prompt_service().get_scenario_prompt(
        scenario_mode or "formula_design"
    )

    profile = _sanitize_profile(profile_raw)
    if not profile:
        return base_prompt

    return (
        f"{base_prompt}\n\n"
        "【用户约束 — 必须严格遵守】\n"
        f"{profile}\n\n"
        "执行要求：\n"
        "1. 配方中严禁出现用户已声明的过敏原或饮食禁忌原料；\n"
        "2. 若在满足约束的前提下无法达到预期功效，必须明确说明冲突，"
        "不得静默忽略约束；\n"
        "3. 药材用量必须符合药食同源目录的每日用量上限；\n"
        "4. 特殊人群（孕妇、儿童、慢性病患者）需给出针对性提示。"
    )


@router.post("/chat", summary="AI 智能对话（非流式）")
async def chat(
    req: ChatRequest,
    tenant: TenantContext = Depends(require_tenant),
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

        # 解析该用户实际可用的 LLM 服务：优先用户级密钥（SystemConfig llm_user_key_<user_id>），
        # 未配置则回退到全局 llm_service。缓存键加入用户维度，避免跨用户命中他人答案。
        user_llm = await _get_user_llm(current_user.id)
        llm = user_llm if user_llm is not None else _get_llm_service()
        key_source = "user" if user_llm is not None else (
            "db" if llm.config.key_from_db else ("env" if llm.config.api_key else "none")
        )

        # 检查缓存（租户级 key 防止跨租户缓存泄漏；用户级密钥时缓存按用户隔离）
        # 缓存键加入 history 哈希，避免不同上下文中相同问题返回相同答案
        history_hash = hash(tuple(str(h) for h in (req.history or [])[-3:])) if req.history else 0
        cache_key = (
            f"user:{current_user.id}:q:{hash(req.question)}:ctx:{history_hash}"
            if user_llm is not None
            else f"org:{tenant.org_id}:q:{hash(req.question)}:ctx:{history_hash}"
        )
        cached = ai_cache.get(cache_key)
        if cached:
            logger.info("缓存命中: %s", cache_key[:50])
            ai_observability.track_call("llm", (time.time() - start_time) * 1000, error=False)
            return {
                "content": cached,
                "role": "assistant",
                "formulas": [],
                "timestamp": datetime.datetime.now().timestamp(),
                "model": llm.config.model if llm.is_available else None,
                "success": True,
                "cached": True,
                "key_source": key_source,
            }
        if not llm.is_available:
            logger.info("LLM服务不可用（用户 %s 无用户级密钥且全局未配置），使用智能推理引擎", current_user.id)
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
                "key_source": "none",
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

        scenario_mode = getattr(req, "scenario_mode", "formula_design") or "formula_design"
        system_prompt = _build_system_prompt(
            scenario_mode, getattr(req, "user_profile_context", None)
        )

        messages = [LLMMessage(role="system", content=system_prompt)]
        if req.history:
            for h in req.history[-10:]:
                messages.append(LLMMessage(role=h["role"], content=h["content"]))
        messages.append(LLMMessage(role="user", content=req.question))

        # Use LLM streaming to collect the full response（使用按用户解析出的服务实例）
        answer = ""
        async for chunk in llm.chat_stream(messages):
            if chunk:
                answer += chunk

        # 回写对话记录到数据库
        try:
            from ...models.chat import ChatSession, ChatMessage
            session_result = await db.execute(
                select(ChatSession).where(
                    ChatSession.user_id == current_user.id,
                    ChatSession.is_active == True,
                ).order_by(ChatSession.updated_at.desc()).limit(1)
            )
            chat_session = session_result.scalar_one_or_none()
            if not chat_session:
                chat_session = ChatSession(
                    user_id=current_user.id,
                    title=req.question[:50] + ('...' if len(req.question) > 50 else ''),
                    message_count=0,
                    is_active=True,
                )
                db.add(chat_session)
                await db.commit()
                await db.refresh(chat_session)

            await db.add(ChatMessage(
                session_id=chat_session.id,
                role="user",
                content=req.question,
            ))
            await db.add(ChatMessage(
                session_id=chat_session.id,
                role="assistant",
                content=answer,
            ))
            chat_session.message_count += 2
            chat_session.updated_at = datetime.datetime.now(datetime.timezone.utc)
            await db.commit()
        except Exception as db_err:
            logger.warning(f"对话记录回写失败（非致命）: {db_err}")

        # 构建返回结果（匹配前端 AIResponse 接口）
        result = {
            "content": answer,
            "role": "assistant",
            "formulas": [],
            "timestamp": datetime.datetime.now().timestamp(),
            "model": llm.config.model if llm.is_available else None,
            "success": True,
            "cached": False,
            "key_source": key_source,
        }

        # 写入缓存 + 记录指标（在 return 之前）
        ai_cache.set(cache_key, answer)
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
        # 即使未知异常也回显 key_source，前端可据此区分"用户密钥导致"还是"服务器配置问题"
        try:
            _ks = "user" if user_llm is not None else (
                "db" if llm.config.key_from_db else ("env" if llm.config.api_key else "none")
            )
        except Exception:
            _ks = "unknown"
        raise HTTPException(
            status_code=500,
            detail={
                "error": "INTERNAL_ERROR",
                "message": "服务器内部错误，请稍后重试",
                "suggestion": "请联系技术支持",
                "key_source": _ks,
            }
        )




@router.post("/chat/stream", summary="AI 智能对话（流式）")
async def chat_stream(
    req: ChatRequest,
    background_tasks: BackgroundTasks,
    tenant: TenantContext = Depends(require_tenant),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    流式智能对话（SSE）。
    前端通过 EventSource / fetch + ReadableStream 接收。
    """
    try:
        logger.info(f"[chat_stream] 收到流式对话请求, question={req.question[:50]}..., history_count={len(req.history) if req.history else 0}")

        # ── Step 1: Rate Limit 检查（租户级） ──
        limiter = get_ai_rate_limiter()
        allowed, error_msg = await limiter.check_request(tenant.org_id)
        if not allowed:
            logger.warning(f"[chat_stream] 组织 {tenant.org_id} 触发限流: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "RATE_LIMIT_EXCEEDED",
                    "message": error_msg,
                    "retry_after": 60,
                },
                headers={"Retry-After": "60"},
            )

        # ── Step 2: SSE 连接数检查（租户级） ──
        import uuid
        conn_id = int(uuid.uuid4().hex[:8], 16)
        connected = await limiter.register_sse_connection(tenant.org_id)
        if not connected:
            await limiter.unregister_sse_connection(tenant.org_id, conn_id)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "TOO_MANY_SSE_CONNECTIONS",
                    "message": "每个组织最多同时打开 5 个流式连接",
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

        # 解析用户级 LLM 服务（用户密钥 > 全局密钥）
        user_llm = await _get_user_llm(current_user.id)
        llm = user_llm if user_llm is not None else _get_llm_service()
        key_source = "user" if user_llm is not None else (
            "db" if llm.config.key_from_db else ("env" if llm.config.api_key else "none")
        )
        if user_llm is not None:
            logger.info(f"[chat_stream] 用户 {current_user.id} 使用自己的 LLM 密钥: provider={user_llm.config.provider}, model={user_llm.config.model}")
        else:
            logger.info(f"[chat_stream] 用户 {current_user.id} 未配置个人密钥，使用全局 LLM: provider={llm.config.provider}, model={llm.config.model}, key_source={key_source}")

        if not llm.is_available and user_llm is None:
            import json
            async def thinking_stream():
                from ...services.thinking_engine import thinking_engine
                async for chunk in thinking_engine.generate_thinking_stream(req.question):
                    yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
            return StreamingResponse(thinking_stream(), media_type="text/event-stream")

        scenario_mode = getattr(req, "scenario_mode", "formula_design") or "formula_design"
        system_prompt = _build_system_prompt(
            scenario_mode, getattr(req, "user_profile_context", None)
        )

        messages = [LLMMessage(role="system", content=system_prompt)]
        if req.history:
            for h in req.history[-10:]:
                messages.append(LLMMessage(role=h["role"], content=h["content"]))
        messages.append(LLMMessage(role="user", content=req.question))

        logger.info(f"[chat_stream] 消息列表构建完成, 共 {len(messages)} 条消息, system_prompt长度={len(system_prompt)}")


        async def event_stream():
            try:
                async for chunk in llm.chat_stream(messages):
                    if chunk:
                        yield _format_sse_event("content", {"content": chunk})
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

                yield _format_sse_event("error", error_data)
                yield _format_sse_event("done", {})

            except Exception as e:
                logger.error("流式对话未知异常: %s", e, exc_info=True)
                import json
                error_data = {
                    "error": "INTERNAL_ERROR",
                    "message": "服务器内部错误，请稍后重试",
                    "suggestion": "请刷新页面重试"
                }
                yield _format_sse_event("error", error_data)
                yield _format_sse_event("done", {})

        logger.info("[chat_stream] 即将返回 StreamingResponse")
        # 在响应发送完成后，后台清理 SSE 连接计数（租户级）
        background_tasks.add_task(limiter.unregister_sse_connection, tenant.org_id, conn_id)
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







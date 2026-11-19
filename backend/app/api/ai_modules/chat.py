# ruff: noqa: E402  -- 延迟/条件导入（debug 端点守卫、懒加载）属模块组织约定
"""Chat module - /chat, /chat/stream"""
import asyncio
import datetime
import hashlib
import json
import re


# ── Debug 端点仅在生产环境禁用时注册（双重防护：代码守卫 + .env DEBUG=false）──
def _is_debug_mode() -> bool:
    """判断当前是否处于可暴露调试端点的模式。
    与 main.py 中 settings.debug and not settings.is_production 保持一致。
    """
    try:
        from ..core.config import settings as _settings
        return getattr(_settings, 'debug', False) and not getattr(_settings, 'is_production', True)
    except Exception:
        return False
import time
from typing import Any

from fastapi import (  # A-27: status 原漏导入
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    status,
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select  # A-27: select 在 287 行被用到但原先未导入
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.multi_tenant.tenant_security import TenantContext, require_tenant
from ...core.performance.resilience import get_ai_rate_limiter
from ...services.llm_service import LLMMessage, LLMService
from . import (
    User,
    _get_llm_service,
    get_current_user,
    get_db_session,
    logger,
    router,
)


async def _get_user_llm(user_id: int):
    """获取用户级 LLMService（按 user_id 缓存）；该用户未配置自己的密钥则返回 None。

    优先级：用户级密钥（SystemConfig llm_user_key_<user_id>）> 全局 llm_service。
    调用方拿到非 None 实例时用它的密钥发起对话；拿到 None 时回退到全局实例。
    """
    return await LLMService.get_user_service(user_id)
from ...services.ai.prompt_service import get_prompt_service
from ...services.ai.safety.output_filter import get_output_checker
from ...services.ai.shared.observability import ai_observability
from ...services.ai.shared.response_cache import ai_cache
from ...services.ai.structured_json_repair import (
    ensure_valid_json_or_markdown,
    repair_truncated_json,
)


def _repair_truncated_json(content: str) -> str:
    """修复被截断的配方卡 JSON（以 ```json 开头但未闭合/括号不平衡）。

    场景：LLM 流式输出提前停止，内容以 ```json 开头但缺少闭合 ```，
    且 JSON 因中途截断而括号不平衡。
    委托给 app.services.ai.structured_json_repair.repair_truncated_json：
    按「闭合未闭合字符串 → 未闭合 key 补 : null → 去尾逗号 → 逆序闭合括号」
    顺序修复；无法安全修复时原样返回，交由调用方降级（绝不持久化残缺 JSON）。
    """
    return repair_truncated_json(content)


if _is_debug_mode():

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
        from ...services.llm_service import LLMMessage, llm_service

        prompt = get_prompt_service().get_scenario_prompt("formula_design")
        messages = [
            LLMMessage(role="system", content=prompt),
            LLMMessage(role="user", content="帮我设计一款针对高血糖人群的饮品配方"),
        ]

        # A-49：LLM 未配置时 llm_service 抛 RuntimeError，被全局兜底转成 500。
        # 但"服务没配钥匙"是外部依赖不可用，不是服务端故障 —— 语义上应该是 503，
        # 而且前端拿到 500 会误判成代码 bug。这里显式转成 503 并把原因带回给调用方。
        try:
            result = await llm_service.chat(messages)
        except RuntimeError as e:
            raise HTTPException(status_code=503, detail=f"LLM 服务未就绪：{e}")
        content = result.content

        return {
            "prompt_length": len(prompt),
            "response_length": len(content),
            "has_blocks": "blocks" in content,
            "has_json_codeblock": "```json" in content,
            "first_500": content[:500],
            "model": result.model,
        }

# ═══════════════════════════════════════════════════════════════
# 架构说明：主路径 vs AcademicianChatEngine
# ═══════════════════════════════════════════════════════════════
#
# chat.py 当前是**主对话路径**，直接调用 LLMService，内联实现：
#   - RAG 知识库注入（_build_system_prompt）
#   - 用户画像约束注入
#   - Bot 上下文（人设+记忆+模型覆盖）
#   - 多级降级（LLM不可用 → thinking_engine 规则引擎）
#   - SSE 流式事件（meta / dialectics / content / step）
#
# chat_engine.py (AcademicianChatEngine) 是**备用编排引擎**，提供：
#   - 三级 max_tokens 降级（16000 → 8000 → 4000）
#   - 质量检查 + 自动扩展（min_response_length 校验）
#   - 贝叶斯配方优化（bayesian_formula_optimizer）
#   - 内容完整性补全（_complete_content，确保章节覆盖）
#
# 两者并存原因：主路径已覆盖绝大多数场景，引擎的高级功能
# （贝叶斯优化、三级降级）在当前配置下未触发实际差异。若未来
# 需要增强质量保障，可通过切换 config 接入引擎（需合并
# _build_system_prompt 的 RAG/Bot/画像逻辑到引擎中）。
#
# 参考：backend/app/services/ai/orchestration/chat_engine.py
# ═══════════════════════════════════════════════════════════════

sub_router = APIRouter(tags=["生成"])


def _format_sse_event(event_type: str, data: dict) -> str:
    """将数据格式化为 SSE event 行"""
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# ═══ P2 修复（2026-11-08）：上游 LLM 限流 ≠ 本平台对客户端限流 ═══
# 背景（reports/chat-history/chat-module-audit.md P2「非流式 /chat 超时误标 429」）：
# 上游模型客户端（llm_provider.py / llm_service.py）在命中 OpenAI/Anthropic/DeepSeek 的
# 429 时抛 RuntimeError（含「频率限制」「API 调用频率过高」等字样）。此前异常处理器
# 把这类 RuntimeError 一律映射成对**客户端**的 429，混淆了两种完全不同的限流：
#   - 本平台对客户端限流：在端点入口 get_ai_rate_limiter() 已正确以 429 拦截（不会走到这里）；
#   - 上游模型服务限流：属外部依赖过载，应映射为 5xx 上游错误，而非客户端超额。
# 因此：凡以 RuntimeError 形式抵达异常处理器的限流，必然来自上游，统一判为上游限流。
_UPSTREAM_RATE_LIMIT_MARKERS = (
    "频率限制", "频率过高", "限流", "rate limit", "ratelimit",
    "too many requests", "请求过于频繁", "调用频率",
)
# 缺陷3 收口：裸子串 "429" 理论上会被 "latency=1429ms" 之类误命中，改用词边界 \b429\b。
_UPSTREAM_429_RE = re.compile(r"\b429\b")


def _is_upstream_rate_limit(error_msg: str) -> bool:
    """判断 RuntimeError 是否为**上游模型服务**限流（而非本平台对客户端限流）。

    平台自身限流走 HTTPException(429) 在端点入口拦截，不会以 RuntimeError 抵达此处；
    故此处命中间流关键词即判定为上游限流，应映射 5xx 上游错误。
    """
    if not error_msg:
        return False
    if _UPSTREAM_429_RE.search(error_msg):
        return True
    lowered = error_msg.lower()
    return any(marker.lower() in lowered for marker in _UPSTREAM_RATE_LIMIT_MARKERS)


def _sanitize_stream_chunk(chunk: str) -> str:
    """流式逐 chunk 轻量脱敏：复用 OutputSafetyChecker 的敏感模式（API Key/PII/邮箱等），
    在 chunk 展示给用户之前将命中内容替换为 [REDACTED]。

    说明：敏感串若被 LLM 拆分到多个 chunk（如手机号/API Key 跨 chunk 边界），
    此处可能漏检；流式结束后的整段 check_output 会再次检查，并对高风险
    finding（api_key/pii）回填脱敏全文兜底。
    """
    if not chunk:
        return chunk
    try:
        return get_output_checker().check(chunk).sanitized_text or chunk
    except Exception:
        # 脱敏失败静默降级：不阻断流式输出
        return chunk


# ── LLM 超时配置（秒）──
# 唯一事实来源是下方「常量」，历史注释数值仅作演变记录，与常量冲突时以常量为准。
#
# 首包超时：连接建立后等待「首个内容分片」的最长时间，用于快速识别上游挂起。
LLM_STREAM_FIRST_TOKEN_TIMEOUT = 60
# 主生成总超时：首轮流式响应（不含续写轮次）的总时长上限（含首包等待）。
# 演变：170s → 200s（2026-10-28）→ 120s（2026-10-29，用户等待过长恢复快速失败）。
LLM_STREAM_TOTAL_TIMEOUT = 120
LLM_NON_STREAM_TIMEOUT = 120
# 流式空闲超时：读流过程中超过该时长无任何内容分片，视为上游挂起（半死连接），快速失败
LLM_STREAM_IDLE_TIMEOUT = 30
#
# ── 续写（continuation）预算：max_tokens 截断自动续写场景 ──
# 前端整体超时 STREAM_TIMEOUT_MS = 180s（frontend/src/constants/businessRules.ts:22，
# 由 chatService.ts:317 施加于 /ai 流式请求）。
# 硬不变式：后端「首轮 + 全部续写轮次」总预算必须 < 前端 180s，保留裕量。
# 首轮已由 LLM_STREAM_TOTAL_TIMEOUT=120s 封顶，续写只能占用剩余预算。
LLM_STREAM_OVERALL_BUDGET = 165  # 首轮 + 续写的总预算上限（165 < 前端 180s，含 15s 裕量）
LLM_CONTINUATION_MAX_ROUNDS = 2  # 最多续写轮次（防无限循环 / 成本失控）
LLM_CONTINUATION_ROUND_TIMEOUT = 60  # 单轮续写上限（且受 LLM_STREAM_OVERALL_BUDGET 剩余约束）

# 续写时追加给模型的用户指令：明确「从中断处接着写、不要重复、直到 JSON 闭合」。
_CONTINUATION_INSTRUCTION = (
    "继续输出剩余内容，从中断处接着写，不要重复已输出内容，"
    "直接续写直到 JSON 完整闭合。"
)


def _is_formula_card_answer(text: str) -> bool:
    """判断已生成内容是否为「配方卡」场景（```json 开头 或 含 blocks 结构）。

    只有配方卡这类结构化长输出被 max_tokens 截断时才值得续写；
    普通散文被截断语义损失小，交由前端降级提示即可，避免无谓拉长时长。
    """
    if not text:
        return False
    stripped = text.lstrip()
    if stripped.startswith("```json") or stripped.startswith("```"):
        return True
    return '"blocks"' in text or "'blocks'" in text


class _ContinuationOutcome:
    """续写结果载体（由 _stream_formula_continuation 就地回填）。"""

    def __init__(self) -> None:
        self.rounds = 0
        self.appended_chars = 0
        self.finish_reason = ""  # 最后一轮的归一化 finish_reason


async def _stream_formula_continuation(
    *,
    llm,
    base_messages: list,
    partial_answer: str,
    model_override: str | None,
    temperature_override: float | None,
    overall_deadline: float,
    outcome: _ContinuationOutcome,
    log_prefix: str = "[chat_stream]",
):
    """对被 max_tokens 截断（finish_reason=="length"）的配方卡做自动续写。

    - 复用与首轮相同的 model / temperature / max_tokens 配置（llm 实例内配置）。
    - 最多 LLM_CONTINUATION_MAX_ROUNDS 轮；每轮把「已生成全文」作为 assistant 前缀，
      追加一条续写指令 user 消息，再流式拼接。
    - 每轮受「单轮上限」与「总预算剩余」双重约束；空闲超时快速失败。
    - 逐片 yield 续写文本，供调用方流式下发前端；结束时 outcome.finish_reason 为
      最后一轮的 finish_reason（若仍为 "length" 则调用方放弃续写、走既有降级）。
    """
    from ...services.ai.providers.llm_provider import StreamMeta

    full_text = partial_answer
    for rnd in range(1, LLM_CONTINUATION_MAX_ROUNDS + 1):
        remaining = overall_deadline - time.monotonic()
        if remaining <= 1:
            logger.warning(
                f"{log_prefix} 续写前总预算已耗尽（剩余={remaining:.1f}s），停止续写"
            )
            break
        round_budget = min(LLM_CONTINUATION_ROUND_TIMEOUT, remaining)
        outcome.rounds = rnd

        cont_messages = list(base_messages)
        cont_messages.append(LLMMessage(role="assistant", content=full_text))
        cont_messages.append(LLMMessage(role="user", content=_CONTINUATION_INSTRUCTION))

        meta = StreamMeta()
        stream = None
        round_chars = 0
        try:
            stream = llm.chat_stream(
                cont_messages,
                model=model_override,
                temperature=temperature_override,
                meta=meta,
            )
            async with asyncio.timeout(round_budget):
                while True:
                    try:
                        chunk = await asyncio.wait_for(
                            anext(stream), timeout=LLM_STREAM_IDLE_TIMEOUT
                        )
                    except StopAsyncIteration:
                        break
                    except asyncio.TimeoutError:
                        logger.warning(
                            f"{log_prefix} 续写第{rnd}轮空闲超时"
                            f"（{LLM_STREAM_IDLE_TIMEOUT}s 无数据），提前结束本轮"
                        )
                        break
                    if chunk:
                        round_chars += len(chunk)
                        outcome.appended_chars += len(chunk)
                        full_text += chunk
                        yield chunk
        except asyncio.TimeoutError:
            logger.warning(
                f"{log_prefix} 续写第{rnd}轮超时（round_budget={round_budget:.1f}s）"
            )
        except Exception as e:
            logger.error(f"{log_prefix} 续写第{rnd}轮失败: {e}", exc_info=True)
        finally:
            if stream is not None:
                try:
                    await stream.aclose()
                except Exception:
                    pass

        outcome.finish_reason = meta.finish_reason
        logger.info(
            f"{log_prefix} 续写第{rnd}轮结束: finish_reason={meta.finish_reason!r}, "
            f"本轮字符={round_chars}, 累计续写={outcome.appended_chars}"
        )
        if meta.finish_reason != "length":
            # 正常结束 / content_filter / 其他 → 不再继续续写
            break
    # 轮次耗尽或不再 length → 返回，调用方据 outcome.finish_reason 决定后续


class ChatRequest(BaseModel):
    """智能对话请求"""
    model_config = {"extra": "ignore"}  # 忽略前端发送的额外字段（model 已被显式声明）

    question: str = Field(..., min_length=1, max_length=8000, description="用户问题")
    history: list[dict[str, Any]] | None = Field(None, description="对话历史（宽松结构，服务端清洗 role/content 为字符串）")
    stream: bool = Field(False, description="是否使用流式输出")
    scenario_mode: str = Field("formula_design", description="场景模式")
    user_profile_context: str | None = Field(
        None,
        max_length=4000,
        description="用户画像摘要（健康目标/过敏原/饮食禁忌/体质）",
    )
    rag_context: list[str] | None = Field(
        None,
        description="用户知识库（RAG）检索片段，注入 system prompt 作为【用户知识库参考】",
    )
    # DS Bot 移植：指定后以该 Bot 身份对话（人设+记忆+模型覆盖）
    bot_id: int | None = Field(
        None,
        description="Bot ID：以具名 Bot 身份对话，使用其 persona/记忆/模型",
    )
    # 模型覆盖：前端模型切换器直接指定 LLM 模型名称（优先级低于 bot_id 覆盖）
    model: str | None = Field(
        None,
        description="模型覆盖：指定 LLM 模型名称（如 deepseek-chat, gpt-4o-mini），优先级低于 bot_id",
    )
    # P2 统一会话 ID：前端本地会话标识（session-<ts>-<rand> 字符串）。
    # 携带时，_persist_chat_record 按 (user_id, client_session_id) 查找/创建会话，
    # 避免不同前端本地会话被服务器端合并；不携带时维持旧行为（合并到最新活跃会话）。
    client_session_id: str | None = Field(
        None,
        max_length=128,
        description="前端本地会话 ID（client_session_id），用于服务器端按前端会话隔离记录",
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


# RAG 检索片段净化参数（与 _sanitize_profile 类似，防止 Prompt 注入）
_RAG_CHUNK_MAX_CHARS = 500   # 单个 chunk 最大注入长度
_RAG_MAX_CHUNKS = 5          # 最多注入的 chunk 数量


def _sanitize_rag_chunks(rag_context: list[str] | None) -> list[str]:
    """
    净化前端传入的 RAG 检索片段，防止 Prompt 注入。

    rag_context 来自用户上传文档的检索结果，属不可信输入。与 _sanitize_profile 一致：
      1. 过滤控制字符
      2. 替换明显的指令覆盖句式
      3. 折叠换行与多余空白
      4. 限制每个 chunk 长度（500 字符）与 chunk 数量（5 个）
    """
    if not rag_context:
        return []

    import re as _re

    sanitized: list[str] = []
    for chunk in rag_context:
        if len(sanitized) >= _RAG_MAX_CHUNKS:
            break
        try:
            text = str(chunk or "").strip()
        except Exception:
            continue
        if not text:
            continue
        # 先限长，控制后续正则处理成本
        text = text[:_RAG_CHUNK_MAX_CHARS]
        # 1. 移除控制字符（保留常规空白）
        text = _re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
        # 2. 替换注入句式
        for pattern in _PROFILE_INJECTION_PATTERNS:
            text = _re.sub(pattern, "[已过滤]", text, flags=_re.IGNORECASE)
        # 3. 折叠换行与多余空白
        text = _re.sub(r"\s*\n\s*", "；", text)
        text = _re.sub(r"[ \t]{2,}", " ", text).strip()
        # 4. 折叠后再次限长
        text = text[:_RAG_CHUNK_MAX_CHARS]
        if text:
            sanitized.append(text)
    return sanitized


# ═══════════════════════════════════════════════════════════════
# 历史截断（Token 级估算，P2-12）
# ═══════════════════════════════════════════════════════════════

_HISTORY_TOKEN_BUDGET_CHARS = 8000  # 总预算约 8000 字符（约 2000 token，按 len/4 估算）
_HISTORY_MAX_MESSAGES = 20


def _truncate_history_by_tokens(
    history: list[dict] | None,
    budget_chars: int = _HISTORY_TOKEN_BUDGET_CHARS,
    max_messages: int = _HISTORY_MAX_MESSAGES,
) -> list[dict]:
    """
    按字符估算 token 数（单条约 len/4）截断对话历史，保留最近消息。

    从最新一条向前累加，超出预算后停止；最后一条超预算消息按剩余预算截断。
    """
    if not history:
        return []
    selected: list[dict] = []
    total_chars = 0
    for h in reversed(history):
        role = str(h.get("role") or "user")
        content = str(h.get("content") or "")
        est_chars = len(content)
        if total_chars + est_chars > budget_chars:
            remaining = budget_chars - total_chars
            if remaining >= 200:
                selected.append({"role": role, "content": content[:remaining]})
            break
        selected.append({"role": role, "content": content})
        total_chars += est_chars
        if len(selected) >= max_messages:
            break
    return list(reversed(selected))


# ═══════════════════════════════════════════════════════════════
# 轻量级剂量预校验（P0-3）
# ═══════════════════════════════════════════════════════════════

# 内置常用药食同源原料安全剂量范围（g/天），参考《中国药典》2025年版及2024版目录。
# 覆盖药食同源目录主要常用药材；未覆盖的药材不阻断对话但无单味校验。
# 日用总量安全上限：一般配方总干品 ≤30g/天；特殊滋补方 ≤50g/天
_COMMON_HERB_DOSAGE: dict[str, tuple[float, float]] = {
    # ── 补气类 ──
    "黄芪": (9, 30), "人参": (3, 9), "红参": (3, 6), "西洋参": (3, 6), "太子参": (9, 15),
    "党参": (9, 30), "五指毛桃": (15, 30),
    # ── 补血类 ──
    "当归": (6, 12), "熟地黄": (9, 15), "白芍": (6, 12), "何首乌": (6, 12),
    "龙眼肉": (9, 15), "桂圆": (9, 15), "阿胶": (6, 10),
    # ── 补阴类 ──
    "枸杞": (6, 15), "枸杞子": (6, 15), "麦冬": (6, 12), "天冬": (6, 12),
    "北沙参": (6, 12), "南沙参": (6, 12), "玉竹": (6, 12), "黄精": (9, 15),
    "石斛": (6, 12), "百合": (6, 12), "桑葚": (12, 15), "桑椹": (12, 15),
    # ── 补阳类 ──
    "杜仲": (6, 10), "续断": (6, 10), "沙苑子": (6, 10), "菟丝子": (6, 10),
    "益智仁": (3, 6), "补骨脂": (6, 10), "淫羊藿": (6, 10),
    # ── 健脾益气类 ──
    "白术": (6, 12), "茯苓": (10, 15), "山药": (15, 30), "扁豆": (9, 15),
    "白扁豆": (9, 15), "芡实": (9, 15), "莲子": (6, 15), "莲子心": (3, 6),
    "薏苡仁": (9, 30), "苍术": (3, 6), "甘草": (2, 10),
    # ── 清热类 ──
    "金银花": (6, 15), "连翘": (6, 12), "菊花": (6, 10), "桑叶": (6, 12),
    "薄荷": (3, 6), "蒲公英": (10, 30), "紫花地丁": (10, 15),
    "板蓝根": (9, 15), "鱼腥草": (15, 30), "败酱草": (15, 30),
    "夏枯草": (9, 15), "决明子": (9, 15), "淡竹叶": (6, 10),
    "木贼": (5, 10), "青葙子": (6, 10), "密蒙花": (6, 10),
    # ── 利水渗湿类 ──
    "泽泻": (6, 10), "猪苓": (6, 10), "赤小豆": (9, 30),
    "灯心草": (1, 3), "通草": (2, 5),
    # ── 理气类 ──
    "陈皮": (3, 10), "佛手": (3, 9), "香橼": (3, 6), "玫瑰花": (3, 6),
    "枳壳": (3, 6), "枳实": (3, 6), "砂仁": (3, 6), "豆蔻": (3, 6),
    "白豆蔻": (3, 6), "草豆蔻": (3, 6), "木香": (3, 6),
    # ── 活血类 ──
    "丹参": (10, 15), "红花": (3, 6), "桃仁": (6, 10), "川芎": (3, 6),
    "三七": (3, 9), "鸡血藤": (9, 15), "益母草": (9, 15),
    "山楂": (9, 12), "郁金": (3, 6), "姜黄": (3, 6),
    # ── 解表类 ──
    "紫苏": (5, 10), "紫苏叶": (6, 10), "紫苏梗": (6, 10),
    "生姜": (3, 10), "干姜": (3, 10), "葱白": (6, 10), "豆豉": (9, 15),
    "荆芥": (6, 10), "防风": (6, 10), "羌活": (3, 6), "独活": (3, 6),
    "藿香": (3, 10), "佩兰": (6, 10), "香薷": (6, 10),
    # ── 消食类 ──
    "麦芽": (10, 15), "神曲": (9, 15), "莱菔子": (9, 15),
    "鸡内金": (3, 6), "稻芽": (9, 15), "谷芽": (9, 15),
    # ── 化痰止咳类 ──
    "桔梗": (3, 10), "半夏": (3, 6),
    "瓜蒌": (9, 15), "浙贝母": (6, 10), "川贝母": (3, 6),
    "款冬花": (6, 10), "紫菀": (6, 10), "百部": (6, 10),
    # ── 收涩类 ──
    "五味子": (2, 6), "乌梅": (6, 12), "山茱萸": (6, 12),
    "金樱子": (6, 10), "覆盆子": (6, 10),
    # ── 安神类 ──
    "酸枣仁": (10, 15), "柏子仁": (6, 10), "远志": (3, 6), "合欢皮": (6, 10),
    "夜交藤": (9, 15), "龙骨": (9, 15), "牡蛎": (9, 15),
    # ── 平肝息风类 ──
    "天麻": (3, 10), "钩藤": (6, 12), "石决明": (9, 15),
    # ── 祛风湿类 ──
    "秦艽": (6, 10), "威灵仙": (6, 10), "千年健": (6, 10),
    # ── 芳香化湿类 ──
    "厚朴": (3, 6),
    "草果": (3, 6),
    # ── 温里类 ──
    "肉桂": (1, 5), "花椒": (2, 5), "高良姜": (3, 6),
    "小茴香": (3, 6), "吴茱萸": (1, 3), "丁香": (1, 3),
    # ── 补益坚果种子类 ──
    "黑芝麻": (9, 15), "核桃仁": (6, 9), "松子仁": (6, 10),
    "南瓜子": (9, 15), "栗子": (9, 15), "大枣": (6, 15), "红枣": (6, 15),
    # ── 其他常见 ──
    "葛根": (10, 15), "升麻": (3, 6), "柴胡": (3, 6),
    "白及": (3, 6),
    "胖大海": (2, 3), "罗汉果": (1, 2), "蜂蜜": (15, 30),
    "莪术": (3, 6),
    "昆布": (6, 12), "海带": (6, 12), "海藻": (6, 10),
    "马齿苋": (15, 30), "白花蛇舌草": (15, 30), "半枝莲": (15, 30),
    "土茯苓": (15, 30), "白茅根": (15, 30), "地榆": (9, 15),
    "槐花": (6, 10), "侧柏叶": (9, 15), "仙鹤草": (9, 15),
    "墨旱莲": (6, 10), "女贞子": (6, 12), "旱莲草": (6, 12),
    "桑寄生": (9, 15),
    "骨碎补": (6, 10), "接骨木": (9, 15),
    "天葵子": (6, 10), "山慈菇": (3, 6), "半边莲": (9, 15),
}

# 日用总剂量安全上限（g）：普通配方 ≤30g/天，滋补方 ≤50g/天
_TOTAL_DAILY_DOSAGE_LIMIT: float = 30.0
_TOTAL_DAILY_DOSAGE_WARNING: float = 50.0

# 「成分 + 剂量」正则：基于内置药食同源名称列表构建，避免把「每日当归」等
# 前缀误抓为成分名。支持：黄芪 10g / 黄芪10g / 黄芪：10g / 黄芪 10-20g / 10g 黄芪 / 10-20g 黄芪
_COMMON_HERB_NAMES = sorted(_COMMON_HERB_DOSAGE.keys(), key=len, reverse=True)
_HERB_ALT_PATTERN = "|".join(re.escape(n) for n in _COMMON_HERB_NAMES)
_DOSAGE_RANGE_RE = re.compile(
    rf"({_HERB_ALT_PATTERN})\s*[：:，,]?\s*(\d+(?:\.\d+)?)\s*[-~至]\s*(\d+(?:\.\d+)?)\s*g"
)
_DOSAGE_SINGLE_RE = re.compile(
    rf"({_HERB_ALT_PATTERN})\s*[：:，,]?\s*(\d+(?:\.\d+)?)\s*g\b"
)
_DOSAGE_RANGE_BEFORE_RE = re.compile(
    rf"(\d+(?:\.\d+)?)\s*[-~至]\s*(\d+(?:\.\d+)?)\s*g\s*({_HERB_ALT_PATTERN})"
)
_DOSAGE_SINGLE_BEFORE_RE = re.compile(
    rf"(\d+(?:\.\d+)?)\s*g\s*({_HERB_ALT_PATTERN})"
)


def _sum_herb_dosages(answer: str) -> float:
    """聚合回复中「内置药食同源成分 + 剂量g」的克重总和（去重重叠匹配）。

    供两处复用：
      - _append_dosage_warnings：总量超标警示（本函数抽出的正是其原有聚合逻辑）；
      - _validate_numeric_claims：克重加和守恒校验（P0-5）。
    只认 _COMMON_HERB_DOSAGE 中的已知成分名，避免把正文里的「每日 30g」等
    非配方克重误计入。重叠匹配（RANGE_*/SINGLE_* 命中同一段）只计一次。
    """
    matches: list[re.Match] = []
    for pattern in (
        _DOSAGE_RANGE_RE, _DOSAGE_SINGLE_RE,
        _DOSAGE_RANGE_BEFORE_RE, _DOSAGE_SINGLE_BEFORE_RE,
    ):
        matches.extend(pattern.finditer(answer))

    # 按匹配 span 去重：RANGE_* 与 SINGLE_* 正则可能重叠命中同一段文本
    # （如「10-20g 黄芪」同时被 _DOSAGE_RANGE_BEFORE_RE 与 _DOSAGE_SINGLE_BEFORE_RE
    # 命中），重叠只计一次，防止同一味同剂量被重复累加。
    span_seen: list[tuple[int, int]] = []
    herb_doses: dict[str, float] = {}
    for m in sorted(matches, key=lambda x: (x.start(), -(x.end() - x.start()))):
        start, end = m.span()
        if any(start < e and s < end for s, e in span_seen):
            continue
        groups = m.groups()
        if len(groups) == 3:
            # 区间型：黄芪 10-20g（RANGE_RE: herb,low,high）/ 10-20g 黄芪（RANGE_BEFORE_RE: low,high,herb）
            if m.re is _DOSAGE_RANGE_RE:
                herb = (groups[0] or "").strip()
                low, high = float(groups[1]), float(groups[2])
            else:
                herb = (groups[2] or "").strip()
                low, high = float(groups[0]), float(groups[1])
            dosage = round((low + high) / 2.0, 1)  # 代表值=区间中位数
        else:
            # 单值型：黄芪 10g（SINGLE_RE: herb,val）/ 10g 黄芪（SINGLE_BEFORE_RE: val,herb）
            if m.re is _DOSAGE_SINGLE_RE:
                herb = (groups[0] or "").strip()
                dosage = float(groups[1])
            else:
                herb = (groups[1] or "").strip()
                dosage = float(groups[0])
        herb = (herb or "").strip()
        if herb and dosage > 0:
            span_seen.append((start, end))
            herb_doses[herb] = herb_doses.get(herb, 0.0) + dosage

    return sum(herb_doses.values())


async def _append_dosage_warnings(answer: str, db: AsyncSession | None = None) -> str:
    """
    从回复文本提取「内置药食同源成分 + 剂量g」，与内置常用剂量上限表对比；
    超标时在回复末尾追加红色警示。db 参数保留用于后续扩展 FoodMaterial 表查询；
    当前实现不依赖数据库，任何异常静默跳过，不阻断对话。
    """
    if not answer:
        return answer

    matches: list[re.Match] = []
    for pattern in (
        _DOSAGE_RANGE_RE, _DOSAGE_SINGLE_RE,
        _DOSAGE_RANGE_BEFORE_RE, _DOSAGE_SINGLE_BEFORE_RE,
    ):
        matches.extend(pattern.finditer(answer))

    warnings: list[str] = []
    seen: set[tuple[str, float]] = set()

    for m in matches:
        groups = m.groups()
        if len(groups) == 3:
            # 范围型：黄芪 10-20g 或 10-20g 黄芪
            if m.re is _DOSAGE_RANGE_RE:
                herb, dosage = groups[0], float(groups[2])
            else:
                herb, dosage = groups[2], float(groups[1])
        else:
            # 单值型：黄芪 10g 或 10g 黄芪
            if m.re is _DOSAGE_SINGLE_RE:
                herb, dosage = groups[0], float(groups[1])
            else:
                herb, dosage = groups[1], float(groups[0])

        herb = (herb or "").strip()
        if not herb or dosage <= 0:
            continue
        key = (herb, dosage)
        if key in seen:
            continue
        seen.add(key)

        safe_dose = _COMMON_HERB_DOSAGE.get(herb)
        if safe_dose is None:
            continue
        min_g, max_g = safe_dose
        if max_g is not None and dosage > max_g:
            range_text = (
                f"{min_g:g}-{max_g:g}g" if min_g is not None else f"≤{max_g:g}g"
            )
            warnings.append(
                f"> ⚠️ **剂量警示**：{herb} {dosage:g}g 超出常规安全上限"
                f"（{range_text}），请遵医嘱并咨询医师。"
            )

    if not warnings:
        return answer

    # ── P0-2：总剂量聚合校验（单味药超标 + 总量超标）──
    # P1-1 修复见 _sum_herb_dosages 注释（区间取中位数、按 span 去重）；
    # 聚合逻辑已抽出复用（_validate_numeric_claims 的克重加和守恒也用它）。
    total_dose = _sum_herb_dosages(answer)
    if total_dose > _TOTAL_DAILY_DOSAGE_WARNING:
        warnings.append(
            f"> ⚠️ **总剂量警示**：本配方累计日用量约 {total_dose:.0f}g，"
            f"超过建议上限（{_TOTAL_DAILY_DOSAGE_LIMIT:g}g/天），"
            f"请遵医嘱并咨询医师。"
        )
    elif total_dose > _TOTAL_DAILY_DOSAGE_LIMIT:
        warnings.append(
            f"> ⚠️ **剂量提示**：本配方累计日用量约 {total_dose:.0f}g，"
            f"接近建议上限（{_TOTAL_DAILY_DOSAGE_LIMIT:g}g/天），"
            f"建议控制总用量或咨询医师。"
        )

    # 去重后追加
    unique_warnings = list(dict.fromkeys(warnings))
    return answer + "\n\n" + "\n\n".join(unique_warnings)


# ═══ P0-5（2026-11-08）：克重/氮系数/机理断言的最小确定性校验层 ═══
# 背景（reports/chat-history/chat-module-audit.md P0-5）：平台价值主张是「科学、精准、
# 可量化」（精确克重 + 理论功效成分含量），但克重加和、氮折算系数、功效机理断言全部
# LLM 直出、后端零校验即直达用户。本层对**能确定性判定**的最危险项做后处理校验，
# 以警示标记追加（对齐 _append_dosage_warnings 的追加方式），**绝不阻断回答**
# （药食同源定位辅助调理，急症拦截是另一层 _scan_urgent_question）。
#
# 设计原则——**宁保守不误报**：
#   - 只在能确定性判定时才警示（加和守恒、明显系数错用、空依据下的机理断言）；
#   - 判不准的场景宁可只「标注未校验」甚至不提示，也不瞎报——错误警示和漏校验一样
#     损害平台可信度。
#   - 克重解析复用 _append_dosage_warnings 的 _COMMON_HERB_DOSAGE 正则族（经
#     _sum_herb_dosages 抽出复用），只认内置药食同源成分名，避免把正文非配方克重误计。

# 克重加和守恒：声明总量的识别正则。只匹配「总量词 + 数字 + g/克」，数字须紧跟
# 总量词之后（允许「约/≈/:」等连接词），避免把无关句子里的 g 值误当总量。
_MASS_TOTAL_RE = re.compile(
    r"(?:总量|总克重|总重量|总重|总剂量|总用量|合计|共计|总和)[^\d\n]{0,6}"
    r"(\d+(?:\.\d+)?)\s*(?:g\b|G\b|克)"
)
# 加和守恒容差：声明总量与各成分加和的相对偏差超过此值才警示（±5%）。
_MASS_SUM_TOLERANCE = 0.05

# 氮折算系数：蛋白质/肽类理论含量 = 含氮量 × 折算系数。常见系数：
#   6.25（一般蛋白通用）、5.79/5.70（小麦/谷物等特定原料）。
_NITROGEN_FACTORS = ("6.25", "5.79", "5.70")
# 出现「含氮量/氮含量 × 系数 = 蛋白」式计算即标注所引用系数、提醒核对（保守口径，
# 不判定场景对错以免误报；仅当能确定场景时才给明确错用提示——见 _NITROGEN_GRAIN_TERMS）。
_NITROGEN_CALC_RE = re.compile(r"(含氮量|氮含量|全氮|总氮|氮量)")
# 谷物/小麦类原料：这些原料的氮折算系数通常用 5.79/5.70 而非通用 6.25。
_NITROGEN_GRAIN_TERMS = ("小麦", "谷物", "燕麦", "大麦", "黑麦", "玉米", "稻米", "大米", "面粉", "麸皮")

# 强功效机理断言：网络药理学式的分子机制表述。命中即视为「机理断言」，需绑定依据；
# 空依据/弱依据下出现此类断言时提示「缺乏平台知识库依据，为模型生成」。
_STRONG_MECHANISM_RE = re.compile(
    r"(抑制|激活|上调|下调|调节|阻断|促进)[\u4e00-\u9fa5A-Za-z0-9]{0,12}"
    r"(通路|信号通路|信号轴|受体|靶点|基因表达|蛋白表达|酶活性)"
    r"|(显著)(降低|升高|抑制|改善|提升)"
    r"|(通过)[\u4e00-\u9fa5A-Za-z0-9]{0,16}(通路|信号通路)"
)


def _validate_numeric_claims(answer: str) -> list[str]:
    """对 LLM 回答做克重加和守恒 + 氮折算系数的确定性校验，返回警示标记列表。

    1. 克重加和守恒：回答声明了「总量」数字时，验算各成分克重之和是否与声明一致
       （容差 ±5%）；不一致注入「声明Xg/实际加和Yg」核对提示。
    2. 氮折算系数：出现含氮量×系数=蛋白计算时，标注所引用系数并提醒核对（保守，
       避免误报）；仅当场景明确（如对非谷物原料用 5.79）才给定向提示。
    判不准时宁可不提示（返回空列表），绝不阻断回答。
    """
    warnings: list[str] = []
    if not answer:
        return warnings

    # ── 1. 克重加和守恒 ──
    # 各成分克重总和（复用剂量正则族，只认内置成分名）
    summed = _sum_herb_dosages(answer)
    if summed > 0:
        declared = 0.0
        for m in _MASS_TOTAL_RE.finditer(answer):
            val = float(m.group(1))
            if val > declared:
                declared = val
        if declared > 0:
            low, high = declared * (1 - _MASS_SUM_TOLERANCE), declared * (1 + _MASS_SUM_TOLERANCE)
            if summed < low or summed > high:
                warnings.append(
                    f"> ⚠️ **克重校验**：配方总克重与各成分之和不符"
                    f"（声明{declared:g}g / 实际加和约{summed:.1f}g），请核对配方克重。"
                )

    # ── 2. 氮折算系数标注 ──
    if _NITROGEN_CALC_RE.search(answer):
        used = [f for f in _NITROGEN_FACTORS if f in answer]
        if used:
            coeff_txt = "、".join(used)
            warnings.append(
                f"> ℹ️ **理论含量提示**：检测到氮折算计算，本回复引用的折算系数为"
                f"（{coeff_txt}）。一般蛋白通用系数为 6.25，小麦/谷物等特定原料常用"
                f" 5.79/5.70；请核对系数与原料场景是否匹配。"
            )

    return warnings


def _append_groundedness_warnings(answer: str, kb_state: str | None) -> list[str]:
    """强功效机理断言绑定依据：依据为空/弱/不可用时提示「机理断言为模型生成」。

    kb_state 由 _resolve_kb_state 提供（复用 _build_system_prompt 三态口径）：
      - platform（平台知识库有命中）→ 有权威依据，不提示；
      - weak_user（前端 RAG 弱依据）→ 提示「基于弱依据」；
      - empty（检索成功但无命中）/ unavailable（检索异常）→ 提示「缺乏平台知识库依据」；
      - none（未做知识检索）/ None（bot 上下文等未知态）→ 判不准，不提示（宁保守）。
    """
    if not answer or kb_state in (None, _KB_STATE_PLATFORM, _KB_STATE_NONE):
        return []
    if not _STRONG_MECHANISM_RE.search(answer):
        return []

    if kb_state == _KB_STATE_WEAK_USER:
        return [
            "> ℹ️ **依据提示**：以下机理断言基于用户上传文档的检索结果（弱依据），"
            "为模型生成内容，非平台知识库权威结论，请谨慎参考。"
        ]
    # empty / unavailable
    return [
        "> ⚠️ **依据提示**：以下机理断言缺乏平台知识库依据，为模型生成，"
        "请勿视为平台校验结论；涉及具体功效机理请以权威文献或医师意见为准。"
    ]


# ═══ P0-1（task-13，2026-11-08）：急重症拦截主回答（医疗合规红线）═══
# 背景（reports/chat-history/chat-module-audit.md P0-1）：此前 URGENT_KEYWORDS 只在
# dialectics_service（辨证侧卡）扫描，主回答（配方）从不设防——用户问
# 「胸闷+左肩放射痛配食疗方」时，侧卡提示就医、主回答却照常生成精确到克的方子，
# 自相矛盾且构成医疗合规风险。
# 修法：主回答生成前扫描用户问题，命中即让主回答明确「立即就医、不提供食疗配方」，
# 复用 dialectics_service.URGENT_KEYWORDS（import，勿复制，保证与侧卡口径一致）。
_URGENT_REFUSAL_HEADER = (
    "⚠️ **您描述的情况可能属于急重症，请立即就医，不建议通过食疗配方自行处理。**"
)
_URGENT_REFUSAL_BODY = (
    "\n\n您提到的症状可能提示需要紧急医疗评估的急性状况（如心血管、脑血管、"
    "急腹症、中毒或严重感染等）。此类情况存在时间敏感性，**请立即前往急诊或拨打 120**，"
    "由专业医师当面诊治，切勿延误。\n\n"
    "**为什么本平台不提供配方：**\n"
    "- 药食同源食疗定位于日常调理与辅助，**起效温和、周期长**，无法应对急重症的时效要求；\n"
    "- 在未明确诊断前自行服用食疗方，可能掩盖病情、延误最佳救治时机，甚至与后续治疗冲突；\n"
    "- 急症处理需专业急救与医学干预，不在我能提供的安全边界内。\n\n"
    "**请您现在就做：**\n"
    "1. 立即就医（急诊）；如症状凶险（胸痛、呼吸困难、意识改变、大出血等）请拨打 120；\n"
    "2. 就医前避免进食、自行服药或采用任何偏方；\n"
    "3. 如有人陪同，请让其协助并告知接诊医师全部症状。\n\n"
    "> 本提示为安全建议，不能替代医师诊断与治疗。急症请以急救医疗为准。"
    "待病情稳定、经医师评估后，可再就日常调理咨询本平台。"
)


_URGENT_HISTORY_ROUNDS = 3  # 多轮绕过防护：只回看最近 3 条 user 消息（兼顾性能/上下文）


def _scan_urgent_question(question: str, history: list | None = None) -> str | None:
    """扫描「当前问题 + 最近几轮 history」是否命中急重症关键词（复用 URGENT_KEYWORDS）。

    缺口1（task-13，2026-11-08）：仅扫当前 question 会被「多轮拆分」绕过——
    第一轮「我胸闷/左肩放射痛」（命中拒），第二轮「针对上面症状给食疗方」
    question 本身无急症词→绕过。故回看最近 N 条 user 消息一起匹配。
    返回命中的关键词（用于日志与定位），未命中返回 None。
    匹配为简单子串包含——与 dialectics_service 入口扫描口径一致，宁误报不漏报。
    """
    from ...services.ai.dialectics_service import URGENT_KEYWORDS

    def _match(text: str) -> str | None:
        if not text:
            return None
        for kw in URGENT_KEYWORDS:
            if kw in text:
                return kw
        return None

    # 1) 当前问题优先
    hit = _match(question)
    if hit:
        return hit

    # 2) 多轮绕过防护：只回看最近 _URGENT_HISTORY_ROUNDS 条 user 消息
    #    （不无限拼接，兼顾性能/上下文；指代前文症状通常就在最近几轮内）。
    if history:
        recent_user_msgs = [
            str(h.get("content") or "")
            for h in history
            if isinstance(h, dict) and str(h.get("role") or "") == "user"
        ]
        for text in recent_user_msgs[-_URGENT_HISTORY_ROUNDS:]:
            hit = _match(text)
            if hit:
                return hit
    return None


def _urgent_refusal_answer(matched: str | None = None) -> str:
    """构造急重症主回答：明确「立即就医、不提供食疗配方」，绝不生成克重方子。

    matched 仅用于日志/可读性，不改变固定安全文本内容。
    """
    if matched:
        logger.warning(f"[chat] 急症主回答拒绝生成配方，命中关键词: {matched}")
    return _URGENT_REFUSAL_HEADER + _URGENT_REFUSAL_BODY


# ═══ P0-5（2026-11-08）：知识依据三态——供功效机理断言绑定依据（groundedness）复用 ═══
# _build_system_prompt 内部对知识库检索做了三态判断（有结果/成功但空/异常/前端弱依据），
# 但该判断结果是局部的、调用方拿不到。这里把「检索态」抽成可复用常量 + 一个纯查询函数，
# 让后处理也能判断「当前回答是否缺乏平台知识库依据」，从而给强机理断言绑定依据提示。
# 说明：retrieve_herb_knowledge 有 DB 开销，故仅在回答里出现强机理断言时才调用（惰性），
# 且所有异常静默降级为 None（判不准→不警示），避免误报、不阻断回答。
_KB_STATE_PLATFORM = "platform"      # 平台知识库有命中结果（权威依据）
_KB_STATE_WEAK_USER = "weak_user"     # 前端 RAG 非空（会话上下文弱依据）
_KB_STATE_EMPTY = "empty"             # 平台检索成功但无命中（无依据）
_KB_STATE_UNAVAILABLE = "unavailable"  # 平台检索异常（依据不可用）
_KB_STATE_NONE = "none"               # 未做知识检索（非配方场景/bot 上下文）→ 不判 groundedness


async def _resolve_kb_state(
    scenario_mode: str,
    question: str | None,
    rag_context: list[str] | None,
    db: AsyncSession | None = None,
) -> str:
    """复现 _build_system_prompt 的知识检索三态判断，返回当前回答的依据态。

    与 _build_system_prompt 口径保持一致：前端 RAG 非空 → weak_user；否则配方类场景
    走平台检索（有结果=platform / 空=empty / 异常=unavailable）；非配方场景 → none。
    任何异常静默降级（不阻断），调用方据此决定是否给机理断言绑定依据提示。
    """
    sanitized_rag = _sanitize_rag_chunks(rag_context)
    if sanitized_rag:
        return _KB_STATE_WEAK_USER
    if (scenario_mode or "formula_design") in (
        "formula_design", "academician", "safety_off", "process_eng", "concise_adv",
    ) and question:
        try:
            from ...services.ai.formula_intelligence import retrieve_herb_knowledge

            entries = await retrieve_herb_knowledge(question, top_k=1, db=db)
            return _KB_STATE_PLATFORM if entries else _KB_STATE_EMPTY
        except Exception as e:
            logger.warning(f"[chat] groundedness 知识态判定检索失败（忽略）: {e}")
            return _KB_STATE_UNAVAILABLE
    return _KB_STATE_NONE


async def _build_system_prompt(
    scenario_mode: str,
    profile_raw: str | None,
    question: str | None = None,
    db: AsyncSession | None = None,
    rag_context: list[str] | None = None,
) -> str:
    """
    构建 System Prompt，并将用户画像作为「用户约束」注入。

    P1-6：当场景为任意配方/安全/工艺/精简场景时（覆盖全部 4 个前端场景别名
    academician/safety_off/process_eng/concise_adv 及后端默认 formula_design），
    尝试从平台原料库检索相关知识并追加「【平台知识库参考】（来源：平台原料库）」，
    检索失败必须静默降级，不影响对话主流程。

    当 rag_context 存在时（前端已通过 /rag/query 检索），跳过平台 SQL 检索，
    直接合并前端 RAG 结果，避免双重检索。

    安全设计：
      - 画像注入 System 层而非 User 层，获得更高指令优先级
      - 明确要求遵守过敏/禁忌，无法满足时必须说明而非忽略
    """
    base_prompt = get_prompt_service().get_scenario_prompt(
        scenario_mode or "formula_design"
    )

    knowledge_block = ""

    # 优先使用前端 RAG 结果（避免双重检索）
    # P2：rag_context 属不可信输入，先净化（过滤控制字符/注入句式、限制 chunk 长度与数量）再注入。
    sanitized_rag = _sanitize_rag_chunks(rag_context)
    if sanitized_rag:
        # 合并前端 RAG 结果
        rag_lines = [f"- {chunk}" for chunk in sanitized_rag]
        # 缺口2（task-13，2026-11-08）：前端 RAG 返回的 chunk 只经 _sanitize_rag_chunks
        # 过滤注入字符、**不评相关性**，非空≠权威。若不标注，弱/不相关依据会呈现为「有据」。
        # 故注入「会话上下文弱依据」标记，与平台知识库权威依据区分开。
        knowledge_block = (
            "\n\n【用户知识库参考】（来自用户上传文档的检索结果，可作为配方设计的依据；"
            "若与平台知识库冲突，以药食同源安全规范为准）\n"
            + "\n".join(rag_lines)
            + "\n\n【依据强度提示】以上依据来自**用户会话上下文/上传文档**，"
            "非平台知识库权威校验；涉及具体克重、功效机理时请谨慎核对，勿直接视为权威结论。"
        )
    elif (scenario_mode or "formula_design") in (
        "formula_design",
        "academician",
        "safety_off",
        "process_eng",
        "concise_adv",
    ) and question:
        # 前端未提供 RAG 结果时，使用平台 SQL 检索。
        # P1-6：覆盖全部 4 个前端场景别名（academician/safety_off/process_eng/concise_adv）
        # 加后端默认 formula_design，消除「空 rag_context 时平台知识库被静默跳过」。
        #   - safety_off（安全专员）下平台药材安全/禁忌数据价值最高：安全评估依赖药食同源
        #     禁忌、每日用量上限与毒性/配伍禁忌数据，平台知识库正是其核心依据。
        #   - concise_adv（精简顾问）虽偏「快速查询/对比」，但平台知识库能显著增强回答的
        #     事实准确性，故仍注入（产品语义：增强而非替代）。
        #   - 「通用问答」不属于任何命名场景，由 base prompt 承载，不在此分支。
        try:
            from ...services.ai.formula_intelligence import (
                format_knowledge_entry,
                retrieve_herb_knowledge,
            )

            entries = await retrieve_herb_knowledge(question, top_k=5, db=db)
            if entries:
                lines = [format_knowledge_entry(e) for e in entries]
                knowledge_block = (
                    "\n\n【平台知识库参考】（来源：平台原料库）\n"
                    + "\n".join(lines)
                )
            else:
                # P0-2（task-13）：检索**成功但空**——此前 knowledge_block 保持空、无任何
                # 标记，主回答会凭空生成克重配方/机理断言却呈现为「有据」。此处注入显式
                # 「无依据」标记，与下方异常分支口径一致，区分三种状态：
                #   ①检索成功有结果 → 上方注入【平台知识库参考】
                #   ②检索成功但空   → 此处注入【平台知识库参考】空结果标记
                #   ③检索异常       → except 分支注入「检索不可用」标记
                logger.info("平台知识库检索成功但无命中，注入无依据标记")
                knowledge_block = (
                    "\n\n【系统提示】未在平台知识库中检索到与该问题相关的数据，"
                    "以下回复基于通用语言能力生成，**未引用平台原料库数据，缺乏平台知识库依据**；"
                    "涉及具体克重、功效机理时请谨慎核对，勿视为平台知识库支撑的结论。"
                )
        except Exception as e:
            # 检索失败时注入显式标记，告知用户知识增强已跳过（不静默降级）
            logger.warning(f"平台知识库检索失败，注入禁用标记: {e}")
            knowledge_block = (
                "\n\n【系统提示】知识库检索暂时不可用，以下回复基于通用语言能力生成，未引用平台原料库数据。"
            )

    profile = _sanitize_profile(profile_raw)
    if not profile:
        return f"{base_prompt}{knowledge_block}"

    return (
        f"{base_prompt}{knowledge_block}\n\n"
        "【用户约束 — 必须严格遵守】\n"
        f"{profile}\n\n"
        "执行要求：\n"
        "1. 配方中严禁出现用户已声明的过敏原或饮食禁忌原料；\n"
        "2. 若在满足约束的前提下无法达到预期功效，必须明确说明冲突，"
        "不得静默忽略约束；\n"
        "3. 药材用量必须符合药食同源目录的每日用量上限；\n"
        "4. 特殊人群（孕妇、儿童、慢性病患者）需给出针对性提示。"
    )


async def _resolve_bot_chat_context(
    db: AsyncSession,
    bot_id: int | None,
    user_id: int,
    tenant_id: int,
) -> tuple[str, str | None, float | None] | None:
    """加载 Bot 对话上下文（DS Bot 移植）。

    返回 (system_prompt, model_override, temperature_override)；
    若 bot_id 为空返回 None（走普通 AI 对话）。

    - system_prompt = persona_prompt + 跨会话记忆块（R7）
    - model_override = bot.model_id（M1：每个 Bot 独立选模型）
    - 可见性校验：仅创建者或 org 共享 Bot 可对话
    """
    if not bot_id:
        return None
    from ...domain.bots import BotVisibility
    from ...services.ai.agent.bot_manager import BotManager

    manager = BotManager(db)
    bot = await manager.get_bot(bot_id, tenant_id)
    if bot is None:
        raise HTTPException(status_code=404, detail="Bot 不存在或已删除")
    if bot.visibility != BotVisibility.ORG and bot.created_by != user_id:
        raise HTTPException(status_code=403, detail="无权与该 Bot 对话")

    system_prompt = await manager.build_bot_system_prompt(bot, user_id)
    model_override, temperature_override = manager.resolve_model_override(bot)
    return system_prompt, model_override, temperature_override


async def _persist_chat_record(
    db: AsyncSession,
    user_id: int,
    question: str,
    answer: str,
    bot_id: int | None = None,
    title: str | None = None,
    client_session_id: str | None = None,
) -> None:
    """回写对话记录到数据库（会话 + 消息）。

    - 携带 client_session_id：按 (user_id, client_session_id[, bot_id]) 查找/创建会话，
      使服务器端会话与前端本地会话一一对应，避免多个本地会话被合并。
    - 不携带 client_session_id：维持旧行为（按 bot_id 隔离，合并到最新活跃会话），
      保证旧请求/旧客户端行为完全不变。
    """
    try:
        import datetime as _dt

        from ...models.chat import ChatMessage, ChatSession

        if client_session_id:
            # P2 统一会话 ID：按前端本地会话标识精确查找/创建，避免合并
            session_query = select(ChatSession).where(
                ChatSession.user_id == user_id,
                ChatSession.client_session_id == client_session_id,
                ChatSession.is_active.is_(True),
            )
            if bot_id:
                session_query = session_query.where(ChatSession.bot_id == bot_id)
            session_result = await db.execute(
                session_query.order_by(ChatSession.updated_at.desc()).limit(1)
            )
            chat_session = session_result.scalar_one_or_none()
        else:
            # 旧行为：无 client_session_id 时合并到用户最新活跃会话（按 bot_id 隔离）
            session_query = select(ChatSession).where(
                ChatSession.user_id == user_id,
                ChatSession.is_active.is_(True),
            )
            if bot_id:
                session_query = session_query.where(ChatSession.bot_id == bot_id)
            session_result = await db.execute(
                session_query.order_by(ChatSession.updated_at.desc()).limit(1)
            )
            chat_session = session_result.scalar_one_or_none()

        if not chat_session:
            chat_session = ChatSession(
                user_id=user_id,
                title=(title or question)[:50] + ('...' if len(title or question) > 50 else ''),
                message_count=0,
                is_active=True,
                bot_id=bot_id,
                client_session_id=client_session_id,
            )
            db.add(chat_session)
            await db.commit()
            await db.refresh(chat_session)

        db.add(ChatMessage(session_id=chat_session.id, role="user", content=question))
        db.add(ChatMessage(session_id=chat_session.id, role="assistant", content=answer))
        chat_session.message_count += 2
        chat_session.updated_at = _dt.datetime.now(_dt.timezone.utc)
        await db.commit()
        # Phase 3：自动沉淀记忆（受 ENABLE_AUTO_MEMORY 开关控制，默认关闭）
        if bot_id:
            from ...services.ai.agent.memory_service import extract_and_store_memories
            await extract_and_store_memories(db, bot_id, user_id, question, answer)
    except Exception as e:
        logger.warning(f"对话记录回写失败（非致命）: {e}")


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
    # 未登录直接 401（get_current_user 为可选认证，current_user 可能为 None，
    # 后续 current_user.id 会抛 AttributeError 变成 500）
    if current_user is None:
        raise HTTPException(status_code=401, detail="请先登录后再使用 AI 对话")

    # 组织计划 AI 配额检查（超限 403）
    try:
        from ...core.multi_tenant.multi_tenant_service import ensure_ai_quota
        await ensure_ai_quota(db, current_user.id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    # ── Rate Limit 检查（租户级，与 /chat/stream 一致） ──
    limiter = get_ai_rate_limiter()
    allowed, error_msg = await limiter.check_request(tenant.org_id)
    if not allowed:
        logger.warning(f"[chat] 组织 {tenant.org_id} 触发限流: {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "RATE_LIMIT_EXCEEDED",
                "message": error_msg,
                "retry_after": 60,
            },
            headers={"Retry-After": "60"},
        )

    import datetime as dt

    try:
        start_time = time.time()
        # P0-1（task-13）：急症红线——主回答不为急重症生成克重配方。
        # 放在缓存查询之前，确保急症问题绝不命中可能含配方的历史缓存答案；
        # 同时仍并行运行辨证任务以填充侧卡（其就医提示与主回答口径一致）。
        _urgent_hit = _scan_urgent_question(req.question, getattr(req, "history", None))
        if _urgent_hit:
            logger.warning(
                f"[chat] 急症关键词命中，主回答改为就医引导（不生成配方）: {_urgent_hit}"
            )
            _urgent_answer = _urgent_refusal_answer(_urgent_hit)
            _dialectics = None
            try:
                from ...services.ai.dialectics_service import analyze_dialectics
                _d_task = asyncio.create_task(
                    analyze_dialectics(
                        req.question,
                        db=db,
                        user_id=str(current_user.id) if current_user else None,
                    )
                )
                _dialectics = await asyncio.wait_for(
                    asyncio.shield(_d_task), timeout=10
                )
            except Exception as d_exc:
                logger.warning(f"[chat] 急症路径辨证跳过（非致命）: {d_exc}")
            await _persist_chat_record(
                db, current_user.id, req.question, _urgent_answer,
                bot_id=getattr(req, "bot_id", None), title=req.question[:50],
                client_session_id=getattr(req, "client_session_id", None),
            )
            return {
                "content": _urgent_answer,
                "role": "assistant",
                "formulas": [],
                "timestamp": datetime.datetime.now().timestamp(),
                "model": None,
                "thinking_steps": [],
                "success": True,
                "cached": False,
                "key_source": "urgent-safety",
                "dialectics": _dialectics,
            }

        # P1-B7（2026-11-05）：非流式 /chat 补齐辨证/急重症安全网。
        # 辨证任务与主 LLM 并行运行，完成后放入响应 dialectics 字段；异常时静默跳过（非致命）。
        dialectics_task = None

        # 解析该用户实际可用的 LLM 服务：优先用户级密钥（SystemConfig llm_user_key_<user_id>），
        # 未配置则回退到全局 llm_service。缓存键加入用户维度，避免跨用户命中他人答案。
        user_llm = await _get_user_llm(current_user.id)
        llm = user_llm if user_llm is not None else _get_llm_service()
        key_source = "user" if user_llm is not None else (
            "db" if llm.config.key_from_db else ("env" if llm.config.api_key else "none")
        )

        # 检查缓存（租户级 key 防止跨租户缓存泄漏；用户级密钥时缓存按用户隔离）
        # 缓存键加入 history 哈希，避免不同上下文中相同问题返回相同答案
        # Bot 对话带 bot_id 进缓存键，避免不同 Bot 人设下命中他人答案
        bot_cache_tag = f":bot:{req.bot_id}" if getattr(req, "bot_id", None) else ""
        # 场景模式纳入缓存键：同一问题在不同场景（如 formula_design vs 营养分析）
        # 使用不同 system prompt，若不入键会导致跨场景命中他人答案。
        scenario_mode = getattr(req, "scenario_mode", "formula_design") or "formula_design"
        scenario_cache_tag = f":sm:{scenario_mode}"
        # 使用 hashlib 确保跨进程/容器部署时缓存键一致（Python hash() 有随机种子，重启后不同）
        question_hash = hashlib.md5(req.question.encode()).hexdigest()[:16]
        history_hash = hashlib.md5(
            json.dumps(
                [str(h) for h in (req.history or [])[-3:]],
                sort_keys=True,
            ).encode()
        ).hexdigest()[:16] if req.history else "0"
        # 画像/知识库上下文纳入缓存键：用户修改健康画像（如新增过敏原）或 RAG
        # 知识库更新后，若不入键会在 TTL 内命中旧答案，存在过敏原/禁忌安全风险。
        # 长文本/列表一律哈希后入键，避免缓存键长度失控。
        profile_raw = getattr(req, "user_profile_context", None)
        profile_hash = (
            hashlib.md5(str(profile_raw).encode()).hexdigest()[:16] if profile_raw else "0"
        )
        rag_raw = getattr(req, "rag_context", None)
        rag_hash = (
            hashlib.md5(json.dumps(rag_raw, sort_keys=True).encode()).hexdigest()[:16]
            if rag_raw
            else "0"
        )
        cache_key = (
            f"user:{current_user.id}:q:{question_hash}:ctx:{history_hash}:prof:{profile_hash}:rag:{rag_hash}{bot_cache_tag}{scenario_cache_tag}"
            if user_llm is not None
            else f"org:{tenant.org_id or 1}:q:{question_hash}:ctx:{history_hash}:prof:{profile_hash}:rag:{rag_hash}{bot_cache_tag}{scenario_cache_tag}"
        )
        cached = await ai_cache.get(cache_key)
        if cached:
            logger.info("缓存命中: %s", cache_key[:50])
            # 缓存命中单独打点（不污染 LLM 健康度统计；track_call 对非 llm/rag/safety 名称仅记录延迟）
            ai_observability.track_call("cache", (time.time() - start_time) * 1000, error=False)
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
            # 内嵌降级来源水印：即使内容被复制/分享，接收方也能识别非大模型生成
            fallback_content = final_answer or "感谢您的提问！我是 RMFOOD AI 配方顾问，请告诉我您的具体需求。"
            fallback_content = (
                f"{fallback_content}\n\n> ⚠️ 本回复由本地规则引擎生成，非大模型推理。"
            )
            return {
                "content": fallback_content,
                "role": "assistant",
                "formulas": [],
                "timestamp": dt.datetime.now().timestamp(),
                "model": "rule-engine-fallback",
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

        # P1-B7：启动辨证分析后台任务（与主 LLM 流并行；RAG/LLM 内部超时由
        # dialectics_service 控制，这里只负责创建与收尾，绝不阻塞主回答）。
        try:
            from ...services.ai.dialectics_service import analyze_dialectics
            dialectics_task = asyncio.create_task(
                analyze_dialectics(
                    req.question,
                    db=db,
                    user_id=str(current_user.id) if current_user else None,
                )
            )
        except Exception as d_exc:
            logger.warning(f"[chat] 辨证任务创建失败（忽略）: {d_exc}")
            dialectics_task = None

        scenario_mode = getattr(req, "scenario_mode", "formula_design") or "formula_design"
        # DS Bot 移植：若指定 bot_id，以 Bot 的人设+记忆替代默认场景 prompt，并应用模型覆盖
        # 注：平台 JWT 可能不携带 org_id（global 模式），Bot 默认租户为 1
        bot_ctx = await _resolve_bot_chat_context(
            db, getattr(req, "bot_id", None), current_user.id, tenant.org_id or 1,
        )
        kb_state = _KB_STATE_NONE
        if bot_ctx is not None:
            system_prompt, model_override, temperature_override = bot_ctx
            # Bot 对话走 Bot 人设/记忆，非本平台知识检索路径 → groundedness 判不准，不提示
        else:
            system_prompt = await _build_system_prompt(
                scenario_mode,
                getattr(req, "user_profile_context", None),
                question=req.question,
                db=db,
                rag_context=getattr(req, "rag_context", None),
            )
            # P0-5：记录知识依据态，供回答后处理给强机理断言绑定依据（避免二次检索）
            kb_state = await _resolve_kb_state(
                scenario_mode, req.question, getattr(req, "rag_context", None), db=db,
            )
            # 模型覆盖优先级：bot_id > req.model > 全局默认
            model_override = getattr(req, "model", None) or None
            temperature_override = None

        messages = [LLMMessage(role="system", content=system_prompt)]
        if req.history:
            for h in _truncate_history_by_tokens(req.history):
                # 宽松清洗：兼容前端可能传入的非字符串值，避免 422/构造失败
                messages.append(LLMMessage(
                    role=str(h.get("role") or "user"),
                    content=str(h.get("content") or ""),
                ))
        messages.append(LLMMessage(role="user", content=req.question))

        # Use LLM streaming to collect the full response（使用按用户解析出的服务实例）
        # ── 超时：与流式对齐的总超时，防止上游 LLM 挂起 ──
        answer = ""
        _ns_started = time.monotonic()
        async with asyncio.timeout(LLM_NON_STREAM_TIMEOUT):
            async for chunk in llm.chat_stream(
                messages, model=model_override, temperature=temperature_override,
            ):
                if chunk:
                    answer += chunk
        logger.info(
            f"[chat] 非流式 LLM 调用完成: elapsed={time.monotonic() - _ns_started:.1f}s, "
            f"model={model_override or llm.config.model}, provider={llm.config.provider}"
        )

        # P0-2: 输出安全过滤（敏感信息脱敏；失败静默降级，不阻断对话）
        try:
            from ...services.ai.safety import check_output

            output_result = check_output(answer)
            if not output_result.is_safe:
                logger.warning(
                    "[chat] 输出安全检查未通过，使用脱敏文本: %s",
                    [f.finding_type for f in output_result.findings],
                )
                answer = output_result.sanitized_text or answer
        except Exception as exc:
            logger.warning("[chat] 输出安全检查失败（忽略）: %s", exc)

        # P0-3: 轻量级剂量预校验（超标时追加警示）
        answer = await _append_dosage_warnings(answer, db=db)

        # P0-5: 克重加和守恒/氮折算系数/机理断言依据 的最小确定性校验（警示追加，不阻断）。
        # 任何异常静默跳过（宁保守不误报，也绝不影响主回答返回）。
        try:
            claim_warnings = _validate_numeric_claims(answer)
            claim_warnings += _append_groundedness_warnings(answer, kb_state)
            if claim_warnings:
                answer = answer + "\n\n" + "\n\n".join(dict.fromkeys(claim_warnings))
        except Exception as exc:
            logger.warning(f"[chat] 数值/依据校验失败（忽略）: {exc}")

        # P0-4（本任务）：持久化前强制 JSON 完整性校验 —— 绝不允许把残缺配方卡
        # 写入 chat_messages（可修复则补全，仍无法修复则降级为普通代码块）。
        try:
            answer, _ = ensure_valid_json_or_markdown(answer)
        except Exception as jr_err:
            logger.warning("[chat] JSON 完整性修复失败（忽略）: %s", jr_err)

        # P1-B7：收尾辨证任务——已与主 LLM 并行，此处只做有界等待；
        # 超时/失败静默跳过（dialectics=None），绝不阻塞或影响主回答返回。
        dialectics = None
        if dialectics_task is not None:
            try:
                dialectics = await asyncio.wait_for(asyncio.shield(dialectics_task), timeout=10)
            except Exception as d_exc:
                logger.warning(f"[chat] 辨证分析跳过（非致命）: {d_exc}")
                if dialectics_task and not dialectics_task.done():
                    dialectics_task.cancel()

        # 回写对话记录到数据库（按 bot_id 隔离持续会话；持久化最终脱敏+警示后的内容）
        await _persist_chat_record(
            db, current_user.id, req.question, answer,
            bot_id=getattr(req, "bot_id", None), title=req.question[:50],
            client_session_id=getattr(req, "client_session_id", None),
        )

        # 构建返回结果（匹配前端 AIResponse 接口）
        # 主路径使用直接 LLM 调用，无 thinking_steps；LLM 不可用时由下方降级路径产出
        # P1-B7：新增 dialectics 字段（可能为 None）。前端旧客户端忽略未知字段，
        # 新客户端据此渲染辨证卡片/急重症提示，不影响旧客户端兼容性。
        result = {
            "content": answer,
            "role": "assistant",
            "formulas": [],
            "timestamp": datetime.datetime.now().timestamp(),
            "model": llm.config.model if llm.is_available else None,
            "thinking_steps": [],
            "success": True,
            "cached": False,
            "key_source": key_source,
            "dialectics": dialectics,
        }

        # 写入缓存 + 记录指标（在 return 之前）
        await ai_cache.set(cache_key, answer)
        ai_observability.track_call("llm", (time.time() - start_time) * 1000, error=False)
        return result
    except RuntimeError as e:
        if dialectics_task and not dialectics_task.done():
            dialectics_task.cancel()
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
        elif _is_upstream_rate_limit(error_msg):
            # P2 修复：上游 LLM 限流 ≠ 本平台对客户端限流。平台自身限流在端点入口
            # get_ai_rate_limiter() 已以 429 正确拦截，走到这里的 RuntimeError 限流必然
            # 来自上游模型服务，映射为 502 上游错误，不再误标成客户端超额（429）。
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "AI_UPSTREAM_RATE_LIMITED",
                    "message": "上游模型服务限流，请稍后重试",
                    "retryable": True,
                    "retry_after": 30,
                    "suggestion": "上游模型服务商暂时限流，请稍候再试或降低请求频率",
                },
            )
        elif any(k in error_msg for k in ("超时", "无法连接", "服务响应", "连接失败")):
            # 超时/连接/服务繁忙类错误 → 503 + Retry-After，供前端识别并自动重试
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "AI_SERVICE_BUSY",
                    "message": "AI 服务繁忙，请稍后自动重试",
                    "retryable": True,
                    "retry_after": 5,
                    "suggestion": "系统将自动重试，请稍候"
                },
                headers={"Retry-After": "5"},
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
    except TimeoutError:
        if dialectics_task and not dialectics_task.done():
            dialectics_task.cancel()
        # asyncio.timeout(LLM_NON_STREAM_TIMEOUT) 触发：与运行时错误同等对待，返回可重试 503
        logger.error(f"[chat] 非流式 LLM 调用超时（{LLM_NON_STREAM_TIMEOUT}s）: "
                     f"model={model_override or llm.config.model}, provider={llm.config.provider}")
        raise HTTPException(
            status_code=503,
            detail={
                "error": "AI_SERVICE_BUSY",
                "message": "AI 服务繁忙，请稍后自动重试",
                "retryable": True,
                "retry_after": 5,
                "suggestion": "系统将自动重试，请稍候"
            },
            headers={"Retry-After": "5"},
        )
    except Exception as e:
        if dialectics_task and not dialectics_task.done():
            dialectics_task.cancel()
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
    # 未登录直接 401（get_current_user 为可选认证，current_user 可能为 None）
    if current_user is None:
        raise HTTPException(status_code=401, detail="请先登录后再使用 AI 对话")

    # 组织计划 AI 配额检查（超限 403）
    try:
        from ...core.multi_tenant.multi_tenant_service import ensure_ai_quota
        await ensure_ai_quota(db, current_user.id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    # SSE 连接槽占用标志：register 成功后置 True，任何异常路径据此注销，
    # 防止 5 次异常后 org 连接槽泄漏导致永久 429。
    sse_conn_registered = False

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
        connected = await limiter.register_sse_connection(tenant.org_id, conn_id)
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
        sse_conn_registered = True

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
                # ── P0（2026-11-08）：急症红线——降级分支同样不得为急症生成配方 ──
                # 此前本 early-return 分支（LLM 未配置部署态）直接调 thinking_engine
                # 生成主回答，而 thinking_engine 零急症防护、会经 FormulaDesigner 真产出
                # 克重配方；且急症扫描 _scan_urgent_question 位于其后 event_stream() 内，
                # 在此 early-return 路径上永不执行 → 「LLM 未配置 + 急症问题」穿透医疗红线。
                # 现与 event_stream(L1466) / 非流式(L955) 对齐：在调用 thinking_engine 之前
                # 先扫急症，命中即流式吐就医引导、绝不触达配方生成。
                _urgent_hit = _scan_urgent_question(req.question, getattr(req, "history", None))
                if _urgent_hit:
                    logger.warning(
                        "[chat_stream] 降级分支急症关键词命中，主回答改为就医引导（不调用 thinking_engine 生成配方）"
                    )
                    # 与 event_stream 急症分支口径一致：meta 标注来源 + progress 阶段
                    yield _format_sse_event("meta", {"model": "rule-engine-fallback", "reason": "urgent_referral"})
                    yield _format_sse_event("progress", {"stage": "preparing", "percent": 0})
                    _urgent_answer = _urgent_refusal_answer(_urgent_hit)
                    # 按标点切分为小块流式吐出（与 event_stream 急症分支同一打字机呈现方式）
                    import re as _re
                    for _seg in _re.split(r"(?<=[。！\n])", _urgent_answer):
                        if _seg:
                            yield _format_sse_event("content", {"content": _seg})
                    yield _format_sse_event("progress", {"stage": "done", "percent": 100})
                    yield "data: [DONE]\n\n"
                    return  # 关键：绝不在急症路径调用 thinking_engine / 生成配方

                from ...services.thinking_engine import thinking_engine
                # 明示降级来源：此前此处静默替换为规则引擎，用户完全无感知，
                # 是流式模式的「冒充专家」缺口。现显式标注 model 供前端展示徽标。
                yield _format_sse_event("meta", {"model": "rule-engine-fallback", "reason": "LLM 服务未配置或不可用"})
                # 规则引擎降级也发送 progress 事件，保持前端进度条阶段文案一致
                yield _format_sse_event("progress", {"stage": "preparing", "percent": 0})
                yield _format_sse_event("progress", {"stage": "rag_retrieving", "percent": 10})
                yield _format_sse_event("progress", {"stage": "llm_start", "percent": 45})
                async for chunk in thinking_engine.generate_thinking_stream(req.question):
                    yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                yield _format_sse_event("progress", {"stage": "done", "percent": 100})
                yield "data: [DONE]\n\n"
            # 降级流同样占用 SSE 连接槽：此路径直接返回，需显式登记注销，避免连接泄漏
            background_tasks.add_task(limiter.unregister_sse_connection, tenant.org_id, conn_id)
            return StreamingResponse(thinking_stream(), media_type="text/event-stream")

        scenario_mode = getattr(req, "scenario_mode", "formula_design") or "formula_design"
        # DS Bot 移植：若指定 bot_id，以 Bot 的人设+记忆替代默认场景 prompt，并应用模型覆盖
        # 注：平台 JWT 可能不携带 org_id（global 模式），Bot 默认租户为 1
        bot_ctx = await _resolve_bot_chat_context(
            db, getattr(req, "bot_id", None), current_user.id, tenant.org_id or 1,
        )
        kb_state = _KB_STATE_NONE
        if bot_ctx is not None:
            system_prompt, model_override, temperature_override = bot_ctx
            # Bot 对话走 Bot 人设/记忆，非本平台知识检索路径 → groundedness 判不准，不提示
        else:
            system_prompt = await _build_system_prompt(
                scenario_mode,
                getattr(req, "user_profile_context", None),
                question=req.question,
                db=db,
                rag_context=getattr(req, "rag_context", None),
            )
            # P0-5：记录知识依据态，供聚合 content 后处理给强机理断言绑定依据
            kb_state = await _resolve_kb_state(
                scenario_mode, req.question, getattr(req, "rag_context", None), db=db,
            )
            # 模型覆盖优先级：bot_id > req.model > 全局默认
            model_override = getattr(req, "model", None) or None
            temperature_override = None

        messages = [LLMMessage(role="system", content=system_prompt)]
        if req.history:
            for h in _truncate_history_by_tokens(req.history):
                # 宽松清洗：兼容前端可能传入的非字符串值，避免 422/构造失败
                messages.append(LLMMessage(
                    role=str(h.get("role") or "user"),
                    content=str(h.get("content") or ""),
                ))
        messages.append(LLMMessage(role="user", content=req.question))

        logger.info(f"[chat_stream] 消息列表构建完成, 共 {len(messages)} 条消息, system_prompt长度={len(system_prompt)}, bot_id={getattr(req, 'bot_id', None)}")


        async def event_stream():
            full_answer = ""
            try:
                # 明示回复来源，供前端展示来源徽标（真实模型 vs 规则引擎降级）
                yield _format_sse_event("meta", {
                    "model": model_override or llm.config.model or llm.config.provider,
                })
                # 实时进度：请求开始处理
                yield _format_sse_event("progress", {"stage": "preparing", "percent": 0})

                # ── P0-1（task-13）：急症红线——流式主回答不为急重症生成配方 ──
                # 在创建辨证任务 / LLM 消费任务之前拦截：命中 URGENT_KEYWORDS 即流式
                # 输出「立即就医、不提供食疗配方」固定安全应答，随后 done 收尾，
                # 绝不调用主 LLM（避免与辨证侧卡就医提示自相矛盾，也避免后台仍生成配方）。
                if _scan_urgent_question(req.question, getattr(req, "history", None)):
                    logger.warning(
                        "[chat_stream] 急症关键词命中，主回答改为就医引导（不生成配方）"
                    )
                    _urgent_answer = _urgent_refusal_answer()
                    # 按标点切分为小块流式吐出，前端打字机呈现自然（避免一次性大段）。
                    import re as _re
                    for _seg in _re.split(r"(?<=[。！\n])", _urgent_answer):
                        if _seg:
                            full_answer += _seg
                            yield _format_sse_event("content", {"content": _seg})
                    # 持久化急症拒绝回答（与非流式一致，保证会话历史完整）
                    try:
                        await _persist_chat_record(
                            db, current_user.id, req.question, full_answer,
                            bot_id=getattr(req, "bot_id", None),
                            title=req.question[:50],
                            client_session_id=getattr(req, "client_session_id", None),
                        )
                    except Exception as p_exc:
                        logger.warning(f"[chat_stream] 急症回答持久化失败（非致命）: {p_exc}")
                    # 成功收尾：与正常成功路径一致以 data: [DONE] 终止（非 error 的 event: done）
                    yield _format_sse_event("progress", {"stage": "done", "percent": 100})
                    yield "data: [DONE]\n\n"
                    return

                # ── P2-3 修复：辨证引擎与 LLM 流并行启动，节省端到端延迟 ──
                # 架构：dialectics 作为后台 task 与 LLM 流同时运行；
                #      event_stream 先 yield 辨证结果（30s 超时），再处理 LLM chunks。
                dialectics_task = None
                try:
                    from ...services.ai.dialectics_service import analyze_dialectics
                    dialectics_task = asyncio.create_task(
                        analyze_dialectics(
                            req.question,
                            db=db,
                            user_id=str(current_user.id) if current_user else None,
                        )
                    )
                except Exception as d_exc:
                    logger.warning(f"[chat_stream] 辨证任务创建失败（忽略）: {d_exc}")

                # ── LLM 流式输出超时保护：首包快速失败 + 总超时上限 + 15s SSE 心跳 ──
                # 防止上游 LLM 停顿/挂起导致 event_stream 永久阻塞。
                # 架构：后台 task 读 LLM → 放入 queue；心跳 task 定期放入 ping；
                #      event_stream 从 queue 消费并 yield，保证真正流式。
                # 根因修复：记录整体起始时间 + 首轮 finish_reason 载体。
                # overall_started 供续写计算总预算 deadline（首轮 + 续写 ≤ 165s < 前端 180s）。
                from ...services.ai.providers.llm_provider import StreamMeta

                overall_started = time.monotonic()
                llm_stream_meta = StreamMeta()
                llm_queue: asyncio.Queue = asyncio.Queue()

                async def _consume_llm_stream():
                    """后台消费 LLM 流：首包超时（60s）+ 总超时（120s，含首包）+ 空闲超时（30s 无数据分片即失败）。"""
                    start_ts = time.monotonic()
                    stream = None
                    try:
                        stream = llm.chat_stream(
                            messages, model=model_override, temperature=temperature_override,
                            meta=llm_stream_meta,
                        )
                        # 首包超时：等待第一个内容分片（上游挂起/网关排队时快速失败）
                        try:
                            async with asyncio.timeout(LLM_STREAM_FIRST_TOKEN_TIMEOUT):
                                first_chunk = await anext(stream)
                        except asyncio.TimeoutError:
                            elapsed = time.monotonic() - start_ts
                            logger.error(
                                f"[chat_stream] LLM 首包超时（{LLM_STREAM_FIRST_TOKEN_TIMEOUT}s）: "
                                f"elapsed={elapsed:.1f}s, url={llm.config.base_url}/chat/completions, "
                                f"model={model_override or llm.config.model}, "
                                f"provider={llm.config.provider}, user_id={current_user.id}"
                            )
                            await llm_queue.put((
                                "error",
                                f"LLM 首包超时（{LLM_STREAM_FIRST_TOKEN_TIMEOUT}s），上游无响应，请重试或切换模型",
                            ))
                            return
                        except StopAsyncIteration:
                            # 上游立即返回空流（无任何内容分片）：按正常空回复结束，不报错
                            logger.warning(
                                f"[chat_stream] LLM 流式返回空响应: model={model_override or llm.config.model}"
                            )
                            return
                        if first_chunk:
                            await llm_queue.put(("chunk", first_chunk))
                        # 总超时：整个流式响应的总时长上限（含首包等待时间）
                        remaining = LLM_STREAM_TOTAL_TIMEOUT - (time.monotonic() - start_ts)
                        if remaining <= 0:
                            raise asyncio.TimeoutError
                        async with asyncio.timeout(remaining):
                            # 空闲超时：30s 无任何内容分片 → 上游挂起（半死连接），快速失败。
                            # 用 wait_for 包裹 anext，避免"连接不断但无输出"拖满总超时。
                            while True:
                                try:
                                    chunk = await asyncio.wait_for(anext(stream), timeout=LLM_STREAM_IDLE_TIMEOUT)
                                except StopAsyncIteration:
                                    break
                                except asyncio.TimeoutError:
                                    idle_elapsed = time.monotonic() - start_ts
                                    logger.error(
                                        f"[chat_stream] LLM 流式空闲超时（{LLM_STREAM_IDLE_TIMEOUT}s 无数据分片）: "
                                        f"elapsed={idle_elapsed:.1f}s, url={llm.config.base_url}/chat/completions, "
                                        f"model={model_override or llm.config.model}, "
                                        f"provider={llm.config.provider}, user_id={current_user.id}"
                                    )
                                    await llm_queue.put((
                                        "error",
                                        f"LLM 流式空闲超时（{LLM_STREAM_IDLE_TIMEOUT}s 无数据），请重试或切换模型",
                                    ))
                                    return
                                if chunk:
                                    await llm_queue.put(("chunk", chunk))
                        # 根因修复：流正常结束后投递 finish（归一化 finish_reason + usage），
                        # 供消费端判断是否被 max_tokens 截断（length）并触发自动续写。
                        # 仅在正常读完（非超时/异常）时投递；异常路径由下方 except 兜住。
                        await llm_queue.put((
                            "finish",
                            {
                                "finish_reason": llm_stream_meta.finish_reason,
                                "usage": dict(llm_stream_meta.usage or {}),
                            },
                        ))
                    except asyncio.TimeoutError:
                        elapsed = time.monotonic() - start_ts
                        logger.error(
                            f"[chat_stream] LLM 流式响应总超时（{LLM_STREAM_TOTAL_TIMEOUT}s）: "
                            f"elapsed={elapsed:.1f}s, url={llm.config.base_url}/chat/completions, "
                            f"model={model_override or llm.config.model}, "
                            f"provider={llm.config.provider}, user_id={current_user.id}"
                        )
                        await llm_queue.put((
                            "error",
                            f"LLM 响应超时（{LLM_STREAM_TOTAL_TIMEOUT}s），请重试或切换模型",
                        ))
                    except RuntimeError as e:
                        elapsed = time.monotonic() - start_ts
                        logger.error(f"[chat_stream] LLM 流式调用失败（elapsed={elapsed:.1f}s）: {e}")
                        await llm_queue.put(("error", str(e)))
                    except Exception as e:
                        elapsed = time.monotonic() - start_ts
                        logger.error(f"[chat_stream] 流式生成异常（elapsed={elapsed:.1f}s）: {e}", exc_info=True)
                        await llm_queue.put(("error", f"流式生成异常: {str(e)}"))
                    finally:
                        if stream is not None:
                            try:
                                await stream.aclose()
                            except Exception:
                                pass
                        await llm_queue.put(("eof", None))

                async def _heartbeat_loop():
                    """每 15s 发送心跳 ping，保持连接活跃。"""
                    while True:
                        await asyncio.sleep(15)
                        await llm_queue.put(("ping", None))

                _llm_task = asyncio.create_task(_consume_llm_stream())
                _hb_task = asyncio.create_task(_heartbeat_loop())

                # 辨证结果优先 yield（在 LLM 首 chunk 之前，最多等 30s）
                if dialectics_task:
                    try:
                        dialectics = await asyncio.wait_for(asyncio.shield(dialectics_task), timeout=30)
                        # F9（P2）：剥离内部 token 用量字段，避免内部数据随 SSE 透传给前端
                        yield _format_sse_event(
                            "dialectics",
                            {k: v for k, v in dialectics.items() if k != "_token_usage"},
                        )
                        # 实时进度：辨证分析完成
                        yield _format_sse_event("progress", {"stage": "dialectics", "percent": 30})
                    except (asyncio.TimeoutError, Exception) as d_exc:
                        logger.warning(f"[chat_stream] 辨证分析跳过（超时或失败）: {d_exc}")
                        if dialectics_task and not dialectics_task.done():
                            dialectics_task.cancel()

                try:
                    # 实时进度：开始调用 LLM 生成回答
                    yield _format_sse_event("progress", {"stage": "llm_start", "percent": 45})
                    first_chunk_emitted = False
                    stream_error_emitted = False
                    stream_finish_reason = ""  # 首轮归一化 finish_reason（finish 消息回填）
                    generated_chars = 0
                    last_progress_chars = 0
                    while True:
                        msg_type, msg_data = await llm_queue.get()
                        if msg_type == "eof":
                            break
                        if msg_type == "ping":
                            yield _format_sse_event("ping", {})
                        elif msg_type == "chunk":
                            # P1: 流式输出安全过滤——逐 chunk 轻量脱敏（API Key/PII/邮箱等），
                            # 避免 LLM 原始 chunk 直接透传给用户终端。
                            sanitized_chunk = _sanitize_stream_chunk(msg_data)
                            full_answer += sanitized_chunk
                            generated_chars += len(sanitized_chunk)
                            yield _format_sse_event("content", {"content": sanitized_chunk})
                            # 实时进度：首包到达锚定 60%，之后每累计 200 字符更新一次（60→85 反映生成量）
                            if not first_chunk_emitted:
                                first_chunk_emitted = True
                                yield _format_sse_event("progress", {"stage": "generating", "percent": 60, "chars": generated_chars})
                            elif generated_chars - last_progress_chars >= 200:
                                last_progress_chars = generated_chars
                                pct = min(85, 60 + generated_chars // 50)
                                yield _format_sse_event("progress", {"stage": "generating", "percent": pct, "chars": generated_chars})
                        elif msg_type == "finish":
                            # 根因修复：捕获归一化 finish_reason（"length" → max_tokens 截断，
                            # 触发下方配方卡自动续写）。finish 消息先于 eof 投递，保证此处已就绪。
                            _fr = (msg_data or {}).get("finish_reason", "")
                            if _fr:
                                stream_finish_reason = _fr
                                logger.info(
                                    f"[chat_stream] 收到 finish: finish_reason={_fr!r}"
                                )
                        elif msg_type == "error":
                            stream_error_emitted = True
                            yield _format_sse_event("error", {"message": msg_data, "error": "STREAM_ERROR"})
                            break
                finally:
                    _hb_task.cancel()
                    if not _llm_task.done():
                        _llm_task.cancel()

                # P2: 流式错误（STREAM_ERROR）已发送 → 直接 done 结束，不再走后续成功路径，
                # 避免"错误后仍发 progress/step/done 成功事件"导致协议自相矛盾。
                if stream_error_emitted:
                    yield _format_sse_event("done", {})
                    return

                # P2: 流式 LLM 空响应不得按成功处理。上游返回空流（如 StopAsyncIteration）
                # 或全程无内容分片时，full_answer 为空 → 发送 error + done 并直接结束，
                # 跳过后续 progress/step/done 成功事件；错误路径本身以 error + done 收尾
                # （与下方 RuntimeError/Exception 分支的结束方式一致）。
                if not full_answer:
                    if not stream_error_emitted:
                        logger.warning(
                            "[chat_stream] LLM 返回空响应，按错误处理: model=%s",
                            model_override or llm.config.model,
                        )
                        yield _format_sse_event("error", {
                            "error": "EMPTY_RESPONSE",
                            "message": "LLM 返回空响应",
                        })
                    yield _format_sse_event("done", {})
                    return

                # ── 根因修复：max_tokens 截断（finish_reason=="length"）时自动续写配方卡 ──
                # 仅当（1）上游明确因 token 上限截断，且（2）当前是配方卡场景（```json 开头
                # 或含 blocks）时才续写；普通散文截断语义损失小，交由前端降级提示，避免无谓拉长时长。
                # 续写轮次受 LLM_CONTINUATION_MAX_ROUNDS 与 LLM_STREAM_OVERALL_BUDGET（总预算
                # 165s < 前端 180s）双重约束；续写后仍走下方 _repair_truncated_json +
                # ensure_valid_json_or_markdown 兜底。若仍 length 截断或达轮次上限，则放弃续写，
                # 保留既有降级（此时前端警告是合理的）。
                if stream_finish_reason == "length" and _is_formula_card_answer(full_answer):
                    logger.info(
                        f"[chat_stream] 检测到 length 截断且为配方卡场景，启动自动续写: "
                        f"chars={len(full_answer)}, max_rounds={LLM_CONTINUATION_MAX_ROUNDS}"
                    )
                    _cont_outcome = _ContinuationOutcome()
                    _cont_deadline = overall_started + LLM_STREAM_OVERALL_BUDGET
                    async for _cont_chunk in _stream_formula_continuation(
                        llm=llm,
                        base_messages=messages,
                        partial_answer=full_answer,
                        model_override=model_override,
                        temperature_override=temperature_override,
                        overall_deadline=_cont_deadline,
                        outcome=_cont_outcome,
                    ):
                        _cont_sanitized = _sanitize_stream_chunk(_cont_chunk)
                        full_answer += _cont_sanitized
                        yield _format_sse_event("content", {"content": _cont_sanitized})
                    stream_finish_reason = _cont_outcome.finish_reason
                    logger.info(
                        f"[chat_stream] 续写结束: rounds={_cont_outcome.rounds}, "
                        f"appended={_cont_outcome.appended_chars}, "
                        f"final_finish_reason={stream_finish_reason!r}, "
                        f"total_chars={len(full_answer)}"
                    )
                    # 续写完成（或放弃）后同步一次进度，反映内容已增长
                    yield _format_sse_event(
                        "progress",
                        {"stage": "generating", "percent": 85, "chars": len(full_answer)},
                    )

                # 输出完整性修复：LLM 提前停止导致 JSON 代码块未闭合时，
                # 自动补全后把差异补发到前端（用户无需刷新即可看到完整配方卡），
                # 并持久化修复后的完整内容。
                raw_answer = full_answer
                full_answer = _repair_truncated_json(full_answer)
                if len(full_answer) > len(raw_answer):
                    yield _format_sse_event("content", {"content": full_answer[len(raw_answer):]})

                # P0-2/P1: 流式结束后对完整内容做输出安全检查。
                # 非流式 /chat 会用 sanitized_text 整体替换；流式已展示内容无法撤回，
                # 因此这里（1）对高风险 API Key / PII 回填脱敏后的完整内容，
                # （2）将持久化文本替换为脱敏版本，与 /chat 行为保持一致。
                safety_patch = ""
                stream_sanitized = False
                try:
                    from ...services.ai.safety import check_output

                    output_result = check_output(full_answer)
                    if not output_result.is_safe:
                        logger.warning(
                            "[chat_stream] 输出安全检查未通过，追加安全提示: %s",
                            [f.finding_type for f in output_result.findings],
                        )
                        safety_patch += (
                            "\n\n> ⚠️ **内容安全提示**：本回复已通过系统安全检查并标记部分敏感内容，请谨慎参考。"
                        )
                        sanitized_text = output_result.sanitized_text or full_answer
                        if sanitized_text != full_answer:
                            # 高风险敏感信息（API Key / PII）：回填脱敏全文，供用户看到修正后的版本。
                            # 逐 chunk 脱敏可能因敏感串跨 chunk 边界漏检（如手机号/API Key 被拆分）。
                            high_risk = any(
                                f.finding_type in ("api_key", "pii", "phone", "email", "id_card")
                                for f in output_result.findings
                            )
                            if high_risk:
                                stream_sanitized = True
                                safety_patch += (
                                    "\n\n> 🔒 **敏感信息已脱敏**：检测到回复中包含 API Key / 个人信息等敏感内容，"
                                    "以下为脱敏后的完整回复（已替换原文中的敏感内容）：\n\n"
                                    f"{sanitized_text}"
                                )
                            # 与非流式 /chat 一致：持久化/后续处理使用脱敏后的完整内容
                            full_answer = sanitized_text
                except Exception as exc:
                    logger.warning("[chat_stream] 输出安全检查失败（忽略）: %s", exc)

                # P0-3: 轻量级剂量预校验，超标警示作为追加内容在 done 前输出
                try:
                    enriched = await _append_dosage_warnings(full_answer, db=db)
                    if len(enriched) > len(full_answer):
                        safety_patch += enriched[len(full_answer):]
                except Exception as exc:
                    logger.warning("[chat_stream] 剂量预校验失败（忽略）: %s", exc)

                # P0-5: 克重加和守恒/氮折算系数/机理断言依据 的最小确定性校验。
                # 对聚合后的完整 content 校验，警示作为追加内容在 done 前输出（不阻断）。
                try:
                    claim_warnings = _validate_numeric_claims(full_answer)
                    claim_warnings += _append_groundedness_warnings(full_answer, kb_state)
                    claim_warnings = list(dict.fromkeys(claim_warnings))
                    if claim_warnings:
                        safety_patch += "\n\n" + "\n\n".join(claim_warnings)
                except Exception as exc:
                    logger.warning("[chat_stream] 数值/依据校验失败（忽略）: %s", exc)

                if safety_patch:
                    yield _format_sse_event("content", {"content": safety_patch})
                # 实时进度：安全校验完成
                yield _format_sse_event("progress", {"stage": "safety_check", "percent": 85})

                # 流式完成后追加元数据步骤，供前端 ReasoningRow 显示"生成回答"状态
                yield _format_sse_event("progress", {"stage": "finalizing", "percent": 90})
                _step_payload = {
                    "step": "生成回答",
                    "content": f"完成 ({len(full_answer)} 字符)",
                    "status": "complete",
                }
                if stream_sanitized:
                    _step_payload["content"] += "，已脱敏"
                    _step_payload["sanitized"] = True
                yield _format_sse_event("step", _step_payload)
                # 实时进度：完成
                yield _format_sse_event("progress", {"stage": "done", "percent": 100, "chars": len(full_answer)})
                yield "data: [DONE]\n\n"
                # P0-4（本任务）：持久化前强制 JSON 完整性校验 —— 绝不允许把
                # 「以 ```json 开头但无法解析」的残缺配方卡写入 chat_messages。
                # ensure_valid_json_or_markdown 会：可修复则按正确顺序补全（闭字符串→补
                # key 值→去尾逗号→逆序闭括号）；仍无法修复则把 json 开标签降级为普通
                # 代码块，使前端按 Markdown 渲染，而不是显示「不完整的 JSON 数据」。
                try:
                    full_answer, _ = ensure_valid_json_or_markdown(full_answer)
                except Exception as jr_err:
                    logger.warning("[chat_stream] JSON 完整性修复失败（忽略）: %s", jr_err)

                # 流式对话写回会话历史（含 Bot 持续会话）
                try:
                    await _persist_chat_record(
                        db, current_user.id, req.question, full_answer,
                        bot_id=getattr(req, "bot_id", None), title=req.question[:50],
                        client_session_id=getattr(req, "client_session_id", None),
                    )
                except Exception as persist_err:
                    logger.warning(f"流式对话记录回写失败（非致命）: {persist_err}")
            except RuntimeError as e:
                error_msg = str(e)
                logger.error(f"流式对话运行时错误: {error_msg}", exc_info=True)

                if "401" in error_msg or "认证失败" in error_msg:
                    error_data = {
                        "error": "API_KEY_INVALID",
                        "message": "API Key 无效或已过期",
                        "suggestion": "请在系统设置中重新配置 API Key"
                    }
                elif _is_upstream_rate_limit(error_msg):
                    # P2 修复：上游 LLM 限流映射为上游错误事件，不冒充本平台客户端限流。
                    error_data = {
                        "error": "AI_UPSTREAM_RATE_LIMITED",
                        "message": "上游模型服务限流，请稍后重试",
                        "retryable": True,
                        "retry_after": 30,
                        "suggestion": "上游模型服务商暂时限流，请稍候再试",
                    }
                elif any(k in error_msg for k in ("超时", "无法连接", "服务响应", "连接失败", "响应中断")):
                    error_data = {
                        "error": "STREAM_RETRYABLE",
                        "message": "AI 服务繁忙，正在自动重试",
                        "retryable": True,
                        "retry_after": 1,
                        "suggestion": "系统将自动重试"
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
        # SSE 连接槽已占用时，任何 HTTP 异常路径（如 _resolve_bot_chat_context 抛
        # 404/403）都必须先注销连接再重抛，否则连接槽泄漏会导致 org 连接上限
        # （5 个）耗尽后永久 429。
        if sse_conn_registered:
            await limiter.unregister_sse_connection(tenant.org_id, conn_id)
        raise  # HTTP 异常已由具体 handler 处理，直接重抛
    except Exception as e:
        # 捕获 StreamingResponse 创建之前的所有异常
        if sse_conn_registered:
            await limiter.unregister_sse_connection(tenant.org_id, conn_id)
        logger.error("[chat_stream] 端点级异常（StreamingResponse 创建之前）: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "STREAM_INIT_ERROR",
                "message": "流式对话初始化失败，请稍后重试",
                "suggestion": "请检查后端日志获取详情"
            }
        )


# ═══════════════════════════════════════════════════════════════
# 动态追问问题建议（根据对话内容调用 LLM 生成）
# ═══════════════════════════════════════════════════════════════

class FollowUpSuggestionsRequest(BaseModel):
    """根据对话内容动态生成追问问题的请求"""
    # 允许 question 为空：极端场景（消息列表异常）下前端可能取不到最后一条 user 消息；空时后端从 history 取
    question: str = Field("", max_length=8000, description="用户最近的一个问题（可空，空时尝试从 history 取最后一条 user 消息）")
    # 允许 answer 为空：AI 可能尚未产生回复（前端在 AI 回复完成前不应调用，但后端需防御空值）
    answer: str = Field("", max_length=16000, description="AI 最后一条回复内容（可空，空时尝试从 history 取最后一条 assistant 回复）")
    history: list[dict[str, Any]] | None = Field(None, description="最近对话历史（可选）")
    max_suggestions: int = Field(3, ge=1, le=5, description="建议数量，默认 3，范围 1-5")

    # ── 结构化领域上下文（全部可选，向后兼容：旧前端不传也能正常工作） ──
    # 设计原则：字段一律宽类型（str | dict[str, Any] | list[str] | None），
    # 由后端 _stringify_context 统一归一化，避免前端结构演进（如药材从文本改为
    # {name,dose,role} 对象数组）时触发 422。所有结构化输入均视同不可信，注入前净化。
    formula_context: str | dict[str, Any] | list[Any] | None = Field(
        None,
        description=(
            "当前配方摘要：药材/食材、克重、君臣佐使角色、制备形式（汤剂/膏方/代茶饮）、"
            "服用周期等。可为纯文本或结构化对象（如 {name, herbs:[{name,dose,role}]}）。"
        ),
    )
    constitution: str | dict[str, Any] | None = Field(
        None,
        description="用户中医体质/证型（如 湿热质、气阴两虚），可为文本或 {constitution_tendency, syndrome_points}。",
    )
    user_constraints: str | dict[str, Any] | list[Any] | None = Field(
        None,
        description="个人约束：过敏原、饮食禁忌、忌口、特殊人群（孕妇/儿童/慢病）等，可为文本或列表。",
    )
    rag_context: list[str] | None = Field(
        None,
        description="命中的 RAG 知识块摘要（与 /chat 的 rag_context 同源，注入前经 _sanitize_rag_chunks 净化）。",
    )
    dialectics_summary: str | dict[str, Any] | None = Field(
        None,
        description="辨证分析结论摘要（体质倾向/证候要点/调理目标/ caution），可为文本或结构化对象。",
    )
    compliance_context: str | dict[str, Any] | None = Field(
        None,
        description="当前配方的合规结论（药食同源目录/十八反十九畏/日用剂量上限等安全评估结果）。",
    )


# LLM 不可用/失败时的固定候选追问（与前端固定问题池对齐）
_FALLBACK_FOLLOW_UP_SUGGESTIONS: list[dict[str, str]] = [
    {"question": "药食同源配方的安全合规检查包含哪些项目？", "category": "安全合规"},
    {"question": "如何判断自己是湿热质还是气虚质？", "category": "体质辨识"},
    {"question": "黄芪和党参配伍有什么协同作用？", "category": "配伍知识"},
]


# ═══════════════════════════════════════════════════════════════
# 追问领域上下文：归一化 / 会话线索提取（提升「不传结构化上下文」时的智能度）
# ═══════════════════════════════════════════════════════════════

# 结构化上下文字段注入 user_content 的字符上限（控成本、防 prompt 膨胀）
_FOLLOWUP_CTX_FIELD_MAX_CHARS = 700
# 会话线索提取时扫描的最近消息条数
_FOLLOWUP_CLUE_SCAN_MESSAGES = 8


def _stringify_context(value: Any, max_chars: int = _FOLLOWUP_CTX_FIELD_MAX_CHARS) -> str:
    """把结构化/文本领域上下文归一化为可安全注入 prompt 的短文本。

    - str/num → 净化文本（防注入 + 折叠空白 + 限长），与 _sanitize_profile 同源清洗；
    - dict/list → 紧凑 JSON（ensure_ascii=False 保留中文可读性），再净化限长；
      序列化失败时降级为 str()，保证永不抛异常。
    用于配方/体质/约束/合规等宽类型字段（前端结构可能演进，后端宽进严出）。
    """
    if value is None:
        return ""
    if isinstance(value, str):
        return _sanitize_profile(value)[:max_chars]
    try:
        text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    except Exception:
        text = str(value)
    return _sanitize_profile(text)[:max_chars]


# 会话线索提取用的目标/症状关键词族（低成本的零 LLM 领域推断）
_FOLLOWUP_GOAL_KEYWORDS: dict[str, list[str]] = {
    "血糖": ["降血糖", "血糖", "糖尿病", "胰岛素", "糖耐量"],
    "睡眠": ["睡眠", "失眠", "入睡", "安神", "多梦"],
    "脾胃": ["脾胃", "消化", "胃胀", "食欲", "大便"],
    "免疫": ["免疫", "易感冒", "抵抗力", "卫外"],
    "血脂": ["血脂", "胆固醇", "甘油三酯", "降脂"],
    "尿酸": ["尿酸", "痛风", "降尿酸"],
    "气血": ["气血", "贫血", "乏力", "气虚", "面色"],
    "湿热": ["湿热", "湿气", "祛湿", "黏腻", "舌苔厚"],
    "肝肾": ["肝肾", "阴虚", "腰膝", "耳鸣", "眼干"],
}


def _extract_session_clues(question: str, answer: str, history: list[dict] | None) -> str:
    """从最近对话自行提取领域线索（配方药材/剂量/调理目标），供 LLM 生成更贴切的追问。

    设计定位：后端兜底增强——即使前端不传结构化上下文，也尽量从已有 session 文本
    推断可用线索，零额外 LLM 调用、零 DB 查询（复用 chat.py 既有正则/名称表），成本极低。
    任何异常静默降级返回空串，绝不阻断追问主流程。
    """
    try:
        # 取最近若干条消息 + 当前问答，拼成待扫描文本（限制长度，控成本）
        parts: list[str] = [question or "", answer or ""]
        if history:
            for h in _truncate_history_by_tokens(history, max_messages=_FOLLOWUP_CLUE_SCAN_MESSAGES):
                parts.append(str(h.get("content") or ""))
        text = "\n".join(p for p in parts if p)[:6000]
        if not text.strip():
            return ""

        clues: list[str] = []

        # 1) 调理目标/症状族：命中即提示 LLM 围绕该目标发问
        for goal, kws in _FOLLOWUP_GOAL_KEYWORDS.items():
            if any(kw in text for kw in kws):
                clues.append(f"调理目标线索：{goal}")

        # 2) 当前配方药材：复用平台内置药食同源名称表，命中即视为「配方中出现的药材」
        found_herbs = [name for name in _COMMON_HERB_NAMES if name in text]
        if found_herbs:
            clues.append("涉及药材/食材：" + "、".join(found_herbs[:8]))

        # 3) 药材克重：复用剂量正则，命中说明回复刚给出具体克重配方，
        #    提示 LLM 可围绕剂量合规/调整发问
        dosage_matches = _DOSAGE_SINGLE_RE.findall(text) or _DOSAGE_RANGE_RE.findall(text)
        if dosage_matches:
            clues.append("回复中包含具体克重配方（可围绕剂量/总量合规追问）")

        return "\n".join(clues)
    except Exception as e:  # noqa: BLE001 - 线索提取失败不影响主流程
        logger.debug(f"[follow-up-suggestions] 会话线索提取失败（忽略）: {e}")
        return ""


_FOLLOW_UP_SYSTEM_PROMPT = """你是药食同源与中医食疗领域的资深配方顾问。你的任务：基于下方提供的「用户问题」「AI 回复」「最近对话历史」与「结构化领域上下文」（当前配方/体质证型/辨证结论/合规结论/个人约束/知识库依据），预判用户接下来最可能追问的真实需求，生成 2-3 个专业追问。

【第一原则：一切追问必须锚定上下文里真实出现的具体信息】
每个问题都要点到具体对象——配方中某味药材的名字、克重、君臣佐使角色，或用户的体质证型/症状/禁忌/西药。禁止输出换成任何配方都成立、或任何用户都适用的通用问题（如「还有什么问题」「如何判断体质」「配伍有什么作用」这类零信息提问一律禁止）。
- 上下文里没有的信息不要凭空捏造前提，但可以就有信息深挖。

【优先深挖维度：每个问题聚焦一个，优先挑当前语境最值得深究的点，不必面面俱到】
1. 剂量合理性：某味药材克重对当前体质/症状是否偏轻偏重、是否贴药食同源每日上限、如何增减；
2. 配伍协同/相畏：君臣佐使角色是否得当、两味协同或相恶、能否加减替换；
3. 禁忌冲突：配方药材是否与用户过敏原/饮食禁忌/特殊人群/正在服用的西药冲突；
4. 体质适配：当前体质证型下的疗程、服用周期、见效指标与随访评估；
5. 制备服用：煎煮 SOP、服用时点、疗程中如何监测效果。

【风格示例（仅供参考风格，严禁照抄文本）】
- 好：「黄芪15g对气阴两虚是否偏温燥、需否减量？」（点具体药材+克重+体质，聚焦剂量）
- 好：「方中麦冬与党参同用，滋阴与补气是否相冲？」（点具体两味+配伍关系）
- 差：「如何判断自己是湿热质？」（与当前配方/体质无关，泛泛，禁止）

【上下文不全时】即使只有配方、缺体质或合规，也要围绕配方本身深挖（剂量/配伍/禁忌/疗程），不退回泛泛；确无任何具体线索时，才围绕用户问题里最具体的症状或目标发问。

【输出】每题不超过 30 字，只返回 JSON，不要任何解释或前后缀：
{"suggestions": [{"question": "问题文本", "category": "分类"}, ...]}
category 取值：配方设计、剂量优化、安全合规、配伍禁忌、个人适配、体质调理、成分机理、服用方法。"""


@router.post("/chat/follow-up-suggestions", summary="根据对话内容动态生成追问问题")
async def follow_up_suggestions(
    req: FollowUpSuggestionsRequest,
    tenant: TenantContext = Depends(require_tenant),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """根据用户问题、AI 回复与对话历史，动态生成「可以继续追问」的问题建议。

    - LLM 可用：动态生成（source=llm）
    - LLM 不可用或调用失败/超时：返回固定候选（source=fallback），不返回 5xx
    """
    # 未登录直接 401（与 /chat 保持一致）
    if current_user is None:
        raise HTTPException(status_code=401, detail="请先登录后再使用 AI 对话")

    # 组织计划 AI 配额检查（超限 403，与 /chat 一致）
    try:
        from ...core.multi_tenant.multi_tenant_service import ensure_ai_quota
        await ensure_ai_quota(db, current_user.id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    # ── Rate Limit 检查（租户级，与 /chat/stream 一致） ──
    limiter = get_ai_rate_limiter()
    allowed, error_msg = await limiter.check_request(tenant.org_id)
    if not allowed:
        logger.warning(f"[follow-up-suggestions] 组织 {tenant.org_id} 触发限流: {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "RATE_LIMIT_EXCEEDED",
                "message": error_msg,
                "retry_after": 60,
            },
            headers={"Retry-After": "60"},
        )

    # 解析用户实际可用的 LLM 服务：优先用户级密钥，未配置则回退到全局 llm_service
    user_llm = await _get_user_llm(current_user.id)
    llm = user_llm if user_llm is not None else _get_llm_service()

    if not llm.is_available:
        logger.info("[follow-up-suggestions] LLM 服务不可用，返回固定候选（fallback）")
        return {
            "success": True,
            "source": "fallback",
            "suggestions": _FALLBACK_FOLLOW_UP_SUGGESTIONS[:req.max_suggestions],
        }

    try:
        # 防御：question 为空时尝试从 history 取最后一条 user 消息；仍为空则返回 fallback
        question = req.question.strip()
        if not question and req.history:
            for h in reversed(req.history):
                if str(h.get("role") or "") == "user":
                    candidate = str(h.get("content") or "").strip()
                    if candidate:
                        question = candidate
                        break
        if not question:
            logger.info("[follow-up-suggestions] question 为空（无用户消息），返回固定候选（fallback）")
            return {
                "success": True,
                "source": "fallback",
                "suggestions": _FALLBACK_FOLLOW_UP_SUGGESTIONS[:req.max_suggestions],
            }

        # 防御：answer 为空时尝试从 history 取最后一条 assistant 回复；仍为空则返回 fallback
        answer = req.answer.strip()
        if not answer and req.history:
            for h in reversed(req.history):
                if str(h.get("role") or "") == "assistant":
                    candidate = str(h.get("content") or "").strip()
                    if candidate:
                        answer = candidate
                        break
        if not answer:
            logger.info("[follow-up-suggestions] answer 为空（AI 尚未回复），返回固定候选（fallback）")
            return {
                "success": True,
                "source": "fallback",
                "suggestions": _FALLBACK_FOLLOW_UP_SUGGESTIONS[:req.max_suggestions],
            }

        # 构造 user prompt：包含用户问题、AI 回复与最近对话历史
        history_text = ""
        if req.history:
            lines = []
            for h in _truncate_history_by_tokens(req.history):
                role = "用户" if str(h.get("role") or "") == "user" else "助手"
                lines.append(f"{role}: {h.get('content')}")
            if lines:
                history_text = "\n".join(lines) + "\n"

        user_content = (
            f"【用户问题】\n{question}\n\n"
            f"【AI 回复】\n{answer}\n\n"
        )
        if history_text:
            user_content += f"【最近对话历史】\n{history_text}\n"

        # ── 结构化领域上下文（前端传入则注入，全部经 _stringify_context 净化限长） ──
        # 把辨证/配方/合规/约束/RAG 等真实领域语境带给 LLM，使追问紧扣当前需求而非泛泛而谈。
        ctx_blocks: list[str] = []
        for label, raw in (
            ("当前辨证结论", getattr(req, "dialectics_summary", None)),
            ("用户体质/证型", getattr(req, "constitution", None)),
            ("当前配方", getattr(req, "formula_context", None)),
            ("当前配方合规结论", getattr(req, "compliance_context", None)),
            ("个人约束（过敏原/禁忌/特殊人群）", getattr(req, "user_constraints", None)),
        ):
            text = _stringify_context(raw)
            if text:
                ctx_blocks.append(f"- {label}：{text}")

        sanitized_rag = _sanitize_rag_chunks(getattr(req, "rag_context", None))
        if sanitized_rag:
            ctx_blocks.append(
                "- 命中的知识库依据：" + "；".join(sanitized_rag)
            )

        if ctx_blocks:
            user_content += (
                "【结构化领域上下文】（追问请紧扣以下真实语境）\n"
                + "\n".join(ctx_blocks) + "\n\n"
            )
        else:
            # 后端兜底增强：前端未传结构化上下文时，从最近对话自行提取领域线索，
            # 仍让 LLM 能围绕具体药材/目标/剂量发问（零额外 LLM/DB 成本）。
            clue_text = _extract_session_clues(question, answer, req.history)
            if clue_text:
                user_content += (
                    "【会话领域线索（系统自动提取）】\n"
                    + "\n".join(f"- {line}" for line in clue_text.split("\n") if line)
                    + "\n\n"
                )

        user_content += (
            f"请基于以上用户当前辨证/配方/合规/约束语境，生成 {req.max_suggestions} 个"
            "用户最可能继续追问的问题：优先围绕当前配方的药材配伍、剂量调整、合规风险、"
            "个人禁忌、体质调理与服用方法等真实需求，避免泛泛而谈；每个问题不超过 30 字，"
            "只返回 JSON。"
        )

        messages = [
            LLMMessage(role="system", content=_FOLLOW_UP_SYSTEM_PROMPT),
            LLMMessage(role="user", content=user_content),
        ]

        # 超时保护，防止上游 LLM 挂起拖垮接口。
        # 根因（2026-11-09 实测取证）：原 timeout=12 是 follow-up 长期走兜底固定池的
        # 唯一高频根因。实测上游 agnes-3.0-flash 一次 chat_with_json 稳定耗时 15~22s
        # （对照普通 chat() 也要 15.27s），远超 12s → 必然 asyncio.TimeoutError → 走 fallback，
        # 而 LLM 本身 is_available=True、返回的是合法 JSON，调用链无任何其他故障。
        # 故放宽到 30s（前端 followUpSuggestionApi 动态超时需同步 ≥ 35s，否则前端先掐断）。
        data = await asyncio.wait_for(llm.chat_with_json(messages), timeout=30)

        raw_suggestions = data.get("suggestions") if isinstance(data, dict) else None
        if not isinstance(raw_suggestions, list):
            raise ValueError("LLM 返回缺少 suggestions 列表")

        suggestions: list[dict[str, str]] = []
        for item in raw_suggestions:
            if not isinstance(item, dict):
                continue
            question = str(item.get("question") or "").strip()
            category = str(item.get("category") or "").strip() or "追问建议"
            if not question:
                continue
            suggestions.append({"question": question, "category": category})
            if len(suggestions) >= req.max_suggestions:
                break

        if not suggestions:
            logger.warning("[follow-up-suggestions] LLM 返回的建议为空，使用固定候选")
            return {
                "success": True,
                "source": "fallback",
                "suggestions": _FALLBACK_FOLLOW_UP_SUGGESTIONS[:req.max_suggestions],
            }

        logger.info("[follow-up-suggestions] LLM 动态生成 %d 条追问建议", len(suggestions))
        return {"success": True, "source": "llm", "suggestions": suggestions}

    except asyncio.TimeoutError:
        logger.warning("[follow-up-suggestions] LLM 调用超时（30s），使用固定候选")
    except Exception as e:
        logger.warning(f"[follow-up-suggestions] LLM 调用失败，使用固定候选: {e}")

    return {
        "success": True,
        "source": "fallback",
        "suggestions": _FALLBACK_FOLLOW_UP_SUGGESTIONS[:req.max_suggestions],
    }







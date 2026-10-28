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
from ...services.ai.shared.observability import ai_observability
from ...services.ai.shared.response_cache import ai_cache


def _repair_truncated_json(content: str) -> str:
    """修复被截断的配方卡 JSON（以 ```json 开头但未闭合/括号不平衡）。

    场景：LLM 流式输出提前停止，内容以 ```json 开头但缺少闭合 ```，
    且 JSON 因中途截断而括号不平衡。
    本函数通过「补全未闭合字符串 + 逆序闭合未配对括号」恢复为可解析的 JSON 代码块；
    无法安全修复时原样返回，交由前端兜底处理。
    """
    stripped = content.lstrip()
    if not stripped.startswith("```json"):
        return content
    opening = content.find("```json")
    json_start = content.find("{", opening)
    if json_start < 0:
        return content
    # 已存在闭合代码块 → 无需修复
    first_close = content.find("```", opening + 7)
    if first_close >= 0 and first_close > json_start:
        return content

    prefix = content[json_start:]
    stack: list[str] = []
    in_string = False
    escaped = False
    for ch in prefix:
        if in_string:
            if escaped:
                escaped = False
                continue
            if ch == "\\":
                escaped = True
                continue
            if ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch in "{[":
            stack.append(ch)
        elif ch in "}]":
            open_ch = "{" if ch == "}" else "["
            if stack and stack[-1] == open_ch:
                stack.pop()
            else:
                return content  # 括号不匹配，无法安全修复

    repaired = prefix
    if in_string:
        repaired += '"'
    repaired = repaired.rstrip()
    repaired = repaired.rstrip(",").rstrip()
    closers = "".join("}" if o == "{" else "]" for o in reversed(stack))
    repaired += closers
    try:
        json.loads(repaired)
    except Exception:
        return content
    return content[:json_start] + repaired + "\n```"


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


# ── LLM 超时配置（秒）──
# 首包超时：连接建立后等待「首个内容分片」的最长时间，用于快速识别上游挂起（60s）；
# 总超时：整个流式响应的总时长上限（含首包等待），必须 < 前端 STREAM_TIMEOUT_MS=240s。
# 2026-10-28：总超时 170s → 200s——前端 STREAM_TIMEOUT_MS 已联动上调 180s→240s
# （frontend/src/constants/businessRules.ts:22），200s < 240s，保留 40s 裕量，吸收
# agnes-3.0-flash 偶发 >150s 甚至 >180s 的长尾（P1-6 平台库增强后 prompt 更长）。
# 首包超时保持 60s 不变（仅检测上游挂起）。
# 非流式 /chat 使用与流式对齐的总超时，避免降级后反而更早失败。
LLM_STREAM_FIRST_TOKEN_TIMEOUT = 60
LLM_STREAM_TOTAL_TIMEOUT = 200
LLM_NON_STREAM_TIMEOUT = 200


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

# 内置常用药食同源原料安全剂量范围（g/天），参考《中国药典》2020年版及2023版目录。
# 覆盖114种药食同源目录中的常见药材；未覆盖的药材不阻断对话但无单味校验。
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
    herb_doses: dict[str, float] = {}
    for m in matches:
        groups = m.groups()
        if len(groups) == 3:
            herb = (groups[0] or groups[2] or "").strip()
            dosage = float(groups[2] or groups[1])
        else:
            herb = (groups[0] or groups[1] or "").strip()
            dosage = float(groups[1] or groups[0])
        herb = (herb or "").strip()
        if herb and dosage > 0:
            herb_doses[herb] = herb_doses.get(herb, 0.0) + dosage

    total_dose = sum(herb_doses.values())
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
    if rag_context and len(rag_context) > 0:
        # 合并前端 RAG 结果
        rag_lines = [f"- {chunk}" for chunk in rag_context[:5]]
        knowledge_block = (
            "\n\n【用户知识库参考】（来自用户上传文档的检索结果，可作为配方设计的依据；"
            "若与平台知识库冲突，以药食同源安全规范为准）\n"
            + "\n".join(rag_lines)
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
) -> None:
    """回写对话记录到数据库（会话 + 消息），按 bot_id 隔离持续会话。"""
    try:
        import datetime as _dt

        from ...models.chat import ChatMessage, ChatSession
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
        cache_key = (
            f"user:{current_user.id}:q:{question_hash}:ctx:{history_hash}{bot_cache_tag}{scenario_cache_tag}"
            if user_llm is not None
            else f"org:{tenant.org_id or 1}:q:{question_hash}:ctx:{history_hash}{bot_cache_tag}{scenario_cache_tag}"
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

        scenario_mode = getattr(req, "scenario_mode", "formula_design") or "formula_design"
        # DS Bot 移植：若指定 bot_id，以 Bot 的人设+记忆替代默认场景 prompt，并应用模型覆盖
        # 注：平台 JWT 可能不携带 org_id（global 模式），Bot 默认租户为 1
        bot_ctx = await _resolve_bot_chat_context(
            db, getattr(req, "bot_id", None), current_user.id, tenant.org_id or 1,
        )
        if bot_ctx is not None:
            system_prompt, model_override, temperature_override = bot_ctx
        else:
            system_prompt = await _build_system_prompt(
                scenario_mode,
                getattr(req, "user_profile_context", None),
                question=req.question,
                db=db,
                rag_context=getattr(req, "rag_context", None),
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

        # 回写对话记录到数据库（按 bot_id 隔离持续会话；持久化最终脱敏+警示后的内容）
        await _persist_chat_record(
            db, current_user.id, req.question, answer,
            bot_id=getattr(req, "bot_id", None), title=req.question[:50],
        )

        # 构建返回结果（匹配前端 AIResponse 接口）
        # 主路径使用直接 LLM 调用，无 thinking_steps；LLM 不可用时由下方降级路径产出
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
                # 明示降级来源：此前此处静默替换为规则引擎，用户完全无感知，
                # 是流式模式的「冒充专家」缺口。现显式标注 model 供前端展示徽标。
                yield _format_sse_event("meta", {"model": "rule-engine-fallback", "reason": "LLM 服务未配置或不可用"})
                async for chunk in thinking_engine.generate_thinking_stream(req.question):
                    yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
            return StreamingResponse(thinking_stream(), media_type="text/event-stream")

        scenario_mode = getattr(req, "scenario_mode", "formula_design") or "formula_design"
        # DS Bot 移植：若指定 bot_id，以 Bot 的人设+记忆替代默认场景 prompt，并应用模型覆盖
        # 注：平台 JWT 可能不携带 org_id（global 模式），Bot 默认租户为 1
        bot_ctx = await _resolve_bot_chat_context(
            db, getattr(req, "bot_id", None), current_user.id, tenant.org_id or 1,
        )
        if bot_ctx is not None:
            system_prompt, model_override, temperature_override = bot_ctx
        else:
            system_prompt = await _build_system_prompt(
                scenario_mode,
                getattr(req, "user_profile_context", None),
                question=req.question,
                db=db,
                rag_context=getattr(req, "rag_context", None),
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
                llm_queue: asyncio.Queue = asyncio.Queue()

                async def _consume_llm_stream():
                    """后台消费 LLM 流：首包超时（60s）+ 总超时（150s，含首包）保护。"""
                    start_ts = time.monotonic()
                    stream = None
                    try:
                        stream = llm.chat_stream(
                            messages, model=model_override, temperature=temperature_override,
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
                            async for chunk in stream:
                                if chunk:
                                    await llm_queue.put(("chunk", chunk))
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
                        yield _format_sse_event("dialectics", dialectics)
                    except (asyncio.TimeoutError, Exception) as d_exc:
                        logger.warning(f"[chat_stream] 辨证分析跳过（超时或失败）: {d_exc}")
                        if dialectics_task and not dialectics_task.done():
                            dialectics_task.cancel()

                try:
                    while True:
                        msg_type, msg_data = await llm_queue.get()
                        if msg_type == "eof":
                            break
                        if msg_type == "ping":
                            yield _format_sse_event("ping", {})
                        elif msg_type == "chunk":
                            full_answer += msg_data
                            yield _format_sse_event("content", {"content": msg_data})
                        elif msg_type == "error":
                            yield _format_sse_event("error", {"message": msg_data, "error": "STREAM_ERROR"})
                            break
                finally:
                    _hb_task.cancel()
                    if not _llm_task.done():
                        _llm_task.cancel()

                # 输出完整性修复：LLM 提前停止导致 JSON 代码块未闭合时，
                # 自动补全后把差异补发到前端（用户无需刷新即可看到完整配方卡），
                # 并持久化修复后的完整内容。
                raw_answer = full_answer
                full_answer = _repair_truncated_json(full_answer)
                if len(full_answer) > len(raw_answer):
                    yield _format_sse_event("content", {"content": full_answer[len(raw_answer):]})

                # P0-2: 流式结束后对完整内容做输出安全检查，不安全的回复追加提示
                safety_patch = ""
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
                except Exception as exc:
                    logger.warning("[chat_stream] 输出安全检查失败（忽略）: %s", exc)

                # P0-3: 轻量级剂量预校验，超标警示作为追加内容在 done 前输出
                try:
                    enriched = await _append_dosage_warnings(full_answer, db=db)
                    if len(enriched) > len(full_answer):
                        safety_patch += enriched[len(full_answer):]
                except Exception as exc:
                    logger.warning("[chat_stream] 剂量预校验失败（忽略）: %s", exc)

                if safety_patch:
                    yield _format_sse_event("content", {"content": safety_patch})

                # 流式完成后追加元数据步骤，供前端 ReasoningRow 显示"生成回答"状态
                yield _format_sse_event("step", {
                    "step": "生成回答",
                    "content": f"完成 ({len(full_answer)} 字符)",
                    "status": "complete",
                })
                yield "data: [DONE]\n\n"
                # 流式对话写回会话历史（含 Bot 持续会话）
                try:
                    await _persist_chat_record(
                        db, current_user.id, req.question, full_answer,
                        bot_id=getattr(req, "bot_id", None), title=req.question[:50],
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
                elif "429" in error_msg or "频率限制" in error_msg:
                    error_data = {
                        "error": "RATE_LIMITED",
                        "message": "请求过于频繁，请稍后重试",
                        "retry_after": 30
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


# ═══════════════════════════════════════════════════════════════
# 动态追问问题建议（根据对话内容调用 LLM 生成）
# ═══════════════════════════════════════════════════════════════

class FollowUpSuggestionsRequest(BaseModel):
    """根据对话内容动态生成追问问题的请求"""
    question: str = Field(..., min_length=1, max_length=8000, description="用户最近的一个问题")
    # 允许 answer 为空：AI 可能尚未产生回复（前端在 AI 回复完成前不应调用，但后端需防御空值）
    answer: str = Field("", max_length=16000, description="AI 最后一条回复内容（可空，空时尝试从 history 取最后一条 assistant 回复）")
    history: list[dict[str, Any]] | None = Field(None, description="最近对话历史（可选）")
    max_suggestions: int = Field(3, ge=1, le=5, description="建议数量，默认 3，范围 1-5")


# LLM 不可用/失败时的固定候选追问（与前端固定问题池对齐）
_FALLBACK_FOLLOW_UP_SUGGESTIONS: list[dict[str, str]] = [
    {"question": "药食同源配方的安全合规检查包含哪些项目？", "category": "安全合规"},
    {"question": "如何判断自己是湿热质还是气虚质？", "category": "体质辨识"},
    {"question": "黄芪和党参配伍有什么协同作用？", "category": "配伍知识"},
]


_FOLLOW_UP_SYSTEM_PROMPT = """你是药食同源与中医食疗领域的专家助手，擅长从对话中挖掘用户可能继续追问的方向。

任务：根据给定的「用户问题」「AI 回复」和「最近对话历史」，生成用户最可能继续追问的 2-3 个问题。

要求：
1. 问题必须贴合对话内容，具体、有信息量，禁止出现「还有其他问题吗」「还有什么可以帮您」这类泛泛而谈。
2. 尽量覆盖不同角度（成分机理、使用方法、注意事项、适用人群、配伍禁忌、安全合规等）。
3. 每个问题不超过 30 字。
4. 只返回 JSON，不要输出任何解释或前后缀文字，格式如下：
{"suggestions": [{"question": "问题文本", "category": "分类"}, ...]}

category 取值参考：配方设计、安全合规、配伍知识、成分知识、体质辨识、药材知识。"""


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
            f"【用户问题】\n{req.question}\n\n"
            f"【AI 回复】\n{answer}\n\n"
        )
        if history_text:
            user_content += f"【最近对话历史】\n{history_text}\n"
        user_content += (
            f"请根据以上内容生成 {req.max_suggestions} 个用户最可能继续追问的问题，"
            "覆盖不同角度，每个问题不超过 30 字，只返回 JSON。"
        )

        messages = [
            LLMMessage(role="system", content=_FOLLOW_UP_SYSTEM_PROMPT),
            LLMMessage(role="user", content=user_content),
        ]

        # 12s 超时保护，防止上游 LLM 挂起拖垮接口
        data = await asyncio.wait_for(llm.chat_with_json(messages), timeout=12)

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
        logger.warning("[follow-up-suggestions] LLM 调用超时（12s），使用固定候选")
    except Exception as e:
        logger.warning(f"[follow-up-suggestions] LLM 调用失败，使用固定候选: {e}")

    return {
        "success": True,
        "source": "fallback",
        "suggestions": _FALLBACK_FOLLOW_UP_SUGGESTIONS[:req.max_suggestions],
    }







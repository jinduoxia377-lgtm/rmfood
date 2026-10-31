"""
SSE 事件标准协议 - 统一 AI 对话流式响应格式

设计原则:
1. 所有 SSE 事件必须使用 event: 前缀 (RFC 3870 标准)
2. 事件类型固定，前端无需 fallback 映射
3. 思考步骤与内容分离，便于前端独立渲染
4. 错误信息结构化，支持前端统一处理

协议规范（与 backend/app/api/ai_modules/chat.py event_stream() 实际发出的事件对齐）:
┌─────────────────────────────────────────────────────┐
│ event: meta                                        │
│ data: {"model": "gpt-4o", "reason": "..."}          │
│                                                       │
│ event: dialectics                                │
│ data: {"engine": "...", "urgent": false, ...}       │
│                                                       │
│ event: progress                                   │
│ data: {"stage": "generating", "percent": 60, "chars": 120} │
│                                                       │
│ event: step                                       │
│ data: {"step": "生成回答", "content": "...", "status": "complete"} │
│                                                       │
│ event: content                                    │
│ data: {"content": " streamed content..."}          │
│                                                       │
│ event: ping                                        │
│ data: {}                                           │
│                                                       │
│ event: error                                        │
│ data: {"message": "错误描述"}                        │
│                                                       │
│ event: done                                         │
│ data: {}                                             │
└─────────────────────────────────────────────────────┘

结束约定:
- 成功路径以 `data: [DONE]` 收尾（不发送 event: done）
- 错误路径以 `event: error` + `event: done` 收尾

@version 1.1.0
@created 2026-09-21
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from enum import Enum
from typing import Any, AsyncIterator, Optional

logger = logging.getLogger(__name__)


class SSEEventType(str, Enum):
    """SSE 事件类型枚举（与 chat.py /chat/stream 实际发出的事件对齐）

    实际事件：meta / dialectics / step / progress / content / ping / error / done。

    结束约定：
    - 成功路径以 `data: [DONE]` 收尾（不发送 event: done）
    - 错误路径以 `event: error` + `event: done` 收尾
    """
    # 实际事件（与 chat.py event_stream() 对齐）
    META = "meta"
    DIALECTICS = "dialectics"
    STEP = "step"
    PROGRESS = "progress"
    CONTENT = "content"
    PING = "ping"
    ERROR = "error"
    DONE = "done"
    # 兼容旧协议 / 其他端点的历史事件
    THINKING_STEP = "thinking_step"
    FORMULA = "formula"


@dataclass
class SSEEvent:
    """
    SSE 事件标准结构

    Attributes:
        event_type: 事件类型 (SSEEventType)
        data: 事件数据 (dict)
        id: 可选事件 ID (用于 EventSource 重连)
    """
    event_type: SSEEventType
    data: dict[str, Any]
    id: Optional[str] = None

    def format(self) -> str:
        """
        格式化为 RFC 3870 兼容的 SSE 文本

        Returns:
            SSE 格式字符串，以双换行符结尾
        """
        lines = []
        if self.id:
            lines.append(f"id: {self.id}")
        lines.append(f"event: {self.event_type.value}")
        lines.append(f"data: {json.dumps(self.data, ensure_ascii=False)}")
        lines.append("")  # 空行分隔（SSE 标准要求）
        return "\n".join(lines)

    def __str__(self) -> str:
        return self.format()

    def __bytes__(self) -> bytes:
        return self.format().encode("utf-8")


# ═══════════════════════════════════════════════════════════
# 便捷构造函数
# ═══════════════════════════════════════════════════════════


def thinking_step_event(
    step: str,
    content: str,
    status: str = "processing",
    detail: str = "",
    formula_data: Optional[dict] = None,
    event_id: Optional[str] = None,
) -> SSEEvent:
    """
    创建思考步骤事件

    Args:
        step: 步骤名称 (如 "问题理解", "知识检索")
        content: 步骤描述内容
        status: 状态 ("processing" | "complete")
        detail: 详细推理说明（可折叠）
        formula_data: 配方数据结构（仅配方设计步骤）
        event_id: 可选事件 ID

    Returns:
        SSEEvent 实例
    """
    data: dict[str, Any] = {
        "step": step,
        "content": content,
        "status": status,
    }
    if detail:
        data["detail"] = detail
    if formula_data:
        data["formula_data"] = formula_data
    return SSEEvent(SSEEventType.THINKING_STEP, data, id=event_id)


def content_event(content: str, event_id: Optional[str] = None) -> SSEEvent:
    """创建内容事件"""
    return SSEEvent(SSEEventType.CONTENT, {"content": content}, id=event_id)


def formula_event(
    name: str,
    value: float,
    unit: str = "克",
    confidence: Optional[float] = None,
    event_id: Optional[str] = None,
) -> SSEEvent:
    """创建配方事件"""
    data: dict[str, Any] = {"name": name, "value": value, "unit": unit}
    if confidence is not None:
        data["confidence"] = confidence
    return SSEEvent(SSEEventType.FORMULA, data, id=event_id)


def done_event(event_id: Optional[str] = None) -> SSEEvent:
    """创建完成事件"""
    return SSEEvent(SSEEventType.DONE, {}, id=event_id)


def error_event(
    message: str,
    code: Optional[str] = None,
    suggestion: Optional[str] = None,
    event_id: Optional[str] = None,
) -> SSEEvent:
    """创建错误事件"""
    data: dict[str, Any] = {"message": message}
    if code:
        data["code"] = code
    if suggestion:
        data["suggestion"] = suggestion
    return SSEEvent(SSEEventType.ERROR, data, id=event_id)


# ═══════════════════════════════════════════════════════════
# SSE 生成器辅助函数
# ═══════════════════════════════════════════════════════════


async def sse_yield(event: SSEEvent) -> None:
    """
    异步 Yield SSE 事件（用于 async generator）

    在 FastAPI StreamingResponse 中使用:
        async def event_stream():
            yield str(sse_yield(thinking_step_event(...)))
    """
    yield str(event)


async def sse_stream(
    events: AsyncIterator[SSEEvent],
) -> AsyncIterator[str]:
    """
    将 SSE 事件流转换为字符串流

    Usage:
        @router.post("/chat/stream")
        async def chat_stream():
            return StreamingResponse(
                sse_stream(my_event_generator()),
                media_type="text/event-stream"
            )
    """
    async for event in events:
        yield str(event)


# ═══════════════════════════════════════════════════════════
# 前端兼容层（移除旧格式 fallback）
# ═══════════════════════════════════════════════════════════


def parse_sse_line(line: str) -> tuple[str, dict] | None:
    """
    解析单行 SSE 数据（供测试和调试使用）

    Returns:
        (event_type, data) 或 None（如果是注释行或空行）
    """
    line = line.strip()
    if not line or line.startswith(":"):
        return None
    if line.startswith("event:"):
        return ("event_type", {"type": line[6:].strip()})
    if line.startswith("data:"):
        try:
            return ("data", json.loads(line[5:].strip()))
        except json.JSONDecodeError:
            return ("data", {"raw": line[5:].strip()})
    return None


# ═══════════════════════════════════════════════════════════
# 全局常量（供前端对齐）
# ═══════════════════════════════════════════════════════════

SSE_EVENT_TYPES = [e.value for e in SSEEventType]
"""所有合法的事件类型列表，供前端校验使用"""

__all__ = [
    "SSEEventType",
    "SSEEvent",
    "thinking_step_event",
    "content_event",
    "formula_event",
    "done_event",
    "error_event",
    "sse_yield",
    "sse_stream",
    "parse_sse_line",
    "SSE_EVENT_TYPES",
]

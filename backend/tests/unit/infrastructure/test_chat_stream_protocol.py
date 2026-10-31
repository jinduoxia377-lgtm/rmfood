"""
SSE 流式协议测试

覆盖：
1. `SSEEventType` / `SSE_EVENT_TYPES` 与 chat.py event_stream() 实际发出的事件对齐
   （meta / dialectics / step / progress / content / ping / error / done + data: [DONE]）。
2. `_format_sse_event` 输出格式（event: / data: 双换行）。
3. 规则引擎降级路径（LLM 不可用）的 SSE 事件序列包含 meta、progress、[DONE]。

说明：/api/v1/ai/chat/stream 依赖认证/DB/租户上下文，集成测试通过依赖覆盖
+ monkeypatch 走「LLM 不可用 → 规则引擎降级」路径，无需真实 LLM / 数据库。
"""
import json

import pytest
from fastapi.testclient import TestClient
from types import SimpleNamespace
from unittest.mock import MagicMock


def _parse_sse_events(raw: str) -> list[tuple[str | None, object]]:
    """将原始 SSE 文本解析为 (event_type, data) 列表。

    - event 行累加到当前 event_type（data: [DONE] 前没有 event 行，event_type 为 None）
    - data 行为 JSON 时解析为 dict，否则保留原始字符串（如 "[DONE]"）
    """
    events: list[tuple[str | None, object]] = []
    current_event: str | None = None
    for line in raw.splitlines():
        if line == "":
            # SSE 事件以空行分隔：下一个 data 不再继承上一个 event 类型
            current_event = None
        elif line.startswith("event:"):
            current_event = line[len("event:"):].strip()
        elif line.startswith("data:"):
            payload = line[len("data:"):].strip()
            if payload == "[DONE]":
                events.append((current_event, "[DONE]"))
            else:
                try:
                    events.append((current_event, json.loads(payload)))
                except json.JSONDecodeError:
                    events.append((current_event, payload))
    return events


class TestSSEEventTypeProtocol:
    """SSEEventType / SSE_EVENT_TYPES 应与 chat.py 实际事件对齐"""

    def test_sse_event_types_include_actual_chat_events(self):
        from app.services.ai.sse_events import SSE_EVENT_TYPES

        event_values = set(SSE_EVENT_TYPES)
        # chat.py event_stream() 实际发出的 event 类型（[DONE] 是 data 标记，不是 event）
        for expected in ("meta", "dialectics", "step", "progress", "content", "ping", "error", "done"):
            assert expected in event_values, f"SSE_EVENT_TYPES 缺少实际事件 {expected}"

    def test_sse_event_types_unique(self):
        from app.services.ai.sse_events import SSEEventType

        values = [e.value for e in SSEEventType]
        assert len(values) == len(set(values))

    def test_sse_event_type_members_align_with_list(self):
        from app.services.ai.sse_events import SSEEventType, SSE_EVENT_TYPES

        assert SSE_EVENT_TYPES == [e.value for e in SSEEventType]


class TestSSEStreamFormat:
    """SSE 事件文本格式"""

    def test_format_sse_event_roundtrip(self):
        from app.api.ai_modules.chat import _format_sse_event

        raw = _format_sse_event("meta", {"model": "rule-engine-fallback"})
        assert raw.startswith("event: meta\n")
        assert raw.endswith("\n\n")
        assert '"model": "rule-engine-fallback"' in raw

    def test_rule_engine_fallback_stream_sequence(self):
        """规则引擎降级流：meta → progress → data 内容 → [DONE]"""
        from app.api.ai_modules.chat import _format_sse_event

        stream_parts = [
            _format_sse_event("meta", {"model": "rule-engine-fallback", "reason": "LLM 服务未配置或不可用"}),
            _format_sse_event("progress", {"stage": "preparing", "percent": 0}),
            _format_sse_event("progress", {"stage": "rag_retrieving", "percent": 10}),
            _format_sse_event("progress", {"stage": "llm_start", "percent": 45}),
            'data: {"type": "content", "content": "规则引擎回复"}\n\n',
            _format_sse_event("progress", {"stage": "done", "percent": 100}),
            "data: [DONE]\n\n",
        ]
        events = _parse_sse_events("".join(stream_parts))
        types = [e[0] for e in events]

        assert types[0] == "meta"
        assert "progress" in types
        # 成功路径以 data: [DONE] 收尾（无 event: done）
        assert events[-1] == (None, "[DONE]")


class _StubLLMService:
    """LLM 不可用桩：is_available=False 触发规则引擎降级路径"""

    is_available = False
    config = SimpleNamespace(
        provider="test-provider",
        model="test-model",
        base_url="http://test",
        api_key=None,
        key_from_db=False,
    )


class _StubThinkingEngine:
    """快速规则引擎桩：避免真实 thinking_engine 的内部延时"""

    async def generate_thinking_stream(self, question: str):
        yield {"type": "thinking", "step": "问题理解", "status": "complete", "content": "测试步骤"}
        yield {"type": "content", "content": "规则引擎降级回复"}


@pytest.mark.usefixtures("app")
class TestChatStreamEndpointSSE:
    """/api/v1/ai/chat/stream 规则引擎降级路径的 SSE 事件序列"""

    def test_stream_contains_meta_progress_and_done_marker(self, app, monkeypatch):
        from app.api.deps import get_db_session
        from app.api.ai_modules import chat as chat_module
        import app.core.multi_tenant.multi_tenant_service as mts
        # 注意：app/services/__init__.py 中 `from .thinking_engine import thinking_engine`
        # 会把 app.services.thinking_engine 包属性从「模块」覆盖为「ThinkingEngine 实例」，
        # 因此 `import app.services.thinking_engine as x` 拿到的是实例而非模块。
        # 必须用 importlib 从 sys.modules 取真实模块后再 patch 其 thinking_engine 属性。
        import importlib
        thinking_engine_module = importlib.import_module("app.services.thinking_engine")

        # 数据库会话依赖 → mock（不连真实 DB）
        async def _mock_db():
            yield MagicMock()

        app.dependency_overrides[get_db_session] = _mock_db

        # LLM 不可用 + 无用户级密钥 → 走规则引擎降级路径
        monkeypatch.setattr(chat_module, "_get_llm_service", lambda: _StubLLMService())

        async def _no_user_llm(user_id: int):
            return None

        monkeypatch.setattr(chat_module, "_get_user_llm", _no_user_llm)

        # 配额检查降级为 no-op（避免查询真实组织计划）
        async def _noop_quota(db, user_id: int):
            return None

        monkeypatch.setattr(mts, "ensure_ai_quota", _noop_quota)

        # 规则引擎替换为无延时桩
        monkeypatch.setattr(thinking_engine_module, "thinking_engine", _StubThinkingEngine())

        client = TestClient(app)
        response = client.post(
            "/api/v1/ai/chat/stream",
            json={"question": "高血压适合喝什么茶？", "stream": True},
        )

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")

        events = _parse_sse_events(response.text)
        types = [e[0] for e in events]

        # 事件序列包含 meta 与 progress（至少出现）
        assert types[0] == "meta"
        assert "progress" in types
        # 成功结束标记 data: [DONE]
        assert events[-1] == (None, "[DONE]")
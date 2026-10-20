"""
Unit tests for app.core.tracing module.

Covers:
- LightweightSpan: creation, attributes, status, duration, to_dict
- LightweightTracer: start_span context manager, exception handling, nesting
- trace_function: decorator for sync functions
"""
import time

import pytest

from app.core.observability.tracing import LightweightSpan, LightweightTracer, trace_function


# ────────────────────────────────────────────
# LightweightSpan
# ────────────────────────────────────────────


class TestLightweightSpan:
    """LightweightSpan is a minimal trace span with attributes and duration."""

    def test_creates_with_name(self):
        span = LightweightSpan("test_op")
        assert span.name == "test_op"

    def test_generates_trace_id(self):
        span = LightweightSpan("test_op")
        assert span.trace_id is not None
        assert len(span.trace_id) == 16

    def test_generates_span_id(self):
        span = LightweightSpan("test_op")
        assert span.span_id is not None
        assert len(span.span_id) == 8

    def test_no_parent_by_default(self):
        span = LightweightSpan("test_op")
        assert span.parent_id is None

    def test_child_span_inherits_trace_id(self):
        parent = LightweightSpan("parent")
        child = LightweightSpan("child", parent=parent)
        assert child.trace_id == parent.trace_id

    def test_child_span_has_parent_id(self):
        parent = LightweightSpan("parent")
        child = LightweightSpan("child", parent=parent)
        assert child.parent_id == parent.span_id

    def test_child_span_has_own_span_id(self):
        parent = LightweightSpan("parent")
        child = LightweightSpan("child", parent=parent)
        assert child.span_id != parent.span_id

    def test_default_status_is_ok(self):
        span = LightweightSpan("test_op")
        assert span.status == "OK"

    def test_set_attribute(self):
        span = LightweightSpan("test_op")
        span.set_attribute("key", "value")
        assert span.attributes["key"] == "value"

    def test_set_multiple_attributes(self):
        span = LightweightSpan("test_op")
        span.set_attribute("http.method", "GET")
        span.set_attribute("http.status", 200)
        assert span.attributes["http.method"] == "GET"
        assert span.attributes["http.status"] == 200

    def test_set_attribute_overwrites(self):
        span = LightweightSpan("test_op")
        span.set_attribute("key", "first")
        span.set_attribute("key", "second")
        assert span.attributes["key"] == "second"

    def test_set_status(self):
        span = LightweightSpan("test_op")
        span.set_status("ERROR")
        assert span.status == "ERROR"

    def test_end_sets_end_time(self):
        span = LightweightSpan("test_op")
        assert span.end_time is None
        span.end()
        assert span.end_time is not None
        assert span.end_time >= span.start_time

    def test_duration_ms_before_end(self):
        span = LightweightSpan("test_op")
        # duration_ms uses time.time() when end_time is None
        duration = span.duration_ms
        assert duration >= 0

    def test_duration_ms_after_end(self):
        span = LightweightSpan("test_op")
        time.sleep(0.01)
        span.end()
        assert span.duration_ms >= 10  # at least 10ms after 10ms sleep

    def test_duration_ms_is_frozen_after_end(self):
        """duration_ms returns the same value once end() has been called."""
        span = LightweightSpan("test_op")
        time.sleep(0.01)
        span.end()
        first = span.duration_ms
        time.sleep(0.01)
        second = span.duration_ms
        assert first == second

    def test_to_dict_contains_all_fields(self):
        span = LightweightSpan("test_op")
        span.set_attribute("key", "value")
        span.end()
        d = span.to_dict()
        assert d["name"] == "test_op"
        assert "trace_id" in d
        assert "span_id" in d
        assert d["parent_id"] is None
        assert d["attributes"] == {"key": "value"}
        assert "duration_ms" in d
        assert d["status"] == "OK"

    def test_to_dict_reflects_error_status(self):
        span = LightweightSpan("test_op")
        span.set_status("ERROR")
        span.end()
        d = span.to_dict()
        assert d["status"] == "ERROR"

    def test_to_dict_with_parent(self):
        parent = LightweightSpan("parent")
        child = LightweightSpan("child", parent=parent)
        child.end()
        d = child.to_dict()
        assert d["parent_id"] == parent.span_id


# ────────────────────────────────────────────
# LightweightTracer
# ────────────────────────────────────────────


class TestLightweightTracer:
    """LightweightTracer provides a context-manager-based span lifecycle."""

    def test_start_span_yields_span(self):
        tracer = LightweightTracer()
        with tracer.start_span("op") as span:
            assert isinstance(span, LightweightSpan)
            assert span.name == "op"

    def test_start_span_ends_on_exit(self):
        tracer = LightweightTracer()
        with tracer.start_span("op") as span:
            assert span.end_time is None
        assert span.end_time is not None

    def test_start_span_with_initial_attributes(self):
        tracer = LightweightTracer()
        with tracer.start_span("op", attributes={"key": "val"}) as span:
            assert span.attributes["key"] == "val"

    def test_start_span_handles_exception(self):
        tracer = LightweightTracer()
        with pytest.raises(ValueError, match="boom"):
            with tracer.start_span("op") as span:
                raise ValueError("boom")
        assert span.status == "ERROR"
        assert span.attributes["error.type"] == "ValueError"
        assert span.attributes["error.message"] == "boom"
        assert span.end_time is not None

    def test_nested_spans_share_trace_id(self):
        tracer = LightweightTracer()
        with tracer.start_span("outer") as outer:
            with tracer.start_span("inner") as inner:
                assert inner.trace_id == outer.trace_id

    def test_nested_spans_parent_child_relationship(self):
        tracer = LightweightTracer()
        with tracer.start_span("outer") as outer:
            with tracer.start_span("inner") as inner:
                assert inner.parent_id == outer.span_id

    def test_tracer_restores_parent_after_nested(self):
        tracer = LightweightTracer()
        with tracer.start_span("outer") as outer:
            with tracer.start_span("inner"):
                pass
            # After inner exits, current span should be outer again
            assert tracer._current_span is outer

    def test_tracer_clears_span_after_exit(self):
        tracer = LightweightTracer()
        with tracer.start_span("op"):
            pass
        assert tracer._current_span is None

    def test_multiple_sequential_spans_independent(self):
        tracer = LightweightTracer()
        with tracer.start_span("first") as s1:
            trace1 = s1.trace_id
        with tracer.start_span("second") as s2:
            trace2 = s2.trace_id
        # Different top-level spans have different trace IDs
        assert trace1 != trace2


# ────────────────────────────────────────────
# trace_function decorator
# ────────────────────────────────────────────


class TestTraceFunctionDecorator:
    """trace_function wraps sync functions with tracing spans."""

    def test_sync_function_returns_value(self):
        @trace_function("my_func")
        def add(a, b):
            return a + b

        assert add(2, 3) == 5

    def test_sync_function_with_custom_attributes(self):
        @trace_function("custom_op", attributes={"env": "test"})
        def do_work():
            return "done"

        result = do_work()
        assert result == "done"

    def test_sync_function_preserves_function_name(self):
        @trace_function("renamed")
        def original_name():
            return 1

        assert original_name.__name__ == "original_name"

    def test_sync_function_with_args(self):
        @trace_function("multiply")
        def multiply(a, b):
            return a * b

        assert multiply(3, 4) == 12

    def test_sync_function_propagates_exception(self):
        @trace_function("failing")
        def fail():
            raise RuntimeError("test error")

        with pytest.raises(RuntimeError, match="test error"):
            fail()

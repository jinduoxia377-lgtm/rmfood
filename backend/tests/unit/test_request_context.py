"""
Unit tests for app.core.request_context module.

Covers:
- generate_request_id: 12-char hex string generation
- set/get request_id roundtrip
- set/get user_id roundtrip
- set/get trace_id roundtrip
- clear_context: clears all context variables
- RequestContextFilter: injects context into log records
"""
from __future__ import annotations

import logging
import re

import pytest

from app.core.observability.request_context import (
    RequestContextFilter,
    clear_context,
    generate_request_id,
    get_request_id,
    get_trace_id,
    get_user_id,
    set_request_id,
    set_trace_id,
    set_user_id,
)


class TestGenerateRequestId:
    """generate_request_id produces a 12-character hex string."""

    def test_returns_string(self):
        result = generate_request_id()
        assert isinstance(result, str)

    def test_returns_12_characters(self):
        result = generate_request_id()
        assert len(result) == 12

    def test_returns_hex_string(self):
        result = generate_request_id()
        assert re.fullmatch(r"[0-9a-f]{12}", result), (
            f"Expected 12-char hex, got: {result!r}"
        )

    def test_returns_unique_values(self):
        """Two consecutive calls should (almost certainly) differ."""
        ids = {generate_request_id() for _ in range(50)}
        assert len(ids) == 50


class TestRequestIdRoundtrip:
    """set_request_id / get_request_id roundtrip through contextvars."""

    def setup_method(self):
        clear_context()

    def teardown_method(self):
        clear_context()

    def test_get_returns_none_by_default(self):
        assert get_request_id() is None

    def test_set_then_get(self):
        set_request_id("abc123")
        assert get_request_id() == "abc123"

    def test_overwrite(self):
        set_request_id("first")
        set_request_id("second")
        assert get_request_id() == "second"


class TestUserIdRoundtrip:
    """set_user_id / get_user_id roundtrip through contextvars."""

    def setup_method(self):
        clear_context()

    def teardown_method(self):
        clear_context()

    def test_get_returns_none_by_default(self):
        assert get_user_id() is None

    def test_set_then_get(self):
        set_user_id("user-42")
        assert get_user_id() == "user-42"

    def test_set_integer_converts_to_string(self):
        """set_user_id calls str(), so integers become strings."""
        set_user_id(99)
        assert get_user_id() == "99"


class TestTraceIdRoundtrip:
    """set_trace_id / get_trace_id roundtrip through contextvars."""

    def setup_method(self):
        clear_context()

    def teardown_method(self):
        clear_context()

    def test_get_returns_none_by_default(self):
        assert get_trace_id() is None

    def test_set_then_get(self):
        set_trace_id("trace-abc")
        assert get_trace_id() == "trace-abc"


class TestClearContext:
    """clear_context resets all context variables to None."""

    def setup_method(self):
        clear_context()

    def test_clears_request_id(self):
        set_request_id("req-1")
        clear_context()
        assert get_request_id() is None

    def test_clears_user_id(self):
        set_user_id("user-1")
        clear_context()
        assert get_user_id() is None

    def test_clears_trace_id(self):
        set_trace_id("trace-1")
        clear_context()
        assert get_trace_id() is None

    def test_clears_all_simultaneously(self):
        set_request_id("r")
        set_user_id("u")
        set_trace_id("t")
        clear_context()
        assert get_request_id() is None
        assert get_user_id() is None
        assert get_trace_id() is None

    def test_clear_when_already_none(self):
        """Calling clear_context when nothing is set should not raise."""
        clear_context()  # no-op
        assert get_request_id() is None


class TestRequestContextFilter:
    """RequestContextFilter injects request_id, user_id, trace_id into log records."""

    def setup_method(self):
        clear_context()

    def teardown_method(self):
        clear_context()

    def _make_record(self) -> logging.LogRecord:
        """Create a minimal LogRecord for testing."""
        return logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="test message",
            args=None,
            exc_info=None,
        )

    def test_injects_request_id(self):
        set_request_id("req-abc")
        record = self._make_record()
        filt = RequestContextFilter()
        filt.filter(record)
        assert record.request_id == "req-abc"

    def test_injects_user_id(self):
        set_user_id("user-xyz")
        record = self._make_record()
        filt = RequestContextFilter()
        filt.filter(record)
        assert record.user_id == "user-xyz"

    def test_injects_trace_id(self):
        set_trace_id("trace-123")
        record = self._make_record()
        filt = RequestContextFilter()
        filt.filter(record)
        assert record.trace_id == "trace-123"

    def test_defaults_to_dash_when_unset(self):
        """When context vars are None, the filter inserts '-' as a placeholder."""
        record = self._make_record()
        filt = RequestContextFilter()
        filt.filter(record)
        assert record.request_id == "-"
        assert record.user_id == "-"
        assert record.trace_id == "-"

    def test_filter_always_returns_true(self):
        """filter() must return True so the log record is not suppressed."""
        record = self._make_record()
        filt = RequestContextFilter()
        assert filt.filter(record) is True

    def test_injects_all_three_fields(self):
        set_request_id("r1")
        set_user_id("u1")
        set_trace_id("t1")
        record = self._make_record()
        filt = RequestContextFilter()
        filt.filter(record)
        assert record.request_id == "r1"
        assert record.user_id == "u1"
        assert record.trace_id == "t1"

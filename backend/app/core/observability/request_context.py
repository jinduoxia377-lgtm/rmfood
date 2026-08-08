"""
请求上下文管理 — 使用 contextvars 实现请求级变量传播

功能：
- 为每个请求生成唯一 request_id
- 通过 contextvars 在整个请求生命周期传播
- 自动注入到日志记录中

使用方式：
    from .core.observability.request_context import get_request_id, set_request_id

    # 在中间件中设置
    set_request_id("abc-123")

    # 在任何地方获取
    req_id = get_request_id()
"""
from __future__ import annotations

import logging
import uuid
from contextvars import ContextVar
from typing import Optional

# 请求级上下文变量
_request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
_user_id_var: ContextVar[Optional[str]] = ContextVar("user_id", default=None)
_trace_id_var: ContextVar[Optional[str]] = ContextVar("trace_id", default=None)


def generate_request_id() -> str:
    """生成短请求 ID（12 字符）"""
    return uuid.uuid4().hex[:12]


def set_request_id(request_id: str) -> None:
    """设置当前请求的 request_id"""
    _request_id_var.set(request_id)


def get_request_id() -> Optional[str]:
    """获取当前请求的 request_id"""
    return _request_id_var.get()


def set_user_id(user_id: str) -> None:
    """设置当前请求的 user_id"""
    _user_id_var.set(str(user_id))


def get_user_id() -> Optional[str]:
    """获取当前请求的 user_id"""
    return _user_id_var.get()


def set_trace_id(trace_id: str) -> None:
    """设置当前请求的 trace_id（用于分布式追踪）"""
    _trace_id_var.set(trace_id)


def get_trace_id() -> Optional[str]:
    """获取当前请求的 trace_id"""
    return _trace_id_var.get()


def clear_context() -> None:
    """清除所有上下文变量（请求结束时调用）"""
    _request_id_var.set(None)
    _user_id_var.set(None)
    _trace_id_var.set(None)


class RequestContextFilter(logging.Filter):
    """
    日志过滤器 — 自动将 request_id/user_id/trace_id 注入到日志记录中

    配合 logging_config.py 的 JSONFormatter 使用，
    确保每条日志都包含请求上下文信息。
    """

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id() or "-"
        record.user_id = get_user_id() or "-"
        record.trace_id = get_trace_id() or "-"
        return True

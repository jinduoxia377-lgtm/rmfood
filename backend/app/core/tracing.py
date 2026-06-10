"""
OpenTelemetry 分布式追踪模块

提供追踪基础设施，支持 trace_id 和 span_id 传播。
当 OpenTelemetry SDK 可用时使用完整实现，否则提供轻量级回退。

使用方式:
    from .core.tracing import tracer, trace_function

    # 手动创建 span
    with tracer.start_span("operation_name") as span:
        span.set_attribute("key", "value")
        result = do_work()

    # 装饰器方式
    @trace_function("my_function")
    async def my_function():
        ...
"""
from __future__ import annotations

import logging
import time
import uuid
from contextlib import contextmanager
from functools import wraps
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

# 尝试导入 OpenTelemetry
try:
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
    OTEL_AVAILABLE = True
except ImportError:
    OTEL_AVAILABLE = False


class LightweightSpan:
    """轻量级 Span 实现（当 OpenTelemetry 不可用时使用）"""

    def __init__(self, name: str, parent: Optional[LightweightSpan] = None):
        self.name = name
        self.trace_id = parent.trace_id if parent else uuid.uuid4().hex[:16]
        self.span_id = uuid.uuid4().hex[:8]
        self.parent_id = parent.span_id if parent else None
        self.attributes: dict[str, Any] = {}
        self.start_time = time.time()
        self.end_time: Optional[float] = None
        self.status = "OK"

    def set_attribute(self, key: str, value: Any) -> None:
        self.attributes[key] = value

    def set_status(self, status: str) -> None:
        self.status = status

    def end(self) -> None:
        self.end_time = time.time()

    @property
    def duration_ms(self) -> float:
        end = self.end_time or time.time()
        return (end - self.start_time) * 1000

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "parent_id": self.parent_id,
            "attributes": self.attributes,
            "duration_ms": round(self.duration_ms, 2),
            "status": self.status,
        }


class LightweightTracer:
    """轻量级 Tracer 实现（当 OpenTelemetry 不可用时使用）"""

    def __init__(self):
        self._current_span: Optional[LightweightSpan] = None

    @contextmanager
    def start_span(self, name: str, attributes: Optional[dict] = None):
        parent = self._current_span
        span = LightweightSpan(name, parent=parent)
        if attributes:
            for k, v in attributes.items():
                span.set_attribute(k, v)

        self._current_span = span
        try:
            yield span
        except Exception as e:
            span.set_status("ERROR")
            span.set_attribute("error.type", type(e).__name__)
            span.set_attribute("error.message", str(e))
            raise
        finally:
            span.end()
            self._current_span = parent
            logger.debug(f"Span: {span.name} ({span.duration_ms:.2f}ms) trace={span.trace_id}")


def trace_function(name: Optional[str] = None, attributes: Optional[dict] = None):
    """装饰器：为函数添加追踪"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            span_name = name or func.__name__
            with tracer.start_span(span_name, attributes) as span:
                if args:
                    span.set_attribute("args_count", len(args))
                return await func(*args, **kwargs)

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            span_name = name or func.__name__
            with tracer.start_span(span_name, attributes) as span:
                if args:
                    span.set_attribute("args_count", len(args))
                return func(*args, **kwargs)

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator


# 初始化
if OTEL_AVAILABLE:
    provider = TracerProvider()
    provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
    trace.set_tracer_provider(provider)
    tracer = trace.get_tracer("rmfood")
    logger.info("OpenTelemetry 追踪已启用")
else:
    tracer = LightweightTracer()
    logger.info("轻量级追踪已启用（安装 opentelemetry-sdk 以获取完整功能）")

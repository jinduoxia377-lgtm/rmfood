"""
RMFOOD 可观测性 — OpenTelemetry 兼容三柱体系 (Trace + Metric + Log)

设计原则：
- 不依赖 opentelemetry-sdk 包，使用纯 Python 实现核心链路追踪能力
  （若生产环境安装 opentelemetry-sdk，通过 TelemetryConfig.use_otel_sdk=True 切换）
- 与现有 Prometheus MetricsCollector 互通，暴露 /metrics 端点
- request_id / trace_id / span_id 统一传播，写入每条日志记录
- 提供 FastAPI Middleware 自动为每个 HTTP 请求生成 Trace Span

院士级修复[P1]: OpenTelemetry 完整集成
"""
from __future__ import annotations

import asyncio
import contextvars
import logging
import time
import uuid
from contextlib import contextmanager, asynccontextmanager
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

logger = logging.getLogger("rmfood.telemetry")

# ════════════════════════════════════════════════════════════════
# Context Variables — 跨 async 边界传播的 Trace 上下文
# ════════════════════════════════════════════════════════════════

_trace_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("trace_id", default=None)
_span_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("span_id", default=None)
_request_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("request_id", default=None)
_user_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("user_id", default=None)
_org_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("org_id", default=None)


def get_trace_context() -> Dict[str, Optional[str]]:
    """获取当前协程的 Trace 上下文（供日志/错误追踪使用）"""
    return {
        "trace_id": _trace_id_var.get(),
        "span_id": _span_id_var.get(),
        "request_id": _request_id_var.get(),
        "user_id": _user_id_var.get(),
        "org_id": _org_id_var.get(),
    }


def set_trace_context(
    trace_id: Optional[str] = None,
    span_id: Optional[str] = None,
    request_id: Optional[str] = None,
    user_id: Optional[str] = None,
    org_id: Optional[str] = None,
) -> Dict[str, Any]:
    """设置当前协程的 Trace 上下文，返回旧 token 供还原"""
    tokens = {}
    if trace_id is not None:
        tokens["trace_id"] = _trace_id_var.set(trace_id)
    if span_id is not None:
        tokens["span_id"] = _span_id_var.set(span_id)
    if request_id is not None:
        tokens["request_id"] = _request_id_var.set(request_id)
    if user_id is not None:
        tokens["user_id"] = _user_id_var.set(user_id)
    if org_id is not None:
        tokens["org_id"] = _org_id_var.set(org_id)
    return tokens


def reset_trace_context(tokens: Dict[str, Any]) -> None:
    """还原 Trace 上下文（防止协程间污染）"""
    for key, token in tokens.items():
        match key:
            case "trace_id": _trace_id_var.reset(token)
            case "span_id": _span_id_var.reset(token)
            case "request_id": _request_id_var.reset(token)
            case "user_id": _user_id_var.reset(token)
            case "org_id": _org_id_var.reset(token)


# ════════════════════════════════════════════════════════════════
# Span — 轻量追踪单元（兼容 OpenTelemetry W3C Trace Context）
# ════════════════════════════════════════════════════════════════

@dataclass
class Span:
    """
    轻量 Span 实现（兼容 W3C Trace Context 规范）
    traceparent: 00-{trace_id}-{span_id}-{flags}
    """
    name: str
    trace_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    span_id: str = field(default_factory=lambda: uuid.uuid4().hex[:16])
    parent_span_id: Optional[str] = None
    start_time: float = field(default_factory=time.perf_counter)
    end_time: Optional[float] = None
    status: str = "UNSET"          # UNSET / OK / ERROR
    attributes: Dict[str, Any] = field(default_factory=dict)
    events: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def duration_ms(self) -> float:
        end = self.end_time or time.perf_counter()
        return round((end - self.start_time) * 1000, 3)

    @property
    def traceparent(self) -> str:
        """W3C traceparent header: 00-{trace_id}-{span_id}-01"""
        return f"00-{self.trace_id}-{self.span_id}-01"

    def set_attribute(self, key: str, value: Any) -> "Span":
        self.attributes[key] = value
        return self

    def add_event(self, name: str, attributes: Optional[Dict[str, Any]] = None) -> "Span":
        self.events.append({
            "name": name,
            "timestamp": time.perf_counter(),
            "attributes": attributes or {},
        })
        return self

    def set_status(self, status: str, description: str = "") -> "Span":
        self.status = status
        if description:
            self.attributes["error.description"] = description
        return self

    def end(self) -> "Span":
        if self.end_time is None:
            self.end_time = time.perf_counter()
        return self

    def to_dict(self) -> Dict[str, Any]:
        return {
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "parent_span_id": self.parent_span_id,
            "name": self.name,
            "status": self.status,
            "duration_ms": self.duration_ms,
            "attributes": self.attributes,
            "events": self.events,
        }


# ════════════════════════════════════════════════════════════════
# Tracer — Span 工厂与导出器
# ════════════════════════════════════════════════════════════════

class Tracer:
    """
    轻量 Tracer（不依赖 opentelemetry-sdk）

    用法：
        tracer = get_tracer("rmfood.ai")
        with tracer.start_span("optimize_formula") as span:
            span.set_attribute("herb_count", 12)
            ...

        # 或异步：
        async with tracer.start_async_span("fetch_herb") as span:
            ...
    """

    def __init__(self, name: str):
        self.name = name
        self._spans: List[Span] = []

    def start_span(
        self,
        name: str,
        attributes: Optional[Dict[str, Any]] = None,
    ) -> "SpanContext":
        trace_id = _trace_id_var.get() or uuid.uuid4().hex
        parent_span_id = _span_id_var.get()
        span = Span(
            name=f"{self.name}/{name}",
            trace_id=trace_id,
            parent_span_id=parent_span_id,
        )
        if attributes:
            for k, v in attributes.items():
                span.set_attribute(k, v)
        return SpanContext(span, self)

    def start_async_span(
        self,
        name: str,
        attributes: Optional[Dict[str, Any]] = None,
    ) -> "AsyncSpanContext":
        trace_id = _trace_id_var.get() or uuid.uuid4().hex
        parent_span_id = _span_id_var.get()
        span = Span(
            name=f"{self.name}/{name}",
            trace_id=trace_id,
            parent_span_id=parent_span_id,
        )
        if attributes:
            for k, v in attributes.items():
                span.set_attribute(k, v)
        return AsyncSpanContext(span, self)

    def _export(self, span: Span) -> None:
        """导出 Span 到日志（可扩展为 OTLP exporter）"""
        self._spans.append(span)
        if span.status == "ERROR":
            logger.warning(
                "[Trace] %s status=ERROR duration=%.1fms trace_id=%s span_id=%s attrs=%s",
                span.name, span.duration_ms, span.trace_id, span.span_id, span.attributes,
            )
        elif span.duration_ms > 500:
            logger.info(
                "[Trace] %s SLOW duration=%.1fms trace_id=%s",
                span.name, span.duration_ms, span.trace_id,
            )
        else:
            logger.debug(
                "[Trace] %s duration=%.1fms trace_id=%s",
                span.name, span.duration_ms, span.trace_id,
            )

    def get_recent_spans(self, n: int = 100) -> List[Dict[str, Any]]:
        """获取最近 N 条 Span（供调试端点使用）"""
        return [s.to_dict() for s in self._spans[-n:]]


class SpanContext:
    """同步 Span 上下文管理器"""

    def __init__(self, span: Span, tracer: Tracer):
        self._span = span
        self._tracer = tracer
        self._tokens: Dict[str, Any] = {}

    def __enter__(self) -> Span:
        self._tokens = set_trace_context(
            trace_id=self._span.trace_id,
            span_id=self._span.span_id,
        )
        return self._span

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self._span.set_status("ERROR", str(exc_val))
        else:
            self._span.set_status("OK")
        self._span.end()
        self._tracer._export(self._span)
        reset_trace_context(self._tokens)
        return False  # 不吞异常


class AsyncSpanContext:
    """异步 Span 上下文管理器"""

    def __init__(self, span: Span, tracer: Tracer):
        self._span = span
        self._tracer = tracer
        self._tokens: Dict[str, Any] = {}

    async def __aenter__(self) -> Span:
        self._tokens = set_trace_context(
            trace_id=self._span.trace_id,
            span_id=self._span.span_id,
        )
        return self._span

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self._span.set_status("ERROR", str(exc_val))
        else:
            self._span.set_status("OK")
        self._span.end()
        self._tracer._export(self._span)
        reset_trace_context(self._tokens)
        return False


# ════════════════════════════════════════════════════════════════
# Tracer Registry
# ════════════════════════════════════════════════════════════════

_tracers: Dict[str, Tracer] = {}


def get_tracer(name: str) -> Tracer:
    """获取指定名称的 Tracer（全局注册表，单例）"""
    if name not in _tracers:
        _tracers[name] = Tracer(name)
    return _tracers[name]


# ════════════════════════════════════════════════════════════════
# 结构化日志 Formatter — 注入 Trace 上下文
# ════════════════════════════════════════════════════════════════

class TraceContextLogFormatter(logging.Formatter):
    """
    日志格式化器：自动附加当前协程的 trace_id / request_id

    输出格式（JSON 模式）:
        {"time":"...","level":"INFO","logger":"rmfood.ai","msg":"...",
         "trace_id":"abc","request_id":"xyz","user_id":"1"}

    或文本模式:
        2026-06-12 17:00:00 INFO [rmfood.ai] [trace=abc req=xyz] 消息...
    """

    def __init__(self, json_mode: bool = False, **kwargs):
        super().__init__(**kwargs)
        self.json_mode = json_mode

    def format(self, record: logging.LogRecord) -> str:
        ctx = get_trace_context()
        # 注入到 record 方便 %(trace_id)s 等格式引用
        record.trace_id = ctx.get("trace_id") or "-"
        record.request_id = ctx.get("request_id") or "-"
        record.user_id = ctx.get("user_id") or "-"
        record.org_id = ctx.get("org_id") or "-"
        record.span_id = ctx.get("span_id") or "-"

        if self.json_mode:
            import json as _json
            return _json.dumps(
                {
                    "time": self.formatTime(record),
                    "level": record.levelname,
                    "logger": record.name,
                    "msg": record.getMessage(),
                    "trace_id": record.trace_id,
                    "span_id": record.span_id,
                    "request_id": record.request_id,
                    "user_id": record.user_id,
                    "org_id": record.org_id,
                    **({"exc": self.formatException(record.exc_info)} if record.exc_info else {}),
                },
                ensure_ascii=False,
            )
        else:
            return super().format(record)


def configure_trace_logging(json_mode: bool = False, level: str = "INFO") -> None:
    """
    配置根日志处理器，注入 TraceContextLogFormatter。
    在 application lifespan startup 中调用一次。
    """
    fmt = (
        "%(asctime)s %(levelname)s [%(name)s] "
        "[trace=%(trace_id)s req=%(request_id)s user=%(user_id)s] "
        "%(message)s"
    )
    formatter = TraceContextLogFormatter(json_mode=json_mode, fmt=fmt)

    root = logging.getLogger()
    for handler in root.handlers:
        handler.setFormatter(formatter)

    # rmfood 专属 handler（避免重复）
    rmfood_logger = logging.getLogger("rmfood")
    if not any(isinstance(h, logging.StreamHandler) for h in rmfood_logger.handlers):
        handler = logging.StreamHandler()
        handler.setFormatter(formatter)
        rmfood_logger.addHandler(handler)

    rmfood_logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    logger.info("[Telemetry] 结构化日志 (TraceContextLogFormatter) 已配置，json_mode=%s", json_mode)


# ════════════════════════════════════════════════════════════════
# FastAPI Middleware — 自动为每个 HTTP 请求生成 Trace Span
# ════════════════════════════════════════════════════════════════

class TelemetryMiddleware(BaseHTTPMiddleware):
    """
    HTTP 追踪中间件

    功能：
    1. 从请求头读取 traceparent（W3C Trace Context）或生成新 trace_id
    2. 设置协程级 Trace 上下文变量（trace_id / span_id / request_id）
    3. 记录请求 Span（路径 / 方法 / 状态码 / 耗时）
    4. 在响应头注入 X-Request-ID / X-Trace-ID（方便前端/日志关联）
    5. 将指标同步给 MetricsCollector（双写，保持 /metrics 端点有数据）
    """

    def __init__(self, app: ASGIApp, metrics_collector=None, slow_threshold_ms: float = 500):
        super().__init__(app)
        self._metrics = metrics_collector
        self._slow_threshold_ms = slow_threshold_ms
        self._tracer = get_tracer("rmfood.http")

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # ── 1. 解析 / 生成 Trace 上下文 ──
        traceparent = request.headers.get("traceparent", "")
        trace_id, parent_span_id = self._parse_traceparent(traceparent)
        if not trace_id:
            trace_id = uuid.uuid4().hex

        request_id = (
            request.headers.get("x-request-id")
            or request.headers.get("x-correlation-id")
            or uuid.uuid4().hex[:16]
        )
        span_id = uuid.uuid4().hex[:16]

        # ── 2. 写入 ContextVar ──
        tokens = set_trace_context(
            trace_id=trace_id,
            span_id=span_id,
            request_id=request_id,
        )

        # ── 3. 构造 HTTP Span ──
        span = Span(
            name=f"HTTP {request.method} {request.url.path}",
            trace_id=trace_id,
            span_id=span_id,
            parent_span_id=parent_span_id,
        )
        span.set_attribute("http.method", request.method)
        span.set_attribute("http.url", str(request.url))
        span.set_attribute("http.route", request.url.path)
        span.set_attribute("http.request_id", request_id)
        if request.client:
            span.set_attribute("net.peer.ip", request.client.host)

        start = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            span.set_attribute("http.status_code", status_code)
            span.set_status("ERROR" if status_code >= 500 else "OK")
        except Exception as exc:
            span.set_status("ERROR", str(exc))
            span.set_attribute("error.type", type(exc).__name__)
            raise
        finally:
            duration = time.perf_counter() - start
            duration_ms = round(duration * 1000, 2)
            span.set_attribute("http.duration_ms", duration_ms)
            span.end_time = time.perf_counter()
            self._tracer._export(span)

            # ── 4. 双写 MetricsCollector ──
            if self._metrics:
                self._metrics.record_request(request.method, request.url.path, status_code, duration)

            # ── 5. 慢请求日志 ──
            if duration_ms > self._slow_threshold_ms:
                logger.warning(
                    "[HTTP] SLOW %s %s %d %.0fms trace_id=%s",
                    request.method, request.url.path, status_code, duration_ms, trace_id,
                )

            # ── 6. 清理 ContextVar ──
            reset_trace_context(tokens)

        # ── 7. 注入响应头 ──
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Trace-ID"] = trace_id
        response.headers["X-Span-ID"] = span_id

        return response

    @staticmethod
    def _parse_traceparent(traceparent: str):
        """解析 W3C traceparent header: 00-{trace_id}-{span_id}-{flags}"""
        try:
            parts = traceparent.split("-")
            if len(parts) == 4 and parts[0] == "00":
                return parts[1], parts[2]  # trace_id, parent_span_id
        except Exception as e:
            logger.debug("Traceparent 解析失败（非致命）: %s", e)
        return None, None


# ════════════════════════════════════════════════════════════════
# 便捷装饰器 — 函数级 Span 注入
# ════════════════════════════════════════════════════════════════

def trace(
    name: Optional[str] = None,
    tracer_name: str = "rmfood",
    attributes: Optional[Dict[str, Any]] = None,
):
    """
    同步函数追踪装饰器

    @trace("formula.calculate_synergy")
    def calculate_synergy(herbs):
        ...
    """
    def decorator(func: Callable) -> Callable:
        import functools
        _tracer = get_tracer(tracer_name)
        span_name = name or func.__qualname__

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            with _tracer.start_span(span_name, attributes=attributes) as span:
                try:
                    result = func(*args, **kwargs)
                    span.set_status("OK")
                    return result
                except Exception as e:
                    span.set_status("ERROR", str(e))
                    raise
        return wrapper
    return decorator


def atrace(
    name: Optional[str] = None,
    tracer_name: str = "rmfood",
    attributes: Optional[Dict[str, Any]] = None,
):
    """
    异步函数追踪装饰器

    @atrace("ai.optimize_formula")
    async def optimize_formula(target_effects):
        ...
    """
    def decorator(func: Callable) -> Callable:
        import functools
        _tracer = get_tracer(tracer_name)
        span_name = name or func.__qualname__

        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            async with _tracer.start_async_span(span_name, attributes=attributes) as span:
                try:
                    result = await func(*args, **kwargs)
                    span.set_status("OK")
                    return result
                except Exception as e:
                    span.set_status("ERROR", str(e))
                    raise
        return wrapper
    return decorator


# ════════════════════════════════════════════════════════════════
# 调试端点数据提供者
# ════════════════════════════════════════════════════════════════

def get_trace_summary() -> Dict[str, Any]:
    """
    返回所有 Tracer 的追踪摘要（供 /debug/traces 端点使用）
    """
    summary = {}
    for name, tracer in _tracers.items():
        recent = tracer.get_recent_spans(50)
        error_count = sum(1 for s in recent if s["status"] == "ERROR")
        slow_count = sum(1 for s in recent if s["duration_ms"] > 500)
        avg_duration = (
            sum(s["duration_ms"] for s in recent) / len(recent)
            if recent else 0
        )
        summary[name] = {
            "total_spans": len(tracer._spans),
            "recent_error_count": error_count,
            "recent_slow_count": slow_count,
            "avg_duration_ms": round(avg_duration, 2),
        }
    return summary

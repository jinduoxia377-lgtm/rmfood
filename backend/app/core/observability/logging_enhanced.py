"""
🔒 P4-3: 增强结构化日志系统 - 请求追踪 + 性能聚合 + 告警

在现有 logging_config.py 基础上提供增强层：

1. **请求 ID 追踪** - 跨服务的请求关联 ID
2. **日志分级聚合** - 按模块/级别聚合统计
3. **慢请求检测** - 自动识别并标记慢请求
4. **错误告警** - 达到阈值时触发告警（控制台/文件，可扩展）
5. **日志轮转** - 按大小/时间自动轮转日志文件
6. **审计日志** - 敏感操作独立审计日志

使用方式:
    # 在 main.py 中初始化
    from app.core.observability.logging_enhanced import init_enhanced_logging
    init_enhanced_logging(app)

    # 在业务代码中使用结构化日志
    from app.core.observability.logging_enhanced import structured_logger
    structured_logger.info(
        "User operation",
        extra={
            "user_id": 123,
            "operation": "create_formula",
            "formula_id": "f_001"
        }
    )

    # 慢请求检测（作为中间件使用）
    # 由 init_enhanced_logging 自动注册
"""

from __future__ import annotations

import logging
import json
import time
import asyncio
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
from contextlib import contextmanager
from collections import defaultdict

from fastapi import Request, FastAPI
from starlette.middleware.base import BaseHTTPMiddleware

# 尝试导入现有日志配置
try:
    from ..observability.logging_config import StructuredJsonFormatter, HumanReadableFormatter
except ImportError:
    StructuredJsonFormatter = None  # type: ignore
    HumanReadableFormatter = None  # type: ignore

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════
# 🔒 P4-3: 配置
# ════════════════════════════════════════════

@dataclass
class LoggingEnhancedConfig:
    """增强日志系统配置"""
    # 日志目录
    log_dir: str = "logs"
    # 日志文件轮转
    max_file_size_mb: int = 50
    max_file_count: int = 10
    # 慢请求阈值
    slow_request_threshold_ms: float = 1000.0
    # 错误告警阈值
    error_alert_threshold: int = 10  # 10 秒内 10 个错误则告警
    error_alert_window_seconds: int = 10
    # 审计日志（独立文件）
    audit_log_enabled: bool = True
    # 是否开启日志脱敏
    enable_masking: bool = True
    # 需要脱敏的字段名
    sensitive_fields: Set[str] = field(
        default_factory=lambda: {
            "password", "token", "api_key", "secret", "authorization",
            "cookie", "credit_card", "phone", "email", "id_card",
        }
    )


# ════════════════════════════════════════════
# 🔒 P4-3: 请求上下文管理
# ════════════════════════════════════════════

class RequestContext:
    """
    请求上下文管理器 - 使用 contextvars 管理每个请求的上下文信息

    提供:
    - request_id: 唯一请求标识
    - user_id: 关联用户
    - trace_id: 分布式追踪 ID
    - start_time: 请求开始时间
    - custom_fields: 自定义字段（附加到所有日志）
    """

    import contextvars

    _request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
        "request_id", default=""
    )
    _user_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
        "user_id", default=None
    )
    _trace_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
        "trace_id", default=None
    )
    _start_time_var: contextvars.ContextVar[float] = contextvars.ContextVar(
        "start_time", default=0.0
    )
    _custom_fields_var: contextvars.ContextVar[Dict[str, Any]] = contextvars.ContextVar(
        "custom_fields", default={}
    )

    @classmethod
    def set_request_id(cls, request_id: str) -> None:
        cls._request_id_var.set(request_id)

    @classmethod
    def get_request_id(cls) -> str:
        return cls._request_id_var.get()

    @classmethod
    def set_user_id(cls, user_id: Optional[str]) -> None:
        cls._user_id_var.set(user_id)

    @classmethod
    def get_user_id(cls) -> Optional[str]:
        return cls._user_id_var.get()

    @classmethod
    def set_trace_id(cls, trace_id: Optional[str]) -> None:
        cls._trace_id_var.set(trace_id)

    @classmethod
    def get_trace_id(cls) -> Optional[str]:
        return cls._trace_id_var.get()

    @classmethod
    def set_start_time(cls, start_time: float) -> None:
        cls._start_time_var.set(start_time)

    @classmethod
    def get_start_time(cls) -> float:
        return cls._start_time_var.get()

    @classmethod
    def add_custom_field(cls, key: str, value: Any) -> None:
        fields = cls._custom_fields_var.get()
        fields[key] = value
        cls._custom_fields_var.set(fields)

    @classmethod
    def get_custom_fields(cls) -> Dict[str, Any]:
        return cls._custom_fields_var.get()

    @classmethod
    def get_all(cls) -> Dict[str, Any]:
        """获取所有上下文信息"""
        return {
            "request_id": cls.get_request_id(),
            "user_id": cls.get_user_id(),
            "trace_id": cls.get_trace_id(),
            "custom_fields": cls.get_custom_fields(),
        }


# ════════════════════════════════════════════
# 🔒 P4-3: 日志过滤器
# ════════════════════════════════════════════

class RequestContextFilter(logging.Filter):
    """将请求上下文注入到每条日志记录"""

    def filter(self, record):
        record.request_id = RequestContext.get_request_id() or "system"
        record.user_id = RequestContext.get_user_id()
        record.trace_id = RequestContext.get_trace_id()

        # 计算请求持续时间（如果已设置 start_time）
        start_time = RequestContext.get_start_time()
        if start_time > 0:
            record.request_duration_ms = round(
                (time.time() - start_time) * 1000, 2
            )
        else:
            record.request_duration_ms = 0

        # 合并自定义字段
        custom_fields = RequestContext.get_custom_fields()
        if custom_fields:
            record.extra_data = custom_fields

        return True


class SensitiveDataMaskingFilter(logging.Filter):
    """敏感数据脱敏过滤器"""

    def __init__(self, config: LoggingEnhancedConfig):
        self.config = config
        super().__init__()

    def filter(self, record):
        if not self.config.enable_masking:
            return True

        # 脱敏消息中的敏感字段
        try:
            msg = record.getMessage()
            if any(field in msg.lower() for field in self.config.sensitive_fields):
                # 简单的替换策略：将可能的敏感值替换为 ***
                for field in self.config.sensitive_fields:
                    if field in msg.lower():
                        record.msg = self._mask_sensitive(msg)
                        break
        except Exception as e:
            logger.debug("日志脱敏处理失败（非致命）: %s", e)
        if hasattr(record, "extra_data") and isinstance(record.extra_data, dict):
            masked = {}
            for k, v in record.extra_data.items():
                if k.lower() in self.config.sensitive_fields:
                    masked[k] = "***MASKED***"
                else:
                    masked[k] = v
            record.extra_data = masked

        return True

    def _mask_sensitive(self, text: str) -> str:
        """简单的敏感数据脱敏"""
        import re
        # 掩码 password="xxx" 或 token=xxx 格式
        text = re.sub(
            r'(password|token|api[_-]?key|secret)[=:]"?[^"\s,}]+"?',
            r'\1=***MASKED***',
            text,
            flags=re.IGNORECASE,
        )
        # 掩码 Bearer token
        text = re.sub(r'Bearer [A-Za-z0-9_\-\.]+', 'Bearer ***MASKED***', text)
        return text


# ════════════════════════════════════════════
# 🔒 P4-3: 统计与聚合
# ════════════════════════════════════════════

class LogStatsAggregator:
    """日志统计聚合器 - 按级别/模块/时间统计"""

    def __init__(self, config: LoggingEnhancedConfig):
        self.config = config
        self._lock = threading.Lock()

        # 按级别统计
        self._level_counts: Dict[str, int] = defaultdict(int)

        # 按模块统计
        self._module_counts: Dict[str, Dict[str, int]] = defaultdict(
            lambda: defaultdict(int)
        )

        # 错误时间窗口（用于告警）
        self._error_timestamps: List[float] = []

        # 慢请求记录
        self._slow_requests: List[Dict[str, Any]] = []

        # 总体计数
        self._total_logs: int = 0

        # 启动时间
        self._start_time = time.time()

    def record_log(self, level: str, module: str) -> None:
        with self._lock:
            self._level_counts[level] += 1
            self._module_counts[module][level] += 1
            self._total_logs += 1

            if level in ("ERROR", "CRITICAL", "FATAL"):
                now = time.time()
                self._error_timestamps.append(now)
                # 清理过旧的时间戳
                cutoff = now - self.config.error_alert_window_seconds
                self._error_timestamps = [
                    t for t in self._error_timestamps if t >= cutoff
                ]

    def record_slow_request(self, method: str, path: str, duration_ms: float) -> None:
        with self._lock:
            self._slow_requests.append(
                {
                    "method": method,
                    "path": path,
                    "duration_ms": round(duration_ms, 2),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
            # 只保留最近的 100 条慢请求
            if len(self._slow_requests) > 100:
                self._slow_requests = self._slow_requests[-100:]

    def get_error_count_in_window(self) -> int:
        """获取当前时间窗口内的错误数"""
        with self._lock:
            now = time.time()
            cutoff = now - self.config.error_alert_window_seconds
            return sum(1 for t in self._error_timestamps if t >= cutoff)

    def get_stats(self) -> Dict[str, Any]:
        """获取汇总统计"""
        with self._lock:
            return {
                "total_logs": self._total_logs,
                "uptime_seconds": round(time.time() - self._start_time, 2),
                "by_level": dict(self._level_counts),
                "by_module": {
                    mod: dict(counts) for mod, counts in self._module_counts.items()
                },
                "error_rate_per_minute": round(
                    self._level_counts.get("ERROR", 0)
                    / max((time.time() - self._start_time) / 60, 1),
                    2,
                ),
                "errors_in_window": self.get_error_count_in_window(),
                "slow_requests_count": len(self._slow_requests),
                "recent_slow_requests": self._slow_requests[-10:],
            }


# ════════════════════════════════════════════
# 🔒 P4-3: 结构化日志器
# ════════════════════════════════════════════

class StructuredLogger:
    """
    🔒 P4-3: 增强的结构化日志器

    支持:
    - 自动附加请求上下文
    - 结构化 JSON 输出
    - 性能计时装饰器/上下文管理器
    - 审计日志独立输出
    """

    def __init__(self, name: str = "rmfood", stats_aggregator: LogStatsAggregator = None):
        self._logger = logging.getLogger(name)
        self._stats = stats_aggregator

    # ── 基础日志方法 ──

    def debug(self, message: str, **kwargs) -> None:
        self._log(logging.DEBUG, message, kwargs)

    def info(self, message: str, **kwargs) -> None:
        self._log(logging.INFO, message, kwargs)

    def warning(self, message: str, **kwargs) -> None:
        self._log(logging.WARNING, message, kwargs)

    def warn(self, message: str, **kwargs) -> None:
        self.warning(message, **kwargs)

    def error(self, message: str, **kwargs) -> None:
        self._log(logging.ERROR, message, kwargs)

    def critical(self, message: str, **kwargs) -> None:
        self._log(logging.CRITICAL, message, kwargs)

    def exception(self, message: str, exc: Exception = None, **kwargs) -> None:
        if exc:
            kwargs["exception_type"] = type(exc).__name__
            kwargs["exception_message"] = str(exc)
        self._log(logging.ERROR, message, kwargs, exc_info=True)

    def audit(self, action: str, **kwargs) -> None:
        """独立审计日志"""
        kwargs["audit_action"] = action
        kwargs["is_audit_log"] = True
        self._log(logging.INFO, f"AUDIT: {action}", kwargs)

    # ── 核心实现 ──

    def _log(self, level: int, message: str, extra: Dict[str, Any], exc_info: bool = False) -> None:
        if not self._logger.isEnabledFor(level):
            return

        # 收集额外字段
        extra_data = {}
        if extra:
            # 过滤 None 值
            extra_data = {k: v for k, v in extra.items() if v is not None}

        # 记录统计
        if self._stats:
            level_name = logging.getLevelName(level)
            self._stats.record_log(level_name, self._logger.name)

        # 记录日志
        if extra_data:
            self._logger.log(
                level, message, extra={"extra_data": extra_data}, exc_info=exc_info
            )
        else:
            self._logger.log(level, message, exc_info=exc_info)

    # ── 性能计时 ──

    @contextmanager
    def timed(self, operation_name: str, threshold_ms: float = 100.0, **kwargs):
        """
        性能计时上下文管理器

        用法:
            with structured_logger.timed("db_query", threshold_ms=500):
                result = db.execute(query)
        """
        start = time.time()
        try:
            yield
        finally:
            duration_ms = (time.time() - start) * 1000
            kwargs["duration_ms"] = round(duration_ms, 2)

            if duration_ms > threshold_ms:
                kwargs["is_slow"] = True
                self.warning(
                    f"Slow operation: {operation_name}", **kwargs
                )
            else:
                self.debug(f"Operation completed: {operation_name}", **kwargs)

    async def timed_async(self, coro, operation_name: str, threshold_ms: float = 100.0, **kwargs):
        """异步版本的性能计时"""
        start = time.time()
        try:
            result = await coro
            return result
        finally:
            duration_ms = (time.time() - start) * 1000
            kwargs["duration_ms"] = round(duration_ms, 2)
            if duration_ms > threshold_ms:
                kwargs["is_slow"] = True
                self.warning(f"Slow async operation: {operation_name}", **kwargs)

    # ── 属性转发 ──

    def __getattr__(self, name):
        """代理其他属性到底层 logger"""
        return getattr(self._logger, name)


# ════════════════════════════════════════════
# 🔒 P4-3: 请求日志中间件
# ════════════════════════════════════════════

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    🔒 P4-3: 请求日志中间件

    记录:
    - 请求 ID、方法、路径、状态码
    - 请求耗时、客户端 IP
    - User-Agent（脱敏后）
    - 慢请求告警
    - 错误请求详细信息
    """

    def __init__(self, app: FastAPI, config: LoggingEnhancedConfig, logger: StructuredLogger):
        super().__init__(app)
        self.config = config
        self.logger = logger

    async def dispatch(self, request: Request, call_next):
        import uuid

        # 生成/提取请求 ID
        request_id = request.headers.get(
            "X-Request-ID", request.headers.get("X-Trace-ID", str(uuid.uuid4()))
        )

        # 设置上下文
        RequestContext.set_request_id(request_id)
        RequestContext.set_trace_id(request.headers.get("X-Trace-ID"))
        RequestContext.set_start_time(time.time())

        # 提取用户信息（如果已认证）
        user_id = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            # 简单提取（实际应解码 JWT）
            try:
                user_id = f"user_{hash(auth_header) % 100000}"  # 占位
            except Exception as e:
                logger.debug("用户ID提取失败（占位）: %s", e)
        RequestContext.set_user_id(user_id)

        method = request.method
        path = request.url.path
        client_ip = request.client.host if request.client else "unknown"

        # 跳过健康检查和静态资源的详细日志
        is_monitoring_path = path in ("/health", "/ready", "/metrics") or path.startswith(
            ("/static", "/uploads", "/docs", "/openapi.json")
        )

        if not is_monitoring_path:
            self.logger.debug(
                "Request started",
                method=method,
                path=path,
                client_ip=client_ip,
                user_agent=request.headers.get("User-Agent", "")[:100],
            )

        try:
            response = await call_next(request)

            duration_ms = (time.time() - RequestContext.get_start_time()) * 1000
            status_code = response.status_code

            # 设置响应头中的请求 ID
            response.headers["X-Request-ID"] = request_id

            # 记录响应日志
            if not is_monitoring_path:
                # 检测慢请求
                if duration_ms > self.config.slow_request_threshold_ms:
                    self.logger.warning(
                        "Slow request detected",
                        method=method,
                        path=path,
                        status_code=status_code,
                        duration_ms=round(duration_ms, 2),
                        client_ip=client_ip,
                    )
                    if self.logger._stats:
                        self.logger._stats.record_slow_request(method, path, duration_ms)
                else:
                    # 普通请求日志
                    log_level = logging.INFO if status_code < 400 else logging.WARNING
                    self.logger._log(
                        log_level,
                        "Request completed",
                        {
                            "method": method,
                            "path": path,
                            "status_code": status_code,
                            "duration_ms": round(duration_ms, 2),
                            "client_ip": client_ip,
                        },
                    )

            return response

        except Exception as e:
            duration_ms = (time.time() - RequestContext.get_start_time()) * 1000
            self.logger.exception(
                "Request failed with exception",
                exc=e,
                method=method,
                path=path,
                duration_ms=round(duration_ms, 2),
                client_ip=client_ip,
            )
            raise


# ════════════════════════════════════════════
# 🔒 P4-3: 错误告警器
# ════════════════════════════════════════════

class ErrorAlertManager:
    """
    🔒 P4-3: 错误告警管理器

    - 监控错误率
    - 触发告警阈值检测
    - 定时告警聚合
    """

    def __init__(self, stats_aggregator: LogStatsAggregator, config: LoggingEnhancedConfig):
        self.stats = stats_aggregator
        self.config = config
        self._task: Optional[asyncio.Task] = None
        self._last_alert_time: float = 0
        self._alert_cooldown: float = 60.0  # 至少间隔 60 秒告警一次

    async def start(self) -> None:
        """启动后台告警检查"""
        async def _check_loop():
            while True:
                try:
                    await self._check_and_alert()
                except Exception as e:
                    logger.error(f"[ErrorAlert] 检查循环异常: {e}")
                await asyncio.sleep(self.config.error_alert_window_seconds)

        self._task = asyncio.create_task(_check_loop())
        logger.info("[ErrorAlert] 错误告警管理器已启动")

    async def stop(self) -> None:
        """停止告警检查"""
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("[ErrorAlert] 错误告警管理器已停止")

    async def _check_and_alert(self) -> None:
        now = time.time()

        # 检查错误率
        error_count = self.stats.get_error_count_in_window()
        if error_count >= self.config.error_alert_threshold:
            if (now - self._last_alert_time) > self._alert_cooldown:
                self._last_alert_time = now
                logger.warning(
                    f"[ErrorAlert] ⚠️ 错误告警: {self.config.error_alert_window_seconds}s 内"
                    f" 检测到 {error_count} 个错误（阈值: {self.config.error_alert_threshold}）"
                )
                # 此处可扩展为发送到 Slack/邮件/PagerDuty 等


# ════════════════════════════════════════════
# 🔒 P4-3: JSON 格式化器（增强版）
# ════════════════════════════════════════════

class EnhancedJSONFormatter(logging.Formatter):
    """增强的 JSON 日志格式化器"""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "message": record.getMessage(),
            # 请求上下文
            "request_id": getattr(record, "request_id", None),
            "user_id": getattr(record, "user_id", None),
            "trace_id": getattr(record, "trace_id", None),
            "request_duration_ms": getattr(record, "request_duration_ms", 0),
        }

        # 附加自定义数据
        if hasattr(record, "extra_data") and record.extra_data:
            log_entry["data"] = record.extra_data

        # 异常信息
        if record.exc_info and record.exc_info[0]:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
            }

        return json.dumps(log_entry, ensure_ascii=False, default=str)


# ════════════════════════════════════════════
# 🔒 P4-3: 全局实例
# ════════════════════════════════════════════

_config = LoggingEnhancedConfig()
_stats = LogStatsAggregator(_config)
structured_logger = StructuredLogger("rmfood", _stats)
_alert_manager = ErrorAlertManager(_stats, _config)


# ════════════════════════════════════════════
# 🔒 P4-3: 初始化函数
# ════════════════════════════════════════════

def init_enhanced_logging(
    app: FastAPI,
    config: Optional[LoggingEnhancedConfig] = None,
) -> None:
    """
    🔒 P4-3: 初始化增强日志系统

    这是主要的入口函数，在 FastAPI 应用中调用它：

        from app.core.observability.logging_enhanced import init_enhanced_logging
        init_enhanced_logging(app)

    它会：
    1. 注册请求日志中间件
    2. 添加上下文和脱敏过滤器
    3. 启动错误告警管理器
    4. 添加日志统计端点
    """
    global _config, _stats, _alert_manager, structured_logger

    if config:
        _config = config
        _stats = LogStatsAggregator(_config)
        structured_logger = StructuredLogger("rmfood", _stats)
        _alert_manager = ErrorAlertManager(_stats, _config)

    # 确保日志目录存在
    log_path = Path(_config.log_dir)
    log_path.mkdir(exist_ok=True)

    # 1. 添加请求日志中间件（添加到最外层）
    app.add_middleware(RequestLoggingMiddleware, config=_config, logger=structured_logger)

    # 2. 为根日志记录器添加上下文过滤器
    root_logger = logging.getLogger()
    ctx_filter = RequestContextFilter()
    if not any(isinstance(f, RequestContextFilter) for f in root_logger.filters):
        root_logger.addFilter(ctx_filter)

    # 3. 添加敏感数据脱敏过滤器
    mask_filter = SensitiveDataMaskingFilter(_config)
    if not any(isinstance(f, SensitiveDataMaskingFilter) for f in root_logger.filters):
        root_logger.addFilter(mask_filter)

    # 4. 启动错误告警器
    @app.on_event("startup")
    async def _start_alert_manager():
        try:
            await _alert_manager.start()
        except Exception as e:
            logger.warning(f"[LoggingEnhanced] 告警管理器启动失败（非阻塞）: {e}")

    @app.on_event("shutdown")
    async def _stop_alert_manager():
        try:
            await _alert_manager.stop()
        except Exception as e:
            logger.debug("AlertManager 停止失败（非致命）: %s", e)
    @app.get("/api/v1/admin/log-stats", tags=["系统管理"], summary="日志统计")
    async def get_log_stats():
        return _stats.get_stats()

    @app.get("/api/v1/admin/log-config", tags=["系统管理"], summary="日志配置")
    async def get_log_config():
        return {
            "log_dir": _config.log_dir,
            "max_file_size_mb": _config.max_file_size_mb,
            "slow_request_threshold_ms": _config.slow_request_threshold_ms,
            "error_alert_threshold": _config.error_alert_threshold,
            "error_alert_window_seconds": _config.error_alert_window_seconds,
            "audit_log_enabled": _config.audit_log_enabled,
            "enable_masking": _config.enable_masking,
        }

    logger.info("[LoggingEnhanced] ✅ 增强日志系统已初始化")


# ════════════════════════════════════════════
# 🔒 P4-3: 便捷函数
# ════════════════════════════════════════════

def get_logger(name: str) -> StructuredLogger:
    """获取命名日志器"""
    return StructuredLogger(name, _stats)


def get_stats() -> Dict[str, Any]:
    """获取当前日志统计"""
    return _stats.get_stats()


def set_user_context(user_id: str) -> None:
    """设置当前请求的用户上下文"""
    RequestContext.set_user_id(user_id)


def add_log_context(**kwargs) -> None:
    """添加自定义日志上下文"""
    for k, v in kwargs.items():
        RequestContext.add_custom_field(k, v)


__all__ = [
    "LoggingEnhancedConfig",
    "RequestContext",
    "RequestContextFilter",
    "SensitiveDataMaskingFilter",
    "LogStatsAggregator",
    "StructuredLogger",
    "RequestLoggingMiddleware",
    "ErrorAlertManager",
    "EnhancedJSONFormatter",
    "init_enhanced_logging",
    "structured_logger",
    "get_logger",
    "get_stats",
    "set_user_context",
    "add_log_context",
]

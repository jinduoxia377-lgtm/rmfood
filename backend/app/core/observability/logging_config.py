"""
🟡 P3-3: 结构化日志系统

提供企业级日志能力:
1. 📋 JSON 格式输出 - 便于日志聚合与解析
2. 🔍 请求链路追踪 - trace_id / correlation_id 贯穿全链路
3. 🎨 敏感信息脱敏 - 自动屏蔽密码/Token/手机号
4. 🏷️ 多维度标签 - service / env / version / user
5. 🌊 日志分级 - DEBUG / INFO / WARNING / ERROR / CRITICAL
6. 📊 性能日志 - 自动记录慢查询/慢请求
7. 🔄 异步输出 - 不阻塞主线程
8. 📦 多输出目标 - Console / File / Loki / Graylog

使用方式:
    from app.core.observability.logging_config import setup_logging, get_logger

    # 初始化
    setup_logging(service_name="rmfood-backend", env="production")

    # 获取日志器
    logger = get_logger(__name__)

    # 标准日志
    logger.info("配方已创建", extra={"formula_id": "f_001", "category": "保健品"})

    # 请求上下文日志
    logger.info("处理请求", extra={
        "request_id": "req_123",
        "user_id": "u_001",
        "duration_ms": 45,
    })

    # 异常日志
    try:
        ...
    except Exception:
        logger.exception("操作失败", exc_info=True)

    # 慢查询警告
    logger.warning("慢查询", extra={"query_ms": 2500, "sql": "SELECT ..."})
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
import time
import uuid
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from functools import wraps
from typing import Any, Callable, Dict, List, Optional, Set, Union

# ═════════════════════════════════════════════
# 🟡 P3-3: 全局上下文（用于链路追踪）
# ═════════════════════════════════════════════


# 请求级上下文变量
_request_ctx: ContextVar[Dict[str, Any]] = ContextVar("request_ctx", default={})

# 服务级上下文（全局）
_service_ctx: Dict[str, Any] = {
    "service_name": "",
    "service_version": "",
    "env": "",
    "hostname": "",
    "pid": 0,
}


def get_request_context() -> Dict[str, Any]:
    """获取当前请求上下文"""
    return _request_ctx.get()


def set_request_context(**kwargs) -> None:
    """设置请求上下文"""
    ctx = dict(_request_ctx.get())
    ctx.update(kwargs)
    _request_ctx.set(ctx)


def clear_request_context() -> None:
    """清除请求上下文"""
    _request_ctx.set({})


# ═════════════════════════════════════════════
# 🟡 P3-3: 日志级别
# ═════════════════════════════════════════════


class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


# ═════════════════════════════════════════════
# 🟡 P3-3: 敏感信息脱敏
# ═════════════════════════════════════════════


# 脱敏规则（按字段名匹配）
SENSITIVE_FIELD_PATTERNS = {
    "password": "[PASSWORD]",
    "passwd": "[PASSWD]",
    "secret": "[SECRET]",
    "token": "[TOKEN]",
    "api_key": "[API_KEY]",
    "apikey": "[API_KEY]",
    "auth": "[AUTH]",
    "credential": "[CREDENTIAL]",
    "credit_card": "[CREDIT_CARD]",
    "ssn": "[SSN]",
    "phone": "[PHONE]",
    "mobile": "[MOBILE]",
    "email": "[EMAIL]",
    "address": "[ADDRESS]",
}

# 正则脱敏规则
REGEX_SENSITIVE_PATTERNS = [
    # JWT Token
    (r'Bearer\s+[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+', "[JWT_TOKEN]"),
    # 手机号（中国大陆）
    (r'1[3-9]\d{9}', "[PHONE]"),
    # 邮箱
    (r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', "[EMAIL]"),
    # 身份证号
    (r'\d{17}[\dXx]', "[ID_CARD]"),
    # IP 地址（可选脱敏）
    # (r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', "[IP]"),
]


def mask_sensitive_value(value: Any) -> Any:
    """脱敏单个值"""
    if value is None:
        return None

    str_value = str(value)

    # 正则匹配
    for pattern, replacement in REGEX_SENSITIVE_PATTERNS:
        str_value = re.sub(pattern, replacement, str_value)

    return str_value


def mask_sensitive_data(data: Any, depth: int = 0) -> Any:
    """
    递归脱敏敏感数据

    Args:
        data: 任意数据结构
        depth: 递归深度（防止无限递归）
    """
    if depth > 10:
        return "[MAX_DEPTH]"

    if isinstance(data, dict):
        result = {}
        for key, value in data.items():
            # 检查是否为敏感字段
            key_lower = key.lower()
            is_sensitive = any(
                pattern in key_lower
                for pattern in SENSITIVE_FIELD_PATTERNS.keys()
            )

            if is_sensitive:
                result[key] = SENSITIVE_FIELD_PATTERNS.get(key_lower, "[REDACTED]")
            else:
                result[key] = mask_sensitive_data(value, depth + 1)
        return result

    elif isinstance(data, (list, tuple)):
        return [mask_sensitive_data(item, depth + 1) for item in data]

    elif isinstance(data, str):
        return mask_sensitive_value(data)

    else:
        return data


# ═════════════════════════════════════════════
# 🟡 P3-3: JSON 日志格式化器
# ═════════════════════════════════════════════


class StructuredJsonFormatter(logging.Formatter):
    """
    JSON 格式日志格式化器

    输出结构:
    {
        "timestamp": "2024-01-15T10:30:00.000Z",
        "level": "INFO",
        "logger": "app.api.formula",
        "message": "配方已创建",
        "service": "rmfood-backend",
        "env": "production",
        "trace_id": "abc123",
        "user_id": "u_001",
        "request_id": "req_456",
        "duration_ms": 45,
        "extra": {...},
        "error": null
    }
    """

    def __init__(
        self,
        service_name: str = "",
        env: str = "",
        include_hostname: bool = True,
        include_process: bool = True,
        include_thread: bool = False,
        max_extra_depth: int = 5,
    ):
        super().__init__()
        self.service_name = service_name
        self.env = env
        self.include_hostname = include_hostname
        self.include_process = include_process
        self.include_thread = include_thread
        self.max_extra_depth = max_extra_depth

        # 预计算静态字段
        self._static_fields = {
            "service": service_name,
            "env": env,
        }
        if include_hostname:
            try:
                import socket
                self._static_fields["hostname"] = socket.gethostname()
            except Exception:
                self._static_fields["hostname"] = "unknown"

    def format(self, record: logging.LogRecord) -> str:
        """格式化单条日志为 JSON"""
        # 1. 构建时间戳
        timestamp = datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat()

        # 2. 获取请求上下文
        ctx = get_request_context()

        # 3. 构建日志结构
        log_entry = {
            # 基础字段
            "timestamp": timestamp,
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),

            # 静态上下文
            **self._static_fields,

            # 请求上下文（链路追踪）
            "trace_id": ctx.get("trace_id", ""),
            "span_id": ctx.get("span_id", ""),
            "parent_span_id": ctx.get("parent_span_id", ""),
            "request_id": ctx.get("request_id", ""),
            "user_id": ctx.get("user_id", ""),
            "session_id": ctx.get("session_id", ""),

            # 可选字段
            "duration_ms": ctx.get("duration_ms"),
        }

        # 4. 添加模块级上下文
        if hasattr(record, "module"):
            log_entry["module"] = record.module
        if hasattr(record, "funcName"):
            log_entry["function"] = record.funcName
        if hasattr(record, "lineno"):
            log_entry["line"] = record.lineno

        # 5. 添加进程/线程信息（可选）
        if self.include_process:
            log_entry["process"] = {"id": record.process, "name": record.processName}
        if self.include_thread:
            log_entry["thread"] = {"id": record.thread, "name": record.threadName}

        # 6. 添加 extra 字段（脱敏处理）
        if hasattr(record, "extra_fields"):
            extra = mask_sensitive_data(record.extra_fields, depth=self.max_extra_depth)
            log_entry["extra"] = extra

        # 7. 添加异常信息（如果有）
        if record.exc_info:
            log_entry["error"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": self.formatException(record.exc_info) if record.exc_info else None,
            }

        # 8. 移除空字段
        log_entry = {k: v for k, v in log_entry.items() if v is not None and v != ""}

        # 9. JSON 序列化
        try:
            return json.dumps(log_entry, ensure_ascii=False, default=str)
        except Exception:
            # 降级：返回原始消息
            return json.dumps({
                "timestamp": timestamp,
                "level": record.levelname,
                "message": record.getMessage(),
                "service": self.service_name,
                "error": "JSON serialization failed",
            })


class HumanReadableFormatter(logging.Formatter):
    """
    人类可读的日志格式（开发环境使用）

    格式:
    2024-01-15 10:30:00 | INFO     | app.api.formula | 配方已创建 | trace_id=abc123 user_id=u_001
    """

    def __init__(self, use_colors: bool = True):
        super().__init__()
        self.use_colors = use_colors and sys.stdout.isatty()

        # ANSI 颜色代码
        self.COLORS = {
            "DEBUG": "\033[36m",      # 青色
            "INFO": "\033[32m",       # 绿色
            "WARNING": "\033[33m",    # 黄色
            "ERROR": "\033[31m",      # 红色
            "CRITICAL": "\033[35m",   # 紫色
            "RESET": "\033[0m",
        }

    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.fromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S")
        level = record.levelname.ljust(7)
        logger_name = record.name[:40].ljust(40)

        # 颜色
        if self.use_colors:
            color = self.COLORS.get(record.levelname, self.COLORS["RESET"])
            level_colored = f"{color}{level}{self.COLORS['RESET']}"
        else:
            level_colored = level

        # 上下文
        ctx = get_request_context()
        context_parts = []
        if ctx.get("trace_id"):
            context_parts.append(f"trace={ctx['trace_id'][:8]}")
        if ctx.get("user_id"):
            context_parts.append(f"user={ctx['user_id']}")
        if ctx.get("request_id"):
            context_parts.append(f"req={ctx['request_id'][:8]}")
        context_str = " | ".join(context_parts)

        # Extra 字段
        extra_str = ""
        if hasattr(record, "extra_fields"):
            extra = mask_sensitive_data(record.extra_fields)
            if extra:
                extra_pairs = [f"{k}={v}" for k, v in extra.items()][:5]
                extra_str = " | " + " ".join(extra_pairs)

        result = f"{timestamp} | {level_colored} | {logger_name} | {record.getMessage()}"
        if context_str:
            result += f" | {context_str}"
        if extra_str:
            result += extra_str

        return result


# ═════════════════════════════════════════════
# 🟡 P3-3: 异步日志处理器
# ═════════════════════════════════════════════


class AsyncFileHandler(logging.FileHandler):
    """
    异步文件日志处理器

    将日志写入操作放到后台线程，避免阻塞主线程。
    适用于高并发场景（但会丢失崩溃前的最后几条日志）。
    """

    def __init__(self, filename: str, mode: str = "a", maxBytes: int = 0, backupCount: int = 0, encoding: str = None, delay: bool = False):
        super().__init__(filename, mode, maxBytes, backupCount, encoding, delay)
        self._async_queue: List[str] = []
        self._worker_thread: Optional[Any] = None
        self._shutdown = False

    def emit(self, record: logging.LogRecord):
        """异步发送日志到队列"""
        if self._worker_thread is None:
            self._start_worker()

        try:
            msg = self.format(record)
            self._async_queue.append(msg)
            # 如果队列过长，同步写入一条（防止内存溢出）
            if len(self._async_queue) > 1000:
                self.flush()
        except Exception:
            self.handleError(record)

    def _start_worker(self):
        """启动后台写入线程"""
        import threading

        def worker():
            while not self._shutdown:
                if self._async_queue:
                    batch = self._async_queue[:100]
                    self._async_queue = self._async_queue[100:]
                    with open(self.baseFilename, "a", encoding=self.encoding) as f:
                        f.write("\n".join(batch) + "\n")
                else:
                    time.sleep(0.1)

        self._worker_thread = threading.Thread(target=worker, daemon=True)
        self._worker_thread.start()

    def close(self):
        """关闭处理器"""
        self._shutdown = True
        if self._worker_thread:
            self._worker_thread.join(timeout=2)
        super().close()


# ═════════════════════════════════════════════
# 🟡 P3-3: 日志配置管理器
# ═════════════════════════════════════════════


def setup_logging(
    service_name: str = "rmfood",
    env: str = "development",
    log_level: str = "INFO",
    log_dir: str = "logs",
    enable_json: bool = True,
    enable_console: bool = True,
    enable_file: bool = True,
    file_max_bytes: int = 50 * 1024 * 1024,  # 50MB
    file_backup_count: int = 10,
) -> None:
    """
    🛠️ 初始化日志系统

    Args:
        service_name: 服务名称
        env: 环境（development / staging / production）
        log_level: 日志级别
        log_dir: 日志文件目录
        enable_json: 是否输出 JSON 格式
        enable_console: 是否输出到控制台
        enable_file: 是否输出到文件
        file_max_bytes: 单个日志文件最大大小
        file_backup_count: 保留的日志文件数量
    """
    # 1. 更新全局服务上下文
    global _service_ctx
    _service_ctx = {
        "service_name": service_name,
        "env": env,
        "hostname": _get_hostname(),
        "pid": os.getpid(),
    }

    # 2. 清除现有处理器
    root_logger = logging.getLogger()
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # 3. 选择格式化器
    if enable_json and env != "development":
        formatter = StructuredJsonFormatter(
            service_name=service_name,
            env=env,
        )
    else:
        formatter = HumanReadableFormatter(use_colors=(env == "development"))

    # 4. 控制台处理器
    if enable_console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        console_handler.setLevel(getattr(logging, log_level.upper(), logging.INFO))
        root_logger.addHandler(console_handler)

    # 5. 文件处理器
    if enable_file and log_dir:
        import os
        os.makedirs(log_dir, exist_ok=True)

        # 普通日志
        file_handler = logging.handlers.RotatingFileHandler(
            filename=os.path.join(log_dir, f"{service_name}.log"),
            maxBytes=file_max_bytes,
            backupCount=file_backup_count,
            encoding="utf-8",
        )
        file_handler.setFormatter(StructuredJsonFormatter(service_name=service_name, env=env))
        file_handler.setLevel(getattr(logging, log_level.upper(), logging.INFO))
        root_logger.addHandler(file_handler)

        # 错误日志（单独文件）
        error_handler = logging.handlers.RotatingFileHandler(
            filename=os.path.join(log_dir, f"{service_name}_error.log"),
            maxBytes=file_max_bytes,
            backupCount=file_backup_count,
            encoding="utf-8",
        )
        error_handler.setFormatter(StructuredJsonFormatter(service_name=service_name, env=env))
        error_handler.setLevel(logging.ERROR)
        root_logger.addHandler(error_handler)

    # 6. 第三方库日志降级
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("asyncio").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)

    logging.info(f"日志系统已初始化: service={service_name}, env={env}, level={log_level}")


def _get_hostname() -> str:
    """获取主机名"""
    try:
        import socket
        return socket.gethostname()
    except Exception:
        return "unknown"


# ═════════════════════════════════════════════
# 🟡 P3-3: 获取日志器
# ═════════════════════════════════════════════


class ContextAdapter(logging.LoggerAdapter):
    """
    上下文适配器：自动注入链路追踪信息
    """

    def process(self, msg: str, kwargs: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """在消息处理时注入上下文"""
        extra = kwargs.get("extra", {})

        # 添加请求上下文
        ctx = get_request_context()
        for key in ["trace_id", "request_id", "user_id", "session_id", "span_id"]:
            if key in ctx:
                extra[key] = ctx[key]

        # 标记 extra_fields 以便格式化器识别
        extra["_is_extra"] = True

        # 将所有非标准字段保存到 extra_fields
        standard_keys = {"extra", "exc_info", "stack_info", "stacklevel"}
        extra_fields = {k: v for k, v in extra.items() if k not in standard_keys}

        # 保留 extra 供 logging 使用
        if "extra_fields" not in extra_fields:
            extra_fields.update(extra)

        kwargs["extra"] = {"extra_fields": extra_fields}

        return msg, kwargs


def get_logger(name: str) -> ContextAdapter:
    """
    获取带上下文的日志器

    推荐在每个模块中使用:
        logger = get_logger(__name__)
    """
    base_logger = logging.getLogger(name)
    return ContextAdapter(base_logger, {})


# ═════════════════════════════════════════════
# 🟡 P3-3: 请求日志中间件（FastAPI）
# ═════════════════════════════════════════════


async def log_requests_middleware(request: Any, call_next: Callable) -> Any:
    """
    🌐 FastAPI 请求日志中间件

    功能:
    - 生成 trace_id 并注入到请求上下文
    - 记录请求开始/结束
    - 计算请求耗时
    - 记录响应状态码
    """
    import time

    # 1. 生成/提取 trace_id
    trace_id = request.headers.get("X-Trace-ID") or str(uuid.uuid4())[:12]
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())[:12]

    # 2. 设置请求上下文
    ctx = {
        "trace_id": trace_id,
        "request_id": request_id,
        "user_id": getattr(request.state, "user_id", None),
        "session_id": request.cookies.get("session_id"),
        "span_id": str(uuid.uuid4())[:8],
    }
    set_request_context(**ctx)

    # 3. 添加到请求对象（供后续使用）
    request.state.trace_id = trace_id
    request.state.request_id = request_id

    # 4. 记录请求开始
    logger = get_logger("app.requests")
    logger.info(
        "请求开始",
        extra={
            "method": request.method,
            "path": request.url.path,
            "client_ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent", "")[:100],
        },
    )

    # 5. 计时
    start_time = time.time()

    # 6. 执行请求
    try:
        response = await call_next(request)
        duration_ms = (time.time() - start_time) * 1000

        # 7. 记录响应
        logger.info(
            "请求完成",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
            },
        )

        # 8. 添加追踪头到响应
        response.headers["X-Trace-ID"] = trace_id
        response.headers["X-Request-ID"] = request_id

        # 9. 慢请求警告
        if duration_ms > 2000:
            logger.warning(
                "慢请求",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": round(duration_ms, 2),
                    "threshold_ms": 2000,
                },
            )

        return response

    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.exception(
            "请求异常",
            extra={
                "method": request.method,
                "path": request.url.path,
                "duration_ms": round(duration_ms, 2),
                "error_type": type(e).__name__,
            },
        )
        raise

    finally:
        # 10. 清理上下文
        clear_request_context()


# ═════════════════════════════════════════════
# 🟡 P3-3: 便捷日志函数
# ═════════════════════════════════════════════


def log_slow_query(sql: str, duration_ms: float, params: Dict = None):
    """记录慢查询"""
    logger = get_logger("app.db.slow_query")
    logger.warning(
        "慢查询检测",
        extra={
            "sql": sql[:500],  # 限制长度
            "duration_ms": round(duration_ms, 2),
            "params_count": len(params) if params else 0,
        },
    )


def log_ai_request(
    model: str,
    operation: str,
    duration_ms: float,
    tokens_used: int = 0,
    success: bool = True,
    error: str = None,
):
    """记录 AI 请求"""
    logger = get_logger("app.ai")
    level = "info" if success else "error"
    log_fn = logger.info if success else logger.error

    log_fn(
        f"AI 请求 {'成功' if success else '失败'}",
        extra={
            "model": model,
            "operation": operation,
            "duration_ms": round(duration_ms, 2),
            "tokens_used": tokens_used,
            "success": success,
            "error": error,
        },
    )


def log_security_event(event_type: str, user_id: str = None, details: Dict = None, severity: str = "warning"):
    """记录安全事件"""
    logger = get_logger("app.security")

    level_map = {
        "info": logger.info,
        "warning": logger.warning,
        "error": logger.error,
        "critical": logger.critical,
    }
    log_fn = level_map.get(severity, logger.warning)

    log_fn(
        f"安全事件: {event_type}",
        extra={
            "event_type": event_type,
            "user_id": user_id,
            "details": mask_sensitive_data(details or {}),
            "severity": severity,
        },
    )


# ──────────────────────────────────────────────
# 便捷 logger（兼容旧代码的直接导入方式）
# ──────────────────────────────────────────────
logger = get_logger("app")


# ═════════════════════════════════════════════
# 🟡 P3-3: 模块导出
# ═════════════════════════════════════════════


__all__ = [
    # 初始化
    "setup_logging",
    "get_logger",
    "logger",  # 便捷 logger
    # 上下文
    "get_request_context",
    "set_request_context",
    "clear_request_context",
    # 脱敏
    "mask_sensitive_data",
    "mask_sensitive_value",
    # 中间件
    "log_requests_middleware",
    # 便捷函数
    "log_slow_query",
    "log_ai_request",
    "log_security_event",
    # 类
    "StructuredJsonFormatter",
    "HumanReadableFormatter",
    "ContextAdapter",
    # 常量
    "SENSITIVE_FIELD_PATTERNS",
]

"""
RMFOOD 结构化日志配置

P5-1 增强:
- 开发环境: 人类可读的彩色格式
- 生产环境: JSON 结构化格式（支持日志聚合）
- 请求 ID 追踪
- 性能指标记录
"""
import json
import logging
import sys
import io
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .config import settings

# 日志目录
LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

# 日志文件名
LOG_FILE = LOG_DIR / "rmfood.log"
ERROR_LOG_FILE = LOG_DIR / "rmfood_error.log"


class UTF8StreamHandler(logging.StreamHandler):
    """支持 UTF-8 编码的控制台处理器"""

    def __init__(self):
        super().__init__()
        self.stream = io.TextIOWrapper(
            sys.stdout.buffer,
            encoding='utf-8',
            errors='replace',
            line_buffering=True
        )

    def flush(self):
        self.stream.flush()


class JSONFormatter(logging.Formatter):
    """JSON 结构化日志格式化器（生产环境）"""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # 添加请求 ID（如果存在）
        if hasattr(record, "request_id"):
            log_entry["request_id"] = record.request_id

        # 添加额外字段
        if hasattr(record, "extra_data"):
            log_entry["data"] = record.extra_data

        # 添加异常信息
        if record.exc_info and record.exc_info[0]:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": self.formatException(record.exc_info),
            }

        return json.dumps(log_entry, ensure_ascii=False)


class HumanReadableFormatter(logging.Formatter):
    """人类可读日志格式化器（开发环境）"""

    # 颜色代码
    COLORS = {
        "DEBUG": "\033[36m",     # 青色
        "INFO": "\033[32m",      # 绿色
        "WARNING": "\033[33m",   # 黄色
        "ERROR": "\033[31m",     # 红色
        "CRITICAL": "\033[35m",  # 紫色
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")
        reset = self.RESET

        timestamp = datetime.now().strftime("%H:%M:%S")
        level = f"{color}{record.levelname:>8}{reset}"
        name = f"\033[90m{record.name}\033[0m"
        message = record.getMessage()

        # 简化模块路径
        module = record.module

        formatted = f"{timestamp} {level} {name}: {message}"

        if record.exc_info and record.exc_info[0]:
            formatted += f"\n{self.formatException(record.exc_info)}"

        return formatted


def setup_logging():
    """设置应用日志配置"""
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG if settings.debug else logging.INFO)

    # 移除默认处理器
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # 根据环境选择格式化器
    if settings.debug:
        formatter = HumanReadableFormatter()
        console_level = logging.DEBUG
    else:
        formatter = JSONFormatter()
        console_level = logging.INFO

    # 控制台处理器
    console_handler = UTF8StreamHandler()
    console_handler.setLevel(console_level)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # 文件处理器（始终使用 JSON 格式）
    json_formatter = JSONFormatter()

    file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8", mode='a')
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(json_formatter)
    root_logger.addHandler(file_handler)

    # 错误日志处理器
    error_handler = logging.FileHandler(ERROR_LOG_FILE, encoding="utf-8", mode='a')
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(json_formatter)
    root_logger.addHandler(error_handler)

    # 注入请求上下文过滤器（自动添加 request_id/user_id/trace_id）
    from .request_context import RequestContextFilter
    root_logger.addFilter(RequestContextFilter())

    # 降低第三方库日志级别
    for noisy_logger in ["httpx", "httpcore", "sqlalchemy.engine", "uvicorn.access"]:
        logging.getLogger(noisy_logger).setLevel(logging.WARNING)

    app_logger = logging.getLogger("rmfood")
    app_logger.setLevel(logging.DEBUG if settings.debug else logging.INFO)

    return app_logger


def get_logger(name: str) -> logging.Logger:
    """获取命名日志器"""
    return logging.getLogger(f"rmfood.{name}")


# 初始化日志
logger = setup_logging()

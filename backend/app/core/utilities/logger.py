"""
RMFOOD Logger 模块
提供统一的日志记录器实例
"""
import logging
from typing import Optional

# 创建应用专用的 logger
logger = logging.getLogger("rmfood")

# 设置默认日志级别
logger.setLevel(logging.DEBUG)

# 防止重复添加处理器
if not logger.handlers:
    # 控制台处理器
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)

    # 格式化器
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """
    获取 logger 实例

    Args:
        name: 可选的子 logger 名称

    Returns:
        logging.Logger: logger 实例
    """
    if name:
        return logging.getLogger(f"rmfood.{name}")
    return logger


class LoggerContext:
    """Logger 上下文管理器，用于添加额外的上下文信息"""

    def __init__(self, **context):
        self.context = context
        self.logger = logger

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.logger.error(
                "Error occurred",
                extra=self.context,
                exc_info=(exc_type, exc_val, exc_tb)
            )
        return False


def startTimer(operation_name: str) -> 'Timer':
    """
    创建计时器用于性能监控

    Args:
        operation_name: 操作名称

    Returns:
        Timer: 计时器对象
    """
    return Timer(operation_name)


class Timer:
    """简单的计时器类"""

    def __init__(self, operation_name: str):
        self.operation_name = operation_name
        self.start_time = None
        self.logger = logger

    def __enter__(self):
        import time
        self.start_time = time.time()
        self.logger.info(f"开始 {self.operation_name}")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        import time
        elapsed = (time.time() - self.start_time) * 1000
        if exc_type:
            self.logger.error(f"{self.operation_name} 失败，耗时 {elapsed:.2f}ms")
        else:
            self.logger.info(f"{self.operation_name} 完成，耗时 {elapsed:.2f}ms")
        return False

    def end(self):
        """手动结束计时"""
        if self.start_time:
            import time
            elapsed = (time.time() - self.start_time) * 1000
            self.logger.info(f"{self.operation_name} 耗时 {elapsed:.2f}ms")
            self.start_time = None


__all__ = ['logger', 'get_logger', 'LoggerContext', 'startTimer', 'Timer']

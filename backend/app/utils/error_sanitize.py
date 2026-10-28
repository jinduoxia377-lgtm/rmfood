"""
统一异常消息脱敏工具

防止异常详细信息（内部路径、SQL 片段、依赖版本等）泄露到用户响应中。
所有业务代码应使用 sanitize_error() 替代 str(e)。
"""

import re
from typing import Optional

# 可能泄露敏感信息的模式
_SENSITIVE_PATTERNS = [
    # 内部文件路径
    (re.compile(r'(?:C:[\\/]Users[\\/][^\\"]+|[\\/](?:home|var)[\\/][^\\"]+[\\/]app)', re.IGNORECASE), '[内部路径已隐藏]'),
    # 数据库连接字符串
    (re.compile(r'(?:postgres|postgresql|mysql|sqlite)://[^\\s"\']+', re.IGNORECASE), '[数据库连接已隐藏]'),
    # SQL 片段（表名、列名）
    (re.compile(r'(?:FROM|JOIN|WHERE|INSERT|UPDATE|DELETE|CREATE|ALTER)\s+\w+', re.IGNORECASE), '[SQL语句已隐藏]'),
    # 依赖版本
    (re.compile(r'[a-zA-Z0-9_-]+\s+(?:==|>=|<=|>|<)\s*\d+\.\d+\.\d+'), '[依赖版本已隐藏]'),
    # UUID（可能是内部标识符）
    (re.compile(r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b'), '[UUID已隐藏]'),
]

# 默认用户消息（当异常信息被认为不安全时使用）
_DEFAULT_USER_MESSAGE = "操作失败，请稍后重试。如问题持续请联系技术支持。"

# 最大用户可见消息长度
_MAX_USER_MESSAGE_LENGTH = 200


def sanitize_error(error: BaseException, default: Optional[str] = None) -> str:
    """
    对异常消息进行脱敏处理，返回安全的用户可见消息。

    Args:
        error: 异常对象
        default: 脱敏后的默认消息

    Returns:
        脱敏后的字符串，不超过 MAX_USER_MESSAGE_LENGTH 字符
    """
    msg = str(error)
    if not msg:
        return default or _DEFAULT_USER_MESSAGE

    # 对敏感模式进行替换
    sanitized = msg
    for pattern, replacement in _SENSITIVE_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)

    # 截断过长的消息
    if len(sanitized) > _MAX_USER_MESSAGE_LENGTH:
        sanitized = sanitized[:_MAX_USER_MESSAGE_LENGTH] + "..."

    return sanitized


def is_error_safe(error: BaseException) -> bool:
    """
    判断异常消息是否已经安全（不含敏感信息）。

    Args:
        error: 异常对象

    Returns:
        True 如果消息安全，False 如果可能泄露敏感信息
    """
    msg = str(error).lower()
    sensitive_indicators = [
        'c:\\users\\', '/home/', '/var/',  # 路径
        'postgres://', 'mysql://', 'sqlite',  # 数据库连接
        'from ', 'join ', 'where ',  # SQL 关键字
        '==', '>=', '<=',  # 版本号
        'traceback', 'stacktrace',  # 堆栈信息
        'secret', 'token', 'api_key', 'password',  # 敏感字段名
    ]
    return not any(indicator in msg for indicator in sensitive_indicators)


def truncate_message(msg: str, max_length: int = _MAX_USER_MESSAGE_LENGTH) -> str:
    """截断消息到指定长度"""
    if len(msg) <= max_length:
        return msg
    return msg[:max_length] + "..."

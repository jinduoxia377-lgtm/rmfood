"""
企业级全局异常处理器 — 兼容层

P1-5 架构统一:
异常处理已合并到 app/core/exceptions.py（GlobalExceptionHandler 中间件）。
本模块保留为兼容层，re-export 所有异常类。
新代码应直接从 app.core.exceptions 导入。
"""

# ── Re-export 所有异常类（保持向后兼容） ──
from .exceptions import (
    AIServiceUnavailableError,
    AppError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    DeviceNotRegisteredError,
    FormulaAnalysisError,
    GlobalExceptionHandler,
    NotFoundError,
    PeptideAnalysisError,
    PermissionDeniedError,
    PermissionDeniedException,
    QuotaExceededError,
    RateLimitError,
    RateLimitExceededError,
    ResourceNotFoundException,
    ServiceUnavailableError,
    SyncConflictError,
    TeamAccessDeniedError,
    TokenExpiredError,
    ValidationError,
    VersionNotFoundError,
)

__all__ = [
    "AppError",
    "AuthenticationError",
    "TokenExpiredError",
    "AuthorizationError",
    "ValidationError",
    "NotFoundError",
    "ConflictError",
    "RateLimitError",
    "ServiceUnavailableError",
    "PeptideAnalysisError",
    "FormulaAnalysisError",
    "SyncConflictError",
    "PermissionDeniedError",
    "RateLimitExceededError",
    "DeviceNotRegisteredError",
    "TeamAccessDeniedError",
    "AIServiceUnavailableError",
    "VersionNotFoundError",
    "ResourceNotFoundException",
    "PermissionDeniedException",
    "QuotaExceededError",
    "GlobalExceptionHandler",
    "register_exception_handlers",
]


def register_exception_handlers(app):
    """
    兼容函数 — 不再需要单独注册。

    异常处理已由 GlobalExceptionHandler 中间件统一处理。
    保留此函数以兼容现有调用代码。
    """
    pass

"""
统一异常定义
所有业务异常的基类和具体异常类型
"""

from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import status


class PeptideAnalysisError(Exception):
    """肽分析基础异常"""

    def __init__(
        self,
        code: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        status_code: int = status.HTTP_400_BAD_REQUEST
    ):
        self.code = code
        self.message = message
        self.details = details or {}
        self.status_code = status_code
        super().__init__(self.message)


class SequenceValidationError(PeptideAnalysisError):
    """序列验证错误"""

    def __init__(self, sequence: str, reason: str):
        super().__init__(
            code="INVALID_SEQUENCE",
            message=f"序列 '{sequence}' 无效: {reason}",
            details={"sequence": sequence, "reason": reason},
            status_code=status.HTTP_400_BAD_REQUEST
        )


class PeptideConversionError(PeptideAnalysisError):
    """SMILES转换错误"""

    def __init__(self, sequence: str, reason: str):
        super().__init__(
            code="CONVERSION_FAILED",
            message=f"序列 '{sequence}' 转换失败: {reason}",
            details={"sequence": sequence, "reason": reason},
            status_code=status.HTTP_400_BAD_REQUEST
        )


class MissingDependencyError(PeptideAnalysisError):
    """依赖缺失错误"""

    def __init__(self, dependency: str):
        super().__init__(
            code="MISSING_DEPENDENCY",
            message=f"缺少必要依赖: {dependency}",
            details={"dependency": dependency},
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE
        )


class ExternalServiceError(PeptideAnalysisError):
    """外部服务错误"""

    def __init__(self, service: str, reason: str, original_error: Optional[Exception] = None):
        super().__init__(
            code="EXTERNAL_SERVICE_ERROR",
            message=f"外部服务 '{service}' 调用失败: {reason}",
            details={
                "service": service,
                "reason": reason,
                "original_error": str(original_error) if original_error else None
            },
            status_code=status.HTTP_502_BAD_GATEWAY
        )


class DatabaseError(PeptideAnalysisError):
    """数据库错误"""

    def __init__(self, operation: str, reason: str):
        super().__init__(
            code="DATABASE_ERROR",
            message=f"数据库操作 '{operation}' 失败: {reason}",
            details={"operation": operation, "reason": reason},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class RateLimitError(PeptideAnalysisError):
    """速率限制错误"""

    def __init__(self, retry_after: int = 60):
        super().__init__(
            code="RATE_LIMITED",
            message=f"请求过于频繁，请在 {retry_after} 秒后重试",
            details={"retry_after": retry_after},
            status_code=status.HTTP_429_TOO_MANY_REQUESTS
        )


class InternalError(PeptideAnalysisError):
    """内部错误"""

    def __init__(self, message: str, original_error: Optional[Exception] = None):
        super().__init__(
            code="INTERNAL_ERROR",
            message=f"内部错误: {message}",
            details={
                "original_error": str(original_error) if original_error else None
            },
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# 错误码映射 (用于快速查找)
ERROR_CODES = {
    "INVALID_SEQUENCE": SequenceValidationError,
    "CONVERSION_FAILED": PeptideConversionError,
    "MISSING_DEPENDENCY": MissingDependencyError,
    "EXTERNAL_SERVICE_ERROR": ExternalServiceError,
    "DATABASE_ERROR": DatabaseError,
    "RATE_LIMITED": RateLimitError,
    "INTERNAL_ERROR": InternalError,
}


def create_error_response(
    code: str,
    message: str,
    details: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """创建统一错误响应格式"""
    return {
        "success": False,
        "code": code,
        "message": message,
        "details": details or {},
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

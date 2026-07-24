"""统一 AI 错误处理体系 (v1.0)

所有 AI 模块的错误码和异常类。
"""

class AIException(Exception):
    """AI 服务统一异常基类"""
    def __init__(self, message: str, code: str = "AI_ERROR", details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}

    def to_dict(self) -> dict:
        return {
            "error": self.message,
            "code": self.code,
            "details": self.details,
        }


class AIAuthenticationError(AIException):
    """认证错误"""
    def __init__(self, message: str = "认证失败"):
        super().__init__(message, code="AUTH_ERROR", details={"hint": "请检查 API Key 是否有效"})


class AIRateLimitError(AIException):
    """速率限制"""
    def __init__(self, message: str = "请求过于频繁"):
        super().__init__(message, code="RATE_LIMIT", details={"retry_after": 60})


class AIModelUnavailableError(AIException):
    """模型不可用"""
    def __init__(self, model: str = "unknown"):
        super().__init__(f"模型 {model} 不可用", code="MODEL_UNAVAILABLE", details={"model": model})


class AIValidationError(AIException):
    """输入验证错误"""
    def __init__(self, message: str, field: str = ""):
        details = {"field": field} if field else {}
        super().__init__(message, code="VALIDATION_ERROR", details=details)


class AIRAGError(AIException):
    """RAG 知识库错误"""
    def __init__(self, message: str, reason: str = ""):
        details = {"reason": reason} if reason else {}
        super().__init__(message, code="RAG_ERROR", details=details)


class AISafetyError(AIException):
    """安全合规错误"""
    def __init__(self, message: str, severity: str = "warning"):
        super().__init__(message, code="SAFETY_ERROR", details={"severity": severity})

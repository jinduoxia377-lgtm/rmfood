"""核心异常类定义"""
from app.core.api_framework.api_contract import NotFoundError, ValidationFailedError


class ResourceNotFoundError(NotFoundError):
    """资源未找到异常"""
    pass


class InvalidStatusTransitionError(Exception):
    """无效状态转换异常"""
    pass


class ValidationError(ValidationFailedError):
    """验证异常"""
    pass

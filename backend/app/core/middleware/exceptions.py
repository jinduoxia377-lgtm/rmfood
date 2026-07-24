"""
全局异常处理中间件

将所有业务异常转换为合适的HTTP状态码，避免500错误
"""

import logging
import time
import traceback
import uuid
from typing import Optional

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic_core import ValidationError as PydanticValidationError

from app.utils.error_sanitize import sanitize_error


logger = logging.getLogger(__name__)


class GlobalExceptionHandler(BaseHTTPMiddleware):
    """
    全局异常处理中间件
    
    功能:
    1. 捕获所有未处理的异常
    2. 将业务异常转换为合适的HTTP状态码
    3. 记录详细的错误日志
    4. 返回用户友好的错误信息
    """
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        try:
            response = await call_next(request)
            
            # 记录响应时间
            process_time = time.time() - start_time
            response.headers["X-Process-Time"] = str(process_time)
            
            # 如果响应已经是错误状态，记录日志
            if response.status_code >= 400:
                await self._log_error_response(request, response, process_time)
            
            return response
            
        except Exception as exc:
            # 捕获所有未处理的异常
            return await self._handle_exception(request, exc, start_time)
    
    async def _handle_exception(self, request: Request, exception: Exception, start_time: float):
        """处理异常并返回适当的响应"""
        
        process_time = time.time() - start_time
        url = request.url.path
        method = request.method
        
        # 根据异常类型确定HTTP状态码和消息
        status_code, error_detail = self._classify_exception(exception)
        
        # 记录详细错误日志
        logger.error(
            f"[GlobalException] {method} {url} -> {status_code}\n"
            f"异常类型: {type(exception).__name__}\n"
            f"异常消息: {str(exception)}\n"
            f"堆栈跟踪:\n{traceback.format_exc()}\n"
            f"处理时间: {process_time:.3f}s"
        )
        
        # 返回JSON格式的错误响应
        error_code = getattr(exception, 'error_code', f"ERROR_{status_code}")
        raw_details = getattr(exception, 'details', None)
        # 脱敏 details 字段，防止内部信息泄露
        details = None
        if raw_details and isinstance(raw_details, dict):
            details = {k: sanitize_error(type('', (), {'__str__': lambda s: str(v)})(), str(v)[:50]) if isinstance(v, (str, Exception)) else v for k, v in raw_details.items()}
        elif raw_details:
            details = str(raw_details)[:200]
        retry_after = getattr(exception, 'retry_after', None)
        request_id = getattr(request.state, 'request_id', str(uuid.uuid4())[:12])

        response_content = {
            "success": False,
            "error": error_detail,
            "code": status_code,
            "error_code": error_code,
            "details": details if details else None,
            "request_id": request_id,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }

        if retry_after:
            response_content["retry_after"] = retry_after

        return JSONResponse(
            status_code=status_code,
            content=response_content,
        )
    
    def _classify_exception(self, exception: Exception) -> tuple:
        """
        分类异常并返回适当的状态码和消息

        Returns:
            tuple: (status_code, error_message)
        """
        from app.core.middleware.exceptions import (
            AuthenticationError,
            TokenExpiredError,
            AuthorizationError,
            ValidationError,
            NotFoundError,
            ConflictError,
            RateLimitError,
            ServiceUnavailableError,
            # 新增异常
            SyncConflictError,
            PermissionDeniedError,
            RateLimitExceededError,
            DeviceNotRegisteredError,
            TeamAccessDeniedError,
            AIServiceUnavailableError,
            VersionNotFoundError,
        )

        # Pydantic 验证错误 -> 422
        if isinstance(exception, PydanticValidationError):
            return 422, sanitize_error(exception, "数据验证失败")

        # 认证相关异常 -> 401
        if isinstance(exception, (AuthenticationError, TokenExpiredError)):
            return 401, "认证失败，请重新登录"

        # 授权/权限异常 -> 403
        if isinstance(exception, (AuthorizationError, PermissionDeniedError, TeamAccessDeniedError)):
            return 403, getattr(exception, 'message', "权限不足，无法访问此资源")

        # 验证异常 -> 400
        if isinstance(exception, ValidationError):
            return 400, sanitize_error(exception, "请求参数无效，请检查后重试")

        # 未找到异常 -> 404
        if isinstance(exception, (NotFoundError, VersionNotFoundError, DeviceNotRegisteredError)):
            return 404, getattr(exception, 'message', "请求的资源不存在")

        # 冲突异常（含同步冲突）-> 409
        if isinstance(exception, (ConflictError, SyncConflictError)):
            return 409, getattr(exception, 'message', "资源冲突，请刷新后重试")

        # 限流异常 -> 429
        if isinstance(exception, (RateLimitError, RateLimitExceededError)):
            return 429, getattr(exception, 'message', "请求过于频繁，请稍后再试")

        # AI服务不可用 -> 503
        if isinstance(exception, AIServiceUnavailableError):
            return 503, getattr(exception, 'message', "AI服务暂时不可用，请稍后再试")

        # AI认证错误 -> 401
        if isinstance(exception, AIAuthenticationError):
            return 401, getattr(exception, 'message', "AI API Key 无效或过期")

        # AI限流 -> 429
        if isinstance(exception, AIRateLimitError):
            return 429, getattr(exception, 'message', "AI 请求过于频繁")

        # AI验证错误 -> 400
        if isinstance(exception, AIValidationError):
            return 400, getattr(exception, 'message', "AI 请求参数无效")

        # 服务不可用异常 -> 503
        if isinstance(exception, ServiceUnavailableError):
            return 503, "服务暂时不可用，请稍后再试"

        # AppError（通用业务异常）-> 使用异常自身的 status_code
        if isinstance(exception, AppError):
            return exception.status_code, exception.message

        # HTTPException (FastAPI内置) -> 保持原状态码，但脱敏消息
        if isinstance(exception, HTTPException):
            detail = exception.detail
            if isinstance(detail, str):
                detail = sanitize_error(type('', (), {'__str__': lambda s: detail})(), "服务器内部错误")
            return exception.status_code, detail

        # 数据库相关异常 -> 根据具体类型返回不同状态码
        from app.core.database.session import DatabaseConnectionError, DatabaseQueryError, DatabasePoolExhaustedError
        
        if isinstance(exception, DatabaseConnectionError):
            return 503, "数据库连接异常，请稍后再试"
        if isinstance(exception, DatabasePoolExhaustedError):
            return 503, "数据库连接池已满，请稍后再试"
        if isinstance(exception, DatabaseQueryError):
            return 400, "数据库查询异常，请检查请求参数"
        
        # 其他数据库相关异常 -> 503 服务不可用
        exception_str = str(exception).lower()
        if any(keyword in exception_str for keyword in [
            'database', 'sql', 'connection', 'timeout', 'operational', 'asyncpg'
        ]):
            return 503, "数据库服务暂时不可用，请稍后再试"

        # 默认 -> 500 服务器错误
        return 500, "服务器内部错误，请稍后再试"
    
    async def _log_error_response(self, request: Request, response, process_time: float):
        """记录错误响应"""
        url = request.url.path
        method = request.method
        
        if response.status_code >= 500:
            logger.error(
                f"[ErrorResponse] {method} {url} -> {response.status_code} "
                f"(耗时 {process_time:.3f}s)"
            )
        elif response.status_code >= 400:
            logger.warning(
                f"[ClientError] {method} {url} -> {response.status_code} "
                f"(耗时 {process_time:.3f}s)"
            )


# ============================================================
# 自定义业务异常类
# ============================================================

class AuthenticationError(Exception):
    """认证失败"""
    pass

class TokenExpiredError(AuthenticationError):
    """Token已过期"""
    pass

class AuthorizationError(Exception):
    """权限不足"""
    pass

class ValidationError(Exception):
    """验证错误"""
    pass

class NotFoundError(Exception):
    """资源不存在"""
    pass

class ConflictError(Exception):
    """资源冲突"""
    pass

class RateLimitError(Exception):
    """请求频率限制"""
    pass

class ServiceUnavailableError(Exception):
    """服务不可用"""
    pass

class PeptideAnalysisError(Exception):
    """肽分析错误"""
    pass

class FormulaAnalysisError(Exception):
    """配方分析错误"""
    pass


# ============================================================
# 新增：云端同步、团队协作、AI助手模块专用异常
# ============================================================

class SyncConflictError(Exception):
    """数据同步冲突"""
    def __init__(self, message="检测到数据冲突", error_code="SYNC_CONFLICT_001", details=None):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.details = details or []


class PermissionDeniedError(Exception):
    """权限被拒绝"""
    def __init__(self, message="权限不足，无法执行此操作", error_code="PERMISSION_DENIED_001", required_role=None):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.required_role = required_role


class RateLimitExceededError(Exception):
    """请求频率超限"""
    def __init__(self, message="请求过于频繁，请稍后再试", error_code="RATE_LIMIT_001", retry_after=60):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.retry_after = retry_after


class DeviceNotRegisteredError(Exception):
    """设备未注册"""
    def __init__(self, device_id=None, message="设备未注册"):
        super().__init__(message)
        self.device_id = device_id
        self.message = message
        self.error_code = "DEVICE_NOT_FOUND_001"


class TeamAccessDeniedError(Exception):
    """团队访问被拒绝"""
    def __init__(self, team_id=None, message="您没有访问该团队的权限"):
        super().__init__(message)
        self.team_id = team_id
        self.message = message
        self.error_code = "TEAM_ACCESS_DENIED_001"


class AIServiceUnavailableError(Exception):
    """AI服务不可用"""
    def __init__(self, message="AI服务暂时不可用", error_code="AI_SERVICE_001", suggestion=None):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.suggestion = suggestion or "请稍后重试或联系技术支持"


class AIAuthenticationError(AIServiceUnavailableError):
    """AI认证失败"""
    def __init__(self, message="AI API Key 无效或过期"):
        super().__init__(message, "AI_AUTH_001", "请检查配置管理中的 API Key")


class AIRateLimitError(AIServiceUnavailableError):
    """AI请求限流"""
    def __init__(self, message="AI 请求过于频繁"):
        super().__init__(message, "AI_RATE_LIMIT_001", "请稍后再试")


class AIValidationError(AIServiceUnavailableError):
    """AI输入验证错误"""
    def __init__(self, message="AI 请求参数无效", field: str = ""):
        super().__init__(message, "AI_VALIDATION_001")
        self.field = field


class VersionNotFoundError(Exception):
    """版本不存在"""
    def __init__(self, version_id=None, message="指定的版本不存在"):
        super().__init__(message)
        self.version_id = version_id
        self.message = message
        self.error_code = "VERSION_NOT_FOUND_001"


# ============================================================
# 通用业务异常基类（统一错误处理入口）
# ============================================================

class AppError(Exception):
    """应用业务异常基类

    所有自定义业务异常都应继承此类，GlobalExceptionHandler 会自动捕获。
    """
    def __init__(
        self,
        message: str,
        error_code: str = 'APP_ERROR',
        status_code: int = 500,
        details: Optional[dict] = None,
    ):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class ResourceNotFoundException(AppError):
    """资源不存在（兼容别名）"""
    def __init__(self, resource_type: str = 'Resource', resource_id: str = ''):
        message = f'{resource_type}不存在'
        if resource_id:
            message += f' (ID: {resource_id})'
        super().__init__(
            message=message,
            error_code='NOT_FOUND',
            status_code=404,
            details={'resource_type': resource_type, 'resource_id': resource_id},
        )


class PermissionDeniedException(AppError):
    """权限不足（兼容别名）"""
    def __init__(self, action: str = '执行此操作'):
        super().__init__(
            message=f'您没有权限{action}',
            error_code='FORBIDDEN',
            status_code=403,
        )


class QuotaExceededError(AppError):
    """配额超限"""
    def __init__(self, resource: str, limit: int, used: int):
        super().__init__(
            message=f'{resource}使用量已达上限 ({used}/{limit})',
            error_code='QUOTA_EXCEEDED',
            status_code=403,
            details={'resource': resource, 'limit': limit, 'used': used},
        )

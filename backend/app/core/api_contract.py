"""
🟡 P2-1: 统一 API 响应规范 & 错误码映射表

提供企业级的统一响应格式:
1. 统一的成功/失败响应结构（前端可统一处理）
2. 标准错误码映射表（业务级错误码）
3. 国际化错误消息占位符
4. 可扩展的扩展字段（trace_id / correlation_id / retry_hint）
5. 快速响应创建工具函数（20 多个便捷函数）

使用方式:
    from app.core.api_contract import (
        ok, created, paginated_result,
        bad_request, unauthorized, forbidden, not_found,
        conflict, rate_limit, server_error,
        ApiError, create_error_response,
    )

    # 成功响应
    return ok(data={"formulas": [...]}, message="获取成功")

    # 创建成功
    return created(data={"id": 123}, message="配方已创建")

    # 业务错误
    return bad_request(message="参数无效", details={"field": "name"})

    # 异常场景（抛出异常由 GlobalExceptionHandler 捕获）
    raise ApiError("FORMULA_NOT_FOUND", status_code=404, message="配方不存在")
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from fastapi import status as http_status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


# ═════════════════════════════════════════
# 🟡 P2-1: 错误严重程度枚举
# ═════════════════════════════════════════

class ErrorSeverity(str, Enum):
    """错误严重程度"""
    DEBUG = "debug"       # 开发调试信息
    INFO = "info"        # 一般性业务提示
    WARNING = "warning"    # 警告（非阻断）
    ERROR = "error"      # 业务错误（可恢复）
    CRITICAL = "critical"  # 系统级错误（需人工介入）


# ═════════════════════════════════════════
# 🟡 P2-1: 标准错误码表
# ═════════════════════════════════════════

@dataclass(frozen=True)
class ErrorCodeEntry:
    """错误码条目"""
    code: str                    # 错误码（如 "AUTH_001"）
    http_status: int             # 对应的 HTTP 状态码
    message: str                # 默认消息（zh-CN）
    severity: ErrorSeverity     # 严重程度
    category: str               # 分类（auth/formula/ai/...）
    retryable: bool = False     # 是否可重试
    i18n_key: Optional[str] = None  # 国际化 key


# 🔰 错误码表（按业务领域分类）
ERROR_CODE_TABLE: Dict[str, ErrorCodeEntry] = {
    # ─── AUTH 认证相关 (10xx)
    "AUTH_001": ErrorCodeEntry("AUTH_001", 401, "未提供有效的认证凭证", ErrorSeverity.ERROR, "auth"),
    "AUTH_002": ErrorCodeEntry("AUTH_002", 401, "Token 已过期", ErrorSeverity.ERROR, "auth", retryable=True),
    "AUTH_003": ErrorCodeEntry("AUTH_003", 401, "Token 无效或已被吊销", ErrorSeverity.ERROR, "auth"),
    "AUTH_004": ErrorCodeEntry("AUTH_004", 403, "权限不足，访问被拒绝", ErrorSeverity.WARNING, "auth"),
    "AUTH_005": ErrorCodeEntry("AUTH_005", 423, "账户已被锁定，请稍后再试", ErrorSeverity.ERROR, "auth"),
    "AUTH_006": ErrorCodeEntry("AUTH_006", 401, "用户名或密码错误", ErrorSeverity.ERROR, "auth"),
    "AUTH_007": ErrorCodeEntry("AUTH_007", 429, "登录失败次数过多，请稍后重试", ErrorSeverity.WARNING, "auth"),
    "AUTH_008": ErrorCodeEntry("AUTH_008", 403, "账户尚未激活", ErrorSeverity.WARNING, "auth"),

    # ─── FORMULA 配方相关 (20xx)
    "FORMULA_001": ErrorCodeEntry("FORMULA_001", 404, "配方不存在", ErrorSeverity.ERROR, "formula"),
    "FORMULA_002": ErrorCodeEntry("FORMULA_002", 409, "配方编号已存在", ErrorSeverity.ERROR, "formula"),
    "FORMULA_003": ErrorCodeEntry("FORMULA_003", 403, "无权访问此配方", ErrorSeverity.ERROR, "formula"),
    "FORMULA_004": ErrorCodeEntry("FORMULA_004", 409, "配方正在审核中，无法修改", ErrorSeverity.WARNING, "formula"),
    "FORMULA_005": ErrorCodeEntry("FORMULA_005", 422, "配方参数无效", ErrorSeverity.ERROR, "formula"),
    "FORMULA_006": ErrorCodeEntry("FORMULA_006", 400, "成分之间存在相互作用冲突", ErrorSeverity.WARNING, "formula"),
    "FORMULA_007": ErrorCodeEntry("FORMULA_007", 422, "配方审核流程异常", ErrorSeverity.ERROR, "formula"),

    # ─── AI 服务相关 (30xx)
    "AI_001": ErrorCodeEntry("AI_001", 503, "AI 服务暂时不可用", ErrorSeverity.WARNING, "ai", retryable=True),
    "AI_002": ErrorCodeEntry("AI_002", 429, "AI 请求频率过高，请稍后重试", ErrorSeverity.WARNING, "ai", retryable=True),
    "AI_003": ErrorCodeEntry("AI_003", 402, "AI 调用额度已用完", ErrorSeverity.ERROR, "ai"),
    "AI_004": ErrorCodeEntry("AI_004", 422, "AI 服务响应格式异常", ErrorSeverity.ERROR, "ai"),
    "AI_005": ErrorCodeEntry("AI_005", 408, "AI 分析超时，请尝试缩小范围", ErrorSeverity.WARNING, "ai", retryable=True),
    "AI_006": ErrorCodeEntry("AI_006", 400, "AI 提示词包含受限内容", ErrorSeverity.ERROR, "ai"),

    # ─── VALIDATION 参数校验 (40xx)
    "VALIDATION_001": ErrorCodeEntry("VALIDATION_001", 400, "请求参数缺失或类型错误", ErrorSeverity.ERROR, "validation"),
    "VALIDATION_002": ErrorCodeEntry("VALIDATION_002", 422, "数据格式不符合要求", ErrorSeverity.ERROR, "validation"),
    "VALIDATION_003": ErrorCodeEntry("VALIDATION_003", 400, "文件格式不受支持", ErrorSeverity.ERROR, "validation"),
    "VALIDATION_004": ErrorCodeEntry("VALIDATION_004", 400, "文件大小超出限制", ErrorSeverity.ERROR, "validation"),

    # ─── FILE 文件上传 (50xx)
    "FILE_001": ErrorCodeEntry("FILE_001", 413, "文件大小超出限制", ErrorSeverity.ERROR, "file"),
    "FILE_002": ErrorCodeEntry("FILE_002", 415, "不支持的文件类型", ErrorSeverity.ERROR, "file"),
    "FILE_003": ErrorCodeEntry("FILE_003", 500, "文件存储服务异常", ErrorSeverity.CRITICAL, "file", retryable=True),
    "FILE_004": ErrorCodeEntry("FILE_004", 422, "文件内容可能包含恶意代码", ErrorSeverity.CRITICAL, "file"),

    # ─── RATE_LIMIT 限流 (60xx)
    "RATE_001": ErrorCodeEntry("RATE_001", 429, "请求过于频繁，请稍后重试", ErrorSeverity.WARNING, "rate_limit", retryable=True),
    "RATE_002": ErrorCodeEntry("RATE_002", 429, "API 配额已用尽，请联系管理员", ErrorSeverity.ERROR, "rate_limit"),

    # ─── DATABASE 数据库 (70xx)
    "DB_001": ErrorCodeEntry("DB_001", 503, "数据库连接失败，请稍后重试", ErrorSeverity.CRITICAL, "database", retryable=True),
    "DB_002": ErrorCodeEntry("DB_002", 409, "数据冲突，唯一键约束失败", ErrorSeverity.ERROR, "database"),
    "DB_003": ErrorCodeEntry("DB_003", 504, "数据库查询超时", ErrorSeverity.CRITICAL, "database", retryable=True),
    "DB_004": ErrorCodeEntry("DB_004", 404, "请求的数据不存在", ErrorSeverity.ERROR, "database"),

    # ─── EXTERNAL 外部服务 (80xx)
    "EXTERNAL_001": ErrorCodeEntry("EXTERNAL_001", 502, "外部服务连接失败", ErrorSeverity.CRITICAL, "external", retryable=True),
    "EXTERNAL_002": ErrorCodeEntry("EXTERNAL_002", 504, "外部服务响应超时", ErrorSeverity.WARNING, "external", retryable=True),

    # ─── SYSTEM 系统级 (90xx)
    "SYSTEM_001": ErrorCodeEntry("SYSTEM_001", 500, "系统内部错误，请联系管理员", ErrorSeverity.CRITICAL, "system"),
    "SYSTEM_002": ErrorCodeEntry("SYSTEM_002", 503, "系统正在维护中，请稍后再试", ErrorSeverity.WARNING, "system", retryable=True),
    "SYSTEM_003": ErrorCodeEntry("SYSTEM_003", 501, "该功能尚未实现", ErrorSeverity.INFO, "system"),

    # ─── TENANT 多租户 (11xx)
    "TENANT_001": ErrorCodeEntry("TENANT_001", 403, "租户标识无效", ErrorSeverity.ERROR, "tenant"),
    "TENANT_002": ErrorCodeEntry("TENANT_002", 403, "不属于当前组织的资源", ErrorSeverity.ERROR, "tenant"),

    # ─── WORKFLOW 工作流 (12xx)
    "WORKFLOW_001": ErrorCodeEntry("WORKFLOW_001", 409, "工作流状态冲突", ErrorSeverity.ERROR, "workflow"),
    "WORKFLOW_002": ErrorCodeEntry("WORKFLOW_002", 400, "工作流步骤参数无效", ErrorSeverity.ERROR, "workflow"),

    # ─── COLLABORATION 协作 (13xx)
    "COLLAB_001": ErrorCodeEntry("COLLAB_001", 409, "该用户正在编辑此资源", ErrorSeverity.WARNING, "collaboration"),
}


# ═════════════════════════════════════════
# 🟡 P2-1: 自定义异常类（业务级异常）
# ═════════════════════════════════════════

class ApiError(Exception):
    """
    业务级异常：抛出后由 GlobalExceptionHandler 统一处理

    使用方式:
        raise ApiError("FORMULA_001", status_code=404, message="配方不存在")
    """

    def __init__(
        self,
        error_code: str,
        message: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: Optional[ErrorSeverity] = None,
    ):
        self.error_code = error_code
        self.details = details or {}

        # 从错误码表查找默认信息（如果有的话）
        entry = ERROR_CODE_TABLE.get(error_code)

        if entry:
            self.status_code = status_code or entry.http_status
            self.message = message or entry.message
            self.severity = severity or entry.severity
            self.category = entry.category
            self.retryable = entry.retryable
        else:
            # 未知错误码 → 默认错误处理
            self.status_code = status_code or 500
            self.message = message or "发生未知错误"
            self.severity = severity or ErrorSeverity.ERROR
            self.category = "unknown"
            self.retryable = False

        # 生成唯一的错误追踪 ID（便于日志定位）
        self.trace_id = str(uuid.uuid4())[:12]
        self.timestamp = datetime.now(timezone.utc).isoformat()

        super().__init__(self.message)

    def to_dict(self) -> Dict[str, Any]:
        """序列化为响应字典"""
        result = {
            "success": False,
            "code": self.status_code,
            "error_code": self.error_code,
            "message": self.message,
            "category": self.category,
            "severity": self.severity.value,
            "retryable": self.retryable,
            "details": self.details,
            "trace_id": self.trace_id,
            "timestamp": self.timestamp,
        }

        # 如果可重试，添加重试提示
        if self.retryable:
            result["retry_hint"] = {
                "strategy": "exponential_backoff",
                "initial_delay_ms": 500,
                "max_delay_ms": 10000,
                "max_attempts": 5,
            }

        return result


# ═════════════════════════════════════════
# 🟡 P2-1: 通用异常子类（便于业务逻辑使用）
# ═════════════════════════════════════════

class NotFoundError(ApiError):
    """资源不存在"""
    def __init__(self, resource: str = "资源", resource_id: Any = None):
        super().__init__(
            "FORMULA_001" if "配方" in str(resource) else "DB_004",
            message=f"{resource}不存在" + (f" (ID: {resource_id})" if resource_id else ""),
            status_code=404,
        )


class ValidationFailedError(ApiError):
    """参数校验失败"""
    def __init__(self, field: str = "", message: str = "", suggestions: List[str] = None):
        super().__init__(
            "VALIDATION_001",
            message=message or "参数校验失败",
            details={"field": field, "suggestions": suggestions or []},
        )


class AIServiceError(ApiError):
    """AI 服务错误"""
    def __init__(self, message: str = "AI 服务异常", code: str = "AI_001"):
        super().__init__(code, message=message)


class PermissionDenied(ApiError):
    """权限不足"""
    def __init__(self, permission: str = ""):
        super().__init__(
            "AUTH_004",
            message=f"权限不足" + (f" (需要: {permission})" if permission else ""),
        )


# ═════════════════════════════════════════
# 🟡 P2-1: 统一响应构建工具
# ═════════════════════════════════════════

def _build_response_body(
    success: bool,
    data: Optional[Any] = None,
    message: str = "",
    code: int = 200,
    error_code: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    统一的响应体构建工具（内部使用）
    
    确保所有响应遵循统一的格式约定
    """
    body = {
        "success": success,
        "code": code,
        "message": message,
        "request_id": str(uuid.uuid4())[:12],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if data is not None:
        body["data"] = data

    if error_code:
        body["error_code"] = error_code

    if details:
        body["details"] = details

    # 支持扩展字段（如 trace_id, server_version）
    for key, value in kwargs.items():
        if value is not None:
            body[key] = value

    return body


# ─── 成功响应（按语义划分，便于前端统一处理） ───

def ok(data: Any = None, message: str = "成功") -> JSONResponse:
    """✅ 200 OK - 通用成功响应"""
    return JSONResponse(
        status_code=200,
        content=_build_response_body(True, data, message, 200),
    )


def created(data: Any = None, message: str = "创建成功") -> JSONResponse:
    """✅ 201 Created - 资源创建成功"""
    return JSONResponse(
        status_code=201,
        content=_build_response_body(True, data, message, 201),
    )


def accepted(message: str = "请求已接受，正在处理") -> JSONResponse:
    """⏳ 202 Accepted - 异步任务已接受"""
    return JSONResponse(
        status_code=202,
        content=_build_response_body(
            True,
            message=message,
            code=202,
            status="pending",
        ),
    )


def no_content() -> JSONResponse:
    """⚪ 204 No Content - 操作成功，无返回内容"""
    return JSONResponse(status_code=204, content={})


def paginated_response(
    items: List[Any],
    page: int,
    page_size: int,
    total: int,
    message: str = "获取成功",
) -> JSONResponse:
    """📄 分页列表响应"""
    total_pages = (total + page_size - 1) // page_size
    return JSONResponse(
        status_code=200,
        content=_build_response_body(
            True,
            message=message,
            code=200,
            data={
                "items": items,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1,
            },
        ),
    )


def batch_operation_result(
    success_ids: List[Any],
    failed_items: List[Dict[str, Any]],
    total_count: int,
    operation: str = "批量操作",
) -> JSONResponse:
    """📦 批量操作响应（返回每个子操作的状态）"""
    return JSONResponse(
        status_code=200 if not failed_items else 207,  # 207 Multi-Status
        content={
            "success": len(failed_items) == 0,
            "code": 200,
            "message": f"{operation}完成（成功 {len(success_ids)}/ 失败 {len(failed_items)}）",
            "request_id": str(uuid.uuid4())[:12],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "summary": {
                "total": total_count,
                "success_count": len(success_ids),
                "failed_count": len(failed_items),
            },
            "success_ids": success_ids,
            "failed_items": failed_items,
        },
    )


# ─── 失败响应（按 HTTP 语义划分） ───

def bad_request(
    message: str = "请求参数无效",
    details: Optional[Dict[str, Any]] = None,
    error_code: str = "VALIDATION_001",
) -> JSONResponse:
    """❌ 400 Bad Request - 请求参数错误"""
    return JSONResponse(
        status_code=400,
        content=_build_response_body(
            False,
            message=message,
            code=400,
            error_code=error_code,
            details=details,
        ),
    )


def unauthorized(message: str = "未提供有效的认证凭证") -> JSONResponse:
    """🔒 401 Unauthorized - 未认证"""
    return JSONResponse(
        status_code=401,
        content=_build_response_body(
            False,
            message=message,
            code=401,
            error_code="AUTH_001",
            login_required=True,
        ),
        headers={"WWW-Authenticate": "Bearer"},
    )


def forbidden(message: str = "权限不足，访问被拒绝") -> JSONResponse:
    """🚫 403 Forbidden - 权限不足"""
    return JSONResponse(
        status_code=403,
        content=_build_response_body(
            False,
            message=message,
            code=403,
            error_code="AUTH_004",
        ),
    )


def not_found(message: str = "资源不存在", resource: str = "") -> JSONResponse:
    """🔍 404 Not Found - 资源不存在"""
    return JSONResponse(
        status_code=404,
        content=_build_response_body(
            False,
            message=message if not resource else f"{resource}不存在",
            code=404,
            error_code="DB_004",
        ),
    )


def conflict(message: str = "资源状态冲突", details: Optional[Dict[str, Any]] = None) -> JSONResponse:
    """⚔️ 409 Conflict - 资源状态冲突"""
    return JSONResponse(
        status_code=409,
        content=_build_response_body(
            False,
            message=message,
            code=409,
            error_code="DB_002",
            details=details,
        ),
    )


def rate_limit(message: str = "请求过于频繁，请稍后重试", retry_after: int = 30) -> JSONResponse:
    """⏰ 429 Too Many Requests - 限流"""
    return JSONResponse(
        status_code=429,
        content=_build_response_body(
            False,
            message=message,
            code=429,
            error_code="RATE_001",
            retry_after_seconds=retry_after,
        ),
        headers={"Retry-After": str(retry_after)},
    )


def server_error(message: str = "系统内部错误", trace_id: str = None) -> JSONResponse:
    """🚨 500 Internal Server Error - 系统内部错误"""
    return JSONResponse(
        status_code=500,
        content=_build_response_body(
            False,
            message=message,
            code=500,
            error_code="SYSTEM_001",
            trace_id=trace_id or str(uuid.uuid4())[:12],
        ),
    )


def service_unavailable(message: str = "服务暂时不可用", retry_after: int = 60) -> JSONResponse:
    """🛑 503 Service Unavailable - 服务不可用"""
    return JSONResponse(
        status_code=503,
        content=_build_response_body(
            False,
            message=message,
            code=503,
            error_code="AI_001",
            retry_after_seconds=retry_after,
        ),
        headers={"Retry-After": str(retry_after)},
    )


def create_error_response(error: ApiError) -> JSONResponse:
    """
    🔀 从 ApiError 异常构建响应

    使用场景: 业务层抛出异常 → 中间件捕获 → 调用本方法构建响应
    """
    body = error.to_dict()
    body["request_id"] = str(uuid.uuid4())[:12]

    headers = {}
    if error.retryable:
        headers["Retry-After"] = "5"

    return JSONResponse(
        status_code=error.status_code,
        content=body,
        headers=headers,
    )


# ═════════════════════════════════════════
# 🟡 P2-1: 错误码查询工具（供管理 API 使用）
# ═════════════════════════════════════════

def get_error_codes_by_category(category: str) -> List[Dict[str, Any]]:
    """按分类获取所有错误码（供 API 文档/管理页面使用）"""
    return [
        {
            "code": entry.code,
            "http_status": entry.http_status,
            "message": entry.message,
            "severity": entry.severity.value,
            "retryable": entry.retryable,
        }
        for entry in ERROR_CODE_TABLE.values()
        if entry.category == category
    ]


def get_all_error_codes() -> Dict[str, List[Dict[str, Any]]]:
    """获取全部分类的错误码表"""
    result = {}
    for entry in ERROR_CODE_TABLE.values():
        cat = entry.category
        if cat not in result:
            result[cat] = []
        result[cat].append({
            "code": entry.code,
            "http_status": entry.http_status,
            "message": entry.message,
            "severity": entry.severity.value,
        })
    return result


def get_categories() -> List[str]:
    """获取所有错误分类"""
    return sorted(set(e.category for e in ERROR_CODE_TABLE.values()))


# ═════════════════════════════════════════
# 🟡 P2-1: 错误码统计（观测性增强）
# ═════════════════════════════════════════

class ErrorCodeCounter:
    """简单的错误码发生次数计数器（内存实现）"""

    def __init__(self):
        self._counts: Dict[str, int] = {}
        self._last_reset = time.time()

    def record(self, error_code: str) -> None:
        """记录一次错误发生"""
        self._counts[error_code] = self._counts.get(error_code, 0) + 1

    def get_top_errors(self, limit: int = 10) -> List[Dict[str, Any]]:
        """获取发生次数最多的 TOP N 错误"""
        sorted_errors = sorted(
            self._counts.items(),
            key=lambda x: x[1],
            reverse=True,
        )[:limit]

        return [
            {
                "error_code": code,
                "count": count,
                "entry": {
                    "message": entry.message,
                    "http_status": entry.http_status,
                    "severity": entry.severity.value,
                    "category": entry.category,
                } if (entry := ERROR_CODE_TABLE.get(code)) else None,
            }
            for code, count in sorted_errors
        ]

    def reset(self) -> None:
        """重置计数器"""
        self._counts.clear()
        self._last_reset = time.time()


# 全局单例计数器
global_error_counter = ErrorCodeCounter()


# ═════════════════════════════════════════
# 🟡 P2-1: 对外导出
# ═════════════════════════════════════════

__all__ = [
    # 异常类
    "ApiError",
    "NotFoundError",
    "ValidationFailedError",
    "AIServiceError",
    "PermissionDenied",
    # 错误码表
    "ERROR_CODE_TABLE",
    "ErrorCodeEntry",
    "ErrorSeverity",
    # 成功响应
    "ok",
    "created",
    "accepted",
    "no_content",
    "paginated_response",
    "batch_operation_result",
    # 失败响应
    "bad_request",
    "unauthorized",
    "forbidden",
    "not_found",
    "conflict",
    "rate_limit",
    "server_error",
    "service_unavailable",
    # 工具
    "create_error_response",
    "get_error_codes_by_category",
    "get_all_error_codes",
    "get_categories",
    # 计数器
    "ErrorCodeCounter",
    "global_error_counter",
]

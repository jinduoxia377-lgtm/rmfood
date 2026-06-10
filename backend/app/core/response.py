"""RMFOOD 统一响应格式

提供标准化的API响应格式，包括：
- 成功响应（含 request_id、timestamp）
- 分页响应（含完整分页信息）
- 错误响应（含错误码、详情）
- 流式响应（SSE）

使用方式:
    from app.core.response import success_response, error_response, paginated_response

    @router.get("/formulas")
    async def list_formulas(...):
        return success_response(data=formulas, message="获取成功")
"""
from typing import Generic, TypeVar, Optional, Any, List
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import uuid


T = TypeVar('T')


def _now() -> str:
    """获取当前 UTC 时间的 ISO 格式字符串"""
    return datetime.now(timezone.utc).isoformat()


def _request_id() -> str:
    """生成请求 ID"""
    return str(uuid.uuid4())[:12]


class ApiResponse(BaseModel, Generic[T]):
    """统一 API 响应格式

    所有 API 响应都遵循此格式，确保前端可以统一处理。
    """
    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None
    code: int = 200
    request_id: str = Field(default_factory=_request_id, description="请求追踪ID")
    timestamp: str = Field(default_factory=_now, description="响应时间戳")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {"id": 1, "name": "测试"},
                "message": "操作成功",
                "code": 200,
                "request_id": "abc123def456",
                "timestamp": "2026-06-03T11:00:00Z"
            }
        }


class PaginatedResponse(BaseModel, Generic[T]):
    """分页响应格式

    包含完整的分页信息，支持前端分页组件。
    """
    items: List[T] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    page_size: int = 20
    total_pages: int = 0
    has_next: bool = False
    has_prev: bool = False
    request_id: str = Field(default_factory=_request_id)
    timestamp: str = Field(default_factory=_now)

    class Config:
        json_schema_extra = {
            "example": {
                "items": [{"id": 1, "name": "测试"}],
                "total": 100,
                "page": 1,
                "page_size": 20,
                "total_pages": 5,
                "has_next": True,
                "has_prev": False,
                "request_id": "abc123def456",
                "timestamp": "2026-06-03T11:00:00Z"
            }
        }


class ErrorDetail(BaseModel):
    """错误详情"""
    field: Optional[str] = None
    message: str
    code: str


class ErrorResponse(BaseModel):
    """错误响应格式

    统一的错误响应结构，包含错误码和详情。
    """
    success: bool = False
    error: str
    code: int
    error_code: Optional[str] = None
    details: Optional[List[ErrorDetail]] = None
    request_id: str = Field(default_factory=_request_id)
    timestamp: str = Field(default_factory=_now)

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "验证失败",
                "code": 422,
                "error_code": "VALIDATION_ERROR",
                "details": [
                    {"field": "email", "message": "邮箱格式不正确", "code": "E1001"}
                ],
                "request_id": "abc123def456",
                "timestamp": "2026-06-03T11:00:00Z"
            }
        }


class StreamResponse(BaseModel):
    """流式响应格式（SSE）

    用于 AI 生成等需要流式返回的场景。
    """
    event: str = "message"
    data: Any = None
    id: Optional[str] = None
    retry: Optional[int] = None


def success_response(
    data: Optional[T] = None,
    message: Optional[str] = None,
    code: int = 200,
    request_id: Optional[str] = None,
) -> dict:
    """创建成功响应

    Args:
        data: 响应数据
        message: 响应消息
        code: HTTP 状态码
        request_id: 请求追踪 ID（自动生成）

    Returns:
        标准化的成功响应字典
    """
    return {
        "success": True,
        "data": data,
        "message": message or "操作成功",
        "code": code,
        "request_id": request_id or _request_id(),
        "timestamp": _now(),
    }


def error_response(
    error: str,
    code: int = 400,
    error_code: Optional[str] = None,
    details: Optional[List[ErrorDetail]] = None,
    request_id: Optional[str] = None,
) -> dict:
    """创建错误响应

    Args:
        error: 错误消息
        code: HTTP 状态码
        error_code: 业务错误码
        details: 错误详情列表
        request_id: 请求追踪 ID

    Returns:
        标准化的错误响应字典
    """
    return {
        "success": False,
        "error": error,
        "code": code,
        "error_code": error_code,
        "details": details,
        "request_id": request_id or _request_id(),
        "timestamp": _now(),
    }


def paginated_response(
    items: List[T],
    total: int,
    page: int,
    page_size: int,
    request_id: Optional[str] = None,
) -> dict:
    """创建分页响应

    Args:
        items: 当前页数据列表
        total: 总记录数
        page: 当前页码
        page_size: 每页大小
        request_id: 请求追踪 ID

    Returns:
        标准化的分页响应字典
    """
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1,
        "request_id": request_id or _request_id(),
        "timestamp": _now(),
    }


def stream_event(
    data: Any,
    event: str = "message",
    event_id: Optional[str] = None,
) -> str:
    """创建 SSE 流式事件

    Args:
        data: 事件数据
        event: 事件类型
        event_id: 事件 ID

    Returns:
        SSE 格式的字符串
    """
    import json

    lines = []
    if event_id:
        lines.append(f"id: {event_id}")
    lines.append(f"event: {event}")
    lines.append(f"data: {json.dumps(data, ensure_ascii=False)}")
    lines.append("")
    return "\n".join(lines) + "\n"

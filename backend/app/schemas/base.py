"""RMFOOD 基础 Pydantic 模式"""
from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar('T')


class ApiResponse(BaseModel, Generic[T]):
    """统一API响应格式"""
    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None
    error: Optional[str] = None
    code: int = 200


class PaginatedResponse(BaseModel, Generic[T]):
    """分页响应"""
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class PaginationParams(BaseModel):
    """分页参数"""
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=10, ge=1, le=100)


class SortParams(BaseModel):
    """排序参数"""
    sort_by: str = Field(default="created_at")
    sort_order: str = Field(default="desc", pattern="^(asc|desc)$")


class IdResponse(BaseModel):
    """ID响应"""
    id: int


class SuccessResponse(BaseModel):
    """成功响应"""
    success: bool = True
    message: str = "操作成功"


class ErrorResponse(BaseModel):
    """错误响应"""
    success: bool = False
    error: str
    code: int
    message: Optional[str] = None

"""
RMFOOD API通用工具函数库

提供标准化的API响应格式、分页、权限检查等常用功能，
消除代码重复，确保API一致性。

主要模块:
1. 标准响应格式 (StandardResponse)
2. 分页工具 (Pagination)
3. 权限检查装饰器 (PermissionDecorators)
4. API路由基类 (BaseAPIRouter)

使用示例:
    from app.api.utils import StandardResponse, pagination, require_role

    @router.get("/formulas")
    async def list_formulas(
        page: int = Query(1, ge=1),
        page_size: int = Query(20, le=100),
        current_user: User = Depends(get_current_user),
    ):
        # 权限检查
        require_role(current_user, [UserRole.ADMIN, UserRole.RESEARCHER])
        
        # 查询数据
        total, items = await formula_service.list_all(page, page_size)
        
        # 返回标准化分页响应
        return StandardResponse.paginated(items, total, page, page_size)
"""

import logging
from typing import Any, Dict, List, Optional, TypeVar, Generic
from functools import wraps
from datetime import datetime

logger = logging.getLogger(__name__)

from fastapi import Query, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel


# ════════════════════════════════════════════
# 1. 标准化API响应
# ════════════════════════════════════════════

class StandardResponse:
    """
    标准化API响应构建器
    
    确保所有API返回一致的JSON格式:
    
    成功响应:
    {
      "success": true,
      "data": {...},
      "message": "操作成功",
      "timestamp": "2026-05-04T12:00:00Z"
    }
    
    分页响应:
    {
      "success": true,
      "data": [...],
      "pagination": {
        "page": 1,
        "page_size": 20,
        "total": 100,
        "total_pages": 5
      }
    }
    
    错误响应: 由 exceptions.py 的 AppError 处理
    """
    
    @staticmethod
    def success(
        data: Any = None,
        message: str = "操作成功",
        status_code: int = 200,
        **extra
    ) -> JSONResponse:
        """成功响应"""
        response = {
            "success": True,
            "data": data,
            "message": message,
            "timestamp": datetime.utcnow().isoformat()
        }
        response.update(extra)
        
        return JSONResponse(
            status_code=status_code,
            content=response
        )
    
    @staticmethod
    def created(
        data: Any = None,
        message: str = "创建成功",
        resource_id: Optional[int] = None,
        **extra
    ) -> JSONResponse:
        """资源创建成功 (201)"""
        response_data = {"id": resource_id} if resource_id else data
        
        return StandardResponse.success(
            data=response_data,
            message=message,
            status_code=201,
            **extra
        )
    
    @staticmethod
    def no_content(message: str = "删除成功") -> JSONResponse:
        """无内容返回 (204)"""
        return JSONResponse(
            status_code=204,
            content={
                "success": True,
                "message": message,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    @staticmethod
    def paginated(
        items: List[Any],
        total: int,
        page: int,
        page_size: int,
        **extra
    ) -> Dict[str, Any]:
        """
        分页响应（返回字典，由FastAPI自动序列化）
        
        Args:
            items: 当前页的数据列表
            total: 总记录数
            page: 当前页码 (从1开始)
            page_size: 每页大小
            
        Returns:
            标准化的分页响应字典
        """
        total_pages = (total + page_size - 1) // page_size if total > 0 else 0
        
        return {
            "success": True,
            "data": items,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1
            },
            "timestamp": datetime.utcnow().isoformat(),
            **extra
        }


# ════════════════════════════════════════════
# 2. 分页参数解析
# ════════════════════════════════════════════

class PaginationParams(BaseModel):
    """分页请求参数"""
    page: int = Query(1, ge=1, description="页码 (从1开始)")
    page_size: int = Query(20, ge=1, le=100, description="每页数量")
    sort_by: Optional[str] = Query(None, description="排序字段")
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="排序方向")


def get_pagination_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: Optional[str] = None,
    sort_order: str = "desc"
) -> Dict[str, Any]:
    """
    解析并验证分页参数
    
    Usage:
        @router.get("/items")
        async def list_items(pagination: Dict = Depends(get_pagination_params)):
            page = pagination["page"]
            page_size = pagination["page_size"]
            # ...
    """
    return {
        "page": page,
        "page_size": page_size,
        "offset": (page - 1) * page_size,
        "sort_by": sort_by,
        "sort_order": sort_order.upper()
    }


async def paginate_query(
    query,
    pagination: Dict[str, Any]
) -> tuple:
    """
    对SQLAlchemy查询应用分页
    
    Args:
        query: SQLAlchemy Select语句
        pagination: get_pagination_params()的返回值
        
    Returns:
        (total_count, items_list) 元组
    """
    from sqlalchemy import func
    
    # 计算总数
    count_query = func.count().select().query_from(query.subquery())
    total_result = await query.session.execute(count_query)
    total = total_result.scalar() or 0
    
    # 应用排序和分页
    if pagination.get("sort_by"):
        from sqlalchemy import desc, asc, col
        order_func = desc if pagination["sort_order"] == "DESC" else asc
        query = query.order_by(order_func(col(pagination["sort_by"])))
    
    query = query.offset(pagination["offset"]).limit(pagination["page_size"])
    
    result = await query.execute()
    items = result.scalars().all()
    
    return total, list(items)


# ════════════════════════════════════════════
# 3. 权限检查装饰器
# ════════════════════════════════════════════

from ..core.rbac import RBACManager as RBACEngine, Permission
from ..models.enums import UserRole
from ..core.exceptions import AuthorizationError, AuthenticationError


def require_roles(allowed_roles: List[str]):
    """
    角色权限检查装饰器
    
    Usage:
        @require_roles([UserRole.ADMIN, UserRole.MANAGER])
        async def admin_only_endpoint(current_user=Depends(get_current_user)):
            return {"admin_data": "..."}
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # 从kwargs中获取current_user（FastAPI依赖注入）
            current_user = kwargs.get('current_user')
            
            if not current_user:
                raise AuthenticationError(message="未提供用户凭据")
            
            if current_user.role not in allowed_roles:
                raise AuthorizationError(
                    required_permission=f"角色: {', '.join(allowed_roles)}",
                    current_role=current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def require_permission(permission: Permission):
    """
    细粒度权限检查装饰器
    
    Usage:
        @require_permission(Permission.DELETE_FORMULA)
        async def delete_formula(formula_id: int, ...):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            current_user = kwargs.get('current_user')
            
            if not current_user:
                raise AuthenticationError()
            
            rbac = RBACEngine()
            if not rbac.check_permission(current_user, permission):
                raise AuthorizationError(
                    required_permission=str(permission),
                    current_role=current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def check_ownership(resource_owner_id: int, current_user_id: int, allow_admin: bool = True):
    """
    资源所有权检查
    
    Args:
        resource_owner_id: 资源的所有者ID
        current_user_id: 当前用户ID
        allow_admin: 是否允许管理员访问他人资源
    """
    if resource_owner_id != current_user_id:
        if not allow_admin:
            raise AuthorizationError(message="您没有权限操作此资源")
        # TODO: 检查当前用户是否为管理员


# ════════════════════════════════════════════
# 4. 请求日志中间件
# ════════════════════════════════════════════

import time
import uuid


class RequestLogger:
    """请求日志记录器"""
    
    @staticmethod
    def generate_request_id() -> str:
        """生成唯一请求ID"""
        return str(uuid.uuid4())[:8].upper()
    
    @staticmethod
    async def log_request(request: Request, response_time_ms: float):
        """记录API请求日志"""
        from ..core.logger import logger
        
        logger.info(
            f"{request.method} {request.url.path}",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": response_time_ms,
                "client_ip": request.client.host if request.client else "unknown",
                "user_agent": request.headers.get("user-agent"),
                "response_time_ms": round(response_time_ms, 2)
            }
        )


# ════════════════════════════════════════════
# 5. 数据验证辅助
# ════════════════════════════════════════════

def validate_required_fields(data: Dict, required_fields: List[str]):
    """
    验证必填字段是否存在
    
    Raises:
        ValidationError: 如果缺少必填字段
    """
    from ..core.exceptions import ValidationError

    missing_fields = [field for field in required_fields if field not in data or data[field] is None]
    
    if missing_fields:
        raise ValidationError(
            message=f"缺少必填字段: {', '.join(missing_fields)}",
            details={"missing_fields": missing_fields}
        )


def sanitize_string_input(value: str, max_length: int = 1000) -> str:
    """
    清理字符串输入（防止XSS）
    
    - 去除首尾空白
    - 限制最大长度
    - 移除危险HTML标签
    """
    import re
    
    if not isinstance(value, str):
        return str(value)[:max_length]
    
    value = value.strip()
    value = value[:max_length]
    
    # 移除潜在的HTML/JS注入
    dangerous_patterns = [
        r'<script[^>]*>.*?</script>',
        r'javascript:',
        r'on\w+\s*=',
    ]
    
    for pattern in dangerous_patterns:
        value = re.sub(pattern, '', value, flags=re.IGNORECASE | re.DOTALL)
    
    return value


# ════════════════════════════════════════════
# 6. 文件上传处理
# ════════════════════════════════════════════

ALLOWED_EXTENSIONS = {
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.png', '.jpg', '.jpeg', '.gif', '.svg',
    '.csv', '.json', '.zip', '.rar'
}

MAX_UPLOAD_SIZE_MB = 50


def validate_upload_file(filename: str, file_size: int):
    """
    验证上传文件
    
    Args:
        filename: 文件名
        file_size: 文件大小（字节）
        
    Raises:
        ValidationError: 如果文件不符合要求
    """
    from ..core.exceptions import ValidationError
    import os
    
    # 检查扩展名
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError(
            message=f"不支持的文件类型: {ext}",
            field="file",
            constraints=[f"允许的类型: {', '.join(ALLOWED_EXTENSIONS[:10])}..."]
        )
    
    # 检查文件大小
    max_bytes = MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if file_size > max_bytes:
        raise ValidationError(
            message=f"文件过大: {file_size / 1024 / 1024:.1f}MB > {MAX_UPLOAD_SIZE_MB}MB",
            field="file",
            constraints=[f"最大允许: {MAX_UPLOAD_SIZE_MB}MB"]
        )


logger.info("✅ API通用工具函数库加载完成")

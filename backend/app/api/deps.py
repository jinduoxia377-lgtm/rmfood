"""RMFOOD API 依赖注入（增强版）

功能:
- 数据库会话管理
- JWT Token认证（支持黑名单）
- 用户状态检查（活跃/禁用）
- 角色权限控制
- 细粒度权限检查（基于权限字符串）
- 可选认证（公开端点但可获取用户信息）

使用示例:
```python
# 必须认证
@router.get("/protected")
async def protected_route(user: User = Depends(get_current_active_user)):
    return {"user": user.username}

# 需要特定角色
@router.get("/admin")
async def admin_route(user: User = Depends(require_role(UserRole.ADMIN))):
    return {"admin": user.username}

# 需要特定权限
@router.get("/data")
async def data_route(user: User = Depends(require_permissions(["data:read"]))):
    return {"data": "sensitive data"}
```
"""
import logging
from typing import Annotated, Optional, List
from fastapi import Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..core.session import get_db
from ..utils.auth import decode_token
from ..models.user_model import User
from ..models.enums import FormulaStatus, UserRole

logger = logging.getLogger(__name__)


security = HTTPBearer(
    auto_error=False,  # 允许未提供Token的情况（用于可选认证）
)


async def get_db_session() -> AsyncSession:
    """获取数据库会话"""
    async for session in get_db():
        yield session


async def get_current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db_session)]
) -> Optional[User]:
    """
    获取当前认证用户（可选认证）

    - 如果提供了有效的Token，返回用户对象
    - 如果未提供Token或Token无效，返回None
    - 用于需要可选认证的端点（如公开API但登录后可看到更多信息）
    """
    if credentials is None:
        return None

    try:
        token = credentials.credentials
        payload = decode_token(token)

        if not payload:
            logger.warning("无效的访问令牌")
            return None

        # 验证Token类型（必须是access token）
        if payload.get("type") != "access":
            logger.warning(f"错误的Token类型: {payload.get('type')}")
            return None

        user_id = payload.get("sub")
        if not user_id:
            logger.warning("令牌格式无效：缺少sub字段")
            return None

        result = await db.execute(select(User).where(User.id == int(user_id)))
        user = result.scalar_one_or_none()

        if user is None:
            logger.warning(f"用户不存在 (ID={user_id})")
            return None

        if not user.is_active:
            logger.warning(f"用户已被禁用 (ID={user_id})")
            return None

        return user

    except HTTPException as e:
        # Token无效或过期，但这是可选认证，所以返回None
        logger.debug(f"认证失败（可选）: {e.detail}")
        return None
    except Exception as e:
        logger.error(f"获取当前用户时发生异常: {e}")
        return None


async def get_current_active_user(
    current_user: Annotated[Optional[User], Depends(get_current_user)]
) -> User:
    """
    获取当前活跃用户（必须认证）

    如果用户未认证或被禁用，抛出401/403异常
    用于需要强制认证的端点
    """
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供有效的认证令牌",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账户已被禁用，请联系管理员"
        )

    return current_user


def require_role(*required_roles: UserRole):
    """
    角色权限装饰器工厂

    用于限制特定角色才能访问的端点

    Args:
        *required_roles: 允许的角色列表

    Returns:
        依赖注入函数

    示例:
        @router.get("/admin-only")
        async def admin_route(user: User = Depends(require_role(UserRole.ADMIN))):
            ...
    """
    async def role_checker(
        current_user: Annotated[User, Depends(get_current_active_user)]
    ) -> User:
        # ADMIN 角色拥有所有权限
        if current_user.role == UserRole.ADMIN:
            return current_user

        if current_user.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "INSUFFICIENT_ROLE",
                    "message": f"权限不足，需要以下角色之一: {', '.join([r.value for r in required_roles])}",
                    "current_role": current_user.role.value,
                }
            )
        return current_user

    return role_checker


def require_permissions(permissions: List[str]):
    """
    细粒度权限检查装饰器工厂

    基于权限字符串进行细粒度控制（RBAC增强版）
    权限格式: "resource:action" (例如: "formula:create", "user:read")

    Args:
        permissions: 需要的权限列表（满足其一即可）

    Returns:
        依赖注入函数

    示例:
        @router.post("/formulas")
        async def create_formula(
            user: User = Depends(require_permissions(["formula:create"]))
        ):
            ...
    """
    async def permission_checker(
        current_user: Annotated[User, Depends(get_current_active_user)]
    ) -> User:
        # ADMIN 角色拥有所有权限
        if current_user.role == UserRole.ADMIN:
            return current_user

        # 从用户的preferences中读取自定义权限（如果有的话）
        # 这里可以根据实际业务逻辑调整
        user_permissions = _get_user_permissions(current_user)

        # 检查是否拥有所需权限
        has_permission = any(perm in user_permissions for perm in permissions)

        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "PERMISSION_DENIED",
                    "message": f"权限不足，需要以下权限之一: {', '.join(permissions)}",
                    "hint": "请联系管理员分配相应权限",
                }
            )

        return current_user

    return permission_checker


def _get_user_permissions(user: User) -> List[str]:
    """
    获取用户的权限列表

    根据角色映射到具体权限（可根据业务需求扩展）

    Args:
        user: 用户对象

    Returns:
        List[str]: 权限字符串列表
    """
    # 基于角色的默认权限映射
    role_permission_map = {
        UserRole.GUEST: [
            "formula:read",
            "experiment:read",
        ],
        UserRole.RESEARCHER: [
            "formula:read", "formula:create", "formula:update",
            "experiment:read", "experiment:create", "experiment:update",
            "ingredient:read",
            "peptide:read",
        ],
        UserRole.FORMULATOR: [
            "formula:read", "formula:create", "formula:update", "formula:delete",
            "experiment:read", "experiment:create", "experiment:update", "experiment:delete",
            "ingredient:read", "ingredient:create", "ingredient:update",
            "peptide:read", "peptide:create",
        ],
        UserRole.REVIEWER: [
            "formula:read", "formula:review",
            "experiment:read", "experiment:review",
            "user:read",
            "audit:read",
        ],
        UserRole.ADMIN: [
            "*",  # 管理员拥有所有权限
        ],
    }

    base_permissions = role_permission_map.get(user.role, [])

    # 支持通过用户 preferences 字段添加额外权限
    if user.preferences and isinstance(user.preferences, dict):
        extra_permissions = user.preferences.get("extra_permissions", [])
        if isinstance(extra_permissions, list):
            base_permissions.extend(extra_permissions)

    return base_permissions


class PaginationParams:
    """分页参数"""
    def __init__(
        self,
        page: int = Query(1, ge=1, description="页码"),
        page_size: int = Query(10, ge=1, le=100, description="每页条数")
    ):
        self.page = page
        self.page_size = page_size


class FormulaFilterParams:
    """配方筛选参数"""
    def __init__(
        self,
        status: Optional[str] = Query(None, description="配方状态"),
        creator_id: Optional[int] = Query(None, description="创建者ID"),
        search: Optional[str] = Query(None, description="搜索关键词")
    ):
        self.status = status
        self.creator_id = creator_id
        self.search = search


class ExperimentFilterParams:
    """实验筛选参数"""
    def __init__(
        self,
        status: Optional[str] = Query(None, description="实验状态"),
        researcher_id: Optional[int] = Query(None, description="研究员ID"),
        formula_id: Optional[int] = Query(None, description="配方ID"),
        search: Optional[str] = Query(None, description="搜索关键词")
    ):
        self.status = status
        self.researcher_id = researcher_id
        self.formula_id = formula_id
        self.search = search


# 常用依赖
CurrentUser = Annotated[User, Depends(get_current_active_user)]
DbSession = Annotated[AsyncSession, Depends(get_db_session)]

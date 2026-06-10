"""RMFOOD 权限检查

基于ABAC的权限检查机制
"""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import User
from app.models.enums import UserRole
from app.core.exceptions import PermissionDeniedException, ResourceNotFoundException


class Permission:
    """权限定义"""
    # 配方权限
    FORMULA_CREATE = "formula:create"
    FORMULA_READ = "formula:read"
    FORMULA_UPDATE = "formula:update"
    FORMULA_DELETE = "formula:delete"
    FORMULA_REVIEW = "formula:review"
    FORMULA_APPROVE = "formula:approve"
    FORMULA_REJECT = "formula:reject"

    # 实验权限
    EXPERIMENT_CREATE = "experiment:create"
    EXPERIMENT_READ = "experiment:read"
    EXPERIMENT_UPDATE = "experiment:update"
    EXPERIMENT_DELETE = "experiment:delete"

    # 数据库权限
    DATABASE_SEARCH = "database:search"
    DATABASE_EXPORT = "database:export"

    # AI服务权限
    AI_USE = "ai:use"

    # 用户管理权限
    USER_CREATE = "user:create"
    USER_READ = "user:read"
    USER_UPDATE = "user:update"
    USER_DELETE = "user:delete"

    # 系统权限
    SYSTEM_CONFIG = "system:config"
    AUDIT_VIEW = "audit:view"


ROLE_PERMISSIONS = {
    UserRole.GUEST: [
        Permission.FORMULA_READ,
        Permission.EXPERIMENT_READ,
        Permission.DATABASE_SEARCH,
    ],
    UserRole.RESEARCHER: [
        Permission.FORMULA_READ,
        Permission.FORMULA_CREATE,
        Permission.EXPERIMENT_READ,
        Permission.EXPERIMENT_CREATE,
        Permission.EXPERIMENT_UPDATE,
        Permission.DATABASE_SEARCH,
        Permission.AI_USE,
    ],
    UserRole.FORMULATOR: [
        Permission.FORMULA_READ,
        Permission.FORMULA_CREATE,
        Permission.FORMULA_UPDATE,
        Permission.EXPERIMENT_READ,
        Permission.EXPERIMENT_CREATE,
        Permission.EXPERIMENT_UPDATE,
        Permission.DATABASE_SEARCH,
        Permission.AI_USE,
    ],
    UserRole.REVIEWER: [
        Permission.FORMULA_READ,
        Permission.FORMULA_REVIEW,
        Permission.FORMULA_APPROVE,
        Permission.FORMULA_REJECT,
        Permission.EXPERIMENT_READ,
        Permission.DATABASE_SEARCH,
        Permission.AUDIT_VIEW,
    ],
    UserRole.ADMIN: [
        Permission.FORMULA_CREATE,
        Permission.FORMULA_READ,
        Permission.FORMULA_UPDATE,
        Permission.FORMULA_DELETE,
        Permission.FORMULA_REVIEW,
        Permission.FORMULA_APPROVE,
        Permission.FORMULA_REJECT,
        Permission.EXPERIMENT_CREATE,
        Permission.EXPERIMENT_READ,
        Permission.EXPERIMENT_UPDATE,
        Permission.EXPERIMENT_DELETE,
        Permission.DATABASE_SEARCH,
        Permission.DATABASE_EXPORT,
        Permission.AI_USE,
        Permission.USER_CREATE,
        Permission.USER_READ,
        Permission.USER_UPDATE,
        Permission.USER_DELETE,
        Permission.SYSTEM_CONFIG,
        Permission.AUDIT_VIEW,
    ],
}


class PermissionChecker:
    """ABAC权限检查器"""

    def __init__(self, user: User):
        self.user = user
        self.role_permissions = ROLE_PERMISSIONS.get(user.role, [])

    def has_permission(self, permission: str) -> bool:
        """检查用户是否拥有指定权限"""
        if self.user.role == UserRole.ADMIN:
            return True
        return permission in self.role_permissions

    def require_permission(self, permission: str) -> None:
        """要求用户拥有指定权限，否则抛出异常"""
        if not self.has_permission(permission):
            raise PermissionDeniedException(
                f"需要权限 {permission} 才能执行此操作"
            )

    async def can_access_resource(
        self,
        session: AsyncSession,
        resource_type: str,
        resource_id: int,
        action: str
    ) -> bool:
        """检查用户是否可以访问特定资源

        Args:
            session: 数据库会话
            resource_type: 资源类型 (formula, experiment等)
            resource_id: 资源ID
            action: 操作类型 (read, update, delete等)

        Returns:
            是否可以访问
        """
        if self.user.role == UserRole.ADMIN:
            return True

        if resource_type == "formula":
            from app.models.formula import Formula

            result = await session.execute(
                select(Formula).where(Formula.id == resource_id)
            )
            resource = result.scalar_one_or_none()

            if not resource:
                return False

            if action in ["read"]:
                return True

            if action in ["update", "delete"]:
                return resource.creator_id == self.user.id

            if action in ["review", "approve", "reject"]:
                return self.user.role == UserRole.REVIEWER

        if resource_type == "experiment":
            from app.models.experiment import Experiment

            result = await session.execute(
                select(Experiment).where(Experiment.id == resource_id)
            )
            resource = result.scalar_one_or_none()

            if not resource:
                return False

            if action in ["read"]:
                return True

            if action in ["update", "delete"]:
                return resource.researcher_id == self.user.id

        return False

    async def require_resource_access(
        self,
        session: AsyncSession,
        resource_type: str,
        resource_id: int,
        action: str
    ) -> None:
        """要求用户可以访问特定资源，否则抛出异常"""
        if not await self.can_access_resource(session, resource_type, resource_id, action):
            raise PermissionDeniedException(
                f"无权{action}资源 {resource_type}:{resource_id}"
            )


def check_role_permission(user_role: UserRole, permission: str) -> bool:
    """检查角色是否拥有指定权限"""
    if user_role == UserRole.ADMIN:
        return True
    return permission in ROLE_PERMISSIONS.get(user_role, [])


def require_role_permission(user_role: UserRole, permission: str) -> None:
    """要求角色拥有指定权限"""
    if not check_role_permission(user_role, permission):
        raise PermissionDeniedException(
            f"角色 {user_role.value} 需要权限 {permission}"
        )

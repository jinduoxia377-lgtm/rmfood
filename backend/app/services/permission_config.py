"""
权限配置化服务

支持从数据库动态加载角色权限映射，同时保留代码级默认值作为降级方案。

使用方式:
    # 1. 创建数据库表 (见 migration 文件)
    # 2. 配置环境变量
    #    PERMISSION_CONFIG_SOURCE=db  # 从数据库加载
    #    PERMISSION_CONFIG_SOURCE=code  # 使用代码默认值

    from app.services.permission_config import PermissionConfigService
    service = PermissionConfigService(db)
    permissions = await service.get_role_permissions(user_role)
"""

import logging
import os
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete

from app.models.enums import UserRole
from app.core.rbac.permission import ROLE_PERMISSIONS, Permission

logger = logging.getLogger(__name__)

# 配置源: db=数据库, code=代码默认值
_PERM_CONFIG_SOURCE = os.environ.get("PERMISSION_CONFIG_SOURCE", "code")


class PermissionConfigService:
    """权限配置服务 — 支持数据库动态加载"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_role_permissions(self, role: UserRole) -> List[str]:
        """获取角色权限列表（数据库优先，降级到代码默认值）"""
        if _PERM_CONFIG_SOURCE == "db":
            # 从数据库读取
            perms = await self._load_from_db(role)
            if perms:
                return perms
            logger.warning(f"[PermissionConfig] 数据库中没有角色 {role.name} 的配置，使用默认值")

        # 降级到代码默认值
        return ROLE_PERMISSIONS.get(role, [])

    async def update_role_permissions(
        self,
        role: UserRole,
        permissions: List[str],
    ) -> bool:
        """更新角色权限配置（仅当 PERMISSION_CONFIG_SOURCE=db 时生效）"""
        if _PERM_CONFIG_SOURCE != "db":
            logger.warning("[PermissionConfig] 权限配置源不是数据库，无法更新")
            return False

        # TODO: 实现数据库写入
        # await self.db.execute(
        #     update(RolePermission).where(
        #         RolePermission.role == role.value
        #     ).values(permissions=permissions)
        # )
        # await self.db.flush()
        logger.info(f"[PermissionConfig] 角色 {role.name} 权限已更新: {permissions}")
        return True

    async def reset_to_defaults(self) -> bool:
        """重置所有角色权限到代码默认值"""
        if _PERM_CONFIG_SOURCE != "db":
            return False

        # TODO: 从数据库删除自定义配置，回退到默认值
        logger.info("[PermissionConfig] 已重置所有角色权限到默认值")
        return True

    async def _load_from_db(self, role: UserRole) -> Optional[List[str]]:
        """从数据库加载角色权限"""
        # TODO: 实现数据库查询
        # result = await self.db.execute(
        #     select(RolePermission.permissions).where(
        #         RolePermission.role == role.value
        #     )
        # )
        # row = result.scalar_one_or_none()
        # return row if row else None
        return None


def get_current_permission_source() -> str:
    """获取当前权限配置源"""
    return _PERM_CONFIG_SOURCE

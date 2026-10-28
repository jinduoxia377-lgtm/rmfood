"""
权限配置化服务

支持从数据库动态加载角色权限映射，同时保留代码级默认值作为降级方案。

持久化方式：
- 复用现有 `system_configs` 表（`SystemConfig` 模型，key-value JSON 配置表），
  与 LLM 用户密钥、AI 反馈日志等配置使用同一套持久化机制，无需新增迁移。
- 配置键：`role_permissions`，config_value 为 `{ "ADMIN": ["formula:create", ...], ... }`。

使用方式:
    # 1. 配置环境变量
    #    PERMISSION_CONFIG_SOURCE=db  # 从数据库加载
    #    PERMISSION_CONFIG_SOURCE=code  # 使用代码默认值

    from app.services.permission_config import PermissionConfigService
    service = PermissionConfigService(db)
    permissions = await service.get_role_permissions(user_role)
"""

import json
import logging
import os
from typing import Dict, List, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac.permission import ROLE_PERMISSIONS
from app.models.enums import UserRole

logger = logging.getLogger(__name__)

# 配置源: db=数据库, code=代码默认值
_PERM_CONFIG_SOURCE = os.environ.get("PERMISSION_CONFIG_SOURCE", "code")

# system_configs 表中的配置键
_CONFIG_KEY = "role_permissions"

# 内存缓存：数据库读取失败时兜底使用（写/删成功时同步更新）
_CACHE: Dict[str, List[str]] = {}


class PermissionConfigService:
    """权限配置服务 — 支持数据库动态加载"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_role_permissions(self, role: UserRole) -> List[str]:
        """获取角色权限列表（数据库优先，内存缓存兜底，最后降级到代码默认值）"""
        if _PERM_CONFIG_SOURCE != "db":
            return ROLE_PERMISSIONS.get(role, [])

        # 1. 数据库优先
        try:
            perms = await self._load_from_db(role)
            if perms is not None:
                _CACHE[role.value] = perms
                return perms
        except Exception as e:
            logger.warning(
                f"[PermissionConfig] 数据库读取失败，使用内存缓存/默认值兜底: {e}"
            )

        # 2. 内存缓存兜底（仅当数据库不可用时）
        cached = _CACHE.get(role.value)
        if cached is not None:
            return cached

        # 3. 代码默认值
        logger.warning(f"[PermissionConfig] 数据库中没有角色 {role.name} 的配置，使用默认值")
        return ROLE_PERMISSIONS.get(role, [])

    async def update_role_permissions(
        self,
        role: UserRole,
        permissions: List[str],
    ) -> bool:
        """更新角色权限配置（upsert 到 system_configs，仅当 PERMISSION_CONFIG_SOURCE=db 时生效）"""
        if _PERM_CONFIG_SOURCE != "db":
            logger.warning("[PermissionConfig] 权限配置源不是数据库，无法更新")
            return False

        from ..core.database.session import async_session_factory
        from ..models.system import SystemConfig

        perm_list = list(permissions)
        try:
            async with async_session_factory() as db:
                result = await db.execute(
                    select(SystemConfig).where(SystemConfig.config_key == _CONFIG_KEY)
                )
                row = result.scalar_one_or_none()
                if row:
                    value = row.config_value
                    # 兼容 system_configs.config_value 为 TEXT 列（JSON 字符串）的存储方式
                    if isinstance(value, str):
                        try:
                            value = json.loads(value)
                        except Exception:
                            value = {}
                    value = dict(value or {})
                    value[role.value] = perm_list
                    row.config_value = value
                else:
                    db.add(SystemConfig(
                        config_key=_CONFIG_KEY,
                        config_value={role.value: perm_list},
                    ))
                await db.commit()
            _CACHE[role.value] = perm_list
            logger.info(f"[PermissionConfig] 角色 {role.name} 权限已持久化: {perm_list}")
            return True
        except Exception as e:
            logger.error(f"[PermissionConfig] 角色 {role.name} 权限持久化失败: {e}")
            return False

    async def reset_to_defaults(self) -> bool:
        """重置所有角色权限到代码默认值（删除 system_configs 中的自定义配置）"""
        if _PERM_CONFIG_SOURCE != "db":
            return False

        from ..core.database.session import async_session_factory
        from ..models.system import SystemConfig

        try:
            async with async_session_factory() as db:
                await db.execute(
                    delete(SystemConfig).where(SystemConfig.config_key == _CONFIG_KEY)
                )
                await db.commit()
            _CACHE.clear()
            logger.info("[PermissionConfig] 已重置所有角色权限到默认值")
            return True
        except Exception as e:
            logger.error(f"[PermissionConfig] 重置角色权限失败: {e}")
            return False

    async def _load_from_db(self, role: UserRole) -> Optional[List[str]]:
        """从数据库加载角色权限（读 system_configs 中 role_permissions 配置）"""
        from ..models.system import SystemConfig

        result = await self.db.execute(
            select(SystemConfig).where(SystemConfig.config_key == _CONFIG_KEY)
        )
        row = result.scalar_one_or_none()
        if row is None:
            return None
        value = row.config_value
        # 兼容 system_configs.config_value 为 TEXT 列（JSON 字符串）的存储方式
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except Exception:
                logger.warning("[PermissionConfig] role_permissions 配置不是合法 JSON")
                return None
        if not isinstance(value, dict):
            return None
        perms = value.get(role.value)
        return list(perms) if perms else None


def get_current_permission_source() -> str:
    """获取当前权限配置源"""
    return _PERM_CONFIG_SOURCE

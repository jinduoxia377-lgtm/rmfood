"""RMFOOD 团队协作权限校验服务

提供核心权限检查功能：
- 带缓存的权限检查
- 批量权限检查
- 用户权限查询
- Redis集成支持
"""
import hashlib
import logging
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.team_member import TeamMember
from app.services.auth.permissions import (
    PermissionCheck,
    PermissionResult,
    check_role_permission,
    get_all_permissions_for_role,
)

logger = logging.getLogger(__name__)


class PermissionService:
    """
    权限校验服务（带缓存支持）

    Attributes:
        cache: 缓存客户端（可选Redis或内存缓存）
        cache_ttl: 缓存过期时间（秒）
    """

    def __init__(self, cache=None, cache_ttl: int = 300):
        self.cache = cache
        self.cache_ttl = cache_ttl

    async def check_permission(
        self,
        user_id: int,
        resource_type: str,
        resource_id: int,
        action: str,
        db: AsyncSession = None,
    ) -> bool:
        """
        核心权限检查（带缓存）

        实现逻辑：
        1. 先查缓存
        2. 缓存未命中则查数据库
        3. 结果写入缓存
        4. 返回bool

        Args:
            user_id: 用户ID
            resource_type: 资源类型
            resource_id: 资源ID
            action: 操作类型
            db: 数据库会话（可选）

        Returns:
            是否有权限
        """
        cache_key = self._make_cache_key(user_id, resource_type, resource_id, action)

        cached_result = await self._get_from_cache(cache_key)
        if cached_result is not None:
            return cached_result

        if db is None:
            logger.warning("未提供数据库会话，使用默认权限检查")
            return False

        user_role = await self._get_user_role_in_resource(
            db, user_id, resource_type, resource_id
        )

        has_perm = check_role_permission(user_role, resource_type, action)

        await self._set_to_cache(cache_key, has_perm)

        if not has_perm:
            logger.debug(
                f"❌ 权限检查失败:\n"
                f"   用户: {user_id}\n"
                f"   资源: {resource_type}:{resource_id}\n"
                f"   操作: {action}\n"
                f"   角色: {user_role}"
            )

        return has_perm

    async def get_user_permissions(
        self,
        user_id: int,
        team_id: int,
        db: AsyncSession,
    ) -> Dict[str, List[str]]:
        """
        获取用户在团队内的所有权限（用于前端渲染控制）

        Args:
            user_id: 用户ID
            team_id: 团队ID
            db: 数据库会话

        Returns:
            权限字典 {resource_type: [actions]}
        """
        result = await db.execute(
            select(TeamMember.role).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
            )
        )
        member = result.scalar_one_or_none()

        if not member:
            return {}

        role_str = member.role.value if hasattr(member.role, 'value') else str(member.role)

        permissions = get_all_permissions_for_role(role_str)

        structured_perms: Dict[str, List[str]] = {}
        for perm_str in permissions:
            parts = perm_str.split(':')
            if len(parts) == 2:
                resource, action = parts
                if resource not in structured_perms:
                    structured_perms[resource] = []
                structured_perms[resource].append(action)

        return structured_perms

    async def batch_check_permissions(
        self,
        user_id: int,
        checks: List[PermissionCheck],
        db: AsyncSession,
    ) -> Dict[str, bool]:
        """
        批量权限检查（减少DB查询）

        Args:
            user_id: 用户ID
            checks: 权限检查请求列表
            db: 数据库会话

        Returns:
            检查结果字典 {"check_key": bool}
        """
        results: Dict[str, bool] = {}

        role_cache: Dict[int, str] = {}

        for check in checks:
            cache_key = f"{check.resource_type}:{check.resource_id}:{check.action}"

            cached = await self._get_from_cache(
                self._make_cache_key(user_id, check.resource_type, check.resource_id, check.action)
            )
            if cached is not None:
                results[cache_key] = cached
                continue

            resource_key = f"{check.resource_type}:{check.resource_id}"
            if resource_key not in role_cache:
                role_cache[resource_key] = await self._get_user_role_in_resource(
                    db, user_id, check.resource_type, check.resource_id
                )

            user_role = role_cache[resource_key]
            has_perm = check_role_permission(user_role, check.resource_type, check.action)

            results[cache_key] = has_perm

            await self._set_to_cache(
                self._make_cache_key(user_id, check.resource_type, check.resource_id, check.action),
                has_perm
            )

        logger.info(f"📋 批量权限检查完成: {len(checks)} 项, 命中缓存 {len(checks) - len(role_cache)} 项")

        return results

    async def require_permission(
        self,
        user_id: int,
        resource_type: str,
        resource_id: int,
        action: str,
        db: AsyncSession,
    ) -> PermissionResult:
        """
        要求拥有权限，否则返回详细的结果对象

        Args:
            user_id: 用户ID
            resource_type: 资源类型
            resource_id: 资源ID
            action: 操作类型
            db: 数据库会话

        Returns:
            PermissionResult 对象
        """
        has_perm = await self.check_permission(
            user_id, resource_type, resource_id, action, db
        )

        if has_perm:
            return PermissionResult(allowed=True)

        user_role = await self._get_user_role_in_resource(
            db, user_id, resource_type, resource_id
        )

        min_required_role = self._find_min_required_role(resource_type, action)

        return PermissionResult(
            allowed=False,
            reason=f"角色 '{user_role}' 没有 {resource_type}:{action} 权限",
            required_role=min_required_role,
        )

    def invalidate_user_cache(self, user_id: int):
        """
        使用户权限缓存失效（角色变更时调用）

        Args:
            user_id: 用户ID
        """
        if self.cache:
            try:
                if hasattr(self.cache, 'keys'):
                    keys_to_delete = [
                        k for k in self.cache.keys()
                        if k.startswith(f"perm:{user_id}:")
                    ]
                    for key in keys_to_delete:
                        del self.cache[key]
                logger.info(f"🗑️ 用户权限缓存已失效: user {user_id}")
            except Exception as e:
                logger.warning(f"清除缓存失败: {e}")

    def _make_cache_key(
        self,
        user_id: int,
        resource_type: str,
        resource_id: int,
        action: str,
    ) -> str:
        """生成缓存键"""
        data = f"{user_id}:{resource_type}:{resource_id}:{action}"
        return f"perm:{hashlib.md5(data.encode()).hexdigest()}"

    async def _get_from_cache(self, key: str) -> Optional[bool]:
        """从缓存读取"""
        if not self.cache:
            return None

        try:
            if hasattr(self.cache, 'get'):
                value = await self.cache.get(key) if callable(self.cache.get) else self.cache.get(key)
                if value is not None:
                    return value.lower() == 'true' if isinstance(value, str) else bool(value)
        except Exception as e:
            logger.debug(f"缓存读取失败: {e}")

        return None

    async def _set_to_cache(self, key: str, value: bool):
        """写入缓存"""
        if not self.cache:
            return

        try:
            if hasattr(self.cache, 'set'):
                set_func = self.cache.set
                if callable(set_func):
                    await set_func(key, str(value), ex=self.cache_ttl)
                else:
                    self.cache[key] = str(value)
            elif isinstance(self.cache, dict):
                self.cache[key] = str(value)
        except Exception as e:
            logger.debug(f"缓存写入失败: {e}")

    async def _get_user_role_in_resource(
        self,
        db: AsyncSession,
        user_id: int,
        resource_type: str,
        resource_id: int,
    ) -> str:
        """从数据库查询用户在资源上的角色"""
        if resource_type == "team":
            result = await db.execute(
                select(TeamMember.role).where(
                    TeamMember.team_id == resource_id,
                    TeamMember.user_id == user_id,
                )
            )
            member = result.scalar_one_or_none()

            if member:
                return member.role.value if hasattr(member.role, 'value') else str(member.role)

        return "guest"

    def _find_min_required_role(self, resource: str, action: str) -> Optional[str]:
        """
        查找执行操作所需的最低角色

        Args:
            resource: 资源类型
            action: 操作

        Returns:
            最低要求的角色名称
        """
        role_order = ["owner", "admin", "member", "guest"]

        for role in role_order:
            if check_role_permission(role, resource, action):
                return role

        return None

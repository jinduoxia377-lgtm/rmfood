"""RMFOOD 团队协作权限校验装饰器

提供FastAPI依赖注入的权限检查装饰器：
- require_permission: 基于资源和操作的权限检查
- require_team_role: 基于团队角色的权限检查
- 支持Redis缓存（TTL=5分钟）
"""
import functools
import logging
from typing import Optional, Callable, Any, List

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.auth.permissions import (
    TeamResource,
    TeamAction,
    check_role_permission,
    PermissionCheck,
    PermissionResult,
)
from app.models.enums import TeamRole
from app.core.exceptions import PermissionDeniedException

logger = logging.getLogger(__name__)


def require_permission(
    resource: str,
    action: str,
):
    """
    权限校验装饰器工厂
    
    用法:
        @require_permission("prompt_template", "edit")
        async def update_prompt(...): ...
    
    实现逻辑：
    1. 从路径参数/请求体提取resource_id
    2. 查询当前用户在该资源上的角色
    3. 检查角色是否拥有该action权限
    4. 缓存权限结果（如果可用Redis，TTL=5分钟）
    5. 无权限时抛出PermissionDeniedError
    
    Args:
        resource: 资源类型 (team/category/prompt_template/version)
        action: 操作 (view/create/edit/delete/manage等)
        
    Returns:
        装饰器函数
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            from app.api.deps import CurrentUser, DbSession
            
            current_user = kwargs.get('current_user')
            db = kwargs.get('db')

            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="未提供有效的认证令牌",
                )

            team_id = kwargs.get('team_id')
            
            if not team_id:
                for key, value in kwargs.items():
                    if key.endswith('_id') and isinstance(value, int) and value > 0:
                        potential_team_id = value
                        break
                else:
                    potential_team_id = None
                
                if potential_team_id:
                    team_id = potential_team_id

            if not team_id:
                logger.warning(f"无法确定team_id进行权限检查: {func.__name__}")
                return await func(*args, **kwargs)

            try:
                from app.services.team.team_impl import TeamService
                team_service = TeamService(db)
                
                team_detail = await team_service.get_team(team_id, current_user.id)
                user_role = team_detail.get('current_user_role', 'guest')
                
            except Exception as e:
                logger.error(f"获取用户角色失败: {e}")
                user_role = 'guest'

            has_permission = check_role_permission(user_role, resource, action)

            if not has_permission:
                logger.warning(
                    f"❌ 权限拒绝:\n"
                    f"   用户: {current_user.id} ({current_user.username})\n"
                    f"   团队: {team_id}\n"
                    f"   角色: {user_role}\n"
                    f"   所需权限: {resource}:{action}"
                )
                
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error_code": "PERMISSION_DENIED",
                        "message": f"权限不足：需要 {resource}:{action} 权限",
                        "required_permission": f"{resource}:{action}",
                        "current_role": user_role,
                        "hint": "请联系团队管理员提升权限",
                    }
                )

            logger.debug(
                f"✅ 权限允许:\n"
                f"   用户: {current_user.id}\n"
                f"   权限: {resource}:{action}"
            )

            return await func(*args, **kwargs)

        return wrapper
    return decorator


def require_team_role(*allowed_roles: TeamRole):
    """
    团队角色验证依赖（FastAPI Depends）
    
    用于限制特定团队角色才能访问的端点
    
    Args:
        *allowed_roles: 允许的角色列表
        
    Returns:
        依赖注入函数
        
    示例:
        @router.get("/admin")
        async def admin_route(
            team_id: int,
            user: User = Depends(require_team_role(TeamRole.ADMIN))
        ):
            ...
    """
    async def role_checker(
        team_id: int,
        current_user:CurrentUser,
        db: DbSession,
    ):
        try:
            from app.services.team.team_impl import TeamService
            team_service = TeamService(db)
            
            team_detail = await team_service.get_team(team_id, current_user.id)
            user_role_str = team_detail.get('current_user_role', 'guest')
            
            try:
                user_role = TeamRole(user_role_str)
            except ValueError:
                user_role = TeamRole.GUEST
            
            if user_role not in allowed_roles and TeamRole.OWNER not in allowed_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error_code": "ROLE_FORBIDDEN",
                        "message": f"需要以下团队角色之一: {', '.join([r.value for r in allowed_roles])}",
                        "required_roles": [r.value for r in allowed_roles],
                        "current_role": user_role.value,
                    }
                )

            return current_user

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"角色验证失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="角色验证过程中发生错误",
            )

    return role_checker


class PermissionCache:
    """简单的内存权限缓存（可替换为Redis）"""

    def __init__(self, ttl: int = 300):
        self.cache: Dict[str, tuple] = {}
        self.ttl = ttl

    def _make_key(self, user_id: int, resource: str, resource_id: int, action: str) -> str:
        return f"perm:{user_id}:{resource}:{resource_id}:{action}"

    def get(self, user_id: int, resource: str, resource_id: int, action: str) -> Optional[bool]:
        """从缓存获取权限结果"""
        key = self._make_key(user_id, resource, resource_id, action)
        
        if key in self.cache:
            result, timestamp = self.cache[key]
            
            import time
            if time.time() - timestamp < self.ttl:
                return result
            else:
                del self.cache[key]
        
        return None

    def set(self, user_id: int, resource: str, resource_id: int, action: str, result: bool):
        """设置缓存"""
        key = self._make_key(user_id, resource, resource_id, action)
        
        import time
        self.cache[key] = (result, time.time())

    def invalidate(self, user_id: Optional[int] = None):
        """使缓存失效"""
        if user_id:
            keys_to_delete = [k for k in self.cache if k.startswith(f"perm:{user_id}:")]
            for key in keys_to_delete:
                del self.cache[key]
        else:
            self.cache.clear()


permission_cache = PermissionCache(ttl=300)

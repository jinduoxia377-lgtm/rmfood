"""
用户服务
用户 CRUD、权限管理、审计日志
"""
import logging
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import User, UserRole, AuditLog
from ..schemas.user import UserCreate, UserUpdate

logger = logging.getLogger(__name__)


class UserService:
    """用户业务逻辑"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user(self, user_id: int) -> User:
        """获取单个用户"""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在",
            )
        return user

    async def get_user_by_username(self, username: str) -> Optional[User]:
        """按用户名查找"""
        result = await self.db.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()

    async def list_users(
        self,
        page: int = 1,
        page_size: int = 20,
        role: Optional[UserRole] = None,
        search: Optional[str] = None,
        include_deleted: bool = False,
    ) -> tuple[list[User], int]:
        """获取用户列表（分页 + 搜索）"""
        query = select(User)

        # 软删除过滤
        if not include_deleted and hasattr(User, 'deleted_at'):
            query = query.where(User.deleted_at.is_(None))

        # 角色过滤
        if role:
            query = query.where(User.role == role)

        # 关键词搜索
        if search:
            pattern = f"%{search}%"
            query = query.where(
                User.username.ilike(pattern)
                | User.full_name.ilike(pattern)
                | User.email.ilike(pattern)
            )

        # 计算总数
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar() or 0

        # 分页
        query = query.order_by(User.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        users = list(result.scalars().all())

        return users, total

    async def create_user(self, data: UserCreate) -> User:
        """创建用户"""
        from .auth import get_password_hash

        # 唯一性检查
        for field, value in [("username", data.username), ("email", data.email)]:
            existing = await self.db.execute(
                select(User).where(getattr(User, field) == value)
            )
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{field} 已存在",
                )

        # 角色：默认研究员；仅接受后端枚举中的角色
        role = UserRole.RESEARCHER
        if data.role:
            try:
                role = UserRole(data.role)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"无效的角色: {data.role}",
                )

        user = User(
            username=data.username,
            email=data.email,
            hashed_password=get_password_hash(data.password),
            full_name=data.full_name,
            role=role,
            department=data.department,
            organization_id=data.organization_id,
        )
        self.db.add(user)
        await self.db.flush()

        # 审计日志
        await self._audit_log(action="user.create", entity_type="user", entity_id=user.id)

        logger.info(f"创建用户: {user.username}")
        return user

    async def update_user(self, user_id: int, data: UserUpdate) -> User:
        """更新用户"""
        user = await self.get_user(user_id)
        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(user, field, value)

        await self.db.flush()
        await self._audit_log(action="user.update", entity_type="user", entity_id=user_id)

        return user

    async def update_user_role(self, user_id: int, role: UserRole) -> User:
        """更新用户角色（管理员操作）"""
        user = await self.get_user(user_id)
        old_role = user.role
        user.role = role
        await self.db.flush()

        await self._audit_log(
            action="user.role_change",
            entity_type="user",
            entity_id=user_id,
            details={"old_role": old_role.value, "new_role": role.value},
        )

        logger.info(f"用户角色变更: {user.username} {old_role.value} -> {role.value}")
        return user

    async def deactivate_user(self, user_id: int) -> User:
        """停用用户"""
        user = await self.get_user(user_id)
        user.is_active = False
        await self.db.flush()

        await self._audit_log(action="user.deactivate", entity_type="user", entity_id=user_id)
        return user

    async def deactivate_account(self, user_id: int) -> User:
        """
        注销账户（GDPR/个保法「被遗忘权」）

        软删除 + 匿名化：
        - is_active=False，立即失去登录/访问能力（get_current_active_user 会拦截）
        - 用户名/邮箱匿名化为 deleted_<id>，释放唯一索引占用
        - 清空全部个人资料、头像、2FA 密钥与设备会话
        - 在 preferences 中记录注销时间戳，供 30 天后的后台清理任务使用
        """
        user = await self.get_user(user_id)

        from datetime import datetime, timezone

        # 匿名化唯一标识与个人资料
        user.username = f"deleted_{user.id}"
        user.email = f"deleted_{user.id}@deleted.local"
        user.full_name = None
        user.phone = None
        user.department = None
        user.avatar_url = None
        user.position = None
        user.bio = None
        user.website = None
        user.github = None
        user.linkedin = None

        # 清除 2FA
        user.two_factor_secret = None
        user.two_factor_enabled = False

        # 标记注销时间（不新增列，存于 preferences JSON）
        prefs = dict(user.preferences or {})
        prefs["account_deleted"] = True
        prefs["deleted_at"] = datetime.now(timezone.utc).isoformat()
        user.preferences = prefs

        # 使所有设备会话失效
        from ..models import UserDevice
        result = await self.db.execute(
            select(UserDevice).where(UserDevice.user_id == user_id)
        )
        for device in result.scalars().all():
            device.is_active = False

        user.is_active = False
        await self.db.flush()

        await self._audit_log(
            action="user.delete",
            entity_type="user",
            entity_id=user_id,
            details={"anonymized": True, "soft_delete": True},
        )
        logger.info(f"账户已注销并匿名化: user_id={user_id}")
        return user

    async def _audit_log(
        self,
        action: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        details: Optional[dict] = None,
    ):
        """记录审计日志"""
        log = AuditLog(
            action=action,
            resource_type=entity_type,
            resource_id=entity_id,
            details=details,
        )
        self.db.add(log)

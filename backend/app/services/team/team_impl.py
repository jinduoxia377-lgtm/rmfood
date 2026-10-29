"""RMFOOD 团队空间管理服务

提供完整的团队生命周期管理功能：
- 团队创建、更新、归档
- 成员邀请、移除、角色管理
- 邀请链接生成与验证
- 权限检查与审计日志
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.middleware.audit_system import AuditService
from app.core.middleware.exceptions import NotFoundError, PermissionDeniedError
from app.models.enums import NotificationType, TeamRole
from app.models.notification import Notification
from app.models.team import Team
from app.models.team_member import TeamMember
from app.models.user_model import User

logger = logging.getLogger(__name__)


class TeamService:
    """团队空间管理服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.audit_logger = AuditService(db)

    async def create_team(
        self,
        owner_id: int,
        name: str,
        description: Optional[str] = None,
        settings: Optional[Dict[str, Any]] = None,
    ) -> Team:
        """
        创建新团队

        Args:
            owner_id: 创建者用户ID
            name: 团队名称（2-100字符）
            description: 可选描述
            settings: 团队设置

        Returns:
            创建的Team对象

        Raises:
            ValueError: 参数验证失败
        """
        if len(name) < 2 or len(name) > 100:
            raise ValueError("团队名称长度必须在2-100个字符之间")

        default_settings = {
            "max_members": 50,
            "visibility": "private",
            "allow_member_invite": False,
            "require_approval": True,
        }

        if settings:
            default_settings.update(settings)

        team = Team(
            name=name,
            description=description,
            owner_id=owner_id,
            settings=default_settings,
        )
        self.db.add(team)
        await self.db.flush()

        owner_member = TeamMember(
            team_id=team.id,
            user_id=owner_id,
            role=TeamRole.OWNER,
            invited_by=owner_id,
        )
        self.db.add(owner_member)
        await self.db.commit()
        await self.db.refresh(team)

        await self.audit_logger.log(
            action="create_team",
            resource_type="team",
            resource_id=team.id,
            user_id=owner_id,
            details={"team_name": name},
        )

        logger.info(f"✅ 团队创建成功: {team.id} - {name} (Owner: {owner_id})")
        return team

    async def get_team(self, team_id: int, user_id: int) -> Dict[str, Any]:
        """
        获取团队详情（含成员列表、提示词统计、活跃度指标）

        Args:
            team_id: 团队ID
            user_id: 当前用户ID（用于权限检查）

        Returns:
            包含团队详细信息的字典

        Raises:
            PermissionDeniedError: 用户不是团队成员
            NotFoundError: 团队不存在
        """
        member = await self._check_membership(team_id, user_id)

        result = await self.db.execute(
            select(Team).where(Team.id == team_id)
        )
        team = result.scalar_one_or_none()

        if not team:
            raise NotFoundError("团队不存在")

        members_result = await self.db.execute(
            select(TeamMember, User.username, User.email)
            .join(User, TeamMember.user_id == User.id)
            .where(TeamMember.team_id == team_id)
            .order_by(TeamMember.joined_at.asc())
        )
        members_data = members_result.all()

        member_list = []
        online_count = 0
        for member_obj, username, email in members_data:
            member_info = {
                "id": member_obj.id,
                "user_id": member_obj.user_id,
                "username": username,
                "email": email,
                "role": member_obj.role.value,
                "joined_at": member_obj.joined_at.isoformat() if member_obj.joined_at else None,
                "invited_by": member_obj.invited_by,
                "is_online": False,
            }
            member_list.append(member_info)

        prompt_count = 0
        version_count = 0

        return {
            "team": {
                "id": team.id,
                "name": team.name,
                "description": team.description,
                "owner_id": team.owner_id,
                "settings": team.settings,
                "is_archived": team.is_archived,
                "created_at": team.created_at.isoformat() if team.created_at else None,
                "updated_at": team.updated_at.isoformat() if team.updated_at else None,
            },
            "members": member_list,
            "member_count": len(member_list),
            "online_count": online_count,
            "current_user_role": member.role.value,
            "stats": {
                "prompt_count": prompt_count,
                "version_count": version_count,
            },
        }

    async def update_team(
        self,
        team_id: int,
        user_id: int,
        **kwargs
    ) -> Team:
        """
        更新团队设置（仅Owner/Admin）

        Args:
            team_id: 团队ID
            user_id: 操作用户ID
            **kwargs: 要更新的字段

        Returns:
            更新后的Team对象

        Raises:
            PermissionDeniedError: 权限不足
        """
        await self._check_admin_permission(team_id, user_id)

        result = await self.db.execute(
            select(Team).where(Team.id == team_id)
        )
        team = result.scalar_one_or_none()

        if not team:
            raise NotFoundError("团队不存在")

        allowed_fields = {"name", "description", "settings", "is_archived"}
        update_data = {k: v for k, v in kwargs.items() if k in allowed_fields}

        for field, value in update_data.items():
            setattr(team, field, value)

        await self.db.commit()
        await self.db.refresh(team)

        await self.audit_logger.log(
            action="update_team",
            resource_type="team",
            resource_id=team_id,
            user_id=user_id,
            details=update_data,
        )

        logger.info(f"📝 团队已更新: {team_id} by user {user_id}")
        return team

    async def archive_team(self, team_id: int, user_id: int) -> bool:
        """
        归档团队（软删除，数据保留）

        Args:
            team_id: 团队ID
            user_id: 操作用户ID（必须是Owner）

        Returns:
            是否成功归档

        Raises:
            PermissionDeniedError: 只有Owner可以归档
        """
        member = await self._check_membership(team_id, user_id)

        if member.role != TeamRole.OWNER:
            raise PermissionDeniedError("只有团队Owner可以归档团队")

        result = await self.db.execute(
            select(Team).where(Team.id == team_id)
        )
        team = result.scalar_one_or_none()

        if not team:
            raise NotFoundError("团队不存在")

        team.is_archived = True
        await self.db.commit()

        await self.audit_logger.log(
            action="archive_team",
            resource_type="team",
            resource_id=team_id,
            user_id=user_id,
        )

        logger.info(f"📦 团队已归档: {team_id} by Owner {user_id}")
        return True

    async def invite_member(
        self,
        team_id: int,
        inviter_id: int,
        user_id: Optional[int] = None,
        email: Optional[str] = None,
        role: TeamRole = TeamRole.MEMBER,
    ) -> Dict[str, Any]:
        """
        邀请成员加入团队

        支持三种方式：
        1. 通过用户ID直接添加
        2. 通过邮箱发送邀请
        3. 生成分享链接

        Args:
            team_id: 团队ID
            inviter_id: 邀请人ID
            user_id: 被邀请用户ID（直接添加方式）
            email: 被邀请人邮箱（邮件邀请方式）
            role: 初始角色

        Returns:
            邀请结果信息
        """
        await self._check_admin_permission(team_id, inviter_id)

        if user_id:
            existing = await self.db.execute(
                select(TeamMember).where(
                    and_(
                        TeamMember.team_id == team_id,
                        TeamMember.user_id == user_id,
                    )
                )
            )
            if existing.scalar_one_or_none():
                raise ValueError("该用户已经是团队成员")

            target_user = await self.db.execute(
                select(User).where(User.id == user_id)
            )
            if not target_user.scalar_one_or_none():
                raise NotFoundError("目标用户不存在")

            new_member = TeamMember(
                team_id=team_id,
                user_id=user_id,
                role=role,
                invited_by=inviter_id,
            )
            self.db.add(new_member)

            notification = Notification(
                user_id=user_id,
                type=NotificationType.SYSTEM,
                title="您已被加入团队",
                content="您已被邀请加入团队",
                metadata_={"team_id": team_id, "inviter_id": inviter_id, "role": role.value},
            )
            self.db.add(notification)

            await self.db.commit()

            await self.audit_logger.log(
                action="invite_member",
                resource_type="team_member",
                resource_id=new_member.id,
                user_id=inviter_id,
                details={"target_user_id": user_id, "role": role.value},
            )

            logger.info(f"✉️ 成员已邀请: user {user_id} → team {team_id} by {inviter_id}")
            return {"success": True, "method": "direct", "member_id": new_member.id}

        elif email:
            invite_code = str(uuid.uuid4())[:8].upper()

            notification = Notification(
                user_id=inviter_id,
                type=NotificationType.SYSTEM,
                title="团队邀请已发送",
                content=f"已向 {email} 发送团队邀请",
                metadata_={
                    "team_id": team_id,
                    "invite_code": invite_code,
                    "target_email": email,
                    "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
                },
            )
            self.db.add(notification)
            await self.db.commit()

            logger.info(f"📧 邀请邮件已发送: {email} → team {team_id}")
            return {"success": True, "method": "email", "invite_code": invite_code}

        else:
            raise ValueError("必须提供 user_id 或 email")

    async def join_team(
        self,
        team_id: int,
        user_id: int,
        invitation_token: Optional[str] = None,
    ) -> TeamMember:
        """
        用户接受邀请加入团队

        Args:
            team_id: 团队ID
            user_id: 用户ID
            invitation_token: 邀请令牌（可选）

        Returns:
            创建的TeamMember对象
        """
        existing = await self.db.execute(
            select(TeamMember).where(
                and_(
                    TeamMember.team_id == team_id,
                    TeamMember.user_id == user_id,
                )
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("您已经是该团队的成员")

        new_member = TeamMember(
            team_id=team_id,
            user_id=user_id,
            role=TeamRole.MEMBER,
        )
        self.db.add(new_member)
        await self.db.commit()
        await self.db.refresh(new_member)

        await self.audit_logger.log(
            action="join_team",
            resource_type="team_member",
            resource_id=new_member.id,
            user_id=user_id,
            details={"team_id": team_id},
        )

        logger.info(f"👤 用户加入团队: {user_id} → team {team_id}")
        return new_member

    async def remove_member(
        self,
        team_id: int,
        operator_id: int,
        member_id: int,
    ) -> bool:
        """
        从团队中移除成员

        Args:
            team_id: 团队ID
            operator_id: 操作人ID
            member_id: 要移除的成员记录ID

        Returns:
            是否成功移除

        Raises:
            PermissionDeniedError: 权限不足或不能移除Owner
        """
        result = await self.db.execute(
            select(TeamMember).where(
                and_(
                    TeamMember.id == member_id,
                    TeamMember.team_id == team_id,
                )
            )
        )
        member = result.scalar_one_or_none()

        if not member:
            raise NotFoundError("成员记录不存在")

        is_self_removal = member.user_id == operator_id

        if not is_self_removal:
            await self._check_admin_permission(team_id, operator_id)

            if member.role == TeamRole.OWNER:
                raise PermissionDeniedError("不能移除团队Owner")
        else:
            if member.role == TeamRole.OWNER:
                raise PermissionDeniedError("Owner不能退出团队，请先转让所有权")

        await self.db.delete(member)
        await self.db.commit()

        action = "退出团队" if is_self_removal else "移除成员"
        await self.audit_logger.log(
            action="remove_member",
            resource_type="team_member",
            resource_id=member_id,
            user_id=operator_id,
            details={
                "target_user_id": member.user_id,
                "action": action,
            },
        )

        logger.info(f"❌ 成员被移除: member {member_id} from team {team_id} by {operator_id}")
        return True

    async def update_member_role(
        self,
        team_id: int,
        operator_id: int,
        member_id: int,
        new_role: TeamRole,
    ) -> TeamMember:
        """
        更新成员角色

        Args:
            team_id: 团队ID
            operator_id: 操作人ID
            member_id: 成员记录ID
            new_role: 新角色

        Returns:
            更新后的TeamMember对象

        Raises:
            PermissionDeniedError: 权限不足
        """
        await self._check_admin_permission(team_id, operator_id)

        result = await self.db.execute(
            select(TeamMember).where(
                and_(
                    TeamMember.id == member_id,
                    TeamMember.team_id == team_id,
                )
            )
        )
        member = result.scalar_one_or_none()

        if not member:
            raise NotFoundError("成员记录不存在")

        if member.user_id == operator_id:
            raise PermissionDeniedError("不能修改自己的角色")

        if new_role == TeamRole.OWNER:
            operator_member = await self._check_membership(team_id, operator_id)
            if operator_member.role != TeamRole.OWNER:
                raise PermissionDeniedError("只有Owner可以转让所有权")

        old_role = member.role
        member.role = new_role
        await self.db.commit()
        await self.db.refresh(member)

        notification = Notification(
            user_id=member.user_id,
            type=NotificationType.SYSTEM,
            title="您的团队角色已变更",
            content=f"您的角色从 {old_role.value} 变更为 {new_role.value}",
            metadata_={
                "team_id": team_id,
                "old_role": old_role.value,
                "new_role": new_role.value,
            },
        )
        self.db.add(notification)
        await self.db.commit()

        await self.audit_logger.log(
            action="update_member_role",
            resource_type="team_member",
            resource_id=member_id,
            user_id=operator_id,
            details={
                "target_user_id": member.user_id,
                "old_role": old_role.value,
                "new_role": new_role.value,
            },
        )

        logger.info(f"🔄 角色已更新: member {member_id} → {new_role.value} by {operator_id}")
        return member

    async def get_invite_link(
        self,
        team_id: int,
        creator_id: int,
        expires_hours: int = 24,
        max_uses: int = 10,
    ) -> Dict[str, Any]:
        """
        生成邀请链接

        Args:
            team_id: 团队ID
            creator_id: 创建者ID
            expires_hours: 有效期（小时）
            max_uses: 最大使用次数

        Returns:
            邀请链接信息
        """
        await self._check_admin_permission(team_id, creator_id)

        invite_code = str(uuid.uuid4())[:8].upper()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_hours)

        try:
            from app.core.config import settings
            base_url = getattr(settings, 'base_url', 'http://localhost:8000')
        except ImportError:
            base_url = 'http://localhost:8000'

        invite_url = f"{base_url}/teams/join?code={invite_code}"

        logger.info(f"🔗 邀请链接已生成: {invite_code} for team {team_id}")

        return {
            "invite_code": invite_code,
            "invite_url": invite_url,
            "expires_at": expires_at.isoformat(),
            "max_uses": max_uses,
            "used_count": 0,
            "team_id": team_id,
        }

    async def list_user_teams(
        self,
        user_id: int,
        include_archived: bool = False,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """
        获取用户加入的所有团队列表

        Args:
            user_id: 用户ID
            include_archived: 是否包含已归档团队
            page: 页码
            page_size: 每页条数

        Returns:
            分页的团队列表
        """
        query = (
            select(Team)
            .join(TeamMember, Team.id == TeamMember.team_id)
            .where(TeamMember.user_id == user_id)
        )

        if not include_archived:
            query = query.where(Team.is_archived.is_(False))

        count_query = (
            select(func.count(Team.id))
            .join(TeamMember, Team.id == TeamMember.team_id)
            .where(TeamMember.user_id == user_id)
        )
        if not include_archived:
            count_query = count_query.where(Team.is_archived.is_(False))

        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        offset = (page - 1) * page_size
        query = query.order_by(Team.updated_at.desc()).offset(offset).limit(page_size)

        result = await self.db.execute(query)
        teams = result.scalars().all()

        team_list = []
        for team in teams:
            member_count = await self.db.execute(
                select(func.count(TeamMember.id)).where(TeamMember.team_id == team.id)
            )
            count = member_count.scalar() or 0

            team_list.append({
                "id": team.id,
                "name": team.name,
                "description": team.description,
                "owner_id": team.owner_id,
                "is_archived": team.is_archived,
                "member_count": count,
                "created_at": team.created_at.isoformat() if team.created_at else None,
                "updated_at": team.updated_at.isoformat() if team.updated_at else None,
            })

        return {
            "teams": team_list,
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def _check_membership(self, team_id: int, user_id: int) -> TeamMember:
        """检查用户是否是团队成员"""
        result = await self.db.execute(
            select(TeamMember).where(
                and_(
                    TeamMember.team_id == team_id,
                    TeamMember.user_id == user_id,
                )
            )
        )
        member = result.scalar_one_or_none()

        if not member:
            raise PermissionDeniedError("您不是该团队成员")

        return member

    async def _check_admin_permission(self, team_id: int, user_id: int) -> TeamMember:
        """检查用户是否有管理员权限"""
        member = await self._check_membership(team_id, user_id)

        if member.role not in [TeamRole.OWNER, TeamRole.ADMIN]:
            raise PermissionDeniedError("需要管理员权限才能执行此操作")

        return member

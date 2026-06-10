"""RMFOOD 团队仪表盘数据聚合服务

提供团队统计、活跃度分析和动态流功能：
- 成员和提示词统计
- 版本提交趋势分析
- 活跃度排名
- 团队动态时间线
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_, case, text

from app.models.team import Team
from app.models.team_member import TeamMember
from app.models.user_model import User
from app.models.prompt_version import PromptVersion
from app.models.notification import Notification
from app.models.enums import TeamRole

logger = logging.getLogger(__name__)


class TeamDashboardService:
    """团队仪表盘数据聚合服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_stats(self, team_id: int) -> Dict[str, Any]:
        """
        获取团队统计数据
        
        包括：
        - 成员总数 / 各角色数量
        - 提示词总数 / 本月新增数
        - 版本提交次数趋势（近30天）
        - 活跃度排名Top 10成员
        - 分类分布饼图数据
        
        Args:
            team_id: 团队ID
            
        Returns:
            统计数据字典
        """
        stats = {}

        member_count_result = await self.db.execute(
            select(func.count(TeamMember.id)).where(TeamMember.team_id == team_id)
        )
        total_members = member_count_result.scalar() or 0
        stats["total_members"] = total_members

        role_distribution = await self._get_role_distribution(team_id)
        stats["role_distribution"] = role_distribution

        online_count = await self._get_online_count(team_id)
        stats["online_count"] = online_count

        prompt_stats = await self._get_prompt_stats(team_id)
        stats.update(prompt_stats)

        version_trend = await self._get_version_trend(team_id, days=30)
        stats["version_trend"] = version_trend

        top_active_members = await self._get_top_active_members(team_id, limit=10)
        stats["top_active_members"] = top_active_members

        category_distribution = await self._get_category_distribution(team_id)
        stats["category_distribution"] = category_distribution

        recent_activity = await self.get_activity_feed(team_id, limit=5)
        stats["recent_activity"] = recent_activity["items"]

        logger.info(f"📊 团队统计数据已生成: team {team_id}")
        return stats

    async def get_activity_feed(
        self,
        team_id: int,
        limit: int = 20,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        获取团队动态流
        
        包括：
        - 成员加入/离开
        - 提示词创建/修改/删除
        - 评论和讨论
        - 角色变更
        - 按时间倒序排列
        
        Args:
            team_id: 团队ID
            limit: 返回条数限制
            offset: 偏移量
            
        Returns:
            动态流列表
        """
        activities = []

        member_activities = await self._get_member_activities(team_id, limit)
        activities.extend(member_activities)

        version_activities = await self._get_version_activities(team_id, limit)
        activities.extend(version_activities)

        notification_activities = await self._get_notification_activities(team_id, limit)
        activities.extend(notification_activities)

        activities.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

        total = len(activities)
        paginated_activities = activities[offset:offset + limit]

        return {
            "items": paginated_activities,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    async def _get_role_distribution(self, team_id: int) -> Dict[str, int]:
        """获取角色分布统计"""
        result = await self.db.execute(
            select(
                TeamMember.role,
                func.count(TeamMember.id).label("count")
            )
            .where(TeamMember.team_id == team_id)
            .group_by(TeamMember.role)
        )

        distribution = {}
        for role, count in result.all():
            distribution[role.value] = count

        return distribution

    async def _get_online_count(self, team_id: int) -> int:
        """获取在线成员数（简化实现）"""
        return 0

    async def _get_prompt_stats(self, team_id: int) -> Dict[str, Any]:
        """获取提示词相关统计"""
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        total_prompts = 0
        month_new_prompts = 0

        return {
            "total_prompts": total_prompts,
            "month_new_prompts": month_new_prompts,
        }

    async def _get_version_trend(self, team_id: int, days: int = 30) -> List[Dict[str, Any]]:
        """
        获取版本提交趋势（近N天）
        
        返回每日提交次数的列表
        """
        since = datetime.now(timezone.utc) - timedelta(days=days)

        result = await self.db.execute(
            select(
                func.date(PromptVersion.created_at).label("date"),
                func.count(PromptVersion.id).label("count")
            )
            .where(PromptVersion.created_at >= since)
            .group_by(func.date(PromptVersion.created_at))
            .order_by(func.date(PromptVersion.created_at))
        )

        trend_data = []
        for date, count in result.all():
            trend_data.append({
                "date": date.isoformat() if hasattr(date, 'isoformat') else str(date),
                "count": count,
            })

        return trend_data

    async def _get_top_active_members(
        self,
        team_id: int,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        获取活跃度排名Top N成员
        
        基于版本提交次数排序
        """
        result = await self.db.execute(
            select(
                TeamMember.user_id,
                User.username,
                func.count(PromptVersion.id).label("version_count")
            )
            .join(User, TeamMember.user_id == User.id)
            .outerjoin(
                PromptVersion,
                and_(
                    PromptVersion.created_by == TeamMember.user_id,
                )
            )
            .where(TeamMember.team_id == team_id)
            .group_by(TeamMember.user_id, User.username)
            .order_by(desc(func.count(PromptVersion.id)))
            .limit(limit)
        )

        top_members = []
        rank = 1
        for user_id, username, version_count in result.all():
            top_members.append({
                "rank": rank,
                "user_id": user_id,
                "username": username,
                "activity_score": version_count * 10,
                "version_count": version_count,
            })
            rank += 1

        return top_members

    async def _get_category_distribution(self, team_id: int) -> Dict[str, int]:
        """获取分类分布（占位实现）"""
        return {}

    async def _get_member_activities(
        self,
        team_id: int,
        limit: int,
    ) -> List[Dict[str, Any]]:
        """获取成员相关的活动记录"""
        result = await self.db.execute(
            select(TeamMember, User.username)
            .join(User, TeamMember.user_id == User.id)
            .where(TeamMember.team_id == team_id)
            .order_by(desc(TeamMember.joined_at))
            .limit(limit)
        )

        activities = []
        for member, username in result.all():
            activities.append({
                "type": "member_joined",
                "user_id": member.user_id,
                "username": username,
                "role": member.role.value,
                "timestamp": member.joined_at.isoformat() if member.joined_at else None,
                "message": f"{username} 加入了团队 ({member.role.value})",
            })

        return activities

    async def _get_version_activities(
        self,
        team_id: int,
        limit: int,
    ) -> List[Dict[str, Any]]:
        """获取版本提交相关的活动记录"""
        result = await self.db.execute(
            select(PromptVersion, User.username)
            .outerjoin(User, PromptVersion.created_by == User.id)
            .order_by(desc(PromptVersion.created_at))
            .limit(limit)
        )

        activities = []
        for version, username in result.all():
            creator_name = username or "未知用户"
            activities.append({
                "type": "version_created",
                "user_id": version.created_by,
                "username": creator_name,
                "version_number": version.version_number,
                "prompt_template_id": version.prompt_template_id,
                "timestamp": version.created_at.isoformat() if version.created_at else None,
                "changelog": version.changelog,
                "message": f"{creator_name} 提交了新版本 v{version.version_number}",
            })

        return activities

    async def _get_notification_activities(
        self,
        team_id: int,
        limit: int,
    ) -> List[Dict[str, Any]]:
        """获取通知相关的活动记录"""
        result = await self.db.execute(
            select(Notification)
            .where(
                and_(
                    Notification.metadata_.isnot(None),
                    text("JSON_EXTRACT(metadata, '$.team_id') = :team_id")
                )
            )
            .params(team_id=team_id)
            .order_by(desc(Notification.created_at))
            .limit(limit)
        )

        activities = []
        for notif in result.all():
            metadata = notif.metadata_ or {}
            activities.append({
                "type": f"notification_{notif.type.value}",
                "notification_id": notif.id,
                "user_id": notif.user_id,
                "timestamp": notif.created_at.isoformat() if notif.created_at else None,
                "title": notif.title,
                "metadata": metadata,
                "message": notif.title,
            })

        return activities

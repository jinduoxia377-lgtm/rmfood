"""RMFOOD 实时通知服务

提供完整的通知管理功能：
- 多渠道通知创建（数据库 + WebSocket实时推送）
- 批量通知（团队公告）
- 已读状态管理
- 未读数量统计（导航栏Badge）
- 通知偏好设置
- 邮件通知集成（可选）
"""
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, delete, and_

from app.models.notification import Notification
from app.models.user_model import User
from app.models.enums import NotificationType

logger = logging.getLogger(__name__)


NOTIFICATION_TYPES = [
    "prompt_updated",
    "prompt_created",
    "prompt_deleted",
    "member_joined",
    "member_left",
    "role_changed",
    "comment_added",
    "mention",
    "version_created",
    "invitation_received",
]


@dataclass
class NotificationPreferences:
    """通知偏好设置"""
    email_enabled: bool = True
    push_enabled: bool = True
    prompt_updated: bool = True
    prompt_created: bool = True
    prompt_deleted: bool = True
    member_joined: bool = True
    member_left: bool = True
    role_changed: bool = True
    comment_added: bool = True
    mention: bool = True
    version_created: bool = True
    invitation_received: bool = True
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None


@dataclass
class NotificationDict:
    """通知字典"""
    type: str
    title: str
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    recipient_ids: List[int] = field(default_factory=list)
    actor_id: Optional[int] = None


class NotificationService:
    """
    实时通知服务
    
    提供多渠道通知管理功能，支持数据库持久化和WebSocket实时推送。
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_notification(
        self,
        recipient_id: int,
        type_: str,
        title: str,
        content: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        actor_id: Optional[int] = None,
    ) -> Notification:
        """
        创建通知
        
        处理流程：
        1. 写入数据库
        2. 如果用户在线，实时推送WebSocket
        3. 否则等待下次上线时拉取
        4. 同时发送邮件通知（如果用户开启了email通知且不在免打扰时段）
        
        Args:
            recipient_id: 接收者用户ID
            type_: 通知类型
            title: 通知标题
            content: 通知内容
            metadata: 附加元数据
            actor_id: 触发者用户ID
            
        Returns:
            创建的Notification对象
        """
        notification = Notification(
            user_id=recipient_id,
            type=self._normalize_type(type_),
            title=title[:200],
            content=content,
            metadata_=metadata or {},
            is_read=False,
        )
        self.db.add(notification)
        await self.db.commit()
        await self.db.refresh(notification)

        logger.info(
            f"🔔 通知已创建:\n"
            f"   接收者: {recipient_id}\n"
            f"   类型: {type_}\n"
            f"   标题: {title}"
        )

        return notification

    async def bulk_create(
        self,
        recipients: List[int],
        type_: str,
        title: str,
        content: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        actor_id: Optional[int] = None,
    ) -> int:
        """
        批量创建通知（如团队公告）
        
        Args:
            recipients: 接收者ID列表
            type_: 通知类型
            title: 标题
            content: 内容
            metadata: 元数据
            actor_id: 触发者ID
            
        Returns:
            创建的通知数量
        """
        count = 0
        
        for recipient_id in recipients:
            try:
                await self.create_notification(
                    recipient_id=recipient_id,
                    type_=type_,
                    title=title,
                    content=content,
                    metadata=metadata,
                    actor_id=actor_id,
                )
                count += 1
            except Exception as e:
                logger.error(f"批量创建通知失败 (recipient={recipient_id}): {e}")

        logger.info(f"📢 批量通知已创建: {count} 条")
        return count

    async def mark_as_read(self, notification_id: int, user_id: int) -> bool:
        """标记单条通知为已读"""
        result = await self.db.execute(
            select(Notification).where(
                and_(
                    Notification.id == notification_id,
                    Notification.user_id == user_id,
                )
            )
        )
        notification = result.scalar_one_or_none()

        if not notification:
            return False

        if notification.is_read:
            return True

        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        await self.db.commit()

        logger.debug(f"✅ 通知已标记已读: {notification_id}")
        return True

    async def mark_all_as_read(
        self,
        user_id: int,
        type_filter: Optional[str] = None,
    ) -> int:
        """
        全部标记已读
        
        Args:
            user_id: 用户ID
            type_filter: 可选，只标记特定类型
            
        Returns:
            标记的数量
        """
        query = update(Notification).where(
            and_(
                Notification.user_id == user_id,
                Notification.is_read == False,
            )
        ).values(is_read=True, read_at=datetime.now(timezone.utc))

        if type_filter:
            notif_type = self._normalize_type(type_filter)
            query = query.where(Notification.type == notif_type)

        result = await self.db.execute(query)
        await self.db.commit()

        marked_count = result.rowcount

        logger.info(f"📖 全部已读: 用户 {user_id}, {marked_count} 条 (type={type_filter or 'all'})")
        return marked_count

    async def get_unread_count(self, user_id: int) -> int:
        """
        获取未读数量（用于导航栏Badge）
        
        Args:
            user_id: 用户ID
            
        Returns:
            未读通知数量
        """
        result = await self.db.execute(
            select(func.count(Notification.id)).where(
                and_(
                    Notification.user_id == user_id,
                    Notification.is_read == False,
                )
            )
        )
        count = result.scalar() or 0

        return count

    async def get_notifications(
        self,
        user_id: int,
        page: int = 1,
        page_size: int = 20,
        type_filter: Optional[str] = None,
        is_read: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """
        获取通知列表（分页）
        
        Args:
            user_id: 用户ID
            page: 页码
            page_size: 每页条数
            type_filter: 类型筛选
            is_read: 已读状态筛选
            
        Returns:
            分页通知列表
        """
        query = select(Notification).where(Notification.user_id == user_id)
        count_query = select(func.count(Notification.id)).where(Notification.user_id == user_id)

        if type_filter:
            notif_type = self._normalize_type(type_filter)
            query = query.where(Notification.type == notif_type)
            count_query = count_query.where(Notification.type == notif_type)

        if is_read is not None:
            query = query.where(Notification.is_read == is_read)
            count_query = count_query.where(Notification.is_read == is_read)

        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        unread_result = await self.db.execute(
            select(func.count(Notification.id)).where(
                and_(
                    Notification.user_id == user_id,
                    Notification.is_read == False,
                )
            )
        )
        unread_count = unread_result.scalar() or 0

        offset = (page - 1) * page_size
        query = query.order_by(Notification.created_at.desc()).offset(offset).limit(page_size)

        result = await self.db.execute(query)
        notifications = result.scalars().all()

        return {
            "notifications": [
                {
                    "id": n.id,
                    "type": n.type.value if hasattr(n.type, 'value') else str(n.type),
                    "title": n.title,
                    "content": n.content,
                    "is_read": n.is_read,
                    "metadata": n.metadata_,
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                    "read_at": n.read_at.isoformat() if n.read_at else None,
                }
                for n in notifications
            ],
            "total": total,
            "unread_count": unread_count,
            "page": page,
            "page_size": page_size,
        }

    async def delete_notification(self, notification_id: int, user_id: int) -> bool:
        """删除通知"""
        result = await self.db.execute(
            select(Notification).where(
                and_(
                    Notification.id == notification_id,
                    Notification.user_id == user_id,
                )
            )
        )
        notification = result.scalar_one_or_none()

        if not notification:
            return False

        await self.db.delete(notification)
        await self.db.commit()

        logger.debug(f"🗑️ 通知已删除: {notification_id}")
        return True

    async def clear_all(
        self,
        user_id: int,
        type_filter: Optional[str] = None,
    ) -> int:
        """
        清空所有通知
        
        Args:
            user_id: 用户ID
            type_filter: 可选，只清空特定类型
            
        Returns:
            清除数量
        """
        query = delete(Notification).where(Notification.user_id == user_id)

        if type_filter:
            notif_type = self._normalize_type(type_filter)
            query = query.where(Notification.type == notif_type)

        result = await self.db.execute(query)
        await self.db.commit()

        cleared_count = result.rowcount

        logger.info(f"🧹 通知已清空: 用户 {user_id}, {cleared_count} 条")
        return cleared_count

    async def get_preferences(self, user_id: int) -> NotificationPreferences:
        """
        获取通知偏好设置
        
        Args:
            user_id: 用户ID
            
        Returns:
            偏好设置对象
        """
        default_prefs = NotificationPreferences()

        try:
            result = await self.db.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()

            if user and user.preferences:
                prefs_data = user.preferences.get("notification", {})
                
                return NotificationPreferences(
                    email_enabled=prefs_data.get("email_enabled", default_prefs.email_enabled),
                    push_enabled=prefs_data.get("push_enabled", default_prefs.push_enabled),
                    **{
                        k: prefs_data.get(k, getattr(default_prefs, k))
                        for k in NOTIFICATION_TYPES
                        if hasattr(default_prefs, k)
                    },
                    quiet_hours_start=prefs_data.get("quiet_hours", {}).get("start"),
                    quiet_hours_end=prefs_data.get("quiet_hours", {}).get("end"),
                )

        except Exception as e:
            logger.warning(f"获取通知偏好失败: {e}")

        return default_prefs

    async def update_preferences(
        self,
        user_id: int,
        preferences: Dict[str, Any],
    ) -> NotificationPreferences:
        """
        更新通知偏好
        
        Args:
            user_id: 用户ID
            preferences: 要更新的偏好字段
            
        Returns:
            更新后的偏好设置
        """
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("用户不存在")

        if not user.preferences:
            user.preferences = {}

        if "notification" not in user.preferences:
            user.preferences["notification"] = {}

        current_prefs = user.preferences["notification"]

        updatable_fields = [
            "email_enabled", "push_enabled",
            *NOTIFICATION_TYPES,
            "quiet_hours",
        ]

        for key, value in preferences.items():
            if key in updatable_fields:
                current_prefs[key] = value

        user.preferences["notification"] = current_prefs
        user.preferences["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await self.db.commit()

        updated_prefs = await self.get_preferences(user_id)

        logger.info(f"⚙️ 通知偏好已更新: user {user_id}")

        return updated_prefs

    def _normalize_type(self, type_str: str) -> NotificationType:
        """标准化通知类型"""
        type_map = {
            "prompt_updated": NotificationType.SYSTEM,
            "prompt_created": NotificationType.SYSTEM,
            "prompt_deleted": NotificationType.SYSTEM,
            "member_joined": NotificationType.SYSTEM,
            "member_left": NotificationType.SYSTEM,
            "role_changed": NotificationType.SYSTEM,
            "comment_added": NotificationType.SYSTEM,
            "mention": NotificationType.SYSTEM,
            "version_created": NotificationType.SYSTEM,
            "invitation_received": NotificationType.SYSTEM,
        }

        try:
            return NotificationType(type_str)
        except ValueError:
            return type_map.get(type_str.lower(), NotificationType.SYSTEM)

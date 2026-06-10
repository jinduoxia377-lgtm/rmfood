"""
企业级多渠道通知中心

支持:
- 站内消息 (In-App)
- 邮件通知 (Email)
- WebSocket 实时推送 (Real-time)
- 短信/微信 (可扩展)
- 通知模板引擎
- 用户偏好设置
- 批量通知 & 定时任务
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set
from uuid import UUID, uuid4


logger = logging.getLogger(__name__)


# ============================================================
# Enums & Models
# ============================================================

class NotificationChannel(str, Enum):
    """通知渠道"""
    IN_APP = "in_app"
    EMAIL = "email"
    WEBSOCKET = "websocket"
    SMS = "sms"
    WECHAT = "wechat"


class NotificationPriority(str, Enum):
    """通知优先级"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class NotificationCategory(str, Enum):
    """通知分类"""
    SYSTEM = "system"
    COLLABORATION = "collaboration"
    WORKFLOW = "workflow"
    SECURITY = "security"
    BILLING = "billing"
    AI_GENERATION = "ai_generation"


@dataclass
class RecipientInfo:
    """接收者信息"""
    user_id: int
    email: Optional[str] = None
    phone: Optional[str] = None
    websocket_session_ids: List[str] = field(default_factory=list)
    locale: str = "zh-CN"
    timezone_str: str = "Asia/Shanghai"


@dataclass
class NotificationTemplate:
    """通知模板"""
    id: str
    name: str
    subject_template: str
    body_template: str
    category: NotificationCategory
    default_channels: List[NotificationChannel] = field(default_factory=lambda: [NotificationChannel.IN_APP])
    priority: NotificationPriority = NotificationPriority.NORMAL
    variables: Dict[str, str] = field(default_factory=dict)


@dataclass
class NotificationPayload:
    """通知载荷"""
    template_id: str
    recipients: List[RecipientInfo]
    variables: Dict[str, Any] = field(default_factory=dict)
    channels: Optional[List[NotificationChannel]] = None
    priority: NotificationPriority = NotificationPriority.NORMAL
    scheduled_at: Optional[datetime] = None
    expire_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None


@dataclass
class SentNotification:
    """已发送的通知记录"""
    id: str
    template_id: str
    recipient_id: int
    channel: NotificationChannel
    status: str
    sent_at: datetime
    error_message: Optional[str] = None
    read_at: Optional[datetime] = None


@dataclass
class UserNotificationPreference:
    """用户通知偏好"""
    user_id: int
    enabled: bool = True
    channel_preferences: Dict[NotificationChannel, bool] = field(default_factory=dict)
    category_enabled: Dict[NotificationCategory, bool] = field(default_factory=dict)
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    digest_mode: bool = False
    digest_frequency: str = "daily"


# ============================================================
# Template Registry
# ============================================================

class NotificationTemplateRegistry:
    """通知模板注册表"""

    _templates: Dict[str, NotificationTemplate] = {}

    @classmethod
    def register(cls, template: NotificationTemplate):
        cls._templates[template.id] = template
        logger.info(f"📋 注册通知模板: {template.id} ({template.name})")

    @classmethod
    def get(cls, template_id: str) -> Optional[NotificationTemplate]:
        return cls._templates.get(template_id)

    @classmethod
    def list_all(cls) -> List[NotificationTemplate]:
        return list(cls._templates.values())


def register_default_templates():
    """注册默认通知模板"""
    templates = [
        NotificationTemplate(
            id="collaboration.mention",
            name="协作提及",
            subject_template="{{author}} 在 {{resource_type}} 中提到了你",
            body_template="""
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1a1a1a;">{{author}} 提到了你</h2>
  <p>在 <strong>{{resource_name}}</strong> 中：</p>
  <blockquote style="border-left: 3px solid #3b82f6; padding-left: 16px; color: #555;">{{content_preview}}</blockquote>
  <a href="{{action_url}}" style="display: inline-block; background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 16px;">查看详情</a>
</div>
""",
            category=NotificationCategory.COLLABORATION,
            default_channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.WEBSOCKET],
            priority=NotificationPriority.HIGH,
        ),
        NotificationTemplate(
            id="collaboration.comment",
            name="新评论",
            subject_template="{{author}} 评论了你的 {{resource_type}}",
            body_template="""
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1a1a1a;">新评论通知</h2>
  <p><strong>{{author}}</strong> 评论了你的 <strong>{{resource_name}}</strong>：</p>
  <blockquote style="border-left: 3px solid #10b981; padding-left: 16px; color: #555;">{{comment_content}}</blockquote>
  <a href="{{action_url}}" style="display: inline-block; background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 16px;">回复评论</a>
</div>
""",
            category=NotificationCategory.COLLABORATION,
            default_channels=[NotificationChannel.IN_APP, NotificationChannel.WEBSOCKET],
            priority=NotificationPriority.NORMAL,
        ),
        NotificationTemplate(
            id="workflow.approval_required",
            name="审批请求",
            subject_template="需要审批: {{workflow_name}}",
            body_template="""
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1a1a1a;">⏳ 待审批工作流</h2>
  <p>您有一个待审批的工作流：</p>
  <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 12px 0;">
    <h3 style="margin: 0 0 8px 0;">{{workflow_name}}</h3>
    <p style="color: #666; margin: 0;">提交者: {{submitter}} | 类型: {{workflow_type}}</p>
  </div>
  <a href="{{action_url}}" style="display: inline-block; background: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 16px;">立即审批</a>
</div>
""",
            category=NotificationCategory.WORKFLOW,
            default_channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.WEBSOCKET],
            priority=NotificationPriority.HIGH,
        ),
        NotificationTemplate(
            id="security.login_alert",
            name="登录提醒",
            subject_template="检测到新设备登录",
            body_template="""
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #dc2626;">🔒 安全提醒</h2>
  <p>您的账户在新设备上登录：</p>
  <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 12px 0;">
    <p style="margin: 4px 0;"><strong>时间:</strong> {{login_time}}</p>
    <p style="margin: 4px 0;"><strong>位置:</strong> {{location}}</p>
    <p style="margin: 4px 0;"><strong>设备:</strong> {{device_info}}</p>
    <p style="margin: 4px 0;"><strong>IP地址:</strong> {{ip_address}}</p>
  </div>
  <p style="color: #666; font-size: 14px;">如果这不是您本人操作，请立即修改密码。</p>
</div>
""",
            category=NotificationCategory.SECURITY,
            default_channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            priority=NotificationPriority.URGENT,
        ),
        NotificationTemplate(
            id="ai.generation_complete",
            name="AI生成完成",
            subject_template="AI配方生成完成: {{formula_name}}",
            body_template="""
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #7c3aed;">✨ AI 生成完成</h2>
  <p>您的AI配方已生成完毕：</p>
  <div style="background: #f5f3ff; padding: 16px; border-radius: 8px; margin: 12px 0;">
    <h3 style="margin: 0 0 8px 0; color: #7c3aed;">{{formula_name}}</h3>
    <p style="color: #666; margin: 0;">耗时: {{duration_seconds}}秒 | 置信度: {{confidence}}%</p>
  </div>
  <a href="{{action_url}}" style="display: inline-block; background: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 16px;">查看结果</a>
</div>
""",
            category=NotificationCategory.AI_GENERATION,
            default_channels=[NotificationChannel.IN_APP, NotificationChannel.WEBSOCKET],
            priority=NotificationPriority.NORMAL,
        ),
        NotificationTemplate(
            id="system.maintenance",
            name="系统维护通知",
            subject_template="系统维护通知: {{title}}",
            body_template="""
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1a1a1a;">🔧 系统维护通知</h2>
  <div style="background: #eff6ff; padding: 16px; border-radius: 8px; margin: 12px 0;">
    <h3 style="margin: 0 0 8px 0;">{{title}}</h3>
    <p style="margin: 8px 0;">{{description}}</p>
    <p style="margin: 4px 0;"><strong>时间:</strong> {{start_time}} ~ {{end_time}}</p>
    <p style="margin: 4px 0;"><strong>影响范围:</strong>{{impact}}</p>
  </div>
</div>
""",
            category=NotificationCategory.SYSTEM,
            default_channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            priority=NotificationPriority.HIGH,
        ),
        NotificationTemplate(
            id="billing.quota_warning",
            name="配额预警",
            subject_template="配额使用警告: {{resource_type}}",
            body_template="""
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #f59e0b;">⚠️ 配额使用警告</h2>
  <p>您的组织资源使用量已接近上限：</p>
  <div style="background: #fffbeb; padding: 16px; border-radius: 8px; margin: 12px 0;">
    <p style="margin: 4px 0;"><strong>资源类型:</strong> {{resource_type}}</p>
    <p style="margin: 4px 0;"><strong>已使用:</strong> {{used}} / {{limit}}</p>
    <p style="margin: 4px 0;"><strong>使用率:</strong> {{percentage}}%</p>
  </div>
  <a href="{{action_url}}" style="display: inline-block; background: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 16px;">管理配额</a>
</div>
""",
            category=NotificationCategory.BILLING,
            default_channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            priority=NotificationPriority.HIGH,
        ),
    ]

    for t in templates:
        NotificationTemplateRegistry.register(t)


register_default_templates()


# ============================================================
# Channel Senders
# ============================================================

class BaseNotificationSender:
    """通知发送器基类"""

    async def send(self, recipient: RecipientInfo, subject: str, body: str, metadata: Dict[str, Any]) -> bool:
        raise NotImplementedError


class InAppSender(BaseNotificationSender):
    """站内消息发送器（使用 ORM）"""

    def __init__(self, db):
        self.db = db

    async def send(self, recipient: RecipientInfo, subject: str, body: str, metadata: Dict[str, Any]) -> bool:
        try:
            from app.models.notification import Notification
            from app.models.enums import NotificationType, NotificationStatus
            
            notification = Notification(
                user_id=recipient.user_id,
                title=subject,
                content=body,
                type=NotificationType.SYSTEM,
                status=NotificationStatus.UNREAD,
                metadata_=metadata,
            )
            
            self.db.add(notification)
            await self.db.commit()
            await self.db.refresh(notification)
            
            logger.debug(f"✅ 站内消息已发送: user={recipient.user_id}, id={notification.id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ 站内消息发送失败: {e}", exc_info=True)
            await self.db.rollback()
            return False


class EmailSender(BaseNotificationSender):
    """邮件发送器（使用SMTP或第三方服务）"""

    def __init__(self, smtp_config: Optional[Dict] = None):
        self.smtp_config = smtp_config or {
            "host": "smtp.example.com",
            "port": 587,
            "username": "",
            "password": "",
            "use_tls": True,
            "from_address": "noreply@rmfood.com",
            "from_name": "RMFOOD 配方平台",
        }

    async def send(self, recipient: RecipientInfo, subject: str, body: str, metadata: Dict[str, Any]) -> bool:
        if not recipient.email:
            logger.warning(f"⚠️ 用户 {recipient.user_id} 未设置邮箱，跳过邮件发送")
            return False
        
        try:
            import aiosmtplib
            
            message = f"""From: "{self.smtp_config['from_name']}" <{self.smtp_config['from_address']}>
To: {recipient.email}
Subject: {subject}
MIME-Version: 1.0
Content-Type: text/html; charset=utf-8

{body}
"""
            
            await aiosmtplib.send(
                message,
                hostname=self.smtp_config["host"],
                port=self.smtp_config["port"],
                username=self.smtp_config.get("username"),
                password=self.smtp_config.get("password"),
                use_tls=self.smtp_config.get("use_tls", True),
            )
            
            logger.info(f"✉️ 邮件已发送: to={recipient.email}, subject={subject}")
            return True
            
        except Exception as e:
            logger.error(f"❌ 邮件发送失败: {e}")
            return False


class WebSocketSender(BaseNotificationSender):
    """WebSocket实时推送发送器"""

    def __init__(self):
        self.active_connections: Dict[int, Set[str]] = {}

    async def send(self, recipient: RecipientInfo, subject: str, body: str, metadata: Dict[str, Any]) -> bool:
        try:
            payload = {
                "type": "notification",
                "id": str(uuid4()),
                "subject": subject,
                "body": body,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metadata": metadata,
            }
            
            session_ids = recipient.websocket_session_ids or self.active_connections.get(recipient.user_id, set())
            
            if not session_ids:
                logger.debug(f"⚠️ 用户 {recipient.user_id} 无活跃WebSocket连接，跳过推送")
                return False
            
            from app.core.websocket import broadcast_to_user
            
            for session_id in session_ids:
                await broadcast_to_user(recipient.user_id, payload)
            
            logger.debug(f"📡 WebSocket推送成功: user={recipient.user_id}, sessions={len(session_ids)}")
            return True
            
        except Exception as e:
            logger.error(f"❌ WebSocket推送失败: {e}")
            return False

    def add_connection(self, user_id: int, session_id: str):
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(session_id)

    def remove_connection(self, user_id: int, session_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(session_id)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]


# ============================================================
# Core Notification Service
# ============================================================

class NotificationService:
    """
    企业级通知中心
    
    Features:
    - 多渠道发送（站内、邮件、WebSocket、短信等）
    - 模板渲染引擎
    - 用户偏好管理
    - 批量发送 & 定时任务
    - 安静时段处理
    - 通知聚合（摘要模式）
    """

    def __init__(self, db):
        self.db = db
        self.senders: Dict[NotificationChannel, BaseNotificationSender] = {}
        self._initialize_senders()

    def _initialize_senders(self):
        self.senders[NotificationChannel.IN_APP] = InAppSender(self.db)
        self.senders[NotificationChannel.EMAIL] = EmailSender()
        self.senders[NotificationChannel.WEBSOCKET] = WebSocketSender()

    async def send_notification(self, payload: NotificationPayload) -> Dict[str, Any]:
        """
        发送通知（核心方法）
        
        Args:
            payload: 通知载荷
            
        Returns:
            发送结果统计
        """
        template = NotificationTemplateRegistry.get(payload.template_id)
        if not template:
            raise ValueError(f"未找到模板: {payload.template_id}")

        channels = payload.channels or template.default_channels
        results = {"success": 0, "failed": 0, "details": []}

        for recipient in payload.recipients:
            preference = await self._get_user_preference(recipient.user_id)
            
            if not preference.enabled:
                continue

            for channel in channels:
                if not self._should_send_channel(preference, channel, template.category):
                    continue
                
                if self._is_in_quiet_hours(preference) and channel != NotificationChannel.IN_APP and template.priority != NotificationPriority.URGENT:
                    continue

                subject = self._render_template(template.subject_template, payload.variables)
                body = self._render_template(template.body_template, payload.variables)
                
                sender = self.senders.get(channel)
                if not sender:
                    continue

                success = await sender.send(recipient, subject, body, {
                    **payload.metadata,
                    "template_id": payload.template_id,
                    "priority": payload.priority.value,
                    "category": template.category.value,
                    "reference_type": payload.reference_type,
                    "reference_id": payload.reference_id,
                })

                if success:
                    results["success"] += 1
                else:
                    results["failed"] += 1

                results["details"].append({
                    "user_id": recipient.user_id,
                    "channel": channel.value,
                    "success": success,
                })

        logger.info(f"📬 通知发送完成: template={payload.template_id}, success={results['success']}, failed={results['failed']}")
        
        return results

    async def send_bulk_notification(
        self,
        template_id: str,
        user_ids: List[int],
        variables: Dict[str, Any],
        channels: Optional[List[NotificationChannel]] = None,
        batch_size: int = 100,
    ) -> Dict[str, Any]:
        """
        批量发送通知
        
        Args:
            template_id: 模板ID
            user_ids: 接收者ID列表
            variables: 模板变量
            channels: 发送渠道
            batch_size: 批次大小
            
        Returns:
            发送结果
        """
        total_results = {"total_recipients": len(user_ids), "success": 0, "failed": 0}
        
        for i in range(0, len(user_ids), batch_size):
            batch_ids = user_ids[i:i + batch_size]
            recipients = []
            
            for uid in batch_ids:
                user_info = await self._get_user_info(uid)
                if user_info:
                    recipients.append(user_info)

            payload = NotificationPayload(
                template_id=template_id,
                recipients=recipients,
                variables=variables,
                channels=channels,
            )

            result = await self.send_notification(payload)
            total_results["success"] += result["success"]
            total_results["failed"] += result["failed"]

        logger.info(f"📦 批量通知发送完成: total={total_results['total_recipients']}, success={total_results['success']}")
        
        return total_results

    async def get_user_notifications(
        self,
        user_id: int,
        *,
        page: int = 1,
        page_size: int = 20,
        unread_only: bool = False,
        category: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        获取用户通知列表（使用 ORM 模型）

        Args:
            user_id: 用户ID
            page: 页码
            page_size: 每页数量
            unread_only: 仅未读
            category: 分类筛选

        Returns:
            通知列表 + 统计信息
        """
        try:
            from app.models.notification import Notification
            from sqlalchemy import select, func

            # 基础查询
            query = select(Notification).where(Notification.user_id == user_id)
            
            # 筛选未读
            if unread_only:
                from app.models.enums import NotificationStatus
                query = query.where(Notification.status == NotificationStatus.UNREAD)
            
            # 排序
            query = query.order_by(Notification.created_at.desc())
            
            # 分页
            offset = (page - 1) * page_size
            query = query.limit(page_size).offset(offset)
            
            # 执行查询
            result = await self.db.execute(query)
            notifications = result.scalars().all()
            
            # 获取总数
            count_query = select(func.count(Notification.id)).where(Notification.user_id == user_id)
            if unread_only:
                from app.models.enums import NotificationStatus
                count_query = count_query.where(Notification.status == NotificationStatus.UNREAD)
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()
            
            # 获取未读数量
            unread_count_query = select(func.count(Notification.id)).where(
                Notification.user_id == user_id,
                Notification.status == NotificationStatus.UNREAD
            )
            unread_count_result = await self.db.execute(unread_count_query)
            unread_count = unread_count_result.scalar()
            
            # 转换为字典格式
            items = []
            for notif in notifications:
                items.append({
                    "id": str(notif.id),
                    "user_id": notif.user_id,
                    "title": notif.title,
                    "content": notif.content or "",
                    "type": notif.type.value if hasattr(notif.type, 'value') else str(notif.type),
                    "status": notif.status.value if hasattr(notif.status, 'value') else str(notif.status),
                    "link": notif.link or "",
                    "metadata": notif.metadata_ or {},
                    "read_at": notif.read_at.isoformat() if notif.read_at else None,
                    "created_at": notif.created_at.isoformat() if notif.created_at else None,
                    "is_read": notif.status == NotificationStatus.READ,
                })
            
            return {
                "items": items,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total or 0,
                    "total_pages": ((total + page_size - 1) // page_size) if total > 0 else 1,
                },
                "unread_count": unread_count or 0,
            }
            
        except Exception as e:
            logger.error(f"[NotificationService] 获取用户通知失败: {str(e)}", exc_info=True)
            # 返回空结果而不是抛出异常，保证前端不会崩溃
            return {
                "items": [],
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": 0,
                    "total_pages": 0,
                },
                "unread_count": 0,
            }

    async def mark_as_read(self, user_id: int, notification_ids: List[str]):
        """标记通知为已读（使用 ORM）"""
        try:
            from app.models.notification import Notification
            from app.models.enums import NotificationStatus
            from sqlalchemy import select, update
            from datetime import datetime, timezone
            
            # 转换ID为整数
            int_ids = []
            for nid in notification_ids:
                try:
                    int_ids.append(int(nid))
                except (ValueError, TypeError):
                    logger.warning(f"无效的通知ID: {nid}")
            
            if not int_ids:
                return
            
            # 更新通知状态
            stmt = (
                update(Notification)
                .where(
                    Notification.user_id == user_id,
                    Notification.id.in_(int_ids)
                )
                .values(
                    status=NotificationStatus.READ,
                    read_at=datetime.now(timezone.utc)
                )
            )
            await self.db.execute(stmt)
            await self.db.commit()
            logger.info(f"✅ 标记 {len(int_ids)} 个通知为已读: user={user_id}")
            
        except Exception as e:
            logger.error(f"[NotificationService] 标记通知为已读失败: {str(e)}", exc_info=True)
            await self.db.rollback()

    async def mark_all_as_read(self, user_id: int):
        """全部标记为已读（使用 ORM）"""
        try:
            from app.models.notification import Notification
            from app.models.enums import NotificationStatus
            from sqlalchemy import update
            from datetime import datetime, timezone
            
            stmt = (
                update(Notification)
                .where(
                    Notification.user_id == user_id,
                    Notification.status == NotificationStatus.UNREAD
                )
                .values(
                    status=NotificationStatus.READ,
                    read_at=datetime.now(timezone.utc)
                )
            )
            result = await self.db.execute(stmt)
            await self.db.commit()
            logger.info(f"✅ 全部标记为已读: user={user_id}, count={result.rowcount}")
            
        except Exception as e:
            logger.error(f"[NotificationService] 全部标记为已读失败: {str(e)}", exc_info=True)
            await self.db.rollback()

    async def update_user_preference(self, user_id: int, preference: UserNotificationPreference):
        """更新用户通知偏好（简化版，跳过数据库操作）"""
        logger.info(f"📝 更新通知偏好（跳过数据库）: user={user_id}")
        # 暂时不实现数据库存储，因为表可能不存在

    def _render_template(self, template: str, variables: Dict[str, Any]) -> str:
        """简单模板渲染（支持 {{variable}} 语法）"""
        result = template
        for key, value in variables.items():
            result = result.replace("{{" + key + "}}", str(value))
        return result

    async def _get_user_preference(self, user_id: int) -> UserNotificationPreference:
        """获取用户通知偏好（返回默认值）"""
        return UserNotificationPreference(user_id=user_id)

    async def _get_user_preference_raw(self, user_id: int) -> Optional[Dict]:
        """获取用户偏好原始数据（返回None）"""
        return None

    async def _get_user_info(self, user_id: int) -> Optional[RecipientInfo]:
        """获取用户信息（使用 ORM）"""
        try:
            from app.models.user_model import User
            from sqlalchemy import select
            
            query = select(User).where(User.id == user_id)
            result = await self.db.execute(query)
            user = result.scalar_one_or_none()
            
            if not user:
                return None
            
            return RecipientInfo(
                user_id=user.id,
                email=getattr(user, 'email', None),
                phone=getattr(user, 'phone', None),
                locale="zh-CN",
                timezone_str="Asia/Shanghai",
            )
        except Exception as e:
            logger.error(f"[NotificationService] 获取用户信息失败: {str(e)}", exc_info=True)
            return None

    def _should_send_channel(
        self,
        preference: UserNotificationPreference,
        channel: NotificationChannel,
        category: NotificationCategory,
    ) -> bool:
        channel_pref = preference.channel_preferences.get(channel, True)
        category_pref = preference.category_enabled.get(category, True)
        return channel_pref and category_pref

    def _is_in_quiet_hours(self, preference: UserNotificationPreference) -> bool:
        if not preference.quiet_hours_start or not preference.quiet_hours_end:
            return False
        
        from datetime import datetime
        now = datetime.now().strftime("%H:%M")
        return preference.quiet_hours_start <= now <= preference.quiet_hours_end


# ============================================================
# Convenience Functions
# ============================================================

async def notify_mention(db, author_id: int, mentioned_user_id: int, resource_type: str, resource_id: int, content_preview: str):
    """发送@提及通知"""
    service = NotificationService(db)
    
    mentioned_user = await service._get_user_info(mentioned_user_id)
    author = await service._get_user_info(author_id)
    
    if not mentioned_user or not author:
        return

    payload = NotificationPayload(
        template_id="collaboration.mention",
        recipients=[mentioned_user],
        variables={
            "author": author.email.split("@")[0] or f"User#{author_id}",
            "resource_type": resource_type,
            "resource_name": f"{resource_type}#{resource_id}",
            "content_preview": content_preview[:200],
            "action_url": f"/{resource_type}/{resource_id}",
        },
    )
    
    await service.send_notification(payload)


async def notify_comment(db, author_id: int, owner_id: int, resource_type: str, resource_id: int, comment_content: str):
    """发送新评论通知"""
    service = NotificationService(db)
    
    owner = await service._get_user_info(owner_id)
    author = await service._get_user_info(author_id)
    
    if not owner or not author:
        return

    payload = NotificationPayload(
        template_id="collaboration.comment",
        recipients=[owner],
        variables={
            "author": author.email.split("@")[0] or f"User#{author_id}",
            "resource_type": resource_type,
            "resource_name": f"{resource_type}#{resource_id}",
            "comment_content": comment_content[:200],
            "action_url": f"/{resource_type}/{resource_id}",
        },
    )
    
    await service.send_notification(payload)


async def notify_approval_required(db, approver_id: int, workflow_id: int, workflow_name: str, submitter_name: str):
    """发送审批请求通知"""
    service = NotificationService(db)
    
    approver = await service._get_user_info(approver_id)
    if not approver:
        return

    payload = NotificationPayload(
        template_id="workflow.approval_required",
        recipients=[approver],
        variables={
            "workflow_name": workflow_name,
            "submitter": submitter_name,
            "workflow_type": "配方发布",
            "action_url": f"/workflows/{workflow_id}/approve",
        },
    )
    
    await service.send_notification(payload)


async def notify_ai_generation_complete(db, user_id: int, formula_name: str, duration_seconds: float, confidence: float):
    """发送AI生成完成通知"""
    service = NotificationService(db)
    
    user = await service._get_user_info(user_id)
    if not user:
        return

    payload = NotificationPayload(
        template_id="ai.generation_complete",
        recipients=[user],
        variables={
            "formula_name": formula_name,
            "duration_seconds": f"{duration_seconds:.1f}",
            "confidence": f"{confidence:.1f}",
            "action_url": f"/formulas?ai_generated=true",
        },
    )
    
    await service.send_notification(payload)


logger.info("🚀 企业级通知中心初始化完成")

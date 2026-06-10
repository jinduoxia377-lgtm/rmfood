"""
通知服务
在业务事件发生时自动创建通知
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models import Notification, NotificationType, User, UserRole


class NotificationService:
    """通知创建服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_notification(
        self,
        user_id: int,
        type_: NotificationType,
        title: str,
        content: str | None = None,
        link: str | None = None,
        metadata: dict | None = None,
    ) -> Notification:
        """创建一条通知"""
        notif = Notification(
            user_id=user_id,
            type=type_,
            title=title,
            content=content,
            link=link,
            metadata_=metadata,
        )
        self.db.add(notif)
        await self.db.flush()
        return notif

    async def notify_formula_submitted(self, formula_id: int, formula_name: str, creator_id: int, reviewer_id: int | None):
        """配方提交审核 → 通知审核员"""
        if reviewer_id:
            await self.create_notification(
                user_id=reviewer_id,
                type_=NotificationType.FORMULA_REVIEW,
                title=f"新配方待审核: {formula_name}",
                content=f"配方 ID:{formula_id} 已提交审核，请及时处理。",
                link=f"/formulas/{formula_id}",
                metadata={"formula_id": formula_id, "action": "review"},
            )

    async def notify_formula_reviewed(self, formula_id: int, formula_name: str, creator_id: int, approved: bool, notes: str | None):
        """配方审核完成 → 通知创建者"""
        status_text = "已通过" if approved else "已驳回"
        await self.create_notification(
            user_id=creator_id,
            type_=NotificationType.FORMULA_REVIEW,
            title=f"配方审核{status_text}: {formula_name}",
            content=notes or f"您的配方 ID:{formula_id} 审核结果: {status_text}。" + (" 驳回原因请查看详情。" if not approved else ""),
            link=f"/formulas/{formula_id}",
            metadata={"formula_id": formula_id, "action": "view", "approved": approved},
        )

    async def notify_experiment_completed(self, experiment_id: int, experiment_title: str, researcher_id: int):
        """实验完成 → 通知研究员"""
        await self.create_notification(
            user_id=researcher_id,
            type_=NotificationType.EXPERIMENT_COMPLETE,
            title=f"实验已完成: {experiment_title}",
            content=f"实验 ID:{experiment_id} 已标记为完成，请查看结果。",
            link=f"/experiments/{experiment_id}",
            metadata={"experiment_id": experiment_id},
        )

    async def notify_system(self, user_id: int, title: str, content: str | None = None, link: str | None = None):
        """发送系统通知"""
        await self.create_notification(
            user_id=user_id,
            type_=NotificationType.SYSTEM,
            title=title,
            content=content,
            link=link,
        )

    async def notify_admins(self, title: str, content: str | None = None, link: str | None = None):
        """通知所有管理员"""
        admins = (await self.db.execute(
            select(User).where(User.role == UserRole.ADMIN, User.is_active == True)
        )).scalars().all()
        for admin in admins:
            await self.create_notification(
                user_id=admin.id,
                type_=NotificationType.SYSTEM,
                title=title,
                content=content,
                link=link,
            )

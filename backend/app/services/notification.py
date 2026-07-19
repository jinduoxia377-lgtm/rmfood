"""
Minimal NotificationService - stub for backward compatibility.
The real notification functionality lives in api/notifications.py router.
This class is kept only to satisfy imports from services/__init__.py and formula_module.py.
"""
from typing import Any, Optional


class NotificationService:
    """轻量通知服务（存根版）"""

    def __init__(self, db=None):
        self.db = db

    async def create_notification(
        self,
        user_id: int,
        type_: str,
        title: str = "",
        content: str = "",
        link: str = "",
        metadata: Optional[dict] = None,
    ) -> None:
        """创建通知（无操作存根）"""
        pass

    async def mark_read(self, notification_id: int) -> bool:
        """标记已读（无操作存根）"""
        return True

    async def get_unread_count(self, user_id: int) -> int:
        """获取未读数（无操作存根）"""
        return 0

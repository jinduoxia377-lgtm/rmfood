"""
通知中心兼容层（compatibility re-export）

真实实现位于 ``app.core.realtime.notification_center``。
本模块保持旧导入路径 ``app.core.notification_center`` 可用，
仅重新导出核心符号，不包含任何实现逻辑。
"""

from app.core.realtime.notification_center import (
    NotificationCategory,
    NotificationChannel,
    NotificationPriority,
    NotificationService,
    UserNotificationPreference,
)

__all__ = [
    "NotificationService",
    "UserNotificationPreference",
    "NotificationChannel",
    "NotificationCategory",
    "NotificationPriority",
]

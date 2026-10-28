"""
NotificationService —— 真实实现（委托到 core.realtime.notification_center）

历史遗留的“空实现存根”已移除。业务流程（配方提审/审核/发布等）通过
``from app.services.notification import NotificationService`` 拿到的是真实服务：
- 通知记录真正写入 notifications 表
- 通过 WebSocket 向在线用户实时推送
- 尊重用户通知偏好（渠道开关 / 分类开关 / 免打扰时段）
"""
from app.core.realtime.notification_center import NotificationService

__all__ = ["NotificationService"]

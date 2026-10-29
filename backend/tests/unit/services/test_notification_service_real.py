"""
针对重构后的通知服务（app.services.notification → core.realtime.notification_center）的单元测试。

历史遗留：app/services/notification.py 曾是空实现存根（create_notification = pass）。
重构后该模块直接复用真实实现，本测试验证：
- 存根已替换为真实服务（带 senders 注册表）
- 模板渲染 _render_template 可用
- 免打扰时段判断可用
- 优先级/渠道/分类枚举完整
"""

from app.services.notification import NotificationService
from app.core.realtime.notification_center import (
    UserNotificationPreference,
    NotificationPriority,
    NotificationChannel,
    NotificationCategory,
    TYPE_PREF_KEY,
)


class TestNotificationServiceReal:
    """真实通知服务（非存根）"""

    def test_is_real_implementation(self):
        """app.services.notification 导出的必须是真实实现（含 senders 注册表）"""
        from app.core.realtime.notification_center import NotificationService as RealService
        assert NotificationService is RealService

        svc = NotificationService(db=None)
        assert len(svc.senders) >= 2

    def test_render_template(self):
        """模板 {{var}} 替换"""
        svc = NotificationService(db=None)
        out = svc._render_template(
            "Hello {{name}}, your {{resource_type}} is ready!",
            {"name": "张三", "resource_type": "配方"},
        )
        assert "张三" in out
        assert "配方" in out
        assert "{{" not in out

    def test_quiet_hours_disabled(self):
        """未设置免打扰时段时恒为 False"""
        svc = NotificationService(db=None)
        pref = UserNotificationPreference()
        assert svc._is_in_quiet_hours(pref) is False

    def test_quiet_hours_returns_bool(self):
        """设置免打扰时段后返回布尔值（具体结果取决于当前时间）"""
        svc = NotificationService(db=None)
        pref = UserNotificationPreference(quiet_hours_start="22:00", quiet_hours_end="08:00")
        assert isinstance(svc._is_in_quiet_hours(pref), bool)

    def test_enums_complete(self):
        """通知枚举完整"""
        assert NotificationPriority.NORMAL.value == "normal"
        assert NotificationChannel.IN_APP.value == "in_app"
        assert NotificationChannel.EMAIL.value == "email"
        assert NotificationChannel.WEBSOCKET.value == "websocket"
        assert NotificationCategory.SYSTEM.value == "system"

    def test_type_pref_key_mapping(self):
        """通知类型 → 用户偏好事件开关映射"""
        from app.models.enums import NotificationType
        assert TYPE_PREF_KEY[NotificationType.FORMULA_REVIEW.value] == "formula_review"
        assert TYPE_PREF_KEY[NotificationType.EXPERIMENT_COMPLETE.value] == "experiment_complete"
        assert TYPE_PREF_KEY[NotificationType.AI_TASK_DONE.value] == "ai_task_complete"
        assert TYPE_PREF_KEY[NotificationType.SYSTEM.value] == "system_alert"
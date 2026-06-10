"""
移动端 Facade（M2.6）

为移动端 API 提供统一的门面服务。
通过端口注入依赖，不直接依赖基础设施层。
"""
from typing import Optional

from ..domain.ports import MobileServicePort
from ..domain.mobile import MobileDashboard, PushNotification, TraceabilityRecord


class MobileFacade:
    """移动端统一 Facade — 通过端口注入依赖"""

    def __init__(self, service: MobileServicePort):
        self._service = service

    async def get_dashboard(self, user_id: str) -> MobileDashboard:
        return await self._service.get_dashboard(user_id)

    async def sync_push(self, items: list[dict]) -> list[dict]:
        return await self._service.sync_push(items)

    async def sync_pull(self, last_sync: Optional[str] = None) -> list[dict]:
        return await self._service.sync_pull(last_sync)

    async def get_notifications(self, user_id: str, limit: int = 20) -> list[PushNotification]:
        return await self._service.get_notifications(user_id, limit)

    async def mark_notification_read(self, notification_id: str) -> bool:
        return await self._service.mark_notification_read(notification_id)

    async def trace_product(self, batch_id: str) -> Optional[TraceabilityRecord]:
        return await self._service.trace_product(batch_id)

    async def get_pending_review(self, limit: int = 10) -> list[dict]:
        """获取待审核配方（移动端精简版）"""
        return [
            {"id": "F-001", "name": "枸杞红枣口服液", "submitter": "张三", "submitted_at": "2026-06-03"},
            {"id": "F-002", "name": "人参黄芪复方", "submitter": "李四", "submitted_at": "2026-06-04"},
            {"id": "F-003", "name": "山楂降脂配方", "submitter": "王五", "submitted_at": "2026-06-05"},
        ][:limit]

    async def quick_approve(self, formula_id: str, user_id: str) -> dict:
        """移动端快速审批"""
        return {
            "formula_id": formula_id,
            "status": "approved",
            "approved_by": user_id,
            "approved_at": "2026-06-06T00:00:00Z",
            "message": "审批完成",
        }

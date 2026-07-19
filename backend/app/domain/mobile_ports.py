"""
移动端服务端口 — 定义移动端 Facade 需要的外部能力

注：已从 domain.ports 迁移至此独立文件，
因为原 ports.py 随 DDD 死代码删除而移除。
"""
from __future__ import annotations
from abc import ABC, abstractmethod


class MobileServicePort(ABC):
    """移动端服务端口 — 定义移动端 Facade 需要的外部能力"""

    @abstractmethod
    async def get_dashboard(self, user_id: str):
        """获取移动端仪表盘数据"""
        ...

    @abstractmethod
    async def sync_push(self, items: list[dict]) -> list[dict]:
        """推送同步数据"""
        ...

    @abstractmethod
    async def sync_pull(self, last_sync: str | None = None) -> list[dict]:
        """拉取同步数据"""
        ...

    @abstractmethod
    async def get_notifications(self, user_id: str, limit: int = 20):
        """获取推送通知"""
        ...

    @abstractmethod
    async def mark_notification_read(self, notification_id: str) -> bool:
        """标记通知已读"""
        ...

    @abstractmethod
    async def get_traceability(self, formula_id: str):
        """获取配方溯源记录"""
        ...

    @abstractmethod
    async def get_pending_review(self, limit: int = 10):
        """获取待审核配方列表"""
        ...

    @abstractmethod
    async def quick_approve(self, formula_id: str, user_id: str):
        """移动端快速审批"""
        ...

"""
移动端后端服务（M2.6）

提供移动端专用的 API 逻辑：轻量数据、离线同步、推送、溯源。
"""
from __future__ import annotations
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from ..domain.mobile import (
    MobileSyncItem, MobileDashboard, PushNotification, TraceabilityRecord,
)
from ..domain.ports import MobileServicePort

logger = logging.getLogger(__name__)


class MobileService(MobileServicePort):
    """
    移动端后端服务 — 实现 MobileServicePort 端口
    """

    # ─── 仪表盘 ───

    async def get_dashboard(self, user_id: str) -> MobileDashboard:
        """获取移动端仪表盘数据"""
        # 模拟数据 — 实际从数据库查询
        return MobileDashboard(
            total_formulas=42,
            pending_review=3,
            active_experiments=5,
            recent_updates=7,
            alerts=[
                {"type": "approval", "message": "3 个配方待审核", "count": 3, "severity": "info"},
                {"type": "experiment", "message": "稳定性试验 H-023 已完成", "severity": "success"},
            ],
            stats={
                "this_month_formulas": 8,
                "approval_rate": "85%",
                "avg_cycle_days": 12,
            },
        )

    # ─── 离线同步 ───

    async def sync_push(self, items: list[dict]) -> list[dict]:
        """客户端推送变更到服务器"""
        results = []
        for item in items:
            sync_item = MobileSyncItem(
                entity_type=item.get("entity_type", ""),
                action=item.get("action", ""),
                entity_id=item.get("entity_id", str(uuid.uuid4())),
                data=item.get("data", {}),
                client_timestamp=datetime.fromisoformat(item.get("timestamp", datetime.utcnow().isoformat())) if item.get("timestamp") else datetime.utcnow(),
            )
            # 处理逻辑（模拟）
            results.append({
                "entity_id": sync_item.entity_id,
                "entity_type": sync_item.entity_type,
                "action": sync_item.action,
                "status": "synced",
                "conflict": False,
                "server_timestamp": datetime.utcnow().isoformat(),
            })
        return results

    async def sync_pull(self, last_sync: Optional[str] = None) -> list[dict]:
        """客户端拉取服务器变更"""
        return [
            {
                "entity_type": "formula",
                "action": "update",
                "entity_id": "f-001",
                "data": {"status": "approved"},
                "timestamp": datetime.utcnow().isoformat(),
            }
        ]

    # ─── 推送通知 ───

    async def get_notifications(self, user_id: str, limit: int = 20) -> list[PushNotification]:
        """获取用户通知"""
        return [
            PushNotification(
                id=f"n{i}",
                title=title,
                body=body,
                notification_type=ntype,
                target_user=user_id,
                created_at=datetime.utcnow(),
            )
            for i, (title, body, ntype) in enumerate([
                ("配方审核通过", "您提交的'枸杞红枣口服液'已通过审核", "approval"),
                ("实验完成", "稳定性加速试验 H-023 已完成数据分析", "update"),
                ("合规预警", "原料'XX'用量接近安全上限", "alert"),
                ("@提及", "张三在配方 PRD-042 中提到了您", "mention"),
            ][:limit])
        ]

    async def mark_notification_read(self, notification_id: str) -> bool:
        """标记通知已读"""
        return True

    # ─── 溯源 ───

    async def trace_product(self, batch_id: str) -> Optional[TraceabilityRecord]:
        """扫码溯源查询"""
        if not batch_id:
            return None
        return TraceabilityRecord(
            batch_id=batch_id,
            product_name="枸杞红枣口服液（测试）",
            ingredients=[
                {"name": "枸杞子", "origin": "宁夏中宁", "batch": "B20260501"},
                {"name": "红枣", "origin": "新疆和田", "batch": "B20260502"},
            ],
            production_date="2026-05-15",
            expiry_date="2027-05-15",
            certifications=["GB 16740-2014", "有机认证"],
            quality_records=[
                {"test": "微生物检测", "result": "合格", "date": "2026-05-16"},
                {"test": "重金属检测", "result": "合格", "date": "2026-05-16"},
            ],
            custody_chain=[
                {"step": "原料采购", "org": "宁夏枸杞基地", "date": "2026-03-01"},
                {"step": "生产加工", "org": "RMFOOD 生产中心", "date": "2026-05-15"},
                {"step": "质量检验", "org": "RMFOOD 质检中心", "date": "2026-05-16"},
            ],
        )

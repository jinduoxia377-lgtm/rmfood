"""
移动端领域实体（M2.6）

移动端 API 的轻量级数据模型。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class MobileSyncItem:
    """离线同步项"""
    entity_type: str           # formula/experiment/ingredient
    action: str                # create/update/delete
    entity_id: str
    data: dict
    client_timestamp: datetime = field(default_factory=datetime.utcnow)
    server_timestamp: Optional[datetime] = None
    conflict: bool = False


@dataclass
class MobileDashboard:
    """移动端仪表盘数据（轻量）"""
    total_formulas: int = 0
    pending_review: int = 0
    active_experiments: int = 0
    recent_updates: int = 0
    alerts: list[dict] = field(default_factory=list)
    stats: dict = field(default_factory=dict)


@dataclass
class PushNotification:
    """推送通知"""
    id: str
    title: str
    body: str
    notification_type: str     # approval/alert/update/mention
    target_user: str
    priority: str = "normal"   # high/normal/low
    data: dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    read: bool = False


@dataclass
class TraceabilityRecord:
    """溯源记录"""
    batch_id: str
    product_name: str
    ingredients: list[dict]
    production_date: str
    expiry_date: str
    certifications: list[str]
    quality_records: list[dict]
    custody_chain: list[dict]

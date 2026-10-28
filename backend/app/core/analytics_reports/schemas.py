"""
Analytics Schemas — 数据模型与枚举定义

由 analytics_engine.py 拆分而出，供 API 路由和 Service 层共用。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

# ── 枚举 ───────────────────────────────────────────────────────

class ExportFormat(str, Enum):
    EXCEL = "excel"
    PDF = "pdf"
    CSV = "csv"
    JSON = "json"


class ChartType(str, Enum):
    LINE = "line"
    BAR = "bar"
    PIE = "pie"
    AREA = "area"
    SCATTER = "scatter"
    TABLE = "table"
    KPI = "kpi"


class TimeGranularity(str, Enum):
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


# ── 数据类 ─────────────────────────────────────────────────────

@dataclass
class KPIMetric:
    id: str
    name: str
    value: float
    unit: str = ""
    change_percent: Optional[float] = None
    change_direction: Optional[str] = None
    target: Optional[float] = None
    trend_data: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class ChartData:
    chart_type: ChartType
    title: str
    labels: List[str]
    datasets: List[Dict[str, Any]]
    options: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ReportConfig:
    id: str
    name: str
    description: str
    widgets: List[Dict[str, Any]]
    filters: Dict[str, Any] = field(default_factory=dict)
    schedule: Optional[Dict[str, Any]] = None
    export_format: ExportFormat = ExportFormat.EXCEL
    created_by: int = 0
    is_public: bool = False


@dataclass
class ExportResult:
    file_name: str
    file_size_bytes: int
    format: ExportFormat
    content_type: str
    data: bytes
    generated_at: datetime


__all__ = [
    "ExportFormat",
    "ChartType",
    "TimeGranularity",
    "KPIMetric",
    "ChartData",
    "ReportConfig",
    "ExportResult",
]

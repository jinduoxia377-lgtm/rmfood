"""
Analytics 数据模型定义

从 analytics_engine.py 中提取的枚举和数据类。
"""
from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


class ExportFormat(str, Enum):
    CSV = "csv"
    EXCEL = "excel"
    JSON = "json"
    PDF = "pdf"


class ChartType(str, Enum):
    LINE = "line"
    BAR = "bar"
    PIE = "pie"
    AREA = "area"
    RADAR = "radar"


class TimeGranularity(str, Enum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    QUARTER = "quarter"


@dataclass
class KPIMetric:
    name: str
    value: Any
    change: float
    trend: List[float]
    icon: str
    color: str


@dataclass
class ChartData:
    type: str
    title: str
    data: List[Dict[str, Any]]
    x_axis: List[str]
    y_axis: List[str]


@dataclass
class ReportConfig:
    title: str
    date_range: Dict[str, str]
    charts: List[ChartData]
    kpis: List[KPIMetric]
    export_formats: List[str]


@dataclass
class ExportResult:
    file_path: str
    file_name: str
    format: str
    size_bytes: int
    success: bool
    error_message: Optional[str] = None

"""
🟡 P4-3: 数据分析与报表系统

提供企业级数据分析能力:
1. 📊 指标计算 - 配方数量 / 用户活跃度 / AI 使用统计
2. 📈 趋势分析 - 环比 / 同比 / 移动平均
3. 📋 报表生成 - 实时报表 / 定时报表 / 导出
4. 🎯 自定义指标 - 灵活的数据聚合
5. 📱 仪表盘 - 可视化图表配置
6. 🔔 异常告警 - 阈值监控 / 趋势异常检测

使用方式:
    # 1. 创建分析查询
    analyzer = AnalyticsEngine(db_session)

    # 2. 配方统计
    stats = await analyzer.get_formula_stats(tenant_id, date_range)

    # 3. 趋势分析
    trends = await analyzer.get_usage_trends(tenant_id, period="7d")

    # 4. 自定义报表
    report = await analyzer.build_report(
        dimensions=["category", "status"],
        measures=["count", "avg(processing_time)"],
        filters={"tenant_id": tenant_id},
    )
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════
# 🟡 P4-3: 分析维度与度量
# ═════════════════════════════════════════════


class TimeGranularity(str, Enum):
    """时间粒度"""
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    QUARTER = "quarter"
    YEAR = "year"


class MetricType(str, Enum):
    """指标类型"""
    COUNT = "count"
    SUM = "sum"
    AVG = "avg"
    MIN = "min"
    MAX = "max"
    PERCENTILE = "percentile"
    UNIQUE = "unique"


@dataclass
class DateRange:
    """日期范围"""
    start: datetime
    end: datetime

    def __init__(self, start: datetime | str, end: datetime | str = None):
        if isinstance(start, str):
            self.start = datetime.fromisoformat(start)
        else:
            self.start = start

        if end is None:
            self.end = datetime.now(timezone.utc)
        elif isinstance(end, str):
            self.end = datetime.fromisoformat(end)
        else:
            self.end = end

    @classmethod
    def last_n_days(cls, days: int) -> "DateRange":
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=days)
        return cls(start, end)

    @classmethod
    def this_week(cls) -> "DateRange":
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=now.weekday())
        return cls(start, now)

    @classmethod
    def this_month(cls) -> "DateRange":
        now = datetime.now(timezone.utc)
        start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        return cls(start, now)

    @classmethod
    def last_n_months(cls, months: int) -> "DateRange":
        now = datetime.now(timezone.utc)
        end = now
        start = (now.replace(day=1) - timedelta(days=1)).replace(day=1)
        for _ in range(months - 1):
            start = (start - timedelta(days=1)).replace(day=1)
        return cls(start, end)

    def to_dict(self) -> Dict[str, str]:
        return {
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
        }


# ═════════════════════════════════════════════
# 🟡 P4-3: 分析结果模型
# ═════════════════════════════════════════════


@dataclass
class MetricValue:
    """单个指标值"""
    name: str
    value: Union[int, float]
    unit: str = ""
    change_percent: Optional[float] = None  # 环比变化
    trend: Optional[str] = None  # up / down / stable

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "value": self.value,
            "unit": self.unit,
            "change_percent": self.change_percent,
            "trend": self.trend,
        }


@dataclass
class TimeSeriesPoint:
    """时间序列数据点"""
    timestamp: datetime
    value: Union[int, float]
    label: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "value": self.value,
            "label": self.label,
        }


@dataclass
class ChartData:
    """图表数据"""
    title: str
    chart_type: str = "line"  # line / bar / pie / area
    series: List[Dict[str, Any]] = field(default_factory=list)
    categories: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "chart_type": self.chart_type,
            "series": self.series,
            "categories": self.categories,
            "metadata": self.metadata,
        }


@dataclass
class ReportData:
    """完整报表数据"""
    title: str
    summary: List[MetricValue] = field(default_factory=list)
    charts: List[ChartData] = field(default_factory=list)
    tables: List[Dict[str, Any]] = field(default_factory=list)
    date_range: Dict[str, str] = field(default_factory=dict)
    generated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "summary": [m.to_dict() for m in self.summary],
            "charts": [c.to_dict() for c in self.charts],
            "tables": self.tables,
            "date_range": self.date_range,
            "generated_at": self.generated_at,
        }


# ═════════════════════════════════════════════
# 🟡 P4-3: 分析引擎
# ═════════════════════════════════════════════


class AnalyticsEngine:
    """
    📊 分析引擎

    提供:
    - 配方统计
    - 用户活跃分析
    - AI 使用分析
    - 趋势分析
    - 报表生成
    """

    def __init__(self, db_session=None):
        self._db = db_session

    # ─── 配方统计 ───

    async def get_formula_stats(
        self,
        tenant_id: str,
        date_range: Optional[DateRange] = None,
    ) -> Dict[str, MetricValue]:
        """获取配方统计"""
        date_range = date_range or DateRange.last_n_days(30)

        # 模拟数据（实际应从数据库查询）
        stats = {
            "total_formulas": MetricValue(
                name="配方总数",
                value=1250,
                unit="个",
            ),
            "active_formulas": MetricValue(
                name="活跃配方",
                value=980,
                unit="个",
                change_percent=12.5,
                trend="up",
            ),
            "pending_review": MetricValue(
                name="待审核",
                value=45,
                unit="个",
            ),
            "avg_version_per_formula": MetricValue(
                name="平均版本数",
                value=3.2,
                unit="个",
            ),
        }

        return stats

    async def get_formula_trends(
        self,
        tenant_id: str,
        metric: str = "count",
        granularity: TimeGranularity = TimeGranularity.DAY,
        date_range: Optional[DateRange] = None,
    ) -> List[TimeSeriesPoint]:
        """获取配方趋势"""
        date_range = date_range or DateRange.last_n_days(30)

        # 模拟数据
        points = []
        current = date_range.start
        value = 100

        while current <= date_range.end:
            # 模拟增长趋势
            value = int(value * 1.02 + (hash(str(current.date())) % 10 - 5))
            value = max(50, value)

            points.append(TimeSeriesPoint(
                timestamp=current,
                value=value,
                label=current.strftime("%m-%d"),
            ))

            # 按粒度递增
            if granularity == TimeGranularity.DAY:
                current += timedelta(days=1)
            elif granularity == TimeGranularity.WEEK:
                current += timedelta(weeks=1)
            elif granularity == TimeGranularity.MONTH:
                current = (current + timedelta(days=32)).replace(day=1)

        return points

    async def get_formula_by_category(
        self,
        tenant_id: str,
        date_range: Optional[DateRange] = None,
    ) -> List[Dict[str, Any]]:
        """按分类统计配方"""
        # 模拟数据
        return [
            {"category": "保健品", "count": 450, "percent": 36.0, "change": 15.2},
            {"category": "化妆品", "count": 320, "percent": 25.6, "change": 8.7},
            {"category": "食品添加剂", "count": 280, "percent": 22.4, "change": -2.3},
            {"category": "药品", "count": 150, "percent": 12.0, "change": 22.1},
            {"category": "其他", "count": 50, "percent": 4.0, "change": 5.0},
        ]

    # ─── 用户分析 ───

    async def get_user_stats(
        self,
        tenant_id: str,
        date_range: Optional[DateRange] = None,
    ) -> Dict[str, MetricValue]:
        """获取用户统计"""
        date_range = date_range or DateRange.last_n_days(30)

        return {
            "total_users": MetricValue(name="总用户数", value=85, unit="人"),
            "active_users": MetricValue(
                name="活跃用户",
                value=42,
                unit="人",
                change_percent=5.3,
                trend="up",
            ),
            "new_users": MetricValue(
                name="新增用户",
                value=8,
                unit="人",
                change_percent=33.3,
                trend="up",
            ),
            "avg_sessions_per_user": MetricValue(name="人均会话数", value=12.5, unit="次"),
        }

    async def get_user_activity_trends(
        self,
        tenant_id: str,
        date_range: Optional[DateRange] = None,
    ) -> List[TimeSeriesPoint]:
        """获取用户活跃趋势"""
        date_range = date_range or DateRange.last_n_days(30)

        points = []
        current = date_range.start
        base_value = 30

        while current <= date_range.end:
            # 模拟工作日高峰
            weekday = current.weekday()
            multiplier = 1.5 if weekday < 5 else 0.7

            value = int(base_value * multiplier + (hash(str(current.date())) % 10 - 5))
            value = max(10, value)

            points.append(TimeSeriesPoint(
                timestamp=current,
                value=value,
                label=current.strftime("%m-%d"),
            ))

            current += timedelta(days=1)

        return points

    # ─── AI 使用分析 ───

    async def get_ai_usage_stats(
        self,
        tenant_id: str,
        date_range: Optional[DateRange] = None,
    ) -> Dict[str, MetricValue]:
        """获取 AI 使用统计"""
        date_range = date_range or DateRange.last_n_days(30)

        return {
            "total_requests": MetricValue(name="AI 请求总数", value=8540, unit="次"),
            "successful_requests": MetricValue(
                name="成功请求",
                value=8230,
                unit="次",
                change_percent=18.5,
                trend="up",
            ),
            "failed_requests": MetricValue(
                name="失败请求",
                value=310,
                unit="次",
                change_percent=-12.0,
                trend="down",
            ),
            "avg_response_time": MetricValue(name="平均响应时间", value=2.3, unit="秒"),
            "total_tokens": MetricValue(name="Token 消耗", value=1250000, unit=""),
        }

    async def get_ai_usage_by_model(
        self,
        tenant_id: str,
        date_range: Optional[DateRange] = None,
    ) -> List[Dict[str, Any]]:
        """按模型统计 AI 使用"""
        return [
            {"model": "gpt-4", "requests": 4500, "tokens": 720000, "avg_latency": 3.2, "success_rate": 96.5},
            {"model": "gpt-4-turbo", "requests": 2800, "tokens": 420000, "avg_latency": 1.8, "success_rate": 98.2},
            {"model": "gpt-3.5-turbo", "requests": 1240, "tokens": 110000, "avg_latency": 0.8, "success_rate": 99.1},
        ]

    async def get_ai_cost_breakdown(
        self,
        tenant_id: str,
        date_range: Optional[DateRange] = None,
    ) -> Dict[str, Any]:
        """AI 成本分解"""
        return {
            "total_cost": 1250.50,
            "currency": "USD",
            "breakdown": [
                {"model": "gpt-4", "cost": 720.00, "percent": 57.5},
                {"model": "gpt-4-turbo", "cost": 420.00, "percent": 33.5},
                {"model": "gpt-3.5-turbo", "cost": 110.50, "percent": 8.8},
            ],
            "trend": "increasing",
            "forecast_next_month": 1500.00,
        }

    # ─── 仪表盘生成 ───

    async def generate_dashboard(
        self,
        tenant_id: str,
        date_range: Optional[DateRange] = None,
    ) -> ReportData:
        """生成完整仪表盘"""
        date_range = date_range or DateRange.last_n_days(30)

        # 获取各维度数据
        formula_stats = await self.get_formula_stats(tenant_id, date_range)
        formula_trends = await self.get_formula_trends(tenant_id, "count", TimeGranularity.DAY, date_range)
        category_data = await self.get_formula_by_category(tenant_id, date_range)
        user_stats = await self.get_user_stats(tenant_id, date_range)
        ai_stats = await self.get_ai_usage_stats(tenant_id, date_range)

        # 构建图表
        charts = [
            ChartData(
                title="配方数量趋势",
                chart_type="area",
                series=[{
                    "name": "配方数",
                    "data": [p.value for p in formula_trends],
                }],
                categories=[p.label for p in formula_trends],
            ),
            ChartData(
                title="配方分类分布",
                chart_type="pie",
                series=[{
                    "name": "分类",
                    "data": [{"name": c["category"], "value": c["count"]} for c in category_data],
                }],
            ),
            ChartData(
                title="AI 请求趋势",
                chart_type="line",
                series=[{
                    "name": "请求数",
                    "data": [200 + (hash(str(i)) % 100) for i in range(30)],
                }],
                categories=[f"Day {i+1}" for i in range(30)],
            ),
        ]

        # 构建汇总指标
        summary = list(formula_stats.values()) + list(user_stats.values()) + list(ai_stats.values())

        return ReportData(
            title="仪表盘概览",
            summary=summary,
            charts=charts,
            tables=[
                {"title": "配方分类统计", "headers": ["分类", "数量", "占比", "变化"], "rows": [[c["category"], c["count"], f"{c['percent']}%", f"{c['change']:+.1f}%"] for c in category_data]},
            ],
            date_range=date_range.to_dict(),
        )

    # ─── 同比/环比分析 ───

    async def compare_periods(
        self,
        tenant_id: str,
        current_range: DateRange,
        previous_range: DateRange,
        metrics: List[str],
    ) -> Dict[str, Dict[str, Any]]:
        """周期对比分析"""
        results = {}

        for metric in metrics:
            # 获取当前周期数据
            current = await self._get_metric_value(tenant_id, metric, current_range)
            # 获取上一周期数据
            previous = await self._get_metric_value(tenant_id, metric, previous_range)

            # 计算变化
            if previous > 0:
                change_percent = ((current - previous) / previous) * 100
            else:
                change_percent = 0.0

            results[metric] = {
                "current": current,
                "previous": previous,
                "change": current - previous,
                "change_percent": round(change_percent, 2),
                "trend": "up" if change_percent > 0 else "down" if change_percent < 0 else "stable",
            }

        return results

    async def _get_metric_value(
        self,
        tenant_id: str,
        metric: str,
        date_range: DateRange,
    ) -> Union[int, float]:
        """获取单个指标值"""
        # 模拟数据
        base_values = {
            "formulas": 1000,
            "users": 50,
            "ai_requests": 5000,
        }
        return base_values.get(metric, 100)

    # ─── 异常检测 ───

    async def detect_anomalies(
        self,
        tenant_id: str,
        metric: str,
        date_range: Optional[DateRange] = None,
        sensitivity: float = 2.0,  # 标准差倍数
    ) -> List[Dict[str, Any]]:
        """异常检测（基于标准差）"""
        date_range = date_range or DateRange.last_n_days(30)

        # 获取时间序列
        points = await self.get_formula_trends(tenant_id, metric, TimeGranularity.DAY, date_range)
        values = [p.value for p in points]

        # 计算均值和标准差
        if len(values) < 3:
            return []

        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / len(values)
        std = variance ** 0.5

        # 检测异常
        anomalies = []
        for point in points:
            if abs(point.value - mean) > sensitivity * std:
                anomalies.append({
                    "timestamp": point.timestamp.isoformat(),
                    "value": point.value,
                    "expected_range": [mean - sensitivity * std, mean + sensitivity * std],
                    "deviation": round((point.value - mean) / std, 2),
                })

        return anomalies


# ═════════════════════════════════════════════
# 🟡 P4-3: 报表生成器
# ═════════════════════════════════════════════


class ReportGenerator:
    """
    📋 报表生成器

    支持:
    - Excel 报表
    - PDF 报表
    - CSV 导出
    - 定时任务
    """

    def __init__(self, analytics: AnalyticsEngine):
        self._analytics = analytics

    async def generate_excel_report(
        self,
        tenant_id: str,
        report_type: str = "dashboard",
        date_range: Optional[DateRange] = None,
    ) -> bytes:
        """生成 Excel 报表"""
        # 实际实现应使用 openpyxl
        dashboard = await self._analytics.generate_dashboard(tenant_id, date_range)

        # 返回模拟数据
        return b"Excel file content (use openpyxl to implement)"

    async def generate_pdf_report(
        self,
        tenant_id: str,
        report_type: str = "dashboard",
        date_range: Optional[DateRange] = None,
    ) -> bytes:
        """生成 PDF 报表"""
        # 实际实现应使用 reportlab 或 weasyprint
        dashboard = await self._analytics.generate_dashboard(tenant_id, date_range)

        return b"PDF file content (use reportlab/weasyprint to implement)"

    async def generate_csv_export(
        self,
        tenant_id: str,
        data_type: str = "formulas",
        filters: Optional[Dict[str, Any]] = None,
    ) -> bytes:
        """生成 CSV 导出"""
        import csv
        import io

        # 模拟数据
        data = await self._analytics.get_formula_by_category(tenant_id)

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=["category", "count", "percent", "change"])
        writer.writeheader()
        writer.writerows(data)

        return output.getvalue().encode("utf-8")


# ═════════════════════════════════════════════
# 🟡 P4-3: 模块导出
# ═════════════════════════════════════════════


__all__ = [
    # 枚举
    "TimeGranularity",
    "MetricType",
    # 数据类
    "DateRange",
    "MetricValue",
    "TimeSeriesPoint",
    "ChartData",
    "ReportData",
    # 引擎
    "AnalyticsEngine",
    "ReportGenerator",
]

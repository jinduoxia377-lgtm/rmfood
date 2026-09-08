"""
Anomaly Detector — 基于统计方法的异常检测引擎

提供以下能力：
- KPI 指标异常波动检测（3σ 规则）
- 时间序列突变点检测（CUSUM）
- 阈值告警生成

用法:
    from app.core.analytics_reports.anomaly_detector import AnomalyDetector

    detector = AnomalyDetector()
    anomalies = await detector.detect_kpi_anomalies(kpi_data)
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class Anomaly:
    """单个异常事件。"""
    metric_id: str
    metric_name: str
    current_value: float
    expected_min: float
    expected_max: float
    deviation_sigma: float   # 偏离标准差倍数
    severity: str            # "low" | "medium" | "high"
    detected_at: str


class AnomalyDetector:
    """基于统计规律的异常检测器。"""

    # 严重级别阈值
    _HIGH_THRESHOLD = 3.0
    _MEDIUM_THRESHOLD = 2.0

    # ── KPI 指标异常检测（3σ 规则） ────────────────────────

    async def detect_kpi_anomalies(
        self,
        kpi_data: List[Dict[str, Any]],
        threshold: float = 2.5,
    ) -> List[Dict[str, Any]]:
        """
        对每个含 trend_data 的 KPI 指标，使用最近 30 个数据点计算均值和标准差，
        若当前值偏离超过 threshold 倍标准差则标记为异常。

        kpi_data 格式参考 KPIMetric 列表。
        """
        anomalies: List[Dict[str, Any]] = []

        for kpi in kpi_data:
            trend = kpi.get("trend_data") or kpi.get("trend")
            if not trend or len(trend) < 10:
                continue

            values = [float(p.get("value", p.get("v", 0))) for p in trend]
            current = values[-1]
            mean = sum(values) / len(values)
            variance = sum((v - mean) ** 2 for v in values) / len(values)
            std = math.sqrt(variance) if variance > 0 else 0

            if std == 0:
                continue

            deviation = abs(current - mean) / std
            if deviation >= threshold:
                severity = (
                    "high" if deviation >= self._HIGH_THRESHOLD
                    else "medium" if deviation >= self._MEDIUM_THRESHOLD
                    else "low"
                )
                anomalies.append({
                    "metric_id": kpi.get("id", "unknown"),
                    "metric_name": kpi.get("name", "未知指标"),
                    "current_value": round(current, 2),
                    "expected_min": round(mean - threshold * std, 2),
                    "expected_max": round(mean + threshold * std, 2),
                    "deviation_sigma": round(deviation, 2),
                    "severity": severity,
                    "direction": "up" if current > mean else "down",
                    "detected_at": datetime.now(timezone.utc).isoformat(),
                })

        return anomalies

    # ── 时间序列突变点检测（CUSUM） ─────────────────────────

    async def detect_cusum_anomalies(
        self,
        values: List[float],
        target: Optional[float] = None,
        slack: float = 0.0,
        trigger: float = 4.0,
    ) -> List[Dict[str, Any]]:
        """
        CUSUM（累积和）算法检测时间序列中的均值偏移。

        Args:
            values: 时间序列数值列表
            target: 目标均值（默认用样本均值）
            slack: 允许偏离的缓冲量
            trigger: 触发告警的累积阈值（单位：标准差）
        """
        if len(values) < 5:
            return []

        mean = sum(values) / len(values)
        std = (sum((v - mean) ** 2 for v in values) / len(values)) ** 0.5
        if std == 0:
            return []

        target = target if target is not None else mean
        cusum_pos = 0.0
        cusum_neg = 0.0
        anomalies: List[Dict[str, Any]] = []

        for i, v in enumerate(values):
            z = (v - target) / std
            cusum_pos = max(0, cusum_pos + z - slack)
            cusum_neg = min(0, cusum_neg + z + slack)

            if cusum_pos > trigger or abs(cusum_neg) > trigger:
                anomalies.append({
                    "index": i,
                    "value": round(v, 2),
                    "cusum_pos": round(cusum_pos, 2),
                    "cusum_neg": round(cusum_neg, 2),
                    "type": "increase" if cusum_pos > trigger else "decrease",
                })
                cusum_pos = 0.0
                cusum_neg = 0.0

        return anomalies

    # ── 批量检测（所有图表数据） ────────────────────────────

    async def detect_all_anomalies(
        self,
        dashboard_data: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """
        对仪表盘中的所有 KPI 和趋势数据进行异常检测。

        dashboard_data 格式参考 DashboardResponse。
        """
        anomalies: List[Dict[str, Any]] = []

        # KPI 异常
        kpi_list = dashboard_data.get("kpi", [])
        if kpi_list:
            kpi_anomalies = await self.detect_kpi_anomalies(kpi_list, threshold=2.5)
            anomalies.extend(kpi_anomalies)

        # 趋势数据突变点
        charts = dashboard_data.get("charts", {})
        for chart_key, chart in charts.items():
            for dataset in chart.get("datasets", []):
                data = dataset.get("data", [])
                if len(data) >= 10:
                    cusum_anomalies = await self.detect_cusum_anomalies(
                        [float(v) for v in data],
                        trigger=3.0,
                    )
                    for a in cusum_anomalies:
                        a["chart_key"] = chart_key
                        a["dataset_label"] = dataset.get("label", "")
                    anomalies.extend(cusum_anomalies)

        # 按严重级别排序
        severity_order = {"high": 0, "medium": 1, "low": 2}
        anomalies.sort(key=lambda x: severity_order.get(x.get("severity", "low"), 2))

        return anomalies


# 模块级单例
_detector = AnomalyDetector()


def get_anomaly_detector() -> AnomalyDetector:
    return _detector

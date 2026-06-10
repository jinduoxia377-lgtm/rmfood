"""
Prometheus 指标模块

提供标准 Prometheus exposition format 的指标收集和暴露。

指标类型:
- Counter: 只增不减（请求总数、错误总数）
- Histogram: 分布统计（延迟 P50/P95/P99）
- Gauge: 可增可减（当前连接数、缓存命中率）

使用方式:
    from .core.metrics import metrics

    # 在中间件中记录请求
    metrics.record_request(method, path, status_code, duration)

    # 获取 Prometheus 格式指标
    text = metrics.expose()
"""
from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List

logger = logging.getLogger(__name__)


@dataclass
class CounterMetric:
    """计数器指标"""
    name: str
    help_text: str
    value: float = 0.0

    def inc(self, amount: float = 1.0) -> None:
        self.value += amount

    def expose(self) -> str:
        return f"# HELP {self.name} {self.help_text}\n# TYPE {self.name} counter\n{self.name} {self.value}"


@dataclass
class HistogramMetric:
    """直方图指标"""
    name: str
    help_text: str
    buckets: List[float] = field(default_factory=lambda: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0])
    bucket_counts: Dict[float, int] = field(default_factory=lambda: defaultdict(int))
    sum_value: float = 0.0
    count: int = 0

    def observe(self, value: float) -> None:
        self.sum_value += value
        self.count += 1
        for bucket in self.buckets:
            if value <= bucket:
                self.bucket_counts[bucket] += 1

    def expose(self) -> str:
        lines = [f"# HELP {self.name} {self.help_text}", f"# TYPE {self.name} histogram"]
        for bucket in self.buckets:
            lines.append(f'{self.name}_bucket{{le="{bucket}"}} {self.bucket_counts.get(bucket, 0)}')
        lines.append(f'{self.name}_bucket{{le="+Inf"}} {self.count}')
        lines.append(f'{self.name}_sum {self.sum_value}')
        lines.append(f'{self.name}_count {self.count}')
        return "\n".join(lines)


@dataclass
class GaugeMetric:
    """仪表盘指标"""
    name: str
    help_text: str
    value: float = 0.0

    def set(self, value: float) -> None:
        self.value = value

    def inc(self, amount: float = 1.0) -> None:
        self.value += amount

    def dec(self, amount: float = 1.0) -> None:
        self.value -= amount

    def expose(self) -> str:
        return f"# HELP {self.name} {self.help_text}\n# TYPE {self.name} gauge\n{self.name} {self.value}"


class MetricsCollector:
    """Prometheus 指标收集器"""

    def __init__(self):
        # HTTP 请求指标
        self.http_requests_total = CounterMetric("rmfood_http_requests_total", "Total HTTP requests")
        self.http_request_duration_seconds = HistogramMetric("rmfood_http_request_duration_seconds", "HTTP request duration in seconds")
        self.http_requests_in_progress = GaugeMetric("rmfood_http_requests_in_progress", "Number of HTTP requests currently in progress")
        self.http_errors_total = CounterMetric("rmfood_http_errors_total", "Total HTTP errors (4xx/5xx)")

        # 缓存指标
        self.cache_hits_total = CounterMetric("rmfood_cache_hits_total", "Total cache hits")
        self.cache_misses_total = CounterMetric("rmfood_cache_misses_total", "Total cache misses")

        # 数据库指标
        self.db_connections_active = GaugeMetric("rmfood_db_connections_active", "Number of active database connections")
        self.db_query_duration_seconds = HistogramMetric("rmfood_db_query_duration_seconds", "Database query duration in seconds", buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0])

        # AI 模型指标
        self.ai_inference_duration_seconds = HistogramMetric("rmfood_ai_inference_duration_seconds", "AI model inference duration in seconds", buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0])
        self.ai_requests_total = CounterMetric("rmfood_ai_requests_total", "Total AI model requests")

        # 业务指标
        self.formulas_created_total = CounterMetric("rmfood_formulas_created_total", "Total formulas created")
        self.active_users = GaugeMetric("rmfood_active_users", "Number of currently active users")

    def record_request(self, method: str, path: str, status_code: int, duration: float) -> None:
        """记录 HTTP 请求"""
        self.http_requests_total.inc()
        self.http_request_duration_seconds.observe(duration)
        if status_code >= 400:
            self.http_errors_total.inc()

    def record_cache_hit(self) -> None:
        self.cache_hits_total.inc()

    def record_cache_miss(self) -> None:
        self.cache_misses_total.inc()

    def record_db_query(self, duration: float) -> None:
        self.db_query_duration_seconds.observe(duration)

    def record_ai_inference(self, duration: float) -> None:
        self.ai_inference_duration_seconds.observe(duration)
        self.ai_requests_total.inc()

    def expose(self) -> str:
        """输出 Prometheus exposition format"""
        sections = [
            self.http_requests_total.expose(),
            self.http_request_duration_seconds.expose(),
            self.http_requests_in_progress.expose(),
            self.http_errors_total.expose(),
            self.cache_hits_total.expose(),
            self.cache_misses_total.expose(),
            self.db_connections_active.expose(),
            self.db_query_duration_seconds.expose(),
            self.ai_inference_duration_seconds.expose(),
            self.ai_requests_total.expose(),
            self.formulas_created_total.expose(),
            self.active_users.expose(),
        ]
        return "\n\n".join(sections) + "\n"


# 全局单例
metrics = MetricsCollector()

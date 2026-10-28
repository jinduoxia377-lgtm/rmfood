"""RAG 监控告警服务

提供 RAG 系统的实时监控和告警功能，包括：
- 性能指标监控（延迟/吞吐量/错误率）
- 知识库健康检查
- 告警规则引擎
- 通知渠道集成（邮件/日志/Webhook）
- 历史数据查询

特性：
- 异步指标收集
- 内存环形缓冲区（防止内存泄漏）
- 可配置告警阈值
- 多通知渠道
"""

import asyncio
import logging
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


class Severity(Enum):
    """告警严重级别"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AlertStatus(Enum):
    """告警状态"""
    FIRING = "firing"
    RESOLVED = "resolved"
    ACKNOWLEDGED = "acknowledged"


@dataclass
class MetricPoint:
    """指标数据点"""
    timestamp: datetime
    value: float
    tags: Dict[str, str] = field(default_factory=dict)


@dataclass
class MetricStats:
    """指标统计"""
    count: int = 0
    sum: float = 0.0
    min: float = float('inf')
    max: float = float('-inf')
    values: List[float] = field(default_factory=list)

    def add(self, value: float) -> None:
        self.count += 1
        self.sum += value
        self.min = min(self.min, value)
        self.max = max(self.max, value)
        if len(self.values) < 1000:  # 最多保存 1000 个值
            self.values.append(value)

    def avg(self) -> float:
        return self.sum / self.count if self.count > 0 else 0.0

    def percentile(self, p: float) -> float:
        """计算百分位数"""
        if not self.values:
            return 0.0
        sorted_values = sorted(self.values)
        k = (p / 100.0) * (len(sorted_values) - 1)
        f = int(k)
        c = f + 1 if f + 1 < len(sorted_values) else f
        d = k - f
        return sorted_values[f] + d * (sorted_values[c] - sorted_values[f])

    def std(self) -> float:
        """计算标准差"""
        if self.count < 2:
            return 0.0
        mean = self.avg()
        variance = sum((x - mean) ** 2 for x in self.values) / (self.count - 1)
        return variance ** 0.5


@dataclass
class AlertRule:
    """告警规则"""
    name: str
    metric: str
    operator: str  # gt, lt, gte, lte
    threshold: float
    severity: Severity = Severity.WARNING
    duration_seconds: int = 60  # 持续时间
    message: str = ""
    enabled: bool = True


@dataclass
class Alert:
    """告警实例"""
    id: str
    rule: AlertRule
    status: AlertStatus = AlertStatus.FIRING
    first_triggered: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_triggered: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    value: float = 0.0
    acknowledged_by: Optional[str] = None
    resolved_at: Optional[datetime] = None

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "rule_name": self.rule.name,
            "metric": self.rule.metric,
            "severity": self.rule.severity.value,
            "status": self.status.value,
            "first_triggered": self.first_triggered.isoformat(),
            "last_triggered": self.last_triggered.isoformat(),
            "value": self.value,
            "threshold": self.rule.threshold,
            "acknowledged_by": self.acknowledged_by,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }


class RAGMonitor:
    """RAG 监控服务"""

    def __init__(
        self,
        max_history: int = 10000,
        check_interval: int = 30,
    ):
        """
        Args:
            max_history: 最大历史记录数
            check_interval: 检查间隔（秒）
        """
        self.max_history = max_history
        self.check_interval = check_interval

        # 指标存储（metric_name -> MetricStats）
        self._metrics: Dict[str, MetricStats] = {}

        # 指标历史（metric_name -> deque of MetricPoint）
        self._history: Dict[str, deque[MetricPoint]] = {}

        # 告警规则
        self._rules: List[AlertRule] = []

        # 活跃告警
        self._active_alerts: Dict[str, Alert] = {}

        # 通知回调
        self._notifiers: List[Callable[[Alert], None]] = []

        # 运行状态
        self._running = False
        self._check_task: Optional[asyncio.Task] = None

        # 默认告警规则
        self._init_default_rules()

        logger.info("RAG 监控服务初始化: max_history=%d, interval=%ds", max_history, check_interval)

    def _init_default_rules(self) -> None:
        """初始化默认告警规则"""
        self._rules = [
            AlertRule(
                name="high_latency_p95",
                metric="retrieval_latency_p95",
                operator="gt",
                threshold=1000.0,  # 1 秒
                severity=Severity.WARNING,
                message="检索延迟 P95 超过 1 秒",
            ),
            AlertRule(
                name="high_error_rate",
                metric="error_rate",
                operator="gt",
                threshold=5.0,  # 5%
                severity=Severity.ERROR,
                message="错误率超过 5%",
            ),
            AlertRule(
                name="low_recall",
                metric="recall_avg",
                operator="lt",
                threshold=0.5,
                severity=Severity.WARNING,
                message="平均召回率低于 0.5",
            ),
            AlertRule(
                name="low_precision",
                metric="precision_avg",
                operator="lt",
                threshold=0.6,
                severity=Severity.INFO,
                message="平均精确率低于 0.6",
            ),
            AlertRule(
                name="high_qps",
                metric="qps",
                operator="gt",
                threshold=100.0,
                severity=Severity.INFO,
                message="查询频率超过 100 QPS",
            ),
        ]

    def start(self) -> None:
        """启动监控"""
        if self._running:
            logger.warning("监控服务已在运行")
            return

        self._running = True
        self._check_task = asyncio.create_task(self._check_loop())
        logger.info("监控服务已启动")

    async def stop(self) -> None:
        """停止监控"""
        self._running = False
        if self._check_task:
            self._check_task.cancel()
            try:
                await self._check_task
            except asyncio.CancelledError:
                pass
        logger.info("监控服务已停止")

    async def _check_loop(self) -> None:
        """检查循环"""
        while self._running:
            try:
                self._evaluate_alerts()
            except Exception as e:
                logger.error("告警评估异常: %s", e, exc_info=True)
            await asyncio.sleep(self.check_interval)

    def record_metric(
        self,
        name: str,
        value: float,
        tags: Dict[str, str] = None,
    ) -> None:
        """记录指标"""
        tags = tags or {}

        # 更新统计
        if name not in self._metrics:
            self._metrics[name] = MetricStats()
        self._metrics[name].add(value)

        # 更新历史
        if name not in self._history:
            self._history[name] = deque(maxlen=self.max_history)
        self._history[name].append(MetricPoint(
            timestamp=datetime.now(timezone.utc),
            value=value,
            tags=tags,
        ))

    def record_retrieval_latency(self, latency_ms: float) -> None:
        """记录检索延迟"""
        self.record_metric("retrieval_latency", latency_ms)
        self.record_metric("retrieval_latency_p50", latency_ms, {"percentile": "p50"})

    def record_query(self, success: bool, latency_ms: float) -> None:
        """记录查询"""
        self.record_metric("query_count", 1.0)
        self.record_metric("query_latency", latency_ms)

        if success:
            self.record_metric("query_success", 1.0)
        else:
            self.record_metric("query_error", 1.0)

    def record_error(self, error_type: str, message: str) -> None:
        """记录错误"""
        self.record_metric("error_count", 1.0)
        logger.error("[%s] %s", error_type, message)

    def record_quality_metric(
        self,
        precision: float,
        recall: float,
        f1: float,
        mrr: float,
    ) -> None:
        """记录检索质量指标"""
        self.record_metric("precision_avg", precision)
        self.record_metric("recall_avg", recall)
        self.record_metric("f1_avg", f1)
        self.record_metric("mrr_avg", mrr)

    def _evaluate_alerts(self) -> None:
        """评估告警规则"""
        for rule in self._rules:
            if not rule.enabled:
                continue

            stats = self._metrics.get(rule.metric)
            if not stats or stats.count == 0:
                continue

            # 获取当前值
            if rule.metric.endswith("_p95"):
                current_value = stats.percentile(95)
            elif rule.metric.endswith("_p50"):
                current_value = stats.percentile(50)
            else:
                current_value = stats.avg()

            # 评估规则
            should_fire = self._evaluate_rule(rule, current_value)

            # 获取或创建告警
            alert_id = rule.name
            if should_fire:
                if alert_id in self._active_alerts:
                    # 更新现有告警
                    alert = self._active_alerts[alert_id]
                    alert.last_triggered = datetime.now(timezone.utc)
                    alert.value = current_value
                else:
                    # 创建新告警
                    alert = Alert(
                        id=alert_id,
                        rule=rule,
                        value=current_value,
                    )
                    self._active_alerts[alert_id] = alert
                    logger.warning("告警触发: %s (%.2f %s %.2f)",
                                   rule.name, current_value, rule.operator, rule.threshold)
                    self._notify(alert)
            else:
                # 解决告警
                if alert_id in self._active_alerts:
                    alert = self._active_alerts.pop(alert_id)
                    alert.status = AlertStatus.RESOLVED
                    alert.resolved_at = datetime.now(timezone.utc)
                    logger.info("告警解决: %s", rule.name)

    def _evaluate_rule(self, rule: AlertRule, value: float) -> bool:
        """评估告警规则"""
        operators = {
            "gt": lambda a, b: a > b,
            "lt": lambda a, b: a < b,
            "gte": lambda a, b: a >= b,
            "lte": lambda a, b: a <= b,
        }
        op = operators.get(rule.operator, operators["gt"])
        return op(value, rule.threshold)

    def add_notifier(self, notifier: Callable[[Alert], None]) -> None:
        """添加通知回调"""
        self._notifiers.append(notifier)

    def _notify(self, alert: Alert) -> None:
        """发送通知"""
        for notifier in self._notifiers:
            try:
                notifier(alert)
            except Exception as e:
                logger.error("通知发送失败: %s", e)

    def acknowledge_alert(self, alert_id: str, user: str) -> bool:
        """确认告警"""
        if alert_id in self._active_alerts:
            alert = self._active_alerts[alert_id]
            alert.status = AlertStatus.ACKNOWLEDGED
            alert.acknowledged_by = user
            return True
        return False

    def resolve_alert(self, alert_id: str) -> bool:
        """解决告警"""
        if alert_id in self._active_alerts:
            alert = self._active_alerts.pop(alert_id)
            alert.status = AlertStatus.RESOLVED
            alert.resolved_at = datetime.now(timezone.utc)
            return True
        return False

    def get_metric_stats(self, name: Optional[str] = None) -> Dict:
        """获取指标统计"""
        if name:
            stats = self._metrics.get(name)
            if not stats:
                return {}
            return {
                "name": name,
                "count": stats.count,
                "avg": round(stats.avg(), 4),
                "min": round(stats.min, 4) if stats.min != float('inf') else None,
                "max": round(stats.max, 4) if stats.max != float('-inf') else None,
                "std": round(stats.std(), 4),
                "p50": round(stats.percentile(50), 4),
                "p95": round(stats.percentile(95), 4),
                "p99": round(stats.percentile(99), 4),
            }

        return {
            name: {
                "count": stats.count,
                "avg": round(stats.avg(), 4),
                "p95": round(stats.percentile(95), 4),
            }
            for name, stats in self._metrics.items()
        }

    def get_metric_history(
        self,
        name: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
    ) -> List[Dict]:
        """获取指标历史"""
        points = list(self._history.get(name, []))

        # 过滤时间范围
        if start_time:
            points = [p for p in points if p.timestamp >= start_time]
        if end_time:
            points = [p for p in points if p.timestamp <= end_time]

        # 限制数量
        points = points[-limit:]

        return [
            {
                "timestamp": p.timestamp.isoformat(),
                "value": p.value,
                "tags": p.tags,
            }
            for p in points
        ]

    def get_active_alerts(self) -> List[Dict]:
        """获取活跃告警"""
        return [alert.to_dict() for alert in self._active_alerts.values()]

    def get_alert_rules(self) -> List[Dict]:
        """获取告警规则"""
        return [
            {
                "name": rule.name,
                "metric": rule.metric,
                "operator": rule.operator,
                "threshold": rule.threshold,
                "severity": rule.severity.value,
                "enabled": rule.enabled,
                "message": rule.message,
            }
            for rule in self._rules
        ]

    def add_alert_rule(self, rule: AlertRule) -> None:
        """添加告警规则"""
        self._rules.append(rule)
        logger.info("添加告警规则: %s", rule.name)

    def remove_alert_rule(self, rule_name: str) -> bool:
        """移除告警规则"""
        original_len = len(self._rules)
        self._rules = [r for r in self._rules if r.name != rule_name]
        return len(self._rules) < original_len

    def get_health_report(self) -> Dict:
        """获取健康报告"""
        total_queries = self._metrics.get("query_count", MetricStats()).count
        total_errors = self._metrics.get("query_error", MetricStats()).count
        error_rate = (total_errors / total_queries * 100) if total_queries > 0 else 0.0

        avg_latency = self._metrics.get("query_latency", MetricStats()).avg()

        status = "healthy"
        if error_rate > 10:
            status = "critical"
        elif error_rate > 5:
            status = "warning"
        elif avg_latency > 500:
            status = "warning"

        return {
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "uptime_seconds": time.time() - self._metrics.get("query_count", MetricStats()).values[0] if self._metrics.get("query_count", MetricStats()).values else 0,
            "total_queries": total_queries,
            "total_errors": total_errors,
            "error_rate": round(error_rate, 2),
            "avg_latency_ms": round(avg_latency, 2),
            "active_alerts": len(self._active_alerts),
            "active_rules": len(self._rules),
            "metrics_count": len(self._metrics),
        }


# 全局单例
_monitor_instance: Optional[RAGMonitor] = None


def get_rag_monitor() -> RAGMonitor:
    """获取全局监控服务单例"""
    global _monitor_instance
    if _monitor_instance is None:
        _monitor_instance = RAGMonitor()
    return _monitor_instance

"""
AI 服务告警规则引擎

基于指标摘要的可配置告警系统，支持：
- 预置告警规则（错误率/延迟/Fallback/全离线）
- 冷却机制防止告警风暴
- 告警历史记录
- 自定义条件函数

用法:
    from app.services.ai.shared.alerting import get_alerting_engine

    engine = get_alerting_engine()
    alerts = engine.evaluate(metrics_summary)
"""
from dataclasses import dataclass, field
from typing import Callable, Any
import asyncio
import logging
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════
# 数据模型
# ══════════════════════════════════════════════


@dataclass
class AlertRule:
    """告警规则定义"""
    rule_id: str
    name: str
    condition: Callable[[dict], bool]   # 接收 metrics summary dict, 返回 bool
    severity: str                        # "info" | "warning" | "critical"
    cooldown_seconds: int = 300
    channels: list[str] = field(default_factory=lambda: ["system"])
    message_template: str = ""


@dataclass
class AlertEvent:
    """告警事件实例"""
    rule_id: str
    name: str
    severity: str
    message: str
    timestamp: str
    metrics_snapshot: dict


# ══════════════════════════════════════════════
# 告警引擎
# ══════════════════════════════════════════════


class AlertingEngine:
    """AI 服务告警规则引擎"""

    def __init__(self):
        self.rules: list[AlertRule] = []
        self.recent_alerts: dict[str, float] = {}  # rule_id -> last_fire_time
        self.alert_history: list[AlertEvent] = []  # 最近 100 条
        self._max_history = 100

    def add_rule(self, rule: AlertRule):
        """添加自定义告警规则"""
        self.rules.append(rule)

    def load_preset_rules(self):
        """加载预置告警规则"""
        self.rules = [
            AlertRule(
                rule_id="ALERT-ERR-RATE-HIGH",
                name="错误率过高",
                condition=lambda m: m.get("error_rate", 0) > 0.2 and m.get("total_calls", 0) > 10,
                severity="critical",
                cooldown_seconds=60,
                message_template="AI 服务错误率达到 {error_rate:.1%} ({total_calls}次调用/{window_seconds}s)",
            ),
            AlertRule(
                rule_id="ALERT-LATENCY-P99-HIGH",
                name="P99 延迟过高",
                condition=lambda m: m.get("latency_p99", 0) > 30000,
                severity="warning",
                cooldown_seconds=300,
                message_template="AI P99 延迟达 {latency_p99:.0f}ms，用户体验可能受影响",
            ),
            AlertRule(
                rule_id="ALERT-FALLBACK-SPIKE",
                name="Fallback 使用激增",
                condition=lambda m: m.get("fallback_rate", 0) > 0.5 and m.get("total_calls", 0) > 5,
                severity="warning",
                cooldown_seconds=120,
                message_template="{fallback_rate:.0%} 的请求使用了降级模型，主模型可能不可用",
            ),
            AlertRule(
                rule_id="ALERT-ALL-DOWN",
                name="所有 Provider 离线",
                condition=lambda m: m.get("success_rate", 1) == 0 and m.get("total_calls", 0) > 3,
                severity="critical",
                cooldown_seconds=30,
                channels=["system"],
                message_template="所有 AI Provider 均不可用！系统正在使用纯规则引擎模式运行。",
            ),
        ]

    def evaluate(self, metrics_summary: dict) -> list[AlertEvent]:
        """评估所有规则，返回触发的告警列表"""
        alerts = []
        now = time.monotonic()

        for rule in self.rules:
            # 冷却检查
            last_fire = self.recent_alerts.get(rule.rule_id, 0)
            if now - last_fire < rule.cooldown_seconds:
                continue

            try:
                if rule.condition(metrics_summary):
                    # 格式化消息
                    msg = rule.message_template.format(**metrics_summary)
                    event = AlertEvent(
                        rule_id=rule.rule_id,
                        name=rule.name,
                        severity=rule.severity,
                        message=msg,
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        metrics_snapshot=dict(metrics_summary),
                    )
                    alerts.append(event)
                    self.recent_alerts[rule.rule_id] = now

                    # 记录历史
                    self.alert_history.append(event)
                    if len(self.alert_history) > self._max_history:
                        self.alert_history.pop(0)

                    logger.warning(f"[ALERT-{rule.severity.upper()}] {rule.name}: {msg}")
            except Exception as e:
                logger.error(f"评估告警规则 {rule.rule_id} 失败: {e}")

        return alerts

    def get_recent_alerts(self, limit: int = 20) -> list[dict]:
        """获取最近的告警历史"""
        return [a.__dict__ for a in self.alert_history[-limit:]]


# ══════════════════════════════════════════════
# 全局单例
# ══════════════════════════════════════════════

_engine = AlertingEngine()


def get_alerting_engine() -> AlertingEngine:
    """获取全局 AlertingEngine 单例"""
    return _engine


# 启动时自动加载预置规则
_engine.load_preset_rules()

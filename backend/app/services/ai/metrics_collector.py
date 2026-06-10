"""
LLM 调用指标收集器 — 内存环形缓冲区

记录每次 LLM 调用的快照（延迟/Token/错误/回退等），
提供滑动窗口聚合统计（成功率/P50-P99 延迟/按 Provider 分组）。

用法:
    from app.services.ai.metrics_collector import get_metrics, LLMMetricsSnapshot

    metrics = get_metrics()
    await metrics.record(LLMMetricsSnapshot(
        timestamp=time.monotonic(),
        provider="openai",
        model="gpt-4o-mini",
        task_type="chat",
        success=True,
        latency_ms=320,
        tokens_used=150,
    ))
    summary = metrics.get_summary(window_seconds=300)
"""
from __future__ import annotations

import logging
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════
# 数据模型
# ══════════════════════════════════════════════


@dataclass
class LLMMetricsSnapshot:
    """单次 LLM 调用指标快照"""

    timestamp: float
    provider: str
    model: str
    task_type: str  # chat / generate / optimize / recommend
    success: bool
    latency_ms: float
    tokens_used: int = 0
    error_code: Optional[str] = None
    fallback_used: bool = False
    fallback_from: Optional[str] = None


# ══════════════════════════════════════════════
# 指标收集器
# ══════════════════════════════════════════════


class MetricsCollector:
    """LLM 调用指标收集器 — 内存环形缓冲区 + 异步锁保护"""

    def __init__(self, max_history: int = 1000):
        self.history: deque[LLMMetricsSnapshot] = deque(maxlen=max_history)
        self._lock: Optional[Any] = None  # lazy init for event loop independence

    def _get_lock(self) -> Any:
        """惰性获取 asyncio.Lock（避免模块加载时无事件循环的问题）"""
        if self._lock is None:
            import asyncio
            self._lock = asyncio.Lock()
        return self._lock

    async def record(self, snapshot: LLMMetricsSnapshot) -> None:
        """异步记录一条指标快照（线程安全）"""
        lock = self._get_lock()
        async with lock:
            self.history.append(snapshot)

    def record_sync(self, snapshot: LLMMetricsSnapshot) -> None:
        """同步记录一条指标快照（用于非 async 上下文，如回调中）"""
        self.history.append(snapshot)

    def get_summary(self, window_seconds: int = 300) -> dict:
        """计算滑动窗口聚合指标

        Returns:
            包含以下字段的字典：
            - window_seconds: 窗口大小(秒)
            - total_calls: 总调用次数
            - success_rate: 成功率 (0~1)
            - error_rate: 错误率 (0~1)
            - latency_p50/p95/p99: 延迟百分位 (ms)
            - avg_latency_ms: 平均延迟 (ms)
            - tokens_total: Token 总消耗量
            - fallback_rate: 回退率 (0~1)
            - error_breakdown: {error_code: count}
            - provider_breakdown: {provider: {"count", "success_rate", "avg_latency"}}
        """
        now = time.monotonic()
        window = [s for s in self.history if now - s.timestamp < window_seconds]

        if not window:
            return self._empty_summary(window_seconds)

        total = len(window)
        successes = sum(1 for s in window if s.success)
        latencies = sorted(s.latency_ms for s in window)

        p50_idx = int(total * 0.5)
        p95_idx = min(int(total * 0.95), total - 1)
        p99_idx = min(int(total * 0.99), total - 1)

        return {
            "window_seconds": window_seconds,
            "total_calls": total,
            "success_rate": round(successes / total, 4),
            "error_rate": round((total - successes) / total, 4),
            "latency_p50": latencies[p50_idx],
            "latency_p95": latencies[p95_idx],
            "latency_p99": latencies[p99_idx],
            "avg_latency_ms": round(sum(latencies) / total, 1),
            "tokens_total": sum(s.tokens_used for s in window),
            "fallback_rate": round(
                sum(1 for s in window if s.fallback_used) / total,
                4,
            ),
            "error_breakdown": self._count_errors(window),
            "provider_breakdown": self._count_by_provider(window),
        }

    def _empty_summary(self, window_seconds: int) -> dict:
        """返回空窗口的默认值"""
        return {
            "window_seconds": window_seconds,
            "total_calls": 0,
            "success_rate": 0.0,
            "error_rate": 0.0,
            "latency_p50": 0,
            "latency_p95": 0,
            "latency_p99": 0,
            "avg_latency_ms": 0.0,
            "tokens_total": 0,
            "fallback_rate": 0.0,
            "error_breakdown": {},
            "provider_breakdown": {},
        }

    @staticmethod
    def _count_errors(window: list[LLMMetricsSnapshot]) -> dict:
        """按 error_code 分组计数"""
        result: dict[str, int] = {}
        for s in window:
            if not s.success and s.error_code:
                code = s.error_code
                result[code] = result.get(code, 0) + 1
        return result

    @staticmethod
    def _count_by_provider(window: list[LLMMetricsSnapshot]) -> dict:
        """按 provider 分组统计成功率和平均延迟"""
        groups: dict[str, list[LLMMetricsSnapshot]] = {}
        for s in window:
            groups.setdefault(s.provider, []).append(s)

        result: dict[str, dict] = {}
        for provider, snapshots in groups.items():
            count = len(snapshots)
            successes = sum(1 for s in snapshots if s.success)
            avg_lat = sum(s.latency_ms for s in snapshots) / count
            result[provider] = {
                "count": count,
                "success_rate": round(successes / count, 4),
                "avg_latency_ms": round(avg_lat, 1),
            }
        return result


# ══════════════════════════════════════════════
# 全局单例
# ══════════════════════════════════════════════

_metrics = MetricsCollector()


def get_metrics() -> MetricsCollector:
    """获取全局 MetricsCollector 单例"""
    return _metrics

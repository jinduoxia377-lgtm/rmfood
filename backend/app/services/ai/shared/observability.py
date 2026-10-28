"""
AI 服务可观测性 (v1.0)

集成 OpenTelemetry 追踪和性能指标采集：
- LLM 调用延迟追踪
- Token 消耗统计
- RAG 检索命中率
- 错误率监控
"""

import asyncio
import logging
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class AIMetrics:
    """AI 服务指标"""
    # LLM 调用
    llm_calls: int = 0
    llm_errors: int = 0
    llm_total_tokens: int = 0
    llm_avg_latency_ms: float = 0

    # RAG
    rag_queries: int = 0
    rag_hits: int = 0
    rag_avg_latency_ms: float = 0

    # 安全
    safety_checks: int = 0
    safety_failures: int = 0

    # 生成
    formulas_generated: int = 0
    safety_pass_rate: float = 0


class AIObservable:
    """AI 服务可观测性管理器"""

    def __init__(self):
        self._metrics = AIMetrics()
        self._latencies: dict[str, list[float]] = defaultdict(list)
        self._lock = asyncio.Lock()

    def track_call(self, name: str, latency_ms: float, tokens: int = 0, error: bool = False):
        """追踪一次 AI 调用"""
        self._latencies[name].append(latency_ms)

        if name == "llm":
            self._metrics.llm_calls += 1
            self._metrics.llm_total_tokens += tokens
            if error:
                self._metrics.llm_errors += 1
            else:
                latencies = self._latencies["llm"]
                self._metrics.llm_avg_latency_ms = sum(latencies) / len(latencies)

        elif name == "rag":
            self._metrics.rag_queries += 1
            if not error:
                self._metrics.rag_hits += 1
            latencies = self._latencies["rag"]
            self._metrics.rag_avg_latency_ms = sum(latencies) / len(latencies) if latencies else 0

        elif name == "safety":
            self._metrics.safety_checks += 1
            if error:
                self._metrics.safety_failures += 1

    def record_formula_generated(self):
        """记录配方生成"""
        self._metrics.formulas_generated += 1

    def get_metrics(self) -> dict[str, Any]:
        """获取当前指标"""
        return {
            "llm": {
                "calls": self._metrics.llm_calls,
                "errors": self._metrics.llm_errors,
                "error_rate": round(self._metrics.llm_errors / max(1, self._metrics.llm_calls), 3),
                "total_tokens": self._metrics.llm_total_tokens,
                "avg_latency_ms": round(self._metrics.llm_avg_latency_ms, 1),
            },
            "rag": {
                "queries": self._metrics.rag_queries,
                "hits": self._metrics.rag_hits,
                "hit_rate": round(self._metrics.rag_hits / max(1, self._metrics.rag_queries), 3),
                "avg_latency_ms": round(self._metrics.rag_avg_latency_ms, 1),
            },
            "safety": {
                "checks": self._metrics.safety_checks,
                "failures": self._metrics.safety_failures,
                "pass_rate": round(
                    (self._metrics.safety_checks - self._metrics.safety_failures)
                    / max(1, self._metrics.safety_checks), 3
                ),
            },
            "formulas": {
                "generated": self._metrics.formulas_generated,
            },
        }

    def reset(self):
        """重置指标"""
        self._metrics = AIMetrics()
        self._latencies.clear()


# 全局单例
ai_observability = AIObservable()

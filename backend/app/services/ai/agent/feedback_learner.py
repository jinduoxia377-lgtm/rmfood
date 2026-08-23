"""
反馈学习机制

从历史执行中学习，优化 Agent 决策路径。
支持：
- 成功/失败模式记录
- 工具链成功率统计
- 自动降级策略
- 用户修正学习
"""
from __future__ import annotations

import hashlib
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class ExecutionPattern:
    """执行模式"""
    pattern_id: str
    query_hash: str
    tool_sequence: List[str]
    success_count: int = 0
    failure_count: int = 0
    avg_latency_ms: float = 0.0
    last_used: Optional[datetime] = None

    @property
    def success_rate(self) -> float:
        total = self.success_count + self.failure_count
        return self.success_count / total if total > 0 else 0.0


class FeedbackLearner:
    """
    从历史执行中学习的反馈学习器

    功能：
    1. 记录成功/失败的执行路径
    2. 分析工具调用序列的成功率
    3. 当某工具链连续失败时，自动降级到备选方案
    4. 用户修正后，更新工具参数权重
    """

    def __init__(self, max_patterns: int = 100):
        self._patterns: Dict[str, ExecutionPattern] = {}
        self._failure_streaks: Dict[str, int] = defaultdict(int)
        self._success_streaks: Dict[str, int] = defaultdict(int)
        self._max_patterns = max_patterns
        self._user_corrections: List[Dict[str, Any]] = []

    def record_execution(
        self,
        query: str,
        tool_sequence: List[str],
        success: bool,
        latency_ms: float,
        error: Optional[str] = None,
    ) -> None:
        """记录一次执行结果"""
        query_hash = self._hash_query(query)
        pattern_key = f"{query_hash}:{'->'.join(tool_sequence)}"

        if pattern_key not in self._patterns:
            self._patterns[pattern_key] = ExecutionPattern(
                pattern_id=pattern_key,
                query_hash=query_hash,
                tool_sequence=tool_sequence,
                last_used=datetime.now(timezone.utc),
            )

        pattern = self._patterns[pattern_key]
        pattern.last_used = datetime.now(timezone.utc)

        if success:
            pattern.success_count += 1
            self._success_streaks[pattern_key] += 1
            self._failure_streaks[pattern_key] = 0
        else:
            pattern.failure_count += 1
            self._failure_streaks[pattern_key] += 1
            self._success_streaks[pattern_key] = 0

        # 更新平均延迟
        total_calls = pattern.success_count + pattern.failure_count
        pattern.avg_latency_ms = (
            pattern.avg_latency_ms * (total_calls - 1) + latency_ms
        ) / total_calls

        # 清理旧模式
        if len(self._patterns) > self._max_patterns:
            self._evict_old_patterns()

        logger.info(
            "Pattern recorded: %s success=%s rate=%.2f streak=%d",
            pattern_key[:30], success, pattern.success_rate,
            self._failure_streaks[pattern_key],
        )

    def get_optimal_tool_chain(
        self,
        query: str,
        fallback_chains: Optional[List[List[str]]] = None,
    ) -> Tuple[List[str], str]:
        """
        基于历史数据推荐最优工具链

        Returns:
            (最佳工具链, 推荐理由)
        """
        query_hash = self._hash_query(query)

        # 查找相似查询的历史模式
        similar_patterns = [
            p for p in self._patterns.values()
            if p.query_hash == query_hash
        ]

        if similar_patterns:
            # 选择成功率最高的模式
            best = max(similar_patterns, key=lambda p: p.success_rate)
            if best.success_rate >= 0.7:
                return best.tool_sequence, f"历史成功率 {best.success_rate:.0%}"

        # 没有历史数据或成功率低，使用备选方案
        if fallback_chains:
            # 选择失败次数最少的备选链
            best_fallback = min(
                fallback_chains,
                key=lambda chain: self._failure_streaks.get(f"{query_hash}:{'->'.join(chain)}", 999),
            )
            return best_fallback, "使用备选工具链（无历史数据）"

        return [], "无可用的工具链"

    def record_user_correction(
        self,
        query: str,
        original_chain: List[str],
        corrected_chain: List[str],
        reason: str,
    ) -> None:
        """记录用户修正，更新学习权重"""
        self._user_corrections.append({
            "query_hash": self._hash_query(query),
            "original": original_chain,
            "corrected": corrected_chain,
            "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        # 降低原链的成功率权重
        orig_key = f"{self._hash_query(query)}:{'->'.join(original_chain)}"
        if orig_key in self._patterns:
            self._patterns[orig_key].failure_count += 2  # 惩罚原链

        # 提升修正链的成功率权重
        corrected_key = f"{self._hash_query(query)}:{'->'.join(corrected_chain)}"
        if corrected_key in self._patterns:
            self._patterns[corrected_key].success_count += 2
        else:
            self._patterns[corrected_key] = ExecutionPattern(
                pattern_id=corrected_key,
                query_hash=self._hash_query(query),
                tool_sequence=corrected_chain,
                success_count=2,
                last_used=datetime.now(timezone.utc),
            )

        logger.info("User correction recorded: %s → %s", original_chain, corrected_chain)

    def should_degrade(self, tool_name: str) -> bool:
        """检查是否应该降级到备选工具"""
        key = f"*:{tool_name}"
        streak = self._failure_streaks.get(key, 0)
        return streak >= 3  # 连续 3 次失败则降级

    def get_learning_stats(self) -> Dict[str, Any]:
        """获取学习统计"""
        total_patterns = len(self._patterns)
        avg_success_rate = (
            sum(p.success_rate for p in self._patterns.values()) / total_patterns
            if total_patterns > 0 else 0.0
        )
        top_patterns = sorted(
            self._patterns.values(),
            key=lambda p: p.success_rate,
            reverse=True,
        )[:5]

        return {
            "total_patterns": total_patterns,
            "avg_success_rate": round(avg_success_rate, 3),
            "user_corrections": len(self._user_corrections),
            "top_patterns": [
                {
                    "sequence": p.tool_sequence,
                    "success_rate": round(p.success_rate, 3),
                    "calls": p.success_count + p.failure_count,
                }
                for p in top_patterns
            ],
        }

    def _hash_query(self, query: str) -> str:
        """查询哈希（简化版，实际可使用语义相似度）"""
        return hashlib.md5(query.encode()).hexdigest()[:8]

    def _evict_old_patterns(self) -> None:
        """清理最旧的模式"""
        if len(self._patterns) <= self._max_patterns:
            return
        sorted_patterns = sorted(
            self._patterns.items(),
            key=lambda x: x[1].last_used or datetime.min.replace(tzinfo=timezone.utc),
        )
        # 保留最新的 max_patterns 个
        for key, _ in sorted_patterns[:len(self._patterns) - self._max_patterns]:
            del self._patterns[key]


# 全局单例
_learner: Optional[FeedbackLearner] = None


def get_feedback_learner() -> FeedbackLearner:
    """获取全局学习器单例"""
    global _learner
    if _learner is None:
        _learner = FeedbackLearner()
    return _learner

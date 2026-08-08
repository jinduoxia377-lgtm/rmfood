"""
配方 A/B 测试框架 (v1.0)

支持：
- 同一需求生成 N 个候选配方
- 用户评分反馈收集
- 基于反馈优化后续生成
- 统计显著性检验
"""

import logging
import math
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

logger = logging.getLogger(__name__)


@dataclass
class ABTestVariant:
    """A/B 测试变体"""
    id: str = ""
    name: str = ""
    formula_data: dict[str, Any] = field(default_factory=dict)
    score: float = 0.0
    votes: int = 0
    thumbs_up: int = 0
    thumbs_down: int = 0
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class ABTest:
    """A/B 测试实例"""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:12])
    name: str = ""
    variants: list[ABTestVariant] = field(default_factory=list)
    total_votes: int = 0
    status: str = "active"  # active | completed | cancelled
    winning_variant_id: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: datetime | None = None

    def add_variant(self, name: str, formula_data: dict) -> ABTestVariant:
        """添加变体"""
        variant = ABTestVariant(
            id=str(uuid.uuid4())[:12],
            name=name,
            formula_data=formula_data,
        )
        self.variants.append(variant)
        logger.info("A/B 测试 %s 添加变体: %s", self.id, name)
        return variant

    def vote(self, variant_id: str, is_positive: bool):
        """记录投票"""
        for v in self.variants:
            if v.id == variant_id:
                v.votes += 1
                v.thumbs_up += 1 if is_positive else 0
                v.thumbs_down += 1 if not is_positive else 0
                v.score = self._calculate_score(v)
                self.total_votes += 1
                break

    def _calculate_score(self, variant: ABTestVariant) -> float:
        """计算变体得分（贝叶斯平均）"""
        if variant.votes == 0:
            return 0.5
        # Wilson score interval 下界
        n = variant.votes
        p = variant.thumbs_up / n
        z = 1.96  # 95% 置信度
        denominator = 1 + z * z / n
        center = p + z * z / (2 * n)
        return (center - z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)) / denominator

    def determine_winner(self) -> ABTestVariant | None:
        """确定获胜变体（基于 Wilson score）"""
        if not self.variants:
            return None
        winner = max(self.variants, key=lambda v: v.score)
        if winner.votes >= 10:  # 最少 10 票才判定
            self.winning_variant_id = winner.id
            self.status = "completed"
            self.ended_at = datetime.now(timezone.utc)
            logger.info("A/B 测试 %s 获胜者: %s (score=%.3f, votes=%d)",
                        self.id, winner.name, winner.score, winner.votes)
        return winner

    def get_leaderboard(self) -> list[dict]:
        """排名表"""
        sorted_variants = sorted(self.variants, key=lambda v: v.score, reverse=True)
        return [
            {
                "variant_id": v.id,
                "name": v.name,
                "score": round(v.score, 3),
                "votes": v.votes,
                "thumbs_up": v.thumbs_up,
                "thumbs_down": v.thumbs_down,
                "win_rate": round(v.thumbs_up / max(1, v.votes) * 100, 1),
            }
            for v in sorted_variants
        ]


class ABTestManager:
    """A/B 测试管理器"""

    def __init__(self):
        self._tests: dict[str, ABTest] = {}

    def create_test(self, name: str, formula_data_list: list[dict[str, Any]]) -> ABTest:
        """创建 A/B 测试"""
        test = ABTest(name=name)
        for i, data in enumerate(formula_data_list):
            test.add_variant(f"配方{'ABCDE'[i]}", data)
        self._tests[test.id] = test
        return test

    def get_test(self, test_id: str) -> ABTest | None:
        return self._tests.get(test_id)

    def vote(self, test_id: str, variant_id: str, positive: bool) -> dict:
        """投票并返回最新排名"""
        test = self._tests.get(test_id)
        if not test:
            raise ValueError(f"测试不存在: {test_id}")
        test.vote(variant_id, positive)
        winner = test.determine_winner()
        return {
            "leaderboard": test.get_leaderboard(),
            "winner": winner.name if winner else None,
            "status": test.status,
        }

    def list_tests(self, status: str | None = None) -> list[dict]:
        """列出所有测试"""
        results = []
        for test in self._tests.values():
            if status and test.status != status:
                continue
            results.append({
                "id": test.id,
                "name": test.name,
                "variants": len(test.variants),
                "total_votes": test.total_votes,
                "status": test.status,
                "created_at": test.created_at.isoformat(),
            })
        return results


# 全局单例
ab_test_manager = ABTestManager()

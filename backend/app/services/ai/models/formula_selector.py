"""配方选择器 — 多策略配方优选

支持三种选择策略：
1. Lexicographic（优先级逐级优化）
2. Weighted Sum（加权组合）
3. ε-Constraint（约束优化）
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class SelectionPriority:
    """单个优先级的选择规则"""
    objective: str           # 优化目标名称
    direction: str           # "maximize" | "minimize"
    weight: float = 1.0      # 权重（加权模式下使用）
    threshold: Optional[float] = None  # ε-约束阈值
    tolerance: float = 0.05  # 容差


class FormulaSelector:
    """
    配方选择器

    核心创新：优先级逐级优化（Lexicographic Optimization）
    与传统多目标优化的区别：
    - 传统：加权求和，权重敏感
    - 专利：按优先级严格排序，高优先级目标优先满足
    """

    def __init__(
        self,
        priorities: Optional[List[SelectionPriority]] = None,
        strategy: str = "lexicographic",
    ):
        self.priorities = priorities or self._default_priorities()
        self.strategy = strategy

    @staticmethod
    def _default_priorities() -> List[SelectionPriority]:
        """默认优先级配置（中医配方场景）"""
        return [
            SelectionPriority("efficacy", "maximize", weight=0.30),
            SelectionPriority("safety", "maximize", weight=0.25),
            SelectionPriority("taste", "maximize", weight=0.10),
            SelectionPriority("cost_score", "maximize", weight=0.15),
            SelectionPriority("synergy", "maximize", weight=0.10),
            SelectionPriority("stability", "maximize", weight=0.10),
        ]

    def select(
        self,
        candidates: List[Dict],
        target_effects: Optional[List[str]] = None,
        constraints: Optional[Dict] = None,
        top_k: int = 3,
    ) -> List[Dict]:
        """
        选择最优配方

        Args:
            candidates: 候选配方列表（每个包含评分字段）
            target_effects: 目标功效
            constraints: 约束条件
            top_k: 返回 Top-K

        Returns:
            选中的配方（Top-K）
        """
        if not candidates:
            return []

        if self.strategy == "lexicographic":
            selected = self._select_lexicographic(candidates)
        elif self.strategy == "weighted":
            selected = self._select_weighted(candidates)
        elif self.strategy == "epsilon":
            selected = self._select_epsilon(candidates, constraints or {})
        else:
            selected = self._select_lexicographic(candidates)

        return selected[:top_k]

    def _select_lexicographic(self, candidates: List[Dict]) -> List[Dict]:
        """
        优先级逐级优化

        1. 按第一优先级排序，选出帕累托最优子集
        2. 在第一优先级相同的前提下，按第二优先级排序
        3. 依此类推
        """
        if not candidates:
            return []

        sorted_candidates = list(candidates)

        for priority in self.priorities:
            if len(sorted_candidates) <= 1:
                break

            key = priority.objective
            reverse = priority.direction == "maximize"
            sorted_candidates.sort(
                key=lambda c: c.get(key, 0),
                reverse=reverse,
            )

            # 找出第一优先级相同的最优子集（容差内）
            best_value = sorted_candidates[0].get(key, 0)
            tol = priority.threshold or (best_value * priority.tolerance if best_value > 0 else 0.05)
            sorted_candidates = [
                c for c in sorted_candidates
                if abs(c.get(key, 0) - best_value) <= tol
            ]

        return sorted_candidates

    def _select_weighted(self, candidates: List[Dict]) -> List[Dict]:
        """加权组合选择"""
        for c in candidates:
            c["_weighted_score"] = sum(
                p.weight * c.get(p.objective, 0)
                for p in self.priorities
            )
        sorted_candidates = sorted(
            candidates,
            key=lambda c: c.get("_weighted_score", 0),
            reverse=True,
        )
        # 清理临时字段
        for c in sorted_candidates:
            c.pop("_weighted_score", None)
        return sorted_candidates

    def _select_epsilon(
        self, candidates: List[Dict], constraints: Dict
    ) -> List[Dict]:
        """ε-约束法"""
        feasible = []
        for c in candidates:
            valid = True
            for key, threshold in constraints.items():
                if key in c:
                    if isinstance(threshold, dict):
                        if threshold.get("min") and c[key] < threshold["min"]:
                            valid = False
                            break
                        if threshold.get("max") and c[key] > threshold["max"]:
                            valid = False
                            break
                    elif isinstance(threshold, (int, float)):
                        # 直接作为上限
                        if c[key] > threshold:
                            valid = False
                            break
            if valid:
                feasible.append(c)

        if not feasible:
            return candidates[:3]

        return self._select_lexicographic(feasible)

    def rank_candidates(
        self, candidates: List[Dict]
    ) -> List[Dict]:
        """对所有候选排序（不截断）"""
        return self._select_lexicographic(candidates)


# 全局单例
_selector: Optional[FormulaSelector] = None


def get_formula_selector(strategy: str = "lexicographic") -> FormulaSelector:
    global _selector
    if _selector is None:
        _selector = FormulaSelector(strategy=strategy)
    return _selector

"""配方来源判别器 — 判断配方是 AI 生成还是来自市场现有产品

核心目标：
- 确保生成配方不是对现有产品的简单复制
- 为 RL 奖励函数提供"新颖性"信号
- 基于成分组合分布的统计判别
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class DiscriminationResult:
    """判别结果"""
    is_real: float           # 概率：属于"真实市场产品"
    is_generated: float      # 概率：属于"AI 生成"
    novelty_score: float     # 新颖性得分 (0~1，越高越新颖)
    confidence: float        # 判别置信度


class FormulaDiscriminator:
    """
    配方来源判别器

    基于成分组合的统计分布进行判别：
    - 真实市场配方：成分选择有特定模式（常见药材 + 固定配比）
    - AI 生成配方：成分组合更多样，分布更均匀

    采用简化统计模型，避免引入 PyTorch 依赖：
    - 成分频率统计：市场常见药材高频出现
    - 组合熵：AI 生成配方组合熵更高
    - 配伍模式：市场配方遵循经典配伍，AI 可能偏离
    """

    def __init__(
        self,
        market_formulas: Optional[List[Dict]] = None,
    ):
        """
        Args:
            market_formulas: 市场现有配方库（用于统计学习）
        """
        self.market_herb_freq: Dict[str, float] = {}
        self.market_pair_freq: Dict[frozenset, float] = {}
        self._initialized = False
        self._market_size = 0

        if market_formulas:
            self._train(market_formulas)

    def _train(self, market_formulas: List[Dict]) -> None:
        """从市场配方库学习统计分布"""
        herb_counts: Dict[str, int] = {}
        pair_counts: Dict[frozenset, int] = {}

        for formula in market_formulas:
            herbs = list(formula.keys())
            self._market_size += 1

            for herb in herbs:
                herb_counts[herb] = herb_counts.get(herb, 0) + 1

            for i in range(len(herbs)):
                for j in range(i + 1, len(herbs)):
                    pair = frozenset([herbs[i], herbs[j]])
                    pair_counts[pair] = pair_counts.get(pair, 0) + 1

        # 归一化为频率
        total = self._market_size
        self.market_herb_freq = {
            h: c / total for h, c in herb_counts.items()
        }
        total_pairs = sum(pair_counts.values()) or 1
        self.market_pair_freq = {
            p: c / total_pairs for p, c in pair_counts.items()
        }
        self._initialized = True
        logger.info(
            f"[Discriminator] 训练完成: {self._market_size} 个市场配方, "
            f"{len(self.market_herb_freq)} 种药材"
        )

    def discriminate(
        self,
        formula: Dict[str, float],
    ) -> DiscriminationResult:
        """
        判别配方来源

        Args:
            formula: {herb_id: dosage_g}

        Returns:
            DiscriminationResult
        """
        if not formula:
            return DiscriminationResult(0.5, 0.5, 0.5, 0.3)

        # 1. 成分频率得分（市场常见药材得分高）
        herb_score = self._herb_frequency_score(formula)

        # 2. 组合熵（AI 生成配方熵更高）
        entropy_score = self._combination_entropy_score(formula)

        # 3. 配伍模式得分
        pair_score = self._pair_pattern_score(formula)

        # 综合判别
        # is_real = 高频率 + 低熵 + 经典配伍
        is_real_score = (
            herb_score * 0.35 +
            (1.0 - entropy_score) * 0.30 +
            pair_score * 0.35
        )

        is_generated = 1.0 - is_real_score
        novelty = is_generated * 0.6 + entropy_score * 0.4

        confidence = abs(is_real_score - 0.5) * 2  # 距离 0.5 越远越自信

        return DiscriminationResult(
            is_real=max(0.0, min(1.0, is_real_score)),
            is_generated=max(0.0, min(1.0, is_generated)),
            novelty_score=max(0.0, min(1.0, novelty)),
            confidence=max(0.0, min(1.0, confidence)),
        )

    def _herb_frequency_score(self, formula: Dict[str, float]) -> float:
        """成分频率得分：市场常见药材比例"""
        if not self._initialized:
            return 0.5  # 无训练数据，返回中性

        total_dosage = sum(formula.values()) or 1
        freq_score = 0.0
        for herb, dosage in formula.items():
            freq = self.market_herb_freq.get(herb, 0.1)
            freq_score += freq * (dosage / total_dosage)

        return max(0.0, min(1.0, freq_score))

    def _combination_entropy_score(self, formula: Dict[str, float]) -> float:
        """组合熵得分：成分分布的熵值（越高越"AI"）"""
        if not formula:
            return 0.5

        total = sum(formula.values())
        probs = [d / total for d in formula.values()]

        # Shannon 熵
        entropy = -sum(p * self._log2(p) for p in probs if p > 0)

        # 最大熵 = log2(n)
        max_entropy = self._log2(len(formula)) or 1.0

        # 归一化熵
        normalized = entropy / max_entropy
        return max(0.0, min(1.0, normalized))

    def _pair_pattern_score(self, formula: Dict[str, float]) -> float:
        """配伍模式得分：经典配伍比例"""
        if not self._initialized or len(formula) < 2:
            return 0.5

        herb_ids = list(formula.keys())
        classic_pairs = 0
        total_pairs = 0

        for i in range(len(herb_ids)):
            for j in range(i + 1, len(herb_ids)):
                pair = frozenset([herb_ids[i], herb_ids[j]])
                total_pairs += 1
                if pair in self.market_pair_freq:
                    classic_pairs += 1

        return classic_pairs / max(total_pairs, 1)

    @staticmethod
    def _log2(x: float) -> float:
        import math
        return math.log2(x) if x > 0 else 0.0

    def update_with_new_formula(self, formula: Dict[str, float]) -> None:
        """增量更新市场配方库（可选）"""
        if not self._initialized:
            return
        herbs = list(formula.keys())
        self._market_size += 1
        for herb in herbs:
            self.market_herb_freq[herb] = (
                self.market_herb_freq.get(herb, 0) * (self._market_size - 1) / self._market_size
                + 1.0 / self._market_size
            )
        for i in range(len(herbs)):
            for j in range(i + 1, len(herbs)):
                pair = frozenset([herbs[i], herbs[j]])
                self.market_pair_freq[pair] = (
                    self.market_pair_freq.get(pair, 0) * (self._market_size - 1) / self._market_size
                    + 1.0 / self._market_size
                )


# 全局单例
_discriminator: Optional[FormulaDiscriminator] = None


def get_formula_discriminator(
    market_formulas: Optional[List[Dict]] = None,
) -> FormulaDiscriminator:
    global _discriminator
    if _discriminator is None:
        _discriminator = FormulaDiscriminator(market_formulas=market_formulas)
    return _discriminator

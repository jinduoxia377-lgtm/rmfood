"""
收敛性分析与科学早停模块

提供严格的数学收敛性判据，替代简单的"连续N代无改进"启发式规则：

1. 种群熵（Population Entropy）早停
   - 当种群信息熵下降到阈值，说明多样性耗尽
   - H = -Σ p_i * log(p_i)，p_i为个体适应度占比

2. 期望改进（Expected Improvement）早停
   - 计算新一代相对于当前最优的期望改进值
   - 当E[I] < ε时，认为搜索已收敛

3. 收敛速率分析
   - 拟合适应度-代数曲线，估计收敛斜率
   - 当斜率<阈值时认为收敛

4. 统计显著性检验
   - Wilcoxon符号秩检验：判断近期改进是否统计显著
   - p-value < 0.05则认为有显著改进

@version 1.0.0
"""

import logging
import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ============================================================
# 数据类定义
# ============================================================

@dataclass
class ConvergenceMetrics:
    """收敛性指标"""
    generation: int
    population_entropy: float  # 种群熵
    expected_improvement: float  # 期望改进值
    convergence_rate: float  # 收敛速率
    wilcoxon_p_value: Optional[float]  # Wilcoxon检验p值
    is_converged: bool  # 是否收敛
    stop_reason: str  # 停止原因


@dataclass
class ConvergenceConfig:
    """收敛性分析配置"""
    entropy_threshold: float = 0.01  # 种群熵阈值
    ei_threshold: float = 1e-6  # 期望改进阈值
    convergence_rate_threshold: float = 1e-4  # 收敛速率阈值
    wilcoxon_window: int = 10  # Wilcoxon检验窗口大小
    min_generations: int = 20  # 最少进化代数（避免过早停止）


# ============================================================
# 收敛性分析器
# ============================================================

class ConvergenceAnalyzer:
    """
    收敛性分析器

    使用多种数学准则判断GA/NSGA算法是否收敛
    """

    def __init__(self, config: Optional[ConvergenceConfig] = None):
        self.config = config or ConvergenceConfig()
        self._fitness_history: List[float] = []
        self._best_history: List[float] = []

    def analyze(
        self,
        current_fitness: float,
        population_fitnesses: List[float],
        generation: int,
    ) -> ConvergenceMetrics:
        """
        分析当前代的收敛性

        Args:
            current_fitness: 当前代最优适应度
            population_fitnesses: 当前种群所有个体适应度
            generation: 当前代数

        Returns:
            ConvergenceMetrics: 收敛性指标
        """
        self._best_history.append(current_fitness)

        # 1. 种群熵计算
        entropy = self._calculate_population_entropy(population_fitnesses)

        # 2. 期望改进计算
        ei = self._calculate_expected_improvement(current_fitness)

        # 3. 收敛速率
        conv_rate = self._calculate_convergence_rate()

        # 4. Wilcoxon检验
        p_value = self._wilcoxon_sign_rank_test()

        # 5. 综合判断
        is_converged = self._check_convergence(
            entropy, ei, conv_rate, p_value, generation
        )

        stop_reason = self._get_stop_reason(
            entropy, ei, conv_rate, p_value, is_converged
        )

        metrics = ConvergenceMetrics(
            generation=generation,
            population_entropy=entropy,
            expected_improvement=ei,
            convergence_rate=conv_rate,
            wilcoxon_p_value=p_value,
            is_converged=is_converged,
            stop_reason=stop_reason,
        )

        if is_converged:
            logger.info(
                f"[Convergence] 第{generation}代收敛: "
                f"entropy={entropy:.6f}, EI={ei:.2e}, "
                f"rate={conv_rate:.2e}, p={p_value}"
            )

        return metrics

    def _calculate_population_entropy(
        self,
        fitnesses: List[float]
    ) -> float:
        """
        计算种群熵（信息论度量）

        H = -Σ p_i * log(p_i)
        其中 p_i = fitness_i / Σ fitness_j

        熵越高表示种群多样性越好
        熵接近0表示种群趋同
        """
        if not fitnesses:
            return 0.0

        total = sum(fitnesses)
        if total <= 0:
            return 0.0

        # 计算概率分布
        probabilities = [f / total for f in fitnesses if f > 0]

        # 计算熵
        entropy = 0.0
        for p in probabilities:
            if p > 0:
                entropy -= p * math.log(p)

        # 归一化到[0,1]
        max_entropy = math.log(len(probabilities)) if len(probabilities) > 1 else 1.0
        normalized_entropy = entropy / max_entropy if max_entropy > 0 else 0.0

        return normalized_entropy

    def _calculate_expected_improvement(
        self,
        current_best: float
    ) -> float:
        """
        计算期望改进值（Expected Improvement）

        EI = E[max(f_new - f_best, 0)]

        使用历史最佳值的改进幅度估计
        """
        if len(self._best_history) < 2:
            return float('inf')

        recent = self._best_history[-min(5, len(self._best_history)):]
        improvements = [
            recent[i] - recent[i-1]
            for i in range(1, len(recent))
        ]

        if not improvements:
            return 0.0

        # 平均改进
        avg_improvement = sum(improvements) / len(improvements)

        # 改进的标准差
        if len(improvements) > 1:
            mean = avg_improvement
            variance = sum((x - mean) ** 2 for x in improvements) / len(improvements)
            std = math.sqrt(variance)
        else:
            std = 0.0

        # 简化的EI估计
        ei = max(0, avg_improvement) + 0.5 * std

        return ei

    def _calculate_convergence_rate(self) -> float:
        """
        计算收敛速率

        通过拟合最近几代最佳适应度的变化率
        """
        if len(self._best_history) < 5:
            return float('inf')

        recent = self._best_history[-10:]  # 最近10代

        # 计算相邻代的差异
        diffs = [
            abs(recent[i] - recent[i-1])
            for i in range(1, len(recent))
        ]

        # 平均差异作为收敛速率
        if diffs:
            return sum(diffs) / len(diffs)
        return 0.0

    def _wilcoxon_sign_rank_test(
        self,
        alpha: float = 0.05
    ) -> Optional[float]:
        """
        Wilcoxon符号秩检验（简化实现）

        检验最近两段时间的改进是否有统计显著差异

        Returns:
            p-value，如果数据不足则返回None
        """
        if len(self._best_history) < self.config.wilcoxon_window * 2:
            return None

        window = self.config.wilcoxon_window
        recent = self._best_history[-window:]
        older = self._best_history[-window*2:-window]

        # 计算差异
        diffs = [r - o for r, o in zip(recent, older)]

        # 非零差异
        non_zero = [d for d in diffs if d != 0]
        if not non_zero:
            return 1.0

        # 符号秩
        abs_diffs = [abs(d) for d in non_zero]
        sorted_indices = sorted(range(len(abs_diffs)), key=lambda i: abs_diffs[i])
        ranks = [0] * len(abs_diffs)
        for rank, idx in enumerate(sorted_indices, 1):
            ranks[idx] = rank

        # 正负秩和
        pos_ranks = sum(
            ranks[i] for i in range(len(ranks))
            if non_zero[i] > 0
        )
        neg_ranks = sum(
            ranks[i] for i in range(len(ranks))
            if non_zero[i] < 0
        )

        # 检验统计量
        W = min(pos_ranks, neg_ranks)
        n = len(non_zero)

        # 大样本近似（n > 10）
        if n > 10:
            mu = n * (n + 1) / 4
            sigma = math.sqrt(n * (n + 1) * (2 * n + 1) / 24)
            z = (W - mu) / sigma if sigma > 0 else 0
            # 简化的p-value估计
            p_value = 2 * (1 - self._normal_cdf(abs(z)))
        else:
            # 小样本：返回None表示不显著
            p_value = None

        return p_value

    @staticmethod
    def _normal_cdf(x: float) -> float:
        """标准正态分布CDF近似"""
        return 0.5 * (1 + math.erf(x / math.sqrt(2)))

    def _check_convergence(
        self,
        entropy: float,
        ei: float,
        conv_rate: float,
        p_value: Optional[float],
        generation: int,
    ) -> bool:
        """
        综合判断是否收敛

        多个准则同时满足时才认为收敛
        """
        # 最少代数检查
        if generation < self.config.min_generations:
            return False

        # 准则1: 种群熵低于阈值
        entropy_converged = entropy < self.config.entropy_threshold

        # 准则2: 期望改进低于阈值
        ei_converged = ei < self.config.ei_threshold if ei != float('inf') else False

        # 准则3: 收敛速率低于阈值
        rate_converged = conv_rate < self.config.convergence_rate_threshold

        # 准则4: Wilcoxon检验不显著（p > alpha或None）
        if p_value is not None:
            wilcoxon_converged = p_value > 0.05
        else:
            wilcoxon_converged = True  # 数据不足时不考虑

        # 至少3个准则满足
        satisfied = sum([
            entropy_converged,
            ei_converged,
            rate_converged,
            wilcoxon_converged,
        ])

        return satisfied >= 3

    def _get_stop_reason(
        self,
        entropy: float,
        ei: float,
        conv_rate: float,
        p_value: Optional[float],
        is_converged: bool,
    ) -> str:
        """获取停止原因"""
        if not is_converged:
            return "not_converged"

        reasons = []
        if entropy < self.config.entropy_threshold:
            reasons.append("low_entropy")
        if ei < self.config.ei_threshold:
            reasons.append("low_ei")
        if conv_rate < self.config.convergence_rate_threshold:
            reasons.append("slow_convergence")
        if p_value is not None and p_value > 0.05:
            reasons.append("not_significant")

        return "+".join(reasons) if reasons else "multiple_criteria"

    def get_summary(self) -> Dict[str, Any]:
        """获取收敛性分析摘要"""
        return {
            "fitness_history_length": len(self._best_history),
            "current_best": self._best_history[-1] if self._best_history else 0.0,
            "config": {
                "entropy_threshold": self.config.entropy_threshold,
                "ei_threshold": self.config.ei_threshold,
                "convergence_rate_threshold": self.config.convergence_rate_threshold,
            },
        }


# ============================================================
# 模块级工具函数
# ============================================================

def calculate_shannon_entropy(proportions: List[float]) -> float:
    """
    计算Shannon熵

    H = -Σ p_i * log(p_i)

    Args:
        proportions: 概率分布

    Returns:
        熵值
    """
    entropy = 0.0
    for p in proportions:
        if p > 0:
            entropy -= p * math.log2(p)
    return entropy


def normalize_fitness(fitnesses: List[float]) -> List[float]:
    """
    归一化适应度到[0,1]

    用于计算概率分布
    """
    if not fitnesses:
        return []

    min_f = min(fitnesses)
    max_f = max(fitnesses)

    if max_f == min_f:
        return [1.0 / len(fitnesses)] * len(fitnesses)

    normalized = [(f - min_f) / (max_f - min_f) for f in fitnesses]
    total = sum(normalized)

    if total == 0:
        return [1.0 / len(normalized)] * len(normalized)

    return [f / total for f in normalized]


# 单例
_convergence_analyzer: Optional[ConvergenceAnalyzer] = None


def get_convergence_analyzer() -> ConvergenceAnalyzer:
    """获取收敛性分析器单例"""
    global _convergence_analyzer
    if _convergence_analyzer is None:
        _convergence_analyzer = ConvergenceAnalyzer()
    return _convergence_analyzer

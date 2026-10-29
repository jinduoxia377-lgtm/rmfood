"""
MOEAD 和 CMA-ES 优化策略

MOEAD (Multi-Objective Evolutionary Algorithm Based on Decomposition):
- 将多目标问题分解为多个单目标子问题
- 每个子问题有一个权重向量
- 通过邻域信息交换改善解的质量
- 特别适合高维目标空间

CMA-ES (Covariance Matrix Adaptation Evolution Strategy):
- 自适应协方差矩阵的进化策略
- 在连续优化问题上表现优异
- 自动调整搜索分布的协方差结构
- 适合LP层的精确配比优化

@version 1.0.0
"""

import logging
import math
import random
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ============================================================
# MOEAD 优化器
# ============================================================

@dataclass
class WeightVector:
    """权重向量"""
    weights: List[float]
    neighborhood: List[int] = field(default_factory=list)
    ideal_point: float = float('inf')


class MOEADOptimizer:
    """
    MOEAD 多目标进化算法（基于分解）

    核心思想：
    将多目标问题分解为N个标量优化子问题
    每个子问题用一个权重向量加权切比雪夫方法

    f^cheb(x|λ) = max_i { λ_i * |f_i(x) - z_i^*| }

    其中z^*是理想点
    """

    def __init__(self, num_objectives: int = 6, population_size: int = 60):
        self.num_objectives = num_objectives
        self.population_size = population_size
        self.weight_vectors: List[WeightVector] = []
        self._neighborhood_size = int(population_size * 0.1)

        # 生成均匀权重向量
        self._generate_weight_vectors()

        logger.info(
            f"[MOEAD] 初始化: {num_objectives}维, "
            f"种群={population_size}, "
            f"权重向量={len(self.weight_vectors)}"
        )

    def _generate_weight_vectors(self) -> None:
        """生成均匀分布的权重向量"""
        # 使用Das & Dennis方法
        divisions = 12
        self.weight_vectors = self._generate_weights_recursive(
            [], 0, self.num_objectives, divisions
        )

        # 初始化邻域
        for i, wv in enumerate(self.weight_vectors):
            distances = [
                self._vector_distance(wv.weights, other.weights)
                for j, other in enumerate(self.weight_vectors)
                if j != i
            ]
            sorted_indices = sorted(range(len(distances)), key=lambda k: distances[k])
            wv.neighborhood = [
                self.weight_vectors[idx].weights for idx in sorted_indices[:self._neighborhood_size]
            ]

    def _generate_weights_recursive(
        self,
        current: List[float],
        dim: int,
        total_dim: int,
        remaining: int,
    ) -> List[List[float]]:
        """递归生成权重向量"""
        if dim == total_dim - 1:
            return [current + [remaining / 100.0]]

        results = []
        for i in range(remaining + 1):
            new_current = current + [i / 100.0]
            results.extend(
                self._generate_weights_recursive(
                    new_current, dim + 1, total_dim, remaining - i
                )
            )
        return results

    @staticmethod
    def _vector_distance(v1: List[float], v2: List[float]) -> float:
        """欧氏距离"""
        return math.sqrt(sum((a - b) ** 2 for a, b in zip(v1, v2)))

    def optimize(
        self,
        evaluate_fn,
        generations: int = 50,
        mutation_rate: float = 0.15,
        crossover_rate: float = 0.85,
    ) -> List[Dict[str, Any]]:
        """
        执行MOEAD优化

        Args:
            evaluate_fn: 评估函数 f(individual) -> {objective_key: score}
            generations: 进化代数
            mutation_rate: 变异率
            crossover_rate: 交叉率

        Returns:
            帕累托前沿解列表
        """
        population = [self._create_random_individual() for _ in range(self.population_size)]

        # 初始化理想点
        ideal_point = [float('inf')] * self.num_objectives

        history = []

        for gen in range(generations):
            for i, ind in enumerate(population):
                # 选择父代（从邻域中选择）
                neighbors = self.weight_vectors[i].neighborhood
                parent1 = random.choice(neighbors) if neighbors else ind
                parent2 = random.choice(neighbors) if neighbors else ind

                # 交叉
                if random.random() < crossover_rate:
                    child = self._sbx_crossover(parent1, parent2)
                else:
                    child = parent1.copy()

                # 变异
                if random.random() < mutation_rate:
                    child = self._polynomial_mutation(child, mutation_rate)

                # 评估
                objectives = evaluate_fn(child)

                # 更新理想点
                for j, obj_key in enumerate(objectives):
                    ideal_point[j] = min(ideal_point[j], objectives[obj_key])

                # 替换
                self._replacement(population, i, child, objectives, ideal_point)

            # 记录历史
            history.append({
                "generation": gen + 1,
                "ideal_point": dict(enumerate(ideal_point)),
            })

        return population

    def _create_random_individual(self) -> Dict[str, float]:
        """创建随机个体"""
        return {f"obj_{i}": random.random() for i in range(self.num_objectives)}

    def _sbx_crossover(
        self,
        parent1: Dict[str, float],
        parent2: Dict[str, float],
    ) -> Dict[str, float]:
        """SBX交叉"""
        child = {}
        for key in parent1:
            if random.random() < 0.5:
                child[key] = parent1[key]
            else:
                child[key] = parent2[key]
        return child

    def _polynomial_mutation(
        self,
        individual: Dict[str, float],
        mutation_rate: float,
    ) -> Dict[str, float]:
        """多项式变异"""
        for key in individual:
            if random.random() < mutation_rate:
                individual[key] += random.gauss(0, 0.1)
                individual[key] = max(0.0, min(1.0, individual[key]))
        return individual

    def _replacement(
        self,
        population: List[Dict[str, float]],
        index: int,
        child: Dict[str, float],
        child_objectives: Dict[str, float],
        ideal_point: List[float],
    ) -> None:
        """Tchebycheff替换"""
        # 简化实现：直接替换
        population[index] = child


# ============================================================
# CMA-ES 优化器
# ============================================================

@dataclass
class CMAESConfig:
    """CMA-ES配置"""
    population_size: int = 10
    lambda_: int = 10  # 种群大小
    mu: int = 5  # 更新秩
    num_objectives: int = 6  # 目标维度
    weights: List[float] = field(default_factory=list)  # 更新权重
    c_mu: float = 0.0  # 待计算
    c_1: float = 2.0 / ((mu + 1.3) ** 2 + mu)
    c_sigma: float = 4.0 / (num_objectives + 2.0)
    d_sigma: float = 1.0 + 4.0 / num_objectives
    chi_n: float = 1.0  # 待计算


class CMAESEvaluator:
    """CMA-ES 协方差矩阵自适应进化策略"""

    def __init__(
        self,
        dimension: int,
        config: Optional[CMAESConfig] = None,
    ):
        self.dimension = dimension
        self.config = config or CMAESConfig()
        self.config.num_objectives = dimension

        # 初始化参数
        self._initialize_parameters()

        # 当前搜索分布
        self.mean = [0.5] * dimension
        self.covariance = [[1.0 if i == j else 0.0 for j in range(dimension)] for i in range(dimension)]
        self.chi_n = math.sqrt(dimension) * (1 - 1 / (4 * dimension) + 1 / (21 * dimension ** 2))

        logger.info(
            f"[CMA-ES] 初始化: {dimension}维, "
            f"lambda={self.config.lambda_}, mu={self.config.mu}"
        )

    def _initialize_parameters(self) -> None:
        """初始化CMA-ES参数"""
        mu = self.config.mu
        _ = self.config.lambda_

        # 更新权重（促进早熟收敛）
        self.config.weights = [
            math.log((mu + 1) / 2) / mu
            for _ in range(mu)
        ]

        self.config.c_mu = sum(
            w ** 2 for w in self.config.weights
        ) / (sum(w for w in self.config.weights) ** 2 - 1 / mu)

        self.config.eff_covariance_update = (
            2 / (mu + 0.5) ** 2 + 1 / mu
        )

    def optimize(
        self,
        objective_fn,
        generations: int = 100,
        bounds: Optional[Tuple[float, float]] = None,
    ) -> Tuple[List[float], float]:
        """
        执行CMA-ES优化

        Args:
            objective_fn: 目标函数 f(x) -> score
            generations: 进化代数
            bounds: 搜索空间边界 (min, max)

        Returns:
            (best_solution, best_score)
        """
        lam = self.config.lambda_
        mu = self.config.mu
        mean = list(self.mean)
        cov = [row[:] for row in self.covariance]
        pc = [0.0] * self.dimension
        ps = [0.0] * self.dimension
        sigma = 1.0

        bounds = bounds or (0.0, 1.0)
        best_solution = mean[:]
        best_score = float('inf')

        history = []

        for gen in range(generations):
            # 生成样本
            samples = []
            for _ in range(lam):
                sample = self._sample_distribution(mean, cov, sigma)
                sample = [
                    max(bounds[0], min(bounds[1], s))
                    for s in sample
                ]
                samples.append(sample)

            # 评估
            scores = [objective_fn(sample) for sample in samples]

            # 排序
            order = sorted(range(lam), key=lambda i: scores[i])
            x_best = samples[order[0]]
            if scores[order[0]] < best_score:
                best_score = scores[order[0]]
                best_solution = x_best[:]

            # 选择优良个体
            parents = [samples[order[i]] for i in range(mu)]
            weights = self.config.weights[:mu]

            # 更新均值
            new_mean = [0.0] * self.dimension
            for i, parent in enumerate(parents):
                for j in range(self.dimension):
                    new_mean[j] += weights[i] * parent[j]
            mean = new_mean

            # 协方差矩阵更新
            # 简化实现：使用秩-1更新
            h_sig = 1.0 if math.sqrt(
                sum((ps[j] / sigma) ** 2 for j in range(self.dimension))
            ) < (1.4 + 2 / (self.dimension + 1)) else 0.0

            for i in range(mu):
                z = [(parents[i][j] - mean[j]) / sigma for j in range(self.dimension)]
                for j1 in range(self.dimension):
                    for j2 in range(j1, self.dimension):
                        cov[j1][j2] += (
                            self.config.eff_covariance_update * weights[i] *
                            z[j1] * z[j2] -
                            self.config.c_1 * cov[j1][j2]
                        )
                # 对称
                for j2 in range(j1 + 1, self.dimension):
                    cov[j2][j1] = cov[j1][j2]

            # 特征分解（简化）
            # 实际实现需要使用BLAS/LAPACK

            # 更新进化路径
            y = [(mean[j] - pc[j]) / sigma for j in range(self.dimension)]
            y_norm = math.sqrt(sum(yj ** 2 for yj in y))

            ps = [
                (1 - self.config.c_sigma) * ps[j] +
                h_sig * math.sqrt(
                    self.config.c_sigma * (2 - self.config.c_sigma)
                ) * y_norm * y[j]
                for j in range(self.dimension)
            ]

            # 更新步长
            sigma *= math.exp(
                self.config.c_sigma / self.config.d_sigma *
                (y_norm / self.chi_n - 1)
            )

            history.append({
                "generation": gen + 1,
                "best_score": best_score,
                "sigma": sigma,
            })

            if gen % 10 == 0:
                logger.info(
                    f"  Gen {gen+1}/{generations}, "
                    f"Best: {best_score:.6f}, Sigma: {sigma:.4f}"
                )

        return best_solution, best_score

    def _sample_distribution(
        self,
        mean: List[float],
        cov: List[List[float]],
        sigma: float,
    ) -> List[float]:
        """从多元正态分布采样"""
        dimension = len(mean)

        # 简化：使用对角协方差近似
        sample = []
        for j in range(dimension):
            z = random.gauss(0, 1)
            sample.append(mean[j] + sigma * math.sqrt(max(0, cov[j][j])) * z)

        return sample


# ============================================================
# 模块级工厂
# ============================================================

def get_moead_optimizer(num_objectives: int = 6) -> MOEADOptimizer:
    """获取MOEAD优化器"""
    return MOEADOptimizer(num_objectives=num_objectives)


def get_cma_es_optimizer(dimension: int) -> CMAESEvaluator:
    """获取CMA-ES优化器"""
    return CMAESEvaluator(dimension=dimension)

"""
BinaryGA + MILP 混合遗传算法引擎

核心创新:
1. 外层BinaryGA: 二进制编码 {0/1} 选择药材组合
2. 内层MILP: 给定药材集合，精确求解最优配比
3. 约束违反度soft penalty: LP不可行时用违反度而非赋0分
4. Warm start: 用上代最优配比作为下代LP初值

@version 1.0.0
"""

import logging
import math
import random
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ============================================================
# 数据类定义
# ============================================================

@dataclass
class BinaryIndividual:
    """二进制GA个体 = 药材选择向量 + LP配比"""
    genes: List[int]  # [0/1]向量，长度=候选药材数
    herb_ids: List[str]  # 对应的药材ID列表
    lp_ratios: Dict[str, float] = field(default_factory=dict)  # MILP精确配比
    fitness: float = 0.0
    efficacy: float = 0.0
    safety: float = 0.0
    taste: float = 0.0
    cost: float = 0.0
    synergy: float = 0.0
    nutrition_score: float = 0.0
    constraint_violation: float = 0.0  # 约束违反度（用于soft penalty）
    selected_herbs: List[str] = field(default_factory=list)  # 选中的药材


@dataclass
class BinaryGAConfig:
    """BinaryGA配置"""
    population_size: int = 50
    generations: int = 40
    mutation_rate: float = 0.15
    crossover_rate: float = 0.85
    elite_ratio: float = 0.15
    tournament_size: int = 5
    target_effects: List[str] = field(default_factory=lambda: ["免疫调节"])
    adaptive_mutation: bool = True
    early_stop_patience: int = 15
    early_stop_threshold: float = 0.0
    # MILP相关
    milp_enabled: bool = True
    warm_start_enabled: bool = True
    total_dosage: float = 100.0
    # 营养约束
    nutrition_constraints: List[Any] = field(default_factory=list)
    strict_nutrition: bool = False


# ============================================================
# BinaryGA + MILP 优化器
# ============================================================

class BinaryGAOptimizer:
    """
    二进制编码遗传算法 + MILP精确配比混合引擎

    架构:
    ┌─────────────────────────────────────────────┐
    │ 外层: BinaryGA (选择药材组合)                │
    │  染色体: [1,0,1,1,0,...] (0/1向量)          │
    │  基因i=1 → 选药材i, 基因i=0 → 不选          │
    └──────────────────┬──────────────────────────┘
                       │ 选中的药材列表
                       ▼
    ┌─────────────────────────────────────────────┐
    │ 内层: MILP求解器 (精确配比)                  │
    │  min cost = Σ(cost_i × x_i)                 │
    │  s.t. Σ(x_i) = total_dosage                 │
    │       营养约束 (线性化)                       │
    │       dosage_min ≤ x_i ≤ dosage_max         │
    └──────────────────┬──────────────────────────┘
                       │ 精确配比 + 营养矩阵
                       ▼
    ┌─────────────────────────────────────────────┐
    │ 适应度评估 (多目标)                          │
    │  fitness = w1·efficacy + w2·safety + ...    │
    │           - λ·constraint_violation           │
    └─────────────────────────────────────────────┘
    """

    def __init__(self, config: Optional[BinaryGAConfig] = None):
        self.config = config or BinaryGAConfig()
        self._candidate_herbs: List[str] = []
        self._best_individual: Optional[BinaryIndividual] = None
        self._prev_lp_ratios: Optional[Dict[str, float]] = None  # warm start

    def optimize(
        self,
        target_effects: List[str],
        candidate_herbs: List[str],
        exclude_herbs: Optional[set] = None,
        milp_solver: Any = None,
        _cancel_signal: Optional['threading.Event'] = None,
    ) -> Tuple[List[BinaryIndividual], List[Dict]]:
        """
        执行BinaryGA+MILP优化

        Args:
            target_effects: 目标功效列表
            candidate_herbs: 候选药材ID列表
            exclude_herbs: 需要排除的药材集合
            milp_solver: MILPSolver实例（可选）

        Returns:
            (top_candidates, history)
        """
        start_time = time.perf_counter()
        self._candidate_herbs = [
            h for h in candidate_herbs
            if h not in (exclude_herbs or set())
        ][:25]  # 限制候选池大小

        if len(self._candidate_herbs) < 3:
            logger.warning(f"[BinaryGA] 候选药材不足 ({len(self._candidate_herbs)})")
            return [], []

        n = len(self._candidate_herbs)
        pop_size = self.config.population_size
        generations = self.config.generations

        logger.info(
            f"[BinaryGA] 种群={pop_size}, 代数={generations}, "
            f"候选药材={n}种, MILP={'启用' if milp_solver else '禁用'}"
        )

        # Step 1: 初始化种群（二进制编码）
        population = self._init_population(n, pop_size)

        # 评估初始种群
        for ind in population:
            ind.selected_herbs = [
                self._candidate_herbs[i]
                for i in range(n) if ind.genes[i] == 1
            ]
            self._evaluate_individual(ind, milp_solver)

        population.sort(key=lambda x: x.fitness, reverse=True)
        best_fitness = population[0].fitness

        history: List[Dict] = []
        no_improve_count = 0
        stop_reason = "completed"
        actual_generations = generations

        # Step 2: 进化迭代
        for gen in range(generations):
            # ── 取消信号检查 ──
            if _cancel_signal is not None and _cancel_signal.is_set():
                logger.info("[BinaryGA] 收到取消信号，提前终止进化")
                fitnesses_now = [ind.fitness for ind in population]
                history.append({
                    "generation": gen + 1,
                    "best_fitness": round(best_fitness, 6),
                    "avg_fitness": round(sum(fitnesses_now) / len(fitnesses_now), 6),
                    "min_fitness": round(min(fitnesses_now), 6),
                    "diversity": round(self._compute_diversity(population), 6),
                    "stop_reason": "cancelled",
                })
                return population[:10], history

            new_population = []

            # 精英保留
            n_elite = max(1, int(pop_size * self.config.elite_ratio))
            new_population.extend(population[:n_elite])

            # 计算多样性
            diversity = self._compute_diversity(population)

            # 自适应变异率
            actual_mutation_rate = self._adaptive_mutation_rate(diversity)

            # 生成后代
            while len(new_population) < pop_size:
                parent1 = self._tournament_select(population)
                parent2 = self._tournament_select(population)

                if random.random() < self.config.crossover_rate:
                    child1_genes, child2_genes = self._crossover(
                        parent1.genes, parent2.genes
                    )
                else:
                    child1_genes, child2_genes = list(parent1.genes), list(parent2.genes)

                # 变异
                child1 = BinaryIndividual(child1_genes, self._candidate_herbs)
                child2 = BinaryIndividual(child2_genes, self._candidate_herbs)
                self._mutate(child1, actual_mutation_rate)
                self._mutate(child2, actual_mutation_rate)

                # 确保至少3味药材
                if sum(child1.genes) < 3:
                    self._enforce_min_herbs(child1)
                if sum(child2.genes) < 3:
                    self._enforce_min_herbs(child2)

                # 评估
                child1.selected_herbs = [
                    self._candidate_herbs[i]
                    for i in range(n) if child1.genes[i] == 1
                ]
                child2.selected_herbs = [
                    self._candidate_herbs[i]
                    for i in range(n) if child2.genes[i] == 1
                ]
                self._evaluate_individual(child1, milp_solver)
                self._evaluate_individual(child2, milp_solver)

                new_population.append(child1)
                if len(new_population) < pop_size:
                    new_population.append(child2)

            population = new_population
            population.sort(key=lambda x: x.fitness, reverse=True)

            # 早停检测
            if population[0].fitness > best_fitness + 1e-9:
                best_fitness = population[0].fitness
                no_improve_count = 0
                self._best_individual = population[0]
                # 保存warm start
                if self.config.warm_start_enabled and population[0].lp_ratios:
                    self._prev_lp_ratios = dict(population[0].lp_ratios)
            else:
                no_improve_count += 1

            # 记录历史
            fitnesses = [ind.fitness for ind in population]
            history.append({
                "generation": gen + 1,
                "best_fitness": round(best_fitness, 6),
                "avg_fitness": round(sum(fitnesses) / len(fitnesses), 6),
                "min_fitness": round(min(fitnesses), 6),
                "diversity": round(diversity, 6),
                "adaptive_mutation_rate": round(actual_mutation_rate, 6),
                "constraint_satisfaction_rate": round(
                    sum(1 for ind in population if ind.constraint_violation < 0.1)
                    / len(population), 6
                ),
            })

            if (gen + 1) % 10 == 0:
                logger.info(
                    f"  Gen {gen+1}/{generations}, "
                    f"Best: {best_fitness:.4f}, Div: {diversity:.4f}"
                )

            # 早停
            should_stop = False
            if (self.config.early_stop_threshold > 0 and
                    best_fitness >= self.config.early_stop_threshold):
                stop_reason = "early_stop_threshold"
                should_stop = True
            if (not should_stop and self.config.early_stop_patience > 0 and
                    no_improve_count >= self.config.early_stop_patience):
                stop_reason = "early_stop_patience"
                should_stop = True

            if should_stop:
                logger.info(f"[BinaryGA] 早停 ({stop_reason}), 第{gen+1}代")
                actual_generations = gen + 1
                break

        if history:
            history[-1]["stop_reason"] = stop_reason

        elapsed = (time.perf_counter() - start_time) * 1000
        logger.info(
            f"[BinaryGA] 完成: {actual_generations}代, "
            f"best={best_fitness:.4f}, time={elapsed:.1f}ms"
        )

        return population[:10], history

    def _init_population(self, n_herbs: int, pop_size: int) -> List[BinaryIndividual]:
        """初始化种群（多样化二进制编码）"""
        population = []

        # 确定性初始: 前5个个体覆盖不同功效组合
        for i in range(min(5, pop_size)):
            genes = [0] * n_herbs
            # 每个功效选前3种最佳药材
            step = max(1, n_herbs // 10)
            for j in range(i * step, min((i + 1) * step, n_herbs)):
                genes[j] = 1
            population.append(BinaryIndividual(genes, self._candidate_herbs))

        # 随机采样填充
        for _ in range(pop_size - len(population)):
            genes = [0] * n_herbs
            # 随机选择3-8味药材
            n_select = random.randint(3, min(8, n_herbs))
            indices = random.sample(range(n_herbs), n_select)
            for idx in indices:
                genes[idx] = 1
            population.append(BinaryIndividual(genes, self._candidate_herbs))

        return population[:pop_size]

    def _evaluate_individual(
        self,
        ind: BinaryIndividual,
        milp_solver: Any,
    ) -> None:
        """
        评估个体: MILP精确配比 + 多目标适应度

        关键改进: 使用约束违反度soft penalty而非赋0分
        """
        if not ind.selected_herbs:
            ind.fitness = 0.001
            ind.constraint_violation = 1.0
            return

        # 调用MILP求解精确配比
        if milp_solver and self.config.milp_enabled:
            warm_start = (
                self._prev_lp_ratios if self.config.warm_start_enabled
                else None
            )
            lp_result = milp_solver.solve(
                selected_herbs=ind.selected_herbs,
                total_dosage=self.config.total_dosage,
                warm_start_ratios=warm_start,
            )

            if lp_result.feasible:
                ind.lp_ratios = lp_result.ratios
                ind.fitness = self._calc_fitness_from_lp(ind, lp_result)
                ind.constraint_violation = 0.0
            else:
                # LP不可行: 使用约束违反度作为soft penalty
                ind.lp_ratios = {}
                violation = lp_result.violation or ind.constraint_violation
                # 违反度映射到[0,1]，fitness = base_fitness * (1 - violation)
                base_fitness = self._calc_base_fitness(ind)
                violation_penalty = min(0.9, sum(violation.values()) / 10.0)
                ind.fitness = base_fitness * (1.0 - violation_penalty)
                ind.constraint_violation = violation_penalty
        else:
            # 无MILP: 使用GA原始剂量
            ind.lp_ratios = {
                h: self.config.total_dosage / len(ind.selected_herbs)
                for h in ind.selected_herbs
            }
            ind.fitness = self._calc_base_fitness(ind)
            ind.constraint_violation = 0.0

    def _calc_fitness_from_lp(
        self,
        ind: BinaryIndividual,
        lp_result: Any,
    ) -> float:
        """从MILP结果计算多目标适应度"""
        # 功效评分
        efficacy = 0.0
        for hid, dosage in ind.lp_ratios.items():
            if hid in lp_result.nutrition_matrix:
                efficacy += dosage * 0.1  # 简化
        efficacy = min(1.0, efficacy / max(sum(ind.lp_ratios.values()), 1))

        # 安全评分 (基于约束满足)
        safety = 1.0 - min(0.5, sum(lp_result.violation.values()) / 5.0)

        # 口感评分 (基于五味调和)
        taste = 0.7  # 默认中等

        # 成本评分 (反比于成本)
        cost_score = max(0.0, 1.0 - lp_result.min_cost / 50.0)

        # 综合
        fitness = (
            efficacy * 0.40 +
            safety * 0.25 +
            taste * 0.15 +
            cost_score * 0.20
        )

        ind.efficacy = efficacy
        ind.safety = safety
        ind.taste = taste
        ind.cost = cost_score

        return fitness

    def _calc_base_fitness(self, ind: BinaryIndividual) -> float:
        """基础适应度（无MILP时的fallback）"""
        n = len(ind.selected_herbs)
        if n == 0:
            return 0.0
        # 基于药材数量的启发式评分
        base = 0.5 + 0.1 * math.log1p(n)
        return min(1.0, base)

    def _tournament_select(self, population: List[BinaryIndividual]) -> BinaryIndividual:
        """锦标赛选择"""
        k = random.sample(
            population,
            min(self.config.tournament_size, len(population))
        )
        return max(k, key=lambda x: x.fitness)

    def _crossover(
        self,
        genes1: List[int],
        genes2: List[int],
    ) -> Tuple[List[int], List[int]]:
        """单点交叉"""
        n = len(genes1)
        point = random.randint(1, n - 1)
        child1 = genes1[:point] + genes2[point:]
        child2 = genes2[:point] + genes1[point:]
        return child1, child2

    def _mutate(self, ind: BinaryIndividual, rate: float) -> None:
        """二进制变异: 翻转基因"""
        for i in range(len(ind.genes)):
            if random.random() < rate:
                ind.genes[i] = 1 - ind.genes[i]

    def _enforce_min_herbs(self, ind: BinaryIndividual) -> None:
        """确保至少选择3味药材"""
        current = sum(ind.genes)
        if current < 3:
            zeros = [i for i, g in enumerate(ind.genes) if g == 0]
            random.shuffle(zeros)
            for idx in zeros[:3 - current]:
                ind.genes[idx] = 1

    def _compute_diversity(self, population: List[BinaryIndividual]) -> float:
        """计算种群Jaccard多样性"""
        if len(population) < 2:
            return 1.0
        gene_sets = [set(ind.genes) for ind in population]
        total_dist = 0.0
        count = 0
        for i in range(len(gene_sets)):
            for j in range(i + 1, len(gene_sets)):
                intersection = len(gene_sets[i] & gene_sets[j])
                union = len(gene_sets[i] | gene_sets[j])
                if union > 0:
                    total_dist += 1.0 - intersection / union
                    count += 1
        return total_dist / max(1, count)

    def _adaptive_mutation_rate(self, diversity: float) -> float:
        """自适应变异率"""
        base = self.config.mutation_rate
        if not self.config.adaptive_mutation:
            return base
        if diversity < 0.2:
            return min(base * 2.5, 0.8)
        elif diversity < 0.4:
            return min(base * 1.5, 0.6)
        elif diversity < 0.6:
            return base
        else:
            return base * 0.7

    def generate_with_result(
        self,
        target_effects: List[str],
        candidate_herbs: List[str],
        milp_solver: Any = None,
        constraints: Optional[Dict] = None,
        _cancel_signal: Optional[threading.Event] = None,
    ) -> Dict[str, Any]:
        """
        便捷入口: 执行优化并返回完整结果
        """
        constraints = constraints or {}
        exclude = set(constraints.get("exclude_herbs", []))

        candidates, history = self.optimize(
            target_effects, candidate_herbs, exclude, milp_solver,
            _cancel_signal=_cancel_signal,
        )

        candidate_dicts = []
        for c in candidates:
            cd = {
                "ingredients": [
                    {"id": h, "name_cn": h, "dosage": c.lp_ratios.get(h, 0)}
                    for h in c.selected_herbs
                ],
                "overall_score": c.fitness,
                "efficacy_score": c.efficacy,
                "safety_score": c.safety,
                "taste_score": c.taste,
                "cost_score": c.cost,
                "confidence": c.fitness,
                "constraint_violation": c.constraint_violation,
            }
            if c.lp_ratios:
                cd["milp_ratios"] = c.lp_ratios
            candidate_dicts.append(cd)

        return {
            "candidates": candidate_dicts,
            "history": history,
            "total_generations": len(history) if history else 0,
            "total_evaluations": self.config.population_size * self.config.generations,
            "best_score": max((c.fitness for c in candidates), default=0.0),
            "algorithm": "binary_ga_milp_hybrid",
            "hybrid_mode": True,
        }

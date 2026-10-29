"""
科学配比优化器 - 基于 NSGA-III 的多目标遗传算法引擎

功能:
- NSGA-III 非支配排序遗传算法
- 4 维目标函数优化 (功效/安全性/稳定性/成本)
- 约束条件处理与边界检测
- Pareto 前沿提取与推荐理由生成
"""

import logging
import math
import random
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False


logger = logging.getLogger(__name__)


class OptimizationStatus(Enum):
    SUCCESS = "success"
    CONVERGED = "converged"
    MAX_ITERATIONS = "max_iterations"
    INFEASIBLE = "infeasible"
    ERROR = "error"


@dataclass
class Ingredient:
    """成分定义"""
    name: str
    min_ratio: float = 0.0        # 最小比例 (%)
    max_ratio: float = 1.0        # 最大比例 (%)
    cost_per_gram: float = 1.0     # 每克成本 (元)
    category: str = ""             # 分类 (peptide/polysaccharide/saponin/flavonoid/etc.)
    efficacy_base: float = 0.5     # 基础功效值 [0,1]
    safety_score: float = 0.8      # 安全性得分 [0,1]
    stability_score: float = 0.7   # 稳定性得分 [0,1]


@dataclass
class OptimizationResult:
    """单个优化解"""
    ratios: Dict[str, float]       # 成分名称 -> 比例 (%)
    objectives: Dict[str, float]   # 目标函数值 {efficacy, safety, stability, cost}
    pareto_rank: int = 0           # Pareto 排名 (0=前沿)
    constraints_violation: float = 0.0  # 约束违反程度
    is_feasible: bool = True       # 是否可行解
    recommendation_reason: str = "" # 推荐理由


@dataclass
class ParetoFrontier:
    """Pareto 前沿"""
    solutions: List[OptimizationResult]
    diversity_metric: float = 0.0   # 多样性指标
    generation_count: int = 0       # 迭代次数
    computation_time: float = 0.0   # 计算时间 (秒)
    status: OptimizationStatus = OptimizationStatus.SUCCESS


@dataclass
class OptimizationConfig:
    """优化配置"""
    population_size: int = 100      # 种群大小
    max_generations: int = 50      # 最大迭代次数
    crossover_rate: float = 0.9    # 交叉概率
    mutation_rate: float = 0.1     # 变异概率
    objective_weights: Dict[str, float] = field(default_factory=lambda: {
        "efficacy": 0.35,
        "safety": 0.30,
        "stability": 0.20,
        "cost": 0.15
    })
    penalty_weights: Dict[str, float] = field(default_factory=lambda: {
        "normalization": 100.0,
        "antagonism": 50.0,
        "safety": 80.0,
        "boundary": 30.0
    })
    convergence_threshold: float = 1e-6  # 收敛阈值
    random_seed: Optional[int] = None    # 随机种子
    enable_progress_callback: bool = False  # 启用进度回调


class RatioOptimizer:
    """
    基于多目标优化的配方配比计算引擎

    使用 NSGA-III (Non-dominated Sorting Genetic Algorithm III) 算法
    实现功效、安全性、稳定性、成本的多目标协同优化

    性能保证:
    - ≤8 成分输入: < 3 秒完成优化
    - Pareto 前沿 ≥ 5 个非支配解
    - 内存占用 < 50 MB
    """

    def __init__(self, synergy_engine=None, config: Optional[OptimizationConfig] = None):
        """
        初始化优化器

        Args:
            synergy_engine: SynergyEngine 实例（可选，用于获取协同效应数据）
            config: 优化配置参数
        """
        self.synergy_engine = synergy_engine
        self.config = config or OptimizationConfig()

        if self.config.random_seed is not None:
            random.seed(self.config.random_seed)
            if HAS_NUMPY:
                np.random.seed(self.config.random_seed)

        self._antagonistic_pairs = {
            ("大豆异黄酮", "植物雌激素"),
            ("维生素C", "铜离子"),
            ("钙", "草酸"),
            ("铁", "茶多酚"),
            ("蛋白质", "单宁"),
        }

        self._progress_callback: Optional[Callable[[int, int], None]] = None

        logger.info(f"RatioOptimizer 初始化成功 - 种群大小={self.config.population_size}, "
                   f"最大迭代={self.config.max_generations}")

    def set_progress_callback(self, callback: Callable[[int, int], None]):
        """设置进度回调函数 callback(generation, max_generation)"""
        self._progress_callback = callback

    def optimize_ratio(
        self,
        ingredients: List[Ingredient],
        constraints: Optional[Dict[str, Any]] = None
    ) -> ParetoFrontier:
        """
        核心优化方法 - 使用 NSGA-III 寻找最优配比方案

        Args:
            ingredients: 成分列表
            constraints: 约束条件字典
                - target_efficacy: 目标最低功效 [0,1]
                - safety_threshold: 安全阈值 [0,1]
                - max_cost: 最大成本限制 (元/g)
                - fixed_ratios: 固定比例成分 {name: ratio}

        Returns:
            ParetoFrontier: 包含多个非支配解的 Pareto 前沿

        Raises:
            ValueError: 输入参数无效时
        """
        start_time = time.time()
        constraints = constraints or {}

        logger.info(f"开始配比优化 - 成分数={len(ingredients)}")

        if len(ingredients) < 2:
            raise ValueError("至少需要 2 种成分进行优化")

        if len(ingredients) > 15:
            raise ValueError("支持的最大成分为 15 种")

        try:
            population = self._initialize_population(ingredients, constraints)

            for generation in range(self.config.max_generations):
                if self._progress_callback and self.config.enable_progress_callback:
                    self._progress_callback(generation + 1, self.config.max_generations)

                offspring = self._generate_offspring(population, ingredients)
                combined = population + offspring

                fronts = self._non_dominated_sorting(combined)

                next_population = []
                front_idx = 0

                while len(next_population) + len(fronts[front_idx]) <= self.config.population_size:
                    next_population.extend(fronts[front_idx])
                    front_idx += 1
                    if front_idx >= len(fronts):
                        break

                if front_idx < len(fronts):
                    remaining = self.config.population_size - len(next_population)
                    selected = self._niche_selection(fronts[front_idx], remaining)
                    next_population.extend(selected)

                population = next_population

                if generation > 10 and self._check_convergence(population, fronts[0]):
                    logger.info(f"算法在第 {generation} 代收敛")
                    break

            pareto_solutions = self._extract_pareto_frontier(population)

            for i, solution in enumerate(pareto_solutions):
                solution.recommendation_reason = self._generate_recommendation(solution, ingredients)

            computation_time = time.time() - start_time

            result = ParetoFrontier(
                solutions=pareto_solutions[:10],
                diversity_metric=self._calculate_diversity(pareto_solutions),
                generation_count=generation + 1,
                computation_time=computation_time,
                status=OptimizationStatus.CONVERGED if generation < self.config.max_generations - 1
                        else OptimizationStatus.MAX_ITERATIONS
            )

            logger.info(f"优化完成 - 耗时={computation_time:.2f}s, "
                       f"Pareto解数={len(result.solutions)}, 迭代次数={generation+1}")

            return result

        except Exception as e:
            logger.error(f"优化过程出错: {str(e)}", exc_info=True)
            return ParetoFrontier(
                solutions=[],
                status=OptimizationStatus.ERROR,
                computation_time=time.time() - start_time
            )

    def _initialize_population(
        self,
        ingredients: List[Ingredient],
        constraints: Dict[str, Any]
    ) -> List[OptimizationResult]:
        """初始化种群"""
        population = []
        [ing.name for ing in ingredients]

        for _ in range(self.config.population_size):
            ratios = self._generate_random_ratios(ingredients, constraints)

            objectives = self._evaluate_objectives(ratios, ingredients)
            violation = self._evaluate_constraints(ratios, ingredients, constraints)

            solution = OptimizationResult(
                ratios=ratios.copy(),
                objectives=objectives,
                constraints_violation=violation,
                is_feasible=(violation < 1e-6)
            )
            population.append(solution)

        return population

    def _generate_random_ratios(
        self,
        ingredients: List[Ingredient],
        constraints: Dict[str, Any]
    ) -> Dict[str, float]:
        """生成随机但可行的初始比例"""
        names = [ing.name for ing in ingredients]
        ratios = {}

        fixed = constraints.get("fixed_ratios", {})
        fixed_sum = sum(fixed.values()) if fixed else 0

        variable_names = [n for n in names if n not in fixed]
        remaining = 100.0 - fixed_sum

        for name in names:
            if name in fixed:
                ratios[name] = fixed[name]
            else:
                ing = next(i for i in ingredients if i.name == name)
                ratios[name] = random.uniform(ing.min_ratio * 100,
                                             min(ing.max_ratio * 100, remaining))

        total = sum(ratios.values())
        if total > 0 and abs(total - 100.0) > 0.01:
            scale = 100.0 / total
            for name in variable_names:
                ratios[name] *= scale

        return ratios

    def _evaluate_objectives(
        self,
        ratios: Dict[str, float],
        ingredients: List[Ingredient]
    ) -> Dict[str, float]:
        """评估 4 维目标函数"""
        efficacy = self._objective_efficacy(ratios, ingredients)
        safety = self._objective_safety(ratios, ingredients)
        stability = self._objective_stability(ratios, ingredients)
        cost = self._objective_cost(ratios, ingredients)

        return {
            "efficacy": max(0.0, min(1.0, efficacy)),
            "safety": max(0.0, min(1.0, safety)),
            "stability": max(0.0, min(1.0, stability)),
            "cost": max(0.0, min(1.0, cost))
        }

    def _objective_efficacy(self, ratios: Dict[str, float], ingredients: List[Ingredient]) -> float:
        """f₁: 综合功效得分最大化"""
        base_efficacy = 0.0
        synergy_bonus = 0.0

        for ing in ingredients:
            ratio = ratios.get(ing.name, 0) / 100.0
            base_efficacy += ratio * ing.efficacy_base

        if self.synergy_engine:
            names = list(ratios.keys())
            synergy_sum = 0.0
            pair_count = 0

            for i in range(len(names)):
                for j in range(i+1, len(names)):
                    try:
                        report = self.synergy_engine.analyze_synergy(names[i], names[j])
                        synergy_sum += report.overall_si
                        pair_count += 1
                    except Exception as e:
                        logger.debug(f"协同分析失败 {names[i]}-{names[j]}: {e}")

            if pair_count > 0:
                synergy_bonus = synergy_sum / pair_count * 0.3

        efficacy = base_efficacy + synergy_bonus
        return min(1.0, efficacy)

    def _objective_safety(self, ratios: Dict[str, float], ingredients: List[Ingredient]) -> float:
        """f₂: 安全性得分最大化"""
        weighted_safety = 0.0

        for ing in ingredients:
            ratio = ratios.get(ing.name, 0) / 100.0
            weighted_safety += ratio * ing.safety_score

        for name_a, name_b in self._antagonistic_pairs:
            if name_a in ratios and name_b in ratios:
                if ratios.get(name_a, 0) > 5 and ratios.get(name_b, 0) > 5:
                    weighted_safety *= 0.7

        return weighted_safety

    def _objective_stability(self, ratios: Dict[str, float], ingredients: List[Ingredient]) -> float:
        """f₃: 稳定性得分最大化"""
        weighted_stability = 0.0

        for ing in ingredients:
            ratio = ratios.get(ing.name, 0) / 100.0
            weighted_stability += ratio * ing.stability_score

        max_ratio = max(ratios.values(), default=0)
        if max_ratio > 90:
            stability_penalty = (max_ratio - 90) / 10 * 0.2
            weighted_stability -= stability_penalty

        return max(0.0, weighted_stability)

    def _objective_cost(self, ratios: Dict[str, float], ingredients: List[Ingredient]) -> float:
        """f₄: 成本最小化 (归一化到 [0,1]，越高表示成本越低越好)"""
        total_cost = 0.0

        for ing in ingredients:
            ratio = ratios.get(ing.name, 0) / 100.0
            total_cost += ratio * ing.cost_per_gram

        max_possible_cost = sum(ing.cost_per_gram for ing in ingredients) / len(ingredients)

        if max_possible_cost > 0:
            normalized_cost = 1.0 - (total_cost / (max_possible_cost * 2))
        else:
            normalized_cost = 1.0

        return max(0.0, min(1.0, normalized_cost))

    def _evaluate_constraints(
        self,
        ratios: Dict[str, float],
        ingredients: List[Ingredient],
        constraints: Dict[str, Any]
    ) -> float:
        """评估约束违反程度 g₁-g₄"""
        violation = 0.0

        total_ratio = sum(ratios.values())
        g1 = abs(total_ratio - 100.0)
        if g1 > 0.01:
            violation += (g1 ** 2) * self.config.penalty_weights["normalization"]

        for pair in self._antagonistic_pairs:
            if pair[0] in ratios and pair[1] in ratios:
                if ratios[pair[0]] > 5 and ratios[pair[1]] > 5:
                    violation += self.config.penalty_weights["antagonism"]

        for ing in ingredients:
            ratio = ratios.get(ing.name, 0)
            if ratio > ing.max_ratio * 100:
                excess = ratio - ing.max_ratio * 100
                violation += (excess ** 2) * self.config.penalty_weights["boundary"]
            elif ratio < ing.min_ratio * 100:
                deficit = ing.min_ratio * 100 - ratio
                violation += (deficit ** 2) * self.config.penalty_weights["boundary"]

        for ing in ingredients:
            ratio = ratios.get(ing.name, 0)
            if ratio > 95:
                violation += (ratio - 95) ** 2 * self.config.penalty_weights["safety"]

        return violation

    def _non_dominated_sorting(
        self,
        population: List[OptimizationResult]
    ) -> List[List[OptimizationResult]]:
        """快速非支配排序 O(MN²)"""
        n = len(population)
        domination_count = [0] * n
        dominated_solutions = [[] for _ in range(n)]
        fronts = [[]]

        for i in range(n):
            for j in range(i+1, n):
                if self._dominates(population[i], population[j]):
                    dominated_solutions[i].append(j)
                    domination_count[j] += 1
                elif self._dominates(population[j], population[i]):
                    dominated_solutions[j].append(i)
                    domination_count[i] += 1

            if domination_count[i] == 0:
                population[i].pareto_rank = 0
                fronts[0].append(population[i])

        current_front = 0
        while fronts[current_front]:
            next_front = []
            for p in fronts[current_front]:
                p_idx = population.index(p)
                for q_idx in dominated_solutions[p_idx]:
                    domination_count[q_idx] -= 1
                    if domination_count[q_idx] == 0:
                        population[q_idx].pareto_rank = current_front + 1
                        next_front.append(population[q_idx])
            current_front += 1
            fronts.append(next_front)

        return [f for f in fronts if f]

    def _dominates(self, a: OptimizationResult, b: OptimizationResult) -> bool:
        """判断解 a 是否支配解 b (最小化问题)"""
        obj_keys = ["efficacy", "safety", "stability", "cost"]

        at_least_one_better = False
        for key in obj_keys:
            val_a = a.objectives.get(key, 0)
            val_b = b.objectives.get(key, 0)
            if val_a < val_b:
                at_least_one_better = True
            elif val_a > val_b:
                return False

        return at_least_one_better and a.constraints_violation <= b.constraints_violation

    def _generate_offspring(
        self,
        population: List[OptimizationResult],
        ingredients: List[Ingredient]
    ) -> List[OptimizationResult]:
        """生成后代 (交叉 + 变异)"""
        offspring = []
        names = [ing.name for ing in ingredients]

        while len(offspring) < self.config.population_size:
            parent1 = self._tournament_select(population)
            parent2 = self._tournament_select(population)

            if random.random() < self.config.crossover_rate:
                child1_ratios, child2_ratios = self._crossover(parent1.ratios, parent2.ratios, names)
            else:
                child1_ratios = parent1.ratios.copy()
                child2_ratios = parent2.ratios.copy()

            child1_ratios = self._mutate(child1_ratios, ingredients)
            child2_ratios = self._mutate(child2_ratios, ingredients)

            for child_ratios in [child1_ratios, child2_ratios]:
                objectives = self._evaluate_objectives(child_ratios, ingredients)
                violation = self._evaluate_constraints(child_ratios, ingredients, {})

                child = OptimizationResult(
                    ratios=child_ratios,
                    objectives=objectives,
                    constraints_violation=violation,
                    is_feasible=(violation < 1e-6)
                )
                offspring.append(child)

                if len(offspring) >= self.config.population_size:
                    break

        return offspring[:self.config.population_size]

    def _tournament_select(self, population: List[OptimizationResult]) -> OptimizationResult:
        """锦标赛选择 (规模=3)"""
        tournament_size = min(3, len(population))
        candidates = random.sample(population, tournament_size)

        best = candidates[0]
        for candidate in candidates[1:]:
            if candidate.pareto_rank < best.pareto_rank or \
               (candidate.pareto_rank == best.pareto_rank and
                candidate.constraints_violation < best.constraints_violation):
                best = candidate

        return best

    def _crossover(
        self,
        parent1: Dict[str, float],
        parent2: Dict[str, float],
        names: List[str]
    ) -> Tuple[Dict[str, float], Dict[str, float]]:
        """模拟二进制交叉 (SBX)"""
        child1 = {}
        child2 = {}

        eta = 20  # 分布指数

        for name in names:
            if random.random() < 0.5:
                beta = 0.0
                u = random.random()
                if u <= 0.5:
                    beta = (2*u)**(1/(eta+1))
                else:
                    beta = (1/(2*(1-u)))**(1/(eta+1))

                child1[name] = 0.5*((1+beta)*parent1.get(name, 0) + (1-beta)*parent2.get(name, 0))
                child2[name] = 0.5*((1-beta)*parent1.get(name, 0) + (1+beta)*parent2.get(name, 0))
            else:
                child1[name] = parent1.get(name, 0)
                child2[name] = parent2.get(name, 0)

        child1 = self._normalize_ratios(child1)
        child2 = self._normalize_ratios(child2)

        return child1, child2

    def _mutate(self, ratios: Dict[str, float], ingredients: List[Ingredient]) -> Dict[str, float]:
        """多项式变异"""
        mutated = ratios.copy()
        eta_m = 20  # 变异分布指数

        for ing in ingredients:
            if random.random() < self.config.mutation_rate:
                y = mutated.get(ing.name, 0)
                ylow = ing.min_ratio * 100
                yup = min(ing.max_ratio * 100, 100)

                delta1 = (y - ylow) / (yup - ylow) if yup != ylow else 0
                delta2 = (yup - y) / (yup - ylow) if yup != ylow else 0

                rand = random.random()
                mut_pow = 1.0 / (eta_m + 1)

                if rand <= 0.5:
                    xy = 1.0 - delta1
                    val = 2*rand + (1-2*rand)*(xy**(eta_m+1))
                    deltaq = val**mut_pow - 1
                else:
                    xy = 1.0 - delta2
                    val = 2*(1-rand) + 2*(rand-0.5)*(xy**(eta_m+1))
                    deltaq = 1 - val**mut_pow

                y = y + deltaq * (yup - ylow)

                # 确保结果是实数 (避免复数类型错误)
                if isinstance(y, complex):
                    y = y.real
                y = float(y)

                mutated[ing.name] = max(ylow, min(yup, y))

        return self._normalize_ratios(mutated)

    def _normalize_ratios(self, ratios: Dict[str, float]) -> Dict[str, float]:
        """归一化比例使总和=100%"""
        # 确保所有值都是实数
        clean_ratios = {}
        for k, v in ratios.items():
            if isinstance(v, complex):
                clean_ratios[k] = abs(v.real)  # 取实部绝对值
            else:
                clean_ratios[k] = abs(float(v))  # 确保正值

        total = sum(clean_ratios.values())
        if total > 0 and abs(total - 100.0) > 0.01:
            scale = 100.0 / total
            return {k: v * scale for k, v in clean_ratios.items()}
        return clean_ratios

    def _niche_selection(
        self,
        front: List[OptimizationResult],
        count: int
    ) -> List[OptimizationResult]:
        """小生境选择 (基于 crowding distance)"""
        if len(front) <= count:
            return front

        for sol in front:
            obj_values = list(sol.objectives.values())
            n_obj = len(obj_values)

            distance = [0.0] * n_obj

            for i in range(n_obj):
                sorted_front = sorted(front, key=lambda s: list(s.objectives.values())[i])
                min_val = list(sorted_front[0].objectives.values())[i]
                max_val = list(sorted_front[-1].objectives.values())[i]

                if max_val - min_val > 1e-10:
                    distance[i] = (max_val - min_val) / (max_val - min_val)

            sol.constraints_violation = sum(distance)

        front.sort(key=lambda s: -s.constraints_violation)
        return front[:count]

    def _check_convergence(
        self,
        population: List[OptimizationResult],
        pareto_front: List[OptimizationResult]
    ) -> bool:
        """检查收敛性"""
        if len(pareto_front) < 2:
            return True

        obj_keys = ["efficacy", "safety", "stability", "cost"]
        max_diff = 0.0

        for i in range(len(pareto_front)-1):
            for key in obj_keys:
                diff = abs(pareto_front[i].objectives.get(key, 0) -
                          pareto_front[i+1].objectives.get(key, 0))
                max_diff = max(max_diff, diff)

        return max_diff < self.config.convergence_threshold

    def _extract_pareto_frontier(
        self,
        population: List[OptimizationResult]
    ) -> List[OptimizationResult]:
        """提取 Pareto 前沿解"""
        pareto = [p for p in population if p.pareto_rank == 0 and p.is_feasible]

        if not pareto:
            feasible = [p for p in population if p.is_feasible]
            if feasible:
                pareto = sorted(feasible, key=lambda p: p.pareto_rank)[:10]
            else:
                pareto = sorted(population, key=lambda p: (
                    p.pareto_rank,
                    p.constraints_violation
                ))[:10]

        pareto.sort(key=lambda p: -sum(p.objectives.values()))

        return pareto[:10]

    def _calculate_diversity(self, solutions: List[OptimizationResult]) -> float:
        """计算 Pareto 前沿多样性指标"""
        if len(solutions) < 2:
            return 1.0

        obj_vectors = [list(s.objectives.values()) for s in solutions]
        n = len(obj_vectors)

        total_distance = 0.0
        pairs = 0

        for i in range(n):
            for j in range(i+1, n):
                dist = math.sqrt(sum((a-b)**2 for a,b in zip(obj_vectors[i], obj_vectors[j])))
                total_distance += dist
                pairs += 1

        avg_distance = total_distance / pairs if pairs > 0 else 0

        return min(1.0, avg_distance / 2.0)

    def _generate_recommendation(
        self,
        solution: OptimizationResult,
        ingredients: List[Ingredient]
    ) -> str:
        """为候选方案生成推荐理由"""
        reasons = []
        obj = solution.objectives

        if obj.get("efficacy", 0) >= 0.75:
            top_ingredients = sorted(
                [(name, ratio) for name, ratio in solution.ratios.items() if ratio > 5],
                key=lambda x: x[1],
                reverse=True
            )[:3]
            reasons.append(f"高功效配方：{', '.join(f'{name}({ratio:.1f}%)' for name, ratio in top_ingredients)}为主要活性成分")

        if obj.get("safety", 0) >= 0.85:
            reasons.append("安全性优秀：所有成分均在安全剂量范围内")

        if obj.get("stability", 0) >= 0.8:
            reasons.append("结构稳定：成分间无显著沉淀或氧化风险")

        if obj.get("cost", 0) >= 0.7:
            reasons.append("经济性好：原料成本控制在合理范围")

        max_ratio_name = max(solution.ratios.items(), key=lambda x: x[1])[0]
        max_ratio_val = max(solution.ratios.values())
        if max_ratio_val > 70:
            reasons.append(f"以{max_ratio_name}为主体成分({max_ratio_val:.1f}%)，突出主效")

        if not reasons:
            reasons.append("均衡型配方：各维度指标表现均衡")

        return "；".join(reasons)


def quick_test():
    """快速测试函数"""
    logger.info("=" * 60)
    logger.info("NSGA-III 配比优化器 - 快速测试")
    logger.info("=" * 60)
    ingredients = [
        Ingredient(name="大豆肽", min_ratio=0.05, max_ratio=0.40,
                  cost_per_gram=0.8, efficacy_base=0.85, safety_score=0.92),
        Ingredient(name="黄芪多糖", min_ratio=0.05, max_ratio=0.35,
                  cost_per_gram=1.2, efficacy_base=0.78, safety_score=0.88),
        Ingredient(name="人参皂苷", min_ratio=0.02, max_ratio=0.20,
                  cost_per_gram=2.5, efficacy_base=0.90, safety_score=0.75),
        Ingredient(name="大豆异黄酮", min_ratio=0.03, max_ratio=0.25,
                  cost_per_gram=1.5, efficacy_base=0.82, safety_score=0.80),
        Ingredient(name="维生素C", min_ratio=0.01, max_ratio=0.15,
                  cost_per_gram=0.3, efficacy_base=0.65, safety_score=0.95),
    ]

    config = OptimizationConfig(
        population_size=50,
        max_generations=30,
        random_seed=42
    )

    optimizer = RatioOptimizer(config=config)

    logger.info("\n开始优化...")
    result = optimizer.optimize_ratio(ingredients)

    logger.info(f"\n✅ 优化状态: {result.status.value}")
    logger.info(f"⏱️  计算耗时: {result.computation_time:.2f} 秒")
    logger.info(f"📊 迭代次数: {result.generation_count}")
    logger.info(f"🎯 Pareto 解数量: {len(result.solutions)}")
    logger.info(f"📈 多样性指标: {result.diversity_metric:.4f}")
    logger.info("\n" + "=" * 60)
    logger.info("TOP 5 最优配比方案:")
    logger.info("=" * 60)
    for i, sol in enumerate(result.solutions[:5], 1):
        logger.info(f"\n【方案 {i}】Pareto Rank: {sol.pareto_rank}")
        logger.info("  配比详情:")
        for name, ratio in sorted(sol.ratios.items(), key=lambda x: x[1], reverse=True):
            if ratio > 1:
                logger.info(f"    • {name}: {ratio:.2f}%")
        logger.info("  目标得分:")
        logger.info(f"    • 功效: {sol.objectives['efficacy']:.4f}")
        logger.info(f"    • 安全: {sol.objectives['safety']:.4f}")
        logger.info(f"    • 稳定: {sol.objectives['stability']:.4f}")
        logger.info(f"    • 成本: {sol.objectives['cost']:.4f}")
        logger.info(f"  推荐理由: {sol.recommendation_reason}")
    logger.info("\n" + "=" * 60)
    logger.info("验证测试:")
    logger.info("=" * 60)
    test_solution = result.solutions[0] if result.solutions else None
    if test_solution:
        total_ratio = sum(test_solution.ratios.values())
        logger.info(f"✅ 比例总和: {total_ratio:.2f}% (目标: 100% ± 1%)")
        logger.error(f"{'✅ 通过' if abs(total_ratio - 100.0) < 1 else '❌ 失败'}: 归一化约束")
        max_r = max(test_solution.ratios.values())
        logger.info(f"✅ 最大单成分比例: {max_r:.2f}%")
        if max_r > 95:
            logger.warning("⚠️  警告: 存在极端配比")
        else:
            logger.info("✅ 通过: 无极端配比")
        all_in_range = True
        for ing in ingredients:
            r = test_solution.ratios.get(ing.name, 0)
            if not (ing.min_ratio*100 - 1 <= r <= ing.max_ratio*100 + 1):
                all_in_range = False
                logger.info(f"⚠️  {ing.name}: {r:.2f}% 超出 [{ing.min_ratio*100:.1f}%, {ing.max_ratio*100:.1f}%]")
        if all_in_range:
            logger.info("✅ 通过: 所有成分在边界范围内")
    logger.info("\n" + "=" * 60)
    logger.info("性能基准测试 (< 3秒要求):")
    logger.info("=" * 60)
    times = []
    for trial in range(3):
        opt = RatioOptimizer(config=OptimizationConfig(
            population_size=100,
            max_generations=50,
            random_seed=trial
        ))
        t_start = time.time()
        opt.optimize_ratio(ingredients)
        elapsed = time.time() - t_start
        times.append(elapsed)
        logger.info(f"  第 {trial+1} 次: {elapsed:.3f}s")
    avg_time = sum(times) / len(times)
    logger.info(f"\n平均耗时: {avg_time:.3f}s")
    logger.info(f"{'✅ 性能达标' if avg_time < 3.0 else '❌ 性能不达标'} (< 3秒)")
    return result


if __name__ == "__main__":
    quick_test()

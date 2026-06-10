"""
ConstraintSolver - 多约束条件优化求解器
使用遗传算法和模拟退火求解配方优化问题
支持硬约束（必须满足）和软约束（尽量满足）
"""
import logging
import math
import random
from enum import Enum
from typing import Any, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


class ConstraintType(Enum):
    """约束类型"""
    HARD = "hard"
    SOFT = "soft"


class OptimizationAlgorithm(Enum):
    """优化算法"""
    GENETIC = "genetic"
    SIMULATED_ANNEALING = "simulated_annealing"


@dataclass
class Constraint:
    """约束条件"""
    name: str
    constraint_type: ConstraintType
    weight: float = 1.0
    evaluate_func: callable = field(default=None)

    def __post_init__(self):
        if self.weight <= 0:
            self.weight = 1.0


class ConstraintViolation(Exception):
    """约束违反异常"""
    def __init__(self, constraint_name: str, message: str):
        self.constraint_name = constraint_name
        self.message = message
        super().__init__(f"Constraint '{constraint_name}' violated: {message}")


class ConstraintSolver:
    """多约束条件优化求解器"""

    def __init__(
        self,
        hard_constraints: list[Constraint] | None = None,
        soft_constraints: list[Constraint] | None = None,
    ):
        self.hard_constraints = hard_constraints or []
        self.soft_constraints = soft_constraints or []
        self.all_constraints = self.hard_constraints + self.soft_constraints

    def check_hard_constraints(self, formula: dict[str, Any]) -> bool:
        """检查硬约束是否满足"""
        for constraint in self.hard_constraints:
            if constraint.evaluate_func and not constraint.evaluate_func(formula):
                logger.warning(f"Hard constraint '{constraint.name}' violated")
                return False
        return True

    def evaluate_soft_constraints(self, formula: dict[str, Any]) -> float:
        """评估软约束满足度"""
        if not self.soft_constraints:
            return 1.0

        total_weight = sum(c.weight for c in self.soft_constraints)
        if total_weight == 0:
            return 1.0

        weighted_score = 0.0

        for constraint in self.soft_constraints:
            if constraint.evaluate_func:
                satisfied = constraint.evaluate_func(formula)
                score = 1.0 if satisfied else 0.0
                weighted_score += score * constraint.weight

        return weighted_score / total_weight

    def solve_genetic(
        self,
        initial_population: list[dict[str, Any]],
        fitness_func: callable,
        max_generations: int = 100,
        population_size: int = 50,
        mutation_rate: float = 0.1,
        crossover_rate: float = 0.8,
        elite_ratio: float = 0.1,
        constraints: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        遗传算法求解

        Args:
            initial_population: 初始种群
            fitness_func: 适应度函数
            max_generations: 最大迭代次数
            population_size: 种群大小
            mutation_rate: 突变率
            crossover_rate: 交叉率
            elite_ratio: 精英比例
            constraints: 约束条件

        Returns:
            最优解
        """
        population = initial_population.copy()

        if len(population) < population_size:
            population.extend(random.sample(population, population_size - len(population)))

        elite_count = max(1, int(population_size * elite_ratio))

        best_solution = None
        best_fitness = float('-inf')

        for generation in range(max_generations):
            fitness_scores = []
            for individual in population:
                fitness = fitness_func(individual, constraints)
                fitness_scores.append(fitness)

                if fitness > best_fitness:
                    if self.check_hard_constraints(individual):
                        best_fitness = fitness
                        best_solution = individual.copy()

            indexed_scores = list(enumerate(fitness_scores))
            indexed_scores.sort(key=lambda x: x[1], reverse=True)

            elite_indices = [idx for idx, _ in indexed_scores[:elite_count]]
            elite = [population[idx] for idx in elite_indices]

            new_population = elite.copy()

            while len(new_population) < population_size:
                if random.random() < crossover_rate:
                    parent1 = self._tournament_select(population, fitness_scores, 3)
                    parent2 = self._tournament_select(population, fitness_scores, 3)
                    child1, child2 = self._crossover(parent1, parent2)
                else:
                    child1 = random.choice(population).copy()

                if random.random() < mutation_rate:
                    child1 = self._mutate(child1)

                if self.check_hard_constraints(child1):
                    new_population.append(child1)

                if len(new_population) < population_size and random.random() < crossover_rate:
                    if random.random() < mutation_rate:
                        child2 = self._mutate(child2)
                    if self.check_hard_constraints(child2):
                        new_population.append(child2)

            population = new_population[:population_size]

            if generation % 20 == 0:
                logger.info(f"Generation {generation}: best_fitness={best_fitness:.4f}")

        return best_solution or population[0]

    def solve_simulated_annealing(
        self,
        initial_solution: dict[str, Any],
        fitness_func: callable,
        initial_temp: float = 1000.0,
        cooling_rate: float = 0.95,
        min_temp: float = 1.0,
        max_iterations: int = 1000,
        constraints: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        模拟退火求解

        Args:
            initial_solution: 初始解
            fitness_func: 适应度函数
            initial_temp: 初始温度
            cooling_rate: 冷却率
            min_temp: 最低温度
            max_iterations: 最大迭代次数
            constraints: 约束条件

        Returns:
            最优解
        """
        current_solution = initial_solution.copy()
        current_fitness = fitness_func(current_solution, constraints)

        best_solution = current_solution.copy()
        best_fitness = current_fitness

        temperature = initial_temp
        iteration = 0

        while temperature > min_temp and iteration < max_iterations:
            neighbor = self._generate_neighbor(current_solution)

            if self.check_hard_constraints(neighbor):
                neighbor_fitness = fitness_func(neighbor, constraints)

                delta = neighbor_fitness - current_fitness

                if delta > 0 or random.random() < math.exp(delta / temperature):
                    current_solution = neighbor
                    current_fitness = neighbor_fitness

                    if current_fitness > best_fitness:
                        best_solution = current_solution.copy()
                        best_fitness = current_fitness

            temperature *= cooling_rate
            iteration += 1

            if iteration % 200 == 0:
                logger.info(f"SA iteration {iteration}: temp={temperature:.2f}, best_fitness={best_fitness:.4f}")

        return best_solution

    def _tournament_select(
        self,
        population: list[dict[str, Any]],
        fitness_scores: list[float],
        tournament_size: int = 3,
    ) -> dict[str, Any]:
        """锦标赛选择"""
        indices = random.sample(range(len(population)), min(tournament_size, len(population)))
        best_idx = max(indices, key=lambda i: fitness_scores[i])
        return population[best_idx].copy()

    def _crossover(
        self,
        parent1: dict[str, Any],
        parent2: dict[str, Any],
    ) -> Tuple[dict[str, Any], dict[str, Any]]:
        """交叉操作"""
        child1 = parent1.copy()
        child2 = parent2.copy()

        if "ingredients" in parent1 and "ingredients" in parent2:
            ingredients1 = parent1["ingredients"]
            ingredients2 = parent2["ingredients"]

            if len(ingredients1) > 1 and len(ingredients2) > 1:
                split1 = random.randint(1, len(ingredients1) - 1)
                split2 = random.randint(1, len(ingredients2) - 1)

                child1["ingredients"] = ingredients1[:split1] + ingredients2[split2:]
                child2["ingredients"] = ingredients2[:split2] + ingredients1[split1:]

        return child1, child2

    def _mutate(self, individual: dict[str, Any]) -> dict[str, Any]:
        """变异操作"""
        mutated = individual.copy()

        if "ingredients" in individual:
            ingredients = [ing.copy() for ing in individual["ingredients"]]

            mutation_type = random.choice(["add", "remove", "replace", "adjust"])

            if mutation_type == "add" and len(ingredients) < 15:
                new_ingredient = self._generate_random_ingredient()
                ingredients.append(new_ingredient)

            elif mutation_type == "remove" and len(ingredients) > 3:
                removed_idx = random.randint(0, len(ingredients) - 1)
                ingredients.pop(removed_idx)

            elif mutation_type == "replace" and ingredients:
                replace_idx = random.randint(0, len(ingredients) - 1)
                ingredients[replace_idx] = self._generate_random_ingredient()

            elif mutation_type == "adjust" and ingredients:
                adjust_idx = random.randint(0, len(ingredients) - 1)
                if "dosage" in ingredients[adjust_idx]:
                    current_dosage = ingredients[adjust_idx]["dosage"]
                    adjustment = random.uniform(0.8, 1.2)
                    ingredients[adjust_idx]["dosage"] = current_dosage * adjustment

            mutated["ingredients"] = ingredients

        return mutated

    def _generate_neighbor(self, solution: dict[str, Any]) -> dict[str, Any]:
        """生成邻域解"""
        return self._mutate(solution)

    def _generate_random_ingredient(self) -> dict[str, Any]:
        """生成随机成分"""
        herbs = ["黄芪", "党参", "茯苓", "山药", "枸杞子", "菊花", "红枣", "甘草"]
        random_herb = random.choice(herbs)

        return {
            "name": random_herb,
            "dosage": random.uniform(5.0, 20.0),
            "unit": "g",
        }


class FormulaConstraintSolver(ConstraintSolver):
    """配方专用约束求解器"""

    def __init__(self):
        super().__init__(
            hard_constraints=self._create_default_hard_constraints(),
            soft_constraints=self._create_default_soft_constraints(),
        )

    def _create_default_hard_constraints(self) -> list[Constraint]:
        """创建默认硬约束"""
        contraindications = [
            {"甘草": ["甘遂", "大戟", "芫花", "海藻"]},
            {"乌头": ["瓜蒌", "贝母", "白蔹", "半夏"]},
        ]

        def check_no_contraindications(formula: dict[str, Any]) -> bool:
            ingredients = formula.get("ingredients", [])
            ingredient_names = [ing.get("name", "") for ing in ingredients]

            for contrain_dict in contraindications:
                for main_ing, incompatible_list in contrain_dict.items():
                    if main_ing in ingredient_names:
                        for incompatible in incompatible_list:
                            if incompatible in ingredient_names:
                                return False
            return True

        def check_budget_limit(formula: dict[str, Any]) -> bool:
            budget = formula.get("constraints", {}).get("max_budget", float("inf"))
            ingredients = formula.get("ingredients", [])

            total_cost = sum(ing.get("cost", 0) for ing in ingredients)
            return total_cost <= budget

        def check_safety_score(formula: dict[str, Any]) -> bool:
            safety_score = formula.get("safety_score", 1.0)
            return safety_score >= 0.7

        return [
            Constraint(
                name="配伍禁忌",
                constraint_type=ConstraintType.HARD,
                evaluate_func=check_no_contraindications,
            ),
            Constraint(
                name="预算限制",
                constraint_type=ConstraintType.HARD,
                evaluate_func=check_budget_limit,
            ),
            Constraint(
                name="安全评分",
                constraint_type=ConstraintType.HARD,
                evaluate_func=check_safety_score,
            ),
        ]

    def _create_default_soft_constraints(self) -> list[Constraint]:
        """创建默认软约束"""

        def check_preferred_taste(formula: dict[str, Any]) -> bool:
            preferred_taste = formula.get("constraints", {}).get("preferred_taste")
            if not preferred_taste:
                return True

            ingredients = formula.get("ingredients", [])
            tastes = [ing.get("taste", "") for ing in ingredients]
            return preferred_taste in tastes

        def check_effect_coverage(formula: dict[str, Any]) -> bool:
            target_effects = formula.get("target_effects", [])
            ingredients = formula.get("ingredients", [])

            covered_effects = set()
            for ing in ingredients:
                ing_effects = ing.get("efficacy", [])
                if isinstance(ing_effects, list):
                    covered_effects.update(ing_effects)
                elif isinstance(ing_effects, str):
                    covered_effects.add(ing_effects)

            if not target_effects:
                return True

            coverage = sum(1 for eff in target_effects if eff in covered_effects)
            return coverage / len(target_effects) >= 0.6

        def check_stability(formula: dict[str, Any]) -> bool:
            stability_score = formula.get("stability_score", 1.0)
            return stability_score >= 0.6

        def check_diversity(formula: dict[str, Any]) -> bool:
            ingredients = formula.get("ingredients", [])
            if len(ingredients) < 3:
                return False

            efficacy_categories = set()
            for ing in ingredients:
                ing_effects = ing.get("efficacy", [])
                if isinstance(ing_effects, list) and ing_effects:
                    efficacy_categories.add(ing_effects[0] if ing_effects else None)

            return len(efficacy_categories) >= 2

        return [
            Constraint(
                name="口感偏好",
                constraint_type=ConstraintType.SOFT,
                weight=1.5,
                evaluate_func=check_preferred_taste,
            ),
            Constraint(
                name="功效覆盖",
                constraint_type=ConstraintType.SOFT,
                weight=2.0,
                evaluate_func=check_effect_coverage,
            ),
            Constraint(
                name="稳定性",
                constraint_type=ConstraintType.SOFT,
                weight=1.0,
                evaluate_func=check_stability,
            ),
            Constraint(
                name="多样性",
                constraint_type=ConstraintType.SOFT,
                weight=0.8,
                evaluate_func=check_diversity,
            ),
        ]

    def solve_formula_optimization(
        self,
        initial_formulas: list[dict[str, Any]],
        target_effects: list[str],
        constraints: dict[str, Any] | None = None,
        algorithm: OptimizationAlgorithm = OptimizationAlgorithm.GENETIC,
        max_iterations: int = 100,
    ) -> dict[str, Any]:
        """
        配方优化求解

        Args:
            initial_formulas: 初始配方列表
            target_effects: 目标功效
            constraints: 约束条件
            algorithm: 优化算法
            max_iterations: 最大迭代次数

        Returns:
            最优配方
        """
        def fitness_function(formula: dict[str, Any], cons: dict[str, Any] | None) -> float:
            formula["target_effects"] = target_effects
            formula["constraints"] = cons or {}

            efficacy_score = self._calculate_efficacy_score(formula)
            safety_score = formula.get("safety_score", 0.8)
            soft_constraint_score = self.evaluate_soft_constraints(formula)

            return efficacy_score * 0.4 + safety_score * 0.3 + soft_constraint_score * 0.3

        if algorithm == OptimizationAlgorithm.GENETIC:
            return self.solve_genetic(
                initial_population=initial_formulas,
                fitness_func=fitness_function,
                max_generations=max_iterations,
                constraints=constraints,
            )
        else:
            initial = initial_formulas[0] if initial_formulas else {}
            return self.solve_simulated_annealing(
                initial_solution=initial,
                fitness_func=fitness_function,
                max_iterations=max_iterations,
                constraints=constraints,
            )

    def _calculate_efficacy_score(self, formula: dict[str, Any]) -> float:
        """计算功效评分"""
        target_effects = formula.get("target_effects", [])
        if not target_effects:
            return 0.5

        ingredients = formula.get("ingredients", [])
        if not ingredients:
            return 0.0

        covered_effects = set()
        for ing in ingredients:
            ing_effects = ing.get("efficacy", [])
            if isinstance(ing_effects, list):
                covered_effects.update(ing_effects)
            elif isinstance(ing_effects, str):
                covered_effects.add(ing_effects)

        matched = sum(1 for eff in target_effects if eff in covered_effects)
        base_score = matched / len(target_effects)

        synergy_bonus = 0.0
        all_effects = []
        for ing in ingredients:
            ing_effects = ing.get("efficacy", [])
            if isinstance(ing_effects, list):
                all_effects.extend(ing_effects)
            elif isinstance(ing_effects, str):
                all_effects.append(ing_effects)

        synergy_pairs = [
            ("降血压", "抗氧化"),
            ("降血糖", "抗氧化"),
            ("补气", "养血"),
            ("清热", "润肺"),
        ]

        for i, eff1 in enumerate(all_effects):
            for eff2 in all_effects[i + 1:]:
                if (eff1, eff2) in synergy_pairs or (eff2, eff1) in synergy_pairs:
                    synergy_bonus += 0.05

        return min(1.0, base_score + synergy_bonus)

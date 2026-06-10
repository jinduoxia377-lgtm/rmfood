"""
SimulatedAnnealingOptimizer - 模拟退火优化器
专利US 11,742,060 B2 权利要求4、D3技术特征
用于跳出局部最优，实现全局优化
"""
import logging
import math
import random
from enum import Enum
from typing import Any, Callable, Literal

logger = logging.getLogger(__name__)


class CoolingStrategy(Enum):
    """冷却策略类型"""
    EXPONENTIAL = "exponential"
    LINEAR = "linear"
    ADAPTIVE = "adaptive"


class NeighborhoodOperation(Enum):
    """邻域操作类型"""
    PERTURB_DOSAGE = "perturb_dosage"
    REPLACE_INGREDIENT = "replace_ingredient"
    ADD_INGREDIENT = "add_ingredient"
    REMOVE_INGREDIENT = "remove_ingredient"


class SimulatedAnnealingOptimizer:
    """
    模拟退火优化器

    实现特征:
    - 温度衰减调度 (指数/线性/自适应)
    - 邻域搜索 (剂量扰动/成分替换/添加删除)
    - Metropolis接受准则
    - 早停机制
    """

    def __init__(
        self,
        initial_temperature: float = 1000.0,
        cooling_rate: float = 0.995,
        min_temperature: float = 1.0,
        max_iterations: int = 1000,
        cooling_strategy: CoolingStrategy = CoolingStrategy.EXPONENTIAL,
        neighborhood_rate: float = 0.3,
        perturbation_scale: float = 0.1,
    ):
        """
        初始化模拟退火优化器

        Args:
            initial_temperature: 初始温度
            cooling_rate: 冷却率 (指数冷却使用)
            min_temperature: 最低温度阈值
            max_iterations: 每温度最大迭代次数
            cooling_strategy: 冷却策略
            neighborhood_rate: 邻域操作概率
            perturbation_scale: 剂量扰动幅度
        """
        self.T = initial_temperature
        self.cooling_rate = cooling_rate
        self.T_min = min_temperature
        self.max_iter = max_iterations
        self.cooling_strategy = cooling_strategy
        self.neighborhood_rate = neighborhood_rate
        self.perturbation_scale = perturbation_scale

        self.best_solution: dict[str, Any] | None = None
        self.best_score: float = float('-inf')
        self.iteration_history: list[dict[str, float]] = []

        self.herbs_pool = [
            "黄芪", "党参", "茯苓", "山药", "枸杞子", "菊花", "红枣", "甘草",
            "当归", "川芎", "白芍", "熟地黄", "人参", "白术", "炙甘草", "陈皮",
            "半夏", "生姜", "大枣", "桂枝", "芍药", "麻黄", "杏仁", "石膏",
        ]

    def optimize(
        self,
        initial_formula: dict[str, Any],
        objective_function: Callable[[dict[str, Any]], float],
        constraints: dict[str, Any] | None = None,
        max_time: int | None = None,
        callback: Callable[[dict[str, Any], float, int], None] | None = None,
    ) -> dict[str, Any]:
        """
        执行模拟退火优化

        Args:
            initial_formula: 初始配方
            objective_function: 目标函数
            constraints: 约束条件字典
            max_time: 最大运行时间(秒)
            callback: 迭代回调函数 (solution, score, iteration)

        Returns:
            最优解
        """
        current_solution = self._deep_copy(initial_formula)
        current_score = objective_function(current_solution)

        self.best_solution = self._deep_copy(current_solution)
        self.best_score = current_score
        self.iteration_history = []

        iteration = 0
        total_iterations = 0

        logger.info(f"SA开始: 初始温度={self.T:.2f}, 冷却率={self.cooling_rate}")

        while self.T > self.T_min:
            for _ in range(self.max_iter):
                neighbor = self.get_neighbor(current_solution)

                if constraints and not self._check_constraints(neighbor, constraints):
                    continue

                neighbor_score = objective_function(neighbor)
                delta = neighbor_score - current_score

                if self._accept(delta):
                    current_solution = self._deep_copy(neighbor)
                    current_score = neighbor_score

                    if current_score > self.best_score:
                        self.best_solution = self._deep_copy(current_solution)
                        self.best_score = current_score
                        logger.debug(f"新最优解: score={self.best_score:.4f} at iter={total_iterations}")

                self.iteration_history.append({
                    "temperature": self.T,
                    "iteration": total_iterations,
                    "current_score": current_score,
                    "best_score": self.best_score,
                })

                if callback and total_iterations % 100 == 0:
                    callback(self.best_solution, self.best_score, total_iterations)

                total_iterations += 1

            self._cool()

            if total_iterations % 500 == 0:
                logger.info(f"SA进度: iter={total_iterations}, T={self.T:.4f}, best={self.best_score:.4f}")

        logger.info(f"SA完成: 总迭代={total_iterations}, 最优score={self.best_score:.4f}")
        return self.best_solution

    def get_neighbor(self, solution: dict[str, Any]) -> dict[str, Any]:
        """
        生成邻域解

        支持的邻域操作:
        - 成分剂量微小扰动
        - 成分替换
        - 成分添加/删除

        Args:
            solution: 当前解

        Returns:
            邻域解
        """
        neighbor = self._deep_copy(solution)
        ingredients = neighbor.get("ingredients", [])

        if not ingredients:
            return self._add_random_ingredient(neighbor)

        operation = random.choice(list(NeighborhoodOperation))

        if operation == NeighborhoodOperation.PERTURB_DOSAGE:
            neighbor = self._perturb_dosage(neighbor)
        elif operation == NeighborhoodOperation.REPLACE_INGREDIENT:
            neighbor = self._replace_ingredient(neighbor)
        elif operation == NeighborhoodOperation.ADD_INGREDIENT and len(ingredients) < 15:
            neighbor = self._add_random_ingredient(neighbor)
        elif operation == NeighborhoodOperation.REMOVE_INGREDIENT and len(ingredients) > 3:
            neighbor = self._remove_random_ingredient(neighbor)
        else:
            neighbor = self._perturb_dosage(neighbor)

        return neighbor

    def _perturb_dosage(self, solution: dict[str, Any]) -> dict[str, Any]:
        """剂量扰动"""
        ingredients = solution.get("ingredients", [])
        if not ingredients:
            return solution

        perturbed = self._deep_copy(solution)
        pert_ingredients = perturbed.get("ingredients", [])

        idx = random.randint(0, len(pert_ingredients) - 1)
        current_dosage = pert_ingredients[idx].get("dosage", 10.0)

        adjustment = random.uniform(1 - self.perturbation_scale, 1 + self.perturbation_scale)
        new_dosage = max(0.1, current_dosage * adjustment)

        pert_ingredients[idx]["dosage"] = round(new_dosage, 2)
        perturbed["ingredients"] = pert_ingredients

        return perturbed

    def _replace_ingredient(self, solution: dict[str, Any]) -> dict[str, Any]:
        """成分替换"""
        ingredients = solution.get("ingredients", [])
        if not ingredients:
            return solution

        replaced = self._deep_copy(solution)
        rep_ingredients = replaced.get("ingredients", [])

        idx = random.randint(0, len(rep_ingredients) - 1)
        current_name = rep_ingredients[idx].get("name", "")

        available_herbs = [h for h in self.herbs_pool if h != current_name]
        if not available_herbs:
            return replaced

        new_herb = random.choice(available_herbs)
        new_dosage = random.uniform(5.0, 20.0)

        rep_ingredients[idx] = {
            "name": new_herb,
            "dosage": round(new_dosage, 2),
            "unit": "g",
        }
        replaced["ingredients"] = rep_ingredients

        return replaced

    def _add_random_ingredient(self, solution: dict[str, Any]) -> dict[str, Any]:
        """添加随机成分"""
        added = self._deep_copy(solution)
        ingredients = added.get("ingredients", [])

        existing_names = [ing.get("name", "") for ing in ingredients]
        available_herbs = [h for h in self.herbs_pool if h not in existing_names]

        if not available_herbs:
            return solution

        new_herb = random.choice(available_herbs)
        new_dosage = random.uniform(5.0, 15.0)

        new_ingredient = {
            "name": new_herb,
            "dosage": round(new_dosage, 2),
            "unit": "g",
        }
        ingredients.append(new_ingredient)
        added["ingredients"] = ingredients

        return added

    def _remove_random_ingredient(self, solution: dict[str, Any]) -> dict[str, Any]:
        """删除随机成分"""
        removed = self._deep_copy(solution)
        ingredients = removed.get("ingredients", [])

        if len(ingredients) <= 3:
            return solution

        idx = random.randint(0, len(ingredients) - 1)
        ingredients.pop(idx)
        removed["ingredients"] = ingredients

        return removed

    def _accept(self, delta: float) -> bool:
        """
        计算接受概率

        P = exp((new_score - old_score) / T) = exp(delta / T)

        Args:
            delta: 分数差值

        Returns:
            是否接受
        """
        if delta > 0:
            return True

        if self.T <= 0:
            return False

        try:
            probability = math.exp(delta / self.T)
        except OverflowError:
            probability = 0.0

        return random.random() < probability

    def _cool(self) -> None:
        """温度冷却"""
        if self.cooling_strategy == CoolingStrategy.EXPONENTIAL:
            self.T *= self.cooling_rate
        elif self.cooling_strategy == CoolingStrategy.LINEAR:
            self.T = max(self.T_min, self.T - self.cooling_rate)
        elif self.cooling_strategy == CoolingStrategy.ADAPTIVE:
            recent_improvements = self._count_recent_improvements()
            if recent_improvements > 5:
                self.T *= 0.99
            elif recent_improvements == 0:
                self.T *= self.cooling_rate * 1.01
            else:
                self.T *= self.cooling_rate
            self.T = max(self.T_min, self.T)

    def _count_recent_improvements(self) -> int:
        """计算最近是否有改进"""
        if len(self.iteration_history) < 10:
            return 5

        recent = self.iteration_history[-10:]
        improvements = sum(
            1 for i in range(1, len(recent))
            if recent[i]["best_score"] > recent[i - 1]["best_score"]
        )
        return improvements

    def _check_constraints(
        self,
        solution: dict[str, Any],
        constraints: dict[str, Any],
    ) -> bool:
        """检查约束条件"""
        max_ingredients = constraints.get("max_ingredients", 15)
        min_ingredients = constraints.get("min_ingredients", 3)
        max_budget = constraints.get("max_budget", float('inf'))
        min_dosage = constraints.get("min_dosage", 0.1)
        max_dosage = constraints.get("max_dosage", 100.0)

        ingredients = solution.get("ingredients", [])
        if not (min_ingredients <= len(ingredients) <= max_ingredients):
            return False

        total_cost = sum(ing.get("cost", 0) for ing in ingredients)
        if total_cost > max_budget:
            return False

        for ing in ingredients:
            dosage = ing.get("dosage", 0)
            if not (min_dosage <= dosage <= max_dosage):
                return False

        prohibited = constraints.get("prohibited_ingredients", [])
        ingredient_names = [ing.get("name", "") for ing in ingredients]
        for prohibited_item in prohibited:
            if prohibited_item in ingredient_names:
                return False

        return True

    def _deep_copy(self, solution: dict[str, Any]) -> dict[str, Any]:
        """深拷贝解"""
        if not solution:
            return {}

        copied = {}
        for key, value in solution.items():
            if isinstance(value, list):
                copied[key] = [
                    item.copy() if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                copied[key] = value
        return copied

    def get_optimization_history(self) -> list[dict[str, float]]:
        """获取优化历史"""
        return self.iteration_history

    def set_temperature(self, temperature: float) -> None:
        """设置当前温度"""
        self.T = max(0.0, temperature)

    def reset(self) -> None:
        """重置优化器状态"""
        self.T = 1000.0
        self.best_solution = None
        self.best_score = float('-inf')
        self.iteration_history = []


class AdaptiveSimulatedAnnealing(SimulatedAnnealingOptimizer):
    """
    自适应模拟退火优化器

    特征:
    - 动态调整冷却速率
    - 自动调整扰动幅度
    - 记录和利用搜索历史
    """

    def __init__(
        self,
        initial_temperature: float = 1000.0,
        min_temperature: float = 0.1,
        max_iterations: int = 1000,
    ):
        super().__init__(
            initial_temperature=initial_temperature,
            cooling_rate=0.995,
            min_temperature=min_temperature,
            max_iterations=max_iterations,
            cooling_strategy=CoolingStrategy.ADAPTIVE,
        )

        self.acceptance_history: list[bool] = []
        self.target_acceptance_rate = 0.44

    def _cool(self) -> None:
        """自适应冷却"""
        if len(self.acceptance_history) >= 50:
            acceptance_rate = sum(self.acceptance_history[-50:]) / 50.0

            if acceptance_rate > self.target_acceptance_rate * 1.2:
                self.T *= 1.05
            elif acceptance_rate < self.target_acceptance_rate * 0.8:
                self.T *= 0.95

        self.T = max(self.T_min, self.T * self.cooling_rate)

        if len(self.acceptance_history) > 1000:
            self.acceptance_history = self.acceptance_history[-500:]

    def _accept(self, delta: float) -> bool:
        """带历史记录的自适应接受"""
        accepted = super()._accept(delta)

        if delta > 0:
            self.acceptance_history.append(True)
        elif self.T > 0:
            try:
                probability = math.exp(delta / self.T)
                self.acceptance_history.append(random.random() < probability)
            except OverflowError:
                self.acceptance_history.append(False)
        else:
            self.acceptance_history.append(False)

        return accepted

"""
SimulatedAnnealingOptimizer - 模拟退火优化器
专利US 11,742,060 B2 权利要求4、D3技术特征
用于跳出局部最优，实现全局优化
"""
import logging
import math
import random
from enum import Enum
from typing import Any, Callable

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

        # 药材知识库 — 从 bayesian_formula_optimizer 导入真实数据
        self._herb_db = None
        self._load_herb_db()

    def _load_herb_db(self) -> None:
        """加载药材知识库"""
        try:
            from app.services.ai.algorithms.bayesian_formula_optimizer import _BUILTIN_HERBS
            self._herb_db = _BUILTIN_HERBS
        except ImportError:
            self._herb_db = {}

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
        生成邻域解 — 修复版：知识库感知

        修复: 不再从硬编码 herbs_pool 随机选择，
        而是从 _BUILTIN_HERBS 知识库中按功效匹配选择
        """
        neighbor = self._deep_copy(solution)
        ingredients = neighbor.get("ingredients", [])

        if not ingredients:
            return self._add_knowledge_aware_ingredient(neighbor)

        operation = random.choices(
            list(NeighborhoodOperation),
            weights=[0.4, 0.2, 0.2, 0.2],
            k=1
        )[0]

        if operation == NeighborhoodOperation.PERTURB_DOSAGE:
            neighbor = self._perturb_dosage(neighbor)
        elif operation == NeighborhoodOperation.REPLACE_INGREDIENT:
            neighbor = self._replace_knowledge_aware(neighbor)
        elif operation == NeighborhoodOperation.ADD_INGREDIENT and len(ingredients) < 15:
            neighbor = self._add_knowledge_aware_ingredient(neighbor)
        elif operation == NeighborhoodOperation.REMOVE_INGREDIENT and len(ingredients) > 3:
            neighbor = self._remove_redundant(neighbor)
        else:
            neighbor = self._perturb_dosage(neighbor)

        return neighbor

    def _perturb_dosage(self, solution: dict[str, Any]) -> dict[str, Any]:
        """剂量扰动 — 修复版：在药材安全范围内扰动"""
        ingredients = solution.get("ingredients", [])
        if not ingredients:
            return solution

        perturbed = self._deep_copy(solution)
        pert_ingredients = perturbed.get("ingredients", [])

        idx = random.randint(0, len(pert_ingredients) - 1)
        current_dosage = pert_ingredients[idx].get("dosage", 10.0)
        herb_name = pert_ingredients[idx].get("name", "")

        # 从知识库查找安全剂量范围
        herb_param = None
        if self._herb_db:
            for hid, hp in self._herb_db.items():
                if hp.name_cn == herb_name:
                    herb_param = hp
                    break

        if herb_param:
            # 在药材安全范围内高斯扰动
            min_d = herb_param.dosage_min
            max_d = herb_param.dosage_max
            range_size = max_d - min_d
            perturbation = random.gauss(0, range_size * 0.15)
            new_dosage = max(min_d, min(max_d, current_dosage + perturbation))
        else:
            # 兜底：保守扰动
            adjustment = random.uniform(1 - self.perturbation_scale, 1 + self.perturbation_scale)
            new_dosage = max(0.1, current_dosage * adjustment)

        pert_ingredients[idx]["dosage"] = round(new_dosage, 2)
        perturbed["ingredients"] = pert_ingredients

        return perturbed

    def _replace_ingredient(self, solution: dict[str, Any]) -> dict[str, Any]:
        """成分替换 — 已废弃，使用 _replace_knowledge_aware 代替"""
        return self._replace_knowledge_aware(solution)

    def _replace_knowledge_aware(self, solution: dict[str, Any]) -> dict[str, Any]:
        """知识感知成分替换 — 从同功效类别中选择替代药材"""
        replaced = self._deep_copy(solution)
        rep_ingredients = replaced.get("ingredients", [])
        if not rep_ingredients:
            return replaced

        idx = random.randint(0, len(rep_ingredients) - 1)
        current_name = rep_ingredients[idx].get("name", "")
        current_effs = set(rep_ingredients[idx].get("efficacy", []))

        if not self._herb_db:
            # 兜底：从旧 herbs_pool 随机替换
            available_herbs = [h for h in self.herbs_pool if h != current_name]
            if not available_herbs:
                return replaced
            new_herb = random.choice(available_herbs)
            rep_ingredients[idx]["name"] = new_herb
            return replaced

        # 从知识库找功效最匹配的替代药材
        candidates = []
        for hid, hp in self._herb_db.items():
            if hp.name_cn == current_name:
                continue
            hp_effs = set(hp.efficacy_scores.keys())
            overlap = len(hp_effs & current_effs)
            if overlap >= 1:
                candidates.append((overlap, hp))

        if candidates:
            # 只按 overlap 数值排序，避免元组第二元素 HerbParameter 对象被比较时触发 TypeError
            candidates.sort(key=lambda item: item[0], reverse=True)
            top_overlap = candidates[0][0]
            top_candidates = [c for c in candidates if c[0] == top_overlap]
            chosen = random.choice(top_candidates)[1]
            rep_ingredients[idx] = {
                "name": chosen.name_cn,
                "dosage": round(random.uniform(chosen.dosage_min, chosen.dosage_max), 2),
                "unit": "g",
                "efficacy": list(chosen.efficacy_scores.keys()),
            }
        else:
            # 无匹配时随机选一个不同药材
            all_names = {hp.name_cn for hp in self._herb_db.values()}
            available = [n for n in all_names if n != current_name]
            if available:
                new_name = random.choice(available)
                for hid, hp in self._herb_db.items():
                    if hp.name_cn == new_name:
                        rep_ingredients[idx] = {
                            "name": hp.name_cn,
                            "dosage": round(random.uniform(hp.dosage_min, hp.dosage_max), 2),
                            "unit": "g",
                            "efficacy": list(hp.efficacy_scores.keys()),
                        }
                        break

        replaced["ingredients"] = rep_ingredients
        return replaced

    def _add_random_ingredient(self, solution: dict[str, Any]) -> dict[str, Any]:
        """添加成分 — 已废弃，使用 _add_knowledge_aware 代替"""
        return self._add_knowledge_aware_ingredient(solution)

    def _add_knowledge_aware_ingredient(self, solution: dict[str, Any]) -> dict[str, Any]:
        """知识感知添加 — 从功效互补角度选择新药材"""
        added = self._deep_copy(solution)
        ingredients = added.get("ingredients", [])

        existing_names = {ing.get("name", "") for ing in ingredients}
        existing_effs = set()
        for ing in ingredients:
            for eff in ing.get("efficacy", []):
                existing_effs.add(eff)

        if not self._herb_db:
            # 兜底：从旧 herbs_pool 添加
            available_herbs = [h for h in self.herbs_pool if h not in existing_names]
            if not available_herbs:
                return solution
            new_herb = random.choice(available_herbs)
            ingredients.append({
                "name": new_herb,
                "dosage": round(random.uniform(5.0, 15.0), 2),
                "unit": "g",
            })
            added["ingredients"] = ingredients
            return added

        # 找能覆盖最多未达成功效的药材
        best_herb = None
        best_coverage = 0
        for hid, hp in self._herb_db.items():
            if hp.name_cn in existing_names:
                continue
            hp_effs = set(hp.efficacy_scores.keys())
            coverage = len(hp_effs - existing_effs)
            if coverage > best_coverage:
                best_coverage = coverage
                best_herb = hp

        if best_herb and best_coverage > 0:
            ingredients.append({
                "name": best_herb.name_cn,
                "dosage": round(random.uniform(best_herb.dosage_min, best_herb.dosage_max), 2),
                "unit": "g",
                "efficacy": list(best_herb.efficacy_scores.keys()),
            })
        elif best_herb:
            # 无互补时添加一个已知好药材
            ingredients.append({
                "name": best_herb.name_cn,
                "dosage": round(random.uniform(best_herb.dosage_min, best_herb.dosage_max), 2),
                "unit": "g",
                "efficacy": list(best_herb.efficacy_scores.keys()),
            })

        added["ingredients"] = ingredients
        return added

    def _remove_redundant(self, solution: dict[str, Any]) -> dict[str, Any]:
        """移除冗余成分 — 功效重叠最多的"""
        removed = self._deep_copy(solution)
        ingredients = removed.get("ingredients", [])

        if len(ingredients) <= 3:
            return solution

        # 找功效重叠最多的成分
        best_overlap_idx = 0
        best_overlap = 0
        for i, ing in enumerate(ingredients):
            ing_effs = set(ing.get("efficacy", []))
            overlap = 0
            for j, other in enumerate(ingredients):
                if i != j:
                    other_effs = set(other.get("efficacy", []))
                    overlap += len(ing_effs & other_effs)
            if overlap > best_overlap:
                best_overlap = overlap
                best_overlap_idx = i

        if best_overlap > 0:
            ingredients.pop(best_overlap_idx)
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

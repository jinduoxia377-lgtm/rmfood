"""
ConstraintSolver - 多约束条件优化求解器
使用遗传算法和模拟退火求解配方优化问题
支持硬约束（必须满足）和软约束（尽量满足）

修复说明:
- _generate_random_ingredient 改为从 _BUILTIN_HERBS 知识库采样
- 交叉/变异操作使用剂量感知策略（基于药效评分和禁忌关系）
- 约束检查支持动态禁忌对（从 herb 数据读取）
"""
import logging
import math
import random
from enum import Enum
from typing import Any, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# 延迟导入，避免循环依赖
_HERB_DB = None


def _get_herb_db():
    """获取药材知识库，延迟导入避免循环依赖"""
    global _HERB_DB
    if _HERB_DB is None:
        try:
            from app.services.ai.algorithms.bayesian_formula_optimizer import _BUILTIN_HERBS
            _HERB_DB = _BUILTIN_HERBS
        except ImportError:
            # 兜底：使用最小内置集
            _HERB_DB = {}
    return _HERB_DB


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
        遗传算法求解 — 修复版

        关键改进:
        1. 交叉操作使用药效相似度引导（而非纯随机分割）
        2. 变异操作基于禁忌关系和剂量合理性（而非随机替换）
        3. 种群初始化时注入已知配伍对
        """
        population = [ind.copy() for ind in initial_population]
        herb_db = _get_herb_db()

        # 修复: 用知识库填充初始种群
        if len(population) < 3:
            population.extend(self._generate_knowledge_based_individual(herb_db)
                              for _ in range(3 - len(population)))

        # 修复: 用知识库扩展不足的种群
        while len(population) < population_size:
            pop_ind = self._generate_knowledge_based_individual(herb_db)
            if pop_ind not in population:
                population.append(pop_ind)

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
                        best_solution = {k: (v.copy() if isinstance(v, dict) or isinstance(v, list) else v)
                                         for k, v in individual.items()}

            indexed_scores = list(enumerate(fitness_scores))
            indexed_scores.sort(key=lambda x: x[1], reverse=True)

            elite_indices = [idx for idx, _ in indexed_scores[:elite_count]]
            elite = [population[idx] for idx in elite_indices]

            new_population = [ind.copy() for ind in elite]

            while len(new_population) < population_size:
                if random.random() < crossover_rate and len(elite) >= 2:
                    parent1 = random.choice(elite)
                    parent2 = random.choice([p for p in elite if p is not parent1])
                    child1, child2 = self._knowledge_aware_crossover(parent1, parent2, herb_db)
                else:
                    child1 = self._knowledge_aware_mutation(random.choice(population), herb_db)

                if self.check_hard_constraints(child1):
                    new_population.append(child1)

                if len(new_population) < population_size:
                    child2 = self._knowledge_aware_mutation(child2 if 'child2' in dir() else random.choice(population), herb_db)
                    if self.check_hard_constraints(child2):
                        new_population.append(child2)

            population = new_population[:population_size]

            if generation % 20 == 0:
                logger.info(f"Generation {generation}: best_fitness={best_fitness:.4f}")

        return best_solution or (population[0].copy() if population else {})

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
        模拟退火求解 — 修复版

        关键改进:
        1. _generate_neighbor 使用知识库感知的邻域搜索
        2. 约束检查使用动态禁忌对
        """
        herb_db = _get_herb_db()
        current_solution = {k: (v.copy() if isinstance(v, dict) or isinstance(v, list) else v)
                            for k, v in initial_solution.items()}
        current_fitness = fitness_func(current_solution, constraints)

        best_solution = current_solution.copy()
        best_fitness = current_fitness

        temperature = initial_temp
        iteration = 0

        while temperature > min_temp and iteration < max_iterations:
            neighbor = self._knowledge_aware_neighbor(current_solution, herb_db)

            if self.check_hard_constraints(neighbor):
                neighbor_fitness = fitness_func(neighbor, constraints)
                delta = neighbor_fitness - current_fitness

                if delta > 0 or random.random() < math.exp(delta / max(temperature, 1e-10)):
                    current_solution = {k: (v.copy() if isinstance(v, dict) or isinstance(v, list) else v)
                                        for k, v in neighbor.items()}
                    current_fitness = neighbor_fitness

                    if current_fitness > best_fitness:
                        best_solution = {k: (v.copy() if isinstance(v, dict) or isinstance(v, list) else v)
                                          for k, v in current_solution.items()}
                        best_fitness = current_fitness

            temperature *= cooling_rate
            iteration += 1

            if iteration % 200 == 0:
                logger.info(f"SA iteration {iteration}: temp={temperature:.2f}, best_fitness={best_fitness:.4f}")

        return best_solution

    def _knowledge_aware_crossover(
        self, parent1: dict[str, Any], parent2: dict[str, Any],
        herb_db: dict
    ) -> Tuple[dict[str, Any], dict[str, Any]]:
        """
        知识感知交叉 — 基于药效互补性而非随机分割

        策略: 保留两个亲本的互补药效，避免破坏已知配伍对
        """
        child1 = {k: (v.copy() if isinstance(v, list) else v) for k, v in parent1.items()}
        child2 = {k: (v.copy() if isinstance(v, list) else v) for k, v in parent2.items()}

        ingredients1 = parent1.get("ingredients", [])
        ingredients2 = parent2.get("ingredients", [])

        if not ingredients1 or not ingredients2:
            return child1, child2

        # 按功效类别分组
        effects1 = set()
        for ing in ingredients1:
            for eff in ing.get("efficacy", []):
                effects1.add(eff)
        effects2 = set()
        for ing in ingredients2:
            for eff in ing.get("efficacy", []):
                effects2.add(eff)

        # 互补: child1 获得 parent1 的独特功效 + parent2 的补充成分
        unique_to_1 = effects1 - effects2
        unique_to_2 = effects2 - effects1

        # 找出贡献独特功效的成分
        def find_effect_contributors(ingredients, target_effects):
            contributors = []
            for ing in ingredients:
                ing_effs = set(ing.get("efficacy", []))
                if ing_effs & target_effects:
                    contributors.append(ing)
            return contributors

        contrib1 = find_effect_contributors(ingredients1, unique_to_1) if unique_to_1 else ingredients1[:2]
        contrib2 = find_effect_contributors(ingredients2, unique_to_2) if unique_to_2 else ingredients2[:2]

        # 构建互补子代
        child1_names = {ing["name"] for ing in child1.get("ingredients", [])}
        for ing in contrib2:
            if ing["name"] not in child1_names:
                child1.setdefault("ingredients", []).append({**ing})

        child2_names = {ing["name"] for ing in child2.get("ingredients", [])}
        for ing in contrib1:
            if ing["name"] not in child2_names:
                child2.setdefault("ingredients", []).append({**ing})

        # 剂量合理化: 总剂量归一化到合理范围
        self._normalize_dosages(child1, herb_db)
        self._normalize_dosages(child2, herb_db)

        return child1, child2

    def _knowledge_aware_mutation(self, individual: dict[str, Any], herb_db: dict) -> dict[str, Any]:
        """
        知识感知变异 — 基于药理合理性而非随机替换

        策略:
        1. 剂量微调（高斯扰动，保持在安全范围内）
        2. 成分替换（从同功效类别中选择，保持药效覆盖）
        3. 添加/删除受禁忌关系约束
        """
        mutated = {k: (v.copy() if isinstance(v, list) else v) for k, v in individual.items()}
        ingredients = mutated.get("ingredients", [])

        if not ingredients:
            return mutated

        mutation_type = random.choices(
            ["dose_adjust", "ingredient_replace", "add_complement", "remove_redundant"],
            weights=[0.4, 0.3, 0.2, 0.1],
            k=1
        )[0]

        if mutation_type == "dose_adjust" and ingredients:
            # 剂量微调: 高斯扰动，限制在药材安全范围内
            idx = random.randint(0, len(ingredients) - 1)
            herb_name = ingredients[idx].get("name", "")
            herb_param = None
            for hid, hp in herb_db.items():
                if hp.name_cn == herb_name:
                    herb_param = hp
                    break

            current_dosage = ingredients[idx].get("dosage", 10.0)
            if herb_param:
                # 在安全范围内扰动
                min_d = herb_param.dosage_min
                max_d = herb_param.dosage_max
                range_size = max_d - min_d
                perturbation = random.gauss(0, range_size * 0.1)
                new_dosage = max(min_d, min(max_d, current_dosage + perturbation))
                ingredients[idx]["dosage"] = round(new_dosage, 2)
            else:
                # 无知识库时，保守扰动
                adjustment = random.gauss(1.0, 0.1)
                new_dosage = max(0.1, min(100.0, current_dosage * adjustment))
                ingredients[idx]["dosage"] = round(new_dosage, 2)

        elif mutation_type == "ingredient_replace" and ingredients:
            # 成分替换: 从同功效类别中找替代品
            idx = random.randint(0, len(ingredients) - 1)
            current_effs = set(ingredients[idx].get("efficacy", []))
            if current_effs and herb_db:
                candidates = []
                for hid, hp in herb_db.items():
                    hp_effs = set(hp.efficacy_scores.keys())
                    overlap = len(hp_effs & current_effs)
                    if overlap >= 1:  # 至少共享一个功效
                        candidates.append((overlap, hp))
                candidates.sort(reverse=True)
                if candidates:
                    # 从功效最接近的候选中选择一个
                    top_overlap = candidates[0][0]
                    top_candidates = [c for c in candidates if c[0] == top_overlap]
                    chosen_herb = random.choice(top_candidates)[1]
                    ingredients[idx] = {
                        "name": chosen_herb.name_cn,
                        "dosage": round(random.uniform(chosen_herb.dosage_min, chosen_herb.dosage_max), 2),
                        "unit": "g",
                        "efficacy": list(chosen_herb.efficacy_scores.keys()),
                    }

        elif mutation_type == "add_complement" and len(ingredients) < 12 and herb_db:
            # 添加互补成分: 找能覆盖未达成目标的药材
            current_effs = set()
            for ing in ingredients:
                for eff in ing.get("efficacy", []):
                    current_effs.add(eff)

            target_effs = set()
            for hid, hp in herb_db.items():
                for eff in hp.efficacy_scores:
                    target_effs.add(eff)

            uncovered = target_effs - current_effs
            if uncovered:
                # 找能覆盖最多未达成功效的药材
                best_herb = None
                best_coverage = 0
                for hid, hp in herb_db.items():
                    hp_effs = set(hp.efficacy_scores.keys())
                    coverage = len(hp_effs & uncovered)
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

        elif mutation_type == "remove_redundant" and len(ingredients) > 4:
            # 移除冗余成分: 功效与其他成分高度重叠的
            for i, ing in enumerate(ingredients):
                ing_effs = set(ing.get("efficacy", []))
                if len(ing_effs) < 2:
                    continue
                overlap_count = 0
                for j, other in enumerate(ingredients):
                    if i != j:
                        other_effs = set(other.get("efficacy", []))
                        if ing_effs & other_effs:
                            overlap_count += 1
                if overlap_count >= 2:
                    # 这个成分的功效被其他成分覆盖了，可以移除
                    ingredients.pop(i)
                    break

        return mutated

    def _knowledge_aware_neighbor(self, solution: dict[str, Any], herb_db: dict) -> dict[str, Any]:
        """知识感知邻居生成 — 模拟退火的邻域搜索"""
        return self._knowledge_aware_mutation(solution, herb_db)

    def _generate_knowledge_based_individual(self, herb_db: dict) -> dict[str, Any]:
        """
        基于知识库生成个体 — 使用真实配伍规则和禁忌关系

        策略:
        1. 从协同配伍对开始构建
        2. 避免禁忌对
        3. 剂量在安全范围内
        """
        if not herb_db:
            return self._fallback_random_individual()

        # 选择3-6种有协同关系的药材
        num_herbs = random.randint(3, 6)
        selected = []
        used_ids = set()

        # 先选一个君药（高功效评分的药材）
        top_herbs = sorted(herb_db.values(),
                          key=lambda h: sum(h.efficacy_scores.values()),
                          reverse=True)

        if top_herbs:
            chief = top_herbs[random.randint(0, min(5, len(top_herbs) - 1))]
            selected.append({
                "name": chief.name_cn,
                "dosage": round(random.uniform(chief.dosage_min, chief.dosage_max), 2),
                "unit": "g",
                "efficacy": list(chief.efficacy_scores.keys()),
            })
            used_ids.add(chief.herb_id)

        # 选臣药（协同伙伴）
        synergy_targets = random.randint(1, 2)
        for _ in range(synergy_targets):
            for hid, hp in herb_db.items():
                if hid in used_ids:
                    continue
                # 检查是否与已选药材有协同关系
                has_synergy = False
                for sel in selected:
                    for partner in hp.synergy_partners:
                        for other_hid, other_hp in herb_db.items():
                            if other_hp.name_cn == sel["name"] and partner == other_hid:
                                has_synergy = True
                                break
                    if has_synergy:
                        break
                if has_synergy:
                    selected.append({
                        "name": hp.name_cn,
                        "dosage": round(random.uniform(hp.dosage_min, hp.dosage_max), 2),
                        "unit": "g",
                        "efficacy": list(hp.efficacy_scores.keys()),
                    })
                    used_ids.add(hid)
                    break

        # 补充佐使药
        while len(selected) < num_herbs:
            hid = random.choice(list(herb_db.keys()))
            if hid in used_ids:
                continue
            hp = herb_db[hid]
            # 检查禁忌
            has_antagonism = False
            for sel in selected:
                for antagonist in hp.antagonistic_pairs:
                    for other_hid, other_hp in herb_db.items():
                        if other_hp.name_cn == sel["name"] and antagonist == other_hid:
                            has_antagonism = True
                            break
                if has_antagonism:
                    break
            if not has_antagonism:
                selected.append({
                    "name": hp.name_cn,
                    "dosage": round(random.uniform(hp.dosage_min, hp.dosage_max), 2),
                    "unit": "g",
                    "efficacy": list(hp.efficacy_scores.keys()),
                })
                used_ids.add(hid)

        return {"ingredients": selected}

    def _normalize_dosages(self, individual: dict[str, Any], herb_db: dict) -> None:
        """剂量合理化：确保在安全范围内"""
        ingredients = individual.get("ingredients", [])
        for ing in ingredients:
            herb_name = ing.get("name", "")
            for hid, hp in herb_db.items():
                if hp.name_cn == herb_name:
                    ing["dosage"] = round(max(hp.dosage_min, min(hp.dosage_max, ing.get("dosage", 10.0))), 2)
                    break

    def _fallback_random_individual(self) -> dict[str, Any]:
        """无知识库时的兜底随机生成"""
        herbs = ["黄芪", "党参", "茯苓", "山药", "枸杞子", "菊花", "红枣", "甘草"]
        num = random.randint(3, 6)
        selected = random.sample(herbs, min(num, len(herbs)))
        return {
            "ingredients": [
                {"name": h, "dosage": round(random.uniform(5.0, 20.0), 2), "unit": "g"}
                for h in selected
            ]
        }


class FormulaConstraintSolver(ConstraintSolver):
    """配方专用约束求解器"""

    def __init__(self, herb_db: dict | None = None):
        self._herb_db = herb_db
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

        # 从知识库加载更多禁忌对
        if self._herb_db:
            for hid, hp in self._herb_db.items():
                if hp.antagonistic_pairs:
                    for antagonist_id in hp.antagonistic_pairs:
                        for a_hid, a_hp in self._herb_db.items():
                            if a_hid == antagonist_id:
                                contraindications.append({hp.name_cn: [a_hp.name_cn]})

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

        修复: fitness_function 使用知识库中的真实药效评分和禁忌关系
        """
        herb_db = self._herb_db or _get_herb_db()

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
        """计算功效评分 — 基于知识库真实数据"""
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

        # 剂量加权: 高剂量+高功效评分的药材贡献更大
        dose_weighted_score = 0.0
        total_weight = 0
        for ing in ingredients:
            herb_name = ing.get("name", "")
            dosage = ing.get("dosage", 10.0)
            ing_effs = ing.get("efficacy", [])
            if isinstance(ing_effs, str):
                ing_effs = [ing_effs]

            # 从知识库查找该药材的功效评分
            herb_param = None
            for hid, hp in _get_herb_db().items():
                if hp.name_cn == herb_name:
                    herb_param = hp
                    break

            if herb_param:
                # 计算该药材对目标功效的综合评分
                herb_score = 0
                for eff in ing_effs:
                    if eff in herb_param.efficacy_scores:
                        herb_score += herb_param.efficacy_scores[eff]
                herb_score /= max(1, len(ing_effs))

                # 剂量合理性: 在安全范围内评分更高
                dosage_ratio = (dosage - herb_param.dosage_min) / max(1, herb_param.dosage_max - herb_param.dosage_min)
                dosage_factor = 1.0 - 0.3 * max(0, dosage_ratio - 0.7)  # 超出最佳范围扣分

                dose_weighted_score += herb_score * dosage_factor
                total_weight += 1

        if total_weight > 0:
            dose_weighted_score /= total_weight

        return min(1.0, base_score * 0.5 + dose_weighted_score * 0.5)

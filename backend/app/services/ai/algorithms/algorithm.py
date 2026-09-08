"""
NSGA-II 算法核心 — 遗传算法引擎

包含：
- 非支配排序
- 拥挤度距离分配
- SBX 交叉 + 多项式变异
- 锦标赛选择
- 小生境清除
- 种群初始化
- 加权 GA 优化
"""
from __future__ import annotations

import copy
import logging
import math
import random
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

from .models import (
    MultiObjectiveIndividual,
    OptimizationConfig,
    OptimizationObjective,
)

logger = logging.getLogger(__name__)


class NSGAIIOptimizer:
    """NSGA-II 多目标遗传算法配方优化器"""

    def __init__(self, config: Optional[OptimizationConfig] = None):
        self.config = config or OptimizationConfig(
            objectives=[
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.30),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.25),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.10),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.15),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.10),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
            ]
        )
        self._herb_knowledge_loaded = False
        self.evaluator = None  # FormulaEvaluator 注入点
        self._candidate_herbs: List[str] = []

    def _get_herb_db(self) -> Dict[str, Any]:
        """获取药材数据库（带回退到内置库）"""
        if self.evaluator is not None and self.evaluator.herb_db:
            return self.evaluator.herb_db
        from .bayesian_formula_optimizer import _BUILTIN_HERBS
        return _BUILTIN_HERBS

    def _get_efficacy_map(self) -> Dict[str, List[str]]:
        """获取功效-药材索引（带回退到内置索引）"""
        if self.evaluator is not None and self.evaluator.efficacy_map:
            return self.evaluator.efficacy_map
        from .bayesian_formula_optimizer import _EFFICACY_TO_HERBS
        return _EFFICACY_TO_HERBS

    def _enforce_exclusions(self, individual: MultiObjectiveIndividual, exclude_set: set) -> None:
        """移除个体中排除的药材，确保约束生效（包括交叉/变异后）"""
        if not exclude_set:
            return
        removed = [hid for hid in list(individual.genes.keys()) if hid in exclude_set]
        for hid in removed:
            del individual.genes[hid]
        # 确保至少保留3味药
        if len(individual.genes) < 3 and exclude_set:
            # 随机保留最小剂量的药材
            sorted_herbs = sorted(individual.genes.items(), key=lambda x: x[1])
            keep = sorted_herbs[:3]
            individual.genes = dict(keep)

    def _evaluate_individual(self, individual, config) -> None:
        """评估个体（evaluator可用时用evaluator，否则用内置逻辑回退）"""
        if self.evaluator is not None:
            self.evaluator.evaluate_full(individual, config)
            return
        # 回退评估：使用内置药材库计算基本评分
        from .bayesian_formula_optimizer import _BUILTIN_HERBS
        herbs = _BUILTIN_HERBS
        genes = individual.genes
        if not genes:
            individual.fitness = 0.0
            return
        total_dosage = sum(genes.values())
        # 简化评分：基于安全性和剂量合理性
        safety_sum = 0.0
        for hid, dosage in genes.items():
            if hid in herbs:
                herb = herbs[hid]
                ratio = (dosage - herb.dosage_min) / max(herb.dosage_max - herb.dosage_min, 0.01)
                safety_sum += herb.safety_index * (1 - 0.2 * ratio)
        individual.safety = safety_sum / max(len(genes), 1)
        individual.efficacy = 0.5  # 默认中等功效
        individual.taste = 0.6
        individual.cost = 0.7
        individual.synergy = 0.5
        individual.stability = 0.6
        individual.fitness = (
            individual.efficacy * 0.30 +
            individual.safety * 0.25 +
            individual.taste * 0.10 +
            individual.cost * 0.15 +
            individual.synergy * 0.10 +
            individual.stability * 0.10
        )

    def _try_load_herb_knowledge(self) -> None:
        """惰性加载 HerbKnowledgeService"""
        if self._herb_knowledge_loaded:
            return
        self._herb_knowledge_loaded = True
        try:
            from .herb_knowledge_service import get_global_herb_knowledge
            hk = get_global_herb_knowledge()
            if hk is not None:
                from .evaluator import FormulaEvaluator
                self.evaluator = FormulaEvaluator(herb_knowledge=hk)
                self.evaluator._load_herbs_sync()
                logger.info("[NSGA-II] 惰性加载 HerbKnowledgeService 成功")
            else:
                logger.debug("[NSGA-II] HerbKnowledgeService 返回 None")
        except Exception as e:
            logger.warning(f"[NSGA-II] 惰性加载 HerbKnowledgeService 失败: {e}")

    async def optimize_async(self, target_effects: List[str] = None,
                             constraints: Dict = None) -> Tuple[List[MultiObjectiveIndividual], List[Dict]]:
        """异步版本的 NSGA-II 优化流程"""
        await self._ensure_herbs_loaded()
        return self.optimize(target_effects, constraints)

    def optimize(self, target_effects: List[str] = None,
                 constraints: Dict = None,
                 _cancel_signal: Optional[threading.Event] = None) -> Tuple[List[MultiObjectiveIndividual], List[Dict]]:
        """执行多目标优化流程"""
        if self.config.mode == "weighted":
            return self._optimize_weighted(target_effects, constraints, _cancel_signal)
        if self.config.mode == "epsilon":
            logger.info("[NSGA-II] mode=epsilon 暂 alias 到 pareto 模式")
        return self._optimize_pareto(target_effects, constraints, _cancel_signal)

    def _optimize_pareto(self, target_effects: List[str], constraints: Dict,
                         _cancel_signal: Optional[threading.Event]) -> Tuple[List[MultiObjectiveIndividual], List[Dict]]:
        return self._run_nsga2_loop(target_effects, constraints, _cancel_signal)

    async def _ensure_herbs_loaded(self):
        """优先从 HerbKnowledgeService 加载最新药材数据"""
        if self.evaluator:
            await self.evaluator._ensure_herbs_loaded()

    # ──────────────────────────────────────────
    # NSGA-II 主循环
    # ──────────────────────────────────────────

    def _run_nsga2_loop(self, target_effects: List[str], constraints: Dict,
                        _cancel_signal: Optional[threading.Event] = None,
                        progress_callback: Optional[callable] = None) -> Tuple[List[MultiObjectiveIndividual], List[Dict]]:
        """NSGA-II Pareto 前沿优化主体循环"""
        constraints = constraints or {}
        effective_constraints = dict(constraints)
        # 翻译功效ID：前端发送中文label，后端索引使用中医术语键
        from .genetic_formula_optimizer import _translate_effect_ids
        translated_effects = _translate_effect_ids(target_effects or [])
        if translated_effects:
            effective_constraints["target_effects"] = translated_effects
        self.config.constraints = effective_constraints

        self._try_load_herb_knowledge()

        # 特殊人群禁忌药材硬排除
        population_exclude = set(constraints.get("exclude_herbs", []))
        sp = (constraints.get("special_population") or "adult")
        if sp == "pregnant":
            population_exclude |= {"cs", "dg", "fz", "mld", "lk"}
        elif sp == "children":
            population_exclude |= {"fz", "lk", "mld"}
        elif sp == "elderly":
            population_exclude |= {"rs"}
        effective_constraints["exclude_herbs"] = list(population_exclude)

        candidate_herbs = self._select_herbs(translated_effects or [], effective_constraints)
        if len(candidate_herbs) < 3:
            logger.warning(f"[NSGA-II] 候选药材不足 ({len(candidate_herbs)})")
            return [], []

        self._candidate_herbs = candidate_herbs
        logger.info(f"[NSGA-II] 种群={self.config.population_size}, 代数={self.config.generations}, "
                    f"候选药材={len(candidate_herbs)}种, 模式={self.config.mode}")

        exclude_set = set(effective_constraints.get("exclude_herbs", []))
        population = self._init_population(candidate_herbs, translated_effects, exclude_set)
        for ind in population:
            self._evaluate_individual(ind, self.config)

        best_fitness = max((ind.fitness for ind in population), default=0.0)
        history: List[Dict] = []
        no_improve_count = 0
        stop_reason: str = "completed"

        for gen in range(self.config.generations):
            diversity = self._compute_diversity(population)
            fitnesses_now = [ind.fitness for ind in population]
            avg_fit_now = math.fsum(fitnesses_now) / len(fitnesses_now)
            min_fit_now = min(fitnesses_now)

            # 取消信号检查
            if _cancel_signal is not None and _cancel_signal.is_set():
                logger.info("[NSGA-II] 收到取消信号，提前终止进化")
                history.append({
                    "generation": gen + 1, "best_fitness": round(best_fitness, 6),
                    "avg_fitness": round(avg_fit_now, 6), "min_fitness": round(min_fit_now, 6),
                    "diversity": round(diversity, 6), "stop_reason": "cancelled",
                })
                fronts = self._fast_non_dominated_sort(population)
                cancelled_pareto = fronts[0][:self.config.pareto_front_size] if fronts else population[:self.config.pareto_front_size]
                return cancelled_pareto, history

            # 种群恢复机制
            if diversity < 0.15:
                recovery_count = max(1, int(self.config.population_size * 0.2))
                logger.info(f"[NSGA-II] 多样性过低 ({diversity:.4f})，注入 {recovery_count} 个随机个体")
                for _ in range(recovery_count):
                    genes: Dict[str, float] = {}
                    for hid in self._candidate_herbs:
                        if hid in self._get_herb_db() and random.random() > 0.3:
                            herb = self._get_herb_db()[hid]
                            dosage = herb.dosage_min + random.random() * (herb.dosage_max - herb.dosage_min)
                            dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                            genes[hid] = max(herb.dosage_min, min(herb.dosage_max, dosage))
                    if len(genes) >= 3:
                        ind = MultiObjectiveIndividual(genes)
                        self._evaluate_individual(ind, self.config)
                        population.append(ind)

            # 非支配排序 + 拥挤度
            fronts = self._fast_non_dominated_sort(population)
            for front in fronts:
                self._crowding_distance_assignment(front)

            # 锦标赛选择生成子代
            offspring = []
            while len(offspring) < self.config.population_size:
                parent1 = self._nsga2_tournament_select(population)
                parent2 = self._nsga2_tournament_select(population)

                if random.random() < self.config.crossover_rate:
                    child1, child2 = self._sbx_crossover(parent1, parent2)
                else:
                    child1, child2 = parent1.copy(), parent2.copy()

                actual_mutation_rate = self._adaptive_mutation_rate(diversity)
                if random.random() < actual_mutation_rate:
                    self._polynomial_mutation(child1, candidate_herbs)
                if random.random() < actual_mutation_rate:
                    self._polynomial_mutation(child2, candidate_herbs)

                self._evaluate_individual(child1, self.config)
                self._evaluate_individual(child2, self.config)

                # 约束后置过滤：确保交叉/变异不引入排除药材
                self._enforce_exclusions(child1, exclude_set)
                self._enforce_exclusions(child2, exclude_set)

                offspring.append(child1)
                if len(offspring) < self.config.population_size:
                    offspring.append(child2)

            # 精英保留：先对父代也执行约束过滤，确保禁药不进入下一轮
            combined = population + offspring
            for ind in combined:
                self._enforce_exclusions(ind, exclude_set)
            fronts = self._fast_non_dominated_sort(combined)
            for front in fronts:
                self._crowding_distance_assignment(front)

            new_population: List[MultiObjectiveIndividual] = []
            for front in fronts:
                if len(new_population) + len(front) <= self.config.population_size:
                    new_population.extend(front)
                else:
                    remaining = self.config.population_size - len(new_population)
                    front_sorted = sorted(front, key=lambda x: x.crowding_distance, reverse=True)
                    new_population.extend(front_sorted[:remaining])
                    break

            population = new_population

            # 小生境清除
            population = self._niching_clearing(population)

            # 重算拥挤度
            fronts_after_clearing = self._fast_non_dominated_sort(population)
            for front in fronts_after_clearing:
                self._crowding_distance_assignment(front)

            # 早停检测
            current_best = max((ind.fitness for ind in population), default=0.0)
            if current_best > best_fitness + 1e-9:
                best_fitness = current_best
                no_improve_count = 0
            else:
                no_improve_count += 1

            history.append({
                "generation": gen + 1, "best_fitness": round(best_fitness, 6),
                "avg_fitness": round(avg_fit_now, 6), "min_fitness": round(min_fit_now, 6),
                "diversity": round(diversity, 6), "fronts_count": len(fronts),
                "pareto_front_size": len(fronts[0]) if fronts else 0,
                "adaptive_mutation_rate": round(actual_mutation_rate, 6),
            })

            if progress_callback:
                try:
                    progress_callback({
                        "generation": gen + 1,
                        "best_fitness": round(best_fitness, 6),
                        "avg_fitness": round(avg_fit_now, 6),
                        "min_fitness": round(min_fit_now, 6),
                        "diversity": round(diversity, 6),
                    })
                except Exception:
                    pass

            if (gen + 1) % 10 == 0:
                logger.info(f"  Gen {gen+1}/{self.config.generations}, Best: {best_fitness:.4f}, "
                           f"Avg: {avg_fit_now:.4f}, ParetoFront: {len(fronts[0]) if fronts else 0}, Div: {diversity:.4f}")

            should_stop = False
            if self.config.early_stop_threshold > 0 and best_fitness >= self.config.early_stop_threshold:
                stop_reason = "early_stop_threshold"
                should_stop = True
            if not should_stop and self.config.early_stop_patience > 0 and no_improve_count >= self.config.early_stop_patience:
                stop_reason = "early_stop_patience"
                should_stop = True
            if should_stop:
                logger.info(f"[NSGA-II] 早停触发 ({stop_reason}), 于第 {gen + 1} 代停止")
                if history:
                    history[-1]["stop_reason"] = stop_reason
                break

        final_pareto = self._extract_pareto_front(population)
        return final_pareto, history

    def _optimize_weighted(self, target_effects: List[str], constraints: Dict,
                           _cancel_signal: Optional[threading.Event]) -> Tuple[List[MultiObjectiveIndividual], List[Dict]]:
        """加权标量化简单GA"""
        constraints = constraints or {}
        effective_constraints = dict(constraints)
        # 翻译功效ID + 特殊人群硬排除（与 Pareto 路径保持一致）
        from .genetic_formula_optimizer import _translate_effect_ids
        translated_effects = _translate_effect_ids(target_effects or [])
        if translated_effects:
            effective_constraints["target_effects"] = translated_effects
        # 特殊人群禁忌药材硬排除
        population_exclude = set(constraints.get("exclude_herbs", []))
        sp = (constraints.get("special_population") or "adult")
        if sp == "pregnant":
            population_exclude |= {"cs", "dg", "fz", "mld", "lk"}
        elif sp == "children":
            population_exclude |= {"fz", "lk", "mld"}
        elif sp == "elderly":
            population_exclude |= {"rs"}
        effective_constraints["exclude_herbs"] = list(population_exclude)
        self.config.constraints = effective_constraints

        if self.config.seed is not None:
            random.seed(self.config.seed)

        self._try_load_herb_knowledge()

        candidate_herbs = self._select_herbs(translated_effects or [], effective_constraints)
        if len(candidate_herbs) < 3:
            logger.warning(f"[NSGA-II/weighted] 候选药材不足 ({len(candidate_herbs)})")
            return [], []

        self._candidate_herbs = candidate_herbs
        logger.info(f"[NSGA-II/weighted] 加权GA: 种群={self.config.population_size}, "
                    f"代数={self.config.generations}, 候选={len(candidate_herbs)}种")

        exclude_set = set(effective_constraints.get("exclude_herbs", []))
        population = self._init_population(candidate_herbs, translated_effects, exclude_set)
        for ind in population:
            self._evaluate_individual(ind, self.config)

        best_fitness = max((ind.fitness for ind in population), default=0.0)
        history: List[Dict] = []
        no_improve_count = 0
        stop_reason = "completed"

        for gen in range(self.config.generations):
            if _cancel_signal is not None and _cancel_signal.is_set():
                fitnesses_now = [ind.fitness for ind in population]
                history.append({
                    "generation": gen + 1, "best_fitness": round(best_fitness, 6),
                    "avg_fitness": round(sum(fitnesses_now) / len(fitnesses_now), 6),
                    "min_fitness": round(min(fitnesses_now), 6),
                    "diversity": round(self._compute_diversity(population), 6),
                    "stop_reason": "cancelled",
                })
                return population[:self.config.pareto_front_size], history

            new_population = []
            n_elite = max(1, int(self.config.population_size * self.config.elite_ratio))
            new_population.extend(population[:n_elite])

            diversity = self._compute_diversity(population)
            actual_mutation_rate = self._adaptive_mutation_rate(diversity)

            while len(new_population) < self.config.population_size:
                p1 = self._weighted_tournament_select(population)
                p2 = self._weighted_tournament_select(population)

                if random.random() < self.config.crossover_rate:
                    child1, child2 = self._sbx_crossover(p1, p2)
                else:
                    child1, child2 = p1.copy(), p2.copy()

                if random.random() < actual_mutation_rate:
                    self._polynomial_mutation(child1, candidate_herbs)
                if random.random() < actual_mutation_rate:
                    self._polynomial_mutation(child2, candidate_herbs)

                self._evaluate_individual(child1, self.config)
                self._evaluate_individual(child2, self.config)

                # 约束后置过滤
                self._enforce_exclusions(child1, exclude_set)
                self._enforce_exclusions(child2, exclude_set)

                new_population.append(child1)
                if len(new_population) < self.config.population_size:
                    new_population.append(child2)

            population = new_population
            population.sort(key=lambda x: x.fitness, reverse=True)

            prev_best = best_fitness
            if population[0].fitness > best_fitness:
                best_fitness = population[0].fitness
                no_improve_count = 0
            else:
                no_improve_count += 1

            fitnesses = [ind.fitness for ind in population]
            history.append({
                "generation": gen + 1, "best_fitness": round(best_fitness, 6),
                "avg_fitness": round(sum(fitnesses) / len(fitnesses), 6),
                "min_fitness": round(min(fitnesses), 6),
                "diversity": round(diversity, 6), "stop_reason": "completed",
            })

            if progress_callback:
                try:
                    progress_callback({
                        "generation": gen + 1,
                        "best_fitness": round(best_fitness, 6),
                        "avg_fitness": round(sum(fitnesses) / len(fitnesses), 6),
                        "min_fitness": round(min(fitnesses), 6),
                        "diversity": round(diversity, 6),
                    })
                except Exception:
                    pass

            if (gen + 1) % 10 == 0:
                logger.info(f"  [weighted] Gen {gen+1}/{self.config.generations}, "
                           f"Best: {best_fitness:.4f}, Avg: {sum(fitnesses)/len(fitnesses):.4f}")

            should_stop = False
            if self.config.early_stop_threshold > 0 and best_fitness >= self.config.early_stop_threshold:
                stop_reason = "early_stop_threshold"
                should_stop = True
            if not should_stop and self.config.early_stop_patience > 0 and no_improve_count >= self.config.early_stop_patience:
                stop_reason = "early_stop_patience"
                should_stop = True
            if should_stop:
                logger.info(f"[NSGA-II/weighted] 早停 ({stop_reason}), 第{gen+1}代")
                break

        if history:
            history[-1]["stop_reason"] = stop_reason
        population.sort(key=lambda x: x.fitness, reverse=True)
        return population[:self.config.pareto_front_size], history

    # ──────────────────────────────────────────
    # NSGA-II 核心操作
    # ──────────────────────────────────────────

    def _fast_non_dominated_sort(self, population: List[MultiObjectiveIndividual]) -> List[List]:
        """快速非支配排序 O(MN^2)"""
        n = len(population)
        if n == 0:
            return []

        for p in population:
            p.domination_count = 0
            p.dominated_set = []

        fronts: List[List[MultiObjectiveIndividual]] = [[]]

        for i in range(n):
            p = population[i]
            for j in range(n):
                if i == j:
                    continue
                q = population[j]
                if self._dominates(p, q):
                    p.dominated_set.append(q)
                elif self._dominates(q, p):
                    p.domination_count += 1

            if p.domination_count == 0:
                p.rank = 1
                fronts[0].append(p)

        front_idx = 0
        while fronts[front_idx]:
            next_front: List[MultiObjectiveIndividual] = []
            for p in fronts[front_idx]:
                for q in p.dominated_set:
                    q.domination_count -= 1
                    if q.domination_count == 0:
                        q.rank = front_idx + 2
                        next_front.append(q)
            front_idx += 1
            fronts.append(next_front)

        if fronts and not fronts[-1]:
            fronts.pop()
        return fronts

    def _dominates(self, a: MultiObjectiveIndividual, b: MultiObjectiveIndividual) -> bool:
        """判断个体 a 是否支配个体 b"""
        at_least_one_better = False
        for obj in self.config.objectives:
            val_a = a.objectives.get(obj.key, 0.0)
            val_b = b.objectives.get(obj.key, 0.0)
            if obj.direction == "maximize":
                if val_a < val_b - 1e-9:
                    return False
                if val_a > val_b + 1e-9:
                    at_least_one_better = True
            else:
                if val_a > val_b + 1e-9:
                    return False
                if val_a < val_b - 1e-9:
                    at_least_one_better = True
        return at_least_one_better

    def _crowding_distance_assignment(self, front: List[MultiObjectiveIndividual]):
        """拥挤度距离分配"""
        n = len(front)
        if n <= 2:
            for ind in front:
                ind.crowding_distance = float('inf')
            return

        for ind in front:
            ind.crowding_distance = 0.0

        objective_keys = [obj.key for obj in self.config.objectives]
        for obj_key in objective_keys:
            sample_vals = [ind.objectives.get(obj_key) for ind in front]
            if all(v is None for v in sample_vals):
                continue

            front.sort(key=lambda x: x.objectives.get(obj_key, 0.0))
            front[0].crowding_distance = float('inf')
            front[-1].crowding_distance = float('inf')

            f_min = front[0].objectives.get(obj_key, 0.0)
            f_max = front[-1].objectives.get(obj_key, 0.0)
            f_range = f_max - f_min
            if f_range < 1e-12:
                continue

            for i in range(1, n - 1):
                distance = (front[i + 1].objectives.get(obj_key, 0.0) -
                            front[i - 1].objectives.get(obj_key, 0.0)) / f_range
                front[i].crowding_distance += distance

    def _nsga2_tournament_select(self, population: List[MultiObjectiveIndividual]) -> MultiObjectiveIndividual:
        """NSGA-II 锦标赛选择"""
        contestants = random.sample(
            population, min(self.config.tournament_size, len(population))
        )
        best = min(contestants, key=lambda x: (x.rank, -x.crowding_distance))
        return best.copy()

    def _weighted_tournament_select(self, population: List[MultiObjectiveIndividual]) -> MultiObjectiveIndividual:
        """加权GA锦标赛选择"""
        contestants = random.sample(
            population, min(self.config.tournament_size, len(population))
        )
        return max(contestants, key=lambda x: x.fitness).copy()

    def _sbx_crossover(self, parent1: MultiObjectiveIndividual, parent2: MultiObjectiveIndividual,
                       eta: float = 15.0) -> Tuple[MultiObjectiveIndividual, MultiObjectiveIndividual]:
        """SBX 模拟二进制交叉"""
        all_herbs = set(parent1.genes.keys()) | set(parent2.genes.keys())

        child1_genes: Dict[str, float] = {}
        child2_genes: Dict[str, float] = {}

        for hid in all_herbs:
            p1_val = parent1.genes.get(hid, 0.0)
            p2_val = parent2.genes.get(hid, 0.0)

            if p1_val <= 0 and p2_val <= 0:
                continue
            if p1_val <= 0 or p2_val <= 0:
                active_val = max(p1_val, p2_val)
                inherit = random.random() < 0.5
                if inherit:
                    child1_genes[hid] = active_val
                    child2_genes[hid] = active_val
                continue

            if hid in self._get_herb_db():
                herb = self._get_herb_db()[hid]
                lower = herb.dosage_min
                upper = herb.dosage_max
            else:
                lower = min(p1_val, p2_val) * 0.5
                upper = max(p1_val, p2_val) * 1.5

            if abs(upper - lower) < 1e-9:
                child1_genes[hid] = p1_val
                child2_genes[hid] = p2_val
                continue

            u = random.random()
            if u <= 0.5:
                beta_q = (2 * u) ** (1.0 / (eta + 1))
            else:
                beta_q = (1.0 / (2 * (1 - u))) ** (1.0 / (eta + 1))

            child1_val = 0.5 * ((1 + beta_q) * p1_val + (1 - beta_q) * p2_val)
            child2_val = 0.5 * ((1 - beta_q) * p1_val + (1 + beta_q) * p2_val)

            child1_val = max(lower, min(upper, child1_val))
            child2_val = max(lower, min(upper, child2_val))

            if hid in self._get_herb_db():
                step = self._get_herb_db()[hid].dosage_step
                child1_val = round(child1_val / step) * step
                child2_val = round(child2_val / step) * step

            child1_genes[hid] = child1_val
            child2_genes[hid] = child2_val

        return MultiObjectiveIndividual(child1_genes), MultiObjectiveIndividual(child2_genes)

    def _polynomial_mutation(self, individual: MultiObjectiveIndividual,
                             candidate_herbs: List[str], eta_m: float = 20.0):
        """多项式变异（增强版）"""
        herb_count = len(individual.genes)

        if herb_count <= self.config.min_ingredients:
            delete_prob = 0.0
            add_prob = 0.25
        elif herb_count >= self.config.max_ingredients:
            delete_prob = 0.35
            add_prob = 0.05
        else:
            delete_prob = 0.20
            add_prob = 0.15

        jun_herb_id = None
        if individual.genes:
            jun_herb_id = max(individual.genes.keys(), key=lambda k: individual.genes[k])

        for hid in list(individual.genes.keys()):
            if random.random() > 0.5:
                continue
            if hid not in self._get_herb_db():
                continue

            herb = self._get_herb_db()[hid]
            lower = herb.dosage_min
            upper = herb.dosage_max
            current_val = individual.genes[hid]

            if abs(upper - lower) < 1e-9:
                continue

            is_jun_herb = (hid == jun_herb_id)
            if is_jun_herb:
                perturbation_range = current_val * 0.15
                delta_val = (random.random() * 2 - 1) * perturbation_range
                new_val = current_val + delta_val
                new_val = round(new_val / herb.dosage_step) * herb.dosage_step
                new_val = max(lower, min(upper, new_val))
                if new_val < lower:
                    individual.genes[hid] = lower
                else:
                    individual.genes[hid] = new_val
                continue

            delta = (current_val - lower) / (upper - lower)
            u = random.random()

            if u <= 0.5:
                delta_q = (2 * u + (1 - 2 * u) * (1 - delta) ** (eta_m + 1)) ** (1.0 / (eta_m + 1)) - 1
            else:
                delta_q = 1 - (2 * (1 - u) + 2 * (u - 0.5) * (1 - (1 - delta) ** (eta_m + 1))) ** (1.0 / (eta_m + 1))

            new_val = current_val + delta_q * (upper - lower)
            new_val = round(new_val / herb.dosage_step) * herb.dosage_step

            should_delete = False
            if new_val < lower:
                if herb_count <= self.config.min_ingredients:
                    new_val = lower
                    should_delete = False
                elif random.random() < delete_prob:
                    should_delete = True
                else:
                    new_val = lower
                    should_delete = False

            if should_delete:
                del individual.genes[hid]
            else:
                individual.genes[hid] = min(upper, new_val)

        if random.random() < add_prob and candidate_herbs and herb_count < self.config.max_ingredients:
            new_h = random.choice(candidate_herbs)
            if new_h not in individual.genes and new_h in self._get_herb_db():
                herb = self._get_herb_db()[new_h]
                dosage = herb.dosage_min + random.random() * (herb.dosage_max - herb.dosage_min)
                dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                individual.genes[new_h] = max(herb.dosage_min, dosage)

    def _extract_pareto_front(self, population: List[MultiObjectiveIndividual]) -> List[MultiObjectiveIndividual]:
        """提取最终 Pareto 前沿"""
        fronts = self._fast_non_dominated_sort(population)
        if not fronts:
            return []
        pareto = fronts[0]
        pareto.sort(key=lambda x: x.crowding_distance, reverse=True)
        return pareto[:self.config.pareto_front_size]

    def _compute_diversity(self, population: List[MultiObjectiveIndividual]) -> float:
        """计算种群多样性（剂量感知欧氏距离，与 GA _compute_diversity 对齐）"""
        if len(population) < 2:
            return 1.0

        # 收集所有个体的所有药材ID
        all_herb_ids = set()
        for ind in population:
            all_herb_ids.update(ind.genes.keys())
        herb_ids = sorted(all_herb_ids)
        n_herbs = len(herb_ids)
        if n_herbs == 0:
            return 1.0

        # 构建归一化剂量向量
        herb_ranges: Dict[str, float] = {}
        for hid in herb_ids:
            herb = self._get_herb_db().get(hid)
            if herb:
                herb_ranges[hid] = max(herb.dosage_max - herb.dosage_min, 0.01)
            else:
                herb_ranges[hid] = 1.0

        vectors = []
        for ind in population:
            vec = []
            for hid in herb_ids:
                val = ind.genes.get(hid, 0.0)
                vec.append(val / herb_ranges.get(hid, 1.0))
            vectors.append(vec)

        # 成对欧氏距离
        total_dist = 0.0
        count = 0
        for i in range(len(vectors)):
            for j in range(i + 1, len(vectors)):
                sq = sum((a - b) ** 2 for a, b in zip(vectors[i], vectors[j]))
                total_dist += math.sqrt(sq)
                count += 1

        max_possible = math.sqrt(n_herbs) * count if count > 0 else 1
        return total_dist / max_possible

    def _adaptive_mutation_rate(self, diversity: float) -> float:
        """根据种群多样性动态调整实际变异概率"""
        base_rate = self.config.mutation_rate
        if not self.config.adaptive_mutation:
            return base_rate
        if diversity < 0.2:
            return min(base_rate * 2.5, 0.8)
        elif diversity < 0.4:
            return min(base_rate * 1.5, 0.6)
        elif diversity < 0.6:
            return base_rate
        else:
            return base_rate * 0.7

    def _niching_clearing(self, population: List[MultiObjectiveIndividual],
                          niche_radius: float = 0.15,
                          max_per_niche: int = 3) -> List[MultiObjectiveIndividual]:
        """小生境清除技术"""
        if len(population) <= max_per_niche:
            return list(population)

        objective_keys = [obj.key for obj in self.config.objectives]
        all_values: Dict[str, List[float]] = {k: [] for k in objective_keys}
        for ind in population:
            for k in objective_keys:
                all_values[k].append(ind.objectives.get(k, 0.0))

        norm_params: Dict[str, Tuple[float, float]] = {}
        for k in objective_keys:
            vals = all_values[k]
            v_min, v_max = min(vals), max(vals)
            norm_params[k] = (v_min, v_max - v_min if v_max - v_min > 1e-12 else 1.0)

        def get_normalized_vector(ind: MultiObjectiveIndividual) -> List[float]:
            return [
                (ind.objectives.get(k, 0.0) - norm_params[k][0]) / norm_params[k][1]
                for k in objective_keys
            ]

        sorted_pop = sorted(population, key=lambda x: x.fitness, reverse=True)
        cleared: List[MultiObjectiveIndividual] = []
        niche_centers: List[Tuple[List[float], int]] = []

        for ind in sorted_pop:
            vec = get_normalized_vector(ind)
            is_in_niche = False
            for center, count in niche_centers:
                dist = math.sqrt(sum((a - b) ** 2 for a, b in zip(vec, center)))
                if dist <= niche_radius:
                    if count < max_per_niche:
                        is_in_niche = True
                        break
            if not is_in_niche:
                cleared.append(ind)
                niche_centers.append((vec, 1))
            else:
                for idx, (center, count) in enumerate(niche_centers):
                    dist = math.sqrt(sum((a - b) ** 2 for a, b in zip(vec, center)))
                    if dist <= niche_radius:
                        niche_centers[idx] = (center, count + 1)
                        break

        if len(cleared) < self.config.population_size * 0.6:
            remaining = [ind for ind in sorted_pop if ind not in cleared]
            cleared.extend(remaining[:self.config.population_size - len(cleared)])

        return cleared[:len(population)]

    def _select_herbs(self, target_effects: List[str],
                      constraints: Dict = None) -> List[str]:
        """根据目标功效选择候选药材"""
        constraints = constraints or {}
        exclude = set(constraints.get("exclude_herbs", []))
        include = set(constraints.get("include_herbs", []))
        herbs = self._get_herb_db()

        if not herbs:
            logger.error("[NSGA-II] 药材数据库为空！")
            return []

        candidate_set: Dict[str, float] = {}

        if target_effects:
            for effect in target_effects:
                if effect in self._get_efficacy_map():
                    for hid in self._get_efficacy_map()[effect]:
                        if hid not in exclude and hid in herbs:
                            score = herbs[hid].efficacy_scores.get(effect, 0)
                            candidate_set[hid] = max(candidate_set.get(hid, 0), score)
                else:
                    logger.warning(f"[NSGA-II] 功效 '{effect}' 未找到对应药材")

        # 用户强制包含的药材（基础配方），高优先级加入候选集
        for hid in include:
            if hid in herbs and hid not in exclude:
                candidate_set[hid] = 1.0

        if not candidate_set:
            logger.info("[NSGA-II] 无匹配药材，使用全部可用药材")
            for hid in herbs:
                if hid not in exclude:
                    herb = herbs[hid]
                    base_score = 0.5 + herb.safety_index * 0.3 - herb.cost_per_gram * 2
                    candidate_set[hid] = max(0.1, min(0.9, base_score))

        added_synergy = 0
        for hid in list(candidate_set.keys()):
            if hid in herbs:
                for p in herbs[hid].synergy_partners:
                    if p in herbs and p not in candidate_set and p not in exclude:
                        candidate_set[p] = 0.2
                        added_synergy += 1

        if added_synergy > 0:
            logger.info(f"[NSGA-II] 添加 {added_synergy} 种协同药材")

        sorted_h = sorted(candidate_set.keys(), key=lambda x: candidate_set[x], reverse=True)
        max_ingredients = constraints.get("max_ingredients", 15)
        selected = sorted_h[:max_ingredients]
        logger.info(f"[NSGA-II] 选择候选药材 {len(selected)} 种: {', '.join(selected)}")
        return selected

    def _init_population(self, candidates: List[str], target_effects: List[str] = None, exclude_herbs: Optional[set] = None) -> List[MultiObjectiveIndividual]:
        """初始化种群（TCM 经典方剂种子 + 功效最佳 + 随机采样）"""
        population = []
        n = len(candidates)

        # 种子 1: TCM 经典方剂
        classic_formulas = [
            {"四君子汤": {"ds": 12, "bq": 9, "fp": 9, "gq": 6}},
            {"六味地黄丸": {"gz": 9, "dg": 6, "bq": 6, "fp": 6, "mld": 4, "jgh": 4}},
            {"桂枝汤": {"sj": 6, "dcx": 9, "gq": 6, "hq": 9}},
            {"逍遥散": {"ds": 9, "fp": 9, "bq": 9, "dg": 6, "cs": 6, "sj": 3}},
            {"银翘散": {"cyh": 9, "jgh": 9, "gq": 6, "sj": 6, "ds": 9}},
        ]
        for formula_data in classic_formulas:
            formula_herbs = list(formula_data.values())[0]
            genes: Dict[str, float] = {}
            for hid, dosage in formula_herbs.items():
                if exclude_herbs and hid in exclude_herbs:
                    continue  # 跳过排除的药材
                if hid in self._get_herb_db():
                    herb = self._get_herb_db()[hid]
                    clamped = max(herb.dosage_min, min(herb.dosage_max, dosage))
                    clamped = round(clamped / herb.dosage_step) * herb.dosage_step
                    genes[hid] = max(herb.dosage_min, clamped)
            if len(genes) >= 3:
                population.append(MultiObjectiveIndividual(genes))

        # 种子 2: 功效最佳药材 + 随机打乱
        for i in range(min(5, n)):
            shuffled_candidates = list(candidates)
            random.shuffle(shuffled_candidates)
            genes: Dict[str, float] = {}
            for j, hid in enumerate(shuffled_candidates):
                if hid in self._get_herb_db():
                    herb = self._get_herb_db()[hid]
                    base_ratio = max(0.1, 1.0 - abs(j - i) * 0.15)
                    dosage = herb.dosage_min + base_ratio * (herb.dosage_max - herb.dosage_min)
                    dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                    dosage = max(herb.dosage_min, min(herb.dosage_max, dosage))
                    if dosage > 0:
                        genes[hid] = dosage
            if len(genes) < 3 and n >= 3:
                for hid in candidates[:3]:
                    if hid not in genes and hid in self._get_herb_db():
                        herb = self._get_herb_db()[hid]
                        genes[hid] = herb.dosage_min + random.random() * (herb.dosage_max - herb.dosage_min)
            population.append(MultiObjectiveIndividual(genes))

        # 随机采样填充剩余
        for _ in range(self.config.population_size - len(population)):
            genes: Dict[str, float] = {}
            selected_count = 0
            target_count = random.randint(3, min(6, len(candidates)))

            for idx, hid in enumerate(candidates):
                if hid in self._get_herb_db():
                    prob = 0.6 if idx < 10 else 0.3
                    if selected_count < target_count:
                        prob *= 1.5
                    if selected_count >= target_count:
                        prob *= 0.3

                    if random.random() < prob:
                        herb = self._get_herb_db()[hid]
                        ratio = random.random()
                        dosage = herb.dosage_min + ratio * (herb.dosage_max - herb.dosage_min)
                        dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                        dosage = max(herb.dosage_min, min(herb.dosage_max, dosage))
                        genes[hid] = dosage
                        selected_count += 1

            if len(genes) < 3:
                for hid in candidates[:min(5, len(candidates))]:
                    if hid not in genes and hid in self._get_herb_db():
                        herb = self._get_herb_db()[hid]
                        dosage = herb.dosage_min + random.random() * (herb.dosage_max - herb.dosage_min)
                        dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                        genes[hid] = max(herb.dosage_min, dosage)

            population.append(MultiObjectiveIndividual(genes))

        return population[:self.config.population_size]

    def generate_with_result(self, target_effects: List[str] = None,
                             constraints: Dict = None,
                             _cancel_signal: Optional[threading.Event] = None) -> 'MOGAResult':
        """带结果包装的入口方法"""
        start_time = time.perf_counter()

        candidates, history = self.optimize(
            target_effects=target_effects, constraints=constraints,
            _cancel_signal=_cancel_signal,
        )

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        pareto_front_coords = []
        for ind in candidates:
            coord = dict(ind.objectives)
            coord["fitness"] = round(ind.fitness, 6)
            coord["genes"] = {k: round(v, 2) for k, v in ind.genes.items()}
            pareto_front_coords.append(coord)

        best_by_objective: Dict[str, Dict] = {}
        for obj in self.config.objectives:
            best_ind = max(candidates, key=lambda x: x.objectives.get(obj.key, 0.0), default=None)
            if best_ind:
                best_by_objective[obj.key] = {
                    "genes": {k: round(v, 2) for k, v in best_ind.genes.items()},
                    "scores": {key: round(val, 4) for key, val in best_ind.objectives.items()},
                    "fitness": round(best_ind.fitness, 6),
                }

        convergence_gen = 0
        if candidates and history:
            final_best = max(ind.fitness for ind in candidates)
            if final_best > 0:
                for record in history:
                    if record.get("best_fitness", 0) >= final_best - 1e-9:
                        convergence_gen = record["generation"]
                        break

        total_evaluations = self.config.population_size * (
            history[-1]["generation"] if history else self.config.generations
        )

        valid_candidates = [c for c in candidates if len(c.genes) >= 3]
        single_herb_candidates = [c for c in candidates if len(c.genes) < 3]

        if len(valid_candidates) >= self.config.candidate_count:
            result_candidates = valid_candidates[:self.config.candidate_count]
        else:
            result_candidates = valid_candidates + single_herb_candidates[:self.config.candidate_count - len(valid_candidates)]

        logger.info(f"[NSGA-II] 最终候选: {len(result_candidates)} (有效: {len(valid_candidates)})")

        from .models import MOGAResult
        return MOGAResult(
            candidates=result_candidates,
            pareto_front=pareto_front_coords,
            history=history,
            algorithm="nsga2_genetic_algorithm",
            mode=self.config.mode,
            total_generations=history[-1]["generation"] if history else 0,
            total_evaluations=total_evaluations,
            best_by_objective=best_by_objective,
            execution_time_ms=round(elapsed_ms, 3),
            convergence_generation=convergence_gen,
            stop_reason=history[-1].get("stop_reason", "completed") if history else "completed",
            objectives_config=[
                {"name": o.name, "key": o.key, "direction": o.direction, "weight": o.weight}
                for o in self.config.objectives
            ],
        )

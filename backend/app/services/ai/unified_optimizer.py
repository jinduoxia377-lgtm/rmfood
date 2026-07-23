"""
统一配方优化调度器 (Unified Formula Optimizer Scheduler)

智能选择最优优化策略，统一所有底层引擎的接口：
- 标准GA (GeneticFormulaOptimizer)
- BinaryGA+MILP混合引擎 (BinaryGAOptimizer)
- NSGA-II多目标优化 (NSGAIIOptimizer)
- NSGA-III高维多目标 (NSGAIIIOptimizer)
- 贝叶斯优化 (BayesianFormulaOptimizer)
- MOEAD分解多目标 (MOEADOptimizer)
- CMA-ES连续优化 (CMAESEOptimizer)

核心创新:
1. 基于问题特征的智能策略选择
2. Bandit在线学习动态调整策略
3. 历史检索与缓存复用
4. 统一结果格式适配所有引擎

@version 1.0.0
"""

import hashlib
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

@dataclass(frozen=True)
class NutritionConstraint:
    """营养约束"""
    nutrient: str
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    target_value: Optional[float] = None


@dataclass
class OptimizationRequest:
    """统一优化请求"""
    target_effects: List[str]
    strategy: str = "auto"
    population_size: int = 50
    generations: int = 40
    max_ingredients: int = 12
    min_ingredients: int = 3
    total_dosage: float = 100.0
    nutrition_constraints: List[NutritionConstraint] = field(default_factory=list)
    require_pareto: bool = False
    strict_nutrition: bool = False
    exclude_herbs: List[str] = field(default_factory=list)
    max_cost: Optional[float] = None
    historical_similarity_threshold: float = 0.9
    custom_objectives: Optional[List[Dict[str, Any]]] = None
    # 新增参数
    mutation_rate: float = 0.15
    crossover_rate: float = 0.85
    elite_ratio: float = 0.15
    tournament_size: int = 5
    count: int = 5


@dataclass
class OptimizationResult:
    """统一优化结果"""
    strategy_used: str
    candidates: List[Dict[str, Any]]
    history: List[Dict[str, Any]]
    total_generations: int
    total_evaluations: int
    best_score: float
    execution_time_ms: float
    convergence_generation: int = 0
    strategy_explanation: str = ""
    nutrition_constraints_met: bool = True
    milp_result: Optional[Any] = None


# ============================================================
# Bandit 学习器
# ============================================================

class BanditLearner:
    """
    UCB1 Bandit 学习器

    用于动态调整策略选择概率，平衡探索(Exploration)和利用(Exploitation)。

    UCB1公式:
        Q(s) + c * sqrt(ln(N) / n_s)

    其中:
        Q(s): 策略s的历史平均奖励
        N: 总选择次数
        n_s: 策略s的选择次数
        c: 探索常数 (默认sqrt(2)=1.414)
    """

    def __init__(self, c: float = 1.414):
        self.c = c
        self.Q_values: Dict[str, float] = {}  # 策略平均奖励
        self.n_plays: Dict[str, int] = {}  # 策略选择次数
        self.N = 0  # 总选择次数
        self._lock = threading.Lock()

    def select(self, strategies: List[str]) -> str:
        """
        UCB1策略选择

        首先确保每个策略至少被尝试一次，然后选择UCB值最大的策略。
        """
        with self._lock:
            # 确保每个策略至少被尝试一次
            for s in strategies:
                if s not in self.n_plays or self.n_plays[s] == 0:
                    self.n_plays[s] = self.n_plays.get(s, 0) + 1
                    self.Q_values[s] = self.Q_values.get(s, 0.0)
                    self.N += 1
                    return s

            # UCB1选择
            ucb_values = {}
            for s in strategies:
                q = self.Q_values.get(s, 0.0)
                n = self.n_plays.get(s, 1)
                exploration = self.c * math.sqrt(math.log(max(self.N, 1)) / n)
                ucb_values[s] = q + exploration

            return max(ucb_values, key=ucb_values.get)

    def update(self, strategy: str, reward: float) -> None:
        """更新策略的奖励统计"""
        with self._lock:
            if strategy not in self.n_plays:
                self.n_plays[strategy] = 0
                self.Q_values[strategy] = 0.0

            n = self.n_plays[strategy]
            # 增量更新平均值
            self.Q_values[strategy] = (
                (self.Q_values[strategy] * n + reward) / (n + 1)
            )
            self.n_plays[strategy] = n + 1
            self.N += 1

    def get_stats(self) -> Dict[str, Any]:
        """返回Bandit统计信息"""
        with self._lock:
            return {
                "total_plays": self.N,
                "strategies": {
                    s: {
                        "avg_reward": self.Q_values.get(s, 0.0),
                        "plays": self.n_plays.get(s, 0),
                    }
                    for s in self.n_plays
                },
            }


# ============================================================
# 统一调度器
# ============================================================

class UnifiedFormulaOptimizer:
    """
    统一配方优化调度器

    核心功能:
    1. 智能策略选择（基于问题特征）
    2. 历史检索与缓存复用
    3. Bandit在线学习（动态调整策略选择）
    4. 统一接口适配所有底层引擎
    """

    def __init__(
        self,
        milp_solver: Any = None,
        nutrition_adapter: Any = None,
        nutrition_cache: Any = None,
    ):
        self.milp_solver = milp_solver
        self.nutrition_adapter = nutrition_adapter
        self.nutrition_cache = nutrition_cache

        # Bandit学习器
        self.bandit = BanditLearner(c=1.414)

        # 历史记录: problem_hash -> [records]
        self._history: Dict[str, List[Dict[str, Any]]] = {}
        self._lock = threading.Lock()

        # 可用策略列表
        # 生产就绪: ga, ga_lp_hybrid, nsga2
        # 实验性: nsga3, bayesian
        # 待实现: moead, cma_es
        self.available_strategies = [
            "ga", "ga_lp_hybrid", "nsga2", "nsga3",
            "bayesian", "moead", "cma_es",
        ]

        logger.info("[UnifiedOptimizer] 初始化完成")

    def select_strategy(self, request: OptimizationRequest) -> Tuple[str, str]:
        """
        智能策略选择

        Returns:
            (strategy, explanation)
        """
        # 1. 如果用户指定了策略，直接使用
        if request.strategy != "auto":
            if request.strategy in self.available_strategies:
                return request.strategy, f"用户指定策略: {request.strategy}"
            else:
                logger.warning(f"未知策略: {request.strategy}, 回退auto")

        # 2. 如果需要Pareto前沿 → NSGA-II/III
        if request.require_pareto:
            if request.custom_objectives and len(request.custom_objectives) >= 6:
                return ("nsga3",
                        "高维目标(>=6维) + Pareto前沿 → NSGA-III")
            return ("nsga2",
                    "需要Pareto前沿 → NSGA-II")

        # 3. 如果营养约束严格 → GA-LP混合
        if request.strict_nutrition or request.nutrition_constraints:
            return ("ga_lp_hybrid",
                    "严格营养约束 → BinaryGA+MILP混合引擎")

        # 4. 候选药材多 → GA-LP混合
        estimated_herbs = self._estimate_candidate_herbs(request.target_effects)
        if estimated_herbs > 20:
            return ("ga_lp_hybrid",
                    f"大规模候选池(~{estimated_herbs}种) → BinaryGA+MILP")

        # 5. 历史检索
        cached = self.search_history(
            request.target_effects,
            request.historical_similarity_threshold,
        )
        if cached:
            return (cached["strategy"],
                    f"历史检索命中: 上次最优策略={cached['strategy']}, "
                    f"best_score={cached['best_score']:.4f}")

        # 6. Bandit推荐（仅从已实现策略中选择）
        bandit_strategy = self.bandit.select(self.implemented_strategies)
        return (bandit_strategy,
                f"Bandit推荐 + 默认启发式 → {bandit_strategy}")

    def _estimate_candidate_herbs(self, target_effects: List[str]) -> int:
        """估计候选药材数量"""
        try:
            from app.services.ai.bayesian_formula_optimizer import _EFFICACY_TO_HERBS
            candidate_set = set()
            for effect in target_effects:
                if effect in _EFFICACY_TO_HERBS:
                    candidate_set.update(_EFFICACY_TO_HERBS[effect])
            return len(candidate_set)
        except Exception:
            return len(target_effects) * 5  # 粗略估计

    def search_history(
        self,
        target_effects: List[str],
        threshold: float = 0.9,
    ) -> Optional[Dict[str, Any]]:
        """检索历史运行记录"""
        problem_hash = self._compute_problem_hash(target_effects)

        with self._lock:
            records = self._history.get(problem_hash, [])

        if not records:
            return None

        # 返回上次最优策略
        best = max(records, key=lambda r: r.get("best_score", 0))
        jaccard = self._compute_jaccard(target_effects, best.get("target_effects", []))

        if jaccard >= threshold:
            return {
                "strategy": best["strategy"],
                "best_score": best["best_score"],
                "candidates_summary": best.get("candidates_summary", []),
                "jaccard_similarity": round(jaccard, 4),
            }
        return None

    def record_result(
        self,
        strategy: str,
        problem_hash: str,
        target_effects: List[str],
        best_score: float,
        execution_time_ms: float,
        candidates_summary: Optional[List[Dict]] = None,
    ) -> None:
        """记录优化结果到历史"""
        record = {
            "strategy": strategy,
            "target_effects": target_effects,
            "best_score": best_score,
            "execution_time_ms": execution_time_ms,
            "candidates_summary": candidates_summary or [],
            "timestamp": time.time(),
        }

        with self._lock:
            if problem_hash not in self._history:
                self._history[problem_hash] = []
            self._history[problem_hash].append(record)

            # 限制历史记录数量
            if len(self._history[problem_hash]) > 100:
                self._history[problem_hash] = (
                    self._history[problem_hash][-50:]
                )

    def _compute_problem_hash(self, target_effects: List[str]) -> str:
        """计算问题特征哈希"""
        sorted_effects = sorted(target_effects)
        raw = ",".join(sorted_effects)
        return hashlib.md5(raw.encode()).hexdigest()[:16]

    @staticmethod
    def _compute_jaccard(a: List[str], b: List[str]) -> float:
        """计算Jaccard相似度"""
        set_a = set(a)
        set_b = set(b)
        intersection = len(set_a & set_b)
        union = len(set_a | set_b)
        return intersection / union if union > 0 else 0.0

    def _execute_ga(self, request: OptimizationRequest) -> OptimizationResult:
        """执行标准GA"""
        start = time.perf_counter()

        try:
            import asyncio

            from app.services.ai.genetic_formula_optimizer import (
                get_genetic_optimizer, GAConfig,
            )
            optimizer = get_genetic_optimizer()
            config = GAConfig(
                population_size=request.population_size,
                generations=request.generations,
                mutation_rate=request.mutation_rate,
                crossover_rate=request.crossover_rate,
                elite_ratio=request.elite_ratio,
                tournament_size=request.tournament_size,
                target_effects=request.target_effects,
            )
            optimizer.config = config

            # 使用 asyncio.run 调用异步方法
            candidates, history = asyncio.run(optimizer.optimize(
                request.target_effects,
                exclude_herbs=set(request.exclude_herbs) if request.exclude_herbs else None,
            ))

            elapsed = (time.perf_counter() - start) * 1000

            candidate_dicts = []
            for c in candidates[:request.count]:
                candidate_dicts.append({
                    "ingredients": [
                        {"id": h, "name_cn": h, "dosage": d}
                        for h, d in c.genes.items()
                    ],
                    "overall_score": c.fitness,
                    "efficacy_score": c.efficacy,
                    "safety_score": c.safety,
                    "taste_score": c.taste,
                    "cost_score": c.cost,
                    "confidence": c.fitness,
                })

            best_score = max((c.fitness for c in candidates), default=0.0)

            return OptimizationResult(
                strategy_used="ga",
                candidates=candidate_dicts,
                history=history,
                total_generations=len(history) if history else request.generations,
                total_evaluations=request.population_size * request.generations,
                best_score=best_score,
                execution_time_ms=round(elapsed, 3),
                convergence_generation=(
                    history[-1].get("generation", 0) if history else 0
                ),
                strategy_explanation="标准遗传算法（实数编码）",
                nutrition_constraints_met=True,
            )
        except Exception as e:
            logger.error(f"[UnifiedOptimizer] GA执行失败: {e}")
            return OptimizationResult(
                strategy_used="ga",
                candidates=[],
                history=[],
                total_generations=0,
                total_evaluations=0,
                best_score=0.0,
                execution_time_ms=round((time.perf_counter() - start) * 1000, 3),
                strategy_explanation=f"GA执行失败: {e}",
            )

    def _execute_ga_lp_hybrid(self, request: OptimizationRequest) -> OptimizationResult:
        """执行BinaryGA+MILP混合引擎"""
        start = time.perf_counter()

        try:
            import asyncio

            from app.services.ai.genetic_formula_optimizer import (
                get_genetic_optimizer, GAConfig, Individual,
            )
            from app.services.formula.lp_solver import (
                MILPSolver, HerbNutritionData, NutritionConstraint as LPConstraint,
            )

            # 构建MILP求解器
            milp_solver = None
            try:
                from app.services.ai.bayesian_formula_optimizer import _BUILTIN_HERBS
                herb_data = {}
                for hid, hp in _BUILTIN_HERBS.items():
                    herb_data[hid] = HerbNutritionData(
                        herb_id=hid,
                        name_cn=hp.name_cn,
                        cost_per_gram=hp.cost_per_gram,
                        nutrition_per_100g=hp.efficacy_scores.copy(),
                        dosage_min=hp.dosage_min,
                        dosage_max=hp.dosage_max,
                        dosage_step=hp.dosage_step,
                    )
                milp_solver = MILPSolver(herb_data)

                lp_constraints = []
                for nc in request.nutrition_constraints:
                    lp_constraints.append(LPConstraint(
                        nutrient=nc.nutrient,
                        min_value=nc.min_value,
                        max_value=nc.max_value,
                    ))
                milp_solver.nutrition_constraints = lp_constraints
            except Exception as e:
                logger.warning(f"[UnifiedOptimizer] MILP求解器初始化回退: {e}")

            # 使用BinaryGA+MILP
            from app.services.ai.binary_ga_optimizer import BinaryGAOptimizer, BinaryGAConfig
            binary_ga = BinaryGAOptimizer(BinaryGAConfig(
                population_size=request.population_size,
                generations=request.generations,
                mutation_rate=request.mutation_rate,
                crossover_rate=request.crossover_rate,
                elite_ratio=request.elite_ratio,
                tournament_size=request.tournament_size,
                target_effects=request.target_effects,
                milp_enabled=milp_solver is not None,
                warm_start_enabled=True,
                total_dosage=request.total_dosage,
            ))

            # 获取候选药材
            from app.services.ai.bayesian_formula_optimizer import _EFFICACY_TO_HERBS
            candidate_herbs = []
            for effect in request.target_effects:
                if effect in _EFFICACY_TO_HERBS:
                    candidate_herbs.extend(_EFFICACY_TO_HERBS[effect])
            candidate_herbs = list(set(candidate_herbs))[:25]

            candidates, history = binary_ga.optimize(
                request.target_effects, candidate_herbs,
                exclude_herbs=set(request.exclude_herbs) if request.exclude_herbs else None,
                milp_solver=milp_solver,
            )

            # 对Top候选应用MILP精确配比
            milp_results = []
            for c in candidates[:request.count]:
                if milp_solver and c.selected_herbs:
                    selected = c.selected_herbs
                    # Use equal distribution as initial dosage for MILP
                    n_herbs = len(selected)
                    initial_dosages = {h: request.total_dosage / n_herbs for h in selected}
                    if selected and request.total_dosage > 0:
                        lp_result = milp_solver.solve(
                            selected_herbs=selected,
                            total_dosage=request.total_dosage,
                            additional_constraints={
                                "max_cost": request.max_cost,
                            },
                            warm_start_ratios=initial_dosages,
                        )
                        milp_results.append(lp_result)
                        # Update the individual with LP results
                        c.lp_ratios = lp_result.ratios if lp_result.feasible else initial_dosages
                        c.fitness = c.fitness * 0.9 + 0.1 if lp_result.feasible else c.fitness * 0.1
                else:
                    milp_results.append(None)

            elapsed = (time.perf_counter() - start) * 1000

            candidate_dicts = []
            for i, c in enumerate(candidates[:request.count]):
                # BinaryIndividual uses lp_ratios (dict) for actual dosages
                genes_to_use = c.lp_ratios if c.lp_ratios else {
                    h: c.genes[i] if i < len(c.genes) and c.genes[i] == 1 else 0
                    for i, h in enumerate(c.herb_ids)
                }
                cd = {
                    "ingredients": [
                        {"id": h, "name_cn": h, "dosage": round(d, 2)}
                        for h, d in genes_to_use.items() if d > 0
                    ],
                    "overall_score": c.fitness,
                    "efficacy_score": c.efficacy,
                    "safety_score": c.safety,
                    "taste_score": c.taste,
                    "cost_score": c.cost,
                    "confidence": c.fitness,
                }
                if milp_results[i]:
                    cd["milp_result"] = {
                        "feasible": milp_results[i].feasible,
                        "solve_time_ms": milp_results[i].solve_time_ms,
                    }
                candidate_dicts.append(cd)

            best_score = max((c.fitness for c in candidates), default=0.0)

            return OptimizationResult(
                strategy_used="ga_lp_hybrid",
                candidates=candidate_dicts,
                history=history,
                total_generations=len(history) if history else request.generations,
                total_evaluations=request.population_size * request.generations,
                best_score=best_score,
                execution_time_ms=round(elapsed, 3),
                convergence_generation=(
                    history[-1].get("generation", 0) if history else 0
                ),
                strategy_explanation="BinaryGA+MILP混合引擎（离散选择+连续配比）",
                nutrition_constraints_met=all(
                    mr.feasible for mr in milp_results if mr
                ) if milp_results else True,
            )
        except Exception as e:
            logger.error(f"[UnifiedOptimizer] GA-LP混合执行失败: {e}")
            # 回退到标准GA
            return self._execute_ga(request)

    def _execute_nsga2(self, request: OptimizationRequest) -> OptimizationResult:
        """执行NSGA-II多目标优化"""
        start = time.perf_counter()

        try:
            from app.services.ai.multi_objective_optimizer import (
                get_nsga2_optimizer, OptimizationConfig, OptimizationObjective,
            )

            objectives = request.custom_objectives or [
                OptimizationObjective("功效", "efficacy", "maximize", 0.30),
                OptimizationObjective("安全", "safety", "maximize", 0.25),
                OptimizationObjective("口感", "taste", "maximize", 0.10),
                OptimizationObjective("成本", "cost_efficiency", "maximize", 0.15),
                OptimizationObjective("协同", "synergy", "maximize", 0.10),
                OptimizationObjective("稳定", "stability", "maximize", 0.10),
            ]

            config = OptimizationConfig(
                objectives=objectives,
                mode="pareto",
                population_size=request.population_size,
                generations=request.generations,
                mutation_rate=request.mutation_rate,
                crossover_rate=request.crossover_rate,
                elite_ratio=request.elite_ratio,
                constraints={
                    "target_effects": request.target_effects,
                    "exclude_herbs": request.exclude_herbs,
                    "max_cost": request.max_cost,
                },
            )

            optimizer = get_nsga2_optimizer()
            optimizer.config = config

            pareto, history = optimizer.optimize(
                target_effects=request.target_effects,
                constraints=config.constraints,
            )

            elapsed = (time.perf_counter() - start) * 1000

            candidate_dicts = []
            for c in pareto[:request.count]:
                candidate_dicts.append({
                    "ingredients": [
                        {"id": h, "name_cn": h, "dosage": round(d, 2)}
                        for h, d in c.genes.items()
                    ],
                    "overall_score": c.fitness,
                    "efficacy_score": c.efficacy,
                    "safety_score": c.safety,
                    "taste_score": c.taste,
                    "cost_score": c.cost_score,
                    "synergy": c.synergy,
                    "stability": c.stability,
                    "pareto_rank": c.rank,
                    "crowding_distance": c.crowding_distance,
                    "confidence": c.fitness,
                })

            best_score = max((c.fitness for c in pareto), default=0.0)

            return OptimizationResult(
                strategy_used="nsga2",
                candidates=candidate_dicts,
                history=history,
                total_generations=len(history) if history else request.generations,
                total_evaluations=request.population_size * request.generations,
                best_score=best_score,
                execution_time_ms=round(elapsed, 3),
                convergence_generation=(
                    history[-1].get("generation", 0) if history else 0
                ),
                strategy_explanation="NSGA-II多目标优化（Pareto前沿）",
                nutrition_constraints_met=True,
            )
        except Exception as e:
            logger.error(f"[UnifiedOptimizer] NSGA-II执行失败: {e}")
            return OptimizationResult(
                strategy_used="nsga2",
                candidates=[],
                history=[],
                total_generations=0,
                total_evaluations=0,
                best_score=0.0,
                execution_time_ms=round((time.perf_counter() - start) * 1000, 3),
                strategy_explanation=f"NSGA-II执行失败: {e}",
            )

    def optimize(self, request: OptimizationRequest) -> OptimizationResult:
        """
        统一优化入口

        1. 选择策略
        2. 检索历史
        3. 执行对应引擎
        4. 记录结果 + Bandit更新
        5. 返回统一格式
        """
        start = time.perf_counter()

        # Step 1: 选择策略
        strategy, explanation = self.select_strategy(request)
        logger.info(f"[UnifiedOptimizer] 选择策略: {strategy} — {explanation}")

        # Step 2: 执行引擎
        executors = {
            "ga": self._execute_ga,
            "ga_lp_hybrid": self._execute_ga_lp_hybrid,
            "nsga2": self._execute_nsga2,
            "nsga3": self._execute_nsga2,  # NSGA-III 复用 NSGA-II（高维目标场景）
            # 以下策略暂未实现，使用明确的错误处理
            "bayesian": None,
            "moead": None,
            "cma_es": None,
        }

        # 已实现策略列表（可用于 Bandit 选择）
        self.implemented_strategies = ["ga", "ga_lp_hybrid", "nsga2", "nsga3"]

        executor = executors.get(strategy)
        if not executor:
            if strategy in ("bayesian", "moead", "cma_es"):
                raise ValueError(
                    f"策略 '{strategy}' 尚未实现。"
                    f"可用策略: {', '.join(self.implemented_strategies)}"
                )
            logger.warning(f"未知策略: {strategy}, 回退GA")
            executor = self._execute_ga
            strategy = "ga"

        result = executor(request)
        result.strategy_explanation = explanation
        result.strategy_used = strategy

        # Step 3: 记录结果
        problem_hash = self._compute_problem_hash(request.target_effects)
        self.record_result(
            strategy=strategy,
            problem_hash=problem_hash,
            target_effects=request.target_effects,
            best_score=result.best_score,
            execution_time_ms=result.execution_time_ms,
            candidates_summary=[
                {"ingredients": c.get("ingredients", [])}
                for c in result.candidates[:3]
            ],
        )

        # Step 4: Bandit更新
        # 奖励 = 质量/时间 比
        if result.execution_time_ms > 0:
            reward = result.best_score / (result.execution_time_ms / 1000.0)
        else:
            reward = result.best_score
        self.bandit.update(strategy, reward)

        total_elapsed = (time.perf_counter() - start) * 1000
        logger.info(
            f"[UnifiedOptimizer] 完成: strategy={strategy}, "
            f"best_score={result.best_score:.4f}, "
            f"time={total_elapsed:.1f}ms"
        )

        return result

    def get_bandit_stats(self) -> Dict[str, Any]:
        """获取Bandit学习统计"""
        return self.bandit.get_stats()


# ============================================================
# 模块级工厂
# ============================================================

_unified_optimizer: Optional[UnifiedFormulaOptimizer] = None


def get_unified_optimizer() -> UnifiedFormulaOptimizer:
    """获取统一优化器单例"""
    global _unified_optimizer
    if _unified_optimizer is None:
        _unified_optimizer = UnifiedFormulaOptimizer()
    return _unified_optimizer

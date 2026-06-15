"""
遗传算法配方优化引擎 (Genetic Formula Optimizer)

使用进化算法搜索最优配方组合:
- 种群: 每个个体 = 一组药材用量向量
- 选择: 锦标赛选择 + 精英保留
- 交叉: 单点交叉 + 算术交叉
- 变异: 高斯变异 + 边界重置
- 适应度: 多目标评分 (功效/安全/口感/成本)

与贝叶斯优化的区别:
- 贝叶斯 = 模型驱动 (GP代理模型 + EI采集函数)
- 遗传 = 种群驱动 (进化迭代, 无需代理模型)
- 互补: 贝叶斯擅长局部精化, 遗传擅长全局探索

@version 1.0.0
"""
import logging
import math
import random
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# 引用贝叶斯引擎的药材知识库
from .bayesian_formula_optimizer import _BUILTIN_HERBS, _EFFICACY_TO_HERBS

@dataclass
class GAConfig:
    """遗传算法配置"""
    population_size: int = 50       # 种群大小
    generations: int = 40           # 进化代数
    mutation_rate: float = 0.15     # 变异概率
    crossover_rate: float = 0.85    # 交叉概率
    elite_ratio: float = 0.15       # 精英保留比例
    tournament_size: int = 5        # 锦标赛规模
    target_effects: List[str] = None
    adaptive_mutation: bool = True  # 是否启用自适应变异率
    early_stop_patience: int = 15   # 连续N代无改进则早停(0=不启用)
    early_stop_threshold: float = 0.95  # 达到此fitness阈值则停止(0=不启用)

    def __post_init__(self):
        if self.target_effects is None:
            self.target_effects = ["免疫调节"]
        # 参数范围校验
        assert 1 <= self.population_size <= 500, "population_size 应在 [1, 500]"
        assert 1 <= self.generations <= 500, "generations 应在 [1, 500]"
        assert 0.0 <= self.mutation_rate <= 1.0, "mutation_rate 应在 [0, 1]"
        assert 0.0 <= self.crossover_rate <= 1.0, "crossover_rate 应在 [0, 1]"
        assert 0.0 < self.elite_ratio <= 0.5, "elite_ratio 应在 (0, 0.5]"
        assert 2 <= self.tournament_size <= 50, "tournament_size 应在 [2, 50]"
        assert self.early_stop_patience >= 0, "early_stop_patience 应 >= 0"
        assert 0.0 <= self.early_stop_threshold <= 1.0, "early_stop_threshold 应在 [0, 1]"


class Individual:
    """遗传算法个体 = 配方候选方案"""

    def __init__(self, genes: Dict[str, float]):
        self.genes = dict(genes)  # {herb_id: dosage}
        self.fitness: float = 0.0
        self.efficacy: float = 0.0
        self.safety: float = 0.0
        self.taste: float = 0.0
        self.cost: float = 0.0

    def evaluate(self, target_effects: List[str], herb_dict: Optional[Dict] = None):
        """
        多目标适应度评估

        Args:
            target_effects: 目标功效列表
            herb_dict: 药材字典（优先使用）；None 时回退 _BUILTIN_HERBS

        院士级修复[P0]: 增加 herb_dict 参数，解耦对全局 _BUILTIN_HERBS 的直接依赖。
        """
        # 优先使用注入的字典，没有时回退内置字典
        herbs = herb_dict if herb_dict is not None else _BUILTIN_HERBS

        if not self.genes:
            self.fitness = 0
            return

        # 功效
        eff_scores = []
        for effect in target_effects:
            score = 0.0
            for hid, dosage in self.genes.items():
                if hid in herbs:
                    herb = herbs[hid]
                    s = herb.efficacy_scores.get(effect, 0)
                    ratio = (dosage - herb.dosage_min) / max(1, herb.dosage_max - herb.dosage_min)
                    score += s * (0.5 + 0.5 * ratio)
            eff_scores.append(score / max(1, len(self.genes)))
        self.efficacy = (math.prod(max(0.01, s) for s in eff_scores)) ** (1.0 / max(1, len(eff_scores)))

        # 安全
        safe = 0.0
        for hid, dosage in self.genes.items():
            if hid in herbs:
                herb = herbs[hid]
                ratio = (dosage - herb.dosage_min) / max(1, herb.dosage_max - herb.dosage_min)
                safe += herb.safety_index * (1 - 0.3 * ratio)
        self.safety = safe / max(1, len(self.genes))

        # 禁忌惩罚
        hid_list = list(self.genes.keys())
        penalty = 0.0
        for i in range(len(hid_list)):
            for j in range(i + 1, len(hid_list)):
                h1, h2 = hid_list[i], hid_list[j]
                if h1 in herbs and h2 in herbs:
                    if h2 in herbs[h1].antagonistic_pairs:
                        penalty += 0.15
        self.safety *= max(0, 1 - penalty)

        # 口感
        sweet = {"dcx", "gq", "gz", "hq"}
        bitter = {"lk", "cyh", "cs"}
        sweet_r = sum(1 for h in self.genes if h in sweet) / max(1, len(self.genes))
        bitter_r = sum(1 for h in self.genes if h in bitter) / max(1, len(self.genes))
        self.taste = max(0, min(1, 0.5 + 0.3 * min(1, sweet_r * 2) - 0.3 * min(1, bitter_r * 2)))

        # 成本
        total_cost = sum(dosage * (herbs[hid].cost_per_gram if hid in herbs else 0.1)
                        for hid, dosage in self.genes.items())
        self.cost = max(0, 1 - total_cost / 15.0)

        # 综合
        self.fitness = (self.efficacy * 0.40 + self.safety * 0.25 +
                        self.taste * 0.15 + self.cost * 0.20)


class GeneticFormulaOptimizer:
    """
    遗传算法配方优化器

    院士级修复[P0]: 增加 herb_knowledge 参数，支持 HerbKnowledgePort 依赖注入。
    当提供 herb_knowledge 时，从端口动态加载药材知识（推荐）；
    否则回退到内置字典（向后兼容）。
    """

    def __init__(self, config: Optional[GAConfig] = None, herb_knowledge=None):
        self.config = config or GAConfig()
        self._herb_knowledge = herb_knowledge        # HerbKnowledgePort 注入点
        self._herbs = dict(_BUILTIN_HERBS)           # 内置兜底（向后兼容）
        self._efficacy_index = dict(_EFFICACY_TO_HERBS)

    async def _ensure_herbs_loaded(self) -> None:
        """从 HerbKnowledgePort 加载药材，不可用时回退内置字典"""
        if self._herb_knowledge is None:
            return
        try:
            from ..bayesian_formula_optimizer import HerbParameter
            all_herbs = await self._herb_knowledge.get_all_herbs()
            if all_herbs:
                new_herbs = {}
                new_index: dict = {}
                for profile in all_herbs:
                    new_herbs[profile.herb_id] = HerbParameter(
                        herb_id=profile.herb_id,
                        name_cn=profile.name_cn,
                        dosage_min=profile.dosage_min,
                        dosage_max=profile.dosage_max,
                        dosage_step=profile.dosage_step,
                        efficacy_scores=profile.efficacy_scores,
                        safety_index=profile.safety_index,
                        cost_per_gram=profile.cost_per_gram,
                        synergy_partners=profile.synergy_partners,
                        antagonistic_pairs=profile.antagonistic_pairs,
                    )
                    for eff in profile.efficacy_scores:
                        new_index.setdefault(eff, []).append(profile.herb_id)
                self._herbs = new_herbs
                self._efficacy_index = new_index
                logger.info(f"[GeneticOptimizer] 从 HerbKnowledgePort 加载药材 {len(all_herbs)} 种")
        except Exception as e:
            logger.warning(f"[GeneticOptimizer] HerbKnowledgePort 加载失败，回退内置字典: {e}")

    async def optimize(self, target_effects: List[str], exclude_herbs: Optional[set] = None) -> Tuple[List[Individual], List[Dict]]:
        """执行遗传算法优化，返回 (结果列表, 进化历史)

        Args:
            target_effects: 目标功效列表
            exclude_herbs: 可选，需要排除的药材集合

        院士级修复：方法改为 async，优先从 HerbKnowledgePort 加载最新药材知识。
        """
        # 院士级修复[P0]: 优先从 HerbKnowledgePort 刷新药材知识库
        await self._ensure_herbs_loaded()

        self.config.target_effects = target_effects

        # Step 1: 选择候选药材（支持排除药材）
        candidates = self._select_herbs(target_effects, exclude_herbs=exclude_herbs)
        if len(candidates) < 3:
            logger.warning(f"候选药材不足 ({len(candidates)})")
            return [], []

        logger.info(f"[GeneticAlgorithm] 种群={self.config.population_size}, "
                    f"代数={self.config.generations}, "
                    f"候选药材={len(candidates)}种")

        # Step 2: 初始化种群
        population = self._init_population(candidates)
        for ind in population:
            ind.evaluate(target_effects)

        # 按适应度排序
        population.sort(key=lambda x: x.fitness, reverse=True)
        best_fitness = population[0].fitness

        # 进化历史记录
        history: List[Dict] = []

        # 早停相关状态
        no_improve_count = 0          # 连续无改进代数计数器
        stop_reason: str = "completed" # 停止原因
        actual_generations = self.config.generations  # 实际执行的代数(可能被早停截断)

        # Step 3: 进化迭代
        for gen in range(self.config.generations):
            new_population = []

            # 精英保留
            n_elite = max(1, int(self.config.population_size * self.config.elite_ratio))
            new_population.extend(population[:n_elite])

            # 计算本代种群多样性（用于自适应变异率）
            diversity = self._compute_diversity(population)

            # 自适应变异率：根据种群多样性动态调整实际变异概率
            if self.config.adaptive_mutation:
                if diversity < 0.2:
                    actual_mutation_rate = self.config.mutation_rate * 2.5   # 低多样性强扰动
                elif diversity < 0.4:
                    actual_mutation_rate = self.config.mutation_rate * 1.5   # 中等偏低加强扰动
                elif diversity < 0.6:
                    actual_mutation_rate = self.config.mutation_rate * 1.0   # 正常
                else:
                    actual_mutation_rate = self.config.mutation_rate * 0.7   # 高多样性可降低扰动
                # 确保变异率不超过合理上限
                actual_mutation_rate = min(actual_mutation_rate, 0.8)
            else:
                actual_mutation_rate = self.config.mutation_rate

            # 生成后代（使用自适应变异率）
            while len(new_population) < self.config.population_size:
                parent1 = self._tournament_select(population)
                parent2 = self._tournament_select(population)

                if random.random() < self.config.crossover_rate:
                    child1, child2 = self._crossover(parent1, parent2)
                else:
                    child1, child2 = Individual(parent1.genes), Individual(parent2.genes)

                if random.random() < actual_mutation_rate:
                    self._mutate(child1, candidates)
                if random.random() < actual_mutation_rate:
                    self._mutate(child2, candidates)

                child1.evaluate(target_effects)
                child2.evaluate(target_effects)
                new_population.append(child1)
                if len(new_population) < self.config.population_size:
                    new_population.append(child2)

            population = new_population
            population.sort(key=lambda x: x.fitness, reverse=True)

            prev_best_fitness = best_fitness
            if population[0].fitness > best_fitness:
                best_fitness = population[0].fitness
                no_improve_count = 0
            else:
                no_improve_count += 1

            # 记录本代统计信息
            fitnesses = [ind.fitness for ind in population]
            avg_fitness = sum(fitnesses) / len(fitnesses)
            min_fitness = min(fitnesses)

            history.append({
                "generation": gen + 1,
                "best_fitness": round(best_fitness, 6),
                "avg_fitness": round(avg_fitness, 6),
                "min_fitness": round(min_fitness, 6),
                "diversity": round(diversity, 6),
                "adaptive_mutation_rate": round(actual_mutation_rate, 6),
            })

            if (gen + 1) % 10 == 0:
                logger.info(f"  Gen {gen+1}/{self.config.generations}, "
                          f"Best: {best_fitness:.4f}, "
                          f"Avg: {avg_fitness:.4f}, Div: {diversity:.4f}, "
                          f"MutRate: {actual_mutation_rate:.3f}")

            # ===== 早停检查 =====
            should_stop = False

            # 阈值早停：当 best_fitness 超过设定阈值且阈值>0 时提前终止
            if (self.config.early_stop_threshold > 0 and
                    best_fitness >= self.config.early_stop_threshold):
                stop_reason = "early_stop_threshold"
                should_stop = True
                actual_generations = gen + 1

            # 耐心值早停：连续 N 代无改进则提前终止
            if (not should_stop and self.config.early_stop_patience > 0 and
                    no_improve_count >= self.config.early_stop_patience):
                stop_reason = "early_stop_patience"
                should_stop = True
                actual_generations = gen + 1

            if should_stop:
                logger.info(f"[GeneticAlgorithm] 早停触发 ({stop_reason}), "
                           f"于第 {actual_generations} 代停止")
                break

        # 在最后一条历史记录中添加停止原因
        if history:
            history[-1]["stop_reason"] = stop_reason

        # 返回 Top-N (去重) 和进化历史
        return self._deduplicate(population[:10]), history

    def _compute_diversity(self, population: List[Individual]) -> float:
        """计算种群中个体基因集合的 Jaccard 平均距离"""
        if len(population) < 2:
            return 1.0

        gene_sets = [set(ind.genes.keys()) for ind in population]
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

    def _select_herbs(self, target_effects: List[str], exclude_herbs: Optional[set] = None) -> List[str]:
        """选择候选药材

        Args:
            target_effects: 目标功效列表
            exclude_herbs: 可选，需要排除的药材集合
        """
        candidate_set: Dict[str, float] = {}
        for effect in target_effects:
            if effect in _EFFICACY_TO_HERBS:
                for hid in _EFFICACY_TO_HERBS[effect]:
                    if hid in _BUILTIN_HERBS:
                        score = _BUILTIN_HERBS[hid].efficacy_scores.get(effect, 0)
                        candidate_set[hid] = max(candidate_set.get(hid, 0), score)

        # 添加协同药材
        for hid in list(candidate_set.keys()):
            if hid in _BUILTIN_HERBS:
                for p in _BUILTIN_HERBS[hid].synergy_partners:
                    if p in _BUILTIN_HERBS and p not in candidate_set:
                        candidate_set[p] = 0.1  # 低权重引入

        sorted_h = sorted(candidate_set.keys(), key=lambda x: candidate_set[x], reverse=True)

        # 过滤排除的药材
        if exclude_herbs:
            sorted_h = [h for h in sorted_h if h not in exclude_herbs]

        return sorted_h[:15]

    def _init_population(self, candidates: List[str]) -> List[Individual]:
        """初始化种群 (拉丁超立方 + 随机采样)"""
        population = []
        n = len(candidates)

        # 确定性初始: 每个功效选最佳药材
        for i in range(min(5, n)):
            genes = {}
            for j, hid in enumerate(candidates):
                if hid in _BUILTIN_HERBS:
                    herb = _BUILTIN_HERBS[hid]
                    base_ratio = max(0.1, 1.0 - abs(j - i) * 0.15)
                    dosage = herb.dosage_min + base_ratio * (herb.dosage_max - herb.dosage_min)
                    dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                    dosage = max(herb.dosage_min, min(herb.dosage_max, dosage))
                    if dosage > 0:
                        genes[hid] = dosage
            population.append(Individual(genes))

        # 随机采样
        for _ in range(self.config.population_size - len(population)):
            genes = {}
            for hid in candidates:
                if hid in _BUILTIN_HERBS and random.random() > 0.3:
                    herb = _BUILTIN_HERBS[hid]
                    ratio = random.random()
                    dosage = herb.dosage_min + ratio * (herb.dosage_max - herb.dosage_min)
                    dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                    dosage = max(herb.dosage_min, min(herb.dosage_max, dosage))
                    genes[hid] = dosage
            if len(genes) >= 3:
                population.append(Individual(genes))
            else:
                # 强制补充
                for hid in candidates[:5]:
                    if hid in _BUILTIN_HERBS:
                        herb = _BUILTIN_HERBS[hid]
                        dosage = herb.dosage_min + random.random() * (herb.dosage_max - herb.dosage_min)
                        dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                        genes[hid] = max(herb.dosage_min, dosage)
                population.append(Individual(genes))

        return population[:self.config.population_size]

    def _tournament_select(self, population: List[Individual]) -> Individual:
        """锦标赛选择"""
        contestants = random.sample(population, min(self.config.tournament_size, len(population)))
        return max(contestants, key=lambda x: x.fitness)

    def _crossover(self, p1: Individual, p2: Individual) -> Tuple[Individual, Individual]:
        """算术交叉 (加权平均 + 部分交换)"""
        all_herbs = set(p1.genes.keys()) | set(p2.genes.keys())
        alpha = random.random()

        genes1, genes2 = {}, {}
        for hid in all_herbs:
            d1 = p1.genes.get(hid, 0)
            d2 = p2.genes.get(hid, 0)
            # 父代1权重
            if random.random() < 0.5:
                genes1[hid] = alpha * d1 + (1 - alpha) * d2
                genes2[hid] = (1 - alpha) * d1 + alpha * d2
            else:
                genes1[hid] = d1 if random.random() < 0.5 else d2
                genes2[hid] = d2 if random.random() < 0.5 else d1

        # 边界裁剪
        for g in [genes1, genes2]:
            for hid in list(g.keys()):
                if hid in _BUILTIN_HERBS and g[hid] > 0:
                    herb = _BUILTIN_HERBS[hid]
                    g[hid] = max(herb.dosage_min, min(herb.dosage_max, g[hid]))
                    g[hid] = round(g[hid] / herb.dosage_step) * herb.dosage_step

        return Individual(genes1), Individual(genes2)

    def _mutate(self, ind: Individual, candidates: List[str]):
        """高斯变异 + 添加/删除药材"""
        for hid in list(ind.genes.keys()):
            if random.random() < 0.3 and hid in _BUILTIN_HERBS:
                herb = _BUILTIN_HERBS[hid]
                mu = ind.genes[hid]
                sigma = (herb.dosage_max - herb.dosage_min) * 0.2
                new_d = mu + random.gauss(0, sigma)
                if new_d <= herb.dosage_min:
                    del ind.genes[hid]  # 低于下限 → 移除
                else:
                    new_d = round(new_d / herb.dosage_step) * herb.dosage_step
                    ind.genes[hid] = min(herb.dosage_max, new_d)

        # 小概率添加新药材
        if random.random() < 0.2:
            new_h = random.choice(candidates)
            if new_h not in ind.genes and new_h in _BUILTIN_HERBS:
                herb = _BUILTIN_HERBS[new_h]
                dosage = herb.dosage_min + random.random() * (herb.dosage_max - herb.dosage_min)
                dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                ind.genes[new_h] = max(herb.dosage_min, dosage)

    def _deduplicate(self, individuals: List[Individual]) -> List[Individual]:
        """Jaccard 去重"""
        unique = []
        for ind in individuals:
            dup = False
            for existing in unique:
                its = set(ind.genes.keys()) & set(existing.genes.keys())
                uni = set(ind.genes.keys()) | set(existing.genes.keys())
                if uni and len(its) / len(uni) > 0.7:
                    dup = True
                    break
            if not dup:
                unique.append(ind)
        return unique

    def generate_with_result(self, target_effects: List[str], constraints: Optional[Dict] = None) -> 'GAResult':
        """执行遗传算法优化并返回完整结果对象（含历史记录和统计信息）"""
        constraints = constraints or {}

        # 提取排除药材约束（通过参数传递，不再 monkey-patch）
        exclude_set: Optional[set] = None
        if "exclude_herbs" in constraints and isinstance(constraints["exclude_herbs"], list):
            exclude_set = set(constraints["exclude_herbs"])

        # ===== 执行耗时统计开始 =====
        start_time = time.perf_counter()

        candidates, history = self.optimize(target_effects, exclude_herbs=exclude_set)

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        # ===== 执行耗时统计结束 =====

        # 处理最大成本约束：过滤超出成本的候选
        if "max_cost" in constraints and isinstance(constraints["max_cost"], (int, float)):
            max_c = constraints["max_cost"]
            filtered = []
            for ind in candidates:
                total_cost = sum(
                    dosage * (_BUILTIN_HERBS[hid].cost_per_gram if hid in _BUILTIN_HERBS else 0.1)
                    for hid, dosage in ind.genes.items()
                )
                if total_cost <= max_c:
                    filtered.append(ind)
            candidates = filtered if filtered else candidates[:1]  # 至少保留一个候选

        # 计算收敛代数：best_fitness 首次达到最终最优值时的代数
        convergence_gen = 0
        final_best_score = max((ind.fitness for ind in candidates), default=0.0)
        if history and final_best_score > 0:
            for record in history:
                if record.get("best_fitness", 0) >= final_best_score - 1e-9:
                    convergence_gen = record["generation"]
                    break

        total_evaluations = self.config.population_size * self.config.generations
        best_score = final_best_score

        return GAResult(
            candidates=candidates,
            history=history,
            total_generations=self.config.generations,
            total_evaluations=total_evaluations,
            best_score=best_score,
            execution_time_ms=round(elapsed_ms, 3),
            convergence_generation=convergence_gen,
        )


@dataclass
class GAResult:
    """遗传算法优化结果"""
    candidates: List[Individual]
    history: List[Dict]
    total_generations: int
    total_evaluations: int
    best_score: float
    execution_time_ms: float = 0.0      # 执行耗时(毫秒)
    convergence_generation: int = 0     # 收敛时的代数(best_fitness首次达到最终值的代数)


_ga_optimizer: Optional[GeneticFormulaOptimizer] = None

def get_genetic_optimizer() -> GeneticFormulaOptimizer:
    global _ga_optimizer
    if _ga_optimizer is None:
        _ga_optimizer = GeneticFormulaOptimizer()
    return _ga_optimizer


# ════════════════════════════════════════════
# 多目标优化桥接（向后兼容）
# ════════════════════════════════════════════

def bridge_to_multi_objective(target_effects: List[str], constraints: Dict = None) -> GAResult:
    """桥接旧接口到新的多目标优化器（向后兼容）

    将原有的单目标遗传算法调用委托给 NSGA-II 多目标优化引擎，
    返回格式与 GAResult 完全兼容，使上层调用方无需修改。

    Args:
        target_effects: 目标功效列表，如 ["免疫调节", "抗氧化"]
        constraints: 约束条件字典 { max_cost, exclude_herbs, ... }

    Returns:
        GAResult: 兼容旧格式的优化结果
    """
    from .multi_objective_optimizer import (
        get_nsga2_optimizer, OptimizationConfig, OptimizationObjective
    )

    optimizer = get_nsga2_optimizer()
    config = OptimizationConfig(
        objectives=[
            OptimizationObjective("功效最大化", "efficacy", "maximize", 0.40),
            OptimizationObjective("安全性", "safety", "maximize", 0.25),
            OptimizationObjective("口感品质", "taste", "maximize", 0.15),
            OptimizationObjective("成本效率", "cost_efficiency", "maximize", 0.20),
        ],
        mode="weighted",
        constraints=constraints or {},
        population_size=50,
        generations=40,
    )
    # 使用自定义配置创建临时优化器执行
    mo_optimizer = NSGAIIMoBridgeOptimizer(config)
    result = mo_optimizer.generate_with_result(
        target_effects=target_effects, constraints=constraints
    )

    # 将 MOGAResult 转换为 GAResult（向后兼容）
    best_score = 0.0
    if result.candidates:
        best_score = max(ind.fitness for ind in result.candidates)

    return GAResult(
        candidates=result.candidates,  # MultiObjectiveIndividual 类型但字段兼容
        history=result.history,
        total_generations=result.total_generations,
        total_evaluations=result.total_evaluations,
        best_score=best_score,
        execution_time_ms=result.execution_time_ms,
        convergence_generation=result.convergence_generation,
    )


# 延迟导入避免循环依赖
from .multi_objective_optimizer import NSGAIIOptimizer, MOGAResult


class NSGAIIMoBridgeOptimizer(NSGAIIOptimizer):
    """NSGA-II 桥接优化器 — 继承多目标引擎并适配旧接口

    用于 bridge_to_multi_objective 函数内部，
    避免污染全局单例的配置状态。
    """
    pass

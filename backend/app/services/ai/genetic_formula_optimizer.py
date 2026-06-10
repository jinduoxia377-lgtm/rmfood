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

    def __post_init__(self):
        if self.target_effects is None:
            self.target_effects = ["免疫调节"]


class Individual:
    """遗传算法个体 = 配方候选方案"""

    def __init__(self, genes: Dict[str, float]):
        self.genes = dict(genes)  # {herb_id: dosage}
        self.fitness: float = 0.0
        self.efficacy: float = 0.0
        self.safety: float = 0.0
        self.taste: float = 0.0
        self.cost: float = 0.0

    def evaluate(self, target_effects: List[str]):
        """多目标适应度评估"""
        if not self.genes:
            self.fitness = 0
            return

        # 功效
        eff_scores = []
        for effect in target_effects:
            score = 0.0
            for hid, dosage in self.genes.items():
                if hid in _BUILTIN_HERBS:
                    herb = _BUILTIN_HERBS[hid]
                    s = herb.efficacy_scores.get(effect, 0)
                    ratio = (dosage - herb.dosage_min) / max(1, herb.dosage_max - herb.dosage_min)
                    score += s * (0.5 + 0.5 * ratio)
            eff_scores.append(score / max(1, len(self.genes)))
        self.efficacy = (math.prod(max(0.01, s) for s in eff_scores)) ** (1.0 / max(1, len(eff_scores)))

        # 安全
        safe = 0.0
        for hid, dosage in self.genes.items():
            if hid in _BUILTIN_HERBS:
                herb = _BUILTIN_HERBS[hid]
                ratio = (dosage - herb.dosage_min) / max(1, herb.dosage_max - herb.dosage_min)
                safe += herb.safety_index * (1 - 0.3 * ratio)
        self.safety = safe / max(1, len(self.genes))

        # 禁忌惩罚
        hid_list = list(self.genes.keys())
        penalty = 0.0
        for i in range(len(hid_list)):
            for j in range(i + 1, len(hid_list)):
                h1, h2 = hid_list[i], hid_list[j]
                if h1 in _BUILTIN_HERBS and h2 in _BUILTIN_HERBS:
                    if h2 in _BUILTIN_HERBS[h1].antagonistic_pairs:
                        penalty += 0.15
        self.safety *= max(0, 1 - penalty)

        # 口感
        sweet = {"dcx", "gq", "gz", "hq"}
        bitter = {"lk", "cyh", "cs"}
        sweet_r = sum(1 for h in self.genes if h in sweet) / max(1, len(self.genes))
        bitter_r = sum(1 for h in self.genes if h in bitter) / max(1, len(self.genes))
        self.taste = max(0, min(1, 0.5 + 0.3 * min(1, sweet_r * 2) - 0.3 * min(1, bitter_r * 2)))

        # 成本
        total_cost = sum(dosage * (_BUILTIN_HERBS[hid].cost_per_gram if hid in _BUILTIN_HERBS else 0.1)
                        for hid, dosage in self.genes.items())
        self.cost = max(0, 1 - total_cost / 15.0)

        # 综合
        self.fitness = (self.efficacy * 0.40 + self.safety * 0.25 +
                        self.taste * 0.15 + self.cost * 0.20)


class GeneticFormulaOptimizer:
    """
    遗传算法配方优化器
    """

    def __init__(self, config: Optional[GAConfig] = None):
        self.config = config or GAConfig()

    def optimize(self, target_effects: List[str]) -> List[Individual]:
        """执行遗传算法优化"""
        self.config.target_effects = target_effects

        # Step 1: 选择候选药材
        candidates = self._select_herbs(target_effects)
        if len(candidates) < 3:
            logger.warning(f"候选药材不足 ({len(candidates)})")
            return []

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

        # Step 3: 进化迭代
        for gen in range(self.config.generations):
            new_population = []

            # 精英保留
            n_elite = max(1, int(self.config.population_size * self.config.elite_ratio))
            new_population.extend(population[:n_elite])

            # 生成后代
            while len(new_population) < self.config.population_size:
                parent1 = self._tournament_select(population)
                parent2 = self._tournament_select(population)

                if random.random() < self.config.crossover_rate:
                    child1, child2 = self._crossover(parent1, parent2)
                else:
                    child1, child2 = Individual(parent1.genes), Individual(parent2.genes)

                if random.random() < self.config.mutation_rate:
                    self._mutate(child1, candidates)
                if random.random() < self.config.mutation_rate:
                    self._mutate(child2, candidates)

                child1.evaluate(target_effects)
                child2.evaluate(target_effects)
                new_population.append(child1)
                if len(new_population) < self.config.population_size:
                    new_population.append(child2)

            population = new_population
            population.sort(key=lambda x: x.fitness, reverse=True)

            if population[0].fitness > best_fitness:
                best_fitness = population[0].fitness

            if (gen + 1) % 10 == 0:
                logger.info(f"  Gen {gen+1}/{self.config.generations}, "
                          f"Best: {best_fitness:.4f}, "
                          f"Avg: {sum(i.fitness for i in population)/len(population):.4f}")

        # 返回 Top-N (去重)
        return self._deduplicate(population[:10])

    def _select_herbs(self, target_effects: List[str]) -> List[str]:
        """选择候选药材"""
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


_ga_optimizer: Optional[GeneticFormulaOptimizer] = None

def get_genetic_optimizer() -> GeneticFormulaOptimizer:
    global _ga_optimizer
    if _ga_optimizer is None:
        _ga_optimizer = GeneticFormulaOptimizer()
    return _ga_optimizer

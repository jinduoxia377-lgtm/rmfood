# ruff: noqa: N806, E402
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
import threading
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# 功效 ID → 中文标签映射（与前端 EFFECT_OPTIONS 保持一致）
_EFFECT_ID_TO_LABEL: dict[str, str] = {
    "immune_enhancement": "增强免疫",
    "immune_regulation": "免疫调节",
    "resistance_boost": "提高抵抗力",
    "antioxidant": "抗氧化",
    "anti_aging": "延缓衰老",
    "free_radical_clear": "清除自由基",
    "anti_fatigue": "抗疲劳",
    "fatigue_relief": "缓解疲劳",
    "energy_boost": "提升精力",
    "qi_nourishing": "补气养阴",
    "yin_nourishing": "滋阴补肾",
    "spleen_qi_tonifying": "健脾益气",
    "blood_nourishing": "补血养血",
    "sleep_improvement": "改善睡眠",
    "calm_mind": "安神定志",
    "spleen_stomach": "健脾养胃",
    "digestion_promotion": "促进消化",
    "blood_lipid": "降血脂",
    "vascular_protection": "保护血管",
    "beauty_skin": "美容养颜",
    "blood_pressure": "降血压",
    "blood_sugar": "降血糖",
    "uric_acid": "降尿酸",
    "detox": "解毒",
    "heat_clearing": "清热解毒",
    "cough_relief": "止咳化痰",
    "liver_protection": "保肝护肝",
    "kidney_nourishing": "补肾益精",
    "spleen_strengthening": "健脾和胃",
}


def _translate_effect_ids(effect_ids: list[str]) -> list[str]:
    """将前端发送的功效 ID/标签转换为后端功效索引键（中文）。

    前端发送的是 EFFECT_OPTIONS 的 label（如 '增强免疫'、'补气养血'），
    后端索引键来自数据库 TCMHerb 的 efficacy_scores（如 '免疫调节'、'补气'、'补血'、'养血'、'降脂'），
    两者不完全一致，需要别名归一化。
    归一化映射统一维护在 herb_knowledge_service.EFFECT_ALIAS_TO_KEYS（真实数据索引键，非伪造）。
    """
    from .herb_knowledge_service import normalize_effect_aliases
    return normalize_effect_aliases(effect_ids)

@dataclass
class GAConfig:
    """遗传算法配置"""
    population_size: int = 40       # 种群大小（S1-6 性能：80/50→40，减半评估开销）
    generations: int = 20           # 进化代数（S1-6 性能：40→20，配合早停保收敛起点）
    mutation_rate: float = 0.15     # 变异概率
    crossover_rate: float = 0.85    # 交叉概率
    elite_ratio: float = 0.15       # 精英保留比例
    tournament_size: int = 5        # 锦标赛规模
    target_effects: List[str] = None
    adaptive_mutation: bool = True  # 是否启用自适应变异率
    seed: Optional[int] = None      # 随机种子（可重复性）
    early_stop_patience: int = 8    # 连续N代无改进则早停(S1-6: 15→8,更快止损;0=不启用)
    early_stop_threshold: float = 0.95  # 达到此fitness阈值则停止(0=不启用)
    # 自定义综合适应度权重（键：efficacy/safety/taste/cost/synergy/stability）。
    # None 表示使用 Individual.DEFAULT_OBJECTIVE_WEIGHTS（与 NSGA-II 一致的内置权重）。
    # 传入时会在优化器内做一次归一化，因此前端不必保证总和为 1。
    objective_weights: Optional[Dict[str, float]] = None

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

    # 内置综合适应度权重（与 NSGA-II 默认 objectives 保持一致）。
    # 优化器可通过 config.objective_weights 覆盖。
    DEFAULT_OBJECTIVE_WEIGHTS: Dict[str, float] = {
        "efficacy": 0.30,
        "safety": 0.25,
        "taste": 0.10,
        "cost": 0.15,
        "synergy": 0.10,
        "stability": 0.10,
    }

    def __init__(self, genes: Dict[str, float], weights: Optional[Dict[str, float]] = None):
        self.genes = dict(genes)  # {herb_id: dosage}
        # 每个个体持有自己那份权重的引用（由优化器工厂方法注入），
        # 这样并发运行两个 GA 时不会互相覆盖权重。
        self._weights: Dict[str, float] = dict(weights or self.DEFAULT_OBJECTIVE_WEIGHTS)
        self.fitness: float = 0.0
        self.efficacy: float = 0.0
        self.safety: float = 0.0
        self.taste: float = 0.0
        self.cost: float = 0.0
        self.synergy: float = 0.0     # 协同效应评分
        self.stability: float = 0.0   # 稳定性评分
        self.admet: float = 0.0       # ADMET综合评分
        self.structural_compliance: float = 0.0  # 君臣佐使结构合规度

    def evaluate(self, target_effects: List[str], herb_dict: Optional[Dict] = None):
        """
        多目标适应度评估

        Args:
            target_effects: 目标功效列表
            herb_dict: 数据库药材字典（优化器统一注入 self._herbs）。

        院士级修复[P0]: 增加 herb_dict 参数，解耦对全局 _BUILTIN_HERBS 的直接依赖。
        P1 修复: GA 评分路径一律使用注入的数据库药材字典，不再回退 _BUILTIN_HERBS。
        """
        # P1 修复：GA 评分一律使用调用方注入的数据库药材字典（优化器传入 self._herbs），
        # 不再回退 _BUILTIN_HERBS，确保数据库药材在评分中贡献真实功效/安全数据。
        if herb_dict is None:
            logger.warning("[GeneticOptimizer] evaluate 未注入 herb_dict，评分将无药材数据（应传入数据库药材字典）")
        herbs = herb_dict or {}

        if not self.genes:
            self.fitness = 0
            return

        # 功效
        if not target_effects:
            self.efficacy = 0.0
        else:
            eff_scores = []
            for effect in target_effects:
                # P1 稀释修复：分母改为「对该关键词有真实贡献(s>0)的药材数」，而非总基因数。
                # 旧实现 `score/len(self.genes)` 让「多加一味无此功效的药材」摊薄整体分，
                # 反向激励「药味越多分越低」。改为只除以贡献者数，使评分反映
                # 「命中此功效的药材平均贡献强度」，鼓励纳入真正对症的药材。
                score = 0.0
                contributors = 0
                for hid, dosage in self.genes.items():
                    if hid in herbs:
                        herb = herbs[hid]
                        s = herb.efficacy_scores.get(effect, 0)
                        if s > 0:
                            contributors += 1
                        ratio = (dosage - herb.dosage_min) / max(1, herb.dosage_max - herb.dosage_min)
                        score += s * (0.5 + 0.5 * ratio)
                if contributors > 0:
                    eff_scores.append(score / contributors)
                else:
                    # 该关键词全库（在当前个体内）无任何药材贡献 → 真实地板 0.05，
                    # 仅在完全无命中时启用，避免有真实命中的关键词被旧地板(0.01)压低。
                    eff_scores.append(0.05)
            self.efficacy = (math.prod(eff_scores)) ** (1.0 / max(1, len(eff_scores)))

        # 安全
        safe = 0.0
        for hid, dosage in self.genes.items():
            if hid in herbs:
                herb = herbs[hid]
                ratio = (dosage - herb.dosage_min) / max(1, herb.dosage_max - herb.dosage_min)
                safe += herb.safety_index * (1 - 0.3 * ratio)
        self.safety = safe / max(1, len(self.genes))

        # 禁忌惩罚（预计算：构建禁忌对集合 O(1) 查找）
        antagonistic_pairs_set = set()
        for hid in self.genes:
            if hid in herbs:
                for partner in herbs[hid].antagonistic_pairs:
                    antagonistic_pairs_set.add(tuple(sorted([hid, partner])))

        penalty = 0.0
        hid_list = list(self.genes.keys())
        for i in range(len(hid_list)):
            for j in range(i + 1, len(hid_list)):
                pair = tuple(sorted([hid_list[i], hid_list[j]]))
                if pair in antagonistic_pairs_set:
                    penalty += 0.15
        self.safety *= max(0, 1 - penalty)

        # ── 特殊人群禁忌检测（院士级修复[P2-B2]）──
        # 孕妇禁忌药材: 活血破血类（川芎、当归等）
        pregnancy_contra = {"cs", "dg", "fz", "mld", "lk"}
        # 儿童慎用: 毒性较强或药性峻烈
        children_caution = {"fz", "lk", "mld"}
        # 老年慎用: 大补峻剂
        elderly_caution = {"rs"}

        # 从 constraints 中读取 target_group
        target_group = (herb_dict.get("__target_group__") if isinstance(herb_dict, dict) and "__target_group__" in herb_dict
                        else "adult")

        if target_group == "pregnant":
            for hid in self.genes:
                if hid in pregnancy_contra:
                    self.safety *= 0.5  # 孕妇禁忌减半安全评分
                    break
        elif target_group == "children":
            for hid in self.genes:
                if hid in children_caution:
                    self.safety *= 0.7
                    break
        elif target_group == "elderly":
            for hid in self.genes:
                if hid in elderly_caution:
                    self.safety *= 0.8
                    break

        # 口感 — 院士级修复[P1-A5]: 对齐 NSGA-II 的五味调和 MSE 模型
        # 原实现仅用 4 个 sweet + 3 个 bitter herb ID 做简单比例，
        # 现改为完整的五味分类 + 理想比例 MSE + 矫味剂奖励
        total_dosage = sum(self.genes.values())
        if total_dosage < 0.001:
            self.taste = 0.5
        else:
            _FLAVOR_MAP = {
                "hq": "sweet", "ds": "sweet", "gz": "sweet", "rs": "sweet",
                "gq": "sweet", "dcx": "sweet",
                "lk": "bitter", "cyh": "bitter", "fz": "bitter", "cs": "bitter",
                "mld": "bitter", "jgh": "bitter", "bq": "bitter",
                "sj": "pungent", "cx": "pungent",
                "fp": "neutral", "yq": "neutral",
                "dg": "other", "gh": "other",
            }
            _IDEAL_RATIOS = {"sweet": 0.45, "neutral": 0.20, "bitter": 0.15, "pungent": 0.12, "other": 0.08}
            flavor_totals = {"sweet": 0.0, "bitter": 0.0, "pungent": 0.0, "neutral": 0.0, "other": 0.0}
            for hid, dosage in self.genes.items():
                flavor = _FLAVOR_MAP.get(hid, "other")
                flavor_totals[flavor] += dosage
            actual_ratios = {k: v / total_dosage for k, v in flavor_totals.items()}
            mse = sum((actual_ratios[k] - _IDEAL_RATIOS[k]) ** 2 for k in flavor_totals) / len(flavor_totals)
            taste_base = max(0.0, 1.0 - mse * 8.0)
            if actual_ratios["bitter"] > 0.25:
                taste_base *= max(0.4, 1.0 - (actual_ratios["bitter"] - 0.25) * 2.0)
            bonus = 0.08 if ("gq" in self.genes or "dcx" in self.genes) else 0.0
            self.taste = max(0.0, min(1.0, taste_base + bonus))

        # 成本
        total_cost = sum(dosage * (herbs[hid].cost_per_gram if hid in herbs else 0.1)
                        for hid, dosage in self.genes.items())
        # 使用 50 元作为合理的成本评分归一化基准（覆盖常见药食同源配方）
        cost_threshold = 50.0
        self.cost = max(0, 1 - total_cost / cost_threshold)

        # ── 协同效应评估（三层模型，与 NSGA-II FormulaEvaluator 对齐）──
        # Layer 1 - 功效互补度 (0~0.4): Jaccard 相似度 + 差异集分析
        # Layer 2 - 经典配伍加分 (0~0.3): 基于已知经典药对
        # Layer 3 - 用量比例协调 (0~0.3): 主药:辅药 理想比例 2:1~4:1
        herb_list = list(self.genes.keys())
        synergy_total = 0.0
        pair_count = 0
        for i in range(len(herb_list)):
            for j in range(i + 1, len(herb_list)):
                hid_i = herb_list[i]
                hid_j = herb_list[j]
                pair = tuple(sorted([hid_i, hid_j]))
                hi = herbs.get(hid_i)
                hj = herbs.get(hid_j)
                if not hi or not hj:
                    synergy_total += 0.30  # 缺失数据时给默认分
                    pair_count += 1
                    continue

                # Layer 1: 功效互补度
                e1 = set(hi.efficacy_scores.keys())
                e2 = set(hj.efficacy_scores.keys())
                overlap = len(e1 & e2)
                union = len(e1 | e2)
                jaccard = overlap / max(union, 1)
                diff_score = len(e1 ^ e2) / max(union, 1)
                layer1 = 0.15 * jaccard + 0.25 * diff_score  # 0~0.4

                # Layer 2: 经典配伍加分
                classic_pairs = {
                    frozenset({"hq", "ds"}): 0.25,
                    frozenset({"hq", "bq"}): 0.22,
                    frozenset({"rs", "hq"}): 0.20,
                    frozenset({"ds", "bq"}): 0.18,
                    frozenset({"dg", "cs"}): 0.20,
                    frozenset({"dg", "gz"}): 0.18,
                    frozenset({"ds", "dcx"}): 0.15,
                    frozenset({"jgh", "gz"}): 0.20,
                    frozenset({"cyh", "jgh"}): 0.18,
                    frozenset({"cyh", "gq"}): 0.15,
                    frozenset({"cx", "sj"}): 0.17,
                    frozenset({"cx", "bq"}): 0.16,
                    frozenset({"fp", "bq"}): 0.20,
                    frozenset({"fp", "yq"}): 0.18,
                    frozenset({"fp", "gq"}): 0.15,
                    frozenset({"gq", "dcx"}): 0.15,
                    frozenset({"gq", "hq"}): 0.12,
                    frozenset({"dcx", "sj"}): 0.13,
                }
                layer2 = classic_pairs.get(frozenset(pair), 0.05)

                # Layer 3: 用量比例协调
                dos_i = self.genes.get(hid_i, 0)
                dos_j = self.genes.get(hid_j, 0)
                ratio = max(dos_i, dos_j) / max(min(dos_i, dos_j), 0.001)
                if 2 <= ratio <= 4:
                    layer3 = 0.30
                elif 1 <= ratio < 2 or 4 < ratio <= 6:
                    layer3 = 0.25
                elif ratio > 6:
                    layer3 = max(0.10, 0.30 - (ratio - 6) * 0.03)
                else:
                    layer3 = 0.20

                # 用量均衡微调
                balance = 1 - abs(dos_i - dos_j) / max(dos_i + dos_j, 0.001)

                # 组合三层协同分
                layer3_base = 0.15
                base_syn = layer1 + layer2 + layer3_base
                dynamic_syn = (base_syn - layer3_base) + layer3
                synergy_total += dynamic_syn * (0.7 + 0.3 * balance)
                pair_count += 1
        self.synergy = synergy_total / max(pair_count, 1) if pair_count > 0 else 0.5

        # ── 稳定性评估 ──
        stability_factors = []
        for hid, dosage in self.genes.items():
            herb = herbs.get(hid)
            if not herb:
                continue
            mid_dosage = (herb.dosage_min + herb.dosage_max) / 2
            dos_norm = abs(dosage - mid_dosage) / max(herb.dosage_max - herb.dosage_min, 0.01)
            r_factor = 1 - 0.3 * dos_norm
            stability_factors.append(herb.safety_index * r_factor)
        self.stability = sum(stability_factors) / max(len(stability_factors), 1) if stability_factors else 0

        # ── 君臣佐使结构合规度 ──
        # 阶段1 治本：0.7 仅为占位默认值。真实值由优化器在评估循环中调用
        # _evaluate_structural_compliance() 注入（替代旧的"从未调用"缺陷），
        # 注入后通过 _base_weighted_fitness 重算 fitness。
        self.structural_compliance = 0.7  # 占位；由优化器覆盖为真实计算值

        # 综合适应度（7 维加权；权重可由 GAConfig.objective_weights 覆盖）
        # 先归一化再加权，前端传来的权重不需要预先归一；
        # 全零时回退内置默认，避免出现 0/0。
        # 结构合规度作为乘法因子惩罚不合规配方
        w = self._weights
        total_w = sum(w.values())
        if total_w <= 0:
            w = self.DEFAULT_OBJECTIVE_WEIGHTS
            total_w = sum(w.values())
        # 基座加权适应度（不含结构合规乘子）。缓存以便优化器注入真实
        # 结构合规度后按 base * (0.5 + 0.5 * sc) 重算，避免浮点误差累积。
        self._base_weighted_fitness = (
            self.efficacy * w.get("efficacy", 0.0)
            + self.safety * w.get("safety", 0.0)
            + self.taste * w.get("taste", 0.0)
            + self.cost * w.get("cost", 0.0)
            + self.synergy * w.get("synergy", 0.0)
            + self.stability * w.get("stability", 0.0)
        ) / total_w
        self.fitness = self._base_weighted_fitness * (0.5 + 0.5 * self.structural_compliance)


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
        self._herbs = {}                              # 优先从数据库加载
        self._efficacy_index = {}
        self._herb_knowledge_loaded = False            # 标记是否已尝试加载 HerbKnowledgeService
        # L0 药材准入缓存（R1 治本）：每次 optimize() 重建一次。
        #   _admitted_name_cache: {原始 name_cn → 是否通过 check_herb_admission}
        #   _admitted_herbs:      通过准入的 herb_id 集合（候选池过滤直接用）
        # 目的：GA 候选池只保留 106 种药食同源目录内药材，避免下游安全闸门
        # 整候选拒绝导致 0 候选降级。准入判定按 name 缓存，全代全种群复用，
        # 不再每代每体重复调用准入检查。
        self._admitted_name_cache: Dict[str, bool] = {}
        self._admitted_herbs: frozenset = frozenset()
        self._last_admission_removed: List[str] = []  # 最近一次候选池过滤被剔除的药材名
        # 归一化后的目标权重；None 表示用 Individual.DEFAULT_OBJECTIVE_WEIGHTS
        self._weight_vector: Optional[Dict[str, float]] = (
            self._normalize_objective_weights(self.config.objective_weights)
        )

    def _normalize_objective_weights(self, weights) -> Optional[Dict[str, float]]:
        """把外部传来的目标权重归一化成和为 1 的字典。

        键约定：efficacy / safety / taste / cost(=成本效率) / synergy / stability。
        空、非法或全零时返回 None —— 此时 Individual 回退到内置默认权重，
        保证 GA 在任何入参下都能正常跑起来。
        """
        if not weights or not isinstance(weights, dict):
            return None
        # 只保留已知目标键，未知键一律忽略 —— 否则 {"a": 1} 会把 total_w
        # 算成 1.0 而所有真实目标权重都是 0，导致适应度恒为 0。
        cleaned: Dict[str, float] = {}
        for key, value in weights.items():
            if key not in Individual.DEFAULT_OBJECTIVE_WEIGHTS:
                continue
            if value is None:
                continue
            try:
                cleaned[str(key)] = max(0.0, float(value))
            except (TypeError, ValueError):
                continue
        total = sum(cleaned.values())
        if total <= 0:
            return None
        return {k: v / total for k, v in cleaned.items()}

    def _new_individual(self, genes: Dict[str, float]) -> Individual:
        """统一个体工厂：注入本次运行归一化后的目标权重。

        避免散落的 Individual(genes) 直构造漏传权重，导致权重 UI 静默失效。
        """
        return Individual(genes, self._weight_vector)

    def _try_load_herb_knowledge(self) -> None:
        """惰性加载 HerbKnowledgeService — 在首次 optimize() 时重试，
        解决模块导入时服务未就绪导致的注入链断裂问题。"""
        if self._herb_knowledge_loaded:
            return
        self._herb_knowledge_loaded = True

        # 如果显式提供了 herb_knowledge，直接使用
        if self._herb_knowledge is not None:
            try:
                from .bayesian_formula_optimizer import HerbParameter
                all_herbs = self._herb_knowledge.get_herbs()
                if all_herbs:
                    new_herbs = {}
                    new_index: dict = {}
                    for herb_id, profile in all_herbs.items():
                        new_herbs[herb_id] = HerbParameter(
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
                return
            except Exception as e:
                logger.warning(f"[GeneticOptimizer] HerbKnowledgePort 加载失败: {e}")

        # 惰性尝试自动注入（解决启动时服务未就绪问题）
        try:
            from .bayesian_formula_optimizer import HerbParameter as _HerbParameter
            from .herb_knowledge_service import get_global_herb_knowledge
            hk = get_global_herb_knowledge()
            if hk is None:
                raise RuntimeError("[数据完整性] HerbKnowledgeService 未初始化，请先运行 init_ai_services()")

            all_herbs = hk.get_herbs()
            if not all_herbs or len(all_herbs) < 20:
                raise RuntimeError(
                    f"[数据完整性] 数据库药材不足: 实际 {len(all_herbs) if all_herbs else 0} 种, "
                    f"最低要求 20 种。请运行: python -m app.services.recipe_generation_data_completer"
                )

            new_herbs = {}
            new_index: dict = {}
            for herb_id, profile in all_herbs.items():
                new_herbs[herb_id] = _HerbParameter(
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
            logger.info(f"[GeneticOptimizer] ✅ 数据库加载成功: {len(all_herbs)} 种药材")

        except RuntimeError:
            raise
        except Exception as e:
            logger.error(f"[数据完整性] 数据库加载失败: {e}")
            raise

    def _build_admitted_herb_set(self) -> frozenset:
        """R1 治本：一次性构建通过 L0 准入（106 药食同源目录）的 herb_id 集合。

        单一事实源：直接复用 safety_gate.check_herb_admission（内部已做
        canonical 归一 + 黑名单 + 106 目录判定），本方法**不另抄 106 名单**。
        性能：按 name_cn 缓存准入判定（_admitted_name_cache），整个药材库
        每次 optimize() 只做一轮准入检查（~590 次），结果被全代全种群复用；
        同名药材（多个 herb_id）命中同一缓存，不重复调用准入服务。

        Returns:
            通过准入的 herb_id 的 frozenset（不可变，供候选池过滤直接使用）。
        """
        admitted: set = set()
        for hid, herb in self._herbs.items():
            name_cn = getattr(herb, "name_cn", "") or hid
            cached = self._admitted_name_cache.get(name_cn)
            if cached is None:
                # check_herb_admission 内部已 canonicalize，直接传原始 name_cn 即可
                try:
                    from app.services.ai.safety.safety_gate import check_herb_admission
                    cached = bool(check_herb_admission(name_cn).admitted)
                except Exception as e:  # pragma: no cover - 准入服务异常时保守放行
                    logger.warning(
                        f"[GeneticAlgorithm] 准入检查异常（{name_cn}）按不通过处理: {e}"
                    )
                    cached = False
                self._admitted_name_cache[name_cn] = cached
            if cached:
                admitted.add(hid)
        return frozenset(admitted)

    def optimize(self, target_effects: List[str], exclude_herbs: Optional[set] = None,
                 _cancel_signal: Optional[threading.Event] = None,
                 progress_callback: Optional[callable] = None,
                 include_herbs: Optional[List[str]] = None,
                 special_population: str = "adult",
                 count: int = 10) -> Tuple[List[Individual], List[Dict]]:
        """执行遗传算法优化，返回 (结果列表, 进化历史)

        Args:
            target_effects: 目标功效列表
            exclude_herbs: 可选，需要排除的药材集合（支持 herb_id 或中文名）
            count: 返回的去重后 Top-N 候选数量（默认 10）
        """
        # 惰性加载 HerbKnowledgeService（解决注入链断裂问题）
        self._try_load_herb_knowledge()

        # 将中文药名归一化为 herb_id（兼容前端传中文名/ID 两种形式）。
        # 必须在 _try_load_herb_knowledge 之后执行，否则 self._herbs 为空，
        # 中文名无法映射到 ID，排除约束会静默失效。
        # 同名药材可能存在多个 herb_id（如黄芪 hq / 黄芪根 hqg），全部加入排除集合。
        if exclude_herbs:
            name_to_ids: Dict[str, List[str]] = {}
            for hid, h in self._herbs.items():
                cn = getattr(h, "name_cn", "")
                if cn:
                    name_to_ids.setdefault(cn, []).append(hid)
            normalized_exclude: set = set()
            for item in exclude_herbs:
                if item in self._herbs:
                    normalized_exclude.add(item)
                elif item in name_to_ids:
                    normalized_exclude.update(name_to_ids[item])
                else:
                    normalized_exclude.add(item)
            exclude_herbs = normalized_exclude

        # 将英文功效ID转换为中文标签（与后端疗效数据库一致）
        target_effects = _translate_effect_ids(target_effects)
        self.config.target_effects = target_effects

        # 特殊人群禁忌药材硬排除（在候选阶段即过滤，而非仅在评分阶段软惩罚）
        population_exclude = set(exclude_herbs or [])
        if special_population == "pregnant":
            population_exclude |= {"cs", "dg", "fz", "mld", "lk"}
        elif special_population == "children":
            population_exclude |= {"fz", "lk", "mld"}
        elif special_population == "elderly":
            population_exclude |= {"rs"}

        # 设置随机种子（可重复性）
        if self.config.seed is not None:
            random.seed(self.config.seed)
            logger.info(f"[GeneticAlgorithm] 设置随机种子: {self.config.seed}")

        # Step 1: 选择候选药材（支持排除药材 + 特殊人群硬排除 + L0 目录准入过滤）
        # R1 治本：先一次性构建"106 目录准入"缓存集合，再在 _select_herbs 内部
        # 于截断（[:25]）之前过滤候选池。旧实现在截断后才过滤，非目录药材已挤占
        # 25 个名额，导致目录内药材被挤出、池规模骤减甚至 <3 而直接降级。
        # 准入集合按 name 缓存，整轮 optimize 只构建一次，全代全种群复用。
        self._admitted_herbs = self._build_admitted_herb_set()
        logger.info(
            f"[GeneticAlgorithm] L0 准入缓存构建：药材库 {len(self._herbs)} 种，"
            f"通过 106 目录准入 {len(self._admitted_herbs)} 种"
        )

        candidates = self._select_herbs(target_effects, exclude_herbs=population_exclude,
                                         include_herbs=include_herbs)

        if len(candidates) < 3:
            logger.warning(f"候选药材不足 ({len(candidates)})")
            return [], []

        logger.info(f"[GeneticAlgorithm] 种群={self.config.population_size}, "
                    f"代数={self.config.generations}, "
                    f"候选药材={len(candidates)}种")

        # Step 2: 初始化种群
        population = self._init_population(candidates, exclude_herbs=population_exclude)
        # P1 修复：评分统一使用数据库药材字典 self._herbs（含特殊人群标记注入），
        # 不再回退 _BUILTIN_HERBS，确保数据库药材在评分中贡献真实功效/安全数据。
        scoring_herbs = dict(self._herbs)
        if special_population and special_population != "adult":
            scoring_herbs["__target_group__"] = special_population
        for ind in population:
            ind.evaluate(target_effects, herb_dict=scoring_herbs)
            # 阶段1：注入真实君臣佐使结构合规度并重算适应度
            self._apply_structural_compliance(ind, scoring_herbs)

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
            # 计算本代多样性（必须在取消检查之前，供取消处理器使用）
            diversity = self._compute_diversity(population)
            # ★ 候选多样性深化（2026-11-09）★
            # _compute_diversity 基于剂量欧氏距离：同组合、不同剂量会被误判为"多样"，
            # 无法察觉"top-N 药材组合雷同"的收敛。补充组合签名多样性，并取二者较小值
            # 作为有效多样性 —— 一旦组合收敛即触发多样化重启/移民与提高变异率。
            combo_diversity = self._compute_combination_diversity(population)
            effective_diversity = min(diversity, combo_diversity)

            # ── 取消信号检查 ──
            if _cancel_signal is not None and _cancel_signal.is_set():
                logger.info("[GeneticAlgorithm] 收到取消信号，提前终止进化")
                # 即时计算统计值（取消处理器需要这些变量）
                fitnesses_now = [ind.fitness for ind in population]
                avg_fitness_now = sum(fitnesses_now) / len(fitnesses_now)
                min_fitness_now = min(fitnesses_now)
                history.append({
                    "generation": gen + 1,
                    "best_fitness": round(best_fitness, 6),
                    "avg_fitness": round(avg_fitness_now, 6),
                    "min_fitness": round(min_fitness_now, 6),
                    "diversity": round(diversity, 6),
                    "stop_reason": "cancelled",
                })
                # 院士级修复[P0]: 返回当前最优种群而非空列表，避免用户取消后数据丢失
                # 去重时基于整个种群，确保返回多个差异化候选（修复过度去重问题）
                return self._deduplicate(population)[:count], history
            new_population = []

            # 精英保留（★ 组合签名去重：避免同一组合多份精英挤压种群多样性 ★）
            n_elite = max(1, int(self.config.population_size * self.config.elite_ratio))
            new_population.extend(self._dedup_elites_by_signature(population, n_elite))

            # ── 种群恢复机制（院士级修复[P1-A3]）──
            # 当多样性持续低于阈值时，注入随机个体打破收敛
            # ★ 深化：改用有效多样性（剂量∧组合），组合收敛同样触发移民 ★
            if effective_diversity < 0.15:
                recovery_count = max(1, int(self.config.population_size * 0.2))
                logger.info(
                    f"[GeneticAlgorithm] 有效多样性过低 (剂量={diversity:.4f}, 组合={combo_diversity:.4f})，"
                    f"注入 {recovery_count} 个随机个体"
                )
                for _ in range(recovery_count):
                    genes = {}
                    for hid in candidates:
                        if hid in self._herbs and random.random() > 0.3:
                            herb = self._herbs[hid]
                            dosage = herb.dosage_min + random.random() * (herb.dosage_max - herb.dosage_min)
                            dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                            genes[hid] = max(herb.dosage_min, min(herb.dosage_max, dosage))
                    if len(genes) >= 3:
                        ind = self._new_individual(genes)
                        ind.evaluate(target_effects, herb_dict=scoring_herbs)
                        self._apply_structural_compliance(ind, scoring_herbs)
                        new_population.append(ind)

            # 自适应变异率：根据种群有效多样性（剂量∧组合）动态调整实际变异概率
            if self.config.adaptive_mutation:
                if effective_diversity < 0.2:
                    actual_mutation_rate = self.config.mutation_rate * 2.5   # 低多样性强扰动
                elif effective_diversity < 0.4:
                    actual_mutation_rate = self.config.mutation_rate * 1.5   # 中等偏低加强扰动
                elif effective_diversity < 0.6:
                    actual_mutation_rate = self.config.mutation_rate * 1.0   # 正常
                else:
                    actual_mutation_rate = self.config.mutation_rate * 0.7   # 高多样性可降低扰动
                # 确保变异率不超过合理上限
                actual_mutation_rate = min(actual_mutation_rate, 0.8)
            else:
                actual_mutation_rate = self.config.mutation_rate

            # 生成后代（使用自适应变异率）
            # ★ niching/拥挤度（适应度共享）★：按当前种群各组合签名出现次数对锦标赛
            # 选择做降权 —— 高频组合的个体被压低选择概率，维持种群药材组合多样性，
            # 直接缓解"选择压力+精英保留"导致的组合收敛。
            combo_counts = self._combo_signature_counts(population)
            while len(new_population) < self.config.population_size:
                parent1 = self._tournament_select(population, combo_counts)
                parent2 = self._tournament_select(population, combo_counts)

                if random.random() < self.config.crossover_rate:
                    child1, child2 = self._crossover(parent1, parent2)
                else:
                    child1, child2 = self._new_individual(parent1.genes), self._new_individual(parent2.genes)

                if random.random() < actual_mutation_rate:
                    self._mutate(child1, candidates)
                if random.random() < actual_mutation_rate:
                    self._mutate(child2, candidates)

                child1.evaluate(target_effects, herb_dict=scoring_herbs)
                child2.evaluate(target_effects, herb_dict=scoring_herbs)
                # 阶段1：注入真实君臣佐使结构合规度并重算适应度
                self._apply_structural_compliance(child1, scoring_herbs)
                self._apply_structural_compliance(child2, scoring_herbs)
                new_population.append(child1)
                if len(new_population) < self.config.population_size:
                    new_population.append(child2)

            population = new_population
            population.sort(key=lambda x: x.fitness, reverse=True)

            _ = best_fitness
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
                "combination_diversity": round(combo_diversity, 6),
                "adaptive_mutation_rate": round(actual_mutation_rate, 6),
            })

            # 通知进度回调（用于 SSE 流式推送）
            if progress_callback:
                try:
                    progress_callback({
                        "generation": gen + 1,
                        "best_fitness": round(best_fitness, 6),
                        "avg_fitness": round(avg_fitness, 6),
                        "min_fitness": round(min_fitness, 6),
                        "diversity": round(diversity, 6),
                    })
                except Exception:
                    pass

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
        # ★ 候选多样性硬保证（2026-11-09 深化）★
        # 审计复现：cand 0/3/4 完全一致（选择压力+精英保留收敛）。
        # 修法：最终候选按「药材组合签名」严格去重，确保返回的 top-N 药材组合互不相同；
        # 若同组合候选不足 count，放宽到「不同剂量分布」（量化到 dosage_step 粒度）补足。
        # 彻底废弃旧的「相似也补充」回填逻辑（它会重新引入结构相同的候选）。
        deduped = self._dedup_by_combination_signature(population, count)
        return deduped[:count], history

    def _dedup_by_combination_signature(self, individuals: List[Individual],
                                         count: int) -> List[Individual]:
        """按药材组合签名严格去重 — 保证返回候选的药材组合互不相同。

        两级策略：
          Tier 1（组合签名）：签名 = frozenset(genes.keys())。同组合只保留 fitness
            最高者 → 保证返回的药材组合**互不相同**。
          Tier 2（剂量分布放宽）：若 Tier 1 不足 count，在同组合内按「量化剂量指纹」
            补充剂量分布明显不同的个体（每味剂量按 dosage_step 量化后取整指纹），
            确保补进来的候选不是原候选的剂量复制品。

        个体按 fitness 降序处理，输出保持 fitness 降序。

        Args:
            individuals: 候选个体（通常为整个种群，fitness 已排序或未排序均可）
            count: 期望的候选数量

        Returns:
            去重后的候选列表（≤ count，fitness 降序；组合互不相同或剂量分布不同）
        """
        # fitness 降序处理，确保同签名保留最优个体
        ordered = sorted(individuals, key=lambda x: x.fitness, reverse=True)

        # ── Tier 1：药材组合签名去重（互不相同）──
        seen_combos: set = set()
        tier1: List[Individual] = []
        for ind in ordered:
            if not ind.genes:
                continue
            combo_sig = frozenset(ind.genes.keys())
            if combo_sig in seen_combos:
                continue
            seen_combos.add(combo_sig)
            tier1.append(ind)
            if len(tier1) >= count:
                return tier1[:count]

        # ── Tier 2：同组合剂量分布放宽（量化指纹去重）──
        # 仅当 Tier1 不足 count 时执行；补充「同组合但剂量分布不同」的个体。
        seen_dosage_sigs: set = set()
        # 预填 Tier1 已选个体的剂量指纹，避免 Tier2 重复
        for ind in tier1:
            seen_dosage_sigs.add(self._dosage_signature(ind))

        result: List[Individual] = list(tier1)
        result_ids: set = {id(ind) for ind in tier1}
        for ind in ordered:
            if len(result) >= count:
                break
            if id(ind) in result_ids:
                continue
            combo_sig = frozenset(ind.genes.keys())
            if combo_sig not in seen_combos:
                # 新组合理论已在 Tier1 收录，防御性跳过
                continue
            dos_sig = self._dosage_signature(ind)
            if dos_sig in seen_dosage_sigs:
                continue
            seen_dosage_sigs.add(dos_sig)
            result.append(ind)
            result_ids.add(id(ind))

        return result[:count]

    def _dosage_signature(self, ind: Individual) -> tuple:
        """生成个体的量化剂量指纹（每味剂量按 dosage_step 量化后取整）。

        用于 Tier2 判断「同组合的不同剂量分布」是否真的不同。
        量化粒度 = 该药材的 dosage_step；缺失 herbs 时退化为原值。
        """
        sig = []
        for hid in sorted(ind.genes.keys()):
            dosage = ind.genes[hid]
            herb = self._herbs.get(hid)
            if herb and herb.dosage_step:
                step = max(herb.dosage_step, 0.01)
                quantized = int(round(dosage / step))
            else:
                quantized = int(round(dosage * 10))  # 退化为 0.1g 粒度
            sig.append((hid, quantized))
        return tuple(sig)

    def _compute_diversity(self, population: List[Individual]) -> float:
        """计算种群多样性 — 院士级修复[P0]: 剂量感知欧氏距离

        原实现仅比较药材ID集合（Jaccard），完全忽略了剂量差异。
        修复后：对每个个体构建归一化剂量向量（覆盖所有药材ID），
        计算成对欧氏距离的平均值，反映真实的配方差异。
        """
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
            if hid in self._herbs:
                herb = self._herbs[hid]
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

        # 归一化到 [0, 1] 区间
        max_possible = math.sqrt(n_herbs) * count if count > 0 else 1
        return total_dist / max_possible

    def _combo_signature_counts(self, population: List[Individual]) -> Dict[frozenset, int]:
        """统计种群中各药材组合签名（frozenset(genes.keys())）的出现次数。

        供 niching/适应度共享使用：同组合个体越多，该组合在选择时被降权越多。
        """
        counts: Dict[frozenset, int] = {}
        for ind in population:
            sig = frozenset(ind.genes.keys())
            counts[sig] = counts.get(sig, 0) + 1
        return counts

    def _compute_combination_diversity(self, population: List[Individual]) -> float:
        """组合多样性 = 种群中互异药材组合签名占比 (0~1)。

        _compute_diversity 基于剂量欧氏距离，"同组合不同剂量"会被判为多样，
        无法反映"top-N 组合雷同"的收敛。本指标直接统计组合签名去重率，
        用于触发多样化重启/移民与提高变异率。
        """
        if not population:
            return 1.0
        sigs = {frozenset(ind.genes.keys()) for ind in population if ind.genes}
        if not sigs:
            return 1.0
        return len(sigs) / len(population)

    def _dedup_elites_by_signature(self, population: List[Individual],
                                   n_elite: int) -> List[Individual]:
        """精英保留按组合签名去重 — 避免同一组合多份精英挤压种群多样性。

        population 已按 fitness 降序。先按组合签名 (frozenset(genes.keys())) 去重，
        同组合只保留 fitness 最高的一份精英；若去重后不足 n_elite，再按剂量指纹
        放宽补足（同组合不同剂量分布），确保精英既优质又互异，为后代提供多样的
        亲本，而不是把同一个优势组合复制多份塞进下一代。

        Returns:
            ≤ n_elite 个互异精英（组合签名互不相同或剂量分布不同），fitness 降序。
        """
        selected: List[Individual] = []
        selected_ids: set = set()
        seen_combos: set = set()

        # 第一轮：组合签名去重，同组合取最优
        for ind in population:
            if len(selected) >= n_elite:
                break
            if not ind.genes or id(ind) in selected_ids:
                continue
            sig = frozenset(ind.genes.keys())
            if sig in seen_combos:
                continue
            seen_combos.add(sig)
            selected.append(ind)
            selected_ids.add(id(ind))

        # 第二轮：不足则按剂量指纹放宽补足（同组合不同剂量分布）
        if len(selected) < n_elite:
            seen_dos = {self._dosage_signature(ind) for ind in selected}
            for ind in population:
                if len(selected) >= n_elite:
                    break
                if id(ind) in selected_ids or not ind.genes:
                    continue
                dos = self._dosage_signature(ind)
                if dos in seen_dos:
                    continue
                seen_dos.add(dos)
                selected.append(ind)
                selected_ids.add(id(ind))

        return selected

    def _select_herbs(self, target_effects: List[str], exclude_herbs: Optional[set] = None,
                      include_herbs: Optional[List[str]] = None) -> List[str]:
        """选择候选药材

        Args:
            target_effects: 目标功效列表
            exclude_herbs: 可选，需要排除的药材集合
            include_herbs: 可选，用户指定的基础配方药材（强制包含）

        院士级修复[P0]: 使用 self._herbs（已注入 HerbKnowledgeService 数据）
        替代硬编码的 _BUILTIN_HERBS，确保动态药材库参与优化。
        """
        exclude_herbs = exclude_herbs or set()
        include_herbs_set = set(include_herbs or [])
        candidate_set: Dict[str, float] = {}
        herbs = self._herbs  # 使用注入的 herb_db，而非 _BUILTIN_HERBS

        # 用户强制包含的药材（基础配方），高优先级加入候选集
        for hid in include_herbs_set:
            if hid in herbs and hid not in exclude_herbs:
                candidate_set[hid] = 1.0  # 最高优先级

        for effect in target_effects:
            if effect in self._efficacy_index:
                for hid in self._efficacy_index[effect]:
                    if hid not in exclude_herbs and hid in herbs:
                        score = herbs[hid].efficacy_scores.get(effect, 0)
                        candidate_set[hid] = max(candidate_set.get(hid, 0), score)

        # 添加协同药材
        for hid in list(candidate_set.keys()):
            if hid in herbs:
                for p in herbs[hid].synergy_partners:
                    if p in herbs and p not in candidate_set and p not in exclude_herbs:
                        candidate_set[p] = 0.1  # 低权重引入

        sorted_h = sorted(candidate_set.keys(), key=lambda x: candidate_set[x], reverse=True)

        # 过滤排除的药材
        if exclude_herbs:
            sorted_h = [h for h in sorted_h if h not in exclude_herbs]

        # R1 治本：L0 目录准入过滤（在截断 [:25] **之前**，避免非目录药挤占名额）。
        # 仅保留通过 check_herb_admission 的 herb_id（_admitted_herbs 由 optimize()
        # 每次 optimize 一次性构建并缓存，此处只做 set 查询，无重复准入调用）。
        # 语义：include_herbs（用户强制包含）不受准入过滤约束，尊重其强制语义，
        # 但这类药材最终仍会被下游 check_formula_safety 复核。
        admitted = getattr(self, "_admitted_herbs", frozenset())
        if admitted:
            before = len(sorted_h)
            filtered_h = [h for h in sorted_h if h in admitted or h in include_herbs_set]
            removed = before - len(filtered_h)
            if removed > 0:
                removed_names = []
                for hid in sorted_h:
                    if hid not in admitted and hid not in include_herbs_set:
                        herb = self._herbs.get(hid)
                        removed_names.append(getattr(herb, "name_cn", "") or hid)
                self._last_admission_removed = removed_names
                logger.info(
                    f"[GeneticAlgorithm] L0 目录准入过滤（截断前）：候选池 {before} → "
                    f"{len(filtered_h)}，剔除 {removed} 味非 106 目录药材 "
                    f"{removed_names[:20]}"
                )
            sorted_h = filtered_h

        # 退避保护：过滤后某功效候选池 <3 味时，退回不过滤的池并告警，
        # 避免 GA 完全无解（该情形由上层降级处理）。仅在过滤真的导致不足时触发。
        if len(sorted_h) < 3:
            # 重新计算未过滤池（排除药材仍然生效，但不做准入过滤）
            candidate_ids = set(candidate_set.keys()) - set(exclude_herbs or set())
            if len(candidate_ids) >= 3 and len(candidate_ids) > len(sorted_h):
                logger.warning(
                    f"[GeneticAlgorithm] L0 准入过滤后候选池不足 ({len(sorted_h)} < 3)，"
                    f"退回未过滤池（{len(candidate_ids)} 味）——该功效目录内药材稀缺，"
                    f"上层将按降级处理"
                )
                return sorted(
                    candidate_ids,
                    key=lambda x: candidate_set[x],
                    reverse=True,
                )[:25]

        return sorted_h[:25]  # 从15增加到25，提供更多多样性

    def _init_population(self, candidates: List[str], exclude_herbs: Optional[set] = None) -> List[Individual]:
        """初始化种群 — 院士级修复[P1-A1]: 加入 TCM 经典方剂种子

        种子个体来源:
        - 经典方剂（四君子汤、六味地黄丸等）: 代表千年验证的配伍智慧
        - 功效最佳药材: 按目标功效选取评分最高的药材
        - 随机采样: 填充剩余种群
        """
        herbs = self._herbs
        population = []
        n = len(candidates)
        # R1 治本：候选池已通过 L0 目录准入过滤，经典方剂种子只能复用池内药材。
        # 旧逻辑用 `hid in herbs`（全药材库）判定，导致四君子汤的白术(bq)等
        # 非目录药材经种子重新混入种群，绕过准入过滤、下游被安全闸门整候选淘汰。
        # 改为 `hid in candidate_pool`（= 准入后的 candidates），种子与候选池同源。
        candidate_pool = set(candidates)

        # ═══ 种子 1: TCM 经典方剂 ═══
        # 格式: {herb_id: dosage} — 仅保留候选池中存在的药材
        classic_formulas = [
            {"四君子汤": {"ds": 12, "bq": 9, "fp": 9, "gq": 6}},       # 补气基础方
            {"六味地黄丸": {"gz": 9, "dg": 6, "bq": 6, "fp": 6, "mld": 4, "jgh": 4}},  # 滋阴基础方
            {"桂枝汤": {"sj": 6, "dcx": 9, "gq": 6, "hq": 9}},          # 解表调和方
            {"逍遥散": {"ds": 9, "fp": 9, "bq": 9, "dg": 6, "cs": 6, "sj": 3}},  # 疏肝健脾
            {"银翘散": {"cyh": 9, "jgh": 9, "gq": 6, "sj": 6, "ds": 9}},  # 清热解毒
        ]
        for formula_data in classic_formulas:
            formula_name = list(formula_data.keys())[0]
            formula_herbs = formula_data[formula_name]
            genes = {}
            for hid, dosage in formula_herbs.items():
                if exclude_herbs and hid in exclude_herbs:
                    continue  # 跳过排除的药材
                if hid in candidate_pool and hid in herbs:
                    # 将经典剂量缩放到 herb 的合法范围内
                    herb = herbs[hid]
                    clamped = max(herb.dosage_min, min(herb.dosage_max, dosage))
                    clamped = round(clamped / herb.dosage_step) * herb.dosage_step
                    genes[hid] = max(herb.dosage_min, clamped)
            if len(genes) >= 3:
                population.append(self._new_individual(genes))

        # ═══ 种子 2: 功效最佳药材 + 随机打乱 ═══
        for i in range(min(5, n)):
            shuffled_candidates = list(candidates)
            random.shuffle(shuffled_candidates)
            genes = {}
            for j, hid in enumerate(shuffled_candidates):
                if hid in herbs:
                    herb = herbs[hid]
                    base_ratio = max(0.1, 1.0 - abs(j - i) * 0.15)
                    dosage = herb.dosage_min + base_ratio * (herb.dosage_max - herb.dosage_min)
                    dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                    dosage = max(herb.dosage_min, min(herb.dosage_max, dosage))
                    if dosage > 0:
                        genes[hid] = dosage
            population.append(self._new_individual(genes))

        # ═══ 填充随机采样（确保多样性：随机选择3-8味药材）═══
        for _ in range(self.config.population_size - len(population)):
            genes = {}
            # 随机选择药材子集（3-8味），而非全选
            num_herbs = random.randint(3, min(8, len(candidates)))
            selected = random.sample(candidates, num_herbs)
            for hid in selected:
                if hid in herbs:
                    herb = herbs[hid]
                    dosage = herb.dosage_min + random.random() * (herb.dosage_max - herb.dosage_min)
                    dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                    dosage = max(herb.dosage_min, min(herb.dosage_max, dosage))
                    genes[hid] = dosage
            if len(genes) >= 3:
                population.append(self._new_individual(genes))

        return population[:self.config.population_size]

    def _tournament_select(self, population: List[Individual],
                           combo_counts: Optional[Dict[frozenset, int]] = None) -> Individual:
        """锦标赛选择（★ 可选 niching/适应度共享 ★）

        当传入 combo_counts（种群中各药材组合签名的出现次数）时，采用适应度共享：
        个体以 fitness / sqrt(1 + 同组合个体数) 参与竞争，使高频组合被降权，
        维持种群药材组合多样性，缓解选择压力导致的收敛。
        不传 combo_counts 时退化为原始锦标赛（向后兼容）。
        """
        contestants = random.sample(population, min(self.config.tournament_size, len(population)))
        if combo_counts:
            def _shared_fitness(ind: Individual) -> float:
                niche = combo_counts.get(frozenset(ind.genes.keys()), 1)
                return ind.fitness / math.sqrt(1.0 + max(0, niche - 1))
            return max(contestants, key=_shared_fitness)
        return max(contestants, key=lambda x: x.fitness)

    def _crossover(self, p1: Individual, p2: Individual) -> Tuple[Individual, Individual]:
        """算术交叉 (Blend crossover with alpha)

        院士级修复[P2]: 移除原代码中50%概率的随机继承分支，
        确保交叉算子在 crossover_rate 触发时始终执行真正的交叉操作。
        父代基因通过加权平均产生子代，alpha 在 [0,1] 均匀采样。
        """
        herbs = self._herbs
        all_herbs = set(p1.genes.keys()) | set(p2.genes.keys())
        alpha = random.random()

        genes1, genes2 = {}, {}
        for hid in all_herbs:
            d1 = p1.genes.get(hid, 0)
            d2 = p2.genes.get(hid, 0)
            # 纯算术交叉：无随机继承分支
            genes1[hid] = alpha * d1 + (1 - alpha) * d2
            genes2[hid] = (1 - alpha) * d1 + alpha * d2

        # 边界裁剪
        for g in [genes1, genes2]:
            for hid in list(g.keys()):
                if hid in herbs and g[hid] > 0:
                    herb = herbs[hid]
                    g[hid] = max(herb.dosage_min, min(herb.dosage_max, g[hid]))
                    g[hid] = round(g[hid] / herb.dosage_step) * herb.dosage_step

        return self._new_individual(genes1), self._new_individual(genes2)

    def _mutate(self, ind: Individual, candidates: List[str]):
        """高斯变异 + 添加/删除药材

        院士级修复[P2]: 使用 self._herbs 替代硬编码 _BUILTIN_HERBS。
        """
        herbs = self._herbs
        for hid in list(ind.genes.keys()):
            if random.random() < 0.3 and hid in herbs:
                herb = herbs[hid]
                mu = ind.genes[hid]
                sigma = (herb.dosage_max - herb.dosage_min) * 0.2
                new_d = mu + random.gauss(0, sigma)
                if new_d <= herb.dosage_min:
                    # 防御：如果删除后只剩少于3味药材，不删除而是设为最小值
                    if len(ind.genes) <= 3:
                        ind.genes[hid] = herb.dosage_min
                    else:
                        del ind.genes[hid]  # 低于下限 → 移除
                else:
                    new_d = round(new_d / herb.dosage_step) * herb.dosage_step
                    ind.genes[hid] = min(herb.dosage_max, new_d)

        # 小概率添加新药材
        if random.random() < 0.2:
            new_h = random.choice(candidates)
            if new_h not in ind.genes and new_h in herbs:
                herb = herbs[new_h]
                dosage = herb.dosage_min + random.random() * (herb.dosage_max - herb.dosage_min)
                dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                ind.genes[new_h] = max(herb.dosage_min, dosage)

        # 变异后强制检查：至少保留3味药材
        if len(ind.genes) < 3 and len(candidates) >= 3:
            for hid in candidates:
                if hid not in ind.genes and hid in herbs and len(ind.genes) < 3:
                    herb = herbs[hid]
                    dosage = herb.dosage_min + random.random() * (herb.dosage_max - herb.dosage_min)
                    dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                    ind.genes[hid] = max(herb.dosage_min, dosage)

    def _deduplicate(self, individuals: List[Individual]) -> List[Individual]:
        """Jaccard + 剂量相似度去重 — 确保返回多个差异化候选。

        修复：原 0.85 阈值过高导致 max_candidates=3 只返回 1 个候选。
        新策略：
        1. 仅在「药材集合 Jaccard > 0.6 且共有药材剂量分布高度相似」时判重；
           同药材不同剂量的配方视为差异化候选，保留下来。
        2. 对整个种群去重后按适应度降序排序，调用方再截断 Top-N。
        """
        def _dosage_profile_similar(a: Individual, b: Individual) -> bool:
            """共有药材的剂量相对差异 ≤30% 视为剂量分布相似。"""
            common = set(a.genes.keys()) & set(b.genes.keys())
            if not common:
                return False
            diffs = []
            for hid in common:
                da = a.genes.get(hid, 0.0)
                db = b.genes.get(hid, 0.0)
                denom = max(da, db, 1.0)
                diffs.append(abs(da - db) / denom)
            return sum(diffs) / len(diffs) <= 0.30

        unique = []
        for ind in individuals:
            dup = False
            for existing in unique:
                its = set(ind.genes.keys()) & set(existing.genes.keys())
                uni = set(ind.genes.keys()) | set(existing.genes.keys())
                if uni and len(its) / len(uni) > 0.6 and _dosage_profile_similar(ind, existing):
                    dup = True
                    break
            if not dup:
                unique.append(ind)
        # 按适应度降序排序，确保返回的是 Top-N 最优差异化候选
        unique.sort(key=lambda x: x.fitness, reverse=True)
        return unique

    # ═════════════════════════════════════════
    # 君臣佐使结构评估
    # ═════════════════════════════════════════

    def _apply_structural_compliance(self, individual: Individual, herbs: Dict) -> float:
        """
        阶段1 治本：计算真实的君臣佐使结构合规度并注入 Individual，重算 fitness。

        根治审计缺陷——旧代码 `Individual.structural_compliance = 0.7` 硬编码，
        真正的 `_evaluate_structural_compliance`（下方）从未被调用。本方法在每个
        评估点被调用，确保结构合规度真实进入适应度乘法因子。

        Returns:
            注入的真实结构合规度 (0~1)
        """
        real_sc = self._evaluate_structural_compliance(individual, herbs)
        individual.structural_compliance = real_sc
        # 用缓存的基座加权适应度按真实结构合规度重算（避免浮点误差累积）
        individual.fitness = individual._base_weighted_fitness * (0.5 + 0.5 * real_sc)
        return real_sc

    def _evaluate_structural_compliance(self, individual: Individual, herbs: Dict) -> float:
        """
        评估配方的君臣佐使结构合规度 (0~1)。

        理想结构:
        - 君药 1-2 味: 最高剂量, 针对主证
        - 臣药 2-3 味: 次高剂量, 辅助君药
        - 佐药 1-2 味: 较低剂量, 减毒/兼治
        - 使药 1 味: 最低剂量, 引经/调和

        评分规则:
        - 按剂量降序排序药材
        - Top 1-2 = 君药, 接下来 2-3 = 臣药, 接下来 1-2 = 佐药, 最后 1 = 使药
        - 检查每组的剂量递减关系和数量合理性
        """
        n = len(individual.genes)
        if n < 3:
            return 0.0

        # 按剂量降序排序
        sorted_herbs = sorted(individual.genes.items(), key=lambda x: x[1], reverse=True)

        # 理想分组
        jun_end = min(2, n)          # 君药: 1-2味
        chen_end = min(jun_end + 3, n)  # 臣药: 2-3味
        zuo_end = min(chen_end + 2, n)  # 佐药: 1-2味
        # 使药: 剩余

        score = 0.0
        parts = 0

        # 1. 剂量递减检查: 君药中位剂量 >= 臣药中位剂量 >= 佐药中位剂量
        groups = [
            ("君药", sorted_herbs[:jun_end]),
            ("臣药", sorted_herbs[jun_end:chen_end]),
            ("佐药", sorted_herbs[chen_end:zuo_end]),
            ("使药", sorted_herbs[zuo_end:]),
        ]

        group_medians = []
        for name, group in groups:
            if group:
                dosages = [d for _, d in group]
                group_medians.append((name, sorted(dosages)[len(dosages) // 2]))

        for i in range(len(group_medians) - 1):
            hi_d = group_medians[i][1]
            lo_d = group_medians[i + 1][1]
            if hi_d > lo_d * 1.2:
                score += 0.25      # 严格递减（梯度明显）满分
            elif hi_d > lo_d:
                score += 0.15      # 弱递减
            elif hi_d == lo_d:
                score += 0.05      # 相等（扁平）仅少量分，抑制均分结构
            parts += 0.25

        # 2. 数量合理性: 君药1-2, 臣药2-3, 佐药1-2, 使药0-1
        group_sizes = [(name, len(group)) for name, group in groups]
        ideal_sizes = [("君药", (1, 2)), ("臣药", (2, 3)), ("佐药", (1, 2)), ("使药", (0, 1))]
        for (name, size), (ideal_name, (lo, hi)) in zip(group_sizes, ideal_sizes):
            if lo <= size <= hi:
                score += 0.15
            elif abs(size - ((lo + hi) // 2)) <= 1:
                score += 0.08
            parts += 0.15

        # 3. 剂量梯度: 君药/使药比应有实质梯度（>=2 满分），扁平结构（~1）不得分
        if sorted_herbs:
            max_dose = sorted_herbs[0][1]
            min_dose = sorted_herbs[-1][1]
            if min_dose > 0:
                ratio = max_dose / min_dose
                if ratio >= 2.0:
                    score += 0.15   # 君使比 >=2，梯度清晰
                elif ratio >= 1.5:
                    score += 0.08   # 弱梯度
                elif ratio <= 1.05:
                    pass            # 完全扁平（均分）不得分
                else:
                    score += 0.04
            parts += 0.15

        return score / max(parts, 1) if parts > 0 else 0.0

    def generate_with_result(self, target_effects: List[str], constraints: Optional[Dict] = None,
                             _cancel_signal: Optional[threading.Event] = None) -> 'GAResult':
        """执行遗传算法优化并返回完整结果对象（含历史记录和统计信息）"""
        constraints = constraints or {}

        # 提取排除药材约束（通过参数传递，不再 monkey-patch）
        exclude_set: Optional[set] = None
        if "exclude_herbs" in constraints and isinstance(constraints["exclude_herbs"], list):
            exclude_set = set(constraints["exclude_herbs"])

        # ===== 执行耗时统计开始 =====
        start_time = time.perf_counter()

        candidates, history = self.optimize(target_effects, exclude_herbs=exclude_set,
                                            _cancel_signal=_cancel_signal)

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        # ===== 执行耗时统计结束 =====

        # 处理最大成本约束：过滤超出成本的候选
        if "max_cost" in constraints and isinstance(constraints["max_cost"], (int, float)):
            max_c = constraints["max_cost"]
            filtered = []
            for ind in candidates:
                total_cost = sum(
                    dosage * (self._herbs[hid].cost_per_gram if hid in self._herbs else 0.1)
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

        total_evaluations = self.config.population_size * (
            history[-1]["generation"] if history else self.config.generations
        )
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
        OptimizationConfig,
        OptimizationObjective,
        get_nsga2_optimizer,
    )

    _ = get_nsga2_optimizer()
    config = OptimizationConfig(
        objectives=[
            OptimizationObjective("功效最大化", "efficacy", "maximize", 0.40),
            OptimizationObjective("安全性", "safety", "maximize", 0.25),
            OptimizationObjective("口感品质", "taste", "maximize", 0.15),
            OptimizationObjective("成本效率", "cost_efficiency", "maximize", 0.20),
        ],
        mode="weighted",
        constraints=constraints or {},
        population_size=40,
        generations=20,
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
from .multi_objective_optimizer import NSGAIIOptimizer


class NSGAIIMoBridgeOptimizer(NSGAIIOptimizer):
    """NSGA-II 桥接优化器 — 继承多目标引擎并适配旧接口

    用于 bridge_to_multi_objective 函数内部，
    避免污染全局单例的配置状态。
    """
    pass

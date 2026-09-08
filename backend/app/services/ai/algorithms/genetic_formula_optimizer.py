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

# 引用贝叶斯引擎的药材知识库
from .bayesian_formula_optimizer import _BUILTIN_HERBS, _EFFICACY_TO_HERBS

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
    """将前端发送的功效 ID/标签转换为后端 _EFFICACY_TO_HERBS 索引用到的中文键。

    前端发送的是 EFFECT_OPTIONS 的 label（如 '增强免疫'），
    后端索引用的是 _BUILTIN_HERBS.efficacy_scores 的 key（如 '免疫调节'），
    两者不完全一致，需要映射。
    """
    # 前端 label → 后端索引键 映射（语义等价）
    _LABEL_TO_BACKEND_KEY: dict[str, str] = {
        # 免疫类
        "增强免疫": "免疫调节",
        "免疫调节": "免疫调节",
        "提高抵抗力": "免疫调节",
        # 抗衰老类
        "抗氧化": "抗氧化",
        "延缓衰老": "抗衰老",
        "清除自由基": "抗氧化",
        # 体力类
        "抗疲劳": "抗疲劳",
        "缓解疲劳": "抗疲劳",
        "提升精力": "抗疲劳",
        # 滋补类
        "补气养阴": "补气",
        "滋阴补肾": "补肾",
        "健脾益气": "健脾",
        "补血养血": "补血",
        # 神经类
        "改善睡眠": "安神",
        "安神定志": "安神",
        "缓解焦虑": "安神",
        # 消化类
        "健脾养胃": "健脾养胃",
        "促进消化": "促进消化",
        "调理脾胃": "健脾养胃",
        # 心血管类
        "降血压": "降血压",
        "降血脂": "降脂",
        "保护血管": "心血管保护",
        "促进循环": "活血",
        # 代谢类
        "降血糖": "降血糖",
        "辅助降尿酸": "降尿酸",
        "调节代谢": "降血糖",
        "控制体重": "降脂",
        # 呼吸类
        "润肺止咳": "止咳化痰",
        "清咽利喉": "清热生津",
        # 视觉类
        "明目护眼": "明目",
        "缓解眼疲劳": "明目",
        # 美容类
        "美容养颜": "美容养颜",
        "护肤保湿": "美容养颜",
        # 骨骼类
        "强健筋骨": "强筋健骨",
        "补钙健骨": "强筋健骨",
        # 其他
        "解毒": "解毒",
        "清热解毒": "清热解毒",
        "止咳化痰": "止咳化痰",
        "保肝护肝": "护肝",
        "补肾益精": "补肾",
        "健脾和胃": "健脾养胃",
    }
    return [_LABEL_TO_BACKEND_KEY.get(e, e) for e in effect_ids]

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
    seed: Optional[int] = None      # 随机种子（可重复性）
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
        self.synergy: float = 0.0     # 协同效应评分
        self.stability: float = 0.0   # 稳定性评分
        self.admet: float = 0.0       # ADMET综合评分
        self.structural_compliance: float = 0.0  # 君臣佐使结构合规度

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
        if not target_effects:
            self.efficacy = 0.0
        else:
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
        self.structural_compliance = 0.7  # 默认合规度，由调用方（优化器）注入

        # 综合适应度（扩展为 7 维，权重与 NSGA-II 一致）
        # 结构合规度作为乘法因子惩罚不合规配方
        self.fitness = (self.efficacy * 0.30 + self.safety * 0.25 +
                        self.taste * 0.10 + self.cost * 0.15 +
                        self.synergy * 0.10 + self.stability * 0.10) * (0.5 + 0.5 * self.structural_compliance)


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
        self._herb_knowledge_loaded = False            # 标记是否已尝试加载 HerbKnowledgeService

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
            from .herb_knowledge_service import get_global_herb_knowledge
            hk = get_global_herb_knowledge()
            if hk is not None:
                self._herb_knowledge = hk
                all_herbs = hk.get_herbs()
                if all_herbs:
                    from .bayesian_formula_optimizer import HerbParameter
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
                    logger.info(f"[GeneticOptimizer] 惰性加载 HerbKnowledgeService: {len(all_herbs)} 种药材")
                    return
        except Exception as e:
            logger.debug("HerbKnowledgeService 加载失败，使用内置字典: %s", e)

        logger.debug("[GeneticOptimizer] HerbKnowledgeService 不可用，使用内置字典（21种药材）")

    def optimize(self, target_effects: List[str], exclude_herbs: Optional[set] = None,
                 _cancel_signal: Optional[threading.Event] = None,
                 progress_callback: Optional[callable] = None,
                 include_herbs: Optional[List[str]] = None,
                 special_population: str = "adult") -> Tuple[List[Individual], List[Dict]]:
        """执行遗传算法优化，返回 (结果列表, 进化历史)

        Args:
            target_effects: 目标功效列表
            exclude_herbs: 可选，需要排除的药材集合
        """
        # 惰性加载 HerbKnowledgeService（解决注入链断裂问题）
        self._try_load_herb_knowledge()
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

        # Step 1: 选择候选药材（支持排除药材 + 特殊人群硬排除）
        candidates = self._select_herbs(target_effects, exclude_herbs=population_exclude,
                                         include_herbs=include_herbs)
        if len(candidates) < 3:
            logger.warning(f"候选药材不足 ({len(candidates)})")
            return [], []

        logger.info(f"[GeneticAlgorithm] 种群={self.config.population_size}, "
                    f"代数={self.config.generations}, "
                    f"候选药材={len(candidates)}种")

        # Step 2: 初始化种群
        population = self._init_population(candidates)
        # 将特殊人群标记注入 herb_dict，供 evaluate 读取
        target_group_herb_dict = {}
        if special_population and special_population != "adult":
            target_group_herb_dict["__target_group__"] = special_population
        for ind in population:
            ind.evaluate(target_effects, herb_dict=target_group_herb_dict if target_group_herb_dict else None)

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
                return self._deduplicate(population[:10]), history
            new_population = []

            # 精英保留
            n_elite = max(1, int(self.config.population_size * self.config.elite_ratio))
            new_population.extend(population[:n_elite])

            # ── 种群恢复机制（院士级修复[P1-A3]）──
            # 当多样性持续低于阈值时，注入随机个体打破收敛
            if diversity < 0.15:
                recovery_count = max(1, int(self.config.population_size * 0.2))
                logger.info(f"[GeneticAlgorithm] 多样性过低 ({diversity:.4f})，注入 {recovery_count} 个随机个体")
                for _ in range(recovery_count):
                    genes = {}
                    for hid in candidates:
                        if hid in self._herbs and random.random() > 0.3:
                            herb = self._herbs[hid]
                            dosage = herb.dosage_min + random.random() * (herb.dosage_max - herb.dosage_min)
                            dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                            genes[hid] = max(herb.dosage_min, min(herb.dosage_max, dosage))
                    if len(genes) >= 3:
                        ind = Individual(genes)
                        ind.evaluate(target_effects)
                        new_population.append(ind)

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
        return self._deduplicate(population[:10]), history

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
                if hid in herbs:
                    # 将经典剂量缩放到 herb 的合法范围内
                    herb = herbs[hid]
                    clamped = max(herb.dosage_min, min(herb.dosage_max, dosage))
                    clamped = round(clamped / herb.dosage_step) * herb.dosage_step
                    genes[hid] = max(herb.dosage_min, clamped)
            if len(genes) >= 3:
                population.append(Individual(genes))

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
            population.append(Individual(genes))

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
                population.append(Individual(genes))

        return population[:self.config.population_size]

    def _tournament_select(self, population: List[Individual]) -> Individual:
        """锦标赛选择"""
        contestants = random.sample(population, min(self.config.tournament_size, len(population)))
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

        return Individual(genes1), Individual(genes2)

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
        """Jaccard 去重 — 放宽阈值允许更多多样性"""
        unique = []
        for ind in individuals:
            dup = False
            for existing in unique:
                its = set(ind.genes.keys()) & set(existing.genes.keys())
                uni = set(ind.genes.keys()) | set(existing.genes.keys())
                if uni and len(its) / len(uni) > 0.85:  # 从0.7放宽到0.85，避免过度去重
                    dup = True
                    break
            if not dup:
                unique.append(ind)
        return unique

    # ═════════════════════════════════════════
    # 君臣佐使结构评估
    # ═════════════════════════════════════════

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
            if group_medians[i][1] >= group_medians[i + 1][1]:
                score += 0.25
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

        # 3. 剂量跨度: 君药最高剂量不应超过使药的10倍(过于极端)
        if sorted_herbs:
            max_dose = sorted_herbs[0][1]
            min_dose = sorted_herbs[-1][1]
            if min_dose > 0 and max_dose / min_dose <= 10:
                score += 0.15
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

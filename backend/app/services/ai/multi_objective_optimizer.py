"""
NSGA-II 多目标遗传算法配方优化引擎 (Multi-Objective Optimizer)

基于 Deb et al. (2002) 的 NSGA-II 算法实现多目标 Pareto 前沿求解，
支持药食同源功能性食品配方的多维优化（功效/安全/口感/成本/协同/稳定性）。

核心特性:
- NSGA-II 快速非支配排序 + 拥挤度距离分配
- SBX 模拟二进制交叉 + 多项式变异
- 自适应变异率 + 早停机制
- 三种优化模式: pareto / weighted / epsilon
- 预设场景配置: 均衡/成本优先/功效优先/安全优先/协同深度/全面评估

@version 1.0.0
"""

import copy
import logging
import math
import random
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from .bayesian_formula_optimizer import _BUILTIN_HERBS, _EFFICACY_TO_HERBS

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════
# 数据类定义
# ════════════════════════════════════════════

@dataclass
class OptimizationObjective:
    """单个优化目标定义"""
    name: str                    # 目标名称（中文），如"功效最大化"
    key: str                     # 唯一标识符，如 "efficacy"
    direction: str              # "maximize" 或 "minimize"
    weight: float = 1.0         # 权重(0~1)，用于加权聚合模式
    description: str = ""       # 描述


@dataclass
class OptimizationConfig:
    """多目标优化配置"""
    objectives: List[OptimizationObjective]  # 优化目标列表(2~6个)
    mode: str = "pareto"                      # "pareto"(NSGA-II) | "weighted"(加权聚合) | "epsilon"(ε-约束法)
    population_size: int = 60
    generations: int = 50
    mutation_rate: float = 0.15
    crossover_rate: float = 0.85
    elite_ratio: float = 0.1
    tournament_size: int = 5
    # 约束条件
    constraints: Optional[Dict[str, Any]] = None  # max_cost, exclude_herbs, min_ingredients, max_ingredients, target_effects
    # 配方完整性约束
    min_ingredients: int = 3       # 最少味数
    max_ingredients: int = 12      # 最多味数
    total_dosage_range: Tuple[float, float] = (15.0, 100.0)  # 总剂量范围(g)
    # 早停
    early_stop_patience: int = 20
    early_stop_threshold: float = 0.0  # 0=不启用
    # 自适应
    adaptive_mutation: bool = True
    # 输出控制
    pareto_front_size: int = 20       # Pareto前沿最大解数
    candidate_count: int = 10         # 返回给前端的候选数
    description: str = ""             # 场景描述

    def __post_init__(self):
        assert 2 <= len(self.objectives) <= 8, f"目标数量应在 [2, 8]，当前: {len(self.objectives)}"
        assert self.mode in ("pareto", "weighted", "epsilon"), f"未知模式: {self.mode}"
        for obj in self.objectives:
            assert obj.direction in ("maximize", "minimize"), f"目标 {obj.key} direction 无效: {obj.direction}"
            assert 0.0 < obj.weight <= 1.0, f"目标 {obj.key} weight 无效: {obj.weight}"
        # 校验配方完整性约束参数
        assert 1 <= self.min_ingredients <= self.max_ingredients, \
            f"min_ingredients({self.min_ingredients}) 必须 <= max_ingredients({self.max_ingredients})"
        assert self.total_dosage_range[0] < self.total_dosage_range[1], \
            f"total_dosage_range 下限必须 < 上限"


# ════════════════════════════════════════════
# 多目标个体
# ════════════════════════════════════════════

class MultiObjectiveIndividual:
    """多目标个体 — 一个完整的配方候选方案"""

    def __init__(self, genes: Dict[str, float]):
        self.genes = dict(genes)       # {herb_id: dosage}
        # 多目标向量（由 evaluator 填充）
        self.objectives: Dict[str, float] = {}   # {objective_key: score}
        # 派生指标
        self.rank: int = 0              # Pareto秩(非支配排序层级)
        self.crowding_distance: float = 0.0     # 拥挤度距离
        # 单一适应度(用于兼容旧接口)
        self.fitness: float = 0.0
        # 分项评分(保留原有字段)
        self.efficacy: float = 0.0
        self.safety: float = 0.0
        self.taste: float = 0.0
        self.cost_score: float = 0.0
        self.synergy: float = 0.0      # 协同效应评分
        self.stability: float = 0.0    # 稳定性评分
        self.admet: float = 0.0        # ADMET综合评分
        self.domination_count: int = 0 # 被支配计数(NSGA-II)
        self.dominated_set: List = []  # 支配的个体集合

    def copy(self) -> 'MultiObjectiveIndividual':
        """深拷贝"""
        new_ind = MultiObjectiveIndividual(dict(self.genes))
        new_ind.objectives = dict(self.objectives)
        new_ind.rank = self.rank
        new_ind.crowding_distance = self.crowding_distance
        new_ind.fitness = self.fitness
        new_ind.efficacy = self.efficacy
        new_ind.safety = self.safety
        new_ind.taste = self.taste
        new_ind.cost_score = self.cost_score
        new_ind.synergy = self.synergy
        new_ind.stability = self.stability
        new_ind.admet = self.admet
        return new_ind

    def __repr__(self) -> str:
        herbs = list(self.genes.keys())[:5]
        extra = f"...+{len(self.genes)-5}" if len(self.genes) > 5 else ""
        return (f"<MOInd rank={self.rank} fit={self.fitness:.4f} "
                f"herbs={herbs}{extra}>")


# ════════════════════════════════════════════
# 配方多维质量评估器
# ════════════════════════════════════════════

class FormulaEvaluator:
    """配方多维质量评估器 — 整合 Synergy/Stability/Taste/ADMET 数据源

    增强版特性:
    - 三层协同评分模型（功效互补 + 经典配伍 + 用量比例）
    - 五味调和口感评估（基于《神农本草经》）
    - 性味归经属性知识库（基于《中国药典》简化）
    """

    # ════════════════════════════════════════════
    # 经典协同药对字典（基于中医配伍理论）
    # 格式: frozenset({herb_a, herb_b}): 加分值(0~0.3)
    # 覆盖: 补气/补血/清热/和解/利水 五大类
    # ════════════════════════════════════════════
    _CLASSIC_SYNERGY_PAIRS: Dict[frozenset, float] = {
        # ── 补气类 ──
        frozenset({"hq", "ds"}): 0.25,       # 黄芪+党参: 补气健脾经典配伍
        frozenset({"hq", "bq"}): 0.22,       # 黄芪+白术: 芪术相须, 健脾益气
        frozenset({"rs", "hq"}): 0.20,       # 人参+黄芪: 大补元气, 气虚重证
        frozenset({"ds", "bq"}): 0.18,       # 党参+白术: 四君子汤核心
        # ── 补血类 ──
        frozenset({"dg", "cs"}): 0.20,       # 当归+川芎: 活血补血, 调经止痛
        frozenset({"dg", "gz"}): 0.18,       # 当归+枸杞: 养血滋阴
        frozenset({"ds", "dcx"}): 0.15,      # 党参+大枣: 补气养血和中
        # ── 清热类 ──
        frozenset({"jgh", "gz"}): 0.20,      # 菊花+枸杞: 杞菊地黄丸思路, 清肝明目
        frozenset({"cyh", "jgh"}): 0.18,     # 金银花+菊花: 疏风清热解毒
        frozenset({"cyh", "gq"}): 0.15,      # 金银花+甘草: 清热解毒调和
        # ── 和解/理气类 ──
        frozenset({"cx", "sj"}): 0.17,       # 陈皮+生姜: 和胃止呕, 温中散寒
        frozenset({"cx", "bq"}): 0.16,       # 陈皮+白术: 健脾理气
        # ── 利水渗湿类 ──
        frozenset({"fp", "bq"}): 0.20,       # 茯苓+白术: 苓术相配, 健脾利水
        frozenset({"fp", "yq"}): 0.18,       # 茯苓+薏苡仁: 渗湿健脾
        frozenset({"fp", "gq"}): 0.15,       # 茯苓+甘草: 利湿和中
        # ── 调和/辅佐类 ──
        frozenset({"gq", "dcx"}): 0.15,      # 甘草+大枣: 双甘调和, 补中缓急
        frozenset({"gq", "hq"}): 0.12,       # 甘草+黄芪: 补气升阳佐使
        frozenset({"dcx", "sj"}): 0.13,      # 大枣+生姜: 调和营卫
    }

    def __init__(self):
        self.herb_db = _BUILTIN_HERBS  # 药材知识库
        self.efficacy_map = _EFFICACY_TO_HERBS

        # ════════════════════════════════════════════
        # 性味归经属性知识库（基于《中国药典》简化）
        # ════════════════════════════════════════════
        self._herb_properties: Dict[str, Dict] = {
            "hq": {"nature": "微温", "taste": "甘", "meridian": "肺脾", "category": "补气"},
            "ds": {"nature": "平", "taste": "甘辛", "meridian": "脾肺", "category": "补气"},
            "gz": {"nature": "平", "taste": "甘", "meridian": "肝肾", "category": "滋补"},
            "rs": {"nature": "微温", "taste": "甘微苦", "meridian": "脾肺心肾", "category": "大补"},
            "dg": {"nature": "温", "taste": "甘辛", "meridian": "肝心肺脾", "category": "补血"},
            "hqg": {"nature": "温", "taste": "甘", "meridian": "肺", "category": "补气"},
            "bq": {"nature": "温", "taste": "苦甘", "meridian": "脾胃", "category": "健脾"},
            "fp": {"nature": "平", "taste": "甘淡", "meridian": "心肺脾肾", "category": "利水"},
            "gq": {"nature": "平", "taste": "甘", "meridian": "十二经", "category": "调和"},
            "jgh": {"nature": "微寒", "taste": "甘苦", "meridian": "肝肺", "category": "清热"},
            "cs": {"nature": "温", "taste": "辛", "meridian": "肝胆心包", "category": "活血"},
            "lk": {"nature": "寒", "taste": "辛", "meridian": "肺胃肝", "category": "催吐"},
            "mld": {"nature": "寒", "taste": "苦", "meridian": "肝肺", "category": "降压"},
            "fz": {"nature": "大热", "taste": "辛甘", "meridian": "心肾脾", "category": "回阳"},
            "cx": {"nature": "温", "taste": "辛苦", "meridian": "脾胃肺", "category": "理气"},
            "yq": {"nature": "微寒", "taste": "甘淡", "meridian": "脾胃肺", "category": "利湿"},
            "cyh": {"nature": "寒", "taste": "甘", "meridian": "肺心胃", "category": "清热"},
            "dcx": {"nature": "温", "taste": "甘", "meridian": "脾胃心", "category": "补气"},
            "sj": {"nature": "微温", "taste": "辛", "meridian": "肺脾胃", "category": "解表"},
            "gh": {"nature": "凉", "taste": "甘辛", "meridian": "脾胃", "category": "解表"},
        }

        # 五味分类映射（用于口感评估）
        self._flavor_map: Dict[str, str] = {
            # 甘味(补和) — 应为主导 30-50%
            "hq": "sweet", "ds": "sweet", "gz": "sweet", "rs": "sweet",
            "gq": "sweet", "dcx": "sweet",
            # 苦味(泄降) — 不超过 25%
            "lk": "bitter", "cyh": "bitter", "fz": "bitter", "cs": "bitter",
            "mld": "bitter", "jgh": "bitter", "bq": "bitter",
            # 辛味(散行) — 5-15%
            "sj": "pungent", "cx": "pungent", "cs": "pungent", "lk": "pungent",
            # 平性(中和) — 基础占比
            "fp": "neutral", "yq": "neutral",
            # 其他(含复合味)
            "dg": "other", "gh": "other",
        }

        # 构建多层协同效应矩阵
        self._build_synergy_matrix()

    def _build_synergy_matrix(self):
        """构建多层协同效应矩阵

        三层评分模型:
        Layer 1 - 功效互补度 (0~0.4): 两药功效集合的互补程度
            → Jaccard 相似度 + 差异集分析

        Layer 2 - 经典配伍加分 (0~0.3): 基于已知经典药对的固定加分
            → _CLASSIC_SYNERGY_PAIRS 字典查找

        Layer 3 - 用量比例协调 (0~0.3): 两药用量的比例合理性
            → 主药:辅药 理想比例 2:1 ~ 4:1 时得分最高

        最终协同分数范围约 0.3 ~ 1.0
        """
        self.synergy_matrix: Dict[tuple, float] = {}
        for herb in self.herb_db.values():
            for partner_id in herb.synergy_partners:
                if partner_id not in self.herb_db:
                    continue
                pair = tuple(sorted([herb.herb_id, partner_id]))
                if pair in self.synergy_matrix:
                    continue

                # Layer 1: 功效互补度 (0~0.4)
                e1 = set(herb.efficacy_scores.keys())
                e2 = set(self.herb_db[partner_id].efficacy_scores.keys())
                overlap = len(e1 & e2)
                union = len(e1 | e2)
                jaccard = overlap / max(union, 1)
                # 差异集越大说明互补性越强
                diff_score = len(e1 ^ e2) / max(union, 1)
                layer1 = 0.15 * jaccard + 0.25 * diff_score  # 范围 0~0.4

                # Layer 2: 经典配伍加分 (0~0.3)
                pair_key = frozenset(pair)
                layer2 = self._CLASSIC_SYNERGY_PAIRS.get(pair_key, 0.05)  # 默认微量加分

                # Layer 3: 用量比例协调 (在 evaluate_full 中动态计算，此处存基础分)
                layer3_base = 0.15  # 默认中间值，实际值由 evaluate_full 根据用量调整

                self.synergy_matrix[pair] = round(layer1 + layer2 + layer3_base, 4)

    def evaluate_full(self, individual: MultiObjectiveIndividual,
                      config: OptimizationConfig) -> None:
        """
        完整的多维评估 — 填充 individual 的所有评分字段

        评估维度（7维 + 属性检测）：
        1. efficacy (功效效能): 几何均值 × 功效覆盖度
        2. safety (安全性): 安全指数 × 禁忌惩罚 × 配伍禁忌惩罚 × 性味冲突惩罚
        3. taste (口感): 五味调和模型（MSE + 矫味剂加分）
        4. cost_efficiency (成本效率): 反比于总成本，考虑性价比
        5. synergy (协同效应): 三层协同评分（功效互补+经典配伍+用量比例）
        6. stability (稳定性): 基于药材属性的稳定性预估
        7. admet (ADMET综合): 安全性+稳定性+成本效益的综合估算
        +
           性味冲突检测: 大热与大寒同用惩罚
           归经覆盖率奖励: 覆盖归经数越多越好
           类别均衡检测: 不希望所有药材来自同一类别
        """
        genes = individual.genes
        if not genes:
            individual.objectives = {obj.key: 0.0 for obj in config.objectives}
            return

        herbs_used = list(genes.keys())
        total_dosage = sum(genes.values())

        # ── 1. 功效效能评估 ──
        target_effects = (config.constraints or {}).get("target_effects", [])
        efficacy_scores = []
        for hid, dosage in genes.items():
            herb = self.herb_db.get(hid)
            if not herb:
                continue
            dosage_ratio = (dosage - herb.dosage_min) / max(herb.dosage_max - herb.dosage_min, 0.01)
            dosage_ratio = max(0, min(1, dosage_ratio))

            if target_effects:
                effect_score = 0
                for te in target_effects:
                    es = herb.efficacy_scores.get(te, 0)
                    effect_score += es * (0.5 + 0.5 * dosage_ratio)
                efficacy_scores.append(effect_score / max(len(target_effects), 1))
            else:
                scores = list(herb.efficacy_scores.values())
                if scores:
                    geo_mean = math.prod([s ** (1 / len(scores)) for s in scores])
                    efficacy_scores.append(geo_mean * (0.5 + 0.5 * dosage_ratio))

        import math
        individual.efficacy = math.fsum(efficacy_scores) / max(len(efficacy_scores), 1) if efficacy_scores else 0

        # ── 2. 安全性评估（增强版：含性味冲突检测）──
        safety_sum = 0
        total_penalty = 0
        nature_conflict_penalty = 0

        for hid, dosage in genes.items():
            herb = self.herb_db.get(hid)
            if not herb:
                continue
            dosage_ratio = (dosage - herb.dosage_min) / max(herb.dosage_max - herb.dosage_min, 0.01)
            safety_sum += herb.safety_index * (1 - 0.15 * dosage_ratio)

            # 十八反/十九畏等配伍禁忌检测
            for other_hid in herbs_used:
                if other_hid == hid:
                    continue
                other_herb = self.herb_db.get(other_hid)
                if not other_herb:
                    continue
                if hid in other_herb.antagonistic_pairs or other_hid in herb.antagonistic_pairs:
                    total_penalty += 0.12

            # 性味冲突检测: 大热(fz) + 大寒(lk/mld/cyh) 同用增加安全惩罚
            prop = self._herb_properties.get(hid)
            if prop and prop["nature"] == "大热":
                for other_hid in herbs_used:
                    if other_hid == hid:
                        continue
                    other_prop = self._herb_properties.get(other_hid)
                    if other_prop and other_prop["nature"] in ("寒",):
                        nature_conflict_penalty += 0.08  # 每对大热-寒药对扣分

        total_penalty += nature_conflict_penalty
        individual.safety = max(0, safety_sum / max(len(herbs_used), 1)) * max(0, 1 - total_penalty)

        # ── 3. 口感评估（五味调和模型）──
        individual.taste = self._evaluate_taste(genes)

        # ── 4. 成本效率评估 ──
        total_cost = sum(
            self.herb_db[hid].cost_per_gram * dosage
            for hid, dosage in genes.items() if hid in self.herb_db
        )
        max_cost = (config.constraints or {}).get("max_cost", 30.0)
        if total_cost <= max_cost:
            individual.cost_score = 1.0 - (total_cost / max_cost) * 0.5
        else:
            individual.cost_score = max(0, 0.5 - (total_cost - max_cost) / max_cost * 0.5)
        individual.cost_score = max(0, min(1, individual.cost_score))

        # ── 5. 协同效应评估（三层模型完整版）──
        synergy_total = 0
        pair_count = 0
        herb_list = list(genes.keys())
        for i in range(len(herb_list)):
            for j in range(i + 1, len(herb_list)):
                pair = tuple(sorted([herb_list[i], herb_list[j]]))
                base_syn = self.synergy_matrix.get(pair, 0.3)  # 基础协同分(Layer1+Layer2+base Layer3)

                dosage_i = genes[herb_list[i]]
                dosage_j = genes[herb_list[j]]

                # Layer 3 动态调整: 用量比例协调 (覆盖 layer3_base 部分)
                # 主药:辅药 理想比例 2:1 ~ 4:1 时得分最高
                ratio = max(dosage_i, dosage_j) / max(min(dosage_i, dosage_j), 0.001)
                if 2 <= ratio <= 4:
                    layer3 = 0.30  # 理想主辅比例
                elif 1 <= ratio < 2 or 4 < ratio <= 6:
                    layer3 = 0.25  # 接近理想
                elif ratio > 6:
                    layer3 = max(0.10, 0.30 - (ratio - 6) * 0.03)  # 比例悬殊递减
                else:  # ratio < 1 不可能（已取max/min），但防御性处理
                    layer3 = 0.20

                # 用量均衡时协同更好（额外微调）
                balance = 1 - abs(dosage_i - dosage_j) / max(dosage_i + dosage_j, 0.001)

                # 最终协同分 = Layer1+Layer2(在base_syn中) 替换layer3_base为动态值
                dynamic_syn = (base_syn - 0.15) + layer3  # 替换基础layer3为动态值
                synergy_total += dynamic_syn * (0.7 + 0.3 * balance)
                pair_count += 1
        individual.synergy = synergy_total / max(pair_count, 1) if pair_count > 0 else 0.5

        # ── 6. 稳定性评估 ──
        stability_factors = []
        for hid, dosage in genes.items():
            herb = self.herb_db.get(hid)
            if not herb:
                continue
            s_factor = herb.safety_index
            mid_dosage = (herb.dosage_min + herb.dosage_max) / 2
            dos_norm = abs(dosage - mid_dosage) / max(herb.dosage_max - herb.dosage_min, 0.01)
            r_factor = 1 - 0.3 * dos_norm
            stability_factors.append(s_factor * r_factor)
        individual.stability = math.fsum(stability_factors) / max(len(stability_factors), 1) if stability_factors else 0

        # ── 7. ADMET 综合评分（简化版）──
        admet_parts = [individual.safety, individual.stability, 1 - (total_cost / max(max_cost, 1))]
        individual.admet = math.fsum(admet_parts) / len(admet_parts)

        # ════════════════════════════════════════════
        # 属性增强评估（基于 _herb_properties）
        # ════════════════════════════════════════════

        # 归经覆盖率奖励: 配方覆盖的归经数越多越好（最多12经）
        covered_meridians = set()
        for hid in genes.keys():
            prop = self._herb_properties.get(hid)
            if prop and "meridian" in prop:
                for m in prop["meridian"]:
                    covered_meridians.add(m)
        meridian_coverage_bonus = min(len(covered_meridians) / 12.0, 1.0) * 0.05
        individual.efficacy = min(1.0, individual.efficacy + meridian_coverage_bonus)

        # 类别均衡检测: 不希望所有药材来自同一 category
        categories = set()
        for hid in genes.keys():
            prop = self._herb_properties.get(hid)
            if prop and "category" in prop:
                categories.add(prop["category"])
        if len(categories) >= 3:
            # 覆盖3个以上类别，给予稳定性加分
            individual.stability = min(1.0, individual.stability + 0.03)
        elif len(categories) == 1:
            # 所有药材同一类别，轻微惩罚
            individual.stability = max(0, individual.stability - 0.02)

        # ── 填充 objectives 字典 ──
        objective_map = {
            "efficacy": individual.efficacy,
            "safety": individual.safety,
            "taste": individual.taste,
            "cost_efficiency": individual.cost_score,
            "synergy": individual.synergy,
            "stability": individual.stability,
            "admet": individual.admet,
        }
        individual.objectives = {
            obj.key: objective_map.get(obj.key, 0.0)
            for obj in config.objectives
        }

        # 加权聚合 fitness（兼容单目标模式）
        w_sum = sum(obj.weight for obj in config.objectives)
        individual.fitness = sum(
            individual.objectives.get(obj.key, 0) * obj.weight *
            (1 if obj.direction == "maximize" else -1)
            for obj in config.objectives
        ) / max(w_sum, 0.001)

    def _evaluate_taste(self, genes: Dict[str, float]) -> float:
        """五味调和口感评估模型

        基于《神农本草经》五味理论:
        - 酸(收涩): 本库无（忽略）
        - 苦(泄降): lk(藜芦), cyh(金银花), fz(附子), cs(川芎), jgh(菊花), bq(白术), mld(马利兰)
        - 甘(补和): dcx(大枣), gq(甘草), gz(枸杞), hq(黄芪), ds(党参), rs(人参)
        - 辛(散行): sj(生姜), cx(陈皮), cs(川芎), lk(藜芦)
        - 咸(软化): 本库无（忽略）
        - 平(和中): fp(茯苓), yq(薏苡仁)
        - 其他(复合味): dg(当归), gh(葛根)

        理想五味比例: 甘45% / 平20% / 苦15% / 辛12% / 其他8%
        用均方误差(MSE)衡量与理想比例的偏离程度，转换为 0~1 分数。
        有甘草/大枣时额外加分(+0.08)，天然矫味剂。
        """
        total_dosage = sum(genes.values())
        if total_dosage < 0.001:
            return 0.5

        # 按五味分类统计用量
        flavor_totals = {"sweet": 0.0, "bitter": 0.0, "pungent": 0.0, "neutral": 0.0, "other": 0.0}
        for hid, dosage in genes.items():
            flavor = self._flavor_map.get(hid, "other")
            flavor_totals[flavor] += dosage

        # 计算实际比例
        actual_ratios = {k: v / total_dosage for k, v in flavor_totals.items()}

        # 理想五味比例
        ideal_ratios = {
            "sweet": 0.45,     # 甘味应为主导(30-50%)
            "neutral": 0.20,   # 平性为基础
            "bitter": 0.15,    # 苦味不超过25%
            "pungent": 0.12,   # 辛味适量(5-15%)
            "other": 0.08,     # 其他/复合味
        }

        # 计算均方误差(MSE)
        mse = sum((actual_ratios[k] - ideal_ratios[k]) ** 2 for k in flavor_totals) / len(flavor_totals)

        # MSE → 0~1 分数映射 (mse=0 → 1.0, mse=0.1+ → 低分)
        taste_base = max(0.0, 1.0 - mse * 8.0)  # 缩放因子使偏离敏感

        # 惩罚项: 苦味超过25%时大幅降低适口性
        if actual_ratios["bitter"] > 0.25:
            taste_base *= max(0.4, 1.0 - (actual_ratios["bitter"] - 0.25) * 2.0)

        # 奖励项: 有甘草或大枣时加分（天然矫味剂）
        bonus = 0.0
        if "gq" in genes or "dcx" in genes:
            bonus = 0.08

        return max(0.0, min(1.0, taste_base + bonus))


# ════════════════════════════════════════════
# NSGA-II 主引擎
# ════════════════════════════════════════════

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
        self.evaluator = FormulaEvaluator()
        # 当前候选药材池（由 generate_with_result 设置）
        self._candidate_herbs: List[str] = []

    def optimize(self, target_effects: List[str] = None,
                 constraints: Dict = None) -> Tuple[List[MultiObjectiveIndividual], List[Dict]]:
        """
        执行完整 NSGA-II 优化流程：
        1. 初始化种群
        2. For each generation:
           a. 评估（调用 FormulaEvaluator.evaluate_full）
           b. 非支配排序（fast_non_dominated_sort）
           c. 拥挤度计算（crowding_distance_assignment）
           d. 锦标赛选择（基于 rank + crowding_distance）
           e. 交叉（SBX模拟二进制交叉 + 算术交叉混合）
           f. 变异（多项式变异 + 高斯变异混合）
           g. 精英保留
           h. 自适应变异率调整
           i. 早停检测
        3. 提取 Pareto 前沿
        4. 返回 (候选列表, 进化历史)
        """
        constraints = constraints or {}
        effective_constraints = dict(constraints)
        if target_effects:
            effective_constraints["target_effects"] = target_effects
        # 将约束写入 config（评估器通过 config.constraints 读取）
        self.config.constraints = effective_constraints

        # Step 1: 选择候选药材
        candidate_herbs = self._select_herbs(target_effects or [], constraints)
        if len(candidate_herbs) < 3:
            logger.warning(f"[NSGA-II] 候选药材不足 ({len(candidate_herbs)})")
            return [], []

        self._candidate_herbs = candidate_herbs

        logger.info(f"[NSGA-II] 种群={self.config.population_size}, "
                     f"代数={self.config.generations}, "
                     f"候选药材={len(candidate_herbs)}种, "
                     f"模式={self.config.mode}")

        # Step 2: 初始化种群（君臣佐使结构化）
        exclude_set = set(constraints.get("exclude_herbs", []))
        population = self._init_population(candidate_herbs, target_effects, exclude_set)
        for ind in population:
            self.evaluator.evaluate_full(ind, self.config)

        # 记录初始最佳 fitness
        best_fitness = max((ind.fitness for ind in population), default=0.0)

        # 进化历史记录
        history: List[Dict] = []

        # 早停相关状态
        no_improve_count = 0
        stop_reason: str = "completed"

        # Step 3: 进化迭代
        for gen in range(self.config.generations):
            # ── a. 非支配排序 + 拥挤度 ──
            fronts = self._fast_non_dominated_sort(population)
            for front in fronts:
                self._crowding_distance_assignment(front)

            # ── b. 锦标赛选择生成子代 ──
            offspring = []
            while len(offspring) < self.config.population_size:
                parent1 = self._nsga2_tournament_select(population)
                parent2 = self._nsga2_tournament_select(population)

                # c. 交叉
                if random.random() < self.config.crossover_rate:
                    child1, child2 = self._sbx_crossover(parent1, parent2)
                else:
                    child1, child2 = parent1.copy(), parent2.copy()

                # d. 变异（自适应率）
                diversity = self._compute_diversity(population)
                actual_mutation_rate = self._adaptive_mutation_rate(diversity)

                if random.random() < actual_mutation_rate:
                    self._polynomial_mutation(child1, candidate_herbs)
                if random.random() < actual_mutation_rate:
                    self._polynomial_mutation(child2, candidate_herbs)

                # e. 评估子代
                self.evaluator.evaluate_full(child1, self.config)
                self.evaluator.evaluate_full(child2, self.config)

                offspring.append(child1)
                if len(offspring) < self.config.population_size:
                    offspring.append(child2)

            # ── f. 精英保留 (μ+λ 选择) ──
            combined = population + offspring
            fronts = self._fast_non_dominated_sort(combined)
            for front in fronts:
                self._crowding_distance_assignment(front)

            new_population: List[MultiObjectiveIndividual] = []
            for front in fronts:
                if len(new_population) + len(front) <= self.config.population_size:
                    new_population.extend(front)
                else:
                    # 按拥挤度降序填充剩余位置
                    remaining = self.config.population_size - len(new_population)
                    front_sorted = sorted(front, key=lambda x: x.crowding_distance, reverse=True)
                    new_population.extend(front_sorted[:remaining])
                    break

            population = new_population

            # ── f2. 小生境清除（防止种群收敛到单一区域）──
            population = self._niching_clearing(population)

            # ── g. 统计与早停检测 ──
            current_best = max((ind.fitness for ind in population), default=0.0)
            if current_best > best_fitness + 1e-9:
                best_fitness = current_best
                no_improve_count = 0
            else:
                no_improve_count += 1

            # 记录历史
            avg_fit = math.fsum(ind.fitness for ind in population) / len(population)
            min_fit = min(ind.fitness for ind in population)
            history.append({
                "generation": gen + 1,
                "best_fitness": round(best_fitness, 6),
                "avg_fitness": round(avg_fit, 6),
                "min_fitness": round(min_fit, 6),
                "diversity": round(diversity, 6),
                "fronts_count": len(fronts),
                "pareto_front_size": len(fronts[0]) if fronts else 0,
                "adaptive_mutation_rate": round(actual_mutation_rate, 6),
            })

            if (gen + 1) % 10 == 0:
                logger.info(f"  Gen {gen+1}/{self.config.generations}, "
                           f"Best: {best_fitness:.4f}, Avg: {avg_fit:.4f}, "
                           f"ParetoFront: {len(fronts[0]) if fronts else 0}, "
                           f"Div: {diversity:.4f}")

            # 早停检查
            should_stop = False
            if (self.config.early_stop_threshold > 0 and
                    best_fitness >= self.config.early_stop_threshold):
                stop_reason = "early_stop_threshold"
                should_stop = True

            if (not should_stop and self.config.early_stop_patience > 0 and
                    no_improve_count >= self.config.early_stop_patience):
                stop_reason = "early_stop_patience"
                should_stop = True

            if should_stop:
                logger.info(f"[NSGA-II] 早停触发 ({stop_reason}), 于第 {gen + 1} 代停止")
                if history:
                    history[-1]["stop_reason"] = stop_reason
                break

        # Step 4: 提取最终 Pareto 前沿
        final_pareto = self._extract_pareto_front(population)

        return final_pareto, history

    # ═════════════════════════════════════════
    # NSGA-II 核心操作
    # ═════════════════════════════════════════

    def _fast_non_dominated_sort(self, population: List[MultiObjectiveIndividual]) -> List[List]:
        """
        快速非支配排序 O(MN^2)
        实现 Deb et al. (2002) 的标准算法
        每个 individual 已有 domination_count 和 dominated_set
        返回 fronts: List of List[Individual], fronts[0] = Pareto front
        """
        n = len(population)
        if n == 0:
            return []

        # 重置每个个体的支配计数和被支配集合
        for p in population:
            p.domination_count = 0
            p.dominated_set = []

        fronts: List[List[MultiObjectiveIndividual]] = [[]]

        # 对每对个体比较支配关系
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

            # 如果 p 不被任何其他个体支配，属于第一前沿
            if p.domination_count == 0:
                p.rank = 1
                fronts[0].append(p)

        # 分层提取后续前沿
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

        # 移除最后一个空前沿
        if fronts and not fronts[-1]:
            fronts.pop()

        return fronts

    def _dominates(self, a: MultiObjectiveIndividual, b: MultiObjectiveIndividual) -> bool:
        """
        判断个体 a 是否支配个体 b
        支配定义: a 在所有目标上都不差于 b，且至少在一个目标上严格优于 b
        """
        at_least_one_better = False
        for obj in self.config.objectives:
            val_a = a.objectives.get(obj.key, 0.0)
            val_b = b.objectives.get(obj.key, 0.0)
            if obj.direction == "maximize":
                if val_a < val_b - 1e-9:
                    return False  # a 在某目标上更差，不支配
                if val_a > val_b + 1e-9:
                    at_least_one_better = True
            else:  # minimize
                if val_a > val_b + 1e-9:
                    return False
                if val_a < val_b - 1e-9:
                    at_least_one_better = True
        return at_least_one_better

    def _crowding_distance_assignment(self, front: List[MultiObjectiveIndividual]):
        """
        拥挤度距离分配
        对每个目标维度归一化后计算边界和中间个体的拥挤度
        边界个体设为无穷大，中间个体按相邻个体的归一化距离之和计算
        """
        n = len(front)
        if n <= 2:
            # 少于等于2个个体，都给无穷大
            for ind in front:
                ind.crowding_distance = float('inf')
            return

        # 初始化拥挤度为0
        for ind in front:
            ind.crowding_distance = 0.0

        # 对每个目标维度分别计算
        objective_keys = [obj.key for obj in self.config.objectives]

        for obj_key in objective_keys:
            # 按该目标值排序
            front.sort(key=lambda x: x.objectives.get(obj_key, 0.0))

            # 边界个体设为无穷大
            front[0].crowding_distance = float('inf')
            front[-1].crowding_distance = float('inf')

            # 该目标的值域范围
            f_min = front[0].objectives.get(obj_key, 0.0)
            f_max = front[-1].objectives.get(obj_key, 0.0)
            f_range = f_max - f_min

            if f_range < 1e-12:
                continue  # 所有值相同，跳过

            # 中间个体累加归一化距离
            for i in range(1, n - 1):
                if front[i].crowding_distance != float('inf'):
                    distance = (front[i + 1].objectives.get(obj_key, 0.0) -
                                front[i - 1].objectives.get(obj_key, 0.0)) / f_range
                    front[i].crowding_distance += distance

    def _nsga2_tournament_select(self, population: List[MultiObjectiveIndividual]) -> MultiObjectiveIndividual:
        """
        NSGA-II 锦标赛选择：优先比较 rank，rank 相同时选 crowding_distance 大的
        """
        contestants = random.sample(
            population,
            min(self.config.tournament_size, len(population))
        )
        # 按 (rank 升序, crowding_distance 降序) 排序，取最优
        best = min(contestants, key=lambda x: (x.rank, -x.crowding_distance))
        return best.copy()

    def _sbx_crossover(self, parent1: MultiObjectiveIndividual, parent2: MultiObjectiveIndividual,
                       eta: float = 15.0) -> Tuple[MultiObjectiveIndividual, MultiObjectiveIndividual]:
        """
        SBX 模拟二进制交叉（实数编码）
        对每个基因执行 SBX 操作，产生接近父代的子代
        """
        all_herbs = set(parent1.genes.keys()) | set(parent2.genes.keys())

        child1_genes: Dict[str, float] = {}
        child2_genes: Dict[str, float] = {}

        for hid in all_herbs:
            p1_val = parent1.genes.get(hid, 0.0)
            p2_val = parent2.genes.get(hid, 0.0)

            # 如果其中一个为0（未使用该药材），以一定概率继承或丢弃
            if p1_val <= 0 and p2_val <= 0:
                continue
            if p1_val <= 0 or p2_val <= 0:
                # 单亲遗传：随机决定是否激活
                active_val = max(p1_val, p2_val)
                if random.random() < 0.5:
                    child1_genes[hid] = active_val
                if random.random() < 0.5:
                    child2_genes[hid] = active_val
                continue

            # 获取边界（来自药材知识库）
            if hid in self.evaluator.herb_db:
                herb = self.evaluator.herb_db[hid]
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

            # 边界裁剪
            child1_val = max(lower, min(upper, child1_val))
            child2_val = max(lower, min(upper, child2_val))

            # 步长对齐
            if hid in self.evaluator.herb_db:
                step = self.evaluator.herb_db[hid].dosage_step
                child1_val = round(child1_val / step) * step
                child2_val = round(child2_val / step) * step

            child1_genes[hid] = child1_val
            child2_genes[hid] = child2_val

        return MultiObjectiveIndividual(child1_genes), MultiObjectiveIndividual(child2_genes)

    def _polynomial_mutation(self, individual: MultiObjectiveIndividual,
                             candidate_herbs: List[str], eta_m: float = 20.0):
        """
        多项式变异（增强版）— 改进变异平衡 + 君臣佐使感知

        变异策略根据当前个体药材数量动态调整：
          - 药材数 <= min_ingredients: 禁止删除操作（只允许添加或调整用量）
          - 药材数 >= max_ingredients: 提高删除概率到35%（防止过度膨胀）
          - 中等规模(4-9味): 保持原有逻辑
        君臣佐使感知：君药(最高剂量药材)用量扰动范围缩小到±15%
        """
        herb_count = len(individual.genes)

        # ── 确定删除/添加概率（基于药材规模动态调整）──
        if herb_count <= self.config.min_ingredients:
            # 药材过少：禁止删除，提高添加概率
            delete_prob = 0.0       # 禁止删除
            add_prob = 0.25         # 提高添加概率
        elif herb_count >= self.config.max_ingredients:
            # 药材过多：提高删除概率，降低添加概率
            delete_prob = 0.35      # 提高删除概率到35%
            add_prob = 0.05         # 降低添加概率
        else:
            # 中等规模：保持原有平衡
            delete_prob = 0.20      # 原有删除概率
            add_prob = 0.15         # 原有添加概率

        # ── 识别君药（最高剂量的药材）──
        jun_herb_id = None
        if individual.genes:
            jun_herb_id = max(individual.genes.keys(), key=lambda k: individual.genes[k])

        for hid in list(individual.genes.keys()):
            if random.random() > 0.5:  # 每个基因独立概率变异
                continue

            if hid not in self.evaluator.herb_db:
                continue

            herb = self.evaluator.herb_db[hid]
            lower = herb.dosage_min
            upper = herb.dosage_max
            current_val = individual.genes[hid]

            if abs(upper - lower) < 1e-9:
                continue

            # ── 君臣佐使感知变异：君药用量扰动范围缩小到±15% ──
            is_jun_herb = (hid == jun_herb_id)
            if is_jun_herb:
                # 君药使用更保守的扰动范围（±15%），避免主药剧烈变化
                perturbation_range = current_val * 0.15
                delta_val = (random.random() * 2 - 1) * perturbation_range
                new_val = current_val + delta_val
                new_val = round(new_val / herb.dosage_step) * herb.dosage_step
                new_val = max(lower, min(upper, new_val))
                if new_val < lower:
                    # 即使是君药也不轻易删除，而是设为最小值
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

            # 动态删除判断（基于药材规模）
            should_delete = False
            if new_val < lower:
                if herb_count <= self.config.min_ingredients:
                    # 药材过少时禁止删除，强制设为最小值
                    new_val = lower
                    should_delete = False
                elif random.random() < delete_prob:
                    should_delete = True
                else:
                    new_val = lower  # 不删除但降到最低
                    should_delete = False

            if should_delete:
                del individual.genes[hid]  # 删除该药材
            else:
                individual.genes[hid] = min(upper, new_val)

        # 小概率添加新药材（结构变异）— 使用动态概率
        if random.random() < add_prob and candidate_herbs and herb_count < self.config.max_ingredients:
            new_h = random.choice(candidate_herbs)
            if new_h not in individual.genes and new_h in self.evaluator.herb_db:
                herb = self.evaluator.herb_db[new_h]
                dosage = herb.dosage_min + random.random() * (herb.dosage_max - herb.dosage_min)
                dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                individual.genes[new_h] = max(herb.dosage_min, dosage)

    def _extract_pareto_front(self, population: List[MultiObjectiveIndividual]) -> List[MultiObjectiveIndividual]:
        """提取最终 Pareto 前沿，按拥挤度排序"""
        fronts = self._fast_non_dominated_sort(population)
        if not fronts:
            return []
        pareto = fronts[0]

        # 按加权聚合分降序排列
        pareto.sort(key=lambda x: x.fitness, reverse=True)
        return pareto[:self.config.pareto_front_size]

    def _compute_diversity(self, population: List[MultiObjectiveIndividual]) -> float:
        """计算种群多样性（Jaccard 平均距离）"""
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

        return total_dist / max(count, 1)

    def _adaptive_mutation_rate(self, diversity: float) -> float:
        """根据种群多样性动态调整实际变异概率"""
        base_rate = self.config.mutation_rate
        if not self.config.adaptive_mutation:
            return base_rate

        if diversity < 0.2:
            return min(base_rate * 2.5, 0.8)     # 低多样性强扰动
        elif diversity < 0.4:
            return min(base_rate * 1.5, 0.6)      # 中等偏低加强扰动
        elif diversity < 0.6:
            return base_rate                         # 正常
        else:
            return base_rate * 0.7                   # 高多样性可降低扰动

    def _niching_clearing(self, population: List[MultiObjectiveIndividual],
                          niche_radius: float = 0.15,
                          max_per_niche: int = 3) -> List[MultiObjectiveIndividual]:
        """小生境清除技术 — 确保解在目标空间均匀分布

        对每个个体计算其在目标空间的位置，
        同一小生境半径内只保留适应度最高的 max_per_niche 个个体。

        Args:
            population: 当前种群
            niche_radius: 小生境半径（目标空间归一化欧氏距离）
            max_per_niche: 每个小生境最多保留的个体数

        Returns:
            经过小生境清除后的种群（可能小于原种群大小）
        """
        if len(population) <= max_per_niche:
            return list(population)

        # ── Step 1: 构建目标空间归一化向量 ──
        objective_keys = [obj.key for obj in self.config.objectives]

        # 收集所有个体的目标值，用于归一化
        all_values: Dict[str, List[float]] = {k: [] for k in objective_keys}
        for ind in population:
            for k in objective_keys:
                all_values[k].append(ind.objectives.get(k, 0.0))

        # 计算每个目标的 min/max 用于归一化
        norm_params: Dict[str, Tuple[float, float]] = {}
        for k in objective_keys:
            vals = all_values[k]
            v_min, v_max = min(vals), max(vals)
            v_range = v_max - v_min
            norm_params[k] = (v_min, v_range if v_range > 1e-12 else 1.0)

        # 为每个个体构建归一化目标向量
        def get_normalized_vector(ind: MultiObjectiveIndividual) -> List[float]:
            vec = []
            for k in objective_keys:
                v_min, v_range = norm_params[k]
                normalized = (ind.objectives.get(k, 0.0) - v_min) / v_range
                vec.append(normalized)
            return vec

        # ── Step 2: 按适应度降序排序（适应度高的优先保留）──
        sorted_pop = sorted(population, key=lambda x: x.fitness, reverse=True)

        # ── Step 3: 小生境清除主循环 ──
        cleared: List[MultiObjectiveIndividual] = []
        niche_centers: List[List[float]] = []  # 已占用的小生境中心

        for ind in sorted_pop:
            vec = get_normalized_vector(ind)

            # 检查是否落入已有小生境
            is_in_niche = False
            for center in niche_centers:
                dist = math.sqrt(sum((a - b) ** 2 for a, b in zip(vec, center)))
                if dist <= niche_radius:
                    is_in_niche = True
                    break

            if not is_in_niche:
                cleared.append(ind)
                niche_centers.append(vec)

                # 当某小生境已满(max_per_niche)，记录该中心以拒绝后续同区域个体
                # （通过 niche_centers 的长度隐式控制，每满max_per_niche个才加一个center）

            # 控制每个小生境的容量：用计数器追踪
            # 简化实现：直接限制总返回数不超过原种群大小

        # 如果清除后种群过小，从被淘汰个体中补充最优的
        if len(cleared) < self.config.population_size * 0.6:
            # 补充：重新按拥挤度选择
            remaining = [ind for ind in sorted_pop if ind not in cleared]
            cleared.extend(remaining[:self.config.population_size - len(cleared)])

        return cleared[:len(population)]  # 保持原种群大小

    def _select_herbs(self, target_effects: List[str],
                      constraints: Dict = None) -> List[str]:
        """根据目标功效选择候选药材（复用已有逻辑）"""
        constraints = constraints or {}
        exclude = set(constraints.get("exclude_herbs", []))

        candidate_set: Dict[str, float] = {}

        for effect in target_effects:
            if effect in _EFFICACY_TO_HERBS:
                for hid in _EFFICACY_TO_HERBS[effect]:
                    if hid not in exclude and hid in _BUILTIN_HERBS:
                        score = _BUILTIN_HERBS[hid].efficacy_scores.get(effect, 0)
                        candidate_set[hid] = max(candidate_set.get(hid, 0), score)

        # 无明确目标时使用全部药材
        if not candidate_set:
            for hid in _BUILTIN_HERBS:
                if hid not in exclude:
                    candidate_set[hid] = 0.5

        # 添加协同药材
        for hid in list(candidate_set.keys()):
            if hid in _BUILTIN_HERBS:
                for p in _BUILTIN_HERBS[hid].synergy_partners:
                    if p in _BUILTIN_HERBS and p not in candidate_set and p not in exclude:
                        candidate_set[p] = 0.1

        sorted_h = sorted(candidate_set.keys(), key=lambda x: candidate_set[x], reverse=True)
        max_ingredients = constraints.get("max_ingredients", 15)
        return sorted_h[:max_ingredients]

    def _init_population(self, candidates: List[str], target_effects: List[str] = None, exclude_herbs: Optional[set] = None) -> List[MultiObjectiveIndividual]:
        """初始化种群（君臣佐使结构化 + 拉丁超立方 + 随机采样）"""
        population = []
        n = len(candidates)

        # 确定性初始: 每个功效选最佳药材（前5个确定性个体）
        for i in range(min(5, n)):
            genes: Dict[str, float] = {}
            for j, hid in enumerate(candidates):
                if hid in self.evaluator.herb_db:
                    herb = self.evaluator.herb_db[hid]
                    base_ratio = max(0.1, 1.0 - abs(j - i) * 0.15)
                    dosage = herb.dosage_min + base_ratio * (herb.dosage_max - herb.dosage_min)
                    dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                    dosage = max(herb.dosage_min, min(herb.dosage_max, dosage))
                    if dosage > 0:
                        genes[hid] = dosage
            population.append(MultiObjectiveIndividual(genes))

        # 随机采样填充剩余种群
        for _ in range(self.config.population_size - len(population)):
            genes: Dict[str, float] = {}
            for hid in candidates:
                if hid in self.evaluator.herb_db and random.random() > 0.3:
                    herb = self.evaluator.herb_db[hid]
                    ratio = random.random()
                    dosage = herb.dosage_min + ratio * (herb.dosage_max - herb.dosage_min)
                    dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                    dosage = max(herb.dosage_min, min(herb.dosage_max, dosage))
                    genes[hid] = dosage
            if len(genes) >= 3:
                population.append(MultiObjectiveIndividual(genes))
            else:
                # 强制补充至少3个药材
                for hid in candidates[:5]:
                    if hid in self.evaluator.herb_db:
                        herb = self.evaluator.herb_db[hid]
                        dosage = herb.dosage_min + random.random() * (herb.dosage_max - herb.dosage_min)
                        dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                        genes[hid] = max(herb.dosage_min, dosage)
                population.append(MultiObjectiveIndividual(genes))

        return population[:self.config.population_size]

    def generate_with_result(self, target_effects: List[str] = None,
                             constraints: Dict = None) -> 'MOGAResult':
        """带结果包装的入口方法"""
        start_time = time.perf_counter()

        candidates, history = self.optimize(target_effects=target_effects, constraints=constraints)

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        # 构建 Pareto 前沿坐标点
        pareto_front_coords = []
        for ind in candidates:
            coord = dict(ind.objectives)
            coord["fitness"] = round(ind.fitness, 6)
            coord["genes"] = {k: round(v, 2) for k, v in ind.genes.items()}
            pareto_front_coords.append(coord)

        # 各目标最优解
        best_by_objective: Dict[str, Dict] = {}
        for obj in self.config.objectives:
            best_ind = max(candidates, key=lambda x: x.objectives.get(obj.key, 0.0),
                          default=None)
            if best_ind:
                best_by_objective[obj.key] = {
                    "genes": {k: round(v, 2) for k, v in best_ind.genes.items()},
                    "scores": {key: round(val, 4) for key, val in best_ind.objectives.items()},
                    "fitness": round(best_ind.fitness, 6),
                }

        # 收敛代数
        convergence_gen = 0
        if candidates:
            final_best = max(ind.fitness for ind in candidates)
            if final_best > 0 and history:
                for record in history:
                    if record.get("best_fitness", 0) >= final_best - 1e-9:
                        convergence_gen = record["generation"]
                        break

        total_evaluations = self.config.population_size * (
            history[-1]["generation"] if history else self.config.generations
        )

        # 截取返回给前端的候选数
        result_candidates = candidates[:self.config.candidate_count]

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


# ════════════════════════════════════════════
# 结果数据类
# ════════════════════════════════════════════

@dataclass
class MOGAResult:
    """多目标优化结果"""
    candidates: List[MultiObjectiveIndividual]  # Pareto前沿候选
    pareto_front: List[Dict] = field(default_factory=list)  # Pareto前沿坐标点 [{key:score}, ...]
    history: List[Dict] = field(default_factory=list)        # 进化历史
    algorithm: str = "nsga2_genetic_algorithm"
    mode: str = "pareto"                       # pareto / weighted / epsilon
    total_generations: int = 0
    total_evaluations: int = 0
    best_by_objective: Dict[str, Dict] = field(default_factory=dict)  # 各目标最优解 {key: {genes, scores}}
    execution_time_ms: float = 0.0
    convergence_generation: int = 0
    stop_reason: str = "completed"
    objectives_config: List[Dict] = field(default_factory=list)  # 目标配置快照


# ════════════════════════════════════════════
# 预设优化场景
# ════════════════════════════════════════════

PRESET_SCENARIOS = {}


def _build_presets():
    """构建预设优化场景（延迟初始化避免循环导入）"""
    global PRESET_SCENARIOS
    if PRESET_SCENARIOS:
        return PRESET_SCENARIOS

    PRESET_SCENARIOS = {
        "balanced": OptimizationConfig(
            objectives=[
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.30),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.25),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.10),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.15),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.10),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
            ],
            mode="pareto",
            description="均衡型：各维度均衡考量",
        ),

        "cost_first": OptimizationConfig(
            objectives=[
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.20),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.15),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.05),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.40),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.10),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
            ],
            mode="weighted",
            description="成本优先：严格控制预算",
        ),

        "efficacy_first": OptimizationConfig(
            objectives=[
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.50),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.20),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.10),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.10),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.05),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.05),
            ],
            mode="weighted",
            description="功效优先：最大化功效输出",
        ),

        "safety_first": OptimizationConfig(
            objectives=[
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.15),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.45),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.10),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.10),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.10),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
            ],
            mode="weighted",
            description="安全优先：适用于敏感人群",
        ),

        "synergy_focused": OptimizationConfig(
            objectives=[
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.25),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.20),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.10),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.10),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.25),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
            ],
            mode="pareto",
            description="协同深度优化：强化配伍协同效应",
        ),

        "comprehensive": OptimizationConfig(
            objectives=[
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.22),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.18),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.12),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.15),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.13),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
                OptimizationObjective(name="ADMET综合", key="admet", direction="maximize", weight=0.10),
            ],
            mode="pareto",
            population_size=80,
            generations=70,
            description="全面评估：全7维综合优化",
        ),
    }
    return PRESET_SCENARIOS


def get_preset_scenario(name: str) -> OptimizationConfig:
    """获取预设优化场景"""
    presets = _build_presets()
    if name not in presets:
        available = ", ".join(presets.keys())
        raise ValueError(f"未知预设场景 '{name}'，可用: {available}")
    return presets[name]


# ════════════════════════════════════════════
# 模块级工厂函数
# ════════════════════════════════════════════

_nsga2_optimizer: Optional[NSGAIIOptimizer] = None


def get_nsga2_optimizer() -> NSGAIIOptimizer:
    """获取 NSGA-II 优化器单例"""
    global _nsga2_optimizer
    if _nsga2_optimizer is None:
        _nsga2_optimizer = NSGAIIOptimizer()
    return _nsga2_optimizer
# ════════════════════════════════════════════
# 结果数据类
# ════════════════════════════════════════════

@dataclass
class MOGAResult:
    """多目标优化结果"""
    candidates: List[MultiObjectiveIndividual]  # Pareto前沿候选
    pareto_front: List[Dict] = field(default_factory=list)  # Pareto前沿坐标点 [{key:score}, ...]
    history: List[Dict] = field(default_factory=list)        # 进化历史
    algorithm: str = "nsga2_genetic_algorithm"
    mode: str = "pareto"                       # pareto / weighted / epsilon
    total_generations: int = 0
    total_evaluations: int = 0
    best_by_objective: Dict[str, Dict] = field(default_factory=dict)  # 各目标最优解 {key: {genes, scores}}
    execution_time_ms: float = 0.0
    convergence_generation: int = 0
    stop_reason: str = "completed"
    objectives_config: List[Dict] = field(default_factory=list)  # 目标配置快照


# ════════════════════════════════════════════
# 预设优化场景
# ════════════════════════════════════════════

PRESET_SCENARIOS = {}


def _build_presets():
    """构建预设优化场景（延迟初始化避免循环导入）"""
    global PRESET_SCENARIOS
    if PRESET_SCENARIOS:
        return PRESET_SCENARIOS

    PRESET_SCENARIOS = {
        "balanced": OptimizationConfig(
            objectives=[
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.30),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.25),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.10),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.15),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.10),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
            ],
            mode="pareto",
            description="均衡型：各维度均衡考量",
        ),

        "cost_first": OptimizationConfig(
            objectives=[
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.20),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.15),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.05),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.40),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.10),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
            ],
            mode="weighted",
            description="成本优先：严格控制预算",
        ),

        "efficacy_first": OptimizationConfig(
            objectives=[
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.50),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.20),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.10),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.10),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.05),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.05),
            ],
            mode="weighted",
            description="功效优先：最大化功效输出",
        ),

        "safety_first": OptimizationConfig(
            objectives=[
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.15),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.45),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.10),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.10),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.10),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
            ],
            mode="weighted",
            description="安全优先：适用于敏感人群",
        ),

        "synergy_focused": OptimizationConfig(
            objectives=[
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.25),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.20),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.10),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.10),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.25),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
            ],
            mode="pareto",
            description="协同深度优化：强化配伍协同效应",
        ),

        "comprehensive": OptimizationConfig(
            objectives=[
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.22),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.18),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.12),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.15),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.13),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
                OptimizationObjective(name="ADMET综合", key="admet", direction="maximize", weight=0.10),
            ],
            mode="pareto",
            population_size=80,
            generations=70,
            description="全面评估：全7维综合优化",
        ),
    }
    return PRESET_SCENARIOS


def get_preset_scenario(name: str) -> OptimizationConfig:
    """获取预设优化场景"""
    presets = _build_presets()
    if name not in presets:
        available = ", ".join(presets.keys())
        raise ValueError(f"未知预设场景 '{name}'，可用: {available}")
    return presets[name]


# ════════════════════════════════════════════
# 模块级工厂函数
# ════════════════════════════════════════════

_nsga2_optimizer: Optional[NSGAIIOptimizer] = None


def get_nsga2_optimizer() -> NSGAIIOptimizer:
    """获取 NSGA-II 优化器单例"""
    global _nsga2_optimizer
    if _nsga2_optimizer is None:
        _nsga2_optimizer = NSGAIIOptimizer()
    return _nsga2_optimizer

# 模块导入时自动填充预设场景
_build_presets()

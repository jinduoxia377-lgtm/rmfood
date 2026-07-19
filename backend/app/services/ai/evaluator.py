"""
配方多维质量评估器 — FormulaEvaluator

整合 Synergy/Stability/Taste/ADMET 数据源，对 NSGA-II 生成的
配方候选方案进行 7 维评分：
1. 功效效能 (efficacy)
2. 安全性 (safety)
3. 口感 (taste)
4. 成本效率 (cost_efficiency)
5. 协同效应 (synergy)
6. 稳定性 (stability)
7. ADMET 综合评分 (admet)
"""
from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional

from .models import MultiObjectiveIndividual, OptimizationConfig

logger = logging.getLogger(__name__)


class FormulaEvaluator:
    """配方多维质量评估器"""

    # 经典协同药对字典
    _CLASSIC_SYNERGY_PAIRS: Dict[frozenset, float] = {
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

    def __init__(self, herb_knowledge=None):
        self._herb_knowledge = herb_knowledge
        self.herb_db: Dict[str, Any] = {}  # 由 _BUILTIN_HERBS 或 HerbKnowledgeService 注入
        self.efficacy_map: Dict[str, List[str]] = {}
        self._herb_properties: Dict[str, Dict] = {}
        self._flavor_map: Dict[str, str] = {}
        self.synergy_matrix: Dict[tuple, float] = {}
        self._populate_builtin()

    def _populate_builtin(self):
        """填充内置药材属性（四气五味/归经/五味分类）"""
        builtin = {
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
        self._herb_properties = builtin

        flavor_map = {
            "hq": "sweet", "ds": "sweet", "gz": "sweet", "rs": "sweet",
            "gq": "sweet", "dcx": "sweet",
            "lk": "bitter", "cyh": "bitter", "fz": "bitter", "cs": "bitter",
            "mld": "bitter", "jgh": "bitter", "bq": "bitter",
            "sj": "pungent", "cx": "pungent", "cs": "pungent", "lk": "pungent",
            "fp": "neutral", "yq": "neutral",
            "dg": "other", "gh": "other",
        }
        self._flavor_map = flavor_map

    async def _ensure_herbs_loaded(self):
        """优先从 HerbKnowledgeService 加载药材"""
        if self._herb_knowledge is None:
            return
        try:
            herbs = await self._herb_knowledge.load_herbs()
            if herbs:
                self.herb_db = dict(herbs)
                self.efficacy_map = self._herb_knowledge.get_efficacy_to_herbs()
                logger.info(f"[NSGA-II] 从 HerbKnowledgeService 加载 {len(self.herb_db)} 种药材")
                self._merge_builtin_properties()
                self._build_synergy_matrix()
            else:
                logger.warning("[NSGA-II] HerbKnowledgeService 返回空数据，回退内置字典")
        except Exception as e:
            logger.warning(f"[NSGA-II] HerbKnowledgeService 加载失败: {e}")

    def _load_herbs_sync(self) -> None:
        """同步加载 HerbKnowledgeService 数据"""
        if self._herb_knowledge is None:
            return
        try:
            herbs = self._herb_knowledge.get_herbs()
            if herbs:
                self.herb_db = dict(herbs)
                self.efficacy_map = self._herb_knowledge.get_efficacy_to_herbs()
                logger.info(f"[NSGA-II] 同步加载 HerbKnowledgeService: {len(self.herb_db)} 种药材")
                self._merge_builtin_properties()
                self._build_synergy_matrix()
        except Exception as e:
            logger.warning(f"[NSGA-II] 同步加载 HerbKnowledgeService 失败: {e}")

    def _merge_builtin_properties(self) -> None:
        """合并内置的四气五味/归经/五味分类数据"""
        try:
            from .bayesian_formula_optimizer import _BUILTIN_HERBS
            builtin_props = getattr(self, '_herb_properties', {})
            builtin_flavor = getattr(self, '_flavor_map', {})

            if not hasattr(self, '_herb_properties'):
                self._herb_properties = dict(builtin_props)
            if not hasattr(self, '_flavor_map'):
                self._flavor_map = dict(builtin_flavor)

            for hid in self.herb_db:
                bp = builtin_props.get(hid)
                if bp and hid not in self._herb_properties:
                    self._herb_properties[hid] = dict(bp)
                bf = builtin_flavor.get(hid)
                if bf and hid not in self._flavor_map:
                    self._flavor_map[hid] = bf
        except Exception as e:
            logger.warning(f"[NSGA-II] 合并内置属性数据失败: {e}")

    def _build_synergy_matrix(self):
        """构建多层协同效应矩阵（三层评分模型）"""
        self.synergy_matrix = {}
        for herb in self.herb_db.values():
            for partner_id in herb.synergy_partners:
                if partner_id not in self.herb_db:
                    continue
                pair = tuple(sorted([herb.herb_id, partner_id]))
                if pair in self.synergy_matrix:
                    continue

                # Layer 1: 功效互补度
                e1 = set(herb.efficacy_scores.keys())
                e2 = set(self.herb_db[partner_id].efficacy_scores.keys())
                overlap = len(e1 & e2)
                union = len(e1 | e2)
                jaccard = overlap / max(union, 1)
                diff_score = len(e1 ^ e2) / max(union, 1)
                layer1 = 0.15 * jaccard + 0.25 * diff_score

                # Layer 2: 经典配伍加分
                pair_key = frozenset(pair)
                layer2 = self._CLASSIC_SYNERGY_PAIRS.get(pair_key, 0.05)

                # Layer 3: 用量比例协调（基础值）
                layer3_base = 0.15

                self.synergy_matrix[pair] = round(layer1 + layer2 + layer3_base, 4)

    def evaluate_full(self, individual: MultiObjectiveIndividual,
                      config: OptimizationConfig) -> None:
        """完整的多维评估 — 填充 individual 的所有评分字段"""
        genes = individual.genes
        if not genes:
            individual.objectives = {obj.key: 0.0 for obj in config.objectives}
            return

        herbs_used = list(genes.keys())
        total_dosage = sum(genes.values())

        # ── 院士级修复[P1]: 强制执行 total_dosage_range 约束 ──
        dosage_range = getattr(config, 'total_dosage_range', (15.0, 100.0))
        dosage_min_total, dosage_max_total = dosage_range
        if total_dosage < dosage_min_total or total_dosage > dosage_max_total:
            scale = 1.0
            if total_dosage < dosage_min_total:
                scale = dosage_min_total / max(total_dosage, 0.001)
            elif total_dosage > dosage_max_total:
                scale = dosage_max_total / total_dosage
            for hid in list(genes.keys()):
                herb = self.herb_db.get(hid)
                if herb:
                    new_val = round(genes[hid] * scale / herb.dosage_step) * herb.dosage_step
                    new_val = max(herb.dosage_min, min(herb.dosage_max, new_val))
                    genes[hid] = new_val
                else:
                    genes[hid] = genes[hid] * scale

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

        individual.efficacy = (
            math.fsum(efficacy_scores) / max(len(efficacy_scores), 1)
            if efficacy_scores else 0
        )

        # ── 2. 安全性评估 ──
        safety_sum = 0
        total_penalty = 0
        nature_conflict_penalty = 0

        for hid, dosage in genes.items():
            herb = self.herb_db.get(hid)
            if not herb:
                continue
            dosage_ratio = (dosage - herb.dosage_min) / max(herb.dosage_max - herb.dosage_min, 0.01)
            safety_sum += herb.safety_index * (1 - 0.15 * dosage_ratio)

            for other_hid in herbs_used:
                if other_hid == hid:
                    continue
                other_herb = self.herb_db.get(other_hid)
                if not other_herb:
                    continue
                if hid in other_herb.antagonistic_pairs or other_hid in herb.antagonistic_pairs:
                    total_penalty += 0.12

            prop = self._herb_properties.get(hid)
            if prop and prop["nature"] == "大热":
                for other_hid in herbs_used:
                    if other_hid == hid:
                        continue
                    other_prop = self._herb_properties.get(other_hid)
                    if other_prop and other_prop["nature"] in ("寒",):
                        nature_conflict_penalty += 0.08

        total_penalty += nature_conflict_penalty
        individual.safety = max(0, safety_sum / max(len(herbs_used), 1)) * max(0, 1 - total_penalty)

        # ── 3. 口感评估 ──
        individual.taste = self._evaluate_taste(genes)

        # ── 特殊人群禁忌检测 ──
        target_group = (config.constraints or {}).get("target_group", "adult")
        pregnancy_contra = {"cs", "dg", "fz", "mld", "lk"}
        children_caution = {"fz", "lk", "mld"}
        elderly_caution = {"rs"}

        if target_group == "pregnant":
            for hid in genes:
                if hid in pregnancy_contra:
                    individual.safety *= 0.5
                    break
        elif target_group == "children":
            for hid in genes:
                if hid in children_caution:
                    individual.safety *= 0.7
                    break
        elif target_group == "elderly":
            for hid in genes:
                if hid in elderly_caution:
                    individual.safety *= 0.8
                    break

        # ── 4. 成本效率评估 ──
        total_cost = sum(
            self.herb_db[hid].cost_per_gram * dosage
            for hid, dosage in genes.items() if hid in self.herb_db
        )
        max_cost = (config.constraints or {}).get("max_cost") or 30.0
        if total_cost <= max_cost:
            individual.cost_score = 1.0 - (total_cost / max_cost) * 0.5
        else:
            excess_ratio = (total_cost - max_cost) / max_cost
            individual.cost_score = max(0, 0.5 * math.exp(-excess_ratio * 2))
        individual.cost_score = max(0, min(1, individual.cost_score))

        # ── 5. 协同效应评估 ──
        synergy_total = 0
        pair_count = 0
        herb_list = list(genes.keys())
        for i in range(len(herb_list)):
            for j in range(i + 1, len(herb_list)):
                pair = tuple(sorted([herb_list[i], herb_list[j]]))
                base_syn = self.synergy_matrix.get(pair, 0.3)

                dosage_i = genes[herb_list[i]]
                dosage_j = genes[herb_list[j]]
                ratio = max(dosage_i, dosage_j) / max(min(dosage_i, dosage_j), 0.001)

                if 2 <= ratio <= 4:
                    layer3 = 0.30
                elif 1 <= ratio < 2 or 4 < ratio <= 6:
                    layer3 = 0.25
                elif ratio > 6:
                    layer3 = max(0.10, 0.30 - (ratio - 6) * 0.03)
                else:
                    layer3 = 0.20

                balance = 1 - abs(dosage_i - dosage_j) / max(dosage_i + dosage_j, 0.001)
                dynamic_syn = (base_syn - 0.15) + layer3
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
        individual.stability = (
            math.fsum(stability_factors) / max(len(stability_factors), 1)
            if stability_factors else 0
        )

        # ── 7. ADMET 综合评分 ──
        admet_parts = [individual.safety, individual.stability, 1 - (total_cost / max(max_cost, 1))]
        individual.admet = math.fsum(admet_parts) / len(admet_parts)

        # ── 属性增强评估 ──
        covered_meridians = set()
        for hid in genes.keys():
            prop = self._herb_properties.get(hid)
            if prop and "meridian" in prop:
                covered_meridians.add(prop["meridian"])
        meridian_coverage_bonus = min(len(covered_meridians) / 12.0, 1.0) * 0.05
        individual.efficacy = min(1.0, individual.efficacy + meridian_coverage_bonus)

        categories = set()
        for hid in genes.keys():
            prop = self._herb_properties.get(hid)
            if prop and "category" in prop:
                categories.add(prop["category"])
        if len(categories) >= 3:
            individual.stability = min(1.0, individual.stability + 0.03)
        elif len(categories) == 1:
            individual.stability = max(0, individual.stability - 0.02)

        # ── 填充 objectives 字典和 fitness ──
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

        w_sum = sum(obj.weight for obj in config.objectives)
        individual.fitness = sum(
            individual.objectives.get(obj.key, 0) * obj.weight *
            (1 if obj.direction == "maximize" else -1)
            for obj in config.objectives
        ) / max(w_sum, 0.001)

    def _evaluate_taste(self, genes: Dict[str, float]) -> float:
        """五味调和口感评估模型"""
        total_dosage = sum(genes.values())
        if total_dosage < 0.001:
            return 0.5

        flavor_totals = {"sweet": 0.0, "bitter": 0.0, "pungent": 0.0, "neutral": 0.0, "other": 0.0}
        for hid, dosage in genes.items():
            flavor = self._flavor_map.get(hid, "other")
            flavor_totals[flavor] += dosage

        actual_ratios = {k: v / total_dosage for k, v in flavor_totals.items()}
        ideal_ratios = {"sweet": 0.45, "neutral": 0.20, "bitter": 0.15, "pungent": 0.12, "other": 0.08}

        mse = sum((actual_ratios[k] - ideal_ratios[k]) ** 2 for k in flavor_totals) / len(flavor_totals)
        taste_base = max(0.0, 1.0 - mse * 8.0)

        if actual_ratios["bitter"] > 0.25:
            taste_base *= max(0.4, 1.0 - (actual_ratios["bitter"] - 0.25) * 2.0)

        bonus = 0.08 if ("gq" in genes or "dcx" in genes) else 0.0
        return max(0.0, min(1.0, taste_base + bonus))

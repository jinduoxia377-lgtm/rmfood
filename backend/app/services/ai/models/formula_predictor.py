"""配方属性预测器 — 预测配方序列的目标属性值

网络架构（简化版，无 PyTorch 依赖）：
- 输入：成分 ID 列表 + 用量向量
- 核心：加权聚合 + 规则引擎
- 输出：7 维属性向量
  [功效, 安全, 口感, 成本效率, 协同, 稳定, ADMET]
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import (
    Dict,
    List,
    Optional,
    Set,  # A-27
)

logger = logging.getLogger(__name__)


@dataclass
class PredictionResult:
    """预测结果"""
    efficacy: float      # 功效评分 0~1
    safety: float        # 安全评分 0~1
    taste: float         # 口感评分 0~1
    cost_score: float    # 成本效率 0~1
    synergy: float       # 协同效应 0~1
    stability: float     # 稳定性 0~1
    admet: float         # ADMET 综合 0~1
    raw_scores: Dict[str, float] = None

    @property
    def overall(self) -> float:
        """综合评分（加权平均）"""
        return (
            self.efficacy * 0.30 +
            self.safety * 0.25 +
            self.taste * 0.10 +
            self.cost_score * 0.15 +
            self.synergy * 0.10 +
            self.stability * 0.10
        )

    @property
    def vector(self) -> List[float]:
        return [
            self.efficacy, self.safety, self.taste,
            self.cost_score, self.synergy, self.stability, self.admet,
        ]


class FormulaPredictor:
    """
    配方属性预测器

    输入：配方字典 {herb_id: dosage_g}
    输出：7 维属性向量

    采用轻量级规则 + 统计模型，避免引入 PyTorch 依赖：
    - 功效：基于 _BUILTIN_HERBS 的 efficacy_scores 加权聚合
    - 安全：基于 safety_index 和配伍禁忌惩罚
    - 口感：基于四气五味调和模型
    - 协同：基于经典配伍字典
    """

    # 经典协同药对
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
        frozenset({"fp", "bq"}): 0.20,
        frozenset({"fp", "yq"}): 0.18,
    }

    # 相反药材对（安全惩罚）
    _ANTAGONISTIC_PAIRS: Set[frozenset] = None

    def __init__(
        self,
        herb_db: Optional[Dict[str, dict]] = None,
    ):
        self.herb_db = herb_db or {}
        self._antagonistic_pairs = self._build_antagonistic_pairs()

    def _build_antagonistic_pairs(self) -> set:
        """从 herb_db 构建相反药材对集合"""
        pairs = set()
        for hid, herb in self.herb_db.items():
            for partner in herb.get("antagonistic_pairs", []):
                pairs.add(frozenset([hid, partner]))
        return pairs

    def predict(
        self,
        formula: Dict[str, float],
        target_effects: Optional[List[str]] = None,
    ) -> PredictionResult:
        """
        预测配方属性

        Args:
            formula: {herb_id: dosage_g}
            target_effects: 目标功效（用于功效评分加权）

        Returns:
            PredictionResult
        """
        if not formula:
            return PredictionResult(0, 0, 0, 0, 0, 0, 0)

        efficacy = self._predict_efficacy(formula, target_effects)
        safety = self._predict_safety(formula)
        taste = self._predict_taste(formula)
        cost = self._predict_cost(formula)
        synergy = self._predict_synergy(formula)
        stability = self._predict_stability(formula, safety)
        admet = self._predict_admet(safety, stability, cost)

        return PredictionResult(
            efficacy=efficacy,
            safety=safety,
            taste=taste,
            cost_score=cost,
            synergy=synergy,
            stability=stability,
            admet=admet,
        )

    def _predict_efficacy(
        self, formula: Dict[str, float], target_effects: Optional[List[str]]
    ) -> float:
        """功效评分：目标功效加权几何平均"""
        if not formula:
            return 0.0

        scores = []
        if target_effects:
            for effect in target_effects:
                effect_score = 0.0
                total_dosage = sum(formula.values())
                for hid, dosage in formula.items():
                    herb = self.herb_db.get(hid, {})
                    es = herb.get("efficacy_scores", {}).get(effect, 0)
                    ratio = dosage / max(total_dosage, 1)
                    effect_score += es * ratio
                scores.append(effect_score)
        else:
            # 无目标功效时，取所有功效的平均
            all_scores = []
            for hid, dosage in formula.items():
                herb = self.herb_db.get(hid, {})
                es_list = list(herb.get("efficacy_scores", {}).values())
                if es_list:
                    all_scores.append(sum(es_list) / len(es_list))
            if all_scores:
                scores.append(sum(all_scores) / len(all_scores))

        if not scores:
            return 0.3  # 默认中等评分

        # 几何平均
        geo_mean = math.prod(max(0.01, s) for s in scores) ** (1.0 / len(scores))
        return max(0.0, min(1.0, geo_mean))

    def _predict_safety(self, formula: Dict[str, float]) -> float:
        """安全评分：基础安全 × 配伍禁忌惩罚"""
        if not formula:
            return 0.0

        safety_sum = 0.0
        penalty = 0.0
        n = len(formula)

        for hid, dosage in formula.items():
            herb = self.herb_db.get(hid, {})
            base_safety = herb.get("safety_index", 0.7)
            # 高剂量轻微惩罚
            dosage_ratio = min(dosage / 30.0, 1.0)
            safety_sum += base_safety * (1 - 0.15 * dosage_ratio)

        # 配伍禁忌惩罚
        herb_ids = list(formula.keys())
        for i in range(len(herb_ids)):
            for j in range(i + 1, len(herb_ids)):
                pair = frozenset([herb_ids[i], herb_ids[j]])
                if pair in self._antagonistic_pairs:
                    penalty += 0.12

        base_safety = safety_sum / n if n > 0 else 0.5
        return max(0.0, base_safety * (1 - penalty))

    def _predict_taste(self, formula: Dict[str, float]) -> float:
        """口感评分：五味调和模型"""
        if not formula:
            return 0.5

        # 五味分类映射
        taste_map = {
            "sweet": 0, "甘": 0,
            "bitter": 1, "苦": 1,
            "pungent": 2, "辛": 2,
            "sour": 3, "酸": 3,
            "salty": 4, "咸": 4,
        }

        taste_counts = [0] * 5
        total = sum(formula.values())

        for hid, dosage in formula.items():
            herb = self.herb_db.get(hid, {})
            tastes = herb.get("tastes", ["甘"])
            for t in tastes:
                idx = taste_map.get(t, 0)
                taste_counts[idx] += dosage

        # 理想比例：甘45%,  neutral 20%, 苦15%, 辛12%
        ideal = [0.45, 0.0, 0.0, 0.0, 0.0]
        actual = [c / max(total, 1) for c in taste_counts]

        # MSE 越小越好
        mse = sum((a - i) ** 2 for a, i in zip(actual, ideal)) / 5
        taste_score = max(0.0, 1.0 - mse * 5)

        # 苦味过高惩罚
        bitter_ratio = taste_counts[1] / max(total, 1)
        if bitter_ratio > 0.25:
            taste_score *= max(0.4, 1 - (bitter_ratio - 0.25) * 2)

        return max(0.0, min(1.0, taste_score))

    def _predict_cost(self, formula: Dict[str, float]) -> float:
        """成本效率评分"""
        if not formula:
            return 0.5

        total_cost = 0.0
        total_dosage = 0.0
        for hid, dosage in formula.items():
            herb = self.herb_db.get(hid, {})
            cost_per_g = herb.get("cost_per_gram", 0.15)
            total_cost += cost_per_g * dosage
            total_dosage += dosage

        # 成本越低越好，归一化到 [0, 1]
        avg_cost_per_g = total_cost / max(total_dosage, 1)
        # 假设每克 0.5 元为上限
        cost_score = max(0.0, 1.0 - avg_cost_per_g / 0.5)
        return max(0.0, min(1.0, cost_score))

    def _predict_synergy(self, formula: Dict[str, float]) -> float:
        """协同效应评分：经典配伍 + 功效互补"""
        if len(formula) < 2:
            return 0.3

        herb_ids = list(formula.keys())
        synergy_sum = 0.0
        pair_count = 0

        for i in range(len(herb_ids)):
            for j in range(i + 1, len(herb_ids)):
                pair = frozenset([herb_ids[i], herb_ids[j]])
                # Layer 1: 经典配伍
                layer1 = self._CLASSIC_SYNERGY_PAIRS.get(pair, 0.05)
                # Layer 2: 功效互补
                herb1 = self.herb_db.get(herb_ids[i], {})
                herb2 = self.herb_db.get(herb_ids[j], {})
                e1 = set(herb1.get("efficacy_scores", {}).keys())
                e2 = set(herb2.get("efficacy_scores", {}).keys())
                union = e1 | e2
                if union:
                    diff = len(e1 ^ e2) / len(union)
                    layer2 = 0.15 * diff
                else:
                    layer2 = 0.05
                # Layer 3: 剂量协调
                d1 = formula[herb_ids[i]]
                d2 = formula[herb_ids[j]]
                ratio = max(d1, d2) / max(min(d1, d2), 0.001)
                layer3 = 0.20 if 2 <= ratio <= 4 else 0.10

                synergy_sum += layer1 + layer2 + layer3
                pair_count += 1

        avg_synergy = synergy_sum / max(pair_count, 1)
        return max(0.0, min(1.0, avg_synergy))

    def _predict_stability(self, formula: Dict[str, float], safety: float) -> float:
        """稳定性评分：基于安全评分和用量合理性"""
        if not formula:
            return 0.5

        # 稳定性 = 安全评分 × 用量集中度惩罚
        total = sum(formula.values())
        dosages = list(formula.values())
        if len(dosages) < 2:
            return safety

        # 用量过于集中（一味独大）降低稳定性
        max_ratio = max(dosages) / total
        concentration_penalty = max(0.0, 1.0 - (max_ratio - 0.5) * 2)

        return max(0.0, safety * max(0.5, concentration_penalty))

    def _predict_admet(self, safety: float, stability: float, cost: float) -> float:
        """ADMET 综合评分"""
        return (safety * 0.4 + stability * 0.35 + cost * 0.25)

    def predict_batch(
        self,
        formulas: List[Dict[str, float]],
        target_effects: Optional[List[str]] = None,
    ) -> List[PredictionResult]:
        """批量预测"""
        return [self.predict(f, target_effects) for f in formulas]


# 全局单例
_predictor: Optional[FormulaPredictor] = None


def get_formula_predictor(herb_db: Optional[Dict[str, dict]] = None) -> FormulaPredictor:
    global _predictor
    if _predictor is None:
        _predictor = FormulaPredictor(herb_db=herb_db)
    return _predictor

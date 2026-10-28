"""
五味调和个性化模型

支持：
- 人群预设（老人/儿童/成人）
- 自定义口感比例
- 矫味剂奖励
- 苦味惩罚
- 生成口感评估解释
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, Optional

logger = logging.getLogger(__name__)


# 五味名称映射
FLAVOR_NAMES = {
    "sweet": "甘",
    "bitter": "苦",
    "pungent": "辛",
    "neutral": "平",
    "other": "杂",
}

# 人群预设口感比例
POPULATION_PRESETS: Dict[str, Dict[str, float]] = {
    "elderly": {"sweet": 0.50, "neutral": 0.25, "bitter": 0.10, "pungent": 0.10, "other": 0.05},
    "children": {"sweet": 0.55, "neutral": 0.20, "bitter": 0.08, "pungent": 0.07, "other": 0.10},
    "general": {"sweet": 0.45, "neutral": 0.20, "bitter": 0.15, "pungent": 0.12, "other": 0.08},
}


@dataclass
class TasteConfig:
    """口感评估配置"""
    population: str = "general"
    custom_ratios: Optional[Dict[str, float]] = None
    enable_bitter_penalty: bool = True
    enable_sweetener_bonus: bool = True


class TasteModel:
    """五味调和个性化评估模型"""

    def __init__(self, config: Optional[TasteConfig] = None):
        self.config = config or TasteConfig()
        self._base_ratios = self._compute_base_ratios()

    def _compute_base_ratios(self) -> Dict[str, float]:
        """计算基础口感比例"""
        preset = dict(POPULATION_PRESETS.get(self.config.population, POPULATION_PRESETS["general"]))
        if self.config.custom_ratios:
            preset.update(self.config.custom_ratios)
        # 归一化
        total = sum(preset.values())
        if total > 0:
            preset = {k: v / total for k, v in preset.items()}
        return preset

    def evaluate(self, genes: Dict[str, float], flavor_map: Dict[str, str]) -> float:
        """
        评估配方口感

        Args:
            genes: {herb_id: dosage_g}
            flavor_map: {herb_id: flavor_type}

        Returns:
            口感评分 (0~1)
        """
        total_dosage = sum(genes.values())
        if total_dosage < 0.001:
            return 0.5

        # 计算实际五味分布
        flavor_totals = {"sweet": 0.0, "bitter": 0.0, "pungent": 0.0, "neutral": 0.0, "other": 0.0}
        for hid, dosage in genes.items():
            flavor = flavor_map.get(hid, "other")
            flavor_totals[flavor] += dosage

        actual_ratios = {k: v / total_dosage for k, v in flavor_totals.items()}

        # MSE 计算与理想比例的差距
        mse = sum(
            (actual_ratios[k] - self._base_ratios.get(k, 0)) ** 2
            for k in flavor_totals
        ) / len(flavor_totals)

        taste_base = max(0.0, 1.0 - mse * 8.0)

        # 苦味过重惩罚
        if self.config.enable_bitter_penalty and actual_ratios["bitter"] > 0.25:
            taste_base *= max(0.4, 1.0 - (actual_ratios["bitter"] - 0.25) * 2.0)

        # 矫味剂奖励
        if self.config.enable_sweetener_bonus:
            sweetener_herbs = {"gq": "甘草", "dcx": "大枣", "sz": "山楂"}
            if any(hid in genes for hid in sweetener_herbs):
                taste_base += 0.08

        return max(0.0, min(1.0, taste_base))

    def get_explanation(self, genes: Dict[str, float], flavor_map: Dict[str, str]) -> str:
        """生成口感评估解释"""
        total_dosage = sum(genes.values())
        if total_dosage < 0.001:
            return "配方无效，无法评估口感"

        # 计算实际分布
        flavor_totals = {"sweet": 0.0, "bitter": 0.0, "pungent": 0.0, "neutral": 0.0, "other": 0.0}
        for hid, dosage in genes.items():
            flavor = flavor_map.get(hid, "other")
            flavor_totals[flavor] += dosage

        actual_ratios = {k: v / total_dosage for k, v in flavor_totals.items()}

        explanations = []
        for flavor, ratio in actual_ratios.items():
            ideal = self._base_ratios.get(flavor, 0)
            diff = ratio - ideal
            if abs(diff) > 0.05:
                direction = "偏高" if diff > 0 else "偏低"
                explanations.append(f"{FLAVOR_NAMES.get(flavor, flavor)}味{direction}")

        if not explanations:
            return "五味调和，口感均衡"

        return "、".join(explanations)

    def get_taste_summary(self, genes: Dict[str, float], flavor_map: Dict[str, str]) -> Dict:
        """获取口感评估摘要"""
        score = self.evaluate(genes, flavor_map)
        explanation = self.get_explanation(genes, flavor_map)

        total_dosage = sum(genes.values())
        flavor_totals = {"sweet": 0.0, "bitter": 0.0, "pungent": 0.0, "neutral": 0.0, "other": 0.0}
        for hid, dosage in genes.items():
            flavor = flavor_map.get(hid, "other")
            flavor_totals[flavor] += dosage

        if total_dosage > 0:
            actual_ratios = {k: round(v / total_dosage * 100, 1) for k, v in flavor_totals.items()}
        else:
            actual_ratios = {k: 0 for k in flavor_totals}

        ideal_ratios = {k: round(v * 100, 1) for k, v in self._base_ratios.items()}

        return {
            "score": round(score, 3),
            "explanation": explanation,
            "actual_distribution": actual_ratios,
            "ideal_distribution": ideal_ratios,
            "population_preset": self.config.population,
        }

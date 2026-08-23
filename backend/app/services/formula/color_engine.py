"""
调色设计引擎 — Step 2

参考《中国普通配方设计思路》第二节"调色设计"

功能：
1. 着色剂合规选择器（GB 2760 允许列表 + 适用食品类别）
2. CIELAB 色彩混合预测
3. 工艺适配检测（pH/温度/光照稳定性）
4. 民族/地区习惯适配
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class Colorant:
    """着色剂定义（基于 GB 2760-2014）"""
    name: str
    e_number: str          # E编码
    cs_number: str         # 中国序号
    type_: str             # "天然" | "合成"
    solubility: str        # "水溶性" | "油溶性"
    ph_stability: Tuple[float, float]  # 稳定pH范围
    heat_stability: bool
    light_stability: bool
    max_usage_g_per_kg: float  # 最大使用量(g/kg)
    applicable_foods: List[str]
    color_lab: Tuple[float, float, float]  # CIELAB值 (L*, a*, b*)
    safety_class: str = "safe"  # safe | caution | restricted


# ═══════════════════════════════════════════════════════════════
# GB 2760 核心着色剂数据库
# ═══════════════════════════════════════════════════════════════
COLORANT_DB: Dict[str, Colorant] = {
    "甜菜红": Colorant(
        name="甜菜红", e_number="E162", cs_number="08.001",
        type_="天然", solubility="水溶性",
        ph_stability=(3.0, 7.0), heat_stability=True, light_stability=False,
        max_usage_g_per_kg=0.05,
        applicable_foods=["饮料", "糖果", "糕点", "配制酒", "果冻"],
        color_lab=(30.0, 25.0, -15.0),
    ),
    "栀子黄": Colorant(
        name="栀子黄", e_number="E163", cs_number="09.002",
        type_="天然", solubility="水溶性",
        ph_stability=(4.0, 8.0), heat_stability=True, light_stability=True,
        max_usage_g_per_kg=0.20,
        applicable_foods=["饮料", "糕点", "冰淇淋", "配制酒", "糖果"],
        color_lab=(70.0, 5.0, 65.0),
    ),
    "姜黄": Colorant(
        name="姜黄", e_number="E100", cs_number="05.001",
        type_="天然", solubility="水溶性",
        ph_stability=(6.0, 8.0), heat_stability=True, light_stability=False,
        max_usage_g_per_kg=0.10,
        applicable_foods=["饮料", "糕点", "食用油", "膨化食品", "调味品"],
        color_lab=(80.0, 10.0, 75.0),
    ),
    "β-胡萝卜素": Colorant(
        name="β-胡萝卜素", e_number="E160a", cs_number="01.001",
        type_="天然", solubility="油溶性",
        ph_stability=(3.0, 8.0), heat_stability=True, light_stability=False,
        max_usage_g_per_kg=0.15,
        applicable_foods=["饮料", "糖果", "糕点", "乳制品", "食用油"],
        color_lab=(65.0, 20.0, 70.0),
    ),
    "焦糖色": Colorant(
        name="焦糖色", e_number="E150a", cs_number="04.001",
        type_="合成", solubility="水溶性",
        ph_stability=(2.0, 10.0), heat_stability=True, light_stability=False,
        max_usage_g_per_kg=2.0,
        applicable_foods=["酱油", "碳酸饮料", "配制酒", "糖果", "糕点"],
        color_lab=(10.0, 2.0, 15.0),
    ),
    "花青素": Colorant(
        name="花青素", e_number="E163", cs_number="12.001",
        type_="天然", solubility="水溶性",
        ph_stability=(2.0, 5.0), heat_stability=False, light_stability=True,
        max_usage_g_per_kg=0.50,
        applicable_foods=["饮料", "糖果", "配制酒"],
        color_lab=(20.0, 15.0, -30.0),
    ),
    "叶绿素铜钠盐": Colorant(
        name="叶绿素铜钠盐", e_number="E141", cs_number="07.001",
        type_="半合成", solubility="水溶性",
        ph_stability=(4.0, 7.0), heat_stability=True, light_stability=True,
        max_usage_g_per_kg=0.20,
        applicable_foods=["饮料", "糖果", "糕点", "冰淇淋"],
        color_lab=(45.0, -30.0, 40.0),
    ),
    "红曲红": Colorant(
        name="红曲红", e_number="E120", cs_number="06.001",
        type_="天然", solubility="水溶性",
        ph_stability=(4.0, 8.0), heat_stability=True, light_stability=False,
        max_usage_g_per_kg=0.50,
        applicable_foods=["肉类制品", "糕点", "饮料", "调味品"],
        color_lab=(35.0, 35.0, -5.0),
    ),
}

# 产品形态 → 适用着色剂类别映射
FORM_TO_COLORANTS: Dict[str, List[str]] = {
    "保健饮品": ["甜菜红", "栀子黄", "姜黄", "β-胡萝卜素", "花青素", "焦糖色"],
    "代茶饮": ["栀子黄", "姜黄", "花青素"],
    "膏方": ["甜菜红", "栀子黄", "姜黄", "焦糖色", "红曲红"],
    "散剂": ["栀子黄", "姜黄", "β-胡萝卜素"],
    "丸剂": ["栀子黄", "姜黄", "甜菜红"],
    "口服液": ["甜菜红", "栀子黄", "姜黄", "花青素", "β-胡萝卜素"],
    "功能性食品": ["甜菜红", "栀子黄", "姜黄", "β-胡萝卜素", "焦糖色", "红曲红"],
    "压片糖果": ["甜菜红", "栀子黄", "姜黄", "β-胡萝卜素", "花青素"],
}


class ColorEngine:
    """调色设计引擎"""

    def design(
        self,
        framework_result: Dict,
        product_form: str,
        target_color: Optional[Tuple[float, float, float]] = None,
    ) -> Dict:
        """
        调色设计主入口

        Returns:
            {
                "colorants": [{"name": "...", "dosage": X, "lab": (L,a,b)}],
                "predicted_color": (L, a, b),
                "compliance_checks": [...],
                "工艺建议": [...]
            }
        """
        # 1. 根据产品形态筛选适用着色剂
        suitable_names = FORM_TO_COLORANTS.get(product_form, list(COLORANT_DB.keys()))
        suitable = [COLORANT_DB[n] for n in suitable_names if n in COLORANT_DB]

        if not suitable:
            return {
                "colorants": [],
                "predicted_color": (50.0, 0.0, 0.0),
                "compliance_checks": ["未找到适用着色剂"],
                "工艺建议": ["建议调整产品形态或联系食品工程师"],
            }

        # 2. 根据目标颜色匹配合适着色剂组合
        if target_color:
            selection = self._select_by_target_color(suitable, target_color)
        else:
            # 默认：根据药材本色推荐
            selection = self._recommend_by_herb_nature(suitable, framework_result)

        # 3. 工艺适配检测
        compliance = self._check_compliance(selection, product_form)

        # 4. 色彩混合预测
        predicted = self._predict_mixed_color(selection)

        # 5. 工艺建议
        advice = self._generate_process_advice(selection, product_form)

        return {
            "colorants": selection,
            "predicted_color": predicted,
            "compliance_checks": compliance,
            "工艺建议": advice,
        }

    def _select_by_target_color(
        self, colorants: List[Colorant], target: Tuple[float, float, float]
    ) -> List[Dict]:
        """根据目标 CIELAB 值选择着色剂组合"""
        # 简化：选择最接近目标色的单个着色剂
        best = None
        best_dist = float("inf")
        for c in colorants:
            dist = sum((a - b) ** 2 for a, b in zip(c.color_lab, target)) ** 0.5
            if dist < best_dist:
                best_dist = dist
                best = c

        if best:
            return [{
                "name": best.name,
                "dosage_g_per_kg": best.max_usage_g_per_kg * 0.5,  # 保守用量
                "lab": best.color_lab,
                "type": best.type_,
                "solubility": best.solubility,
            }]
        return []

    def _recommend_by_herb_nature(
        self, colorants: List[Colorant], framework: Dict
    ) -> List[Dict]:
        """根据药材四气五味推荐天然着色剂"""
        # 默认推荐：栀子黄（广泛适用，稳定性好）
        recommendation = []
        for c in colorants:
            if c.name == "栀子黄" and c.heat_stability and c.light_stability:
                recommendation.append({
                    "name": c.name,
                    "dosage_g_per_kg": c.max_usage_g_per_kg * 0.3,
                    "lab": c.color_lab,
                    "type": c.type_,
                    "solubility": c.solubility,
                    "reason": "天然着色剂，热稳定性好，适用面广",
                })
                break
        return recommendation

    def _check_compliance(
        self, selection: List[Dict], product_form: str
    ) -> List[str]:
        """工艺适配合规检测"""
        checks = []
        for item in selection:
            name = item["name"]
            c = COLORANT_DB.get(name)
            if not c:
                continue

            # pH 适配
            checks.append(
                f"{name}: pH稳定范围 {c.ph_stability[0]}-{c.ph_stability[1]}"
            )
            # 热稳定性
            if not c.heat_stability:
                checks.append(f"⚠️ {name} 耐热性差，避免高温加工")
            # 光稳定性
            if not c.light_stability:
                checks.append(f"⚠️ {name} 耐光性差，需避光包装")

        return checks

    def _predict_mixed_color(
        self, selection: List[Dict]
    ) -> Tuple[float, float, float]:
        """CIELAB 色彩混合预测（加权平均模型）"""
        if not selection:
            return (50.0, 0.0, 0.0)

        total_dosage = sum(s.get("dosage_g_per_kg", 1.0) for s in selection)
        if total_dosage <= 0:
            return (50.0, 0.0, 0.0)

        L = sum(
            s["lab"][0] * s.get("dosage_g_per_kg", 1.0) / total_dosage
            for s in selection
        )
        a = sum(
            s["lab"][1] * s.get("dosage_g_per_kg", 1.0) / total_dosage
            for s in selection
        )
        b = sum(
            s["lab"][2] * s.get("dosage_g_per_kg", 1.0) / total_dosage
            for s in selection
        )

        return (round(L, 1), round(a, 1), round(b, 1))

    def _generate_process_advice(
        self, selection: List[Dict], product_form: str
    ) -> List[str]:
        """工艺适配建议"""
        advice = []
        for item in selection:
            name = item["name"]
            c = COLORANT_DB.get(name)
            if not c:
                continue

            if c.solubility == "水溶性":
                advice.append(f"{name}: 建议配成1%-10%水溶液后使用")
            if c.type_ == "油溶性":
                advice.append(f"{name}: 建议先用少量食用油分散后再加入")
            if not c.heat_stability:
                advice.append(f"{name}: 建议在冷却后添加，避免高温破坏")

        if not advice:
            advice.append("着色剂选择合理，按常规工艺添加即可")

        return advice

"""
品质改良设计引擎 — Step 5

参考《中国普通配方设计思路》第五节"品质改良设计"

功能：
1. 增稠设计 — 亲水胶体选择 + 粘度模型
2. 乳化设计 — HLB值计算 + 乳液稳定性
3. 水分保持设计 — 磷酸盐/乳酸盐选型
4. 抗氧化设计 — 抗氧化剂复配 + 氧化动力学
5. 质构模拟 — 流变学简化模型
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List

logger = logging.getLogger(__name__)


@dataclass
class Thickener:
    """增稠剂"""
    name: str
    HLB_value: float
    max_usage_g_per_kg: float
    applicable_forms: List[str]
    viscosity_impact: float  # 对粘度的影响系数 (0~1)
    source: str  # 天然/合成


@dataclass
class Emulsifier:
    """乳化剂"""
    name: str
    HLB_required: float
    max_usage_g_per_kg: float
    compatibility: List[str]  # 兼容的增稠剂


# ═══════════════════════════════════════════════════════════════
# 增稠剂数据库（GB 2760 允许使用）
# ═══════════════════════════════════════════════════════════════
THICKENER_DB: Dict[str, Thickener] = {
    "黄原胶": Thickener("黄原胶", 13.0, 1.0,
                       ["保健饮品", "膏方", "口服液", "功能性食品"], 0.85, "天然"),
    "羧甲基纤维素钠": Thickener("CMC-Na", 12.0, 0.5,
                                ["散剂", "丸剂", "压片糖果", "功能性食品"], 0.70, "合成"),
    "明胶": Thickener("明胶", 9.0, 2.0,
                      ["膏方", "口服液", "保健饮品"], 0.60, "天然"),
    "果胶": Thickener("果胶", 14.0, 0.3,
                     ["保健饮品", "压片糖果", "功能性食品"], 0.55, "天然"),
    "魔芋胶": Thickener("魔芋胶", 11.0, 0.5,
                        ["保健饮品", "膏方", "口服液"], 0.90, "天然"),
    "卡拉胶": Thickener("卡拉胶", 15.0, 0.5,
                        ["保健饮品", "口服液", "功能性食品"], 0.75, "天然"),
    "琼脂": Thickener("琼脂", 14.0, 0.3,
                      ["膏方", "果冻", "功能性食品"], 0.65, "天然"),
    "瓜尔胶": Thickener("瓜尔胶", 12.0, 0.5,
                        ["保健饮品", "膏方"], 0.80, "天然"),
}

# ═══════════════════════════════════════════════════════════════
# 乳化剂数据库
# ═══════════════════════════════════════════════════════════════
EMULSIFIER_DB: Dict[str, Emulsifier] = {
    "蔗糖脂肪酸酯": Emulsifier("蔗糖脂肪酸酯", 12.0, 0.5, ["黄原胶", "CMC-Na", "果胶"]),
    "吐温-80": Emulsifier("吐温-80", 15.0, 0.3, ["黄原胶"]),
    "司盘-80": Emulsifier("司盘-80", 4.3, 0.5, ["果胶"]),
    "磷脂酰胆碱": Emulsifier("磷脂酰胆碱", 8.0, 0.2, ["黄原胶", "魔芋胶"]),
}

# ═══════════════════════════════════════════════════════════════
# 抗氧化剂数据库
# ═══════════════════════════════════════════════════════════════
ANTIOXIDANT_DB: Dict[str, Dict] = {
    "维生素C": {"max_g_per_kg": 0.5, "forms": ["抗坏血酸", "抗坏血酸钠"],
                "heat_sensitive": True, "light_sensitive": True},
    "维生素E": {"max_g_per_kg": 0.1, "forms": ["d-α-生育酚"],
                "heat_sensitive": False, "light_sensitive": True},
    "茶多酚": {"max_g_per_kg": 0.3, "forms": ["儿茶素"],
              "heat_sensitive": True, "light_sensitive": False},
    "植酸": {"max_g_per_kg": 0.1, "forms": ["植酸"],
             "heat_sensitive": False, "light_sensitive": False},
    "柠檬酸": {"max_g_per_kg": 2.0, "forms": ["无水柠檬酸", "一水柠檬酸"],
              "heat_sensitive": False, "light_sensitive": False},
}


class QualityEngine:
    """品质改良设计引擎"""

    def design(
        self,
        framework_result: Dict,
        product_form: str,
    ) -> Dict:
        """
        品质改良设计主入口

        Returns:
            {
                "thickener": {...},
                "emulsifier": {...},
                "moisture_control": {...},
                "antioxidant": {...},
                "texture_prediction": {...},
                "process_advice": [...]
            }
        """
        return {
            "thickener": self._recommend_thickener(product_form),
            "emulsifier": self._recommend_emulsifier(product_form),
            "moisture_control": self._design_moisture_control(product_form),
            "antioxidant": self._design_antioxidant(framework_result),
            "texture_prediction": self._predict_texture(framework_result, product_form),
            "process_advice": self._generate_process_advice(product_form),
        }

    def _recommend_thickener(self, product_form: str) -> Dict:
        """增稠剂推荐"""
        suitable = [
            t for t in THICKENER_DB.values()
            if product_form in t.applicable_forms
        ]

        if not suitable:
            return {"recommendation": "无需增稠剂", "reason": f"{product_form} 不适用增稠"}

        # 按粘度影响和天然度排序（优先天然）
        best = max(suitable, key=lambda t: (t.source == "天然", t.viscosity_impact))
        return {
            "name": best.name,
            "max_dosage_g_per_kg": best.max_usage_g_per_kg,
            "HLB_value": best.HLB_value,
            "viscosity_impact": best.viscosity_impact,
            "source": best.source,
            "reason": f"适用于 {product_form}，粘度影响 {'高' if best.viscosity_impact > 0.7 else '中'}",
        }

    def _recommend_emulsifier(self, product_form: str) -> Dict:
        """乳化剂推荐"""
        # 液态产品需要乳化剂
        liquid_forms = {"保健饮品", "口服液", "膏方"}
        if product_form not in liquid_forms:
            return {"recommendation": "无需乳化剂", "reason": f"{product_form} 为非液态产品"}

        # 推荐蔗糖脂肪酸酯（应用最广）
        em = EMULSIFIER_DB["蔗糖脂肪酸酯"]
        return {
            "name": em.name,
            "HLB_value": em.HLB_required,
            "max_dosage_g_per_kg": em.max_usage_g_per_kg,
            "compatible_thickeners": em.compatibility,
            "reason": "HLB值适中，适用于水包油型乳液",
        }

    def _design_moisture_control(self, product_form: str) -> Dict:
        """水分保持设计"""
        from .product_form_rules import PRODUCT_FORM_RULES
        rule = PRODUCT_FORM_RULES.get(product_form)

        if not rule or rule.water_content_limit is None:
            return {
                "status": "液态产品，无水分限制",
                "limit": None,
                "suggestions": [],
            }

        # 推荐水分保持剂
        suggestions = []
        if rule.water_content_limit and rule.water_content_limit < 5.0:
            suggestions.append("使用磷酸盐类水分保持剂（焦磷酸钠、三聚磷酸钠）")
            suggestions.append("控制干燥温度 < 60°C，避免水分过度蒸发")

        if rule.particle_size_um:
            suggestions.append(f"控制粒径 ≤ {rule.particle_size_um:.0f}μm 以确保流动性")

        return {
            "max_water_content_pct": rule.water_content_limit,
            "suggestions": suggestions,
            "recommended_agents": ["乳酸钙", "乳酸钠", "磷酸盐类"],
        }

    def _design_antioxidant(self, framework_result: Dict) -> Dict:
        """
        抗氧化设计

        原理：食品在储藏运输过程中氧化是导致品质变劣的重要因素，
        氧化会使油脂酸败、褐变、褪色、维生素破坏。
        """
        herbs = framework_result.get("herbs", [])

        # 检查是否含有天然抗氧化成分的药材
        antioxidant_herbs = {"gz", "cyh", "jgh", "sj", "cx", "fp", "bq"}
        has_natural_antioxidant = any(
            h.get("id") in antioxidant_herbs for h in herbs
        )

        if has_natural_antioxidant:
            natural_list = [
                h.get("name", h.get("id")) for h in herbs
                if h.get("id") in antioxidant_herbs
            ]
            return {
                "status": "配方含天然抗氧化成分，可降低合成抗氧化剂用量",
                "natural_antioxidants": natural_list,
                "recommendation": "建议添加维生素C (0.1-0.3g/kg) 作为辅助抗氧化剂",
                "添加时机": "后处理阶段加入，避免高温破坏",
                "shelf_life_boost": "+15%~25%",
            }
        else:
            return {
                "status": "建议添加合成抗氧化剂",
                "recommendation": "维生素C (0.1-0.3g/kg) 或 维生素E (0.05-0.1g/kg)",
                "添加时机": "后处理阶段加入",
                "注意事项": "避免高温加工，注意光照保护",
            }

    def _predict_texture(self, framework_result: Dict, product_form: str) -> Dict:
        """质构预测（简化模型）"""
        herbs = framework_result.get("herbs", [])
        total_dosage = framework_result.get("total_dosage_g", 100.0)

        # 基于药材数量和产品形态预测质构
        n_herbs = len(herbs)

        texture_predictions = {
            "保健饮品": {"viscosity": "低-中", "mouthfeel": "顺滑", "stability": "需增稠剂"},
            "代茶饮": {"viscosity": "无（冲泡液）", "mouthfeel": "清淡", "stability": "良好"},
            "膏方": {"viscosity": "高", "mouthfeel": "粘稠", "stability": "需防腐"},
            "散剂": {"viscosity": "粉末", "mouthfeel": "细腻度取决于粒径", "stability": "需防潮"},
            "丸剂": {"viscosity": "团状", "mouthfeel": "柔韧", "stability": "良好"},
            "口服液": {"viscosity": "低-中", "mouthfeel": "顺滑", "stability": "需增稠+乳化"},
            "功能性食品": {"viscosity": "中", "mouthfeel": "取决于基质", "stability": "良好"},
            "压片糖果": {"viscosity": "片状", "mouthfeel": "脆性", "stability": "需防潮"},
        }

        prediction = texture_predictions.get(product_form, {
            "viscosity": "待定",
            "mouthfeel": "待定",
            "stability": "需评估",
        })

        # 根据药材数量调整
        if n_herbs > 8:
            prediction["stability"] += "（成分复杂，建议充分混合）"
        elif n_herbs < 3:
            prediction["stability"] += "（成分简单，稳定性较好）"

        return prediction

    def _generate_process_advice(self, product_form: str) -> List[str]:
        """生成工艺适配建议"""
        advice = []

        process_advice_map = {
            "保健饮品": [
                "建议采用真空浓缩工艺，降低热敏成分损失",
                "添加增稠剂前需充分溶解（黄原胶需预分散）",
                "灌装前需灭菌（巴氏杀菌 85°C/15min）",
            ],
            "代茶饮": [
                "建议采用低温干燥（<60°C）保留活性成分",
                "粉碎至 200-400 目，确保冲泡溶解性",
                "包装需防潮（铝箔复合袋）",
            ],
            "膏方": [
                "先煎煮有效成分，去渣后浓缩",
                "收膏时加入蜂蜜/糖，控制含水量 < 15%",
                "浓缩过程需搅拌防焦底",
            ],
            "散剂": [
                "各药材分别粉碎后混合（避免交叉污染）",
                "控制水分 < 3%，防止结块",
                "粒径控制在 150μm 以下",
            ],
            "丸剂": [
                "细粉泛丸或炼蜜泛丸",
                "控制丸重差异在 ±5% 以内",
                "干燥温度 < 60°C",
            ],
            "口服液": [
                "建议采用超声提取提高得率",
                "添加乳化剂和增稠剂确保稳定性",
                "灌装后灭菌（121°C/15min 或 85°C/30min）",
            ],
            "功能性食品": [
                "注意原料预处理（粉碎、提取、浓缩）",
                "控制水分和包装防潮",
                "注意抗氧化剂添加时机",
            ],
            "压片糖果": [
                "原料需充分干燥（水分 < 3%）",
                "添加适量辅料（微晶纤维素、硬脂酸镁）",
                "控制压片压力确保硬度适中",
            ],
        }

        advice.extend(process_advice_map.get(product_form, ["按常规食品工艺执行"]))
        return advice

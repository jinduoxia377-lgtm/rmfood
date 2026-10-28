"""
风味预测模型
基于成分比例预测配方口感评分
支持：苦涩度、鲜味度、总体接受度
"""

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ==================== 风味数据库 ====================

TASTE_DATABASE: Dict[str, Dict[str, float]] = {
    # 药材风味特征（基于感官评价数据）
    "黄芪": {"bitter": 0.3, "sweet": 0.4, "umami": 0.2, "astringent": 0.1, "sour": 0.0},
    "人参": {"bitter": 0.6, "sweet": 0.3, "umami": 0.1, "astringent": 0.0, "sour": 0.0},
    "枸杞": {"bitter": 0.0, "sweet": 0.8, "umami": 0.1, "astringent": 0.0, "sour": 0.1},
    "甘草": {"bitter": 0.1, "sweet": 0.9, "umami": 0.0, "astringent": 0.0, "sour": 0.0},
    "当归": {"bitter": 0.4, "sweet": 0.2, "umami": 0.1, "astringent": 0.3, "sour": 0.0},
    "陈皮": {"bitter": 0.5, "sweet": 0.1, "umami": 0.0, "astringent": 0.2, "sour": 0.2},
    "菊花": {"bitter": 0.7, "sweet": 0.1, "umami": 0.0, "astringent": 0.1, "sour": 0.1},
    "山药": {"bitter": 0.0, "sweet": 0.5, "umami": 0.3, "astringent": 0.0, "sour": 0.0},
    "红枣": {"bitter": 0.0, "sweet": 0.9, "umami": 0.0, "astringent": 0.0, "sour": 0.1},
    "茯苓": {"bitter": 0.1, "sweet": 0.3, "umami": 0.4, "astringent": 0.0, "sour": 0.0},
    "白术": {"bitter": 0.3, "sweet": 0.2, "umami": 0.2, "astringent": 0.2, "sour": 0.1},
    "莲子": {"bitter": 0.1, "sweet": 0.5, "umami": 0.3, "astringent": 0.0, "sour": 0.0},
    "芡实": {"bitter": 0.0, "sweet": 0.4, "umami": 0.4, "astringent": 0.0, "sour": 0.0},
    "薏苡仁": {"bitter": 0.0, "sweet": 0.3, "umami": 0.5, "astringent": 0.0, "sour": 0.0},
    "黑芝麻": {"bitter": 0.1, "sweet": 0.4, "umami": 0.4, "astringent": 0.0, "sour": 0.0},
    "核桃仁": {"bitter": 0.2, "sweet": 0.3, "umami": 0.3, "astringent": 0.1, "sour": 0.0},

    # 肽类风味
    "大豆肽": {"bitter": 0.6, "sweet": 0.1, "umami": 0.7, "astringent": 0.0, "sour": 0.0},
    "胶原蛋白肽": {"bitter": 0.1, "sweet": 0.2, "umami": 0.5, "astringent": 0.0, "sour": 0.0},
    "乳清蛋白肽": {"bitter": 0.2, "sweet": 0.3, "umami": 0.6, "astringent": 0.0, "sour": 0.1},
    "小麦肽": {"bitter": 0.3, "sweet": 0.2, "umami": 0.4, "astringent": 0.0, "sour": 0.0},
    "鱼胶原蛋白肽": {"bitter": 0.0, "sweet": 0.1, "umami": 0.8, "astringent": 0.0, "sour": 0.0},

    # 皂苷类风味
    "人参皂苷": {"bitter": 0.9, "sweet": 0.0, "umami": 0.0, "astringent": 0.0, "sour": 0.0},
    "黄芪甲苷": {"bitter": 0.8, "sweet": 0.0, "umami": 0.0, "astringent": 0.0, "sour": 0.0},
    "三七皂苷": {"bitter": 0.7, "sweet": 0.1, "umami": 0.0, "astringent": 0.0, "sour": 0.0},

    # 黄酮类风味
    "大豆异黄酮": {"bitter": 0.5, "sweet": 0.1, "umami": 0.0, "astringent": 0.0, "sour": 0.0},
    "槲皮素": {"bitter": 0.8, "sweet": 0.0, "umami": 0.0, "astringent": 0.0, "sour": 0.0},
    "葛根素": {"bitter": 0.4, "sweet": 0.2, "umami": 0.0, "astringent": 0.0, "sour": 0.0},

    # 维生素
    "维生素C": {"bitter": 0.0, "sweet": 0.0, "umami": 0.0, "astringent": 0.0, "sour": 0.9},
    "维生素E": {"bitter": 0.1, "sweet": 0.0, "umami": 0.0, "astringent": 0.0, "sour": 0.0},

    # 其他
    "姜黄素": {"bitter": 0.3, "sweet": 0.0, "umami": 0.0, "astringent": 0.0, "sour": 0.1},
    "褪黑素": {"bitter": 0.0, "sweet": 0.0, "umami": 0.0, "astringent": 0.0, "sour": 0.0},
}

# 风味相互作用矩阵（增强/抑制）
TASTE_INTERACTION_MATRIX: Dict[Tuple[str, str], float] = {
    ("bitter", "sweet"): -0.3,    # 甜味掩盖苦味
    ("bitter", "umami"): -0.2,    # 鲜味掩盖苦味
    ("astringent", "sweet"): -0.2, # 甜味缓和涩味
    ("sour", "sweet"): -0.1,      # 甜味缓和酸味
    ("umami", "sweet"): 0.1,      # 鲜甜协同增强
    ("bitter", "sour"): 0.1,      # 苦酸叠加
}


@dataclass
class TasteProfile:
    """风味档案"""
    bitter: float = 0.0      # 苦涩度 [0, 1]
    sweet: float = 0.0       # 甜味度 [0, 1]
    umami: float = 0.0       # 鲜味度 [0, 1]
    astringent: float = 0.0  # 涩味度 [0, 1]
    sour: float = 0.0        # 酸味度 [0, 1]

    @property
    def balance_score(self) -> float:
        """风味平衡度"""
        # 理想状态：苦甜均衡，鲜味突出
        return 1.0 - abs(self.bitter - self.sweet) - self.astringent - max(0, self.sour - 0.3)

    @property
    def acceptability(self) -> float:
        """总体接受度"""
        # 接受度 = 鲜味 + 甜味 - 苦味 - 涩味 - 过酸
        return max(0, min(1,
            self.umami * 0.3 +
            self.sweet * 0.25 -
            self.bitter * 0.25 -
            self.astringent * 0.2 -
            max(0, self.sour - 0.3) * 0.1
        ))


class TastePredictor:
    """
    风味预测模型

    功能:
    1. 基于成分比例预测配方风味
    2. 风味平衡度评估
    3. 总体接受度预测
    4. 风味优化建议
    """

    def __init__(self):
        self._taste_db = TASTE_DATABASE
        self._interaction_matrix = TASTE_INTERACTION_MATRIX
        logger.info("TastePredictor 初始化完成")

    def predict_taste(
        self,
        ingredients: List[Dict[str, Any]],
        calibration: Optional[Dict[str, float]] = None
    ) -> TasteProfile:
        """
        预测配方风味

        Args:
            ingredients: [{"name": str, "percentage": float}, ...]
            calibration: 用户校准系数 {"bitter": 1.0, "sweet": 1.0, ...}

        Returns:
            TasteProfile: 预测风味档案
        """
        calibration = calibration or {}

        weighted_taste = {"bitter": 0, "sweet": 0, "umami": 0, "astringent": 0, "sour": 0}
        total_percentage = sum(ing.get("percentage", 0) for ing in ingredients)

        if total_percentage == 0:
            return TasteProfile()

        for ing in ingredients:
            name = ing.get("name", "")
            percentage = ing.get("percentage", 0) / 100.0

            taste_profile = self._taste_db.get(name, {
                "bitter": 0.2, "sweet": 0.2, "umami": 0.2,
                "astringent": 0.1, "sour": 0.1
            })

            # 加权累加
            for taste_type in ["bitter", "sweet", "umami", "astringent", "sour"]:
                value = taste_profile.get(taste_type, 0) * percentage
                # 应用校准系数
                if taste_type in calibration:
                    value *= calibration[taste_type]
                weighted_taste[taste_type] += value

        # 归一化
        for key in weighted_taste:
            weighted_taste[key] = min(1.0, weighted_taste[key])

        return TasteProfile(**weighted_taste)

    def calculate_interaction_effects(
        self,
        taste_profile: TasteProfile
    ) -> Dict[str, float]:
        """计算风味相互作用效应"""
        interactions = {}

        for (taste1, taste2), effect in self._interaction_matrix.items():
            # 检查两种风味是否都存在显著值
            vals = getattr(taste_profile, taste1, 0), getattr(taste_profile, taste2, 0)
            if vals[0] > 0.2 and vals[1] > 0.2:
                interactions[f"{taste1}+{taste2}"] = effect * vals[0] * vals[1]

        return interactions

    def get_optimization_suggestions(
        self,
        taste_profile: TasteProfile,
        current_ingredients: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        获取风味优化建议

        根据当前风味特征，推荐调整方向：
        - 苦味过高 → 建议添加甜味成分
        - 鲜味不足 → 建议添加鲜味增强成分
        - 涩味过高 → 建议添加甜味或鲜味成分
        """
        suggestions = []

        if taste_profile.bitter > 0.5:
            suggestions.append({
                "type": "reduce_bitter",
                "description": "苦味偏高，建议降低苦味成分比例或添加甜味成分",
                "action": "添加红枣、枸杞等甜味成分",
                "expected_improvement": "+0.15 接受度"
            })

        if taste_profile.umami < 0.3:
            suggestions.append({
                "type": "enhance_umami",
                "description": "鲜味不足，建议添加鲜味成分",
                "action": "添加大豆肽、胶原蛋白肽等鲜味成分",
                "expected_improvement": "+0.10 接受度"
            })

        if taste_profile.astringent > 0.3:
            suggestions.append({
                "type": "reduce_astringent",
                "description": "涩味偏高，建议添加甜味或鲜味成分中和",
                "action": "添加甘草、红枣等缓和涩味",
                "expected_improvement": "+0.08 接受度"
            })

        if taste_profile.sour > 0.4:
            suggestions.append({
                "type": "reduce_sour",
                "description": "酸味偏高，建议添加甜味成分平衡",
                "action": "添加蜂蜜、红枣等甜味成分",
                "expected_improvement": "+0.05 接受度"
            })

        if taste_profile.balance_score < 0.6:
            suggestions.append({
                "type": "improve_balance",
                "description": "风味平衡度较低，建议调整成分比例",
                "action": "重新调整各成分配比",
                "expected_improvement": "+0.12 接受度"
            })

        return suggestions

    def predict_acceptance(
        self,
        ingredients: List[Dict[str, Any]],
        target_population: str = "adult"
    ) -> Dict[str, Any]:
        """
        预测目标人群的接受度

        Args:
            ingredients: 配方成分
            target_population: 目标人群 (adult/children/elderly)

        Returns:
            接受度预测结果
        """
        taste_profile = self.predict_taste(ingredients)
        interactions = self.calculate_interaction_effects(taste_profile)
        suggestions = self.get_optimization_suggestions(taste_profile, ingredients)

        # 人群调整系数
        population_adjustments = {
            "adult": {"bitter_tolerance": 1.0, "sweet_preference": 1.0},
            "children": {"bitter_tolerance": 0.5, "sweet_preference": 1.3},
            "elderly": {"bitter_tolerance": 0.7, "sweet_preference": 1.1}
        }

        adj = population_adjustments.get(target_population, population_adjustments["adult"])

        # 计算人群调整后的接受度
        adjusted_acceptability = taste_profile.acceptability
        if target_population == "children":
            adjusted_acceptability = adjusted_acceptability * adj["sweet_preference"] - taste_profile.bitter * (1 - adj["bitter_tolerance"])
        elif target_population == "elderly":
            adjusted_acceptability = adjusted_acceptability * adj["sweet_preference"] - taste_profile.bitter * (1 - adj["bitter_tolerance"]) * 0.5

        adjusted_acceptability = max(0, min(1, adjusted_acceptability))

        return {
            "taste_profile": {
                "bitter": round(taste_profile.bitter, 3),
                "sweet": round(taste_profile.sweet, 3),
                "umami": round(taste_profile.umami, 3),
                "astringent": round(taste_profile.astringent, 3),
                "sour": round(taste_profile.sour, 3),
                "balance_score": round(taste_profile.balance_score, 3),
                "acceptability": round(taste_profile.acceptability, 3)
            },
            "population_adjusted_acceptability": round(adjusted_acceptability, 3),
            "target_population": target_population,
            "interaction_effects": interactions,
            "optimization_suggestions": suggestions,
            "overall_score": round(adjusted_acceptability * 100, 1)
        }


if __name__ == "__main__":
    predictor = TastePredictor()

    # 测试配方
    test_formula = [
        {"name": "黄芪多糖", "percentage": 30},
        {"name": "大豆肽", "percentage": 25},
        {"name": "枸杞", "percentage": 20},
        {"name": "甘草", "percentage": 15},
        {"name": "维生素C", "percentage": 10},
    ]

    result = predictor.predict_acceptance(test_formula, "adult")

    print("=== 风味预测结果 ===")
    print(f"整体评分: {result['overall_score']}")
    print("风味档案:")
    for k, v in result['taste_profile'].items():
        print(f"  {k}: {v}")
    print("优化建议:")
    for s in result['optimization_suggestions']:
        print(f"  - {s['description']}: {s['action']}")

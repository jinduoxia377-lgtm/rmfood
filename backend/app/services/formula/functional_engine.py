"""
功能性设计引擎 — Step 7

参考《中国普通配方设计思路》第七节"功能性设计"

功能：
1. 强化剂选择器 — 针对目标人群的营养缺乏问题选择强化剂
2. 保留率预测器 — 考虑加工过程中的营养损失
3. 营养均衡评估器 — 确保强化后的营养均衡性
4. GB 14880 合规检查
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# GB 14880 营养强化剂允许清单（简化版）
# ═══════════════════════════════════════════════════════════════
ALLOWED_ENHANCERS: Dict[str, Dict] = {
    "维生素A": {
        "max_mg_per_day": 0.8,
        "forms": ["棕榈酸视黄酯", "醋酸视黄酯"],
        "heat_sensitive": True,
        "light_sensitive": True,
        "target_population": ["children", "elderly"],
    },
    "维生素D3": {
        "max_mg_per_day": 0.025,
        "forms": ["胆钙化醇"],
        "heat_sensitive": False,
        "light_sensitive": True,
        "target_population": ["children", "elderly", "pregnant"],
    },
    "维生素E": {
        "max_mg_per_day": 0.8,
        "forms": ["d-α-生育酚"],
        "heat_sensitive": False,
        "light_sensitive": True,
        "target_population": ["adult", "elderly"],
    },
    "维生素C": {
        "max_mg_per_day": 2.0,
        "forms": ["抗坏血酸", "抗坏血酸钠", "抗坏血酸钙"],
        "heat_sensitive": True,
        "light_sensitive": True,
        "target_population": ["adult", "children", "elderly", "pregnant"],
    },
    "钙": {
        "max_mg_per_day": 2.5,
        "forms": ["碳酸钙", "乳酸钙", "葡萄糖酸钙", "柠檬酸钙"],
        "heat_sensitive": False,
        "light_sensitive": False,
        "target_population": ["children", "elderly", "pregnant"],
    },
    "铁": {
        "max_mg_per_day": 30,
        "forms": ["硫酸亚铁", "富马酸亚铁", "葡萄糖酸亚铁"],
        "heat_sensitive": False,
        "light_sensitive": False,
        "target_population": ["adult", "pregnant", "children"],
    },
    "锌": {
        "max_mg_per_day": 25,
        "forms": ["葡萄糖酸锌", "硫酸锌", "柠檬酸锌"],
        "heat_sensitive": False,
        "light_sensitive": False,
        "target_population": ["adult", "children", "elderly"],
    },
    "硒": {
        "max_ug_per_day": 250,
        "forms": ["硒酵母", "硒化蛋白质"],
        "heat_sensitive": False,
        "light_sensitive": False,
        "target_population": ["adult", "elderly"],
    },
    "叶酸": {
        "max_ug_per_day": 400,
        "forms": ["叶酸", "L-甲基叶酸"],
        "heat_sensitive": True,
        "light_sensitive": True,
        "target_population": ["pregnant"],
    },
}

# 目标人群营养需求基准
POPULATION_NUTRITION: Dict[str, Dict[str, float]] = {
    "adult": {"calcium_mg": 800, "iron_mg": 12, "vitamin_d_mcg": 10, "zinc_mg": 12.5, "vitamin_c_mg": 100},
    "elderly": {"calcium_mg": 1000, "iron_mg": 10, "vitamin_d_mcg": 15, "zinc_mg": 12.5, "vitamin_c_mg": 100},
    "children": {"calcium_mg": 800, "iron_mg": 10, "vitamin_d_mcg": 10, "zinc_mg": 10.5, "vitamin_c_mg": 100},
    "pregnant": {"calcium_mg": 1200, "iron_mg": 25, "vitamin_d_mcg": 10, "zinc_mg": 12, "vitamin_c_mg": 130, "folic_acid_mcg": 400},
    "athlete": {"calcium_mg": 1000, "iron_mg": 12, "vitamin_d_mcg": 15, "zinc_mg": 15, "vitamin_c_mg": 150},
}


class FunctionalEngine:
    """功能性设计引擎"""

    def design(
        self,
        framework_result: Dict,
        target_group: str,
        nutrition_requirements: Optional[Dict] = None,
    ) -> Dict:
        """
        功能性设计主入口

        Returns:
            {
                "enhancer_recommendations": [...],
                "retention_prediction": {...},
                "compliance_check": {...},
                "nutrition_balance": {...},
                "summary": str
            }
        """
        # Step 1: 营养缺口分析
        gaps = self._analyze_nutrition_gaps(target_group, nutrition_requirements)

        # Step 2: 强化剂推荐
        enhancers = self._recommend_enhancers(gaps, framework_result, target_group)

        # Step 3: 保留率预测
        retention = self._predict_retention(framework_result, enhancers)

        # Step 4: 合规检查
        compliance = self._check_compliance(enhancers, target_group)

        # Step 5: 营养均衡评估
        balance = self._assess_nutrition_balance(enhancers, gaps)

        # 汇总
        summary = self._build_summary(enhancers, compliance, gaps)

        return {
            "enhancer_recommendations": enhancers,
            "retention_prediction": retention,
            "compliance_check": compliance,
            "nutrition_balance": balance,
            "nutrition_gaps": gaps,
            "summary": summary,
        }

    def _analyze_nutrition_gaps(
        self, target_group: str, requirements: Optional[Dict]
    ) -> Dict[str, float]:
        """分析目标人群的营养缺口"""
        base_needs = POPULATION_NUTRITION.get(target_group, POPULATION_NUTRITION["adult"])
        if requirements:
            base_needs.update(requirements)

        # 从框架结果中估算当前营养含量
        current = self._estimate_current_nutrition(base_needs)

        gaps = {}
        for nutrient, needed in base_needs.items():
            actual = current.get(nutrient, 0)
            if actual < needed:
                gaps[nutrient] = round(needed - actual, 2)

        return gaps

    def _estimate_current_nutrition(self, needs: Dict[str, float]) -> Dict[str, float]:
        """估算当前配方的营养含量（简化模型）"""
        # 基于典型中药配方估算
        estimates = {}
        for nutrient in needs:
            # 默认估算：基础含量 + 随机波动
            base = {
                "calcium_mg": 50, "iron_mg": 3, "vitamin_d_mcg": 1,
                "zinc_mg": 2, "vitamin_c_mg": 10, "folic_acid_mcg": 20,
            }.get(nutrient, 0)
            estimates[nutrient] = base

        return estimates

    def _recommend_enhancers(
        self, gaps: Dict[str, float], framework: Dict, target_group: str
    ) -> List[Dict]:
        """推荐强化剂"""
        recommendations = []

        nutrient_to_enhancer = {
            "calcium_mg": "钙",
            "iron_mg": "铁",
            "vitamin_d_mcg": "维生素D3",
            "zinc_mg": "锌",
            "vitamin_c_mg": "维生素C",
            "folic_acid_mcg": "叶酸",
        }

        for nutrient, gap in gaps.items():
            enhancer_name = nutrient_to_enhancer.get(nutrient)
            if not enhancer_name or enhancer_name not in ALLOWED_ENHANCERS:
                continue

            enhancer_info = ALLOWED_ENHANCERS[enhancer_name]

            # 检查目标人群是否适用
            if target_group not in enhancer_info.get("target_population", []):
                continue

            # 计算推荐添加量（考虑保留率）
            retention_rate = self._get_retention_rate(enhancer_name, framework)
            recommended_dosage = round(gap / max(retention_rate, 0.5), 2)

            # 检查是否超限
            max_daily = enhancer_info.get("max_mg_per_day", float("inf"))
            if recommended_dosage > max_daily:
                recommended_dosage = max_daily
                status = "已达上限"
            else:
                status = "推荐"

            recommendations.append({
                "nutrient": nutrient,
                "enhancer_name": enhancer_name,
                "forms": enhancer_info["forms"],
                "recommended_dosage_mg": recommended_dosage,
                "max_allowed_mg": max_daily,
                "retention_rate": round(retention_rate, 2),
                "status": status,
                "heat_sensitive": enhancer_info.get("heat_sensitive", False),
                "light_sensitive": enhancer_info.get("light_sensitive", False),
            })

        return recommendations

    def _get_retention_rate(self, enhancer_name: str, framework: Dict) -> float:
        """获取保留率（基于产品类型和强化剂类型）"""
        product_form = framework.get("product_form", "功能性食品")

        retention_map = {
            "维生素C": {"饮料": 0.85, "膏方": 0.70, "散剂": 0.90, "丸剂": 0.80,
                         "口服液": 0.80, "功能性食品": 0.85, "压片糖果": 0.85},
            "维生素E": {"饮料": 0.90, "膏方": 0.85, "散剂": 0.95, "丸剂": 0.90,
                         "口服液": 0.88, "功能性食品": 0.90, "压片糖果": 0.90},
            "钙": {"饮料": 0.95, "膏方": 0.90, "散剂": 0.95, "丸剂": 0.95,
                   "口服液": 0.92, "功能性食品": 0.95, "压片糖果": 0.95},
            "铁": {"饮料": 0.80, "膏方": 0.75, "散剂": 0.90, "丸剂": 0.85,
                   "口服液": 0.80, "功能性食品": 0.85, "压片糖果": 0.85},
            "锌": {"饮料": 0.85, "膏方": 0.80, "散式": 0.90, "丸剂": 0.85,
                   "口服液": 0.85, "功能性食品": 0.90, "压片糖果": 0.90},
            "维生素D3": {"饮料": 0.85, "膏方": 0.80, "散剂": 0.90, "丸剂": 0.85,
                         "口服液": 0.85, "功能性食品": 0.90, "压片糖果": 0.90},
            "叶酸": {"饮料": 0.75, "膏方": 0.70, "散剂": 0.85, "丸剂": 0.80,
                     "口服液": 0.75, "功能性食品": 0.80, "压片糖果": 0.80},
        }

        rates = retention_map.get(enhancer_name, {})
        return rates.get(product_form, 0.80)

    def _predict_retention(
        self, framework: Dict, enhancers: List[Dict]
    ) -> Dict:
        """预测加工过程中的营养保留率"""
        results = {}
        for enhancer in enhancers:
            name = enhancer["enhancer_name"]
            rate = self._get_retention_rate(name, framework)
            results[name] = {
                "retention_rate": rate,
                "added_mg": enhancer["recommended_dosage_mg"],
                "retained_mg": round(enhancer["recommended_dosage_mg"] * rate, 2),
                "process_advice": self._get_process_advice(name, enhancer),
            }
        return results

    def _get_process_advice(self, enhancer_name: str, enhancer: Dict) -> str:
        """获取工艺建议"""
        if enhancer.get("heat_sensitive"):
            return "建议在冷却后添加，避免高温破坏"
        if enhancer.get("light_sensitive"):
            return "建议避光包装，减少光照损失"
        return "常规工艺添加即可"

    def _check_compliance(
        self, enhancers: List[Dict], target_group: str
    ) -> Dict:
        """GB 14880 合规检查"""
        issues = []
        warnings = []

        for enhancer in enhancers:
            name = enhancer["enhancer_name"]
            info = ALLOWED_ENHANCERS.get(name, {})
            max_daily = info.get("max_mg_per_day", float("inf"))
            recommended = enhancer["recommended_dosage_mg"]

            if recommended > max_daily:
                issues.append({
                    "type": "超标",
                    "enhancer": name,
                    "recommended": recommended,
                    "max_allowed": max_daily,
                    "suggestion": f"将{name}用量降至 {max_daily}mg/天以内",
                })
            elif recommended > max_daily * 0.8:
                warnings.append({
                    "type": "接近上限",
                    "enhancer": name,
                    "percentage": round(recommended / max_daily * 100, 1),
                    "suggestion": "注意监控总量，避免超量",
                })

        return {
            "is_compliant": len(issues) == 0,
            "issues": issues,
            "warnings": warnings,
            "checked_enhancers": len(enhancers),
        }

    def _assess_nutrition_balance(
        self, enhancers: List[Dict], gaps: Dict[str, float]
    ) -> Dict:
        """营养均衡评估"""
        if not enhancers:
            return {
                "balance_score": 1.0,
                "status": "无需强化",
                "suggestions": [],
            }

        # 计算均衡度
        sum(gaps.values())
        total_corrected = sum(e["recommended_dosage_mg"] for e in enhancers)

        # 均衡度 = 1 - 变异系数
        if total_corrected > 0:
            mean = total_corrected / len(enhancers)
            variance = sum((e["recommended_dosage_mg"] - mean) ** 2 for e in enhancers) / len(enhancers)
            cv = (variance ** 0.5) / mean if mean > 0 else 0
            balance_score = max(0.5, 1.0 - cv)
        else:
            balance_score = 0.5

        suggestions = []
        if balance_score < 0.7:
            suggestions.append("强化剂用量差异较大，建议调整至更均衡的比例")

        return {
            "balance_score": round(balance_score, 3),
            "status": "均衡" if balance_score >= 0.8 else "需优化",
            "suggestions": suggestions,
        }

    def _build_summary(self, enhancers: List[Dict], compliance: Dict, gaps: Dict[str, float]) -> str:
        """构建输出摘要"""
        if not enhancers:
            return "无需营养强化"

        parts = [f"推荐 {len(enhancers)} 种营养强化剂"]
        if compliance["is_compliant"]:
            parts.append("✅ 合规")
        else:
            parts.append(f"⚠️ {len(compliance['issues'])} 条超标")

        return " | ".join(parts)

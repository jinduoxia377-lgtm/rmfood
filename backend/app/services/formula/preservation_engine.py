"""
防腐保鲜设计引擎 — Step 6（增强版）

参考《中国普通配方设计思路》第六节"防腐保鲜设计"

在现有 StabilityPredictor 基础上，增加：
1. 防腐技术选型推荐器
2. 工艺适配检查
3. 风险预警升级（动态阈值）
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# 防腐保鲜技术选型库
# ═══════════════════════════════════════════════════════════════

PRESERVATION_TECH_MAP: Dict[str, Dict] = {
    "保健饮品": {
        "primary": "巴氏杀菌 + 无菌灌装",
        "secondary": "冷藏储运",
        "max_shelf_life_months": 12,
        "key_params": {"temp": "85-90°C", "time": "15-30min", "fill_temp": "< 40°C"},
        "risk_factors": ["热敏成分损失", "微生物二次污染"],
    },
    "代茶饮": {
        "primary": "热风干燥 + 密封包装",
        "secondary": "充氮包装",
        "max_shelf_life_months": 24,
        "key_params": {"dry_temp": "< 60°C", "moisture": "< 8%"},
        "risk_factors": ["香气挥发", "吸潮变质"],
    },
    "膏方": {
        "primary": "浓缩收膏 + 高糖防腐",
        "secondary": "冷藏",
        "max_shelf_life_months": 18,
        "key_params": {"brix": "> 65°Bx", "moisture": "< 15%"},
        "risk_factors": ["糖结晶", "微生物滋生"],
    },
    "散剂": {
        "primary": "低温干燥 + 防潮包装",
        "secondary": "脱氧剂",
        "max_shelf_life_months": 24,
        "key_params": {"moisture": "< 3%", "particle_size": "< 150μm"},
        "risk_factors": ["吸潮结块", "氧化变质"],
    },
    "丸剂": {
        "primary": "泛丸干燥 + 蜡壳包装",
        "secondary": "密封避光",
        "max_shelf_life_months": 36,
        "key_params": {"moisture": "< 12%"},
        "risk_factors": ["虫蛀", "霉变"],
    },
    "口服液": {
        "primary": "高温灭菌 + 玻璃瓶密封",
        "secondary": "常温储运",
        "max_shelf_life_months": 18,
        "key_params": {"sterilization": "121°C/15min 或 85°C/30min"},
        "risk_factors": ["热敏成分损失", "玻璃瓶破裂"],
    },
    "功能性食品": {
        "primary": "真空包装 + 脱氧剂",
        "secondary": "常温储运",
        "max_shelf_life_months": 18,
        "key_params": {"o2_residual": "< 2%"},
        "risk_factors": ["氧化酸败", "光照褪色"],
    },
    "压片糖果": {
        "primary": "铝塑包装 + 防潮",
        "secondary": "常温储运",
        "max_shelf_life_months": 24,
        "key_params": {"moisture": "< 3%"},
        "risk_factors": ["吸潮软化", "变色"],
    },
}


class PreservationEngine:
    """防腐保鲜设计引擎"""

    def design(
        self,
        framework_result: Dict,
        product_form: str,
        target_shelf_life_months: int = 12,
    ) -> Dict:
        """
        防腐保鲜设计主入口

        Returns:
            {
                "technology_recommendation": {...},
                "shelf_life_prediction": {...},
                "process_advice": [...],
                "risk_warnings": [...]
            }
        """
        # Step 1: 保鲜技术选型
        tech = self._select_preservation_technology(product_form)

        # Step 2: 货架期精确预测
        shelf_life = self._predict_shelf_life(framework_result, tech["type"])

        # Step 3: 工艺适配检查
        process_advice = self._check_process_compatibility(tech, product_form)

        # Step 4: 风险预警
        warnings = self._generate_risk_warnings(framework_result, tech, product_form)

        return {
            "technology_recommendation": tech,
            "shelf_life_prediction": shelf_life,
            "process_advice": process_advice,
            "risk_warnings": warnings,
        }

    def _select_preservation_technology(self, product_form: str) -> Dict:
        """保鲜技术选型"""
        tech = PRESERVATION_TECH_MAP.get(product_form, {
            "primary": "常规干燥 + 密封包装",
            "secondary": "常温储运",
            "max_shelf_life_months": 12,
            "key_params": {},
            "risk_factors": ["需进一步评估"],
            "type": "general",
        })
        tech["type"] = tech.get("type", "general")
        return tech

    def _predict_shelf_life(
        self, framework_result: Dict, tech_type: str
    ) -> Dict:
        """
        货架期精确预测

        集成现有 StabilityPredictor 的结果，结合保鲜技术进行修正
        """
        # 从 framework_result 中获取已有预测
        existing_stability = framework_result.get("stability_prediction", {})

        base_shelf_life = existing_stability.get("predicted_shelf_life_months", 12)
        base_score = existing_stability.get("stability_score", 0.6)

        # 根据保鲜技术修正
        tech_boost = {
            "巴氏杀菌": 1.0,
            "浓缩收膏": 1.2,
            "低温干燥": 1.1,
            "泛丸干燥": 1.3,
            "高温灭菌": 1.0,
            "真空包装": 1.2,
            "general": 1.0,
        }

        boost = tech_boost.get(tech_type, 1.0)
        adjusted_shelf_life = round(base_shelf_life * boost, 1)

        return {
            "base_prediction_months": base_shelf_life,
            "tech_adjustment": boost,
            "adjusted_prediction_months": adjusted_shelf_life,
            "confidence": round(min(0.95, base_score * boost), 2),
            "prediction_method": "StabilityPredictor + 保鲜技术修正",
        }

    def _check_process_compatibility(
        self, tech: Dict, product_form: str
    ) -> List[str]:
        """工艺适配检查"""
        advice = []

        # 检查关键参数的合理性
        params = tech.get("key_params", {})

        if "moisture" in params:
            moisture_val = params["moisture"]
            if "< 3%" in moisture_val or "< 3" in moisture_val:
                advice.append("⚠️ 低水分要求，需确保干燥工艺充分，建议二次干燥验证")
            elif "< 8%" in moisture_val or "< 8" in moisture_val:
                advice.append("合理的水分控制范围，常规干燥工艺可满足")

        if "temp" in params or "dry_temp" in params:
            temp_val = params.get("temp") or params.get("dry_temp", "")
            if "60" in temp_val or "85" in temp_val or "90" in temp_val:
                advice.append("高温工艺可能影响热敏活性成分，建议评估功效保留率")

        # 通用建议
        advice.append("建议进行加速保质期试验（40°C/75%RH，3个月）验证预测准确性")

        return advice

    def _generate_risk_warnings(
        self, framework_result: Dict, tech: Dict, product_form: str
    ) -> List[Dict]:
        """风险预警生成"""
        warnings = []

        # 基于技术类型的固有风险
        risk_factors = tech.get("risk_factors", [])
        for factor in risk_factors:
            warnings.append({
                "level": "warning",
                "factor": factor,
                "mitigation": self._get_mitigation(factor, product_form),
            })

        # 基于药材的特殊风险
        herbs = framework_result.get("herbs", [])
        for herb in herbs:
            hid = herb.get("id", "")
            # 光敏药材
            if hid in {"cyh", "jgh", "gz"}:
                warnings.append({
                    "level": "info",
                    "factor": f"{herb.get('name', hid)} 具光敏性",
                    "mitigation": "建议避光包装（棕色瓶/铝箔袋）",
                })
            # 易氧化药材
            if hid in {"dg", "cs", "sz"}:
                warnings.append({
                    "level": "info",
                    "factor": f"{herb.get('name', hid)} 含易氧化成分",
                    "mitigation": "建议添加抗氧化剂或充氮包装",
                })

        return warnings

    def _get_mitigation(self, factor: str, product_form: str) -> str:
        """获取风险缓解措施"""
        mitigations = {
            "热敏成分损失": "降低加工温度或缩短加热时间",
            "微生物二次污染": "加强灌装环节无菌操作",
            "香气挥发": "采用低温工艺或密封包装",
            "吸潮变质": "使用防潮包装材料",
            "糖结晶": "控制收膏温度和搅拌速度",
            "吸潮结块": "添加抗结剂（如二氧化硅）",
            "氧化酸败": "添加抗氧化剂或充氮包装",
            "光照褪色": "使用避光包装",
        }
        return mitigations.get(factor, "咨询食品工程师")

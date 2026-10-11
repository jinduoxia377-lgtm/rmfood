"""
稳定性预测模型
预测配方在储存条件下的稳定性
考虑：pH、温度、光照、成分相互作用
"""

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
import math
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


# ==================== 稳定性数据库 ====================

STABILITY_DATABASE: Dict[str, Dict[str, Any]] = {
    # 肽类稳定性
    "大豆肽": {
        "ph_stability": {"min": 3.0, "max": 8.0, "optimal": (5.5, 7.0)},
        "temp_stability": {"max_temp_c": 60, "degradation_rate_25c": 0.001},
        "light_sensitivity": "low",
        "oxidation_sensitivity": "medium",
        "shelf_life_months": 24
    },
    "胶原蛋白肽": {
        "ph_stability": {"min": 4.0, "max": 7.5, "optimal": (5.5, 6.5)},
        "temp_stability": {"max_temp_c": 50, "degradation_rate_25c": 0.0008},
        "light_sensitivity": "low",
        "oxidation_sensitivity": "low",
        "shelf_life_months": 36
    },
    "乳清蛋白肽": {
        "ph_stability": {"min": 4.5, "max": 7.0, "optimal": (6.0, 6.5)},
        "temp_stability": {"max_temp_c": 45, "degradation_rate_25c": 0.0012},
        "light_sensitivity": "medium",
        "oxidation_sensitivity": "medium",
        "shelf_life_months": 18
    },
    "鱼胶原蛋白肽": {
        "ph_stability": {"min": 4.0, "max": 7.0, "optimal": (5.0, 6.0)},
        "temp_stability": {"max_temp_c": 40, "degradation_rate_25c": 0.0015},
        "light_sensitivity": "high",
        "oxidation_sensitivity": "high",
        "shelf_life_months": 12
    },
    
    # 多糖类稳定性
    "黄芪多糖": {
        "ph_stability": {"min": 4.0, "max": 9.0, "optimal": (5.0, 8.0)},
        "temp_stability": {"max_temp_c": 80, "degradation_rate_25c": 0.0003},
        "light_sensitivity": "low",
        "oxidation_sensitivity": "low",
        "shelf_life_months": 36
    },
    "枸杞多糖": {
        "ph_stability": {"min": 4.0, "max": 8.5, "optimal": (5.0, 7.5)},
        "temp_stability": {"max_temp_c": 70, "degradation_rate_25c": 0.0005},
        "light_sensitivity": "medium",
        "oxidation_sensitivity": "medium",
        "shelf_life_months": 24
    },
    "灵芝多糖": {
        "ph_stability": {"min": 4.0, "max": 8.0, "optimal": (5.5, 7.0)},
        "temp_stability": {"max_temp_c": 75, "degradation_rate_25c": 0.0004},
        "light_sensitivity": "medium",
        "oxidation_sensitivity": "low",
        "shelf_life_months": 30
    },
    "茯苓多糖": {
        "ph_stability": {"min": 4.5, "max": 8.5, "optimal": (5.5, 7.5)},
        "temp_stability": {"max_temp_c": 70, "degradation_rate_25c": 0.0004},
        "light_sensitivity": "low",
        "oxidation_sensitivity": "low",
        "shelf_life_months": 36
    },
    
    # 皂苷类稳定性
    "人参皂苷": {
        "ph_stability": {"min": 4.0, "max": 7.0, "optimal": (5.0, 6.0)},
        "temp_stability": {"max_temp_c": 60, "degradation_rate_25c": 0.002},
        "light_sensitivity": "high",
        "oxidation_sensitivity": "high",
        "shelf_life_months": 18
    },
    "人参皂苷Rg1": {
        "ph_stability": {"min": 4.0, "max": 6.5, "optimal": (5.0, 6.0)},
        "temp_stability": {"max_temp_c": 50, "degradation_rate_25c": 0.0025},
        "light_sensitivity": "high",
        "oxidation_sensitivity": "high",
        "shelf_life_months": 12
    },
    "黄芪甲苷": {
        "ph_stability": {"min": 4.0, "max": 7.0, "optimal": (5.0, 6.5)},
        "temp_stability": {"max_temp_c": 55, "degradation_rate_25c": 0.0018},
        "light_sensitivity": "medium",
        "oxidation_sensitivity": "medium",
        "shelf_life_months": 18
    },
    
    # 黄酮类稳定性
    "大豆异黄酮": {
        "ph_stability": {"min": 3.0, "max": 8.0, "optimal": (4.0, 6.0)},
        "temp_stability": {"max_temp_c": 60, "degradation_rate_25c": 0.001},
        "light_sensitivity": "high",
        "oxidation_sensitivity": "medium",
        "shelf_life_months": 24
    },
    "槲皮素": {
        "ph_stability": {"min": 3.0, "max": 7.0, "optimal": (4.0, 6.0)},
        "temp_stability": {"max_temp_c": 50, "degradation_rate_25c": 0.002},
        "light_sensitivity": "high",
        "oxidation_sensitivity": "high",
        "shelf_life_months": 12
    },
    "葛根素": {
        "ph_stability": {"min": 3.5, "max": 7.5, "optimal": (4.5, 6.5)},
        "temp_stability": {"max_temp_c": 55, "degradation_rate_25c": 0.0015},
        "light_sensitivity": "medium",
        "oxidation_sensitivity": "medium",
        "shelf_life_months": 18
    },
    
    # 维生素稳定性
    "维生素C": {
        "ph_stability": {"min": 2.5, "max": 6.0, "optimal": (3.0, 5.0)},
        "temp_stability": {"max_temp_c": 40, "degradation_rate_25c": 0.005},
        "light_sensitivity": "high",
        "oxidation_sensitivity": "high",
        "shelf_life_months": 12
    },
    "维生素E": {
        "ph_stability": {"min": 4.0, "max": 8.0, "optimal": (5.5, 7.0)},
        "temp_stability": {"max_temp_c": 60, "degradation_rate_25c": 0.001},
        "light_sensitivity": "medium",
        "oxidation_sensitivity": "high",
        "shelf_life_months": 24
    },
    
    # 其他
    "姜黄素": {
        "ph_stability": {"min": 5.0, "max": 8.0, "optimal": (6.0, 7.0)},
        "temp_stability": {"max_temp_c": 50, "degradation_rate_25c": 0.003},
        "light_sensitivity": "high",
        "oxidation_sensitivity": "high",
        "shelf_life_months": 12
    },
    "褪黑素": {
        "ph_stability": {"min": 4.0, "max": 8.0, "optimal": (5.5, 7.0)},
        "temp_stability": {"max_temp_c": 40, "degradation_rate_25c": 0.002},
        "light_sensitivity": "high",
        "oxidation_sensitivity": "medium",
        "shelf_life_months": 18
    },
}

# 成分相互作用稳定性影响
STABILITY_INTERACTIONS: Dict[Tuple[str, str], Dict[str, float]] = {
    ("维生素C", "铜离子"): {"oxidation_acceleration": 2.0, "description": "VC加速铜离子氧化"},
    ("维生素C", "铁离子"): {"oxidation_acceleration": 1.5, "description": "VC促进铁离子氧化"},
    ("人参皂苷", "光"): {"light_degradation": 1.8, "description": "光照加速皂苷降解"},
    ("姜黄素", "光"): {"light_degradation": 2.0, "description": "光照显著降解姜黄素"},
    ("维生素C", "维生素E"): {"synergistic_protection": 0.7, "description": "VC与VE协同抗氧化"},
}


@dataclass
class StabilityPrediction:
    """稳定性预测结果"""
    predicted_shelf_life_months: float
    degradation_rate_per_month: float
    risk_factors: List[Dict[str, Any]] = field(default_factory=list)
    storage_recommendations: List[str] = field(default_factory=list)
    confidence: float = 0.0
    
    @property
    def stability_score(self) -> float:
        """稳定性评分 (0-100)"""
        # 基于预测货架期和降解率计算
        shelf_life_score = min(100, self.predicted_shelf_life_months / 12 * 50)
        degradation_score = max(0, 100 - self.degradation_rate_per_month * 1000)
        risk_penalty = sum(r.get("severity", 0) for r in self.risk_factors) * 5
        
        return max(0, min(100, shelf_life_score + degradation_score - risk_penalty))


class StabilityPredictor:
    """
    稳定性预测模型
    
    功能:
    1. 预测配方货架期
    2. 识别稳定性风险因素
    3. 提供储存建议
    4. 计算稳定性评分
    """
    
    def __init__(self):
        self._stability_db = STABILITY_DATABASE
        self._interactions = STABILITY_INTERACTIONS
        logger.info("StabilityPredictor 初始化完成")
    
    def predict_stability(
        self,
        ingredients: List[Dict[str, Any]],
        storage_conditions: Optional[Dict[str, Any]] = None,
        db_entries: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> StabilityPrediction:
        """
        预测配方稳定性

        Args:
            ingredients: [{"name": str, "percentage": float}, ...]
            storage_conditions: {"temperature_c": 25, "humidity_pct": 60, "light_exposure": "dark"}
            db_entries: 可选，数据库真实稳定性参数（stability_data 表），
                键为成分名，值为稳定性条目结构，将覆盖内置默认库。

        Returns:
            StabilityPrediction: 预测结果
        """
        storage = storage_conditions or {"temperature_c": 25, "humidity_pct": 60, "light_exposure": "normal"}
        # 合并数据库真实条目（若提供）
        stab_db = dict(self._stability_db)
        if db_entries:
            stab_db.update(db_entries)
        
        risk_factors = []
        total_degradation = 0.0
        min_shelf_life = 999999.0  # 用大数替代 Infinity，避免 JSONB 序列化错误
        known_count = 0

        for ing in ingredients:
            name = ing.get("name", "")
            percentage = ing.get("percentage", 0)

            if name not in stab_db:
                # 别名回退：药材 → 活性成分（复用安全阈值别名映射）
                resolved = name
                try:
                    from .safety_alert_system.thresholds import HERB_ALIAS_MAP
                    resolved = HERB_ALIAS_MAP.get(name, name)
                except Exception:
                    pass
                if resolved in stab_db:
                    name = resolved
                else:
                    risk_factors.append({
                        "type": "unknown_ingredient",
                        "severity": 0.3,
                        "description": f"未知成分: {name}，使用默认稳定性参数"
                    })
                    total_degradation += 0.001 * percentage
                    continue

            known_count += 1
            stab = stab_db[name]
            
            # 计算pH影响
            ph_risk = self._calculate_ph_risk(stab, storage)
            if ph_risk > 0:
                risk_factors.append({
                    "type": "ph_risk",
                    "severity": ph_risk,
                    "description": f"{name} 对pH敏感"
                })
            
            # 计算温度影响
            temp_risk = self._calculate_temp_risk(stab, storage)
            total_degradation += stab["temp_stability"]["degradation_rate_25c"] * percentage * temp_risk
            
            # 计算光敏风险
            if stab["light_sensitivity"] == "high" and storage.get("light_exposure") != "dark":
                risk_factors.append({
                    "type": "light_sensitivity",
                    "severity": 0.4,
                    "description": f"{name} 对光照敏感，建议避光保存"
                })
            
            # 计算氧化风险
            if stab["oxidation_sensitivity"] == "high":
                risk_factors.append({
                    "type": "oxidation",
                    "severity": 0.3,
                    "description": f"{name} 易氧化，建议添加抗氧化剂"
                })
            
            # 更新最小货架期
            adjusted_shelf_life = stab["shelf_life_months"] / (1 + temp_risk * 0.5)
            min_shelf_life = min(min_shelf_life, adjusted_shelf_life)
        
        # 检查成分相互作用
        interaction_risks = self._check_interactions(ingredients)
        risk_factors.extend(interaction_risks)
        
        # 计算最终预测
        # 若数据库无任何已知成分 → 使用保守默认货架期（24 个月），
        # 避免 999999 占位值泄漏给用户；同时所有结果封顶 120 个月。
        if known_count == 0:
            min_shelf_life = 24.0
            risk_factors.append({
                "type": "data_insufficient",
                "severity": 0.2,
                "description": "成分稳定性数据库未覆盖，货架期采用保守默认值（24 个月）"
            })
        predicted_shelf_life = max(3, min_shelf_life - sum(r["severity"] for r in risk_factors) * 2)
        predicted_shelf_life = min(predicted_shelf_life, 120.0)
        degradation_rate = total_degradation / max(1, sum(i.get("percentage", 0) for i in ingredients))
        
        # 生成储存建议
        recommendations = self._generate_recommendations(risk_factors, storage)
        
        return StabilityPrediction(
            predicted_shelf_life_months=round(predicted_shelf_life, 1),
            degradation_rate_per_month=round(degradation_rate, 6),
            risk_factors=risk_factors,
            storage_recommendations=recommendations,
            confidence=max(0.3, 1.0 - len(risk_factors) * 0.1)
        )
    
    def _calculate_ph_risk(self, stability: Dict, storage: Dict) -> float:
        """计算pH风险"""
        ph_range = stability.get("ph_stability", {})
        optimal = ph_range.get("optimal", (5, 7))
        # 简化：假设配方pH在6-7之间
        return 0.2  # 默认中等风险
    
    def _calculate_temp_risk(self, stability: Dict, storage: Dict) -> float:
        """计算温度风险"""
        max_temp = stability.get("temp_stability", {}).get("max_temp_c", 60)
        storage_temp = storage.get("temperature_c", 25)
        
        if storage_temp > max_temp:
            return (storage_temp - max_temp) / 10 + 1.0
        elif storage_temp > 30:
            return (storage_temp - 25) / 35
        return 0.0
    
    def _check_interactions(self, ingredients: List[Dict]) -> List[Dict]:
        """检查成分相互作用"""
        risks = []
        names = [ing.get("name", "") for ing in ingredients]
        
        for (ing1, ing2), effect in self._interactions.items():
            if ing1 in names and ing2 in names:
                risks.append({
                    "type": "interaction",
                    "severity": effect.get("oxidation_acceleration", 0.3),
                    "description": effect.get("description", "成分相互作用")
                })
        
        return risks
    
    def _generate_recommendations(
        self,
        risk_factors: List[Dict],
        storage: Dict
    ) -> List[str]:
        """生成储存建议"""
        recommendations = []
        
        has_light_risk = any(r["type"] == "light_sensitivity" for r in risk_factors)
        has_oxidation_risk = any(r["type"] == "oxidation" for r in risk_factors)
        
        if has_light_risk:
            recommendations.append("建议避光保存，使用棕色瓶或铝箔包装")
        
        if has_oxidation_risk:
            recommendations.append("建议添加抗氧化剂（如维生素E）")
        
        if storage.get("temperature_c", 25) > 25:
            recommendations.append("建议低温储存（<25°C）")
        
        if storage.get("humidity_pct", 60) > 60:
            recommendations.append("建议控制湿度（<60%RH）")
        
        if not recommendations:
            recommendations.append("常温干燥保存即可")
        
        return recommendations
    
    def compare_formulas(
        self,
        formulas: Dict[str, List[Dict[str, Any]]],
        storage_conditions: Optional[Dict[str, Any]] = None
    ) -> Dict[str, StabilityPrediction]:
        """
        多配方稳定性对比
        
        Args:
            formulas: {"配方名": [成分列表], ...}
            storage_conditions: 储存条件
            
        Returns:
            各配方预测结果
        """
        results = {}
        for name, ingredients in formulas.items():
            results[name] = self.predict_stability(ingredients, storage_conditions)
        
        # 排序
        sorted_results = sorted(
            results.items(),
            key=lambda x: x[1].stability_score,
            reverse=True
        )
        
        return {name: pred for name, pred in sorted_results}


if __name__ == "__main__":
    predictor = StabilityPredictor()
    
    # 测试配方
    formula_a = [
        {"name": "黄芪多糖", "percentage": 30},
        {"name": "大豆肽", "percentage": 25},
        {"name": "枸杞", "percentage": 20},
        {"name": "维生素C", "percentage": 10},
        {"name": "维生素E", "percentage": 5},
        {"name": "甘草", "percentage": 10},
    ]
    
    formula_b = [
        {"name": "人参皂苷", "percentage": 20},
        {"name": "姜黄素", "percentage": 15},
        {"name": "胶原蛋白肽", "percentage": 30},
        {"name": "枸杞多糖", "percentage": 25},
        {"name": "褪黑素", "percentage": 10},
    ]
    
    results = predictor.compare_formulas({
        "配方A": formula_a,
        "配方B": formula_b
    })
    
    print("=== 稳定性预测对比 ===")
    for name, pred in results.items():
        print(f"\n{name}:")
        print(f"  预测货架期: {pred.predicted_shelf_life_months} 月")
        print(f"  稳定性评分: {pred.stability_score:.1f}")
        print(f"  风险因素: {len(pred.risk_factors)} 项")
        print(f"  储存建议: {pred.storage_recommendations}")

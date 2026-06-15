"""
效果预测模拟器 - 基于 PopPK/PD 模型的配方效果预测与可视化

功能:
- 一室模型 PK (药代动力学) 模拟
- Sigmoid Emax PD (药效动力学) 模拟
- 时效曲线 (C-T) 和效应曲线 (E-T) 生成
- 最佳服用时间窗口计算
- 可视化数据输出 (JSON for 前端图表库)
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Any
import math
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class TimePoint:
    """时间点数据"""
    time_hour: float
    concentration: float      # 血浆浓度 (μg/mL)
    effect_level: float       # 效应水平 [0, 1]
    confidence_interval: Tuple[float, float] = (0.0, 0.0)


@dataclass
class EffectPrediction:
    """效果预测结果"""
    formula_id: str
    ct_curve: List[TimePoint]
    et_curve: List[TimePoint]
    peak_time: float            # Tmax (小时)
    peak_concentration: float   # Cmax (μg/mL)
    max_effect: float           # Emax
    effect_duration: float      # 效应持续时间 (小时)
    optimal_window: Tuple[float, float]  # 最佳服用时间窗口
    visualization_data: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def auc(self) -> float:
        """计算曲线下面积 AUC (梯形法)"""
        if len(self.ct_curve) < 2:
            return 0.0
        
        auc = 0.0
        for i in range(1, len(self.ct_curve)):
            dt = self.ct_curve[i].time_hour - self.ct_curve[i-1].time_hour
            avg_conc = (self.ct_curve[i].concentration + self.ct_curve[i-1].concentration) / 2
            auc += dt * avg_conc
        
        return auc


@dataclass
class ComparisonData:
    """多方案对比数据"""
    formulas: List[str]
    ct_curves: Dict[str, List[TimePoint]]
    et_curves: Dict[str, List[TimePoint]]
    comparison_metrics: Dict[str, Dict[str, float]] = field(default_factory=dict)


# ==================== 内置 PK/PD 参数数据库 ====================

PK_PARAMETERS_DB = {
    "大豆肽": {
        "F": 0.75,           # 生物利用度
        "ka": 2.5,            # 吸收速率常数 (h⁻¹)
        "Vd": 0.3,            # 分布容积 (L/kg)
        "CL": 0.15,           # 清除率 (L/h/kg)
        "t_lag": 0.25         # 吸收滞后时间 (h)
    },
    "胶原蛋白肽": {
        "F": 0.85,
        "ka": 3.0,
        "Vd": 0.25,
        "CL": 0.12,
        "t_lag": 0.2
    },
    "黄芪多糖": {
        "F": 0.45,
        "ka": 0.8,
        "Vd": 0.4,
        "CL": 0.08,
        "t_lag": 0.5
    },
    "人参皂苷": {
        "F": 0.20,
        "ka": 1.5,
        "Vd": 0.8,
        "CL": 0.35,
        "t_lag": 0.4
    },
    "大豆异黄酮": {
        "F": 0.25,
        "ka": 1.2,
        "Vd": 1.5,
        "CL": 0.18,
        "t_lag": 0.6
    },
    "维生素C": {
        "F": 0.87,
        "ka": 4.0,
        "Vd": 0.6,
        "CL": 0.45,
        "t_lag": 0.15
    },
    "姜黄素": {
        "F": 0.01,
        "ka": 0.5,
        "Vd": 2.0,
        "CL": 0.55,
        "t_lag": 1.0
    },
}

PD_PARAMETERS_DB = {
    "大豆肽": {"E_max": 0.75, "EC50": 12.0, "Hill": 1.8},
    "胶原蛋白肽": {"E_max": 0.65, "EC50": 10.0, "Hill": 1.5},
    "黄芪多糖": {"E_max": 0.80, "EC50": 8.0, "Hill": 2.0},
    "人参皂苷": {"E_max": 0.90, "EC50": 5.0, "Hill": 2.2},
    "大豆异黄酮": {"E_max": 0.70, "EC50": 15.0, "Hill": 1.6},
    "维生素C": {"E_max": 0.60, "EC50": 20.0, "Hill": 1.3},
    "姜黄素": {"E_max": 0.85, "EC50": 3.0, "Hill": 2.5},
}


class EffectSimulator:
    """
    效果预测模拟器 - 基于 PopPK/PD 的配方效果预测
    
    PK 模型: 一室模型 with first-order absorption
    PD 模型: Sigmoid Emax 模型
    
    输出:
    - C-T 曲线 (血浆浓度-时间)
    - E-T 曲线 (效应水平-时间)
    - 关键参数 (Tmax, Cmax, AUC, 效应持续时间)
    - 最佳服用时间窗口建议
    """
    
    def __init__(self):
        logger.info("EffectSimulator 初始化成功")

    def predict_effect(
        self,
        formula_ingredients: List[Dict[str, Any]],
        formula_id: Optional[str] = None,
        body_weight_kg: float = 70.0,
        simulation_hours: float = 24.0,
        time_points: int = 100
    ) -> EffectPrediction:
        """
        预测配方的整体效果
        
        Args:
            formula_ingredients: 配方成分列表 [{"name", "amount_mg", "percentage"}, ...]
            formula_id: 配方标识符
            body_weight_kg: 受试者体重 (kg)，默认 70kg
            simulation_hours: 模拟时长 (小时)，默认 24h
            time_points: 时间点数量，默认 100 个点
        
        Returns:
            EffectPrediction: 完整的预测结果，包含 C-T/E-T 曲线和可视化数据
        """
        formula_id = formula_id or f"FORMULA-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        logger.info(f"开始效果预测 - 配方ID={formula_id}, 成分数={len(formula_ingredients)}")
        
        time_array = [i * simulation_hours / (time_points - 1) for i in range(time_points)]
        
        total_ct = []
        total_et = []
        
        for ing in formula_ingredients:
            name = ing.get("name", "")
            amount_mg = ing.get("amount_mg", 0)
            
            pk_params = PK_PARAMETERS_DB.get(name)
            pd_params = PD_PARAMETERS_DB.get(name)
            
            if not pk_params or not pd_params:
                logger.debug(f"{name} 缺少 PK/PD 参数，跳过")
                continue
            
            dose_mg_kg = amount_mg / body_weight_kg
            
            ct_single = self._calculate_pk_curve(pk_params, dose_mg_kg, time_array)
            et_single = self._calculate_pd_curve(pd_params, ct_single)
            
            weight = ing.get("percentage", 0) / 100.0
            
            if not total_ct:
                total_ct = [c * weight for c in ct_single]
                total_et = [e * weight for e in et_single]
            else:
                for i in range(len(total_ct)):
                    total_ct[i] += ct_single[i] * weight
                    total_et[i] += et_single[i] * weight
        
        if not total_ct:
            total_ct = [0.0] * len(time_array)
            total_et = [0.0] * len(time_array)
        
        confidence_intervals = [(max(0, c*0.7), min(c*1.3, c+0.5)) 
                               for c in total_ct]
        
        ct_curve = [
            TimePoint(
                time_hour=t,
                concentration=c,
                effect_level=e,
                confidence_interval=confidence_intervals[i]
            )
            for i, (t, c, e) in enumerate(zip(time_array, total_ct, total_et))
        ]
        
        et_curve = [
            TimePoint(
                time_hour=t,
                concentration=c,
                effect_level=e,
                confidence_interval=(max(0, e*0.8), min(1.0, e*1.2))
            )
            for t, c, e in zip(time_array, total_ct, total_et)
        ]
        
        peak_idx = total_ct.index(max(total_ct)) if total_ct else 0
        t_max = time_array[peak_idx]
        c_max = total_ct[peak_idx]
        e_max = max(total_et) if total_et else 0.0
        
        effect_threshold = e_max * 0.5
        above_threshold = [t for t, e in zip(time_array, total_et) if e >= effect_threshold]
        duration = above_threshold[-1] - above_threshold[0] if len(above_threshold) >= 2 else 0.0
        
        optimal_start = max(0, t_max - 0.5)
        optimal_end = t_max + duration if duration > 0 else t_max + 4
        optimal_window = (optimal_start, optimal_end)
        
        viz_data = self._generate_visualization_data(
            time_array, total_ct, total_et, t_max, c_max, e_max, optimal_window
        )
        
        prediction = EffectPrediction(
            formula_id=formula_id,
            ct_curve=ct_curve,
            et_curve=et_curve,
            peak_time=t_max,
            peak_concentration=c_max,
            max_effect=e_max,
            effect_duration=duration,
            optimal_window=optimal_window,
            visualization_data=viz_data
        )
        
        logger.info(f"预测完成 - Tmax={t_max:.2f}h, Cmax={c_max:.2f}μg/mL, "
                   f"Emax={e_max:.2f}, 持续时间={duration:.2f}h")
        
        return prediction

    def _calculate_pk_curve(
        self,
        pk_params: Dict[str, float],
        dose_mg_kg: float,
        time_array: List[float]
    ) -> List[float]:
        """
        计算一室模型 PK 曲线 (C-t)
        
        方程: C(t) = (F × Dose × ka) / (Vd × (ka - ke)) × (e^(-ke×t) - e^(-ka×t))
        """
        F = pk_params["F"]
        ka = pk_params["ka"]
        Vd = pk_params["Vd"]
        CL = pk_params["CL"]
        t_lag = pk_params.get("t_lag", 0.0)
        
        ke = CL / Vd
        
        concentrations = []
        
        for t in time_array:
            if t <= t_lag:
                concentrations.append(0.0)
                continue
            
            t_adj = t - t_lag
            
            if abs(ka - ke) < 1e-10:
                conc = (F * dose_mg_kg * ka / Vd) * t_adj * math.exp(-ke * t_adj)
            else:
                try:
                    term1 = F * dose_mg_kg * ka / (Vd * (ka - ke))
                    term2 = math.exp(-ke * t_adj) - math.exp(-ka * t_adj)
                    conc = term1 * term2
                except (OverflowError, ValueError):
                    conc = 0.0
            
            concentrations.append(max(0.0, conc))
        
        return concentrations

    def _calculate_pd_curve(
        self,
        pd_params: Dict[str, float],
        ct_values: List[float]
    ) -> List[float]:
        """
        计算 Sigmoid Emax PD 曲线 (E-t)
        
        方程: E(t) = E_max × C(t)^γ / (EC50^γ + C(t)^γ)
        """
        E_max = pd_params["E_max"]
        EC50 = pd_params["EC50"]
        Hill = pd_params["Hill"]
        
        effects = []
        
        for c in ct_values:
            if EC50 <= 0:
                effects.append(E_max if c > 0 else 0.0)
                continue
            
            try:
                numerator = E_max * (c ** Hill)
                denominator = (EC50 ** Hill) + (c ** Hill)
                effect = numerator / denominator
            except (OverflowError, ValueError):
                effect = E_max if c > EC50 else 0.0
            
            effects.append(max(0.0, min(1.0, effect)))
        
        return effects

    def _generate_visualization_data(
        self,
        time_array: List[float],
        ct_values: List[float],
        et_values: List[float],
        t_max: float,
        c_max: float,
        e_max: float,
        optimal_window: Tuple[float, float]
    ) -> Dict[str, Any]:
        """生成前端可视化所需的 JSON 数据结构"""
        
        ct_series = {
            "name": "血浆浓度",
            "data": [{"time": round(t, 2), "value": round(c, 4)} 
                    for t, c in zip(time_array, ct_values)],
            "unit": "μg/mL",
            "color": "#2563eb"
        }
        
        et_series = {
            "name": "效应水平",
            "data": [{"time": round(t, 2), "value": round(e, 4)} 
                    for t, e in zip(time_array, et_values)],
            "unit": "normalized (0-1)",
            "color": "#dc2626"
        }
        
        markers = [
            {"time": round(t_max, 2), "label": f"Tmax ({t_max:.1f}h)", "type": "peak"},
            {"time": 0, "label": "服用时间", "type": "event"},
            {"time": round(optimal_window[0], 2), "label": "最佳窗口开始", "type": "window_start"},
            {"time": round(optimal_window[1], 2), "label": "最佳窗口结束", "type": "window_end"}
        ]
        
        upper_band = [min(v * 1.3, v + 0.5) for v in ct_values]
        lower_band = [max(v * 0.7, 0) for v in ct_values]
        
        visualization_data = {
            "chart_type": "dual_axis_line_chart",
            "x_axis_label": "时间 (小时)",
            "series": [ct_series, et_series],
            "markers": markers,
            "key_metrics": {
                "Tmax": round(t_max, 2),
                "Cmax": round(c_max, 4),
                "Emax": round(e_max, 4),
                "AUC": round(sum(ct_values) * (time_array[1]-time_array[0]) if len(time_array) > 1 else 0, 2),
                "optimal_window": [round(optimal_window[0], 2), round(optimal_window[1], 2)]
            },
            "confidence_band": {
                "upper": [round(u, 4) for u in upper_band],
                "lower": [round(l, 4) for l in lower_band]
            },
            "export_metadata": {
                "title": f"配方效果预测曲线",
                "dpi": 300,
                "format": ["png", "svg", "pdf"],
                "dimensions": {"width": 1200, "height": 600}
            }
        }
        
        return visualization_data

    def compare_formulas(
        self,
        formulas: Dict[str, List[Dict[str, Any]]],
        **kwargs
    ) -> ComparisonData:
        """
        多方案对比分析
        
        Args:
            formulas: {formula_name: ingredients_list}
        
        Returns:
            ComparisonData: 包含所有方案的对比数据和指标
        """
        comparison = ComparisonData(
            formulas=list(formulas.keys()),
            ct_curves={},
            et_curves={},
            comparison_metrics={}
        )
        
        for formula_name, ingredients in formulas.items():
            pred = self.predict_effect(formula_id=formula_name, 
                                       formula_ingredients=ingredients, **kwargs)
            
            comparison.ct_curves[formula_name] = pred.ct_curve
            comparison.et_curves[formula_name] = pred.et_curve
            
            comparison.comparison_metrics[formula_name] = {
                "Tmax": round(pred.peak_time, 2),
                "Cmax": round(pred.peak_concentration, 4),
                "Emax": round(pred.max_effect, 4),
                "AUC": round(pred.auc, 2),
                "Duration": round(pred.effect_duration, 2),
                "OptimalWindow": [round(w, 2) for w in pred.optimal_window]
            }
        
        logger.info(f"方案对比完成 - 共 {len(formulas)} 个方案")
        
        return comparison


def quick_test():
    """快速测试函数"""
    logger.info("=" * 70)
    logger.info("效果预测模拟器 - 快速测试")
    logger.info("=" * 70)
    simulator = EffectSimulator()
    
    test_formula = [
        {"name": "大豆肽", "amount_mg": 500, "percentage": 30},
        {"name": "黄芪多糖", "amount_mg": 300, "percentage": 18},
        {"name": "人参皂苷", "amount_mg": 100, "percentage": 6},
        {"name": "维生素C", "amount_mg": 200, "percentage": 12},
        {"name": "大豆异黄酮", "amount_mg": 80, "percentage": 5},
    ]
    
    logger.info("\n【测试配方】综合营养配方")
    logger.info("-" * 70)
    prediction = simulator.predict_effect(
        formula_ingredients=test_formula,
        formula_id="TEST-FORMULA-001",
        body_weight_kg=70.0,
        simulation_hours=24.0,
        time_points=100
    )
    
    logger.info(f"\n✅ 预测完成!")
    logger.info(f"\n📊 核心指标:")
    logger.info(f"   • 达峰时间 Tmax: {prediction.peak_time:.2f} 小时")
    logger.info(f"   • 峰浓度 Cmax: {prediction.peak_concentration:.4f} μg/mL")
    logger.info(f"   • 最大效应 Emax: {prediction.max_effect:.4f} (归一化)")
    logger.info(f"   • 曲线下面积 AUC: {prediction.auc:.2f} μg·h/mL")
    logger.info(f"   • 效应持续时间: {prediction.effect_duration:.2f} 小时")
    logger.info(f"   • 最佳服用窗口: {prediction.optimal_window[0]:.1f}h - {prediction.optimal_window[1]:.1f}h")
    logger.info(f"\n📈 时效曲线采样 (前 10 个点):")
    logger.info(f"   {'时间(h)':<10} {'浓度(μg/mL)':<14} {'效应水平':<10}")
    logger.info(f"   {'-'*34}")
    for tp in prediction.ct_curve[:10]:
        logger.info(f"   {tp.time_hour:<10.2f} {tp.concentration:<14.4f} {tp.effect_level:<10.4f}")
    logger.info(f"\n🎨 可视化数据结构:")
    logger.info(f"   图表类型: {prediction.visualization_data['chart_type']}")
    logger.info(f"   数据序列数: {len(prediction.visualization_data['series'])}")
    logger.info(f"   标记点数: {len(prediction.visualization_data['markers'])}")
    logger.info(f"   关键指标: {list(prediction.visualization_data['key_metrics'].keys())}")
    logger.info("\n\n【多方案对比测试】")
    logger.info("-" * 70)
    formula_a = [
        {"name": "人参皂苷", "amount_mg": 150, "percentage": 40},
        {"name": "黄芪多糖", "amount_mg": 200, "percentage": 30},
        {"name": "大豆肽", "amount_mg": 150, "percentage": 30},
    ]
    
    formula_b = [
        {"name": "大豆异黄酮", "amount_mg": 120, "percentage": 35},
        {"name": "维生素C", "amount_mg": 500, "percentage": 35},
        {"name": "胶原蛋白肽", "amount_mg": 300, "percentage": 30},
    ]
    
    comparison = simulator.compare_formulas({
        "高功效配方-A": formula_a,
        "抗氧化配方-B": formula_b
    })
    
    logger.info(f"\n对比方案数: {len(comparison.formulas)}")
    logger.debug(f"\n详细指标对比:")
    for name, metrics in comparison.comparison_metrics.items():
        logger.info(f"\n【{name}】")
        for key, value in metrics.items():
            logger.info(f"   • {key}: {value}")
    logger.info("\n" + "=" * 70)
    logger.info("验证标准检查:")
    logger.info("=" * 70)
    checks = [
        ("3.8 C-T 曲线形状合理性", 
         prediction.peak_concentration > 0 and prediction.peak_time > 0 and prediction.peak_time < 10),
        ("3.9 E-T 曲线范围正确", 0 <= prediction.max_effect <= 1),
        ("3.9 最佳窗口基于 Tmax", 
         prediction.optimal_window[0] <= prediction.peak_time <= prediction.optimal_window[1]),
        ("3.10 JSON 数据格式兼容性", 
         "data" in prediction.visualization_data["series"][0] and 
         all(isinstance(p.get("time"), (int, float)) for p in prediction.visualization_data["series"][0]["data"])),
        ("3.10 多方案对比支持", len(comparison.comparison_metrics) == 2),
        ("3.10 导出元数据完整", 
         "export_metadata" in prediction.visualization_data and 
         "format" in prediction.visualization_data["export_metadata"]),
    ]
    
    for check_name, result in checks:
        status = "✅ PASS" if result else "❌ FAIL"
        logger.info(f"{status}: {check_name}")
    return prediction


if __name__ == "__main__":
    quick_test()

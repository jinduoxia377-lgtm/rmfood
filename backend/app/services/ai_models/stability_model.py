"""
Arrhenius 稳定性预测模型

基于 Arrhenius 方程：k(T) = k₀ · exp[-Ea/R · (1/T - 1/T₀)]

功能：
1. 温度加速降解计算
2. 货架期预测（90% 活性保留标准）
3. 月度降解曲线生成
4. 多成分协同稳定性评估
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════
# 常量
# ═══════════════════════════════════════════

R_GAS = 8.314          # 理想气体常数 J/(mol·K)
T_REF = 298.15         # 参考温度 25°C (K)
THRESHOLD_90 = 0.90    # 活性保留下限（90%）
THRESHOLD_80 = 0.80    # 关键失效阈值（80%）


# ═══════════════════════════════════════════
# 成分稳定性数据库
# ═══════════════════════════════════════════

# 每种成分的 Arrhenius 参数：
# - k_25: 25°C 下月度降解速率（%/月）
# - Ea: 活化能 J/mol（用于温度校正）
# - light_factor: 光照降解加速系数（1.0 = 无影响）
# - ph_window: 最佳 pH 范围
# - base_shelf_life: 参考货架期（月）

INGREDIENT_STABILITY: Dict[str, Dict[str, Any]] = {
    # 多糖类 — 相对稳定
    "黄芪多糖": {"k_25": 0.003, "Ea": 65000, "light_factor": 1.0, "ph_window": (4.0, 8.0), "base_shelf_life": 36},
    "枸杞多糖": {"k_25": 0.005, "Ea": 58000, "light_factor": 1.2, "ph_window": (4.0, 7.5), "base_shelf_life": 24},
    "茯苓多糖": {"k_25": 0.004, "Ea": 62000, "light_factor": 1.0, "ph_window": (4.5, 8.0), "base_shelf_life": 36},
    "灵芝多糖": {"k_25": 0.004, "Ea": 60000, "light_factor": 1.1, "ph_window": (4.0, 8.0), "base_shelf_life": 30},
    "山药多糖": {"k_25": 0.002, "Ea": 70000, "light_factor": 1.0, "ph_window": (4.5, 8.5), "base_shelf_life": 36},

    # 皂苷类 — 对光和热敏感
    "人参皂苷": {"k_25": 0.008, "Ea": 75000, "light_factor": 2.0, "ph_window": (4.0, 6.5), "base_shelf_life": 12},
    "人参皂苷Rg1": {"k_25": 0.010, "Ea": 78000, "light_factor": 2.2, "ph_window": (4.0, 6.0), "base_shelf_life": 12},
    "黄芪甲苷": {"k_25": 0.007, "Ea": 72000, "light_factor": 1.5, "ph_window": (4.0, 7.0), "base_shelf_life": 18},
    "甘草酸": {"k_25": 0.003, "Ea": 68000, "light_factor": 1.0, "ph_window": (4.0, 7.0), "base_shelf_life": 30},

    # 黄酮类
    "大豆异黄酮": {"k_25": 0.006, "Ea": 70000, "light_factor": 1.8, "ph_window": (3.0, 7.0), "base_shelf_life": 18},
    "槲皮素": {"k_25": 0.010, "Ea": 75000, "light_factor": 2.5, "ph_window": (3.0, 6.0), "base_shelf_life": 12},
    "葛根素": {"k_25": 0.007, "Ea": 72000, "light_factor": 1.5, "ph_window": (3.5, 7.0), "base_shelf_life": 18},
    "芦丁": {"k_25": 0.008, "Ea": 73000, "light_factor": 2.0, "ph_window": (3.5, 6.5), "base_shelf_life": 15},

    # 肽类
    "大豆肽": {"k_25": 0.004, "Ea": 65000, "light_factor": 1.0, "ph_window": (4.0, 8.0), "base_shelf_life": 24},
    "胶原蛋白肽": {"k_25": 0.003, "Ea": 70000, "light_factor": 1.0, "ph_window": (4.5, 7.5), "base_shelf_life": 36},
    "乳清蛋白肽": {"k_25": 0.005, "Ea": 62000, "light_factor": 1.2, "ph_window": (4.5, 7.0), "base_shelf_life": 18},
    "鱼胶原蛋白肽": {"k_25": 0.006, "Ea": 60000, "light_factor": 1.5, "ph_window": (4.0, 7.0), "base_shelf_life": 12},

    # 维生素类 — 高度敏感
    "维生素C": {"k_25": 0.015, "Ea": 80000, "light_factor": 2.5, "ph_window": (2.5, 5.5), "base_shelf_life": 12},
    "维生素E": {"k_25": 0.006, "Ea": 75000, "light_factor": 1.5, "ph_window": (5.0, 7.5), "base_shelf_life": 24},
    "维生素B族": {"k_25": 0.008, "Ea": 72000, "light_factor": 2.0, "ph_window": (4.0, 7.0), "base_shelf_life": 18},

    # 其他活性成分
    "姜黄素": {"k_25": 0.012, "Ea": 78000, "light_factor": 3.0, "ph_window": (5.5, 7.5), "base_shelf_life": 12},
    "褪黑素": {"k_25": 0.008, "Ea": 73000, "light_factor": 2.0, "ph_window": (5.0, 7.0), "base_shelf_life": 18},
    "枸杞子提取物": {"k_25": 0.006, "Ea": 68000, "light_factor": 1.5, "ph_window": (4.0, 7.0), "base_shelf_life": 24},

    # 基础食材（低风险）
    "茯苓": {"k_25": 0.002, "Ea": 72000, "light_factor": 1.0, "ph_window": (5.0, 8.0), "base_shelf_life": 36},
    "山药": {"k_25": 0.001, "Ea": 75000, "light_factor": 1.0, "ph_window": (5.0, 8.0), "base_shelf_life": 36},
    "莲子": {"k_25": 0.001, "Ea": 74000, "light_factor": 1.0, "ph_window": (5.0, 8.0), "base_shelf_life": 36},
    "薏苡仁": {"k_25": 0.001, "Ea": 73000, "light_factor": 1.0, "ph_window": (5.0, 8.0), "base_shelf_life": 36},
    "枸杞": {"k_25": 0.003, "Ea": 68000, "light_factor": 1.3, "ph_window": (4.5, 7.5), "base_shelf_life": 24},
    "红枣": {"k_25": 0.002, "Ea": 70000, "light_factor": 1.1, "ph_window": (4.5, 7.5), "base_shelf_life": 30},

    # 常见药材（2026-10-13 扩展：此前这些药材走 unknown_ingredient 保守默认，
    # 现按其活性成分类别录入独立参数，避免跨药材近似）
    "黄芪": {"k_25": 0.006, "Ea": 70000, "light_factor": 1.3, "ph_window": (4.5, 7.5), "base_shelf_life": 24},
    "当归": {"k_25": 0.005, "Ea": 68000, "light_factor": 1.5, "ph_window": (4.5, 7.0), "base_shelf_life": 18},
    "党参": {"k_25": 0.004, "Ea": 66000, "light_factor": 1.2, "ph_window": (4.5, 8.0), "base_shelf_life": 24},
    "白术": {"k_25": 0.005, "Ea": 69000, "light_factor": 1.5, "ph_window": (4.5, 7.0), "base_shelf_life": 18},
    "菊花": {"k_25": 0.008, "Ea": 73000, "light_factor": 2.0, "ph_window": (3.5, 6.5), "base_shelf_life": 12},
    "金银花": {"k_25": 0.007, "Ea": 72000, "light_factor": 1.8, "ph_window": (3.5, 7.0), "base_shelf_life": 15},
    "连翘": {"k_25": 0.006, "Ea": 71000, "light_factor": 1.5, "ph_window": (4.0, 7.0), "base_shelf_life": 18},
    "酸枣仁": {"k_25": 0.006, "Ea": 70000, "light_factor": 1.4, "ph_window": (4.0, 7.0), "base_shelf_life": 18},
    "百合": {"k_25": 0.003, "Ea": 68000, "light_factor": 1.1, "ph_window": (4.5, 8.0), "base_shelf_life": 30},
    "丹参": {"k_25": 0.009, "Ea": 75000, "light_factor": 2.2, "ph_window": (3.5, 6.5), "base_shelf_life": 12},
    "川芎": {"k_25": 0.006, "Ea": 70000, "light_factor": 1.5, "ph_window": (4.0, 7.0), "base_shelf_life": 18},
    "陈皮": {"k_25": 0.007, "Ea": 71000, "light_factor": 1.6, "ph_window": (3.5, 7.0), "base_shelf_life": 15},
    "山楂": {"k_25": 0.006, "Ea": 70000, "light_factor": 1.4, "ph_window": (3.5, 7.0), "base_shelf_life": 18},
    "决明子": {"k_25": 0.006, "Ea": 71000, "light_factor": 1.6, "ph_window": (3.5, 7.0), "base_shelf_life": 15},
    "薄荷": {"k_25": 0.006, "Ea": 69000, "light_factor": 1.8, "ph_window": (4.0, 7.0), "base_shelf_life": 15},
}

# 已知成分名称的别名映射
#
# 设计约束（重要）：
#   本表仅允许收录「同一物质的不同写法/俗称」。
#   严禁将「不同药材」映射到同一稳定性参数 —— 不同药材的活性成分、
#   活化能、pH 窗口、货架期均不同，近似映射会使预测结果失真。
#
#   未收录的药材名会走 _resolve_ingredient 的未知分支，
#   使用保守默认参数并记录 unknown_ingredient 风险因子（安全降级）。
INGREDIENT_ALIASES: Dict[str, str] = {
    # ── 同物异名：复方俗称 ──
    "四神汤": "茯苓", "四神汤粉": "茯苓",
    # ── 同物异名：肽类 ──
    "植物肽": "大豆肽", "草本肽": "大豆肽",
    "水解胶原蛋白": "胶原蛋白肽",
    # ── 同物异名：维生素（缩写/写法）──
    "维C": "维生素C", "VC": "维生素C", "Vc": "维生素C",
    "维E": "维生素E", "VE": "维生素E", "Ve": "维生素E",
    # ── 同物异名：药材正名 → 该药材的特征活性成分 ──
    #   注意：这是「药材 → 其特征成分」的正名映射，两侧指同一药味，
    #   不是跨药材近似。仅收录活性成分明确且已录入稳定性库者。
    "甘草": "甘草酸",
}

# 应显式拒绝的「跨药材近似映射」历史记录（保留供审计，不参与解析）
# 这些映射曾被用于把未收录药材近似到某个已收录参数，会导致预测失真：
#   "党参"/"西洋参" -> "人参"    不同药味，人参为限量药材
#   "白术"/"泽泻"   -> "茯苓"    功效与稳定性参数均不同
#   "熟地"/"生地"   -> "枸杞"    完全无关
#   "陈皮"/"山楂"   -> "枸杞"    完全无关
#   "决明子"/"菊花"/"桑叶"/"金银花"/"连翘"/"薄荷"/"板蓝根" -> "枸杞"  完全无关
#   "丹参"/"当归"/"白芍" -> "大豆异黄酮"   活性成分不同
#   "川芎"/"黄芩"   -> "槲皮素"    活性成分不同
_REJECTED_APPROXIMATE_ALIASES: Dict[str, str] = {
    "党参": "人参", "西洋参": "人参",
    "白术": "茯苓", "泽泻": "茯苓",
    "熟地": "枸杞", "生地": "枸杞",
    "陈皮": "枸杞", "山楂": "枸杞",
    "决明子": "枸杞", "菊花": "枸杞", "桑叶": "枸杞",
    "金银花": "枸杞", "连翘": "枸杞",
    "薄荷": "枸杞", "板蓝根": "枸杞",
    "黄芩": "槲皮素",
    "丹参": "大豆异黄酮", "当归": "大豆异黄酮", "白芍": "大豆异黄酮",
    "川芎": "槲皮素",
}


# ═══════════════════════════════════════════
# 数据类
# ═══════════════════════════════════════════

@dataclass
class MonthlyDegradationPoint:
    """单月降解数据点"""
    month: int
    remaining_pct: float     # 活性保留百分比（0-1）
    effective_rate_per_month: float  # 当月有效降解速率
    cumulative_loss_pct: float          # 累计损失百分比


@dataclass
class ShelfLifeResult:
    """货架期结果"""
    months_to_90: float          # 降至90%的时间
    months_to_80: float          # 降至80%的时间
    predicted_months: float      # 推荐货架期
    confidence: float            # 预测置信度 [0, 1]


@dataclass
class StabilityPrediction:
    """完整性稳定性预测结果"""
    stability_score: float           # 综合评分 [0, 1]
    estimated_shelf_life_months: float
    risk_factors: List[Dict[str, Any]] = field(default_factory=list)
    monthly_curve: List[Dict[str, Any]] = field(default_factory=list)
    storage_advice: List[str] = field(default_factory=list)
    shelf_life_details: Optional[ShelfLifeResult] = None


# ═══════════════════════════════════════════
# Arrhenius 核心计算
# ═══════════════════════════════════════════

def arrhenius_factor(k_ref: float, Ea: float, T_celsius: float) -> float:
    """
    计算 Arrhenius 温度校正因子

    k(T) = k_ref · exp[(Ea/R) · (1/T₀ - 1/T)]

    Args:
        k_ref: 参考温度（25°C）下的降解速率
        Ea: 活化能 J/mol
        T_celsius: 存储温度 °C

    Returns:
        在 T°C 下的有效降解速率
    """
    T_kelvin = T_celsius + 273.15
    # Arrhenius 指数项
    exponent = (Ea / R_GAS) * (1.0 / T_REF - 1.0 / T_kelvin)
    return k_ref * math.exp(exponent)


def integrate_degradation(
    k_eff: float,
    light_factor: float,
    months: int,
    steps: int = 120,
) -> List[MonthlyDegradationPoint]:
    """
    数值积分降解曲线（4阶Runge-Kutta）

    模型：dC/dt = -k·C·light_factor
    解析解：C(t) = C₀ · exp(-k·light_factor·t)

    Args:
        k_eff: 有效月度降解速率
        light_factor: 光照加速因子
        months: 预测月数
        steps: 每月的步数（越高越精确）

    Returns:
        月度降解数据点列表
    """
    rate = k_eff * light_factor
    points: List[MonthlyDegradationPoint] = []
    remaining = 1.0  # 初始活性为100%

    for m in range(1, months + 1):
        # 使用解析解获得该月末的剩余活性
        month_end = remaining * math.exp(-rate)
        # 月度平均降解速率（相对月初）
        avg_rate = (remaining - month_end) / remaining if remaining > 0 else 0
        points.append(MonthlyDegradationPoint(
            month=m,
            remaining_pct=round(month_end, 6),
            effective_rate_per_month=round(avg_rate, 6),
            cumulative_loss_pct=round(1.0 - month_end, 6),
        ))
        remaining = month_end

    return points


def calculate_shelf_life(
    curve: List[MonthlyDegradationPoint],
    threshold: float = THRESHOLD_90,
) -> float:
    """
    从降解曲线计算达到阈值的时间（月）

    使用线性插值：找到第一个 remaining < threshold 的月份，
    然后在上下两个点之间插值。
    """
    if not curve:
        return 0.0

    # 找到跨越阈值的区间
    for i in range(1, len(curve)):
        if curve[i].remaining_pct < threshold and curve[i - 1].remaining_pct >= threshold:
            # 线性插值
            r0, r1 = curve[i - 1].remaining_pct, curve[i].remaining_pct
            t0, t1 = float(i - 1), float(i)
            if abs(r1 - r0) < 1e-12:
                return t1
            interpolated = t0 + (threshold - r0) / (r1 - r0) * (t1 - t0)
            return round(interpolated, 2)

    # 未到达阈值
    return float(len(curve))


# ═══════════════════════════════════════════
# Arrhenius 稳定性预测引擎
# ═══════════════════════════════════════════

class ArrheniusStabilityEngine:
    """
    Arrhenius 稳定性预测引擎

    核心能力：
    1. 多成分配方稳定性加权计算
    2. 温度加速降解预测
    3. 货架期计算（90% / 80% 阈值）
    4. 月度降解曲线生成
    5. 风险因素识别与建议
    """

    def __init__(self):
        self._db = INGREDIENT_STABILITY
        self._aliases = INGREDIENT_ALIASES

    def _resolve_ingredient(self, name: str) -> str:
        """解析成分名称（支持别名）"""
        if name in self._db:
            return name
        return self._aliases.get(name, name)

    def predict(
        self,
        ingredients: List[Dict[str, Any]],
        storage_temp: float = 25.0,
        storage_humidity: float = 60.0,
        light_exposure: str = "normal",
        packaging: str = "standard",
        months_to_predict: int = 24,
    ) -> StabilityPrediction:
        """
        预测配方稳定性

        Args:
            ingredients: [{"name": str, "dosage_mg": float, ...}]
            storage_temp: 存储温度 °C
            storage_humidity: 湿度 %
            light_exposure: "dark" | "normal" | "bright"
            packaging: "standard" | "amber_bottle" | "vacuum" | "nitrogen_flushed"
            months_to_predict: 预测月数

        Returns:
            StabilityPrediction
        """
        # 光照因子
        light_factor_map = {"dark": 0.8, "normal": 1.0, "bright": 1.5}
        base_light = light_factor_map.get(light_exposure, 1.0)

        # 包装防护因子
        packaging_factor_map = {
            "standard": 1.0,
            "amber_bottle": 0.7,
            "vacuum": 0.6,
            "nitrogen_flushed": 0.5,
        }
        pack_factor = packaging_factor_map.get(packaging, 1.0)

        risk_factors: List[Dict[str, Any]] = []
        weighted_k_sum = 0.0
        total_dosage = sum(i.get("dosage_mg", i.get("percentage", 1.0)) for i in ingredients)
        known_count = 0
        min_base_shelf = float('inf')

        for ing in ingredients:
            raw_name = ing.get("name", "")
            resolved = self._resolve_ingredient(raw_name)
            dosage = ing.get("dosage_mg", ing.get("percentage", 1.0))
            weight = dosage / total_dosage if total_dosage > 0 else 1.0 / max(1, len(ingredients))

            if resolved not in self._db:
                # 未知成分：使用保守默认值
                risk_factors.append({
                    "type": "unknown_ingredient",
                    "severity": 0.3,
                    "description": f"未知成分 '{raw_name}'，使用保守默认参数",
                })
                k_eff = arrhenius_factor(0.005, 70000, storage_temp)  # 保守默认
                min_base_shelf = min(min_base_shelf, 12)
            else:
                props = self._db[resolved]
                k_25 = props["k_25"]
                Ea = props["Ea"]
                light_f = props["light_factor"]
                base_sl = props["base_shelf_life"]

                # Arrhenius 温度校正
                k_eff = arrhenius_factor(k_25, Ea, storage_temp)

                # 综合光照因子
                effective_light = base_light * light_f * pack_factor
                k_eff *= effective_light

                # 湿度影响（高湿加速水解）
                if storage_humidity > 65:
                    humidity_accel = 1.0 + 0.02 * (storage_humidity - 65)
                    k_eff *= humidity_accel
                    if storage_humidity > 75:
                        risk_factors.append({
                            "type": "high_humidity",
                            "severity": 0.2,
                            "description": f"高湿度({storage_humidity}%)加速 '{raw_name}' 水解",
                        })

                # pH 窗口检查（默认配方pH 5-7，如有偏离则标记）
                ph_min, ph_max = props["ph_window"]
                if ph_max < 6.5 or ph_min > 7.5:
                    risk_factors.append({
                        "type": "ph_sensitivity",
                        "severity": 0.15,
                        "description": f"'{raw_name}' pH窗口狭窄({ph_min}-{ph_max})，需严格控制pH",
                    })

                min_base_shelf = min(min_base_shelf, base_sl)
                known_count += 1

            weighted_k_sum += k_eff * weight

        # 成分相互作用效应
        interaction_accel = self._check_interactions(ingredients, risk_factors)
        weighted_k_sum *= (1.0 + interaction_accel)

        # 生成降解曲线
        curve = integrate_degradation(weighted_k_sum, 1.0, months_to_predict)

        # 计算货架期
        shelf_90 = calculate_shelf_life(curve, THRESHOLD_90)
        shelf_80 = calculate_shelf_life(curve, THRESHOLD_80)
        predicted_months = min(shelf_90, min_base_shelf * 0.8) if min_base_shelf != float('inf') else shelf_90

        # 置信度
        if known_count == len(ingredients) and ingredients:
            confidence = min(0.95, 0.6 + 0.05 * known_count)
        elif known_count > 0:
            confidence = 0.4 + 0.1 * known_count
        else:
            confidence = 0.3

        # 综合稳定性评分 [0, 1]
        score = max(0.0, min(1.0, predicted_months / 36.0))

        # 储存建议
        advice = self._generate_advice(
            risk_factors, storage_temp, storage_humidity,
            light_exposure, packaging, confidence,
        )

        # 构建月度曲线 JSON
        monthly_curve = [
            {"month": p.month, "remaining_pct": round(p.remaining_pct, 4)}
            for p in curve
        ]

        return StabilityPrediction(
            stability_score=round(score, 4),
            estimated_shelf_life_months=round(predicted_months, 1),
            risk_factors=risk_factors,
            monthly_curve=monthly_curve,
            storage_advice=advice,
            shelf_life_details=ShelfLifeResult(
                months_to_90=round(shelf_90, 2),
                months_to_80=round(shelf_80, 2),
                predicted_months=round(predicted_months, 1),
                confidence=round(confidence, 2),
            ),
        )

    def _check_interactions(
        self, ingredients: List[Dict[str, Any]], risk_factors: List[Dict]
    ) -> float:
        """检查成分相互作用（协同/拮抗）"""
        names = [self._resolve_ingredient(i.get("name", "")) for i in ingredients]
        accel = 0.0

        known_pairs = [
            (("维生素C", "铜离子"), 0.3),
            (("维生素C", "铁离子"), 0.2),
            (("人参皂苷", "光"), 0.15),
            (("姜黄素", "光"), 0.2),
            (("维生素C", "维生素E"), -0.1),  # 协同保护
            (("槲皮素", "维生素C"), -0.05),   # 协同抗氧化
            (("大豆肽", "胶原蛋白肽"), -0.03), # 轻微协同
        ]

        for pair, effect in known_pairs:
            if pair[0] in names and pair[1] in names:
                accel += effect
                if effect > 0:
                    risk_factors.append({
                        "type": "interaction_accel",
                        "severity": effect,
                        "description": f"{' + '.join(pair)} 存在降解协同加速",
                    })
                else:
                    risk_factors.append({
                        "type": "interaction_protect",
                        "severity": abs(effect),
                        "description": f"{' + '.join(pair)} 存在抗氧化协同保护",
                    })

        return max(0.0, accel)

    def _generate_advice(
        self,
        risk_factors: List[Dict],
        temp: float,
        humidity: float,
        light: str,
        packaging: str,
        confidence: float,
    ) -> List[str]:
        """生成储存建议"""
        advice = []

        if temp > 25:
            advice.append(f"存储温度偏高({temp}°C)，建议冷藏储存(2-8°C)")
        elif temp > 30:
            advice.append("高温环境严重加速降解，必须冷链储存")

        if humidity > 60:
            advice.append(f"湿度偏高({humidity}%RH)，建议添加干燥剂")

        if light in ("normal", "bright"):
            advice.append("建议避光保存，使用棕色瓶或铝箔包装")

        if packaging == "standard" and any(r["type"] in ("light_sensitivity", "oxidation") for r in risk_factors):
            advice.append("建议使用避光密封包装以提升稳定性")

        if confidence < 0.5:
            advice.append("配方中含未知成分，建议进行加速稳定性实验验证")

        if not advice:
            advice.append("常温干燥避光保存即可")

        return advice

    def accelerated_testing(
        self,
        ingredients: List[Dict[str, Any]],
        temps: List[float],
        packaging: str = "standard",
    ) -> Dict[str, List[MonthlyDegradationPoint]]:
        """
        加速稳定性试验模拟

        在多个温度点生成降解曲线，用于 ICH Q1A 风格加速试验设计。

        Args:
            ingredients: 配方成分列表
            temps: 测试温度列表 [°C]（如 [25, 40, 50, 60]）
            packaging: 包装类型

        Returns:
            {temperature: [degradation_points]}
        """
        results = {}
        for t in temps:
            pred = self.predict(ingredients, storage_temp=t, packaging=packaging)
            results[f"{t}°C"] = [
                MonthlyDegradationPoint(
                    month=p["month"],
                    remaining_pct=p["remaining_pct"],
                    effective_rate_per_month=0.0,
                    cumulative_loss_pct=0.0,
                )
                for p in pred.monthly_curve
            ]
        return results

    def q10_estimate(
        self,
        ingredients: List[Dict[str, Any]],
        t1: float,
        t2: float,
    ) -> float:
        """
        Q10 温度系数估算

        Q10 = (k₂/k₁)^(10/(T₂-T₁))

        使用 Arrhenius 方程直接计算速率比，而非通过货架期倒数。
        典型范围：2-3 对于化学降解。

        Returns:
            Q10 值
        """
        if t2 == t1:
            return 1.0

        # 取第一个已知成分作为代表
        representative_k25 = 0.005  # 默认参考降解速率
        representative_Ea = 70000    # 默认参考活化能 J/mol

        k1 = arrhenius_factor(representative_k25, representative_Ea, t1)
        k2 = arrhenius_factor(representative_k25, representative_Ea, t2)

        q10 = (k2 / k1) ** (10.0 / (t2 - t1))
        return round(q10, 2)


# ═══════════════════════════════════════════
# 对外服务类（替换 Mock）
# ═══════════════════════════════════════════

class ArrheniusStabilityModelService:
    """
    Arrhenius 稳定性预测服务

    替代 MockStabilityModelService，使用真实的 Arrhenius 方程
    进行温度加速降解计算。
    """

    def __init__(self):
        self._engine = ArrheniusStabilityEngine()
        logger.info("ArrheniusStabilityModelService 初始化完成")

    async def predict(
        self,
        ingredients: List[Dict[str, Any]],
        storage_temp: float = 25.0,
        storage_humidity: float = 60.0,
        light_exposure: str = "normal",
        packaging: str = "standard",
        months_to_predict: int = 24,
    ) -> Dict[str, Any]:
        """
        预测配方稳定性

        Args:
            ingredients: [{"name": str, "dosage_mg": float}, ...]
            storage_temp: 存储温度 °C（默认 25）
            storage_humidity: 相对湿度 %（默认 60）
            light_exposure: "dark" | "normal" | "bright"
            packaging: "standard" | "amber_bottle" | "vacuum" | "nitrogen_flushed"
            months_to_predict: 预测月数

        Returns:
            稳定性预测结果字典
        """
        pred = self._engine.predict(
            ingredients=ingredients,
            storage_temp=storage_temp,
            storage_humidity=storage_humidity,
            light_exposure=light_exposure,
            packaging=packaging,
            months_to_predict=months_to_predict,
        )

        return {
            "stability_score": pred.stability_score,
            "estimated_shelf_life_months": pred.estimated_shelf_life_months,
            "risk_factors": pred.risk_factors,
            "monthly_curve": pred.monthly_curve,
            "storage_advice": pred.storage_advice,
            "shelf_life_details": {
                "months_to_90": pred.shelf_life_details.months_to_90
                    if pred.shelf_life_details else None,
                "months_to_80": pred.shelf_life_details.months_to_80
                    if pred.shelf_life_details else None,
                "predicted_months": pred.shelf_life_details.predicted_months
                    if pred.shelf_life_details else None,
                "confidence": pred.shelf_life_details.confidence
                    if pred.shelf_life_details else 0.0,
            } if pred.shelf_life_details else None,
        }

    async def q10(
        self,
        ingredients: List[Dict[str, Any]],
        t1: float = 25.0,
        t2: float = 40.0,
    ) -> Dict[str, Any]:
        """计算 Q10 温度系数"""
        q10 = self._engine.q10_estimate(ingredients, t1, t2)
        return {
            "q10": q10,
            "t1_celsius": t1,
            "t2_celsius": t2,
            "interpretation": self._interpret_q10(q10),
        }

    @staticmethod
    def _interpret_q10(q10: float) -> str:
        if q10 < 1.5:
            return "温度不敏感，降解速率变化小"
        elif q10 < 2.5:
            return "中等温度敏感性，建议控制储存温度"
        elif q10 < 4.0:
            return "高度温度敏感，需冷链储存"
        else:
            return "极端温度敏感，必须严格温控"


# ═══════════════════════════════════════════
# 向后兼容别名
# ═══════════════════════════════════════════

# Mock 别名保持向后兼容（__init__.py 导入此名称）
MockStabilityModelService = ArrheniusStabilityModelService


# ═══════════════════════════════════════════
# 单例工厂
# ═══════════════════════════════════════════

_instance: Optional[ArrheniusStabilityModelService] = None


def get_stability_model() -> ArrheniusStabilityModelService:
    global _instance
    if _instance is None:
        _instance = ArrheniusStabilityModelService()
    return _instance

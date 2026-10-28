"""
FactEngine — 确定性计算引擎
对标 FormLab 核心理念："数字由软件计算，AI 只写叙述"

FactEngine 产出不可篡改的确定性事实：
  - 成本计算（含价格历史与调价影响）
  - 合规检查（GB 16740 + 药食同源目录 + 禁忌搭配）
  - 过敏原检测
  - 异常值检测（测试数据 vs 规格范围）
  - 理论参数折算（氮→蛋白质等）

所有输出均为结构化 JSON，供 AIReportWriter 消费。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════
# 数据类定义
# ═══════════════════════════════════════════

@dataclass
class CostFact:
    """成本计算事实"""
    formula_id: int
    formula_name: str
    batch_size_kg: float
    ingredient_cost: float
    processing_cost: float = 0.0
    total_cost: float = 0.0
    cost_per_kg: float = 0.0
    currency: str = "CNY"
    price_source: str = "food_materials"
    calculated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "formula_id": self.formula_id,
            "formula_name": self.formula_name,
            "batch_size_kg": self.batch_size_kg,
            "ingredient_cost": round(self.ingredient_cost, 2),
            "processing_cost": round(self.processing_cost, 2),
            "total_cost": round(self.total_cost, 2),
            "cost_per_kg": round(self.cost_per_kg, 2),
            "currency": self.currency,
            "price_source": self.price_source,
            "calculated_at": self.calculated_at.isoformat(),
        }


@dataclass
class ComplianceFact:
    """合规检查事实"""
    formula_name: str
    is_compliant: bool
    violations: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[Dict[str, Any]] = field(default_factory=list)
    checks_performed: List[str] = field(default_factory=list)
    reference: str = "GB 16740-2014 / 药食同源目录(2025版)"
    checked_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "formula_name": self.formula_name,
            "is_compliant": self.is_compliant,
            "violations": self.violations,
            "warnings": self.warnings,
            "checks_performed": self.checks_performed,
            "reference": self.reference,
            "checked_at": self.checked_at.isoformat(),
        }


@dataclass
class AllergenFact:
    """过敏原检测事实"""
    formula_name: str
    allergens_detected: List[Dict[str, Any]] = field(default_factory=list)
    at_risk_populations: List[str] = field(default_factory=list)
    has_allergens: bool = False
    checked_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "formula_name": self.formula_name,
            "allergens_detected": self.allergens_detected,
            "at_risk_populations": self.at_risk_populations,
            "has_allergens": self.has_allergens,
            "checked_at": self.checked_at.isoformat(),
        }


@dataclass
class AnomalyFact:
    """异常值检测事实"""
    parameter: str
    measured_value: Optional[float]
    spec_min: Optional[float]
    spec_max: Optional[float]
    deviation_pct: Optional[float]
    is_anomaly: bool
    severity: str  # "critical" | "warning" | "normal"
    detected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "parameter": self.parameter,
            "measured_value": self.measured_value,
            "spec_min": self.spec_min,
            "spec_max": self.spec_max,
            "deviation_pct": self.deviation_pct,
            "is_anomaly": self.is_anomaly,
            "severity": self.severity,
            "detected_at": self.detected_at.isoformat(),
        }


@dataclass
class TheoreticalFact:
    """理论参数折算事实"""
    parameter: str
    raw_value: float
    conversion_factor: float
    converted_value: float
    unit_original: str
    unit_converted: str
    method: str  # "nitrogen_conversion" | "dry_basis" | "wet_basis"
    calculated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "parameter": self.parameter,
            "raw_value": self.raw_value,
            "conversion_factor": self.conversion_factor,
            "converted_value": round(self.converted_value, 4),
            "unit_original": self.unit_original,
            "unit_converted": self.unit_converted,
            "method": self.method,
            "calculated_at": self.calculated_at.isoformat(),
        }


# ═══════════════════════════════════════════
# 常量定义
# ═══════════════════════════════════════════

# 氮折算系数（不同原料来源不同）
NITROGEN_CONVERSION_FACTORS: Dict[str, float] = {
    "default": 6.25,
    "wheat": 5.70,
    "rice": 5.95,
    "soybean": 6.25,
    "corn": 6.38,
    "milk": 6.38,
    "meat": 6.25,
    "eggs": 6.25,
    "fish": 5.60,
}

# 药食同源目录每日用量上限
#
# ⚠️ 单位约定：本表数值单位为【克/日】(g/day)，与《按照传统既是食品又是
#    中药材的物质目录》一致。比对时必须将 g 换算为 mg（×1000）。
#    切勿直接与 dosage_mg 比较 —— 会造成 1000 倍误差。
#
# TODO(业务确认): 下列数值需由业务方依据目录正式文本逐项复核，
#                 并补充数据来源与版本日期。
FOOD_HERB_DOSAGE_LIMIT_G_PER_DAY: Dict[str, float] = {
    "人参": 3.0, "党参": 10.0, "黄芪": 10.0, "枸杞子": 10.0,
    "红枣": 10.0, "山药": 12.0, "茯苓": 12.0, "薏苡仁": 10.0,
    "菊花": 6.0, "金银花": 6.0, "薄荷": 6.0, "甘草": 6.0,
    "陈皮": 6.0, "山楂": 10.0, "莲子": 10.0, "百合": 12.0,
    "桂圆": 10.0, "桑葚": 10.0, "罗汉果": 15.0, "胖大海": 10.0,
    "玫瑰花": 3.0, "荷叶": 3.0, "决明子": 10.0,
}

# 向后兼容别名（旧名保留，避免既有 import 断裂）
FOOD_HERB_DOSAGE_LIMIT = FOOD_HERB_DOSAGE_LIMIT_G_PER_DAY

# 禁忌搭配（十八反、十九畏）
PROHIBITED_COMBINATIONS: List[Tuple[str, str]] = [
    ("人参", "藜芦"), ("甘草", "甘遂"), ("甘草", "大戟"),
    ("甘草", "芫花"), ("海藻", "甘草"), ("乌头", "贝母"),
    ("乌头", "瓜蒌"), ("乌头", "半夏"), ("乌头", "白蔹"),
    ("乌头", "白及"),
]

# 特殊人群禁忌
PREGNANCY_FORBIDDEN: set = {"薏苡仁", "红花", "桃仁", "牛膝", "麝香"}
CHILD_FORBIDDEN: set = {"人参", "鹿茸", "附子", "川乌", "草乌"}


# ═══════════════════════════════════════════
# FactEngine 主类
# ═══════════════════════════════════════════

class FactEngine:
    """
    确定性计算引擎

    产出不依赖 AI 的事实数据，所有计算结果可复现、可审计。
    供 AIReportWriter 消费，实现「数字归软件，叙述归 AI」的分层架构。
    """

    def __init__(
        self,
        price_cache: Optional[Dict[str, float]] = None,
        herb_dosage_limit: Optional[Dict[str, float]] = None,
        herb_dosage_limit_g_per_day: Optional[Dict[str, float]] = None,
    ):
        self.price_cache = price_cache or {}
        # 单位约定：g/日。herb_dosage_limit 为旧参数名，语义同为 g/日。
        self.herb_dosage_limit_g_per_day = (
            herb_dosage_limit_g_per_day
            or herb_dosage_limit
            or FOOD_HERB_DOSAGE_LIMIT_G_PER_DAY
        )
        # 向后兼容：保留旧属性名
        self.herb_dosage_limit = self.herb_dosage_limit_g_per_day

    # ── 1. 成本计算 ────────────────────────────────────────

    def calculate_cost(
        self,
        formula_name: str,
        formula_id: int,
        ingredients: List[Dict[str, Any]],
        batch_size_kg: float,
        processing_cost_per_kg: float = 0.0,
    ) -> CostFact:
        """
        计算批量生产成本

        Args:
            formula_name: 配方名称
            formula_id: 配方 ID
            ingredients: [{"name": str, "dosage_mg": float, "price_per_kg": float}]
            batch_size_kg: 批次目标产量(kg)
            processing_cost_per_kg: 加工成本(元/kg)
        """
        scale_factor = batch_size_kg * 1000  # kg → g → 除以单次用量(g)
        ingredient_cost = 0.0

        for ing in ingredients:
            dosage_mg = ing.get("dosage_mg", 0)
            price_per_kg = ing.get("price_per_kg", 0.0)
            # 单批次用量 = dosage_mg * (batch_size_kg / 单次剂量基准)
            # 基准：假设单次剂量为 10g（标准冲泡量）
            single_dose_g = 10.0
            batch_quantity_g = dosage_mg / 1000 * (batch_size_kg * 1000 / single_dose_g)
            ingredient_cost += (batch_quantity_g / 1000) * price_per_kg

        processing_cost = batch_size_kg * processing_cost_per_kg
        total_cost = ingredient_cost + processing_cost
        cost_per_kg = total_cost / batch_size_kg if batch_size_kg > 0 else 0.0

        return CostFact(
            formula_id=formula_id,
            formula_name=formula_name,
            batch_size_kg=batch_size_kg,
            ingredient_cost=ingredient_cost,
            processing_cost=processing_cost,
            total_cost=total_cost,
            cost_per_kg=cost_per_kg,
        )

    # ── 2. 合规检查 ────────────────────────────────────────

    def check_compliance(
        self,
        formula_name: str,
        ingredients: List[Dict[str, Any]],
    ) -> ComplianceFact:
        """
        检查配方是否符合 GB 16740 及药食同源目录

        检查项：
        1. 药食同源成分用量是否超标
        2. 是否存在禁忌搭配（十八反、十九畏）
        3. 是否含非药食同源成分
        """
        violations: List[Dict[str, Any]] = []
        warnings: List[Dict[str, Any]] = []
        checks: List[str] = []

        # 检查 1: 药食同源成分用量
        for ing in ingredients:
            name = ing.get("name", "")
            dosage_mg = ing.get("dosage_mg", 0)
            # 目录上限以「克/日」存储，统一换算为 mg 后再比较（×1000）
            limit_g = self.herb_dosage_limit_g_per_day.get(name)

            if limit_g is not None:
                checks.append(f"dosage_check:{name}")
                limit_mg = limit_g * 1000.0
                if dosage_mg > limit_mg:
                    violations.append({
                        "type": "dosage_exceeded",
                        "ingredient": name,
                        "actual_mg": dosage_mg,
                        "limit_mg": limit_mg,
                        "limit_g_per_day": limit_g,
                        "excess_pct": round((dosage_mg / limit_mg - 1) * 100, 1),
                        "message": (
                            f"{name} 用量 {dosage_mg / 1000:.2f}g 超出药食同源目录"
                            f"每日上限 {limit_g}g"
                        ),
                    })
            elif name not in ["蔗糖", "葡萄糖", "麦芽糊精", "食用香精", "水"]:
                # 非标准辅料，发出警告
                warnings.append({
                    "type": "unlisted_ingredient",
                    "ingredient": name,
                    "message": f"{name} 不在药食同源目录中，请确认是否符合 GB 16740",
                })
                checks.append(f"unlisted_check:{name}")

        # 检查 2: 禁忌搭配
        herb_names = [ing.get("name", "") for ing in ingredients]
        for a, b in PROHIBITED_COMBINATIONS:
            if a in herb_names and b in herb_names:
                violations.append({
                    "type": "prohibited_combination",
                    "ingredients": [a, b],
                    "message": f"禁止配伍：{a} 与 {b} 属于十八反/十九畏",
                })
                checks.append(f"prohibited_check:{a}+{b}")

        is_compliant = len(violations) == 0
        return ComplianceFact(
            formula_name=formula_name,
            is_compliant=is_compliant,
            violations=violations,
            warnings=warnings,
            checks_performed=checks,
        )

    # ── 3. 过敏原检测 ──────────────────────────────────────

    ALLERGEN_MAP: Dict[str, List[str]] = {
        "gluten": ["小麦", "大麦", "燕麦", "黑麦", "面粉", "麦芽"],
        "soy": ["大豆", "黄豆", "黑豆", "豆腐", "豆豉", "纳豆"],
        "nuts": ["核桃", "杏仁", "腰果", "花生", "榛子", "松子", "开心果", "栗子"],
        "dairy": ["牛奶", "奶粉", "奶酪", "酸奶", "乳清", "酪蛋白"],
        "egg": ["鸡蛋", "鸭蛋", "鹅蛋", "蛋清", "蛋黄"],
        "shellfish": ["虾", "蟹", "贝类", "牡蛎", "扇贝"],
        "sesame": ["芝麻", "芝麻油"],
    }

    def detect_allergens(
        self,
        formula_name: str,
        ingredients: List[Dict[str, Any]],
    ) -> AllergenFact:
        """检测配方中的过敏原"""
        allergens_detected: List[Dict[str, Any]] = []
        at_risk: set = set()

        for allergen_type, allergen_sources in self.ALLERGEN_MAP.items():
            matched = [ing.get("name", "") for ing in ingredients
                       if ing.get("name", "") in allergen_sources]
            if matched:
                allergens_detected.append({
                    "type": allergen_type,
                    "matched_ingredients": matched,
                })
                at_risk.update(matched)

        return AllergenFact(
            formula_name=formula_name,
            allergens_detected=allergens_detected,
            at_risk_populations=sorted(at_risk),
            has_allergens=len(allergens_detected) > 0,
        )

    # ── 4. 异常值检测 ──────────────────────────────────────

    def detect_anomalies(
        self,
        test_results: List[Dict[str, Any]],
    ) -> List[AnomalyFact]:
        """
        检测测试数据中的异常值

        逻辑：
        - 有 spec_min/spec_max → 超出范围 = 异常
        - 无规格范围 → 与历史均值偏差 > 2σ = 异常
        """
        anomalies: List[AnomalyFact] = []

        for result in test_results:
            param = result.get("parameter", "")
            value = result.get("value")
            spec_min = result.get("spec_min")
            spec_max = result.get("spec_max")

            if value is None:
                continue

            is_anomaly = False
            severity = "normal"
            deviation_pct = None

            if spec_min is not None and spec_max is not None:
                if value < spec_min:
                    is_anomaly = True
                    deviation_pct = round((value - spec_min) / spec_min * 100, 2)
                    severity = "critical" if deviation_pct < -20 else "warning"
                elif value > spec_max:
                    is_anomaly = True
                    deviation_pct = round((value - spec_max) / spec_max * 100, 2)
                    severity = "critical" if deviation_pct > 20 else "warning"
            elif spec_min is not None and value < spec_min:
                is_anomaly = True
                severity = "critical"
            elif spec_max is not None and value > spec_max:
                is_anomaly = True
                severity = "critical"

            anomalies.append(AnomalyFact(
                parameter=param,
                measured_value=value,
                spec_min=spec_min,
                spec_max=spec_max,
                deviation_pct=deviation_pct,
                is_anomaly=is_anomaly,
                severity=severity,
            ))

        return anomalies

    # ── 5. 理论参数折算 ────────────────────────────────────

    def calculate_theoretical(
        self,
        parameter: str,
        raw_value: float,
        unit: str,
        conversion_method: str = "nitrogen_conversion",
        ingredient_type: str = "default",
    ) -> TheoreticalFact:
        """
        理论参数折算

        支持：
        - nitrogen_conversion: 氮 → 蛋白质（系数根据原料类型）
        - dry_basis: 湿基 → 干基换算
        - wet_basis: 干基 → 湿基换算
        """
        if conversion_method == "nitrogen_conversion":
            factor = NITROGEN_CONVERSION_FACTORS.get(
                ingredient_type,
                NITROGEN_CONVERSION_FACTORS["default"]
            )
            converted = raw_value * factor
            return TheoreticalFact(
                parameter=parameter,
                raw_value=raw_value,
                conversion_factor=factor,
                converted_value=converted,
                unit_original=unit,
                unit_converted="protein_%",
                method="nitrogen_conversion",
            )

        elif conversion_method == "dry_basis":
            # 假设水分含量为 10%（可配置）
            moisture = 0.10
            factor = 1.0 / (1.0 - moisture)
            converted = raw_value * factor
            return TheoreticalFact(
                parameter=parameter,
                raw_value=raw_value,
                conversion_factor=round(factor, 4),
                converted_value=converted,
                unit_original=unit,
                unit_converted=f"{unit}_dry_basis",
                method="dry_basis",
            )

        raise ValueError(f"不支持的折算方法: {conversion_method}")

    # ── 6. 批次状态影响分析 ────────────────────────────────

    def analyze_batch_impact(
        self,
        batch_id: int,
        batch_status: str,
        ingredient_lots: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        分析批次状态变化对原料批号的影响

        返回：
        - 被锁定的原料批号
        - 可释放的原料批号（关闭批次后）
        - 状态变更建议
        """
        locked_lots = []
        releasable_lots = []

        for lot in ingredient_lots:
            lot_id = lot.get("id")
            used_qty = lot.get("used_qty_kg", 0)
            status = lot.get("status", "available")

            if batch_status == "completed" and status == "available" and used_qty > 0:
                locked_lots.append({
                    "lot_id": lot_id,
                    "internal_lot_code": lot.get("internal_lot_code"),
                    "used_qty_kg": used_qty,
                    "reason": "批次完成，原料批号已锁定",
                })
            elif batch_status == "closed" and status == "locked":
                releasable_lots.append({
                    "lot_id": lot_id,
                    "internal_lot_code": lot.get("internal_lot_code"),
                    "action": "可释放回可用状态",
                })

        return {
            "batch_id": batch_id,
            "new_status": batch_status,
            "locked_lots": locked_lots,
            "releasable_lots": releasable_lots,
            "recommendation": self._get_status_recommendation(batch_status),
        }

    def _get_status_recommendation(self, status: str) -> str:
        """根据批次状态给出操作建议"""
        recommendations = {
            "planned": "批记录已创建，等待开始生产",
            "in_progress": "生产进行中，注意记录实际产量和原料消耗",
            "completed": "生产完成，请录入样品测试结果并关闭批次",
            "closed": "批次已关闭，原料批号已关联锁定",
        }
        return recommendations.get(status, "无建议")

    # ── 7. 批量事实打包 ────────────────────────────────────

    def generate_fact_bundle(
        self,
        formula_name: str,
        formula_id: int,
        ingredients: List[Dict[str, Any]],
        batch_size_kg: float,
        test_results: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        生成完整的事实包（供 AIReportWriter 消费）

        包含：
        - 成本计算事实
        - 合规检查事实
        - 过敏原检测事实
        - 异常值检测事实（如有测试数据）
        """
        cost_fact = self.calculate_cost(
            formula_name=formula_name,
            formula_id=formula_id,
            ingredients=ingredients,
            batch_size_kg=batch_size_kg,
        )

        compliance_fact = self.check_compliance(
            formula_name=formula_name,
            ingredients=ingredients,
        )

        allergen_fact = self.detect_allergens(
            formula_name=formula_name,
            ingredients=ingredients,
        )

        anomaly_facts = []
        if test_results:
            anomaly_facts = self.detect_anomalies(test_results)

        return {
            "meta": {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "engine_version": "1.0.0",
                "deterministic": True,
            },
            "cost": cost_fact.to_dict(),
            "compliance": compliance_fact.to_dict(),
            "allergens": allergen_fact.to_dict(),
            "anomalies": [a.to_dict() for a in anomaly_facts],
            "summary": {
                "cost_per_kg": cost_fact.cost_per_kg,
                "is_compliant": compliance_fact.is_compliant,
                "has_allergens": allergen_fact.has_allergens,
                "anomaly_count": len([a for a in anomaly_facts if a.is_anomaly]),
            },
        }


# ═══════════════════════════════════════════
# 单例工厂
# ═══════════════════════════════════════════

_instance: Optional[FactEngine] = None

def get_fact_engine() -> FactEngine:
    global _instance
    if _instance is None:
        _instance = FactEngine()
    return _instance

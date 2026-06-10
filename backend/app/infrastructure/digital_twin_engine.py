"""
数字孪生仿真引擎（M3.1）

基于工艺参数和物料特性的中试放大仿真、成本估算、设备选型。
"""
from __future__ import annotations
import math
import logging
from decimal import Decimal
from typing import Optional

from ..domain.digital_twin import (
    ProcessParameter, EquipmentSpec, ScaleUpResult, CostEstimate,
    ProductionLine, ScaleUpPrediction,
)

logger = logging.getLogger(__name__)


# ─── 内置设备模型库 ───

_EQUIPMENT_LIBRARY: dict[str, list[EquipmentSpec]] = {
    "homogenizer": [
        EquipmentSpec("高压均质机_小型", "homogenizer", 50, 7.5, 0.5, 0, 15),
        EquipmentSpec("高压均质机_中型", "homogenizer", 200, 22, 1.5, 0, 30),
        EquipmentSpec("高压均质机_大型", "homogenizer", 800, 55, 4, 0, 50),
    ],
    "spray_dryer": [
        EquipmentSpec("喷雾干燥机_小型", "spray_dryer", 30, 12, 0, 50, 10),
        EquipmentSpec("喷雾干燥机_中型", "spray_dryer", 150, 35, 0, 200, 25),
        EquipmentSpec("喷雾干燥机_大型", "spray_dryer", 500, 75, 0, 600, 40),
    ],
    "sterilizer": [
        EquipmentSpec("管式灭菌机_小型", "sterilizer", 60, 5, 0.3, 10, 8),
        EquipmentSpec("管式灭菌机_中型", "sterilizer", 250, 12, 1, 30, 15),
        EquipmentSpec("管式灭菌机_大型", "sterilizer", 1000, 25, 3, 80, 25),
    ],
}


class DigitalTwinEngine:
    """数字孪生仿真引擎"""

    def __init__(self):
        self._equipment_library = _EQUIPMENT_LIBRARY

    # ─── 中试放大预测 ───

    def predict_scale_up(
        self,
        lab_batch_size: float,
        target_batch_size: float,
        ingredients: list[dict],
        process_params: list[ProcessParameter],
    ) -> ScaleUpPrediction:
        """预测从实验室到中试/生产的放大效果"""
        scale_factor = target_batch_size / lab_batch_size if lab_batch_size > 0 else 1

        # 基于物料特性计算收率衰减
        yield_base = 0.95
        complexity_penalty = len(ingredients) * 0.02
        viscosity_factor = self._estimate_viscosity_factor(ingredients)
        heat_sensitivity = self._estimate_heat_sensitivity(ingredients)
        scale_penalty = math.log10(scale_factor) * 0.05

        predicted_yield = yield_base - complexity_penalty - viscosity_factor - heat_sensitivity - scale_penalty
        predicted_yield = max(0.5, min(0.99, predicted_yield))

        # 置信度估算
        confidence = max(0.3, 1.0 - math.log10(scale_factor) * 0.15 - complexity_penalty * 2)

        # 关键参数识别
        critical_params = []
        for param in process_params:
            if param.value < param.min_value or param.value > param.max_value:
                critical_params.append({
                    "name": param.name,
                    "issue": "超出安全范围",
                    "current": param.value,
                    "recommended": param.optimal_value,
                })

        # 风险评估
        risk_level = "low"
        if scale_factor > 100:
            risk_level = "high"
        elif scale_factor > 20:
            risk_level = "medium"

        return ScaleUpPrediction(
            lab_batch_size=lab_batch_size,
            target_batch_size=target_batch_size,
            scale_up_factor=round(scale_factor, 1),
            predicted_yield=round(predicted_yield * 100, 1),
            confidence=round(confidence, 2),
            critical_parameters=critical_params,
            risk_level=risk_level,
        )

    # ─── 设备选型 ───

    def select_equipment(
        self, target_capacity_kg_h: float, equipment_type: str
    ) -> Optional[EquipmentSpec]:
        """根据产能需求推荐设备"""
        candidates = self._equipment_library.get(equipment_type, [])
        if not candidates:
            return None

        # 选容量最接近且不低于需求的
        best = None
        for eq in candidates:
            if eq.capacity_kg_h >= target_capacity_kg_h:
                if best is None or eq.capacity_kg_h < best.capacity_kg_h:
                    best = eq
        return best or candidates[-1]

    def design_production_line(
        self, target_capacity_kg_h: float
    ) -> ProductionLine:
        """设计完整生产线"""
        equipment = []
        for eq_type in self._equipment_library:
            eq = self.select_equipment(target_capacity_kg_h, eq_type)
            if eq:
                equipment.append(eq)

        return ProductionLine(
            id=f"PL-{hash(str(equipment)) % 10000:04d}",
            name=f"{target_capacity_kg_h}kg/h 生产线",
            equipment=equipment,
            max_capacity_kg_h=min((e.capacity_kg_h for e in equipment), default=0),
            min_batch_kg=target_capacity_kg_h * 0.1,
            max_batch_kg=target_capacity_kg_h * 2,
        )

    # ─── 成本估算 ───

    def estimate_cost(
        self,
        ingredients: list[dict],
        batch_size_kg: float,
        labor_rate_per_hour: float = 50,
        energy_rate_per_kwh: float = 0.8,
    ) -> CostEstimate:
        """估算生产成本"""
        raw_material = Decimal("0")
        for ing in ingredients:
            price_per_kg = Decimal(str(ing.get("price_per_kg", 100)))
            amount_kg = Decimal(str(ing.get("amount_kg", 1)))
            raw_material += price_per_kg * amount_kg

        # 能耗（基于批量和平均能耗系数）
        energy_kwh = batch_size_kg * 2.5
        energy = Decimal(str(energy_kwh)) * Decimal(str(energy_rate_per_kwh))

        # 人工
        labor_hours = batch_size_kg / 50 * 2
        labor = Decimal(str(labor_hours)) * Decimal(str(labor_rate_per_hour))

        # 设备折旧
        equipment = Decimal(str(batch_size_kg * 3.5))

        # 维护
        maintenance = equipment * Decimal("0.1")

        total = raw_material + energy + labor + equipment + maintenance
        cost_per_kg = total / Decimal(str(batch_size_kg)) if batch_size_kg > 0 else Decimal("0")

        return CostEstimate(
            raw_material_cost=raw_material,
            energy_cost=energy,
            labor_cost=labor,
            equipment_cost=equipment,
            maintenance_cost=maintenance,
            total_cost=total,
            cost_per_kg=cost_per_kg,
        )

    # ─── 完整仿真 ───

    def simulate_production(
        self,
        ingredients: list[dict],
        process_params: list[ProcessParameter],
        lab_batch_size: float = 1.0,
        target_batch_size: float = 100.0,
    ) -> dict:
        """完整生产仿真"""
        # 放大预测
        scale = self.predict_scale_up(lab_batch_size, target_batch_size, ingredients, process_params)

        # 设备选型
        required_capacity = target_batch_size / 8  # 假设8小时生产
        line = self.design_production_line(required_capacity)

        # 成本估算
        cost = self.estimate_cost(ingredients, target_batch_size)

        # 综合结果
        return {
            "scale_up_prediction": {
                "from_kg": scale.lab_batch_size,
                "to_kg": scale.target_batch_size,
                "factor": scale.scale_up_factor,
                "predicted_yield_pct": scale.predicted_yield,
                "confidence": scale.confidence,
                "risk_level": scale.risk_level,
            },
            "production_line": {
                "name": line.name,
                "equipment": [{"name": e.name, "type": e.equipment_type, "capacity": e.capacity_kg_h} for e in line.equipment],
                "max_capacity": line.max_capacity_kg_h,
            },
            "cost_estimate": cost.breakdown,
        }

    # ─── 内部方法 ───

    @staticmethod
    def _estimate_viscosity_factor(ingredients: list[dict]) -> float:
        """估算黏度对收率的影响"""
        thickeners = ["淀粉", "胶体", "糊精", "黄原胶", "CMC"]
        count = sum(1 for ing in ingredients if any(t in ing.get("name", "") for t in thickeners))
        return count * 0.03

    @staticmethod
    def _estimate_heat_sensitivity(ingredients: list[dict]) -> float:
        """估算热敏性对收率的影响"""
        sensitive = ["维生素", "酶", "益生菌", "多肽", "蛋白"]
        count = sum(1 for ing in ingredients if any(s in ing.get("name", "") for s in sensitive))
        return count * 0.04

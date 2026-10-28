"""
数字孪生领域实体（M3.1）

生产线数字孪生核心实体：工艺参数、设备模型、仿真结果、成本估算。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal


@dataclass
class ProcessParameter:
    """工艺参数"""
    name: str
    value: float
    unit: str
    min_value: float
    max_value: float
    optimal_value: float
    description: str = ""


@dataclass
class EquipmentSpec:
    """设备规格"""
    name: str
    equipment_type: str  # homogenizer/spray_dryer/sterilizer/filling_line
    capacity_kg_h: float
    power_kw: float
    water_consumption_l_h: float = 0
    steam_consumption_kg_h: float = 0
    maintenance_cost_per_hour: float = 0


@dataclass
class ScaleUpResult:
    """中试放大结果"""
    batch_size_kg: float
    predicted_yield_pct: float
    quality_score: float
    energy_consumption_kwh: float
    processing_time_min: float
    risk_factors: list[str] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)


@dataclass
class CostEstimate:
    """成本估算"""
    raw_material_cost: Decimal
    energy_cost: Decimal
    labor_cost: Decimal
    equipment_cost: Decimal
    maintenance_cost: Decimal
    total_cost: Decimal
    cost_per_kg: Decimal

    @property
    def breakdown(self) -> dict:
        return {
            "原料成本": float(self.raw_material_cost),
            "能耗成本": float(self.energy_cost),
            "人工成本": float(self.labor_cost),
            "设备折旧": float(self.equipment_cost),
            "维护成本": float(self.maintenance_cost),
            "总计": float(self.total_cost),
            "每公斤成本": float(self.cost_per_kg),
        }


@dataclass
class ProductionLine:
    """生产线模型"""
    id: str
    name: str
    equipment: list[EquipmentSpec] = field(default_factory=list)
    max_capacity_kg_h: float = 0
    min_batch_kg: float = 0
    max_batch_kg: float = 0


@dataclass
class ScaleUpPrediction:
    """放大预测结果"""
    lab_batch_size: float
    target_batch_size: float
    scale_up_factor: float
    predicted_yield: float
    confidence: float
    critical_parameters: list[dict] = field(default_factory=list)
    risk_level: str = "medium"  # low/medium/high
    simulation_time_s: float = 0

"""营养成分标签 Pydantic 模型（GB 28050-2011）"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ServingInfo(BaseModel):
    """份量信息"""

    serving_size_g: float = Field(..., ge=1, description="每份重量(克)")
    servings_per_container: int = Field(1, ge=1, le=100, description="每容器份数")
    package_size_g: float = Field(0.0, ge=0, description="包装总重量(克)")


class NutritionLabelItem(BaseModel):
    """营养成分表一行"""

    nutrient: str = Field(..., description="营养素名称(英文)")
    nutrient_cn: str = Field("", description="营养素中文名称")
    unit: str = Field(..., description="单位(g/mg/kJ)")
    is_mandatory: bool = Field(False, description="是否强制标示")
    per_100g: float = Field(0.0, description="每100g含量")
    per_serving: Optional[float] = Field(None, description="每份含量")
    nrv_percent: Optional[float] = Field(None, description="NRV百分比(%)")
    claim: Optional[str] = Field(None, description="营养声称")


class ComplianceCheck(BaseModel):
    """合规性检查结果"""

    is_compliant: bool = Field(..., description="是否合规")
    standard: str = Field("GB 28050-2011", description="适用标准")
    violations: List[Dict[str, Any]] = Field(default_factory=list, description="违规项")
    warnings: List[Dict[str, Any]] = Field(default_factory=list, description="警告项")


class NutritionLabelResult(BaseModel):
    """营养标签生成结果"""

    formula_id: Optional[int] = Field(None, description="配方ID")
    formula_name: str = Field("", description="配方名称")

    serving_info: ServingInfo
    per_100g: Dict[str, float] = Field(default_factory=dict, description="每100g营养成分")
    per_serving: Dict[str, float] = Field(default_factory=dict, description="每份营养成分")
    nrv_percentages: Dict[str, float] = Field(default_factory=dict, description="NRV百分比")

    label_items: List[NutritionLabelItem] = Field(default_factory=list, description="格式化标签行")
    energy_check: Dict[str, float] = Field(default_factory=dict, description="能量校验")
    claims: List[str] = Field(default_factory=list, description="营养声称")
    compliance: ComplianceCheck = Field(default_factory=ComplianceCheck)

    unknown_ingredients: List[str] = Field(default_factory=list, description="未识别原料")
    warnings: List[str] = Field(default_factory=list, description="警告信息")
    generated_at: str = Field(..., description="生成时间")


class NutritionCalculateRequest(BaseModel):
    """营养标签计算请求"""

    formula_id: int = Field(..., description="配方ID")
    serving_size_g: float = Field(100.0, ge=1, le=500, description="每份重量(克)")
    servings_per_container: int = Field(1, ge=1, le=100, description="每容器份数")

"""
实验相关 Pydantic 模式
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ExperimentBase(BaseModel):
    """实验基础模式"""
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    formula_id: Optional[int] = None
    objectives: Optional[list[str]] = None
    methodology: Optional[str] = None
    parameters: Optional[dict] = None
    materials: Optional[list] = None
    equipment: Optional[list] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ExperimentCreate(ExperimentBase):
    """实验创建"""
    pass


class ExperimentUpdate(BaseModel):
    """实验更新"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    formula_id: Optional[int] = None
    objectives: Optional[list[str]] = None
    methodology: Optional[str] = None
    parameters: Optional[dict] = None
    materials: Optional[list] = None
    equipment: Optional[list] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ExperimentResponse(ExperimentBase):
    """实验响应"""
    id: int
    code: str
    status: str
    researcher_id: int
    formula_name: Optional[str] = None
    researcher_name: Optional[str] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    results: Optional[dict] = None
    conclusions: Optional[str] = None
    recommendations: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ExperimentListResponse(BaseModel):
    """实验列表响应"""
    items: list[ExperimentResponse]
    total: int
    page: int
    page_size: int


class ExperimentDataBase(BaseModel):
    """实验数据基础"""
    parameter: str = Field(..., min_length=1, max_length=200)
    value: Optional[str] = None
    unit: Optional[str] = None
    notes: Optional[str] = None


class ExperimentDataResponse(BaseModel):
    """实验数据响应 — 与 experiment_data 真实列对齐。
    模型属性 data_type/data_value 通过 @property 别名为 parameter/value。"""
    id: int
    experiment_id: int
    parameter: Optional[str] = None  # 来自 data_type
    value: Optional[str] = None  # 来自 data_value
    unit: Optional[str] = None
    notes: Optional[str] = None
    measurement_time: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}

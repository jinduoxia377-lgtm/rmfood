"""RMFOOD 工作流相关 Pydantic 模式"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class WorkflowBase(BaseModel):
    """工作流基础模式"""
    name: str = Field(..., min_length=1, max_length=200)
    workflow_type: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None
    config: Optional[dict] = None


class WorkflowCreate(WorkflowBase):
    """工作流创建"""
    pass


class WorkflowUpdate(BaseModel):
    """工作流更新"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    config: Optional[dict] = None


class WorkflowResponse(WorkflowBase):
    """工作流响应"""
    id: int
    status: str
    result: Optional[dict] = None
    error_message: Optional[str] = None
    created_by: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkflowTaskBase(BaseModel):
    """工作流任务基础模式"""
    step_order: int = Field(..., ge=1)
    name: str = Field(..., min_length=1, max_length=200)
    task_type: str = Field(..., min_length=1, max_length=50)
    input_data: Optional[dict] = None


class WorkflowTaskCreate(WorkflowTaskBase):
    """工作流任务创建"""
    workflow_id: int


class WorkflowTaskResponse(WorkflowTaskBase):
    """工作流任务响应"""
    id: int
    workflow_id: int
    status: str
    output_data: Optional[dict] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}

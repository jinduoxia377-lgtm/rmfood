"""RMFOOD 通知相关 Pydantic 模式"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class NotificationBase(BaseModel):
    """通知基础模式"""
    title: str = Field(..., min_length=1, max_length=200)
    content: Optional[str] = None
    link: Optional[str] = Field(None, max_length=500)
    metadata: Optional[dict] = None


class NotificationCreate(NotificationBase):
    """通知创建"""
    user_id: int
    type: str = Field(..., pattern="^(system|formula_review|experiment_complete|ai_task_done|data_sync)$")


class NotificationUpdate(BaseModel):
    """通知更新"""
    status: str = Field(..., pattern="^(unread|read|archived)$")


class NotificationResponse(BaseModel):
    """通知响应"""
    id: int
    user_id: int
    type: str
    status: str
    title: str
    content: Optional[str] = None
    link: Optional[str] = None
    metadata: Optional[dict] = None
    read_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    """通知列表响应"""
    items: list[NotificationResponse]
    total: int
    page: int
    page_size: int

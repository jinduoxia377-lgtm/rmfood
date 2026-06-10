"""RMFOOD 通知系统 Pydantic Schemas（扩展版）

用于云端同步、团队协作和AI辅助模块的通知功能。
支持多类型通知、已读状态管理和偏好设置。
"""
from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
from ..models.enums import NotificationType


class NotificationItem(BaseModel):
    """通知项（完整版）"""
    id: int
    type: NotificationType
    title: str
    content: Optional[str]
    metadata_: Optional[Dict[str, Any]] = Field(None, alias="metadata")
    is_read: bool
    read_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    """通知列表响应"""
    notifications: List[NotificationItem]
    total: int
    unread_count: int
    page: int
    page_size: int


class NotificationDetailResponse(NotificationItem):
    """通知详情响应"""
    actions: List[Dict[str, Any]] = Field(default_factory=list, description="可执行的操作")


class UnreadCountResponse(BaseModel):
    """未读数量响应"""
    unread_count: int
    last_read_at: Optional[datetime]


class MarkReadResponse(BaseModel):
    """标记已读响应"""
    success: bool = True
    message: str = "操作成功"
    notification_id: int
    is_read: bool


class MarkAllReadResponse(BaseModel):
    """全部标记已读响应"""
    success: bool = True
    message: str = "所有通知已标记为已读"
    marked_count: int
    timestamp: datetime


class DeleteNotificationResponse(BaseModel):
    """删除通知响应"""
    success: bool = True
    message: str = "通知已删除"
    deleted_id: int


class NotificationPreferencesUpdate(BaseModel):
    """更新通知偏好请求"""
    email_enabled: Optional[bool] = Field(None, description="启用邮件通知")
    push_enabled: Optional[bool] = Field(None, description="启用推送通知")
    team_invite: Optional[bool] = Field(None, description="团队邀请通知")
    sync_status: Optional[bool] = Field(None, description="同步状态通知")
    ai_task_complete: Optional[bool] = Field(None, description="AI任务完成通知")
    system_alert: Optional[bool] = Field(None, description="系统告警通知")
    formula_review: Optional[bool] = Field(None, description="配方审核通知")
    experiment_complete: Optional[bool] = Field(None, description="实验完成通知")
    quiet_hours_start: Optional[str] = Field(None, pattern=r"^(0?[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$", description="免打扰开始时间 (HH:MM)")
    quiet_hours_end: Optional[str] = Field(None, pattern=r"^(0?[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$", description="免打扰结束时间 (HH:MM)")


class NotificationPreferencesResponse(BaseModel):
    """通知偏好设置响应"""
    user_id: int
    preferences: Dict[str, Any]
    updated_at: Optional[datetime]


class NotificationFilterParams(BaseModel):
    """通知筛选参数"""
    type: Optional[str] = Field(None, description="按类型筛选")
    is_read: Optional[bool] = Field(None, description="是否已读")
    start_date: Optional[datetime] = Field(None, description="起始时间")
    end_date: Optional[datetime] = Field(None, description="结束时间")

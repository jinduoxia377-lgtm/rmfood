"""RMFOOD 云端同步 Pydantic Schemas

用于云端同步模块的请求/响应模型定义。
支持数据推送、拉取、冲突检测和设备管理。
"""
from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, Field
from ..models.enums import SyncAction, DeviceType


class SyncChangeItem(BaseModel):
    """同步变更项"""
    entity_type: str = Field(..., description="实体类型: formula/experiment/ingredient等", examples=["formula"])
    entity_id: int = Field(..., description="实体ID")
    action: SyncAction = Field(..., description="操作类型: create/update/delete")
    data: dict = Field(default_factory=dict, description="变更数据")
    version: int = Field(1, ge=1, description="版本号")


class ConflictItem(BaseModel):
    """冲突信息"""
    entity_type: str
    entity_id: int
    local_version: int
    server_version: int
    local_data: dict
    server_data: dict
    conflict_reason: str = Field(default="concurrent_modification", description="冲突原因")


class SyncPushRequest(BaseModel):
    """同步推送请求"""
    device_id: str = Field(..., min_length=1, max_length=100, description="设备唯一标识")
    changes: List[SyncChangeItem] = Field(..., min_length=1, max_length=1000, description="变更列表")
    client_timestamp: datetime = Field(..., description="客户端时间戳")


class SyncPushResponse(BaseModel):
    """同步推送响应"""
    success: bool = True
    accepted_count: int = Field(0, ge=0, description="成功接受的变更数")
    conflicts: List[ConflictItem] = Field(default_factory=list, description="冲突列表")
    server_timestamp: datetime = Field(..., description="服务器时间戳")
    next_sync_token: Optional[str] = Field(None, description="下次同步令牌")


class SyncPullResponse(BaseModel):
    """同步拉取响应"""
    server_changes: List[SyncChangeItem] = Field(default_factory=list, description="服务器变更列表")
    last_sync_timestamp: datetime = Field(..., description="上次同步时间戳")
    conflicts: List[ConflictItem] = Field(default_factory=list, description="冲突列表")
    has_more: bool = Field(False, description="是否还有更多数据")
    sync_token: str = Field(..., description="同步令牌")


class ResolveConflictRequest(BaseModel):
    """解决冲突请求"""
    entity_type: str = Field(..., description="实体类型")
    entity_id: int = Field(..., description="实体ID")
    resolved_data: dict = Field(..., description="合并后的数据")
    resolution_strategy: str = Field(
        default="merge",
        pattern="^(local|server|merge)$",
        description="解决策略: local/server/merge"
    )
    conflict_ids: List[int] = Field(default_factory=list, description="解决的冲突ID列表")


class ResolveConflictResponse(BaseModel):
    """解决冲突响应"""
    success: bool = True
    merged_entity_id: int
    new_version: int
    timestamp: datetime


class DeviceStatusEnum(str):
    """设备状态枚举"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    OFFLINE = "offline"
    SYNCING = "syncing"


class DeviceInfo(BaseModel):
    """设备信息"""
    id: int
    device_id: str
    user_id: int
    device_type: DeviceType
    device_name: str
    last_sync_at: Optional[datetime]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class DeviceRegisterRequest(BaseModel):
    """设备注册请求"""
    device_id: str = Field(..., min_length=1, max_length=100, description="设备唯一标识")
    device_type: DeviceType = Field(..., description="设备类型")
    device_name: str = Field(..., min_length=1, max_length=100, description="设备名称")


class DeviceRegisterResponse(BaseModel):
    """设备注册响应"""
    success: bool = True
    device_id: str
    registered_at: datetime
    message: str = "设备注册成功"


class SyncStatusResponse(BaseModel):
    """同步状态响应"""
    last_sync_time: Optional[datetime] = Field(None, description="最后同步时间")
    pending_changes_count: int = Field(0, ge=0, description="待处理变更数量")
    device_status: str = Field("offline", description="设备状态: active/inactive/offline/syncing")
    total_syncs: int = Field(0, ge=0, description="总同步次数")
    last_error: Optional[str] = Field(None, description="最后错误信息")


class SyncLogItem(BaseModel):
    """同步日志项"""
    id: int
    action: SyncAction
    entity_type: str
    entity_id: Optional[int]
    status: str
    timestamp: datetime
    error_msg: Optional[str]

    model_config = {"from_attributes": True}


class SyncHistoryResponse(BaseModel):
    """同步历史响应"""
    logs: List[SyncLogItem]
    total: int
    page: int
    page_size: int

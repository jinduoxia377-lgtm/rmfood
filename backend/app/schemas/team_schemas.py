"""RMFOOD 团队协作 Pydantic Schemas

用于团队管理、成员权限和邀请功能的请求/响应模型定义。
支持四级权限体系：owner/admin/member/guest。
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

from ..models.enums import TeamRole


class TeamCreate(BaseModel):
    """创建团队请求"""
    name: str = Field(..., min_length=2, max_length=100, description="团队名称", examples=["研发中心A组"])
    description: Optional[str] = Field(None, max_length=500, description="团队描述")
    settings: Optional[Dict[str, Any]] = Field(None, description="团队设置（JSON格式）")


class TeamUpdate(BaseModel):
    """更新团队信息请求"""
    name: Optional[str] = Field(None, min_length=2, max_length=100, description="团队名称")
    description: Optional[str] = Field(None, max_length=500, description="团队描述")
    settings: Optional[Dict[str, Any]] = Field(None, description="团队设置")
    is_archived: Optional[bool] = Field(None, description="是否归档")


class TeamResponse(BaseModel):
    """团队信息响应"""
    id: int
    name: str
    description: Optional[str]
    owner_id: int
    settings: Optional[Dict[str, Any]]
    is_archived: bool
    member_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TeamListResponse(BaseModel):
    """团队列表响应"""
    teams: List[TeamResponse]
    total: int


class TeamMemberInfo(BaseModel):
    """团队成员信息"""
    id: int
    user_id: int
    username: str
    role: TeamRole
    joined_at: datetime
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class TeamDetailResponse(TeamResponse):
    """团队详情响应（含成员列表）"""
    members: List[TeamMemberInfo] = []
    invite_link: Optional[str] = None


class TeamMemberUpdate(BaseModel):
    """更新成员角色请求"""
    role: TeamRole = Field(..., description="新角色: owner/admin/member/guest")
    user_id: int = Field(..., description="用户ID")


class InviteMemberRequest(BaseModel):
    """邀请成员请求（按邮箱邀请）"""
    email: str = Field(
        ...,
        min_length=3,
        max_length=254,
        description="被邀请用户的邮箱",
        examples=["user@example.com"],
    )
    role: TeamRole = Field(default=TeamRole.MEMBER, description="初始角色")

    @field_validator("email")
    @classmethod
    def _validate_email_format(cls, v: str) -> str:
        import re

        normalized = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", normalized):
            raise ValueError("邮箱格式不正确")
        return normalized


class InviteLinkResponse(BaseModel):
    """邀请链接响应"""
    invite_code: str
    invite_url: str
    expires_at: Optional[datetime]
    max_uses: int
    used_count: int = 0


class JoinTeamRequest(BaseModel):
    """通过邀请码加入团队请求"""
    invite_code: str = Field(..., min_length=1, description="邀请码")


class NotificationItem(BaseModel):
    """通知项"""
    id: int
    type: str
    title: str
    content: Optional[str]
    is_read: bool
    created_at: datetime
    metadata: Optional[Dict[str, Any]] = None

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    """通知列表响应"""
    notifications: List[NotificationItem]
    total: int
    unread_count: int


class NotificationPreferences(BaseModel):
    """通知偏好设置"""
    email_enabled: bool = Field(True, description="是否启用邮件通知")
    push_enabled: bool = Field(True, description="是否启用推送通知")
    team_invite: bool = Field(True, description="团队邀请通知")
    sync_status: bool = Field(True, description="同步状态通知")
    ai_task_complete: bool = Field(True, description="AI任务完成通知")
    system_alert: bool = Field(True, description="系统告警通知")

"""RMFOOD 版本控制 Pydantic Schemas

用于Prompt模板版本管理的请求/响应模型定义。
支持版本创建、历史查看、差异对比和回滚操作。
"""
from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, Field


class PromptVersionCreate(BaseModel):
    """创建新版本请求"""
    version_number: str = Field(..., pattern=r"^\d+\.\d+$", description="版本号 (如: 1.0, 1.1, 2.0)", examples=["1.1"])
    content_snapshot: str = Field(..., min_length=1, description="内容快照（完整内容）")
    changelog: Optional[str] = Field(None, max_length=2000, description="变更日志")
    diff_summary: Optional[str] = Field(None, max_length=500, description="变更摘要")


class PromptVersionResponse(BaseModel):
    """版本信息响应"""
    id: int
    prompt_template_id: int
    version_number: int
    content_snapshot: str
    diff_summary: Optional[str]
    changelog: Optional[str]
    created_by: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class VersionListResponse(BaseModel):
    """版本列表响应"""
    versions: list[PromptVersionResponse]
    total: int
    current_version: str


class DiffItem(BaseModel):
    """差异项"""
    type: str = Field(..., pattern="^(add|remove|modify|unchanged)$", description="变更类型")
    line_number: int
    content: str
    old_content: Optional[str] = None


class DiffResponse(BaseModel):
    """版本对比响应"""
    version_1: PromptVersionResponse
    version_2: PromptVersionResponse
    diffs: list[DiffItem]
    summary: str = Field(..., description="差异摘要统计")


class RollbackRequest(BaseModel):
    """回滚请求"""
    create_new_version: bool = Field(True, description="是否基于回滚版本创建新版本")
    rollback_reason: Optional[str] = Field(None, max_length=500, description="回滚原因")


class RollbackResponse(BaseModel):
    """回滚响应"""
    success: bool = True
    message: str
    rolled_back_to_version: int
    new_version_id: Optional[int] = None
    timestamp: datetime


class VersionTag(BaseModel):
    """版本标签"""
    name: str
    color: str = "#1890ff"
    description: Optional[str] = None

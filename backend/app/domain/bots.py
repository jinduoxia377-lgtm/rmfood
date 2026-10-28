"""
多智能体协作平台领域实体（DS Bot 移植 v1.2）

定义 Bot 领域核心类型：Bot 状态/可见性枚举、AIBot 聚合、Bot 记忆条目。
领域层零外部依赖（仅标准库 dataclasses/enum），持久化由 infrastructure 实现端口。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class BotStatus(Enum):
    """Bot 生命周期状态"""
    ACTIVE = "active"
    DISABLED = "disabled"
    ARCHIVED = "archived"


class BotVisibility(Enum):
    """Bot 可见性：private（仅创建者）/ org（组织共享）"""
    PRIVATE = "private"
    ORG = "org"


class MemoryType(Enum):
    """记忆类型"""
    PREFERENCE = "preference"          # 用户偏好
    FACT = "fact"                      # 项目事实
    CONTRAINDICATION = "contraindication"  # 禁忌/过敏原


@dataclass
class BotMemory:
    """Bot 跨会话记忆条目"""
    bot_id: int
    user_id: int
    content: str
    memory_type: MemoryType = MemoryType.PREFERENCE
    importance: int = 3                # 1-5，注入时按重要性截断
    source: Optional[str] = None       # 来源（会话 ID / manual）
    id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "bot_id": self.bot_id,
            "user_id": self.user_id,
            "memory_type": self.memory_type.value,
            "content": self.content,
            "importance": self.importance,
            "source": self.source,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


@dataclass
class AIBot:
    """AI Bot 聚合实体

    - persona_prompt: 人设 System Prompt（核心）
    - model_config_id: 关联 ai_model_configs.id，继承场景的 API/密钥/兜底链
    - provider/model_id: 具体模型选择（M1 修订：独立于场景 model_type）
    - capabilities: 工具白名单（须与工具注册表校验）
    """
    tenant_id: int
    created_by: int
    name: str
    persona_prompt: str
    avatar: Optional[str] = None
    description: Optional[str] = None
    model_config_id: Optional[int] = None
    model_type: str = "llm"
    provider: Optional[str] = None
    model_id: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 16000
    capabilities: list[str] = field(default_factory=list)
    is_chief: bool = False
    is_system: bool = False
    visibility: BotVisibility = BotVisibility.PRIVATE
    status: BotStatus = BotStatus.ACTIVE
    id: Optional[int] = None
    deleted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def to_dict(self, include_persona: bool = True) -> dict[str, Any]:
        d: dict[str, Any] = {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "created_by": self.created_by,
            "name": self.name,
            "avatar": self.avatar,
            "description": self.description,
            "model_config_id": self.model_config_id,
            "model_type": self.model_type,
            "provider": self.provider,
            "model_id": self.model_id,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "capabilities": list(self.capabilities),
            "is_chief": self.is_chief,
            "is_system": self.is_system,
            "visibility": self.visibility.value,
            "status": self.status.value,
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_persona:
            d["persona_prompt"] = self.persona_prompt
        return d


# ════════════════════════════════════════════════════════════
# 群聊协作领域实体（Phase 2）
# ════════════════════════════════════════════════════════════


@dataclass
class GroupMember:
    """群聊成员（Bot）"""
    group_id: int
    bot_id: int
    role: str = "member"           # admin / member
    id: Optional[int] = None
    joined_at: Optional[datetime] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "group_id": self.group_id,
            "bot_id": self.bot_id,
            "role": self.role,
            "joined_at": self.joined_at.isoformat() if self.joined_at else None,
        }


@dataclass
class GroupMessage:
    """群聊消息"""
    group_id: int
    sender_type: str = "user"        # user / bot
    content: str = ""
    sender_user_id: Optional[int] = None
    sender_bot_id: Optional[int] = None
    sender_bot_name: Optional[str] = None
    reply_to: Optional[int] = None
    mentioned_bot_ids: list[int] = field(default_factory=list)
    task_execution_id: Optional[str] = None
    id: Optional[int] = None
    created_at: Optional[datetime] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "group_id": self.group_id,
            "sender_type": self.sender_type,
            "sender_user_id": self.sender_user_id,
            "sender_bot_id": self.sender_bot_id,
            "sender_bot_name": self.sender_bot_name,
            "content": self.content,
            "reply_to": self.reply_to,
            "mentioned_bot_ids": list(self.mentioned_bot_ids),
            "task_execution_id": self.task_execution_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


@dataclass
class GroupSession:
    """群聊会话"""
    tenant_id: int
    name: str
    chief_bot_id: int
    created_by: int
    members: list[GroupMember] = field(default_factory=list)
    id: Optional[int] = None
    archived_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "name": self.name,
            "chief_bot_id": self.chief_bot_id,
            "created_by": self.created_by,
            "members": [m.to_dict() for m in self.members],
            "archived_at": self.archived_at.isoformat() if self.archived_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

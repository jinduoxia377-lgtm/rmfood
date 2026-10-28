"""
多智能体协作平台端口定义（六边形架构 Ports）

- BotRepository: Bot 生命周期 CRUD + 租户/可见性查询
- BotMemoryStore: 记忆条目写入/检索/删除
- GroupChatRepository: 群聊会话与消息持久化（Phase 2 实现）
- UsageRecorder: Token 用量落库（Phase 3 实现，端口先行）
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Optional, Sequence

from .bots import AIBot, BotMemory, BotStatus


class BotRepository(ABC):
    """Bot 仓库端口"""

    @abstractmethod
    async def create(self, bot: AIBot) -> AIBot:
        """创建 Bot，返回带 id 的实体"""

    @abstractmethod
    async def get_by_id(self, bot_id: int, tenant_id: int, include_deleted: bool = False) -> Optional[AIBot]:
        """按 id + 租户查询单个 Bot"""

    @abstractmethod
    async def list_bots(
        self,
        tenant_id: int,
        user_id: Optional[int] = None,
        status: Optional[BotStatus] = None,
        include_deleted: bool = False,
        offset: int = 0,
        limit: int = 100,
    ) -> tuple[list[AIBot], int]:
        """列出 Bot。user_id 提供时返回「本人私有 + 组织共享」可见范围。"""

    @abstractmethod
    async def update(self, bot: AIBot) -> AIBot:
        """更新 Bot 实体（全量保存）"""

    @abstractmethod
    async def soft_delete(self, bot_id: int, tenant_id: int) -> bool:
        """软删除 Bot"""

    @abstractmethod
    async def restore(self, bot_id: int, tenant_id: int) -> bool:
        """恢复软删除的 Bot"""

    @abstractmethod
    async def count_by_creator(self, tenant_id: int, user_id: int) -> int:
        """统计某用户在租户内创建的 Bot 数（用于配额/分页）"""


class BotMemoryStore(ABC):
    """Bot 记忆端口"""

    @abstractmethod
    async def add(self, memory: BotMemory) -> BotMemory:
        """写入一条记忆"""

    @abstractmethod
    async def list_memories(self, bot_id: int, user_id: int, limit: int = 100) -> list[BotMemory]:
        """列出某用户在某 Bot 下的记忆（按重要性倒序）"""

    @abstractmethod
    async def delete(self, memory_id: int, bot_id: int, user_id: int) -> bool:
        """删除一条记忆"""

    @abstractmethod
    async def top_memories(
        self, bot_id: int, user_id: int, limit: int = 5, min_importance: int = 1,
    ) -> list[BotMemory]:
        """取最重要的 N 条记忆，用于对话注入"""


class GroupChatRepository(ABC):
    """群聊仓库端口（Phase 2）"""

    @abstractmethod
    async def create_group(
        self, tenant_id: int, name: str, chief_bot_id: int, created_by: int,
        member_bot_ids: Sequence[int],
    ) -> Any:
        """创建群聊（含成员写入）"""

    @abstractmethod
    async def list_groups(
        self, tenant_id: int, user_id: int, offset: int = 0, limit: int = 100,
    ) -> tuple[list[Any], int]:
        """列出用户可见的群聊（本人创建 + 成员含本人创建的 Bot）"""

    @abstractmethod
    async def get_group(self, group_id: int, tenant_id: int) -> Any | None:
        """获取群聊详情（含成员）"""

    @abstractmethod
    async def add_members(self, group_id: int, bot_ids: Sequence[int], role: str = "member") -> list[Any]:
        """向群聊添加成员 Bot"""

    @abstractmethod
    async def remove_member(self, group_id: int, bot_id: int) -> bool:
        """从群聊移除成员 Bot"""

    @abstractmethod
    async def add_message(
        self,
        group_id: int,
        sender_type: str,
        content: str,
        sender_user_id: int | None = None,
        sender_bot_id: int | None = None,
        reply_to: int | None = None,
        mentioned_bot_ids: Sequence[int] | None = None,
        task_execution_id: str | None = None,
    ) -> Any:
        """写入群聊消息"""

    @abstractmethod
    async def list_messages(
        self, group_id: int, limit: int = 100, before_id: int | None = None,
    ) -> list[Any]:
        """列出群聊消息（按时间正序）"""


class UsageRecorder(ABC):
    """用量记录端口（Phase 3 实现）"""

    @abstractmethod
    async def record(
        self,
        tenant_id: int,
        bot_id: Optional[int],
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        endpoint: str,
    ) -> Any:
        """记录一次 LLM 调用用量"""

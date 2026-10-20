"""
多智能体协作平台基础设施实现（SQLAlchemy）

实现 domain/bot_ports.py 定义的四个端口：
- SQLAlchemyBotRepository: ai_bots 表 CRUD + 可见性过滤 + 软删除
- SQLAlchemyBotMemoryStore: ai_bot_memories 表读写
- SQLAlchemyGroupChatRepository: 群聊会话/成员/消息持久化（Phase 2）
- UsageRecorder: Phase 3 实现，暂抛 NotImplemented

映射说明：domain 实体 <-> SQLAlchemy 模型字段同名，提供 to_domain 转换。
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional, Sequence

from sqlalchemy import select, func, or_, and_, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..domain.bots import (
    AIBot, BotMemory, BotStatus, BotVisibility, MemoryType,
    GroupSession, GroupMember, GroupMessage,
)
from ..domain.bot_ports import (
    BotRepository, BotMemoryStore, GroupChatRepository, UsageRecorder,
)
from ..models.bot import AIBot as AIBotModel
from ..models.bot import BotMemory as BotMemoryModel

logger = logging.getLogger(__name__)


def _to_domain_group_message(m) -> GroupMessage:
    return GroupMessage(
        id=m.id,
        group_id=m.group_id,
        sender_type=m.sender_type,
        sender_user_id=m.sender_user_id,
        sender_bot_id=m.sender_bot_id,
        sender_bot_name=m.sender_bot_name,
        content=m.content,
        reply_to=m.reply_to,
        mentioned_bot_ids=list(m.mentioned_bot_ids or []),
        task_execution_id=m.task_execution_id,
        created_at=m.created_at,
    )


def _status_value(status: Optional[BotStatus]) -> Optional[str]:
    return status.value if status is not None else None


def _to_domain_bot(m: AIBotModel) -> AIBot:
    """SQLAlchemy AIBot -> domain AIBot"""
    return AIBot(
        id=m.id,
        tenant_id=m.tenant_id,
        created_by=m.created_by,
        name=m.name,
        avatar=m.avatar,
        description=m.description,
        persona_prompt=m.persona_prompt,
        model_config_id=m.model_config_id,
        model_type=m.model_type,
        provider=m.provider,
        model_id=m.model_id,
        temperature=m.temperature,
        max_tokens=m.max_tokens,
        capabilities=list(m.capabilities or []),
        is_chief=m.is_chief,
        is_system=m.is_system,
        visibility=BotVisibility(m.visibility) if m.visibility else BotVisibility.PRIVATE,
        status=BotStatus(m.status) if m.status else BotStatus.ACTIVE,
        deleted_at=m.deleted_at,
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


def _to_domain_memory(m: BotMemoryModel) -> BotMemory:
    return BotMemory(
        id=m.id,
        bot_id=m.bot_id,
        user_id=m.user_id,
        content=m.content,
        memory_type=MemoryType(m.memory_type) if m.memory_type else MemoryType.PREFERENCE,
        importance=m.importance,
        source=m.source,
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


class SQLAlchemyBotRepository(BotRepository):
    """ai_bots 表的 SQLAlchemy 实现"""

    def __init__(self, db: AsyncSession):
        self._db = db

    async def create(self, bot: AIBot) -> AIBot:
        m = AIBotModel(
            tenant_id=bot.tenant_id,
            created_by=bot.created_by,
            name=bot.name,
            avatar=bot.avatar,
            description=bot.description,
            persona_prompt=bot.persona_prompt,
            model_config_id=bot.model_config_id,
            model_type=bot.model_type,
            provider=bot.provider,
            model_id=bot.model_id,
            temperature=bot.temperature,
            max_tokens=bot.max_tokens,
            capabilities=list(bot.capabilities),
            is_chief=bot.is_chief,
            is_system=bot.is_system,
            visibility=bot.visibility.value,
            status=bot.status.value,
        )
        self._db.add(m)
        await self._db.commit()
        await self._db.refresh(m)
        logger.info(f"[BotRepository] 创建 Bot: id={m.id}, name={m.name}")
        return _to_domain_bot(m)

    async def get_by_id(self, bot_id: int, tenant_id: Optional[int], include_deleted: bool = False) -> Optional[AIBot]:
        q = select(AIBotModel).where(AIBotModel.id == bot_id)
        if tenant_id is not None:
            q = q.where(AIBotModel.tenant_id == tenant_id)
        if not include_deleted:
            q = q.where(AIBotModel.deleted_at.is_(None))
        m = (await self._db.execute(q)).scalar_one_or_none()
        return _to_domain_bot(m) if m is not None else None

    async def list_bots(
        self,
        tenant_id: Optional[int],
        user_id: Optional[int] = None,
        status: Optional[BotStatus] = None,
        include_deleted: bool = False,
        offset: int = 0,
        limit: int = 100,
    ) -> tuple[list[AIBot], int]:
        conds: list[Any] = []
        # 全局模式（tenant_id=None）：不过滤租户（与 require_tenant 的 global 语义一致）
        if tenant_id is not None:
            conds.append(AIBotModel.tenant_id == tenant_id)
        if not include_deleted:
            conds.append(AIBotModel.deleted_at.is_(None))
        if status is not None:
            conds.append(AIBotModel.status == status.value)
        # 可见性：本人私有 + 组织共享
        if user_id is not None:
            conds.append(
                or_(
                    AIBotModel.visibility == BotVisibility.ORG.value,
                    AIBotModel.created_by == user_id,
                )
            )
        base = select(AIBotModel).where(*conds)
        count_q = select(func.count()).select_from(base.subquery())
        total = (await self._db.execute(count_q)).scalar_one()
        q = base.order_by(AIBotModel.is_chief.desc(), AIBotModel.updated_at.desc()).offset(offset).limit(limit)
        rows = (await self._db.execute(q)).scalars().all()
        return [_to_domain_bot(m) for m in rows], int(total or 0)

    async def update(self, bot: AIBot) -> AIBot:
        q = select(AIBotModel).where(
            AIBotModel.id == bot.id,
            AIBotModel.deleted_at.is_(None),
        )
        if bot.tenant_id is not None:
            q = q.where(AIBotModel.tenant_id == bot.tenant_id)
        m = (await self._db.execute(q)).scalar_one_or_none()
        if m is None:
            raise ValueError(f"Bot 不存在或已删除: id={bot.id}")
        m.name = bot.name
        m.avatar = bot.avatar
        m.description = bot.description
        m.persona_prompt = bot.persona_prompt
        m.model_config_id = bot.model_config_id
        m.model_type = bot.model_type
        m.provider = bot.provider
        m.model_id = bot.model_id
        m.temperature = bot.temperature
        m.max_tokens = bot.max_tokens
        m.capabilities = list(bot.capabilities)
        m.visibility = bot.visibility.value
        m.status = bot.status.value
        await self._db.commit()
        await self._db.refresh(m)
        return _to_domain_bot(m)

    async def soft_delete(self, bot_id: int, tenant_id: Optional[int]) -> bool:
        from app.models.utils import now_utc_mapped
        conds = [AIBotModel.id == bot_id, AIBotModel.deleted_at.is_(None)]
        if tenant_id is not None:
            conds.append(AIBotModel.tenant_id == tenant_id)
        res = await self._db.execute(
            update(AIBotModel)
            .where(*conds)
            .values(deleted_at=now_utc_mapped(), status=BotStatus.ARCHIVED.value)
        )
        await self._db.commit()
        return (res.rowcount or 0) > 0

    async def restore(self, bot_id: int, tenant_id: Optional[int]) -> bool:
        conds = [AIBotModel.id == bot_id]
        if tenant_id is not None:
            conds.append(AIBotModel.tenant_id == tenant_id)
        res = await self._db.execute(
            update(AIBotModel)
            .where(*conds)
            .values(deleted_at=None, status=BotStatus.ACTIVE.value)
        )
        await self._db.commit()
        return (res.rowcount or 0) > 0

    async def count_by_creator(self, tenant_id: Optional[int], user_id: int) -> int:
        conds = [AIBotModel.created_by == user_id, AIBotModel.deleted_at.is_(None)]
        if tenant_id is not None:
            conds.append(AIBotModel.tenant_id == tenant_id)
        q = select(func.count()).select_from(AIBotModel).where(*conds)
        return int((await self._db.execute(q)).scalar_one() or 0)


class SQLAlchemyBotMemoryStore(BotMemoryStore):
    """ai_bot_memories 表的 SQLAlchemy 实现"""

    def __init__(self, db: AsyncSession):
        self._db = db

    async def add(self, memory: BotMemory) -> BotMemory:
        m = BotMemoryModel(
            bot_id=memory.bot_id,
            user_id=memory.user_id,
            content=memory.content,
            memory_type=memory.memory_type.value,
            importance=memory.importance,
            source=memory.source,
        )
        self._db.add(m)
        await self._db.commit()
        await self._db.refresh(m)
        return _to_domain_memory(m)

    async def list_memories(self, bot_id: int, user_id: int, limit: int = 100) -> list[BotMemory]:
        q = (
            select(BotMemoryModel)
            .where(BotMemoryModel.bot_id == bot_id, BotMemoryModel.user_id == user_id)
            .order_by(BotMemoryModel.importance.desc(), BotMemoryModel.created_at.desc())
            .limit(limit)
        )
        rows = (await self._db.execute(q)).scalars().all()
        return [_to_domain_memory(m) for m in rows]

    async def delete(self, memory_id: int, bot_id: int, user_id: int) -> bool:
        target = (await self._db.execute(
            select(BotMemoryModel).where(
                BotMemoryModel.id == memory_id,
                BotMemoryModel.bot_id == bot_id,
                BotMemoryModel.user_id == user_id,
            )
        )).scalar_one_or_none()
        if target is None:
            return False
        await self._db.delete(target)
        await self._db.commit()
        return True

    async def top_memories(
        self, bot_id: int, user_id: int, limit: int = 5, min_importance: int = 1,
    ) -> list[BotMemory]:
        q = (
            select(BotMemoryModel)
            .where(
                BotMemoryModel.bot_id == bot_id,
                BotMemoryModel.user_id == user_id,
                BotMemoryModel.importance >= min_importance,
            )
            .order_by(BotMemoryModel.importance.desc(), BotMemoryModel.created_at.desc())
            .limit(limit)
        )
        rows = (await self._db.execute(q)).scalars().all()
        return [_to_domain_memory(m) for m in rows]


class SQLAlchemyGroupChatRepository(GroupChatRepository):
    """群聊仓库 SQLAlchemy 实现（Phase 2）"""

    def __init__(self, db: AsyncSession):
        self._db = db

    async def create_group(
        self, tenant_id: int, name: str, chief_bot_id: int, created_by: int,
        member_bot_ids: Sequence[int], commit: bool = True,
    ) -> GroupSession:
        from ..models.bot import (
            BotGroupSession as GroupModel,
            BotGroupMember as MemberModel,
        )
        session = GroupModel(
            tenant_id=tenant_id, name=name, chief_bot_id=chief_bot_id, created_by=created_by,
        )
        self._db.add(session)
        await self._db.flush()  # 获取 id

        member_ids = list(member_bot_ids)
        if chief_bot_id not in member_ids:
            member_ids.insert(0, chief_bot_id)
        members: list[GroupMember] = []
        for bot_id in member_ids:
            m = MemberModel(group_id=session.id, bot_id=bot_id, role="admin" if bot_id == chief_bot_id else "member")
            self._db.add(m)
            members.append(GroupMember(group_id=session.id, bot_id=bot_id, role=m.role))
        if commit:
            await self._db.commit()
        await self._db.refresh(session)
        return GroupSession(
            id=session.id, tenant_id=tenant_id, name=session.name,
            chief_bot_id=session.chief_bot_id, created_by=created_by,
            members=members, archived_at=session.archived_at,
            created_at=session.created_at, updated_at=session.updated_at,
        )

    async def list_groups(
        self, tenant_id: int, user_id: int, offset: int = 0, limit: int = 100,
        include_archived: bool = False,
    ) -> tuple[list[GroupSession], int]:
        from ..models.bot import (
            BotGroupSession as GroupModel,
            BotGroupMember as MemberModel,
        )
        # 用户可见：本人创建，或成员中包含本人创建的 Bot
        my_bot_ids = select(AIBotModel.id).where(
            AIBotModel.created_by == user_id, AIBotModel.deleted_at.is_(None),
        )
        member_groups = select(MemberModel.group_id).where(MemberModel.bot_id.in_(my_bot_ids))
        conds = [
            GroupModel.tenant_id == tenant_id,
            or_(
                GroupModel.created_by == user_id,
                GroupModel.id.in_(member_groups),
            ),
        ]
        if not include_archived:
            conds.append(GroupModel.archived_at.is_(None))
        total = (await self._db.execute(
            select(func.count()).select_from(GroupModel).where(*conds)
        )).scalar_one()
        rows = (await self._db.execute(
            select(GroupModel).where(*conds).order_by(GroupModel.updated_at.desc()).offset(offset).limit(limit)
        )).scalars().all()
        result = []
        for g in rows:
            result.append(await self._to_session(g))
        return result, int(total or 0)

    async def set_group_archived(self, group_id: int, tenant_id: int, archived: bool) -> bool:
        """设置群聊归档状态（v3.3）。"""
        from ..models.bot import BotGroupSession as GroupModel
        row = (await self._db.execute(
            select(GroupModel).where(
                GroupModel.id == group_id, GroupModel.tenant_id == tenant_id,
            )
        )).scalar_one_or_none()
        if row is None:
            return False
        row.archived_at = datetime.now(timezone.utc) if archived else None
        await self._db.commit()
        return True

    async def get_group(self, group_id: int, tenant_id: int) -> GroupSession | None:
        from ..models.bot import BotGroupSession as GroupModel
        g = (await self._db.execute(
            select(GroupModel).where(
                GroupModel.id == group_id, GroupModel.tenant_id == tenant_id,
            )
        )).scalar_one_or_none()
        if g is None:
            return None
        return await self._to_session(g)

    async def add_members(self, group_id: int, bot_ids: Sequence[int], role: str = "member") -> list[GroupMember]:
        from ..models.bot import BotGroupMember as MemberModel
        added: list[GroupMember] = []
        for bot_id in bot_ids:
            exists = (await self._db.execute(
                select(MemberModel).where(
                    MemberModel.group_id == group_id, MemberModel.bot_id == bot_id,
                )
            )).scalar_one_or_none()
            if exists:
                continue
            m = MemberModel(group_id=group_id, bot_id=bot_id, role=role)
            self._db.add(m)
            added.append(GroupMember(group_id=group_id, bot_id=bot_id, role=role))
        await self._db.commit()
        return added

    async def remove_member(self, group_id: int, bot_id: int) -> bool:
        from ..models.bot import BotGroupMember as MemberModel
        res = await self._db.execute(
            delete(MemberModel).where(
                MemberModel.group_id == group_id, MemberModel.bot_id == bot_id,
            )
        )
        await self._db.commit()
        return (res.rowcount or 0) > 0

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
        commit: bool = True,
        sender_bot_name: str | None = None,
    ) -> GroupMessage:
        from ..models.bot import BotGroupMessage as MessageModel
        m = MessageModel(
            group_id=group_id,
            sender_type=sender_type,
            sender_user_id=sender_user_id,
            sender_bot_id=sender_bot_id,
            sender_bot_name=sender_bot_name,
            content=content,
            reply_to=reply_to,
            mentioned_bot_ids=list(mentioned_bot_ids) if mentioned_bot_ids else [],
            task_execution_id=task_execution_id,
        )
        self._db.add(m)
        if commit:
            await self._db.commit()
            await self._db.refresh(m)
        else:
            # 未提交时先 flush 获取 id，避免 refresh 未持久化对象报错
            await self._db.flush()
        return _to_domain_group_message(m)

    async def list_messages(
        self, group_id: int, limit: int = 100, before_id: int | None = None,
    ) -> list[GroupMessage]:
        from ..models.bot import BotGroupMessage as MessageModel
        q = select(MessageModel).where(MessageModel.group_id == group_id)
        if before_id is not None:
            q = q.where(MessageModel.id < before_id)
        rows = (await self._db.execute(
            q.order_by(MessageModel.id.desc()).limit(limit)
        )).scalars().all()
        # 按时间正序返回
        return [_to_domain_group_message(m) for m in reversed(rows)]

    # ── 辅助 ──
    async def _to_session(self, g) -> GroupSession:
        from ..models.bot import BotGroupMember as MemberModel
        members = (await self._db.execute(
            select(MemberModel).where(MemberModel.group_id == g.id).order_by(MemberModel.joined_at)
        )).scalars().all()
        return GroupSession(
            id=g.id, tenant_id=g.tenant_id, name=g.name,
            chief_bot_id=g.chief_bot_id, created_by=g.created_by,
            members=[GroupMember(group_id=m.group_id, bot_id=m.bot_id, role=m.role, id=m.id, joined_at=m.joined_at) for m in members],
            archived_at=g.archived_at, created_at=g.created_at, updated_at=g.updated_at,
        )


class NotImplementedUsageRecorder(UsageRecorder):
    """用量记录端口占位（Phase 3 实现）"""

    def __init__(self, db: AsyncSession):
        self._db = db

    async def record(
        self,
        tenant_id: int,
        bot_id: Optional[int],
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        endpoint: str,
    ) -> Any:
        raise NotImplementedError("用量统计属于 Phase 3，尚未实现")
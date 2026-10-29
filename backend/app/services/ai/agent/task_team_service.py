"""
任务团队自动组建服务（v3.3 任务驱动自动建群）

流程：任务解析 → 专业配人（L1/L2/L3 含实时招募 AI 员工）→ 同事务建群+建任务+写消息
→ 触发后台自主派单。

事务一致性（M8）：建群（commit=False）+ 建任务记录 + 写初始消息 在**同一事务**，
最后统一 commit；任一失败整体回滚。
限流（M7）：同用户 5 分钟 1 次。
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from ....infrastructure.bots_impl import SQLAlchemyGroupChatRepository
from ....models.task_group import TaskGroup
from .bot_manager import BotManager
from .role_templates import ROLE_TEMPLATES, get_role_template
from .task_planner import get_task_planner

logger = logging.getLogger(__name__)

# auto-team 频率限制（秒）
AUTO_TEAM_RATE_LIMIT_SECONDS = 300
# 模块级限流表：user_id -> 上次 auto-team 时间戳
_LAST_AUTO_TEAM_AT: dict[int, float] = {}


class TaskTeamService:
    def __init__(self, db: AsyncSession):
        self._db = db
        self._repo = SQLAlchemyGroupChatRepository(db)
        self._bot_manager = BotManager(db)

    async def _check_rate_limit(self, user_id: int) -> bool:
        """auto-team 限流：Redis 启用时用 SET NX；否则用进程内存表。"""
        from ....core.distributed.redis_client import (
            is_redis_enabled,
            make_rate_limit_key,
            redis_set_nx,
        )
        if is_redis_enabled():
            return await redis_set_nx(
                make_rate_limit_key("auto_team_rate", user_id),
                AUTO_TEAM_RATE_LIMIT_SECONDS,
            )
        last = _LAST_AUTO_TEAM_AT.get(user_id, 0.0)
        now = time.time()
        return (now - last) >= AUTO_TEAM_RATE_LIMIT_SECONDS

    async def create_task_team(
        self, tenant_id: int, user_id: int, content: str,
        constraints: dict | None = None,
    ) -> dict[str, Any]:
        """创建研发任务：解析角色 → 配人 → 建群 → 派单。返回 task_id/group_id。"""
        content = content.strip()
        if not content:
            raise ValueError("任务内容不能为空")
        if not await self._check_rate_limit(user_id):
            raise ValueError("创建任务过于频繁，请 5 分钟后再试")

        # ① 任务解析
        bots = await self._bot_manager.list_visible_bots(tenant_id, user_id)
        available_bots = [
            {
                "id": b.id,
                "name": b.name,
                "description": b.description or "",
                "capabilities": b.capabilities or [],
            }
            for b in bots
        ]
        plan = await get_task_planner().plan(content, ROLE_TEMPLATES, available_bots)
        logger.info(f"[TaskTeam] 任务规划完成: {plan}")

        # ② 专业配人
        member_bot_ids: list[int] = []
        recruit_names: list[str] = []
        github_recruit_names: list[str] = []
        task_ctx = content[:500]
        for item in plan["roles"]:
            role = get_role_template(item.get("role_key", ""))
            if role is None:
                continue
            bot = None
            # L1：LLM 已匹配的 Bot 或评分匹配
            matched_id = item.get("matched_bot_id")
            if matched_id:
                bot = await self._bot_manager.get_bot(int(matched_id), tenant_id)
            if bot is None:
                bot, _score = await self._bot_manager.match_bot_to_role(role, tenant_id, user_id)
            # L2：实时招募 AI 员工
            if bot is None:
                bot, recruited = await self._bot_manager.recruit_bot_from_role_template(
                    role, tenant_id, user_id, task_ctx,
                )
                if bot is not None and recruited:
                    recruit_names.append(bot.name)
            # L2.5：GitHub 自动供给（v3.4）——建群阶段也从 GitHub 获取开源专家/技能模板
            if bot is None and not github_recruit_names:
                from .github_supply_service import recruit_expert_from_github
                bot, recruited, source = await recruit_expert_from_github(
                    self._db, role.name, item.get("task") or content, tenant_id, user_id,
                )
                if bot is not None:
                    github_recruit_names.append(bot.name)
                    if source:
                        recruit_names.append(f"{bot.name}（{source}）")
            # L3：兜底（综合任务专家）
            if bot is None:
                bot = await self._bot_manager.create_temporary_expert(role.name, tenant_id, user_id)
            if bot is not None:
                if bot.id not in member_bot_ids:
                    member_bot_ids.append(bot.id)

        if not member_bot_ids:
            raise ValueError("未能为任务配备任何专家，请稍后重试")

        # ③ 同事务：建群 + 建任务 + 写初始消息
        chief = await self._bot_manager.get_chief(tenant_id, user_id)
        chief_id = chief.id if chief is not None else 1
        group_name = f"任务·{content[:12]}{'…' if len(content) > 12 else ''}"

        try:
            group = await self._repo.create_group(
                tenant_id, group_name, chief_id, user_id,
                member_bot_ids, commit=False,
            )
            task = TaskGroup(
                tenant_id=tenant_id,
                group_id=group.id,
                created_by=user_id,
                task_content=content,
                plan=plan,
                status="recruiting",
            )
            self._db.add(task)
            await self._db.flush()  # 获取 task.id

            # 用户任务消息
            await self._repo.add_message(
                group.id, "user", content, sender_user_id=user_id, commit=False,
            )
            # 任务分配消息
            role_names = []
            for item in plan["roles"]:
                role = get_role_template(item.get("role_key", ""))
                role_names.append(role.name if role else item.get("role_key", ""))
            await self._repo.add_message(
                group.id, "bot", "【任务分配】" + "、".join(role_names),
                sender_bot_id=chief_id, sender_bot_name="Chief", commit=False,
            )
            # 招募消息
            if recruit_names:
                await self._repo.add_message(
                    group.id, "bot",
                    f"【招募】任务需要补充专家，已实时招募 AI 员工：{'、'.join(recruit_names)} 加入本次任务。",
                    sender_bot_id=chief_id, sender_bot_name="Chief", commit=False,
                )
            await self._db.commit()
        except Exception as e:
            await self._db.rollback()
            logger.error(f"[TaskTeam] 建群/建任务失败，已回滚: {e}", exc_info=True)
            raise ValueError(f"创建任务失败：{str(e)[:200]}") from e

        # ④ 触发后台自主派单（独立会话）
        _LAST_AUTO_TEAM_AT[user_id] = time.time()
        from .group_chat_service import _run_autodispatch_in_new_session

        asyncio.create_task(
            _run_autodispatch_in_new_session(group.id, tenant_id, user_id, content, task_id=task.id)
        )
        logger.info(f"[TaskTeam] 任务已创建并触发派单: task_id={task.id}, group_id={group.id}")

        return {
            "task_id": task.id,
            "group_id": group.id,
            "group_name": group.name,
            "members": member_bot_ids,
            "roles": plan["roles"],
            "async": True,
        }


def get_task_team_service(db: AsyncSession) -> TaskTeamService:
    return TaskTeamService(db)


async def seed_github_mcp_server() -> bool:
    """预置内置 GitHub MCP 服务器（方案 A：用户零配置）。

    自动在 ai_mcp_servers 表中创建 name=github 的服务器记录，
    指向项目自身的 MCP 代理端点（封装 GitHub REST API）。
    """
    import os

    from sqlalchemy import select

    from app.core.database.session import async_session_factory

    from ....models.mcp_server import McpServerConfig

    base_url = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")
    # 必须使用绝对 URL，否则 McpBridge 的 httpx 无法请求相对路径
    if not base_url:
        base_url = os.getenv("BACKEND_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
    url = f"{base_url}/api/v1/mcp/github"

    inserted = False
    async with async_session_factory() as db:
        exists = (await db.execute(
            select(McpServerConfig).where(McpServerConfig.name == "github")
        )).scalar_one_or_none()
        if exists is None:
            db.add(McpServerConfig(
                tenant_id=1,
                name="github",
                transport="http",
                url=url,
                headers={},
                enabled=True,
                allow_tools=[],
                visibility="org",
                created_by=1,
            ))
            await db.commit()
            inserted = True
            logger.info("[GithubMcp] 已预置内置 GitHub MCP 服务器")
        elif exists.url != url:
            exists.url = url
            await db.commit()
            logger.info("[GithubMcp] 已更新内置 GitHub MCP 服务器 URL")
    return inserted


async def recover_stale_tasks(timeout_minutes: int = 30) -> int:
    """任务持久化恢复（P2 演进项）：启动时扫描长时间未完成的任务。

    将超过 timeout_minutes 仍处于 recruiting/dispatching 的任务标记为 failed(timeout)，
    并在对应任务群写入提示消息（进程重启/执行超时场景下避免任务永远卡住）。
    """
    from datetime import datetime, timedelta, timezone

    from sqlalchemy import select, update

    from app.core.database.session import async_session_factory

    from ....models.task_group import TaskGroup

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=timeout_minutes)
    recovered = 0
    async with async_session_factory() as db:
        stale = (await db.execute(
            select(TaskGroup).where(
                TaskGroup.status.in_(["recruiting", "dispatching"]),
                TaskGroup.created_at < cutoff,
            )
        )).scalars().all()
        if not stale:
            return 0
        repo = SQLAlchemyGroupChatRepository(db)
        for t in stale:
            await repo.add_message(
                t.group_id, "bot",
                "❌ 任务因超时未完成，已自动标记为失败（可能由进程重启或执行超时导致）。您可以重新创建任务。",
                sender_bot_id=1, sender_bot_name="Chief", commit=False,
            )
            await db.execute(
                update(TaskGroup).where(TaskGroup.id == t.id).values(
                    status="failed", error_message="timeout",
                )
            )
            recovered += 1
        await db.commit()
        logger.warning(f"[TaskTeam] 已恢复 {recovered} 个超时任务（置为 failed）")
    return recovered

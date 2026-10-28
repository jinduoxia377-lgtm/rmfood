"""
群聊协作应用服务（DS Bot 移植 Phase 2 + v2 自主派单）

职责：
- 群聊生命周期（创建/查询/成员管理）
- 消息发言：
  · @ 定向：同步调用被 @ 的 Bot（用户指定人员，高级用法）
  · 未 @：触发「自主派单」——Chief 进入 Agent 循环自主编排，异步执行，
    过程通过群聊消息流逐条可见（前端轮询）
- 群聊级互斥锁（同群同时一个派单）+ 频率限制

架构注意：
- FastAPI 的 db session 是请求作用域，**不能用于后台任务**。
  自主派单后台任务使用 async_session_factory() 创建独立会话。
- 群聊锁与频率表为**模块级共享**（跨请求实例共享）。

端口：使用 SQLAlchemyGroupChatRepository + BotManager。
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from ....domain.bots import AIBot, GroupMessage, GroupSession
from ....infrastructure.bots_impl import SQLAlchemyGroupChatRepository
from .bot_manager import BotManager
from .tools.delegate_tool import SUBTASK_MAX_STEPS

logger = logging.getLogger(__name__)

MAX_TARGET_BOTS_PER_MESSAGE = 3
DEFAULT_MAX_STEPS = 5
# Chief 自主派单的 Agent 循环步数上限（v2）
CHIEF_DISPATCH_MAX_STEPS = 12
# 自主派单频率限制（秒）
DISPATCH_RATE_LIMIT_SECONDS = 60

# ── 模块级共享状态（跨请求实例共享）────────────────────────────
# 群聊级互斥锁：同时只允许一个自主派单
_GROUP_LOCKS: dict[int, asyncio.Lock] = {}
# 用户级频率限制：user_id -> 上次派单时间戳
_LAST_DISPATCH_AT: dict[int, float] = {}


class GroupChatService:
    """群聊应用服务"""

    def __init__(self, db: AsyncSession):
        self._db = db
        self._repo = SQLAlchemyGroupChatRepository(db)
        self._bot_manager = BotManager(db)

    # ── 群聊生命周期 ─────────────────────────────────────────────

    async def create_group(
        self, tenant_id: int, name: str, chief_bot_id: int, created_by: int,
        member_bot_ids: Sequence[int] | None = None,
    ) -> GroupSession:
        chief = await self._bot_manager.get_bot(chief_bot_id, tenant_id)
        if chief is None:
            raise ValueError("Chief Bot 不存在或已删除")
        group = await self._repo.create_group(
            tenant_id, name, chief_bot_id, created_by, member_bot_ids or [],
        )
        logger.info(f"[GroupChat] 创建群聊: id={group.id}, name={name}")
        return group

    async def list_groups(self, tenant_id: int, user_id: int, offset: int = 0, limit: int = 100, include_archived: bool = False) -> dict[str, Any]:
        groups, total = await self._repo.list_groups(
            tenant_id, user_id, offset, limit, include_archived=include_archived,
        )
        return {"items": [g.to_dict() for g in groups], "total": total}

    async def get_group(self, group_id: int, tenant_id: int) -> GroupSession:
        group = await self._repo.get_group(group_id, tenant_id)
        if group is None:
            raise ValueError("群聊不存在")
        return group

    async def add_members(self, group_id: int, tenant_id: int, bot_ids: Sequence[int]) -> list[Any]:
        await self.get_group(group_id, tenant_id)
        members = await self._repo.add_members(group_id, bot_ids, role="member")
        return [m.to_dict() for m in members]

    async def remove_member(self, group_id: int, tenant_id: int, bot_id: int) -> bool:
        group = await self.get_group(group_id, tenant_id)
        if group.chief_bot_id == bot_id:
            raise ValueError("不能移除群管理员 Chief")
        return await self._repo.remove_member(group_id, bot_id)

    # ── 消息 ─────────────────────────────────────────────────────

    async def post_message(
        self,
        group_id: int,
        tenant_id: int,
        user_id: int,
        content: str,
        mentioned_bot_ids: Sequence[int] | None = None,
        reply_to: int | None = None,
    ) -> dict[str, Any]:
        """用户发言。

        - @ 定向：同步调用被 @ 的 Bot（旧逻辑）。
        - 未 @：触发「自主派单」，立即返回 user_message + pending_message，
          后台任务使用独立数据库会话异步执行 Chief Agent 循环。
        """
        group = await self.get_group(group_id, tenant_id)
        mentioned = [int(b) for b in (mentioned_bot_ids or []) if b]

        user_msg = await self._repo.add_message(
            group_id=group_id,
            sender_type="user",
            content=content,
            sender_user_id=user_id,
            reply_to=reply_to,
            mentioned_bot_ids=mentioned,
        )

        # ── @ 定向（同步）──
        if mentioned:
            replies: list[GroupMessage] = []
            for bot_id in mentioned[:MAX_TARGET_BOTS_PER_MESSAGE]:
                bot = await self._bot_manager.get_bot(bot_id, tenant_id)
                if bot is None:
                    continue
                reply = await self._invoke_bot(bot, group.id, content, user_id)
                if reply is not None:
                    replies.append(reply)
            return {
                "user_message": user_msg.to_dict(),
                "replies": [r.to_dict() for r in replies],
                "async": False,
            }

        # ── 自主派单（异步）──
        # 频率限制（Redis 或内存）
        if not await self._check_rate_limit(user_id):
            tip = await self._repo.add_message(
                group_id, "bot", "⏳ 触发自主派单频率限制，请 1 分钟后再试。",
                sender_bot_id=group.chief_bot_id, sender_bot_name="Chief",
            )
            return {"user_message": user_msg.to_dict(), "pending_message": tip.to_dict(), "async": False}

        # 群聊级互斥锁（Redis 分布式锁或进程内锁）
        lock = self._get_group_lock(group_id)
        if getattr(lock, "locked", lambda: False)():
            tip = await self._repo.add_message(
                group_id, "bot", "⏳ 上一位自主派单任务进行中，请稍候。",
                sender_bot_id=group.chief_bot_id, sender_bot_name="Chief",
            )
            return {"user_message": user_msg.to_dict(), "pending_message": tip.to_dict(), "async": False}

        pending = await self._repo.add_message(
            group_id, "bot", "⏳ Chief 正在组织团队…",
            sender_bot_id=group.chief_bot_id, sender_bot_name="Chief",
        )

        async def _run() -> None:
            async with lock:
                _LAST_DISPATCH_AT[user_id] = time.time()
                await _run_autodispatch_in_new_session(group_id, tenant_id, user_id, content)

        asyncio.create_task(_run())
        return {
            "user_message": user_msg.to_dict(),
            "pending_message": pending.to_dict(),
            "async": True,
        }

    async def list_messages(self, group_id: int, tenant_id: int, limit: int = 100, before_id: int | None = None) -> dict[str, Any]:
        await self.get_group(group_id, tenant_id)
        msgs = await self._repo.list_messages(group_id, limit=limit, before_id=before_id)
        return {"items": [m.to_dict() for m in msgs], "total": len(msgs)}

    # ── 内部：自主派单 ───────────────────────────────────────────

    def _get_group_lock(self, group_id: int):
        """返回群聊级互斥锁：Redis 启用时用分布式锁，否则用进程内锁。"""
        from ....core.distributed.redis_client import (
            RedisLock,
            is_redis_enabled,
            make_group_lock_key,
        )
        if is_redis_enabled():
            return RedisLock(make_group_lock_key(group_id))
        return _GROUP_LOCKS.setdefault(group_id, asyncio.Lock())

    async def _check_rate_limit(self, user_id: int) -> bool:
        """同用户频率限制：Redis 启用时用 SET NX；否则用进程内存表。"""
        from ....core.distributed.redis_client import (
            is_redis_enabled,
            make_rate_limit_key,
            redis_set_nx,
        )
        if is_redis_enabled():
            return await redis_set_nx(
                make_rate_limit_key("dispatch_rate", user_id),
                DISPATCH_RATE_LIMIT_SECONDS,
            )
        last = _LAST_DISPATCH_AT.get(user_id, 0.0)
        now = time.time()
        return (now - last) >= DISPATCH_RATE_LIMIT_SECONDS

    async def _run_chief_dispatch(
        self, group_id: int, tenant_id: int, user_id: int, content: str,
        task_id: int | None = None,
    ) -> None:
        """确定性自主派单引擎（v4 深度重构）。

        不再依赖 Chief 的 LLM function-calling 自由循环（行为不可控、重复派单、
        中途 LLM 失败全盘失败），改为确定性工作流：
          1. TaskPlanner（1 次 LLM）解析角色/子任务计划；
          2. 后端逐项确定性配人（L1/L2/L2.5/L3 含 GitHub 供给）并直接执行目标 Bot；
          3. 每次子任务结果实时写群聊消息；
          4. Chief 聚合（1 次 LLM）输出【汇总】。

        特点：LLM 调用次数固定（1 + N×子任务步数 + 1），流程确定、可观测、易恢复。
        task_id 存在时更新任务状态（completed/failed）。
        """
        group = await self.get_group(group_id, tenant_id)
        chief = await self._bot_manager.get_bot(group.chief_bot_id, tenant_id)
        if chief is None:
            await self._repo.add_message(
                group.id, "bot", "❌ Chief 不可用，无法执行自主派单。",
                sender_bot_id=group.chief_bot_id, sender_bot_name="Chief",
            )
            if task_id is not None:
                await self._update_task_status(task_id, "failed", "Chief 不可用")
            return

        context: dict[str, Any] = {
            "db": self._db,
            "user_id": user_id,
            "tenant_id": tenant_id,
            "group_id": group.id,
            "chief_bot_id": group.chief_bot_id,
            "user_query": content,  # P1 目标对齐：供子任务/聚合注入原始需求
            "_l2_created_count": 0,
            "_github_supply_used": 0,
        }

        # 1. 任务规划：任务驱动（task_id）时复用建群阶段持久化的计划，避免重复 LLM 规划
        from .role_templates import ROLE_TEMPLATES, get_role_template

        plan = None
        if task_id is not None:
            try:
                from sqlalchemy import select

                from ....models.task_group import TaskGroup
                task_row = (await self._db.execute(
                    select(TaskGroup).where(TaskGroup.id == task_id)
                )).scalar_one_or_none()
                if task_row is not None and task_row.plan:
                    plan = task_row.plan
            except Exception as e:
                logger.warning(f"[GroupChat] 读取任务计划失败: {e}")

        if plan is None:
            from .task_planner import get_task_planner
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
            try:
                plan = await get_task_planner().plan(content, ROLE_TEMPLATES, available_bots)
            except Exception as e:
                logger.warning(f"[GroupChat] 任务规划失败，降级默认: {e}")
                plan = {"roles": [{"role_key": "formula_designer", "task": content[:2000], "matched_bot_id": None}]}
        roles = plan.get("roles", []) or []

        # 2. 写【任务分配】计划消息（可观测）：含派单批次号 + 每个子任务的角色与描述（阶段 C）
        from sqlalchemy import func as safunc
        from sqlalchemy import select

        from ....models.bot import BotGroupMessage as GroupMessageModel
        existing_plan_count = (await self._db.execute(
            select(safunc.count()).select_from(GroupMessageModel).where(
                GroupMessageModel.group_id == group.id,
                GroupMessageModel.content.like("【任务分配%"),
            )
        )).scalar() or 0
        batch_no = int(existing_plan_count) + 1

        plan_lines: list[str] = []
        for idx, item in enumerate(roles, 1):
            role = get_role_template(item.get("role_key", ""))
            role_name = role.name if role else item.get("role_key", "综合专家")
            task_desc = (item.get("task") or "").strip().replace("\n", " ")[:80]
            plan_lines.append(f"{idx}. {role_name}：{task_desc}" if task_desc else f"{idx}. {role_name}")
        if not plan_lines:
            plan_lines = ["1. 综合专家"]
        assign_content = f"【任务分配（第{batch_no}次）】\n" + "\n".join(plan_lines)
        await self._repo.add_message(
            group.id, "bot", assign_content,
            sender_bot_id=chief.id, sender_bot_name=chief.name,
        )

        # 3. 逐子任务确定性执行
        # 构建群成员 Bot 列表（优先使用任务群已配人员，避免重复创建/成员不一致）
        member_bots: list[AIBot] = []
        member_bot_ids: set[int] = set()
        for m in group.members:
            mb = await self._bot_manager.get_bot(m.bot_id, tenant_id)
            if mb is not None:
                member_bots.append(mb)
                member_bot_ids.add(mb.id)

        results: list[dict[str, str]] = []
        # 阶段 B-2：子任务结果依赖传递（前序结果拼入后续子任务，供专家参考）
        previous_results_text = ""
        for item in roles:
            role = get_role_template(item.get("role_key", ""))
            task_text = (item.get("task") or content).strip()
            if not task_text:
                task_text = content
            if previous_results_text:
                task_text = (
                    f"{task_text}\n\n"
                    f"【前序专家结果（供参考，可基于其继续分析/复核）】\n{previous_results_text[:1500]}"
                )
            bot, bot_name, result_text, exec_id = await self._resolve_and_run_subtask(
                role, item, task_text, tenant_id, user_id, context,
                group_id=group.id, member_bots=member_bots, member_bot_ids=member_bot_ids,
            )
            results.append({"capability": role.name if role else "综合专家", "bot": bot_name, "content": result_text})
            if bot is not None:
                await self._repo.add_message(
                    group.id, "bot", result_text,
                    sender_bot_id=bot.id, sender_bot_name=bot_name,
                    task_execution_id=exec_id,
                )
            # 累积前序结果（每步截断 300 字，整体限制，避免上下文爆炸）
            previous_results_text += (
                f"\n[{role.name if role else '综合专家'}｜{bot_name}] {result_text[:300]}"
            )

        # 4. 聚合：Chief 一次 LLM 生成【汇总】
        final = await self._aggregate_final(chief, content, results, context)
        await self._repo.add_message(
            group.id, "bot", final, sender_bot_id=chief.id, sender_bot_name=chief.name,
        )
        if task_id is not None:
            if any(flag in final for flag in ("[LLM调用失败]", "所有Provider调用失败", "Provider 调用失败")):
                await self._update_task_status(task_id, "failed", "LLM 调用失败")
            else:
                await self._update_task_status(task_id, "completed")

    async def _resolve_and_run_subtask(
        self, role, item: dict, task_text: str, tenant_id: int, user_id: int, context: dict,
        group_id: int | None = None, member_bots: list[AIBot] | None = None,
        member_bot_ids: set[int] | None = None,
    ) -> tuple[Any, str, str, str | None]:
        """确定性配人并执行单个子任务，返回 (bot, bot_name, result_text, execution_id)。

        P0-A/P0-B 修复：
        - 优先使用任务群已有成员（member_bots），避免与建群配人结果不一致；
        - 若动态创建了新专家（L2/L2.5/L3），自动加入群成员，保证前端可见。
        """
        from .bot_manager import _extract_capability_keywords
        from .github_supply_service import recruit_expert_from_github

        bot = None
        # L0：优先使用任务群已有成员（按能力关键词匹配）
        if bot is None and role is not None and member_bots:
            keywords = _extract_capability_keywords(role.name)
            best: AIBot | None = None
            for mb in member_bots:
                if mb.is_chief:
                    continue
                haystack = f"{mb.name} {mb.description or ''} {' '.join(mb.capabilities or [])}"
                if any(kw in haystack for kw in keywords):
                    best = mb
                    break
            bot = best
        # L1：LLM 已匹配的 Bot 或全局评分匹配
        if bot is None:
            matched_id = item.get("matched_bot_id")
            if matched_id:
                bot = await self._bot_manager.get_bot(int(matched_id), tenant_id)
        if bot is None and role is not None:
            bot, _score = await self._bot_manager.match_bot_to_role(role, tenant_id, user_id)
        # L2：内置角色模板招募
        if bot is None and role is not None:
            bot, recruited = await self._bot_manager.recruit_bot_from_role_template(
                role, tenant_id, user_id, task_text[:500],
            )
            if bot is not None and recruited:
                context["_l2_created_count"] = int(context.get("_l2_created_count", 0) or 0) + 1
        # L2.5：GitHub 自动供给
        if bot is None and int(context.get("_github_supply_used", 0) or 0) < 1:
            bot, recruited, source = await recruit_expert_from_github(
                self._db, role.name if role else "综合专家", task_text, tenant_id, user_id,
            )
            if bot is not None:
                context["_github_supply_used"] = 1
                await self._repo.add_message(
                    context.get("group_id"), "bot",
                    f"【GitHub供给】团队暂无「{role.name if role else '综合专家'}」专家，"
                    f"已从 GitHub 开源项目获取技能模板创建 AI 员工「{bot.name}」（来源 {source}）。",
                    sender_bot_id=1, sender_bot_name="Chief",
                )
        # L3：兜底（综合任务专家）
        if bot is None and role is not None:
            bot = await self._bot_manager.create_temporary_expert(role.name, tenant_id, user_id)

        # 动态创建的新专家自动加入任务群成员（P0-B）
        if bot is not None and group_id is not None:
            if member_bot_ids is None or bot.id not in member_bot_ids:
                try:
                    await self._repo.add_members(group_id, [bot.id], role="member")
                    if member_bot_ids is not None:
                        member_bot_ids.add(bot.id)
                except Exception as e:
                    logger.warning(f"[GroupChat] 新专家加入群成员失败（非致命）: {e}")

        if bot is None:
            return None, "未知专家", "❌ 未找到可用专家执行该子任务。", None

        child_context = dict(context or {})
        child_context["skip_prompt_guard"] = True
        # P0 算法升级：追加结构化输出要求，约束专家输出 JSON，供下游专家结构化消费，
        # 避免子任务因步数不足而「复读上下文」。
        final_task_text = task_text
        if role is not None and getattr(role, "output_requirement", ""):
            final_task_text = f"{task_text}\n\n【输出要求】\n{role.output_requirement}"
        # P1 目标对齐强化：注入用户原始需求全文，要求专家以原始目标/功效为准，
        # 避免「缓解眼疲劳」被转述成「改善睡眠/免疫调节」等偏离方向。
        original_query = (context.get("user_query") or "").strip()
        if original_query:
            final_task_text = (
                f"{final_task_text}\n\n【用户原始需求（目标与功效必须以此为准，不得偏离）】\n{original_query[:800]}"
            )
        try:
            execution = await self._bot_manager.execute_agent_task(
                bot, final_task_text, user_id=user_id, max_steps=SUBTASK_MAX_STEPS,
                context=child_context,
            )
            result_text = (execution.final_response or "（无回复）")[:1600]
            return bot, bot.name, result_text, execution.execution_id
        except Exception as e:
            logger.warning(f"[GroupChat] 子任务执行失败 {bot.name}: {e}")
            return bot, bot.name, f"（{bot.name} 执行失败：{str(e)[:200]}）", None

    async def _aggregate_final(
        self, chief: AIBot, content: str, results: list[dict[str, str]], context: dict,
    ) -> str:
        """用 Chief 人设对子任务结果做一次 LLM 汇总；失败时直接拼接。"""
        from ....services.llm_service import LLMMessage, llm_service

        if not results:
            return "【汇总】任务未产生任何子任务结果，请检查任务描述或稍后重试。"

        parts = []
        for idx, r in enumerate(results, 1):
            parts.append(f"{idx}. 【{r.get('capability', '子任务')}｜{r.get('bot', '')}】\n{r.get('content', '')}")
        joined = "\n\n".join(parts)

        try:
            # 聚合失败时自动重试一次（缩短输入，提高成功率）
            last_resp: str | None = None
            for attempt, joined_input in enumerate([joined[:6000], joined[:3000]]):
                messages = [
                    LLMMessage(role="system", content=(
                        f"{chief.persona_prompt}\n你是总配方师 Chief，请基于各专家子任务结果，"
                        "做一次专业整合与纠偏，输出最终【汇总】研发方案。\n"
                        "要求：\n"
                        "1. 若专家结果偏离用户原始目标/功效，必须以用户原始任务为准进行纠偏，给出修正后的方案；\n"
                        "2. 输出结构化内容：结论、方案要点（含君臣佐使/剂量/剂型）、风险与合规注意、待办事项；\n"
                        "3. 优先采纳带工具证据（合规检查违规项、剂量超限等）的结论，避免凭空编造。"
                    )),
                    LLMMessage(role="user", content=f"原始任务：{content[:1000]}\n\n各专家结果：\n{joined_input}"),
                ]
                try:
                    resp = await llm_service.chat(messages)
                    last_resp = (resp.content or "").strip()
                except Exception as e:
                    logger.warning(f"[GroupChat] 汇总 LLM 调用异常（第{attempt+1}次）: {e}")
                    continue
                if not (last_resp.startswith("[LLM调用失败]") or "所有Provider调用失败" in last_resp):
                    break
                last_resp = None
                logger.warning(f"[GroupChat] 汇总 LLM 返回失败标记（第{attempt+1}次），重试/降级")
            if not last_resp:
                # 聚合 LLM 失败 → 直接拼接子任务结果作为汇总
                return f"【汇总】以下为各专家结果汇总（聚合 LLM 暂不可用，已拼接）：\n\n{joined[:4000]}"
            final = last_resp
            if not final.startswith("【汇总】"):
                final = "【汇总】" + final
            return final[:5000]
        except Exception as e:
            logger.warning(f"[GroupChat] 汇总失败，拼接子任务结果: {e}")
            return f"【汇总】以下为各专家结果汇总（聚合失败，已拼接）：\n\n{joined[:4000]}"

    async def _update_task_status(self, task_id: int, status: str, error_message: str | None = None) -> None:
        """更新 ai_task_groups 状态（任务状态机 v3.3）。"""
        try:
            from sqlalchemy import update

            from ....models.task_group import TaskGroup
            values: dict[str, Any] = {"status": status}
            if error_message:
                values["error_message"] = error_message
            await self._db.execute(update(TaskGroup).where(TaskGroup.id == task_id).values(**values))
            await self._db.commit()
        except Exception as e:
            logger.warning(f"[TaskTeam] 任务状态更新失败（非致命）: {e}")

    # ── 内部：定向调用 ─────────────────────────────────────────

    async def _invoke_bot(
        self, bot: AIBot, group_id: int, content: str, user_id: int,
    ) -> GroupMessage | None:
        """以 Bot 身份执行任务，结果写入群聊消息。"""
        execution_id: str | None = None
        try:
            execution = await self._bot_manager.execute_agent_task(
                bot, content, user_id=user_id, max_steps=DEFAULT_MAX_STEPS,
            )
            reply_content = execution.final_response or "（执行完成，无文本回复）"
            execution_id = execution.execution_id
        except Exception as e:
            logger.warning(f"[GroupChat] Bot {bot.id} 执行失败: {e}")
            reply_content = f"（{bot.name} 执行失败：{str(e)[:200]}）"

        return await self._repo.add_message(
            group_id=group_id,
            sender_type="bot",
            sender_bot_id=bot.id,
            sender_bot_name=bot.name,
            content=reply_content,
            task_execution_id=execution_id,
        )


async def _run_autodispatch_in_new_session(
    group_id: int, tenant_id: int, user_id: int, content: str,
    task_id: int | None = None,
) -> None:
    """在独立数据库会话中执行自主派单（后台任务专用）。

    FastAPI 请求作用域的 session 在请求结束后会被关闭，
    后台任务必须使用 async_session_factory() 新建会话。
    task_id 存在时（任务驱动自动建群场景）同步更新任务状态。
    """
    from app.core.database.session import async_session_factory

    async with async_session_factory() as db:
        service = GroupChatService(db)
        await service._run_chief_dispatch(group_id, tenant_id, user_id, content, task_id=task_id)


def get_group_chat_service(db: AsyncSession) -> GroupChatService:
    return GroupChatService(db)

"""
自主派单测试（v2：Chief Agent 循环 + delegate 工具三级兜底）

覆盖：
1. delegate L1：命中现有专家
2. delegate L2：无匹配 → 动态创建临时专家（org 共享）
3. delegate L3：动态创建达上限 → 返回失败（Chief 兜底）
4. post_message 未 @ → 异步响应（pending_message + async）
5. 群聊级互斥锁：并发发言第二次收到"进行中"
6. 频率限制：同用户 1 分钟第二次触发限流
7. Chief 执行失败 → 群聊出现 ❌ 消息（降级）
"""
import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.api.deps import get_db_session
from app.services.ai.agent.bot_manager import BotManager
from app.services.ai.agent.group_chat_service import GroupChatService
from app.services.ai.agent.group_chat_service import _GROUP_LOCKS, _LAST_DISPATCH_AT
from app.services.ai.agent.tools.delegate_tool import DelegateTool
from tests.conftest_clean_users import track_test_user, track_test_bot


def make_unique_id() -> int:
    from tests.conftest_clean_users import make_test_user_id
    return make_test_user_id()


async def create_test_user(db: AsyncSession, user_id: int = None) -> User:
    if user_id is None:
        user_id = make_unique_id()
    user = User(
        id=user_id,
        email=f"ad{user_id}@example.com",
        username=f"aduser{user_id}",
        hashed_password="hashed_password",
        is_active=True,
        role="researcher",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    track_test_user(user.id)
    return user


def cleanup_test_user(user_id: int):
    """立即删除该测试用户（可选；conftest 统一清理器兜底）。"""
    import asyncio
    from sqlalchemy import delete as sa_delete

    async def _do():
        from app.api.deps import get_db_session
        async for db in get_db_session():
            await db.execute(sa_delete(User).where(User.id == user_id))
            await db.commit()

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_do())
    finally:
        loop.close()


async def _create_bot(db: AsyncSession, user_id: int, name: str) -> int:
    from app.models.bot import AIBot
    bot = AIBot(
        tenant_id=1,
        created_by=user_id,
        name=name,
        persona_prompt="测试 Bot 人设",
        visibility="private",
        status="active",
    )
    db.add(bot)
    await db.commit()
    await db.refresh(bot)
    track_test_bot(bot.id)
    return bot.id


def _make_execution(final_response: str = "专家回复", execution_id: str = "exec-x"):
    m = MagicMock()
    m.final_response = final_response
    m.execution_id = execution_id
    return m


class TestDelegateTool:
    """delegate 工具三级兜底"""

    @pytest.mark.asyncio
    async def test_delegate_l1_existing_bot(self):
        async for db in get_db_session():
            user = await create_test_user(db)
            expert_id = await _create_bot(db, user.id, "安全专家")
            service = GroupChatService(db)
            group = await service.create_group(
                tenant_id=1, name="L1群", chief_bot_id=await _create_bot(db, user.id, "Chief"), created_by=user.id,
            )
            context = {"db": db, "user_id": user.id, "tenant_id": 1, "group_id": group.id}

            exec_mock = _make_execution("安全审查通过")
            with patch.object(BotManager, "execute_agent_task", new=AsyncMock(return_value=exec_mock)):
                tool = DelegateTool()
                result = await tool.execute(
                    {"capability": "安全性评估", "task": "审查配方安全性"},
                    context,
                )

            assert result.success is True
            assert result.data["bot_id"] == expert_id
            assert "安全审查通过" in result.data["result"]

            # 结果已写入群聊消息
            msgs = await service.list_messages(group.id, tenant_id=1, limit=20)
            assert any("安全审查通过" in m["content"] for m in msgs["items"])

    @pytest.mark.asyncio
    async def test_delegate_l2_create_temporary_expert(self):
        async for db in get_db_session():
            user = await create_test_user(db)
            service = GroupChatService(db)
            group = await service.create_group(
                tenant_id=1, name="L2群", chief_bot_id=await _create_bot(db, user.id, "Chief"), created_by=user.id,
            )
            context = {"db": db, "user_id": user.id, "tenant_id": 1, "group_id": group.id}

            exec_mock = _make_execution("毒理初筛完成")
            with patch.object(BotManager, "execute_agent_task", new=AsyncMock(return_value=exec_mock)):
                tool = DelegateTool()
                result = await tool.execute(
                    {"capability": "毒理学评估", "task": "对配方做毒理初筛"},
                    context,
                )

            assert result.success is True
            assert "毒理" in result.data["bot_name"]

            # 临时专家已入库（org 共享）
            from app.models.bot import AIBot
            from sqlalchemy import select
            created = (await db.execute(
                select(AIBot).where(AIBot.name.like("%毒理%"), AIBot.is_system.is_(False))
            )).scalars().all()
            assert len(created) >= 1
            assert created[0].visibility == "org"

            # 结果已写入群聊消息
            msgs = await service.list_messages(group.id, tenant_id=1, limit=20)
            assert any("毒理初筛完成" in m["content"] for m in msgs["items"])

    @pytest.mark.asyncio
    async def test_delegate_l3_creation_limit(self):
        async for db in get_db_session():
            user = await create_test_user(db)
            service = GroupChatService(db)
            group = await service.create_group(
                tenant_id=1, name="L3群", chief_bot_id=await _create_bot(db, user.id, "Chief"), created_by=user.id,
            )
            # 已消耗 2 个动态创建名额
            context = {"db": db, "user_id": user.id, "tenant_id": 1, "group_id": group.id, "_l2_created_count": 2}

            # 本地创建达上限且 GitHub 供给也无结果 → 应返回失败（L3）
            with patch(
                "app.services.ai.agent.github_supply_service.recruit_expert_from_github",
                new=AsyncMock(return_value=(None, False, "")),
            ):
                tool = DelegateTool()
                result = await tool.execute(
                    {"capability": "市场调研", "task": "做市场调研"},
                    context,
                )

            assert result.success is False
            assert "无法创建" in result.error or "未找到" in result.error


class TestAutodispatch:
    """自主派单流程"""

    @pytest.mark.asyncio
    async def test_post_message_async_response(self):
        async for db in get_db_session():
            user = await create_test_user(db)
            service = GroupChatService(db)
            group = await service.create_group(
                tenant_id=1, name="异步群", chief_bot_id=await _create_bot(db, user.id, "Chief"), created_by=user.id,
            )

            exec_mock = _make_execution("最终方案")
            # 后台任务在 post_message 返回后才执行，patch 需保持到 sleep 结束
            patcher = patch.object(BotManager, "execute_agent_task", new=AsyncMock(return_value=exec_mock))
            from app.services.ai.agent.task_planner import TaskPlanner
            plan_patcher = patch.object(
                TaskPlanner, "plan",
                new=AsyncMock(return_value={
                    "roles": [{"role_key": "formula_designer", "task": "设计配方", "matched_bot_id": None}],
                }),
            )
            agg_patcher = patch.object(GroupChatService, "_aggregate_final", new=AsyncMock(return_value="【汇总】测试汇总"))
            patcher.start()
            plan_patcher.start()
            agg_patcher.start()
            try:
                result = await service.post_message(
                    group_id=group.id, tenant_id=1, user_id=user.id, content="设计一款配方",
                )

                assert result["async"] is True
                assert result["user_message"]["content"] == "设计一款配方"
                assert result["pending_message"]["content"].startswith("⏳")
                assert "replies" not in result

                # 等待后台派单写入最终消息（轮询，避免固定 sleep 时序抖动）
                contents: list[str] = []
                deadline = asyncio.get_event_loop().time() + 30.0
                while asyncio.get_event_loop().time() < deadline:
                    msgs = await service.list_messages(group.id, tenant_id=1, limit=50)
                    contents = [m["content"] for m in msgs["items"]]
                    if any(c.startswith("【汇总】") for c in contents):
                        break
                    await asyncio.sleep(0.3)
            finally:
                patcher.stop()
                plan_patcher.stop()
                agg_patcher.stop()

            assert any(c.startswith("【汇总】") for c in contents), contents

    @pytest.mark.asyncio
    async def test_concurrent_lock(self):
        async for db in get_db_session():
            user = await create_test_user(db)
            service = GroupChatService(db)
            group = await service.create_group(
                tenant_id=1, name="锁群", chief_bot_id=await _create_bot(db, user.id, "Chief"), created_by=user.id,
            )
            # 手动占用群聊锁（模块级）
            lock = _GROUP_LOCKS.setdefault(group.id, asyncio.Lock())
            await lock.acquire()
            try:
                result = await service.post_message(
                    group_id=group.id, tenant_id=1, user_id=user.id, content="并发发言",
                )
                assert result["async"] is False
                assert "进行中" in result["pending_message"]["content"]
            finally:
                lock.release()

    @pytest.mark.asyncio
    async def test_rate_limit(self):
        async for db in get_db_session():
            user = await create_test_user(db)
            service = GroupChatService(db)
            group = await service.create_group(
                tenant_id=1, name="限流群", chief_bot_id=await _create_bot(db, user.id, "Chief"), created_by=user.id,
            )
            # 模拟刚派单过（1 分钟内）
            import time
            _LAST_DISPATCH_AT[user.id] = time.time()

            result = await service.post_message(
                group_id=group.id, tenant_id=1, user_id=user.id, content="再次发言",
            )
            assert result["async"] is False
            assert "频率限制" in result["pending_message"]["content"]

    @pytest.mark.asyncio
    async def test_chief_failure_fallback(self):
        async for db in get_db_session():
            user = await create_test_user(db)
            service = GroupChatService(db)
            group = await service.create_group(
                tenant_id=1, name="失败群", chief_bot_id=await _create_bot(db, user.id, "Chief"), created_by=user.id,
            )

            patcher = patch.object(BotManager, "execute_agent_task", new=AsyncMock(side_effect=RuntimeError("LLM 挂了")))
            from app.services.ai.agent.task_planner import TaskPlanner
            plan_patcher = patch.object(
                TaskPlanner, "plan",
                new=AsyncMock(return_value={
                    "roles": [{"role_key": "formula_designer", "task": "设计配方", "matched_bot_id": None}],
                }),
            )
            agg_patcher = patch.object(GroupChatService, "_aggregate_final", new=AsyncMock(return_value="【汇总】失败兜底"))
            patcher.start()
            plan_patcher.start()
            agg_patcher.start()
            try:
                result = await service.post_message(
                    group_id=group.id, tenant_id=1, user_id=user.id, content="会失败的任务",
                )
                assert result["async"] is True
                # 轮询等待后台任务写入消息（保持 patchers 激活，避免固定 sleep 时序抖动）
                contents: list[str] = []
                deadline = asyncio.get_event_loop().time() + 30.0
                while asyncio.get_event_loop().time() < deadline:
                    msgs = await service.list_messages(group.id, tenant_id=1, limit=50)
                    contents = [m["content"] for m in msgs["items"]]
                    if any("执行失败" in c for c in contents) and any(c.startswith("【汇总】") for c in contents):
                        break
                    await asyncio.sleep(0.3)
            finally:
                patcher.stop()
                plan_patcher.stop()
                agg_patcher.stop()

            # 确定性引擎：子任务失败被记录，聚合仍完成【汇总】（容错）
            assert any("执行失败" in c for c in contents)
            assert any(c.startswith("【汇总】") for c in contents)
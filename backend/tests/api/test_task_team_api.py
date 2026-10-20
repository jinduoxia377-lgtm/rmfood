"""
v3.3 任务驱动自动建群测试

覆盖：
1. TaskPlanner 默认降级角色集
2. match_bot_to_role 评分命中现有专家
3. recruit_bot_from_role_template 按模板招募（persona/capabilities/visibility）
4. TaskTeamService.create_task_team：建群+【任务分配】消息+【招募】消息+派单
5. 任务状态流转 recruiting→completed（成功）与 failed（异常）
6. 消息 sender_bot_name 冗余
7. 群聊归档/恢复
8. MCP 服务器配置 CRUD
9. McpBridge 工具注册（命名空间）与 validate_capabilities 放行 mcp:
"""
import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.models import User
from app.models.mcp_server import McpServerConfig
from app.services.ai.agent.bot_manager import BotManager
from app.services.ai.agent.group_chat_service import GroupChatService
from app.services.ai.agent.role_templates import RoleTemplate, ROLE_TEMPLATES, get_role_template
from app.services.ai.agent.task_planner import TaskPlanner, get_task_planner
from app.services.ai.agent.task_team_service import TaskTeamService
from app.services.ai.agent.mcp_bridge import McpBridge, get_mcp_bridge, McpAgentTool

from tests.conftest_clean_users import track_test_user, track_test_bot, make_test_user_id


def _make_unique_id() -> int:
    # 测试隔离区：90M~99M 受控 ID 区间，由 conftest 会话 finalizer 统一回收
    return make_test_user_id()


async def _create_user(db: AsyncSession, uid: int = None) -> User:
    if uid is None:
        uid = _make_unique_id()
    user = User(
        id=uid,
        email=f"tt{uid}@example.com",
        username=f"ttuser{uid}",
        hashed_password="hashed_password",
        is_active=True,
        role="researcher",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    track_test_user(user.id)
    return user


async def _cleanup_user(db: AsyncSession, uid: int):
    """测试后删除该测试用户（可选；统一清理器兜底）。"""
    from sqlalchemy import delete
    await db.execute(delete(User).where(User.id == uid))
    await db.commit()


async def _create_bot(db: AsyncSession, user_id: int, name: str, capabilities=None) -> int:
    from app.models.bot import AIBot
    bot = AIBot(
        tenant_id=1, created_by=user_id, name=name,
        persona_prompt="测试 Bot", visibility="private", status="active",
        capabilities=capabilities or [],
    )
    db.add(bot)
    await db.commit()
    await db.refresh(bot)
    track_test_bot(bot.id)
    return bot.id


class TestTaskPlanner:
    @pytest.mark.asyncio
    async def test_default_plan_fallback(self):
        plan = await TaskPlanner().plan("异常", [], [])
        assert len(plan["roles"]) == 1
        assert plan["roles"][0]["role_key"] == "formula_designer"
        assert plan["roles"][0]["matched_bot_id"] is None


class TestRoleMatching:
    @pytest.mark.asyncio
    async def test_match_l1_existing_bot(self):
        async for db in get_db_session():
            user = await _create_user(db)
            await _create_bot(db, user.id, "配方专家", ["generate_formula", "ingredient_info", "rag_retrieve"])
            bm = BotManager(db)
            role = get_role_template("formula_designer")
            bot, score = await bm.match_bot_to_role(role, 1, user.id)
            assert bot is not None
            assert score >= 0.5

    @pytest.mark.asyncio
    async def test_recruit_l2_by_template(self):
        async for db in get_db_session():
            user = await _create_user(db)
            bm = BotManager(db)
            uid = user.id
            # 使用唯一名称的临时角色模板，避免测试数据残留冲突
            role = RoleTemplate(
                role_key="toxicologist_test",
                name=f"毒理专家{uid}",
                description="毒理学评估专家（测试）",
                capabilities=["毒理", "安全性"],
                required_tools=["literature_search", "rag_retrieve"],
                required_mcp_servers=["pubmed"],
                persona_template="你是毒理学评估专家（测试）。",
            )
            bot, recruited = await bm.recruit_bot_from_role_template(role, 1, user.id, "做毒理初筛")
            assert bot is not None
            assert recruited is True
            assert "毒理" in bot.name
            assert "literature_search" in (bot.capabilities or [])
            assert "mcp:pubmed" in (bot.capabilities or [])
            assert bot.visibility.value == "org"


class TestTaskTeamService:
    @pytest.mark.asyncio
    async def test_create_task_team_flow(self):
        async for db in get_db_session():
            user = await _create_user(db)
            await _create_bot(db, user.id, "Chief", ["delegate"])
            await _create_bot(db, user.id, "配方专家", ["generate_formula", "rag_retrieve"])
            await _create_bot(db, user.id, "安全专家", ["safety_assess", "rag_retrieve"])

            plan = {
                "roles": [
                    {"role_key": "formula_designer", "task": "设计配方", "matched_bot_id": None},
                    {"role_key": "safety_reviewer", "task": "审查安全", "matched_bot_id": None},
                ]
            }
            exec_mock = MagicMock()
            exec_mock.final_response = "【汇总】完成"
            exec_mock.execution_id = "exec-tt"

            with patch.object(TaskPlanner, "plan", new=AsyncMock(return_value=plan)):
                patcher = patch.object(BotManager, "execute_agent_task", new=AsyncMock(return_value=exec_mock))
                # 聚合 LLM 不 mock 会真实调用导致挂起，需与 test_task_failed_status
                # 一样 mock _aggregate_final，使后台任务确定性快速完成并流转任务状态
                agg_patcher = patch.object(
                    GroupChatService, "_aggregate_final",
                    new=AsyncMock(return_value="【汇总】完成（聚合）"),
                )
                patcher.start()
                agg_patcher.start()
                try:
                    svc = TaskTeamService(db)
                    result = await svc.create_task_team(1, user.id, "设计降糖饮品并审查")
                    assert result["async"] is True
                    assert result["group_id"] > 0
                    assert result["task_id"] > 0
                    await asyncio.sleep(2.5)
                finally:
                    patcher.stop()
                    agg_patcher.stop()

            # 消息流包含任务分配与汇总
            gsvc = GroupChatService(db)
            msgs = await gsvc.list_messages(result["group_id"], 1, limit=50)
            contents = [m["content"] for m in msgs["items"]]
            assert any("【任务分配】" in c for c in contents)
            assert any("【汇总】" in c for c in contents)

            # 任务状态为异步流转（recruiting → completed），采用轮询等待而非固定 sleep
            from sqlalchemy import select
            from app.models.task_group import TaskGroup
            task_status: str | None = None
            deadline = asyncio.get_event_loop().time() + 15.0
            while asyncio.get_event_loop().time() < deadline:
                task = (await db.execute(select(TaskGroup).where(TaskGroup.id == result["task_id"]))).scalar_one()
                task_status = task.status
                if task_status == "completed":
                    break
                await asyncio.sleep(0.3)
            assert task_status == "completed", task_status

    @pytest.mark.asyncio
    async def test_task_failed_status(self):
        async for db in get_db_session():
            user = await _create_user(db)
            await _create_bot(db, user.id, "Chief", ["delegate"])
            await _create_bot(db, user.id, "配方专家", ["generate_formula"])

            plan = {"roles": [{"role_key": "formula_designer", "task": "设计配方", "matched_bot_id": None}]}
            from app.services.ai.agent.group_chat_service import GroupChatService
            agg_patcher = patch.object(
                GroupChatService, "_aggregate_final",
                new=AsyncMock(return_value="[LLM调用失败] 所有Provider调用失败"),
            )
            with patch.object(TaskPlanner, "plan", new=AsyncMock(return_value=plan)):
                patcher = patch.object(BotManager, "execute_agent_task", new=AsyncMock(side_effect=RuntimeError("LLM 挂了")))
                patcher.start()
                agg_patcher.start()
                try:
                    svc = TaskTeamService(db)
                    result = await svc.create_task_team(1, user.id, "会失败的任务")
                    await asyncio.sleep(2.5)
                finally:
                    patcher.stop()
                    agg_patcher.stop()

            from sqlalchemy import select
            from app.models.task_group import TaskGroup
            task = (await db.execute(select(TaskGroup).where(TaskGroup.id == result["task_id"]))).scalar_one()
            assert task.status == "failed"
            assert task.error_message


class TestGroupArchive:
    @pytest.mark.asyncio
    async def test_archive_restore(self):
        async for db in get_db_session():
            user = await _create_user(db)
            chief_id = await _create_bot(db, user.id, "Chief归档")
            svc = GroupChatService(db)
            group = await svc.create_group(1, "归档测试群", chief_id, user.id, [])

            from app.infrastructure.bots_impl import SQLAlchemyGroupChatRepository
            repo = SQLAlchemyGroupChatRepository(db)
            await repo.set_group_archived(group.id, 1, True)
            groups, _ = await repo.list_groups(1, user.id, include_archived=False)
            assert all(g.id != group.id for g in groups)
            groups_all, _ = await repo.list_groups(1, user.id, include_archived=True)
            assert any(g.id == group.id for g in groups_all)
            await repo.set_group_archived(group.id, 1, False)
            groups_restored, _ = await repo.list_groups(1, user.id, include_archived=False)
            assert any(g.id == group.id for g in groups_restored)


class TestMcpServer:
    @pytest.mark.asyncio
    async def test_crud(self):
        async for db in get_db_session():
            uid = _make_unique_id()
            cfg = McpServerConfig(
                tenant_id=1, name=f"pubmed_{uid}", transport="http",
                url="http://localhost:9999/mcp", enabled=True,
                visibility="org",
            )
            db.add(cfg)
            await db.commit()
            await db.refresh(cfg)
            assert cfg.id > 0
            assert cfg.to_dict()["name"] == f"pubmed_{uid}"

    @pytest.mark.asyncio
    async def test_validate_capabilities_allow_mcp_prefix(self):
        bm = BotManager.__new__(BotManager)
        result = bm.validate_capabilities(["delegate", "mcp:pubmed"])
        assert "mcp:pubmed" in result
        assert "delegate" in result

    @pytest.mark.asyncio
    async def test_bridge_registers_tool(self):
        async for db in get_db_session():
            user = await _create_user(db)
            uid = _make_unique_id()
            cfg = McpServerConfig(
                tenant_id=1, name=f"server_{uid}", transport="http",
                url="http://localhost:9999/mcp", enabled=True,
                visibility="org",
            )
            db.add(cfg)
            await db.commit()

            bridge = get_mcp_bridge()
            server_name = f"server_{uid}"
            with patch.object(McpBridge, "_list_tools_remote", new=AsyncMock(return_value=[
                {"name": "search", "description": "搜索", "inputSchema": {"type": "object", "properties": {"q": {"type": "string"}}}},
            ])):
                await bridge.ensure_registered(db, 1, [f"mcp:{server_name}"])
            from app.services.ai.agent.tools import get_tool_registry
            tool = get_tool_registry().get(f"mcp_{server_name}__search")
            assert tool is not None
            assert isinstance(tool, McpAgentTool)
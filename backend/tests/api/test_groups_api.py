"""
群聊协作 API 测试（DS Bot 移植 Phase 2）

覆盖：
1. 创建群聊（Chief + 成员）
2. 群聊列表 / 详情
3. 成员添加/移除
4. 服务级消息派单（mock agent 执行，保持确定性）
"""
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models import User
from app.api.deps import get_db_session
from app.utils.auth import create_access_token
from app.services.ai.agent.group_chat_service import GroupChatService

client = TestClient(app)

from app.api import register_lazy_routers
register_lazy_routers()

client.cookies.set("csrf_token", "test_csrf_token_for_groups")
client.headers["X-CSRF-Token"] = "test_csrf_token_for_groups"


# ── 测试用户自动清理：conftest_clean_users 模块提供 conftest_clean_users._TestUserCleaner，
#    在 pytest_configure 钩子中注册 session 级 atexit 钩子，于测试会话结束后统一删除。
#    本模块只需在 create_test_user 中登记 user.id，由统一清理器兜底。 ──
from tests.conftest_clean_users import track_test_user, track_test_bot, make_test_user_id



def make_unique_id() -> int:
    # 测试隔离区：90M~99M 受控 ID 区间（< INT32_MAX，远大于生产 id<=10），
    # 由 conftest_clean_users 会话结束清理器统一回收（_register_test_user / _register_test_bot）。
    return make_test_user_id()


async def create_test_user(db: AsyncSession, user_id: int = None) -> User:
    if user_id is None:
        user_id = make_unique_id()
    user = User(
        id=user_id,
        email=f"grp{user_id}@example.com",
        username=f"grpuser{user_id}",
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
    """立即删除该测试用户（可选；统一清理器会兜底）。"""
    import asyncio
    from sqlalchemy import delete as sa_delete
    from app.models import User

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


def get_auth_headers(user_id: int) -> dict:
    token = create_access_token(data={"sub": str(user_id)})
    return {"Authorization": f"Bearer {token}"}


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


class TestGroupAPI:
    """群聊 CRUD"""

    @pytest.mark.asyncio
    async def test_create_group(self):
        async for db in get_db_session():
            user = await create_test_user(db)
            headers = get_auth_headers(user.id)
            chief_id = await _create_bot(db, user.id, "Chief测试")
            member_id = await _create_bot(db, user.id, "成员Bot")

            resp = client.post(
                "/api/v1/groups",
                json={"name": "测试协作群", "chief_bot_id": chief_id, "member_bot_ids": [member_id]},
                headers=headers,
            )
            assert resp.status_code == 200, f"Response: {resp.text}"
            data = resp.json()
            assert data["success"] is True
            group = data["data"]
            assert group["name"] == "测试协作群"
            assert group["chief_bot_id"] == chief_id
            assert any(m["bot_id"] == member_id for m in group["members"])
            assert any(m["bot_id"] == chief_id for m in group["members"])

    @pytest.mark.asyncio
    async def test_list_and_get_group(self):
        async for db in get_db_session():
            user = await create_test_user(db)
            headers = get_auth_headers(user.id)
            chief_id = await _create_bot(db, user.id, "Chief列表")

            created = client.post(
                "/api/v1/groups",
                json={"name": "列表群", "chief_bot_id": chief_id, "member_bot_ids": []},
                headers=headers,
            ).json()["data"]

            list_resp = client.get("/api/v1/groups", headers=headers)
            assert list_resp.status_code == 200
            assert any(g["id"] == created["id"] for g in list_resp.json()["items"])

            detail = client.get(f"/api/v1/groups/{created['id']}", headers=headers)
            assert detail.status_code == 200
            assert detail.json()["data"]["id"] == created["id"]

    @pytest.mark.asyncio
    async def test_member_management(self):
        async for db in get_db_session():
            user = await create_test_user(db)
            headers = get_auth_headers(user.id)
            chief_id = await _create_bot(db, user.id, "Chief成员")
            m1 = await _create_bot(db, user.id, "成员A")
            m2 = await _create_bot(db, user.id, "成员B")

            created = client.post(
                "/api/v1/groups",
                json={"name": "成员群", "chief_bot_id": chief_id, "member_bot_ids": [m1]},
                headers=headers,
            ).json()["data"]
            gid = created["id"]

            add_resp = client.post(
                f"/api/v1/groups/{gid}/members", json={"bot_ids": [m2]}, headers=headers,
            )
            assert add_resp.status_code == 200
            assert any(m["bot_id"] == m2 for m in add_resp.json()["items"])

            del_resp = client.delete(f"/api/v1/groups/{gid}/members/{m1}", headers=headers)
            assert del_resp.status_code == 200
            detail = client.get(f"/api/v1/groups/{gid}", headers=headers).json()["data"]
            assert all(m["bot_id"] != m1 for m in detail["members"])


class TestGroupMessageService:
    """消息派单（mock agent 执行，确定性）"""

    @pytest.mark.asyncio
    async def test_post_message_autodispatch_async(self):
        """未 @ 时触发自主派单：立即返回 pending，后台异步写最终汇总消息。"""
        import asyncio
        from unittest.mock import patch
        from app.services.ai.agent.bot_manager import BotManager
        async for db in get_db_session():
            user = await create_test_user(db)
            chief_id = await _create_bot(db, user.id, "Chief派单")
            service = GroupChatService(db)
            group = await service.create_group(
                tenant_id=1, name="派单群", chief_bot_id=chief_id, created_by=user.id,
            )

            exec_mock = MagicMock()
            exec_mock.final_response = "这是 Chief 的回复"
            exec_mock.execution_id = "exec-1"
            # 后台任务使用独立 session 创建新的 GroupChatService，
            # 需对 BotManager 类方法做 class-level patch 并保持到等待结束；
            # 同时 mock TaskPlanner.plan，避免后台任务真实调用 LLM 挂起
            from app.services.ai.agent.task_planner import TaskPlanner
            plan_patcher = patch.object(
                TaskPlanner, "plan",
                new=AsyncMock(return_value={"roles": [
                    {"role_key": "formula_designer", "task": "请设计一款配方", "matched_bot_id": None},
                ]}),
            )
            patcher = patch.object(BotManager, "execute_agent_task", new=AsyncMock(return_value=exec_mock))
            patcher.start()
            plan_patcher.start()
            try:
                result = await service.post_message(
                    group_id=group.id, tenant_id=1, user_id=user.id, content="请设计一款配方",
                )

                assert result["user_message"]["content"] == "请设计一款配方"
                assert result["user_message"]["sender_type"] == "user"
                assert result["async"] is True
                assert result["pending_message"]["content"].startswith("⏳")
                assert "replies" not in result

                # 等待后台异步派单完成（后台任务使用独立 session 写库，
                # 采用轮询而非固定 sleep，避免时序抖动导致断言失败）
                contents: list[str] = []
                deadline = asyncio.get_event_loop().time() + 30.0
                while asyncio.get_event_loop().time() < deadline:
                    msgs = await service.list_messages(group.id, tenant_id=1, limit=50)
                    contents = [m["content"] for m in msgs["items"]]
                    if any(c.startswith("【汇总】") or c == "这是 Chief 的回复" for c in contents):
                        break
                    await asyncio.sleep(0.3)
            finally:
                patcher.stop()
                plan_patcher.stop()
            assert any(c.startswith("【汇总】") or c == "这是 Chief 的回复" for c in contents), contents

    @pytest.mark.asyncio
    async def test_post_message_mention_specific_bot(self):
        async for db in get_db_session():
            user = await create_test_user(db)
            chief_id = await _create_bot(db, user.id, "Chief定向")
            member_id = await _create_bot(db, user.id, "安全专家")
            service = GroupChatService(db)
            group = await service.create_group(
                tenant_id=1, name="定向群", chief_bot_id=chief_id, created_by=user.id,
                member_bot_ids=[member_id],
            )

            exec_mock = MagicMock()
            exec_mock.final_response = "安全审查完成"
            exec_mock.execution_id = "exec-2"
            service._bot_manager.execute_agent_task = AsyncMock(return_value=exec_mock)

            result = await service.post_message(
                group_id=group.id, tenant_id=1, user_id=user.id,
                content="@安全专家 请审查",
                mentioned_bot_ids=[member_id],
            )

            assert len(result["replies"]) == 1
            assert result["replies"][0]["sender_bot_id"] == member_id
            assert result["replies"][0]["content"] == "安全审查完成"
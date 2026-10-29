"""
多智能体协作平台 Bot API 测试（DS Bot 移植 Phase 1）

覆盖：
1. 创建 Bot（含 persona/模型字段/能力白名单）
2. 列表（可见性过滤）
3. 详情（含记忆）
4. 更新 Bot
5. 软删除 Bot（删除后详情 404）
6. 记忆管理（添加/列表/删除）
"""
import asyncio

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models import User
from app.api.deps import get_db_session
from app.utils.auth import create_access_token
from tests._clean_test_users import (
    create_test_user as _shared_create_test_user,
)

client = TestClient(app)

# 注册延迟路由（TestClient 不启动 lifespan）
from app.api import register_lazy_routers  # noqa: E402
register_lazy_routers()

# CSRF 双提交（bots 已加入豁免，这里仍带上以保证兼容）
client.cookies.set("csrf_token", "test_csrf_token_for_bots")
client.headers["X-CSRF-Token"] = "test_csrf_token_for_bots"


# ── 统一使用 shared helper：
#    - id 落在 90M~99M 测试隔离区（< INT32_MAX，远大于生产 id<=10）
#    - 创建的 user id 自动登记，conftest 会话结束统一回收，无需手动清理 ──
async def create_test_user(db: AsyncSession, user_id: int = None) -> User:
    return await _shared_create_test_user(
        db,
        user_id=user_id,
        email_prefix="bot",
        username_prefix="botuser",
    )


def get_auth_headers(user_id: int) -> dict:
    token = create_access_token(data={"sub": str(user_id)})
    return {"Authorization": f"Bearer {token}"}


class TestBotAPI:
    """Bot CRUD + 记忆

    注意：TestClient 是同步客户端（内部在独立线程运行 ASGI 应用），不能在
    pytest-asyncio 的事件循环里调用（会报 "This event loop is already running"），
    因此这里用同步测试 + asyncio.run() 包裹 DB 异步操作。
    """

    def test_create_bot(self):
        async def _run():
            async for db in get_db_session():
                user = await create_test_user(db)
                headers = get_auth_headers(user.id)

                response = client.post(
                    "/api/v1/bots",
                    json={
                        "name": "测试配方专家",
                        "persona_prompt": "你是一个测试用配方专家。",
                        "description": "用于测试",
                        "capabilities": ["rag_retrieve"],
                        "visibility": "private",
                    },
                    headers=headers,
                )
                assert response.status_code == 200, f"Response: {response.text}"
                data = response.json()
                assert data["success"] is True
                bot = data["data"]
                assert bot["name"] == "测试配方专家"
                assert bot["persona_prompt"] == "你是一个测试用配方专家。"
                assert bot["capabilities"] == ["rag_retrieve"]
                assert bot["visibility"] == "private"
                assert bot["is_system"] is False
                assert bot["created_by"] == user.id
        asyncio.run(_run())

    def test_list_and_get_bot(self):
        async def _run():
            async for db in get_db_session():
                user = await create_test_user(db)
                headers = get_auth_headers(user.id)

                created = client.post(
                    "/api/v1/bots",
                    json={
                        "name": "列表测试Bot",
                        "persona_prompt": "你是一个列表测试 Bot。",
                        "visibility": "private",
                    },
                    headers=headers,
                ).json()["data"]

                list_resp = client.get("/api/v1/bots", headers=headers)
                assert list_resp.status_code == 200
                items = list_resp.json()["items"]
                assert any(b["id"] == created["id"] for b in items)

                detail = client.get(f"/api/v1/bots/{created['id']}", headers=headers)
                assert detail.status_code == 200
                assert detail.json()["data"]["id"] == created["id"]
                assert "memories" in detail.json()["data"]
        asyncio.run(_run())

    def test_update_bot(self):
        async def _run():
            async for db in get_db_session():
                user = await create_test_user(db)
                headers = get_auth_headers(user.id)

                created = client.post(
                    "/api/v1/bots",
                    json={
                        "name": "更新前",
                        "persona_prompt": "初始人设",
                        "visibility": "private",
                    },
                    headers=headers,
                ).json()["data"]

                resp = client.put(
                    f"/api/v1/bots/{created['id']}",
                    json={"name": "更新后", "description": "已更新"},
                    headers=headers,
                )
                assert resp.status_code == 200, f"Response: {resp.text}"
                bot = resp.json()["data"]
                assert bot["name"] == "更新后"
                assert bot["description"] == "已更新"
        asyncio.run(_run())

    def test_soft_delete_bot(self):
        async def _run():
            async for db in get_db_session():
                user = await create_test_user(db)
                headers = get_auth_headers(user.id)

                created = client.post(
                    "/api/v1/bots",
                    json={"name": "待删除", "persona_prompt": "将被删除", "visibility": "private"},
                    headers=headers,
                ).json()["data"]

                del_resp = client.delete(f"/api/v1/bots/{created['id']}", headers=headers)
                assert del_resp.status_code == 200
                assert del_resp.json()["success"] is True

                detail = client.get(f"/api/v1/bots/{created['id']}", headers=headers)
                assert detail.status_code == 404
        asyncio.run(_run())

    def test_memory_crud(self):
        async def _run():
            async for db in get_db_session():
                user = await create_test_user(db)
                headers = get_auth_headers(user.id)

                created = client.post(
                    "/api/v1/bots",
                    json={"name": "记忆Bot", "persona_prompt": "记忆测试", "visibility": "private"},
                    headers=headers,
                ).json()["data"]
                bot_id = created["id"]

                # 添加记忆
                mem_resp = client.post(
                    f"/api/v1/bots/{bot_id}/memories",
                    json={"content": "用户对花生过敏", "memory_type": "contraindication", "importance": 5},
                    headers=headers,
                )
                assert mem_resp.status_code == 200, f"Response: {mem_resp.text}"
                memory = mem_resp.json()["data"]
                assert memory["content"] == "用户对花生过敏"
                assert memory["memory_type"] == "contraindication"
                assert memory["importance"] == 5

                # 列表
                list_resp = client.get(f"/api/v1/bots/{bot_id}/memories", headers=headers)
                assert list_resp.status_code == 200
                assert any(m["id"] == memory["id"] for m in list_resp.json()["items"])

                # 删除记忆
                del_resp = client.delete(
                    f"/api/v1/bots/{bot_id}/memories/{memory['id']}", headers=headers,
                )
                assert del_resp.status_code == 200
                list_resp2 = client.get(f"/api/v1/bots/{bot_id}/memories", headers=headers)
                assert all(m["id"] != memory["id"] for m in list_resp2.json()["items"])
        asyncio.run(_run())

    def test_available_models(self):
        async def _run():
            async for db in get_db_session():
                user = await create_test_user(db)
                headers = get_auth_headers(user.id)
                resp = client.get("/api/v1/bots/available-models", headers=headers)
                assert resp.status_code == 200
                data = resp.json()
                assert data["success"] is True
                assert isinstance(data["items"], list)
        asyncio.run(_run())
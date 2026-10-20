"""聊天端点速率限制测试"""

import asyncio
import secrets

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock

from app.main import create_app
from app.api.deps import get_db_session
from app.models import User
from app.utils.auth import create_access_token
from tests.conftest_clean_users import track_test_user, make_test_user_id


def _setup_csrf(client: TestClient) -> None:
    """清空 cookie jar 并设置一对一致的 csrf cookie + header。"""
    token = secrets.token_hex(32)
    client.cookies.clear()
    client.cookies.set("csrf_token", token)
    client.headers["X-CSRF-Token"] = token


def _auth_headers() -> dict:
    """创建 90M~99M 隔离区测试用户并返回 Bearer headers。"""

    async def _create() -> int:
        async for db in get_db_session():
            uid = make_test_user_id()
            from sqlalchemy import delete as sa_delete
            await db.execute(sa_delete(User).where(
                (User.id == uid)
                | (User.username == f"ratelimit{uid}")
                | (User.email == f"ratelimit{uid}@example.com")
            ))
            await db.commit()
            user = User(
                id=uid,
                email=f"ratelimit{uid}@example.com",
                username=f"ratelimit{uid}",
                hashed_password="x",
                is_active=True,
                role="researcher",
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            track_test_user(user.id)
            return uid

    uid = asyncio.run(_create())
    return {"Authorization": f"Bearer {create_access_token(data={'sub': str(uid)})}"}


class TestChatRateLimiting:
    """聊天端点速率限制功能测试"""

    @pytest.fixture
    def client(self):
        """FastAPI 测试客户端"""
        app = create_app()
        c = TestClient(app)
        _setup_csrf(c)
        c.headers.update(_auth_headers())
        return c

    @patch("app.api.ai_modules.chat.get_ai_rate_limiter")
    def test_stream_rate_limiting_allowed(self, mock_get_limiter, client):
        """允许的请求应正常通过"""
        mock_limiter = MagicMock()
        mock_limiter.check_request = AsyncMock(return_value=(True, None))
        mock_limiter.register_sse_connection = AsyncMock(return_value=True)
        mock_get_limiter.return_value = mock_limiter

        response = client.post("/api/v1/ai/chat/stream", json={"question": "test"})
        # 流式响应返回 200
        assert response.status_code == 200 or response.status_code == 201

    @patch("app.api.ai_modules.chat.get_ai_rate_limiter")
    def test_stream_rate_limiting_exceeded(self, mock_get_limiter, client):
        """超出限制的请求应返回 429"""
        mock_limiter = MagicMock()
        mock_limiter.check_request = AsyncMock(return_value=(False, "Rate limited"))
        mock_get_limiter.return_value = mock_limiter

        response = client.post("/api/v1/ai/chat/stream", json={"question": "test"})
        assert response.status_code == 429
        assert "RATE_LIMIT" in str(response.json().get("detail", {}))

    @patch("app.api.ai_modules.chat.get_ai_rate_limiter")
    def test_chat_non_stream_quota_limiting(self, mock_get_limiter, client):
        """非流式聊天端点使用组织 AI 配额检查（超限返回 403）。"""
        mock_get_limiter.side_effect = AssertionError(
            "非流式 /chat 端点不使用 get_ai_rate_limiter"
        )
        with patch(
            "app.core.multi_tenant.multi_tenant_service.ensure_ai_quota",
            new=AsyncMock(side_effect=PermissionError("配额超限")),
        ):
            response = client.post("/api/v1/ai/chat", json={"question": "test"})
        assert response.status_code == 403

    @patch("app.api.ai_modules.chat.get_ai_rate_limiter")
    def test_sse_connection_limiting(self, mock_get_limiter, client):
        """SSE 连接数限制应生效"""
        mock_limiter = MagicMock()
        mock_limiter.check_request = AsyncMock(return_value=(True, None))
        mock_limiter.register_sse_connection = AsyncMock(return_value=False)  # 拒绝新连接
        mock_limiter.unregister_sse_connection = AsyncMock()  # 拒绝后清理
        mock_get_limiter.return_value = mock_limiter

        response = client.post("/api/v1/ai/chat/stream", json={"question": "test"})
        assert response.status_code == 429
        assert "TOO_MANY" in str(response.json().get("detail", {}))
"""聊天端点速率限制测试"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock
import asyncio

from app.main import create_app


class TestChatRateLimiting:
    """聊天端点速率限制功能测试"""

    @pytest.fixture
    def client(self):
        """FastAPI 测试客户端"""
        app = create_app()
        return TestClient(app)

    @patch("app.api.ai_modules.chat.get_ai_rate_limiter")
    async def test_stream_rate_limiting_allowed(self, mock_get_limiter, client):
        """允许的请求应正常通过"""
        mock_limiter = MagicMock()
        mock_limiter.check_request = AsyncMock(return_value=(True, None))
        mock_limiter.register_sse_connection = AsyncMock(return_value=True)
        mock_get_limiter.return_value = mock_limiter

        response = client.post("/api/v1/chat/stream", data={"question": "test"})
        # 流式响应返回 200
        assert response.status_code == 200 or response.status_code == 201

    @patch("app.api.ai_modules.chat.get_ai_rate_limiter")
    async def test_stream_rate_limiting_exceeded(self, mock_get_limiter, client):
        """超出限制的请求应返回 429"""
        mock_limiter = MagicMock()
        mock_limiter.check_request = AsyncMock(return_value=(False, "Rate limited"))
        mock_get_limiter.return_value = mock_limiter

        response = client.post("/api/v1/chat/stream", data={"question": "test"})
        assert response.status_code == 429
        assert "RATE_LIMIT" in str(response.json().get("detail", {}))

    @patch("app.api.ai_modules.chat.get_ai_rate_limiter")
    async def test_chat_non_stream_rate_limiting(self, mock_get_limiter, client):
        """非流式聊天端点的速率限制同样生效"""
        mock_limiter = MagicMock()
        mock_limiter.check_request = AsyncMock(return_value=(False, "Too many requests"))
        mock_get_limiter.return_value = mock_limiter

        response = client.post("/api/v1/chat", json={"question": "test"})
        assert response.status_code == 429

    @patch("app.api.ai_modules.chat.get_ai_rate_limiter")
    async def test_sse_connection_limiting(self, mock_get_limiter, client):
        """SSE 连接数限制应生效"""
        mock_limiter = MagicMock()
        mock_limiter.check_request = AsyncMock(return_value=(True, None))
        mock_limiter.register_sse_connection = AsyncMock(return_value=False)  # 拒绝新连接
        mock_get_limiter.return_value = mock_limiter

        response = client.post("/api/v1/chat/stream", data={"question": "test"})
        assert response.status_code == 429
        assert "TOO_MANY" in str(response.json().get("detail", {}))

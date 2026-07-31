"""AI 服务健康检查集成测试"""

import pytest
from fastapi.testclient import TestClient
from app.main import create_app


class TestAIHealth:
    """AI 服务健康检查端点测试"""

    @pytest.fixture
    def client(self):
        app = create_app()
        return TestClient(app)

    def test_ai_status_endpoint(self, client):
        """AI 状态端点应返回 200"""
        response = client.get("/api/v1/ai/status")
        assert response.status_code == 200
        data = response.json()
        assert "available" in data or "model" in data  # 包含可用性或模型信息

    def test_chat_endpoint_availability(self, client):
        """聊天端点在 AI 不可用时应有 fallback 机制"""
        response = client.post("/api/v1/chat", json={"question": "test health"})
        # 即使 AI 服务暂时不可用，系统也应返回合理响应
        # 成功时 200，失败但 fallback 时 503 或其他可接受的状态
        assert response.status_code in [200, 503]  # 200 正常，503 降级模式可接受

        # 检查响应中是否包含 fallback 提示
        if response.status_code == 503:
            assert "fallback" in str(response.json().get("detail", "")).lower() or \
                   "thinking_engine" in str(response.json().get("detail", "")).lower()

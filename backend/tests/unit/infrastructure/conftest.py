"""
conftest — infrastructure 目录专用轻量夹具

背景：根 conftest 的 ``app`` fixture 调用 ``app.main.create_app()``，
该函数会注册全部路由并触发 ChromaDB / jieba / 数据库连接等重型初始化；
在 coverage（backend/pytest.ini 默认 ``--cov=app``）下导入 app.main 会导致
pytest collection/运行长时间卡住。

本 conftest 将 ``app`` fixture 覆盖为「仅挂载 /api/v1/ai 聊天路由」的轻量
FastAPI 应用，并沿用根 conftest 的用户认证依赖覆盖，足以支撑
test_chat_stream_protocol.py 的 TestClient 集成测试，且不触发重型初始化。
"""
import pytest
from fastapi import FastAPI
from unittest.mock import MagicMock


@pytest.fixture()
def app():
    """返回仅包含 AI 聊天路由的轻量 FastAPI app（不调用 create_app）。"""
    # 导入 app.api.ai_modules 会同时导入 chat 子路由并注册到 ai_modules.router
    from app.api.ai_modules import router as ai_router
    from app.api.deps import get_current_active_user, get_current_user
    from app.models import User

    app = FastAPI()
    app.include_router(ai_router, prefix="/api/v1")

    async def mock_get_current_user():
        user = MagicMock(spec=User)
        user.id = 1
        user.username = "test_researcher"
        user.email = "test@example.com"
        user.role = "researcher"
        user.is_active = True
        return user

    async def mock_get_active_user():
        return await mock_get_current_user()

    app.dependency_overrides[get_current_user] = mock_get_current_user
    app.dependency_overrides[get_current_active_user] = mock_get_active_user
    return app
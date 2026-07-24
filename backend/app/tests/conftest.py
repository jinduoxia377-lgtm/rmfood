"""
共享测试夹具 (Shared Test Fixtures)

为 unit / integration / api / e2e 各层级提供共用 fixture。
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

from app.main import create_app


# ── FastAPI Test Client ────────────────────────────────────────────────

@pytest.fixture()
def client():
    """创建 FastAPI TestClient，不启动实际服务器。"""
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def app():
    """返回未绑定的 FastAPI app 实例（用于 TestClient 上下文管理器或 ASGI 测试）。"""
    return create_app()


# ── 数据库连接字符串常量 ─────────────────────────────────────────────

TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/rmfood_test"


# ── Mock 工具 ────────────────────────────────────────────────────────

@pytest.fixture()
def mock_async_session():
    """返回一个模拟的异步数据库会话。"""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.scalars = MagicMock()
    session.scalar = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()
    return session


@pytest.fixture()
def mock_dependency():
    """通用依赖注入 fixture：返回一个 AsyncMock。"""
    return AsyncMock()


# ── 用户工厂（轻量，仅构造数据） ────────────────────────────────────

@pytest.fixture()
def user_factory():
    """返回一个简单的用户数据构造函数。"""

    def _make(
        id: int = 1,
        username: str = "testuser",
        email: str = "test@example.com",
        hashed_password: str = "hashed_pw",
        is_active: bool = True,
        role: str = "user",
    ):
        user = MagicMock()
        user.id = id
        user.username = username
        user.email = email
        user.hashed_password = hashed_password
        user.is_active = is_active
        user.role = role
        return user

    return _make


# ── Formula 工厂（轻量，仅构造数据） ─────────────────────────────────

@pytest.fixture()
def formula_factory():
    """返回一个简单的配方数据构造函数。"""

    def _make(
        id: int = 1,
        name: str = "Test Formula",
        category: str = "functional_food",
        version: int = 1,
        status: str = "draft",
        creator_id: int = 1,
    ):
        formula = MagicMock()
        formula.id = id
        formula.name = name
        formula.category = category
        formula.version = version
        formula.status = status
        formula.creator_id = creator_id
        return formula

    return _make

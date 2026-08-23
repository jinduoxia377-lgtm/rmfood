"""
RMFOOD 项目测试配置

提供统一的模块路径和 pytest 插件配置，确保所有测试文件可以正常导入。
关键：确保模块只从主仓库加载，避免工作树路径冲突。
"""
import sys
import os

# 清除工作树路径（避免模块从多个位置加载导致 SQLAlchemy metadata 冲突）
sys.path = [p for p in sys.path if "worktrees" not in p and ".claude" not in p and p != ""]

# 设置项目根目录为主仓库（非工作树）
_PROJECT_ROOT = r"D:\RMFOODFP"
_BACKEND_DIR = os.path.join(_PROJECT_ROOT, "backend")

# 添加路径（backend 必须在 app 之前，因为 app 是 backend 的子包）
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)
# 配置 chromadb 在测试环境中静默
os.environ.setdefault("CHROMA_NO_TELEMETRY", "1")

# 在导入任何模型前先加载 base，确保 SQLAlchemy metadata 唯一
import app.models.base  # noqa: F401

# ── 共享测试夹具 ───────────────────────────────────────────────────
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture()
def client():
    """创建 FastAPI TestClient，不启动实际服务器。"""
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def async_client():
    """创建异步 FastAPI TestClient。"""
    from httpx import AsyncClient, ASGITransport
    app = create_app()
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture()
def app():
    """返回未绑定的 FastAPI app 实例。"""
    from app.main import create_app
    app = create_app()
    # 测试环境：绕过 JWT 认证，直接返回 mock 用户
    from app.api.deps import get_current_user, get_current_active_user
    from app.models import User
    from unittest.mock import MagicMock

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


@pytest.fixture()
def researcher_headers():
    """研究者角色的认证头。"""
    return {"Authorization": "Bearer researcher_test_token"}


@pytest.fixture()
def admin_headers():
    """管理员角色的认证头。"""
    return {"Authorization": "Bearer admin_test_token"}

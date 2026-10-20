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


# ── 数据库会话夹具（迁移自 conftest_db.py，供 tests/unit 使用） ──────────
import asyncio
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession

# 各测试文件中固定使用的测试用户名（服务直接注册/创建用户时无法通过 create_user
# 夹具清理，需在会话级预先删除上次运行可能残留的数据）
_TEST_USERNAMES = [
    "newuser", "existing", "user1", "user2", "user3", "loginuser", "changepw",
    "refreshuser", "meuser", "getuser", "findme", "upduser", "deactivate",
    "alice", "bob", "researcher1", "admin1", "formulator", "owner", "listuser",
    "filteruser", "searchuser", "inactive", "testuser", "wrongpw", "listcreator",
    "pageuser", "fieldcreator", "createuser", "minimaluser", "nonameuser",
    "emptyuser", "getcreator", "notfounduser", "badiduser",
]


@pytest.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """获取真实数据库会话"""
    from app.core.database.session import get_db
    async for session in get_db():
        # 清理上次运行残留的固定用户名测试数据，保证测试可重复执行
        from sqlalchemy import delete
        from app.models.user_model import User
        await session.execute(delete(User).where(User.username.in_(_TEST_USERNAMES)))
        await session.flush()
        yield session


@pytest.fixture
async def create_user(db_session: AsyncSession):
    """在数据库中创建用户

    使用方式:
        user = await create_user(username="alice", role=UserRole.ADMIN)
    """
    from app.models.user_model import User
    from app.models.enums import UserRole
    from app.utils.auth import get_password_hash

    async def _create(
        username: str = "testuser",
        email: str = None,
        password: str = "TestPassword123!",
        full_name: str = "测试用户",
        role: UserRole = UserRole.RESEARCHER,
        is_active: bool = True,
        **kwargs,
    ) -> User:
        if email is None:
            email = f"{username}@test.com"
        # 清理同名/同邮箱的残留数据（上次运行异常退出可能未清理），保证测试可重复执行
        from sqlalchemy import delete
        await db_session.execute(
            delete(User).where((User.username == username) | (User.email == email))
        )
        await db_session.flush()
        user = User(
            username=username,
            email=email,
            hashed_password=get_password_hash(password),
            full_name=full_name,
            role=role,
            is_active=is_active,
            **kwargs,
        )
        db_session.add(user)
        await db_session.flush()
        return user
    return _create


@pytest.fixture
async def create_formula(db_session: AsyncSession):
    """在数据库中创建配方

    使用方式:
        formula = await create_formula(name="养气配方", creator_id=user.id)
    """
    from app.models.formula import Formula
    from app.models.enums import FormulaStatus

    _counter = [0]

    async def _create(
        name: str = "测试配方",
        description: str = "测试配方描述",
        creator_id: int = 1,
        status: FormulaStatus = FormulaStatus.DRAFT,
        code: str = None,
        **kwargs,
    ) -> Formula:
        if code is None:
            _counter[0] += 1
            code = f"RMF-TEST-{_counter[0]:04d}"
        formula = Formula(
            name=name,
            code=code,
            description=description,
            creator_id=creator_id,
            status=status,
            version=1,
            target_effects=["补气"],
            composition={"ingredients": [{"name": "人参", "percentage": 100}]},
            **kwargs,
        )
        db_session.add(formula)
        await db_session.flush()
        return formula
    return _create


def pytest_configure(config: "pytest.Config") -> None:
    """Register the session-end test-user/bot sweep (atexit-based,
    runs after pytest-asyncio closes its main event loop).

    直接调用 conftest_clean_users.pytest_configure 把 atexit 钩子挂上——
    仅 import 模块不会自动注册 pytest hook（pytest 只扫描 conftest.py 文件本身）。
    """
    # 注册测试中使用的自定义标记（配合 pytest.ini 的 --strict-markers）
    config.addinivalue_line("markers", "api: API-related tests")
    config.addinivalue_line("markers", "performance: performance-related tests")
    config.addinivalue_line("markers", "ray: Ray cluster tests")
    config.addinivalue_line("markers", "security: security-related tests")

    import tests.conftest_clean_users as _ccu
    _ccu.pytest_configure(config)

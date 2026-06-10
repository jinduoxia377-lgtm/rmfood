"""RMFOOD 测试配置

提供完整的测试基础设施:
- 内存 SQLite 测试数据库（自动创建/销毁）
- 异步测试客户端（自动依赖注入覆盖）
- 认证客户端 fixtures（admin/researcher/formulator）
- 测试数据工厂（User/Formula/Experiment）
- Mock fixtures（AI服务、外部API）

使用方式:
    # 在测试文件中直接使用 fixtures
    async def test_create_formula(client, admin_headers, sample_formula_data):
        resp = await client.post("/api/v1/formulas", json=sample_formula_data, headers=admin_headers)
        assert resp.status_code == 201
"""
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base
from app.core.session import get_db
from app.api.deps import get_db_session
from app.models.user_model import User
from app.models.formula import Formula
from app.models.experiment import Experiment
from app.models.enums import UserRole, FormulaStatus, ExperimentStatus
from app.utils.auth import get_password_hash
from app.services.auth import create_access_token


TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


# ════════════════════════════════════════════
# 事件循环
# ════════════════════════════════════════════

@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """创建事件循环"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ════════════════════════════════════════════
# 数据库 Fixtures
# ════════════════════════════════════════════

@pytest.fixture(scope="function")
async def async_engine():
    """创建测试数据库引擎（每个测试函数独立的内存数据库）"""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture(scope="function")
async def db_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """创建测试数据库会话（自动回滚）"""
    async_session = sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session() as session:
        yield session
        await session.rollback()


# ════════════════════════════════════════════
# HTTP 客户端 Fixtures
# ════════════════════════════════════════════

@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """创建测试客户端（自动覆盖数据库依赖）"""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_db_session] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ════════════════════════════════════════════
# Token & 认证 Fixtures
# ════════════════════════════════════════════

def _make_token(user_id: int, role: str) -> str:
    """生成测试用 Token"""
    return create_access_token(user_id=user_id, role=role)


@pytest.fixture
def admin_token() -> str:
    """管理员 Token"""
    return _make_token(user_id=1, role="admin")


@pytest.fixture
def researcher_token() -> str:
    """研究员 Token"""
    return _make_token(user_id=2, role="researcher")


@pytest.fixture
def formulator_token() -> str:
    """配方师 Token"""
    return _make_token(user_id=3, role="formulator")


@pytest.fixture
def admin_headers(admin_token: str) -> dict:
    """管理员请求头"""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def researcher_headers(researcher_token: str) -> dict:
    """研究员请求头"""
    return {"Authorization": f"Bearer {researcher_token}"}


@pytest.fixture
def formulator_headers(formulator_token: str) -> dict:
    """配方师请求头"""
    return {"Authorization": f"Bearer {formulator_token}"}


# ════════════════════════════════════════════
# 测试数据工厂 Fixtures
# ════════════════════════════════════════════

@pytest.fixture
def user_factory():
    """用户数据工厂

    使用方式:
        data = user_factory(username="alice", role="admin")
    """
    def _create(
        username: str = "testuser",
        email: str = None,
        password: str = "TestPassword123!",
        full_name: str = "测试用户",
        role: str = "researcher",
        department: str = "研发部",
        **kwargs,
    ) -> dict:
        if email is None:
            email = f"{username}@test.com"
        return {
            "username": username,
            "email": email,
            "password": password,
            "full_name": full_name,
            "role": role,
            "department": department,
            **kwargs,
        }
    return _create


@pytest.fixture
def formula_factory():
    """配方数据工厂

    使用方式:
        data = formula_factory(name="养气配方", target_effects=["补气"])
    """
    def _create(
        name: str = "测试配方",
        code: str = "RMF-TEST-001",
        description: str = "这是一个测试配方",
        target_effects: list = None,
        composition: dict = None,
        dosage: str = "10g/次",
        **kwargs,
    ) -> dict:
        if target_effects is None:
            target_effects = ["补气", "养血"]
        if composition is None:
            composition = {
                "ingredients": [
                    {"name": "人参", "percentage": 20},
                    {"name": "枸杞", "percentage": 30},
                ]
            }
        return {
            "name": name,
            "code": code,
            "description": description,
            "target_effects": target_effects,
            "composition": composition,
            "dosage": dosage,
            "storage_conditions": "避光、密封",
            "shelf_life": 365,
            **kwargs,
        }
    return _create


@pytest.fixture
def experiment_factory():
    """实验数据工厂

    使用方式:
        data = experiment_factory(title="稳定性测试")
    """
    def _create(
        title: str = "测试实验",
        code: str = "EXP-TEST-001",
        description: str = "这是一个测试实验",
        objectives: list = None,
        methodology: str = "采用标准方法进行实验",
        **kwargs,
    ) -> dict:
        if objectives is None:
            objectives = ["验证配方功效", "测试稳定性"]
        return {
            "title": title,
            "code": code,
            "description": description,
            "objectives": objectives,
            "methodology": methodology,
            "materials": ["样品A", "样品B"],
            "equipment": ["高效液相色谱仪", "紫外分光光度计"],
            **kwargs,
        }
    return _create


# ════════════════════════════════════════════
# 数据库对象工厂 Fixtures（直接创建 ORM 对象）
# ════════════════════════════════════════════

@pytest.fixture
async def create_user(db_session: AsyncSession):
    """在数据库中创建用户

    使用方式:
        user = await create_user(username="alice", role=UserRole.ADMIN)
    """
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


# ════════════════════════════════════════════
# 认证客户端 Fixtures（已登录状态）
# ════════════════════════════════════════════

@pytest.fixture
async def admin_client(client: AsyncClient, admin_headers: dict) -> AsyncClient:
    """已认证的管理员客户端"""
    client.headers.update(admin_headers)
    return client


@pytest.fixture
async def researcher_client(client: AsyncClient, researcher_headers: dict) -> AsyncClient:
    """已认证的研究员客户端"""
    client.headers.update(researcher_headers)
    return client


# ════════════════════════════════════════════
# Sample Data Fixtures（向后兼容）
# ════════════════════════════════════════════

@pytest.fixture
def sample_user_data() -> dict:
    """示例用户数据"""
    return {
        "username": "testuser",
        "email": "test@example.com",
        "password": "TestPassword123!",
        "full_name": "测试用户",
        "role": "researcher",
        "department": "研发部",
    }


@pytest.fixture
def sample_formula_data() -> dict:
    """示例配方数据"""
    return {
        "name": "测试配方",
        "code": "RMF-TEST-001",
        "description": "这是一个测试配方",
        "target_effects": ["补气", "养血"],
        "composition": {
            "ingredients": [
                {"name": "人参", "percentage": 20},
                {"name": "枸杞", "percentage": 30},
            ]
        },
        "dosage": "10g/次",
        "storage_conditions": "避光、密封",
        "shelf_life": 365,
    }


@pytest.fixture
def sample_experiment_data() -> dict:
    """示例实验数据"""
    return {
        "title": "测试实验",
        "code": "EXP-TEST-001",
        "description": "这是一个测试实验",
        "objectives": ["验证配方功效", "测试稳定性"],
        "methodology": "采用标准方法进行实验",
        "materials": ["样品A", "样品B"],
        "equipment": ["高效液相色谱仪", "紫外分光光度计"],
    }

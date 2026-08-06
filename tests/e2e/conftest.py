"""
RMFOOD 配方平台 - E2E集成测试配置

提供测试数据库、Mock服务、认证工具和测试数据种子。
支持pytest-asyncio异步测试和HTTPX TestClient。
"""
import asyncio
import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from typing import AsyncGenerator, Dict, Any, Optional
from unittest.mock import AsyncMock, MagicMock, patch
import httpx
from httpx import ASGITransport, AsyncClient
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

from app.main import app
from app.core.database.session import async_engine, Base
from app.core.database import async_session_factory
from app.core.config import settings
from app.models.user_model import User
from app.models.team import Team
from app.models.team_member import TeamMember
from app.models.sync_log import SyncLog
from app.models.user_device import UserDevice
from app.models.notification import Notification
from app.models.prompt_version import PromptVersion
from app.models.enums import (
    TeamRole,
    SyncAction,
    SyncStatus,
    NotificationType,
    DeviceType,
)
from app.core.security import (
    create_access_token,
    get_password_hash,
)


# ════════════════════════════════════════════════
# 测试配置常量
# ════════════════════════════════════════════════
TEST_BASE_URL = "http://test"
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# 测试用户数据种子
TEST_USERS = {
    "owner": {
        "username": "test_owner",
        "email": "owner@test.com",
        "password": "TestOwner123!",
        "full_name": "Test Owner",
        "role": "admin",
    },
    "member1": {
        "username": "test_member1",
        "email": "member1@test.com",
        "password": "TestMember123!",
        "full_name": "Test Member 1",
        "role": "user",
    },
    "member2": {
        "username": "test_member2",
        "email": "member2@test.com",
        "password": "TestMember123!",
        "full_name": "Test Member 2",
        "role": "user",
    },
}

TEST_TEAM_DATA = {
    "name": "E2E Test Team",
    "description": "团队协作E2E测试专用团队",
    "settings": {
        "max_members": 10,
        "allow_invite": True,
    },
}


@pytest.fixture(scope="session")
def event_loop():
    """创建事件循环用于异步测试"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator:
    """
    创建测试用内存SQLite数据库会话
    每个测试函数使用独立的数据库实例，确保隔离性
    """
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        future=True,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        bind=engine,
        class_=asyncio.AsyncSession,
        expire_on_commit=False,
    )

    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def client(db_session) -> AsyncGenerator[AsyncClient, None]:
    """
    创建HTTPX异步测试客户端
    使用ASGI传输直接调用FastAPI应用，无需启动HTTP服务器
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url=TEST_BASE_URL) as ac:
        ac._db_session = db_session
        yield ac


@pytest_asyncio.fixture(scope="function")
async def auth_tokens(client: AsyncClient, db_session) -> Dict[str, str]:
    """
    创建测试用户并返回认证Token字典
    返回格式: {username: access_token}
    """
    tokens = {}

    for user_key, user_data in TEST_USERS.items():
        # 创建用户（如果不存在）
        result = await db_session.execute(
            select(User).where(User.username == user_data["username"])
        )
        existing_user = result.scalar_one_or_none()

        if not existing_user:
            hashed_password = get_password_hash(user_data["password"])
            user = User(
                username=user_data["username"],
                email=user_data["email"],
                hashed_password=hashed_password,
                full_name=user_data["full_name"],
                is_active=True,
                role=user_data.get("role", "user"),
            )
            db_session.add(user)
            await db_session.flush()
            user_id = user.id
        else:
            user_id = existing_user.id

        # 生成Token
        token_data = {
            "sub": str(user_id),
            "username": user_data["username"],
        }
        token = create_access_token(data=token_data)
        tokens[user_key] = token

    await db_session.commit()
    return tokens


@pytest_asyncio.fixture(scope="function")
async def test_team(client: AsyncClient, db_session, auth_tokens: Dict[str, str]) -> Team:
    """
    创建测试团队并返回Team对象
    自动将owner用户设为团队所有者
    """
    # 获取owner用户ID
    owner_result = await db_session.execute(
        select(User).where(User.username == TEST_USERS["owner"]["username"])
    )
    owner_user = owner_result.scalar_one()

    # 创建团队
    team = Team(
        name=TEST_TEAM_DATA["name"],
        description=TEST_TEAM_DATA["description"],
        owner_id=owner_user.id,
        settings=TEST_TEAM_DATA["settings"],
    )
    db_session.add(team)
    await db_session.flush()

    # 创建owner成员记录
    owner_member = TeamMember(
        team_id=team.id,
        user_id=owner_user.id,
        role=TeamRole.OWNER,
        joined_at=datetime.now(timezone.utc),
    )
    db_session.add(owner_member)

    # 添加其他测试成员
    for member_key in ["member1", "member2"]:
        member_result = await db_session.execute(
            select(User).where(User.username == TEST_USERS[member_key]["username"])
        )
        member_user = member_result.scalar_one()

        team_member = TeamMember(
            team_id=team.id,
            user_id=member_user.id,
            role=TeamRole.MEMBER,
            joined_at=datetime.now(timezone.utc),
        )
        db_session.add(team_member)

    await db_session.commit()
    await db_session.refresh(team)
    return team


@pytest_asyncio.fixture(scope="function")
async def test_device(db_session, auth_tokens: Dict[str, str]) -> UserDevice:
    """
    注册测试设备并返回UserDevice对象
    """
    # 获取owner用户
    owner_result = await db_session.execute(
        select(User).where(User.username == TEST_USERS["owner"]["username"])
    )
    owner_user = owner_result.scalar_one()

    device = UserDevice(
        device_id="test-device-e2e-001",
        user_id=owner_user.id,
        device_type=DeviceType.WEB,
        device_name="E2E Test Browser",
        is_active=True,
    )
    db_session.add(device)
    await db_session.commit()
    await db_session.refresh(device)
    return device


@pytest.fixture
def mock_ai_service():
    """
    Mock AI服务，避免在测试中调用真实LLM API
    返回预定义的AI响应
    """
    mock_response = {
        "generated_prompt": "这是一个由AI生成的优化提示词，包含详细的配方设计参数...",
        "optimization_suggestions": [
            {"field": "ingredient_ratio", "suggestion": "调整比例至3:2:1"},
            {"field": "processing_time", "suggestion": "增加发酵时间至48小时"},
        ],
        "confidence_score": 0.92,
        "model_used": "gpt-4o-mini",
        "tokens_used": 256,
    }

    with patch("app.api.v1.ai_router._get_ai_service") as mock:
        mock_instance = AsyncMock()
        mock_instance.generate_prompt = AsyncMock(return_value=mock_response)
        mock_instance.optimize_formula = AsyncMock(return_value=mock_response)
        mock_instance.analyze_requirements = AsyncMock(return_value={
            "analysis": "需求分析完成",
            "key_parameters": ["功效目标", "口感偏好", "成本约束"],
            "suggestions": ["建议添加功能性成分"],
        })
        mock.return_value = mock_instance
        yield mock_instance


@pytest.fixture
def mock_external_apis():
    """
    Mock外部API服务（邮件、短信、第三方集成等）
    确保测试不依赖外部服务可用性
    """
    mocks = {
        "email_service": AsyncMock(send_email=AsyncMock(return_value={"success": True})),
        "sms_service": AsyncMock(send_sms=AsyncMock(return_value={"success": True})),
        "webhook_service": AsyncMock(trigger=AsyncMock(return_value={"success": True})),
    }

    with patch.dict("sys.modules", {
        "app.services.email": MagicMock(**mocks["email_service"]),
        "app.services.sms": MagicMock(**mocks["sms_service"]),
        "app.services.webhook": MagicMock(**mocks["webhook_service"]),
    }):
        yield mocks


# ════════════════════════════════════════════════
# 公共测试辅助函数
# ════════════════════════════════════════════════

class TestHelpers:
    """E2E测试公共工具类"""

    @staticmethod
    async def register_user(
        client: AsyncClient,
        username: str,
        email: str,
        password: str,
        full_name: str = None,
    ) -> dict:
        """注册新用户"""
        payload = {
            "username": username,
            "email": email,
            "password": password,
        }
        if full_name:
            payload["full_name"] = full_name

        response = await client.post("/api/v1/auth/register", json=payload)
        assert response.status_code in [200, 201], f"注册失败: {response.text}"
        return response.json()

    @staticmethod
    async def login_user(
        client: AsyncClient,
        username: str,
        password: str,
    ) -> dict:
        """用户登录获取Token"""
        payload = {
            "username": username,
            "password": password,
        }
        response = await client.post("/api/v1/auth/login", json=payload)
        assert response.status_code == 200, f"登录失败: {response.text}"
        return response.json()

    @staticmethod
    def get_auth_header(token: str) -> dict:
        """构建Authorization请求头"""
        return {"Authorization": f"Bearer {token}"}

    @staticmethod
    async def create_team_via_api(
        client: AsyncClient,
        token: str,
        team_name: str,
        description: str = None,
    ) -> dict:
        """通过API创建团队"""
        headers = TestHelpers.get_auth_header(token)
        payload = {"name": team_name}
        if description:
            payload["description"] = description

        response = await client.post(
            "/api/v1/teams",
            json=payload,
            headers=headers,
        )
        assert response.status_code == 201, f"创建团队失败: {response.text}"
        return response.json()

    @staticmethod
    async def invite_member(
        client: AsyncClient,
        token: str,
        team_id: int,
        invitee_username: str,
        role: str = "member",
    ) -> dict:
        """邀请成员加入团队"""
        headers = TestHelpers.get_auth_header(token)
        payload = {
            "team_id": team_id,
            "invitee_username": invitee_username,
            "role": role,
        }

        response = await client.post(
            "/api/v1/teams/invite",
            json=payload,
            headers=headers,
        )
        assert response.status_code in [200, 201], f"邀请成员失败: {response.text}"
        return response.json()

    @staticmethod
    async def push_sync_changes(
        client: AsyncClient,
        token: str,
        device_id: str,
        changes: list,
    ) -> dict:
        """推送同步变更"""
        headers = TestHelpers.get_auth_header(token)
        payload = {
            "device_id": device_id,
            "changes": changes,
            "client_timestamp": datetime.now(timezone.utc).isoformat(),
        }

        response = await client.post(
            "/api/v1/sync/push",
            json=payload,
            headers=headers,
        )
        return response.json()

    @staticmethod
    async def pull_sync_changes(
        client: AsyncClient,
        token: str,
        device_id: str,
        since: datetime = None,
    ) -> dict:
        """拉取同步变更"""
        headers = TestHelpers.get_auth_header(token)
        params = {"device_id": device_id}
        if since:
            params["since"] = since.isoformat()

        response = await client.get(
            "/api/v1/sync/pull",
            params=params,
            headers=headers,
        )
        assert response.status_code == 200, f"拉取同步失败: {response.text}"
        return response.json()

    @staticmethod
    async def generate_ai_prompt(
        client: AsyncClient,
        token: str,
        requirements: dict,
    ) -> dict:
        """调用AI生成提示词"""
        headers = TestHelpers.get_auth_header(token)
        response = await client.post(
            "/api/v1/ai/generate-prompt",
            json=requirements,
            headers=headers,
        )
        assert response.status_code == 200, f"AI生成失败: {response.text}"
        return response.json()

    @staticmethod
    def assert_response_structure(response: dict, required_fields: list):
        """验证响应JSON结构完整性"""
        for field in required_fields:
            assert field in response, f"响应缺少必需字段: {field}"

    @staticmethod
    def assert_pagination_structure(response: dict):
        """验证分页响应结构"""
        required = ["items", "total", "page", "page_size"]
        TestHelpers.assert_response_structure(response, required)
        assert isinstance(response["items"], list), "items应为列表"
        assert isinstance(response["total"], int), "total应为整数"

    @staticmethod
    async def wait_for_condition(
        condition_func,
        timeout: float = 5.0,
        interval: float = 0.1,
    ) -> bool:
        """
        等待条件满足（轮询）
        用于异步操作的状态验证
        """
        start = asyncio.get_event_loop().time()
        while (asyncio.get_event_loop().time() - start) < timeout:
            if await condition_func():
                return True
            await asyncio.sleep(interval)
        return False


# pytest配置标记
def pytest_configure(config):
    """注册自定义测试标记"""
    config.addinivalue_line(
        "markers", "e2e: 标记为端到端集成测试"
    )
    config.addinivalue_line(
        "markers", "slow: 标记为耗时较长的测试"
    )
    config.addinivalue_line(
        "markers", "integration: 标记为模块集成测试"
    )


# 全局异常处理：确保测试失败时输出详细日志
@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    if report.when == "call" and report.failed:
        # 输出失败的测试详细信息
        print(f"\n{'='*60}")
        print(f"❌ 测试失败: {item.name}")
        print(f"   文件: {item.fspath}")
        print(f"   行号: {item.lineno}")
        print(f"{'='*60}\n")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

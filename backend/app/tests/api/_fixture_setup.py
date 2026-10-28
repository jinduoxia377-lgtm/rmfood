"""
API 测试夹具 (API Test Fixtures)

提供认证 token、租户上下文等常用 fixture。
"""

from unittest.mock import MagicMock

import pytest


@pytest.fixture()
def auth_headers():
    """返回标准的 Bearer token header。"""
    return {"Authorization": "Bearer test-token-placeholder"}


@pytest.fixture()
def mock_auth_dependency():
    """模拟 auth 依赖：返回一个固定的用户对象。"""
    user = MagicMock()
    user.id = 42
    user.username = "testuser"
    user.role = "admin"
    user.is_active = True
    return user


@pytest.fixture()
def mock_current_user(mock_auth_dependency):
    """模拟当前登录用户（通过 FastAPI Depends）。"""
    async def _get_current_user():
        return mock_auth_dependency

    return _get_current_user

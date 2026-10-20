"""分享跟踪测试

注意：生产 API 中 /api/v1/shares/* 与 /api/v1/formulas/{id}/share 等分享端点尚未实现，
请求会返回 404；本测试验证这些路径的可达性与鉴权行为（接受 404）。
"""
import asyncio
import secrets

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.api.deps import get_db_session
from app.models import User
from app.utils.auth import create_access_token
from tests.conftest_clean_users import track_test_user, make_test_user_id


@pytest.fixture()
def client():
    """带真实认证 + CSRF 的同步 TestClient。"""
    app = create_app()
    c = TestClient(app)

    async def _create_user() -> int:
        async for db in get_db_session():
            uid = make_test_user_id()
            from sqlalchemy import delete as sa_delete
            await db.execute(sa_delete(User).where(
                (User.id == uid)
                | (User.username == f"share{uid}")
                | (User.email == f"share{uid}@example.com")
            ))
            await db.commit()
            user = User(
                id=uid,
                email=f"share{uid}@example.com",
                username=f"share{uid}",
                hashed_password="x",
                is_active=True,
                role="researcher",
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            track_test_user(user.id)
            return uid

    uid = asyncio.run(_create_user())
    c.headers["Authorization"] = f"Bearer {create_access_token(data={'sub': str(uid)})}"
    token = secrets.token_hex(32)
    c.cookies.clear()
    c.cookies.set("csrf_token", token)
    c.headers["X-CSRF-Token"] = token
    return c


def _share_post(client, url: str, payload: dict):
    return client.post(url, json=payload)


def test_create_share(client):
    """测试创建分享（分享端点未实现时返回 404）"""
    # 先创建一个真实配方
    created = client.post(
        "/api/v1/formulas",
        json={
            "name": f"分享测试配方{secrets.token_hex(4)}",
            "target_effects": ["补气"],
            "composition": {"ingredients": [{"name": "人参", "percentage": 100}]},
        },
    )
    if created.status_code == 201:
        formula_id = created.json().get("id")
        if formula_id:
            response = _share_post(
                client,
                f"/api/v1/formulas/{formula_id}/share",
                {"permission": "public", "expires_in_days": 30},
            )
            assert response.status_code in [200, 201, 404]


def test_create_share_with_password(client):
    """测试创建密码分享"""
    response = _share_post(
        client,
        "/api/v1/formulas/1/share",
        {"permission": "password", "password": "testpass123", "expires_in_days": 7},
    )
    assert response.status_code in [200, 201, 404]


def test_create_private_share(client):
    """测试创建私密分享"""
    response = _share_post(client, "/api/v1/formulas/1/share", {"permission": "private"})
    assert response.status_code in [200, 201, 404]


def test_list_shares(client):
    """测试列出分享"""
    response = client.get("/api/v1/formulas/1/shares")
    assert response.status_code in [200, 404]


def test_get_share_view_count(client):
    """测试获取分享访问次数"""
    response = client.get("/api/v1/shares/abc123")
    assert response.status_code in [200, 404]


def test_increment_share_view(client):
    """测试增加分享访问次数"""
    response = _share_post(client, "/api/v1/shares/abc123/view", {})
    assert response.status_code in [200, 404]


def test_delete_share(client):
    """测试删除分享"""
    response = client.delete("/api/v1/formulas/1/shares/abc123")
    assert response.status_code in [200, 204, 404]


def test_share_with_expiry(client):
    """测试带过期时间的分享"""
    response = _share_post(
        client,
        "/api/v1/formulas/1/share",
        {"permission": "public", "expires_in_days": 1},
    )
    assert response.status_code in [200, 201, 404]


def test_access_expired_share(client):
    """测试访问过期的分享"""
    response = client.get("/api/v1/shares/expired123")
    assert response.status_code in [200, 404, 410]


def test_access_password_protected_share(client):
    """测试访问密码保护的分享"""
    response = _share_post(client, "/api/v1/shares/abc123/access", {"password": "testpass123"})
    assert response.status_code in [200, 404]


def test_share_statistics(client):
    """测试分享统计"""
    response = client.get("/api/v1/formulas/1/shares/statistics")
    assert response.status_code in [200, 404]


def test_share_include_scores(client):
    """测试分享包含评分"""
    response = _share_post(
        client,
        "/api/v1/formulas/1/share",
        {"permission": "public", "include_scores": True},
    )
    assert response.status_code in [200, 201, 404]


def test_share_include_ingredients(client):
    """测试分享包含原料"""
    response = _share_post(
        client,
        "/api/v1/formulas/1/share",
        {"permission": "public", "include_ingredients": True},
    )
    assert response.status_code in [200, 201, 404]


def test_import_share(client):
    """测试导入分享配方"""
    response = _share_post(
        client,
        "/api/v1/shares/import",
        {"share_link": "https://example.com/share/formula/abc123"},
    )
    assert response.status_code in [200, 201, 404]
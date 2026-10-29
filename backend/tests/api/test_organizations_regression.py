"""organizations 创建/详情端点回归测试。

背景：backend-coverage-boost 报告 POST /api/v1/organizations 返回非 201/400/403，
GET /api/v1/organizations/999999 可能抛未处理异常。经排查，端点本身在正常请求下
返回 200/404/400/422，但缺少通用异常兜底（潜在 500）且创建端点未声明 status_code=201。
已加固：
- create_organization 设置 status_code=201，并增加通用 except Exception → 500 JSON。
- get_organization 增加通用 except Exception → 500 JSON（避免未处理异常逃逸）。

本测试验证创建（201）、重复 slug（400）、详情（200）、不存在（404）四条路径。
"""
import asyncio
import secrets

from fastapi.testclient import TestClient

from app.main import app
from app.api.deps import get_db_session
from app.models import User
from app.utils.auth import create_access_token
from tests.conftest_clean_users import track_test_user, make_test_user_id

client = TestClient(app, raise_server_exceptions=False)
from app.api import register_lazy_routers  # noqa: E402
register_lazy_routers()


def _sync_csrf():
    """清空 cookie jar 并设置一对全新的 csrf cookie + header，避免多 cookie 冲突。"""
    token = secrets.token_hex(32)
    client.cookies.clear()
    client.cookies.set("csrf_token", token)
    client.headers["X-CSRF-Token"] = token


def _create_user_headers():
    """创建 90M~99M 隔离区测试用户并返回 Bearer headers。"""

    async def _create() -> int:
        async for db in get_db_session():
            uid = make_test_user_id()
            from sqlalchemy import delete as sa_delete
            await db.execute(sa_delete(User).where(
                (User.id == uid)
                | (User.username == f"orgreg{uid}")
                | (User.email == f"orgreg{uid}@example.com")
            ))
            await db.commit()
            user = User(
                id=uid,
                email=f"orgreg{uid}@example.com",
                username=f"orgreg{uid}",
                hashed_password="x",
                is_active=True,
                role="admin",
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            track_test_user(user.id)
            return uid

    uid = asyncio.run(_create())
    return {"Authorization": f"Bearer {create_access_token(data={'sub': str(uid)})}"}


def _cleanup_org(org_id: int):
    """删除测试组织及其成员关系，避免污染生产 organizations 表。"""

    async def _do():
        from sqlalchemy import text
        async for db in get_db_session():
            await db.execute(
                text("DELETE FROM organization_members WHERE organization_id = :org_id"),
                {"org_id": org_id},
            )
            await db.execute(
                text("DELETE FROM organizations WHERE id = :org_id"),
                {"org_id": org_id},
            )
            await db.commit()

    asyncio.run(_do())


class TestOrganizationEndpoints:
    """组织创建/详情端点回归"""

    def test_create_organization_returns_201(self):
        headers = _create_user_headers()
        _sync_csrf()
        name = f"回归测试组织{secrets.token_hex(4)}"
        r = client.post("/api/v1/organizations", json={"name": name, "slug": f"reg-{secrets.token_hex(6)}"}, headers=headers)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["success"] is True
        assert data["organization"]["name"] == name
        _cleanup_org(data["organization"]["id"])

    def test_create_duplicate_slug_returns_400(self):
        headers = _create_user_headers()
        _sync_csrf()
        slug = f"dup-{secrets.token_hex(6)}"
        r1 = client.post("/api/v1/organizations", json={"name": "组织A", "slug": slug}, headers=headers)
        assert r1.status_code == 201, r1.text
        r2 = client.post("/api/v1/organizations", json={"name": "组织B", "slug": slug}, headers=headers)
        assert r2.status_code == 400, r2.text
        _cleanup_org(r1.json()["organization"]["id"])

    def test_get_organization_detail(self):
        headers = _create_user_headers()
        _sync_csrf()
        created = client.post(
            "/api/v1/organizations",
            json={"name": f"详情组织{secrets.token_hex(4)}", "slug": f"detail-{secrets.token_hex(6)}"},
            headers=headers,
        ).json()
        org_id = created["organization"]["id"]
        _sync_csrf()
        r = client.get(f"/api/v1/organizations/{org_id}", headers=headers)
        assert r.status_code == 200, r.text
        assert r.json()["organization"]["id"] == org_id
        _cleanup_org(org_id)

    def test_get_organization_not_found(self):
        headers = _create_user_headers()
        _sync_csrf()
        r = client.get("/api/v1/organizations/999999", headers=headers)
        assert r.status_code == 404, r.text
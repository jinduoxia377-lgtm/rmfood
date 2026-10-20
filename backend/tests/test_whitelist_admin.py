"""账号申请管理 API 测试（管理员端，异步）。

覆盖: 列表/通过/拒绝/批量通过/批量拒绝/重发验证码/重新激活/导出 CSV。
"""
import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.models.pre_register import PreRegisterRequest, PreRegisterStatus
from app.models.user_model import User

TEST_EMAILS = [
    "admin_test@example.com",
    "admin_batch1@example.com",
    "admin_batch2@example.com",
]


@pytest.fixture
def admin_client() -> TestClient:
    """构建以 admin 身份访问的 TestClient。"""
    from app.main import create_app
    from app.api.deps import get_current_user, get_current_active_user
    from unittest.mock import MagicMock

    app = create_app()

    async def mock_admin():
        user = MagicMock(spec=User)
        user.id = 999
        user.username = "admin_test_user"
        user.email = "admin@example.com"
        user.role = "admin"
        user.is_active = True
        return user

    async def mock_active():
        return await mock_admin()

    app.dependency_overrides[get_current_user] = mock_admin
    app.dependency_overrides[get_current_active_user] = mock_active
    return TestClient(app)


@pytest.fixture(autouse=True)
async def _clean(db_session):
    yield
    await db_session.execute(delete(PreRegisterRequest).where(PreRegisterRequest.email.in_(TEST_EMAILS)))
    await db_session.execute(delete(User).where(User.email.in_(TEST_EMAILS)))
    await db_session.commit()


async def _seed_pending(db_session, email: str, status: str = PreRegisterStatus.PENDING) -> int:
    now = datetime.now(timezone.utc)
    req = PreRegisterRequest(
        email=email,
        full_name="测试",
        department="测试部",
        source="whitelist_page",
        status=status,
        review_deadline=now + timedelta(days=7),
    )
    db_session.add(req)
    await db_session.commit()
    return req.id


async def _get_req(db_session, rid):
    return (
        await db_session.execute(select(PreRegisterRequest).where(PreRegisterRequest.id == rid))
    ).scalar_one_or_none()


async def test_admin_list(admin_client, db_session):
    await _seed_pending(db_session, TEST_EMAILS[0])
    resp = admin_client.get("/api/v1/admin/pre-register-requests", params={"status": "pending"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    emails = [i["email"] for i in body["items"]]
    assert TEST_EMAILS[0] in emails
    assert "status_counts" in body


async def test_admin_approve(admin_client, db_session):
    rid = await _seed_pending(db_session, TEST_EMAILS[0])
    resp = admin_client.post(f"/api/v1/admin/pre-register-requests/{rid}/approve", json={"role": "researcher"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["user_id"]
    assert body["username"]
    assert body["temp_password"]  # 系统生成临时密码


async def test_admin_reject(admin_client, db_session):
    rid = await _seed_pending(db_session, TEST_EMAILS[0])
    resp = admin_client.post(f"/api/v1/admin/pre-register-requests/{rid}/reject", json={"reason": "不通过"})
    assert resp.status_code == 200

    row = await _get_req(db_session, rid)
    assert row is not None
    assert row.status == PreRegisterStatus.REJECTED
    assert row.cooldown_until is not None


async def test_admin_batch_approve(admin_client, db_session):
    rid1 = await _seed_pending(db_session, TEST_EMAILS[1])
    rid2 = await _seed_pending(db_session, TEST_EMAILS[2])
    resp = admin_client.post("/api/v1/admin/pre-register-requests/batch-approve", json={"ids": [rid1, rid2], "role": "researcher"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success_count"] == 2
    assert all(r["ok"] for r in body["results"])


async def test_admin_batch_reject(admin_client, db_session):
    rid1 = await _seed_pending(db_session, TEST_EMAILS[1])
    rid2 = await _seed_pending(db_session, TEST_EMAILS[2])
    resp = admin_client.post("/api/v1/admin/pre-register-requests/batch-reject", json={"ids": [rid1, rid2], "reason": "批量拒绝"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success_count"] == 2


async def test_admin_reactivate(admin_client, db_session):
    rid = await _seed_pending(db_session, TEST_EMAILS[0], status=PreRegisterStatus.EXPIRED)
    resp = admin_client.post(f"/api/v1/admin/pre-register-requests/{rid}/reactivate")
    assert resp.status_code == 200
    row = await _get_req(db_session, rid)
    assert row.status == PreRegisterStatus.PENDING
    assert row.expired_at is None


async def test_admin_resend_code(admin_client, db_session):
    rid = await _seed_pending(db_session, TEST_EMAILS[0])
    resp = admin_client.post(f"/api/v1/admin/pre-register-requests/{rid}/resend-code")
    # 开发环境无 SMTP 时落盘日志/文件，接口应返回 200
    assert resp.status_code == 200
    body = resp.json()
    assert body["request_id"] == rid
    assert body["email"] == TEST_EMAILS[0]


async def test_admin_undo_reject(admin_client, db_session):
    rid = await _seed_pending(db_session, TEST_EMAILS[0])
    # 先拒绝
    resp = admin_client.post(f"/api/v1/admin/pre-register-requests/{rid}/reject", json={"reason": "误点"})
    assert resp.status_code == 200
    row = await _get_req(db_session, rid)
    assert row.status == PreRegisterStatus.REJECTED

    # 撤销拒绝
    resp2 = admin_client.post(f"/api/v1/admin/pre-register-requests/{rid}/undo-reject")
    assert resp2.status_code == 200
    # 结束当前事务快照并清空身份映射，读取最新状态
    await db_session.commit()
    db_session.expire_all()
    row2 = await _get_req(db_session, rid)
    assert row2.status == PreRegisterStatus.PENDING
    assert row2.reject_reason is None
    assert row2.cooldown_until is None
    assert row2.review_deadline is not None


async def test_admin_export(admin_client, db_session):
    await _seed_pending(db_session, TEST_EMAILS[0])
    resp = admin_client.get("/api/v1/admin/pre-register-requests/export")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers.get("content-type", "")
    assert TEST_EMAILS[0] in resp.text
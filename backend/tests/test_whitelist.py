"""白名单申请流程 API 测试。

覆盖:
- 申请提交（201，返回 request_id / status_token / email_verified=false）
- 重复申请幂等（409 ALREADY_APPLIED）
- 已注册邮箱（409 EMAIL_REGISTERED）
- 邮箱验证码校验（正确 200 / 错误 400）
- 状态查询（token 有效 200 / 无效 404）
- 旧 /auth/pre-register 兼容别名（201，不强制验证码）
"""
import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy import delete, select, update

from app.models.pre_register import PreRegisterRequest, PreRegisterStatus
from app.services.whitelist import hash_secret
from app.services import whitelist as whitelist_service

TEST_EMAILS = [
    "whitelist_test@example.com",
    "whitelist_dup@example.com",
    "whitelist_registered@example.com",
    "whitelist_legacy@example.com",
]


async def _valid_captcha():
    """创建一个合法人机验证码，返回 (captcha_id, answer)。"""
    captcha_id, code = await whitelist_service.create_captcha()
    return captcha_id, code


@pytest.fixture(autouse=True)
async def _clean_whitelist_data(db_session):
    # 测试共用 127.0.0.1，先清空 IP 限流桶避免相互影响
    from app.services.whitelist import reset_rate_limits
    reset_rate_limits()
    yield
    from app.models.user_model import User
    await db_session.execute(
        delete(PreRegisterRequest).where(PreRegisterRequest.email.in_(TEST_EMAILS))
    )
    await db_session.execute(
        delete(User).where(User.email == TEST_EMAILS[2])
    )
    await db_session.commit()


async def test_apply_success(async_client, db_session):
    captcha_id, captcha_answer = await _valid_captcha()
    resp = await async_client.post("/api/v1/auth/whitelist/apply", json={
        "email": TEST_EMAILS[0],
        "full_name": "测试用户",
        "organization": "测试单位",
        "reason": "上线首批体验",
        "source": "whitelist_page",
        "lang": "zh-CN",
        "captcha_id": captcha_id,
        "captcha_answer": captcha_answer,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["request_id"] > 0
    assert data["status_token"]
    assert data["email_verified"] is False
    assert data["server_time"]
    assert "dev_verify_code" in data  # 开发环境返回明文验证码，生产为 null

    # 申请记录应落库且验证码哈希存在（邮件已触发）
    from app.models.pre_register import PreRegisterStatus
    row = (
        await db_session.execute(
            select(PreRegisterRequest).where(PreRegisterRequest.id == data["request_id"])
        )
    ).scalar_one_or_none()
    assert row is not None
    assert row.status == PreRegisterStatus.PENDING
    assert row.status_token_hash == hash_secret(data["status_token"])
    assert row.verify_code_hash is not None
    assert row.source == "whitelist_page"


async def test_apply_duplicate_pending(async_client, db_session):
    cid1, ans1 = await _valid_captcha()
    r1 = await async_client.post("/api/v1/auth/whitelist/apply", json={"email": TEST_EMAILS[1], "captcha_id": cid1, "captcha_answer": ans1})
    assert r1.status_code == 201

    cid2, ans2 = await _valid_captcha()
    r2 = await async_client.post("/api/v1/auth/whitelist/apply", json={"email": TEST_EMAILS[1], "captcha_id": cid2, "captcha_answer": ans2})
    assert r2.status_code == 409
    assert r2.json()["detail"]["code"] == "ALREADY_APPLIED"


async def test_apply_registered_email(async_client, db_session):
    from app.models.user_model import User
    user = User(
        username="whitelist_registered",
        email=TEST_EMAILS[2],
        hashed_password="x",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    cid, ans = await _valid_captcha()
    resp = await async_client.post("/api/v1/auth/whitelist/apply", json={"email": TEST_EMAILS[2], "captcha_id": cid, "captcha_answer": ans})
    assert resp.status_code == 409
    assert resp.json()["detail"]["code"] == "EMAIL_REGISTERED"


async def test_apply_invalid_captcha(async_client, db_session):
    """人机验证码错误 → 400 INVALID_CAPTCHA。"""
    resp = await async_client.post("/api/v1/auth/whitelist/apply", json={
        "email": TEST_EMAILS[0],
        "captcha_id": "nonexistent-captcha-id",
        "captcha_answer": "XXXX",
    })
    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "INVALID_CAPTCHA"


async def test_captcha_endpoint(async_client):
    """GET /auth/whitelist/captcha 返回图片与 captcha_id。"""
    resp = await async_client.get("/api/v1/auth/whitelist/captcha")
    assert resp.status_code == 200
    body = resp.json()
    assert body["captcha_id"]
    assert body["image_base64"].startswith("data:image/png;base64,")


async def test_verify_code_success_and_wrong(async_client, db_session):
    cid, ans = await _valid_captcha()
    resp = await async_client.post("/api/v1/auth/whitelist/apply", json={"email": TEST_EMAILS[0], "captcha_id": cid, "captcha_answer": ans})
    request_id = resp.json()["request_id"]

    # 直接落库已知验证码哈希（模拟邮件中的验证码内容）
    from app.models.pre_register import PreRegisterRequest as PR
    await db_session.execute(
        update(PR)
        .where(PR.id == request_id)
        .values(
            verify_code_hash=hash_secret("123456"),
            verify_code_expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
            verify_code_sent_at=datetime.now(timezone.utc),
        )
    )
    await db_session.commit()

    # 错误验证码 → 400 INVALID_CODE
    bad = await async_client.post(
        "/api/v1/auth/whitelist/verify-code",
        json={"request_id": request_id, "code": "000000"},
    )
    assert bad.status_code == 400
    assert bad.json()["detail"]["code"] == "INVALID_CODE"

    # 正确验证码 → 200，进入审核队列
    ok = await async_client.post(
        "/api/v1/auth/whitelist/verify-code",
        json={"request_id": request_id, "code": "123456"},
    )
    assert ok.status_code == 200
    body = ok.json()
    assert body["status"] == "pending"
    assert body["review_deadline"]


async def test_status_query(async_client, db_session):
    cid, ans = await _valid_captcha()
    resp = await async_client.post("/api/v1/auth/whitelist/apply", json={"email": TEST_EMAILS[0], "captcha_id": cid, "captcha_answer": ans})
    token = resp.json()["status_token"]

    ok = await async_client.get("/api/v1/auth/whitelist/status", params={"token": token})
    assert ok.status_code == 200
    body = ok.json()
    assert body["status"] == "pending"
    assert body["request_id"] == resp.json()["request_id"]

    bad = await async_client.get("/api/v1/auth/whitelist/status", params={"token": "invalid-token"})
    assert bad.status_code == 404


async def test_pre_register_alias(async_client, db_session):
    """旧 /auth/pre-register 兼容别名：不强制验证码，直接入审核队列。"""
    resp = await async_client.post(
        "/api/v1/auth/pre-register",
        json={"email": TEST_EMAILS[3], "full_name": "旧通道用户"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["duplicate"] is False
    assert data["request_id"] is not None

    from sqlalchemy import select
    from app.models.pre_register import PreRegisterStatus
    row = (
        await db_session.execute(
            select(PreRegisterRequest).where(PreRegisterRequest.id == data["request_id"])
        )
    ).scalar_one_or_none()
    assert row is not None
    assert row.status == PreRegisterStatus.PENDING
    assert row.source == "legacy"
    assert row.verify_code_hash is None  # 旧通道不强制验证码


async def test_full_flow_verify_then_status_and_expire(async_client, db_session):
    """全链路：申请 → 邮箱验证 → 状态查询(pending) → 过期扫描 → 状态(expired)。"""
    cid, ans = await _valid_captcha()
    resp = await async_client.post("/api/v1/auth/whitelist/apply", json={"email": TEST_EMAILS[0], "captcha_id": cid, "captcha_answer": ans})
    assert resp.status_code == 201
    request_id = resp.json()["request_id"]
    token = resp.json()["status_token"]

    # 落库已知验证码
    await db_session.execute(
        update(PreRegisterRequest)
        .where(PreRegisterRequest.id == request_id)
        .values(
            verify_code_hash=hash_secret("123456"),
            verify_code_expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        )
    )
    await db_session.commit()

    ok = await async_client.post(
        "/api/v1/auth/whitelist/verify-code",
        json={"request_id": request_id, "code": "123456"},
    )
    assert ok.status_code == 200
    assert ok.json()["review_deadline"] is not None

    st = await async_client.get("/api/v1/auth/whitelist/status", params={"token": token})
    assert st.status_code == 200
    body = st.json()
    assert body["status"] == "pending"
    assert body["cooldown_until"] is None

    # 将审核截止时间改为过去，触发过期扫描
    await db_session.execute(
        update(PreRegisterRequest)
        .where(PreRegisterRequest.id == request_id)
        .values(review_deadline=datetime.now(timezone.utc) - timedelta(minutes=1))
    )
    await db_session.commit()

    from app.services.whitelist import expire_overdue_applications
    expired_count = await expire_overdue_applications(db_session)
    assert expired_count >= 1

    st2 = await async_client.get("/api/v1/auth/whitelist/status", params={"token": token})
    assert st2.status_code == 200
    assert st2.json()["status"] == "expired"


async def test_apply_cooldown_after_rejection(async_client, db_session):
    """拒绝后 7 天冷却：同一邮箱再次申请返回 429 COOLDOWN。"""
    cid, ans = await _valid_captcha()
    resp = await async_client.post("/api/v1/auth/whitelist/apply", json={"email": TEST_EMAILS[1], "captcha_id": cid, "captcha_answer": ans})
    assert resp.status_code == 201
    request_id = resp.json()["request_id"]

    # 模拟管理员拒绝并设置冷却
    await db_session.execute(
        update(PreRegisterRequest)
        .where(PreRegisterRequest.id == request_id)
        .values(
            status=PreRegisterStatus.REJECTED,
            cooldown_until=datetime.now(timezone.utc) + timedelta(days=7),
        )
    )
    await db_session.commit()

    cid2, ans2 = await _valid_captcha()
    r2 = await async_client.post("/api/v1/auth/whitelist/apply", json={"email": TEST_EMAILS[1], "captcha_id": cid2, "captcha_answer": ans2})
    assert r2.status_code == 429
    assert r2.json()["detail"]["code"] == "COOLDOWN"
    assert r2.json()["detail"]["retry_after"] > 0
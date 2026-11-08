"""material_field_review 字段级审校审计 — 工作流 + 防越权真验证（非破坏）。

覆盖：
- POST /food-materials/{id}/review 写审计 provenance（值同时落主表）
- reviewed_by 由服务端从 current_user 取，客户端伪造 → 422（schema extra=forbid）
- 重复审校 upsert 覆盖为最新 provenance（UNIQUE(material_id, field_name)）
- GET /food-materials/{id}/review 返回 provenance 历史
- field_name 不在白名单 → 400
- 匿名 401 / 只读角色 403

非破坏：临时原料用 id=-999998（负 id 不与生产自增冲突），autouse fixture 前后清理。
绝不伪造：审计内容仅由测试内显式提交的专家动作产生，不预填任何编造数据。
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.models.food_material import FoodMaterial
from app.models.material_field_review import MaterialFieldReview
from app.models.user_model import User

TEMP_ID = -999998
REVIEW_URL = f"/api/v1/databases/food-materials/{TEMP_ID}/review"
# 真实落库的测试用户（负 id 不与生产自增冲突），满足 reviewed_by 的 FK 约束
TEST_USER_ID = -888


def _make_user(role: str):
    from unittest.mock import MagicMock
    u = MagicMock(spec=User)
    u.id = TEST_USER_ID
    u.username = f"reviewer_{role}"
    u.email = f"reviewer_{role}@example.com"
    u.role = role
    u.is_active = True
    return u


def _override_with(role):
    """返回一个 get_current_user 依赖覆盖函数（返回指定角色的测试用户，或 None）。"""
    user = _make_user(role) if role is not None else None

    async def override():
        return user

    return override


@pytest.fixture
def client() -> TestClient:
    """TestClient，默认 admin 身份；用例内可用 _set_current_user 改写。"""
    from app.api.deps import get_current_user
    from app.main import create_app

    app = create_app()
    app.dependency_overrides[get_current_user] = _override_with("admin")
    return TestClient(app)


@pytest.fixture
def anon_client() -> TestClient:
    """匿名（未认证）TestClient：get_current_user 返回 None。"""
    from app.api.deps import get_current_user
    from app.main import create_app

    app = create_app()
    app.dependency_overrides[get_current_user] = _override_with(None)
    return TestClient(app)


def _set_current_user(client: TestClient, role) -> None:
    from app.api.deps import get_current_user
    client.app.dependency_overrides[get_current_user] = _override_with(role)


async def _cleanup(db_session) -> None:
    await db_session.execute(delete(MaterialFieldReview).where(MaterialFieldReview.material_id == TEMP_ID))
    await db_session.execute(delete(FoodMaterial).where(FoodMaterial.id == TEMP_ID))
    await db_session.execute(delete(User).where(User.id == TEST_USER_ID))
    await db_session.commit()


@pytest.fixture(autouse=True)
async def _ensure_clean(db_session):
    await _cleanup(db_session)
    yield
    await _cleanup(db_session)


async def _seed_material(db_session) -> None:
    # 先建真实测试用户（满足 reviewed_by FK），再建临时原料
    db_session.add(User(
        id=TEST_USER_ID,
        username="reviewer_admin",
        email="reviewer_admin@example.com",
        hashed_password="x",  # 不参与认证，仅满足 NOT NULL
        role="admin",
        is_active=True,
    ))
    db_session.add(FoodMaterial(
        id=TEMP_ID,
        name_cn="__临时审校审计行__",
        source_db="test",
        review_status="approved",
        interactions=[],
        contraindications=[],
    ))
    await db_session.commit()


async def test_post_review_writes_audit_and_main_table(client, db_session):
    """审校动作：主表字段值更新 + 审计表写入 provenance（reviewed_by=服务端取）。"""
    await _seed_material(db_session)

    resp = client.post(REVIEW_URL, json={
        "field_name": "interactions",
        "value": ["与十八反类药物不宜同用"],
        "source": "《中华本草》",
        "review_note": "依据十八反核对",
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["field_name"] == "interactions"
    assert body["source"] == "《中华本草》"
    assert body["reviewed_by"] == TEST_USER_ID  # 服务端从 mock admin 取，非客户端传
    assert body["reviewed_at"] is not None

    # 主表值已更新
    db_session.expire_all()
    mat = (await db_session.execute(
        select(FoodMaterial).where(FoodMaterial.id == TEMP_ID)
    )).scalar_one()
    assert list(mat.interactions) == ["与十八反类药物不宜同用"]

    # 审计表已有 1 条 provenance
    reviews = (await db_session.execute(
        select(MaterialFieldReview).where(MaterialFieldReview.material_id == TEMP_ID)
    )).scalars().all()
    assert len(reviews) == 1
    assert reviews[0].field_name == "interactions"
    assert reviews[0].reviewed_by == TEST_USER_ID


async def test_post_review_upsert_overwrites(client, db_session):
    """重复审校同一字段 → upsert 覆盖，不新增行（UNIQUE 约束）。"""
    await _seed_material(db_session)
    payload = {"field_name": "contraindications", "value": ["孕妇慎用"], "source": "药典"}

    assert client.post(REVIEW_URL, json=payload).status_code == 200
    payload2 = {"field_name": "contraindications", "value": ["孕妇慎用", "脾胃虚寒者减量"], "source": "专家经验"}
    assert client.post(REVIEW_URL, json=payload2).status_code == 200

    reviews = (await db_session.execute(
        select(MaterialFieldReview).where(MaterialFieldReview.material_id == TEMP_ID)
    )).scalars().all()
    assert len(reviews) == 1  # 仍 1 条，被覆盖
    assert reviews[0].source == "专家经验"
    assert reviews[0].value == ["孕妇慎用", "脾胃虚寒者减量"]


async def test_reviewed_by_cannot_be_spoofed(client, db_session):
    """客户端伪造 reviewed_by → schema extra=forbid 422，绝不落库。"""
    await _seed_material(db_session)
    resp = client.post(REVIEW_URL, json={
        "field_name": "interactions",
        "value": ["x"],
        "reviewed_by": 1,        # 越权尝试
        "reviewed_at": "2000-01-01T00:00:00Z",  # 越权尝试
    })
    assert resp.status_code == 422, resp.text
    reviews = (await db_session.execute(
        select(MaterialFieldReview).where(MaterialFieldReview.material_id == TEMP_ID)
    )).scalars().all()
    assert len(reviews) == 0


async def test_field_name_whitelist(client, db_session):
    """field_name 不在白名单 → 400，不写主表也不写审计。"""
    await _seed_material(db_session)
    resp = client.post(REVIEW_URL, json={"field_name": "id", "value": 1})
    assert resp.status_code == 400, resp.text


async def test_get_provenance(client, db_session):
    """GET 返回该原料各字段审校历史。"""
    await _seed_material(db_session)
    client.post(REVIEW_URL, json={"field_name": "interactions", "value": ["a"], "source": "本草"})
    client.post(REVIEW_URL, json={"field_name": "contraindications", "value": ["b"], "source": "药典"})

    resp = client.get(REVIEW_URL)
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    fields = {i["field_name"] for i in items}
    assert {"interactions", "contraindications"}.issubset(fields)
    assert all("reviewed_by" in i and "reviewed_at" in i for i in items)


async def test_anonymous_rejected(anon_client, db_session):
    """匿名审校 → 401。"""
    await _seed_material(db_session)
    resp = anon_client.post(REVIEW_URL, json={"field_name": "interactions", "value": ["x"]})
    assert resp.status_code == 401, resp.text


async def test_readonly_role_forbidden(client, db_session):
    """只读角色（researcher）审校 → 403。"""
    await _seed_material(db_session)
    _set_current_user(client, "researcher")
    resp = client.post(REVIEW_URL, json={"field_name": "interactions", "value": ["x"]})
    assert resp.status_code == 403, resp.text

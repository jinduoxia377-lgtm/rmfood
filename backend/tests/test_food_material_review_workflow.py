"""food_materials 专家审校工作流 — PUT 端点字段级更新真验证（非破坏）。

背景：管理员/配方师通过 PUT /api/v1/databases/food-materials/{id} 录入并审校
安全关键字段 interactions / contraindications。本测试验证录入链路真实落库。

设计约束（严格遵循 Lead 派发的「不伪造 / 非破坏 / 可回滚」）：
- 不预填任何生产数据；只创建一条 id=-999999 的临时行（负 id 不可能与生产自增 id 冲突），
  测试结束在 finally 中删除，等价于事务回滚。
- 不触碰 review_status / reviewed_by / reviewed_at（schema 有意排除以防越权）。
- 断言 interactions / contraindications 能被 PUT 真实更新并回读一致。

依赖：真实 PostgreSQL（conftest_db.py 的 db_session fixture）+ TestClient（mock admin 鉴权）。
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.models.food_material import FoodMaterial
from app.models.user_model import User

# 负 id：绝对不与生产自增 id 冲突，保证临时行可安全清理
TEMP_ID = -999999


@pytest.fixture
def admin_client() -> TestClient:
    """以 admin 身份访问的 TestClient（mock 鉴权，不依赖真实登录）。"""
    from unittest.mock import MagicMock

    from app.api.deps import get_current_user
    from app.main import create_app

    app = create_app()

    async def mock_admin():
        user = MagicMock(spec=User)
        user.id = 999
        user.username = "fm_review_admin"
        user.email = "fm_review_admin@example.com"
        user.role = "admin"
        user.is_active = True
        return user

    app.dependency_overrides[get_current_user] = mock_admin
    return TestClient(app)


async def _cleanup(db_session) -> None:
    await db_session.execute(delete(FoodMaterial).where(FoodMaterial.id == TEMP_ID))
    await db_session.commit()


async def _get_material(db_session):
    return (
        await db_session.execute(
            select(FoodMaterial).where(FoodMaterial.id == TEMP_ID)
        )
    ).scalar_one_or_none()


@pytest.fixture(autouse=True)
async def _ensure_clean(db_session):
    """测试前后都清理临时行，保证幂等 + 不留残留。"""
    await _cleanup(db_session)
    yield
    await _cleanup(db_session)


async def _seed_empty_material(db_session) -> None:
    """创建一条安全字段为空的临时原料（不伪造任何专家数据）。"""
    mat = FoodMaterial(
        id=TEMP_ID,
        name_cn="__临时审校验证行__",
        source_db="test",
        review_status="approved",
        contraindications=[],
        interactions=[],
    )
    db_session.add(mat)
    await db_session.commit()


async def test_put_updates_safety_fields(admin_client, db_session):
    """核心验收：PUT 能真实更新 interactions / contraindications 并落库。"""
    await _seed_empty_material(db_session)

    expert_contra = ["孕妇慎用", "脾胃虚寒者减量"]
    expert_inter = ["与十八反类药物不宜同用"]

    resp = admin_client.put(
        f"/api/v1/databases/food-materials/{TEMP_ID}",
        json={
            "contraindications": expert_contra,
            "interactions": expert_inter,
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # to_dict() 把安全字段嵌套在 "safety" 下（food_material.py:121-125）
    safety = body.get("safety", {})
    assert safety.get("contraindications") == expert_contra
    assert safety.get("interactions") == expert_inter

    # 落库一致性：绕过 API 直接读库确认持久化
    db_session.expire_all()
    row = await _get_material(db_session)
    assert row is not None
    assert list(row.contraindications) == expert_contra
    assert list(row.interactions) == expert_inter


async def test_put_does_not_touch_review_audit_fields(admin_client, db_session):
    """防越权回归：即使请求体夹带 reviewed_by/reviewed_at/review_status，
    schema extra=forbid 应 422，审计字段绝不可通过 PUT 越权写入。"""
    await _seed_empty_material(db_session)

    resp = admin_client.put(
        f"/api/v1/databases/food-materials/{TEMP_ID}",
        json={
            "contraindications": ["x"],
            "reviewed_by": 1,          # 越权尝试
            "review_status": "approved",  # 越权尝试
        },
    )
    # FoodMaterialUpdate extra="forbid" → 未知字段直接 422
    assert resp.status_code == 422, resp.text


async def test_put_anonymous_rejected(admin_client, db_session):
    """匿名（未认证）PUT 应回 401。"""
    from app.api.deps import get_current_user

    await _seed_empty_material(db_session)

    # 覆盖为返回 None 模拟未认证
    app = admin_client.app
    async def mock_anon():
        return None
    app.dependency_overrides[get_current_user] = mock_anon
    try:
        resp = admin_client.put(
            f"/api/v1/databases/food-materials/{TEMP_ID}",
            json={"interactions": ["y"]},
        )
        assert resp.status_code == 401, resp.text
    finally:
        # 恢复 admin override，避免污染同会话其它用例
        from unittest.mock import MagicMock
        async def mock_admin():
            u = MagicMock(spec=User)
            u.id = 999
            u.role = "admin"
            u.is_active = True
            return u
        app.dependency_overrides[get_current_user] = mock_admin

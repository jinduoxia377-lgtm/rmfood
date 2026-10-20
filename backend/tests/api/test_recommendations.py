"""配方推荐测试"""
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
                | (User.username == f"rec{uid}")
                | (User.email == f"rec{uid}@example.com")
            ))
            await db.commit()
            user = User(
                id=uid,
                email=f"rec{uid}@example.com",
                username=f"rec{uid}",
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


def _recommend(client, payload: dict):
    return client.post("/api/v1/ai/recommend/formulas", json=payload)


def test_recommend_formulas_default(client):
    """测试默认配方推荐"""
    response = _recommend(client, {})
    assert response.status_code == 200
    data = response.json()
    assert "recommendations" in data or "items" in data


def test_recommend_formulas_with_limit(client):
    """测试限制推荐数量"""
    response = _recommend(client, {"limit": 5})
    assert response.status_code == 200
    data = response.json()
    items = data.get("recommendations", data.get("items", []))
    assert len(items) <= 5


def test_recommend_formulas_based_on_formula(client):
    """测试基于配方的推荐"""
    response = _recommend(client, {
        "based_on_formula_id": 1,
        "limit": 3,
    })
    assert response.status_code == 200
    data = response.json()
    assert "based_on" in data or "based_on_formula_id" in data


def test_recommend_formulas_with_effects(client):
    """测试基于功效的推荐"""
    response = _recommend(client, {
        "target_effects": ["补气", "养血"],
        "limit": 3,
    })
    assert response.status_code == 200
    data = response.json()
    items = data.get("recommendations", data.get("items", []))
    for item in items:
        assert any(
            effect in item.get("target_effects", [])
            for effect in ["补气", "养血"]
        ) or item.get("effects", [])


def test_recommend_formulas_with_user_id(client):
    """测试基于用户的推荐"""
    response = _recommend(client, {
        "user_id": 1,
        "limit": 3,
    })
    assert response.status_code == 200
    data = response.json()


def test_recommend_formulas_response_format(client):
    """测试推荐响应格式"""
    response = _recommend(client, {"limit": 3})
    assert response.status_code == 200
    data = response.json()

    items = data.get("recommendations", data.get("items", []))
    for item in items:
        assert "id" in item or "formula_id" in item
        assert "name" in item or "formula_name" in item


def test_recommend_formulas_algorithm_field(client):
    """测试算法字段"""
    response = _recommend(client, {"limit": 3})
    assert response.status_code == 200
    data = response.json()
    assert "algorithm" in data or "method" in data or "strategy" in data


def test_recommend_formulas_relevance_score(client):
    """测试相关性评分"""
    response = _recommend(client, {"limit": 3})
    assert response.status_code == 200
    data = response.json()

    items = data.get("recommendations", data.get("items", []))
    for item in items:
        assert "relevance_score" in item or "score" in item or "match_score" in item


def test_recommend_formulas_ingredient_count(client):
    """测试原料数量字段"""
    response = _recommend(client, {"limit": 3})
    assert response.status_code == 200
    data = response.json()

    items = data.get("recommendations", data.get("items", []))
    for item in items:
        assert "ingredient_count" in item or "ingredients" in item


def test_recommend_formulas_combined_params(client):
    """测试组合参数"""
    response = _recommend(client, {
        "user_id": 1,
        "based_on_formula_id": 1,
        "target_effects": ["补气"],
        "limit": 5,
    })
    assert response.status_code == 200
    data = response.json()
    assert "recommendations" in data or "items" in data or "total" in data
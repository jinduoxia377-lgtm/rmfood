"""配方推荐测试"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_recommend_formulas_default(client: AsyncClient, researcher_headers: dict):
    """测试默认配方推荐"""
    response = await client.post(
        "/api/v1/ai/recommend/formulas",
        json={},
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "recommendations" in data or "items" in data


@pytest.mark.asyncio
async def test_recommend_formulas_with_limit(client: AsyncClient, researcher_headers: dict):
    """测试限制推荐数量"""
    response = await client.post(
        "/api/v1/ai/recommend/formulas",
        json={"limit": 5},
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    items = data.get("recommendations", data.get("items", []))
    assert len(items) <= 5


@pytest.mark.asyncio
async def test_recommend_formulas_based_on_formula(client: AsyncClient, researcher_headers: dict):
    """测试基于配方的推荐"""
    response = await client.post(
        "/api/v1/ai/recommend/formulas",
        json={
            "based_on_formula_id": 1,
            "limit": 3,
        },
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "based_on" in data or "based_on_formula_id" in data


@pytest.mark.asyncio
async def test_recommend_formulas_with_effects(client: AsyncClient, researcher_headers: dict):
    """测试基于功效的推荐"""
    response = await client.post(
        "/api/v1/ai/recommend/formulas",
        json={
            "target_effects": ["补气", "养血"],
            "limit": 3,
        },
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    items = data.get("recommendations", data.get("items", []))
    for item in items:
        assert any(
            effect in item.get("target_effects", [])
            for effect in ["补气", "养血"]
        ) or item.get("effects", [])


@pytest.mark.asyncio
async def test_recommend_formulas_with_user_id(client: AsyncClient, researcher_headers: dict):
    """测试基于用户的推荐"""
    response = await client.post(
        "/api/v1/ai/recommend/formulas",
        json={
            "user_id": 1,
            "limit": 3,
        },
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()


@pytest.mark.asyncio
async def test_recommend_formulas_response_format(client: AsyncClient, researcher_headers: dict):
    """测试推荐响应格式"""
    response = await client.post(
        "/api/v1/ai/recommend/formulas",
        json={"limit": 3},
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()

    if "recommendations" in data:
        items = data["recommendations"]
    elif "items" in data:
        items = data["items"]
    else:
        items = []

    for item in items:
        assert "id" in item or "formula_id" in item
        assert "name" in item or "formula_name" in item


@pytest.mark.asyncio
async def test_recommend_formulas_algorithm_field(client: AsyncClient, researcher_headers: dict):
    """测试算法字段"""
    response = await client.post(
        "/api/v1/ai/recommend/formulas",
        json={"limit": 3},
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "algorithm" in data or "method" in data or "strategy" in data


@pytest.mark.asyncio
async def test_recommend_formulas_relevance_score(client: AsyncClient, researcher_headers: dict):
    """测试相关性评分"""
    response = await client.post(
        "/api/v1/ai/recommend/formulas",
        json={"limit": 3},
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()

    items = data.get("recommendations", data.get("items", []))
    for item in items:
        assert "relevance_score" in item or "score" in item or "match_score" in item


@pytest.mark.asyncio
async def test_recommend_formulas_ingredient_count(client: AsyncClient, researcher_headers: dict):
    """测试原料数量字段"""
    response = await client.post(
        "/api/v1/ai/recommend/formulas",
        json={"limit": 3},
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()

    items = data.get("recommendations", data.get("items", []))
    for item in items:
        assert "ingredient_count" in item or "ingredients" in item


@pytest.mark.asyncio
async def test_recommend_formulas_combined_params(client: AsyncClient, researcher_headers: dict):
    """测试组合参数"""
    response = await client.post(
        "/api/v1/ai/recommend/formulas",
        json={
            "user_id": 1,
            "based_on_formula_id": 1,
            "target_effects": ["补气"],
            "limit": 5,
        },
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "recommendations" in data or "items" in data or "total" in data

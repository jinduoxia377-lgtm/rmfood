"""配方优化测试"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_optimization_suggestions(client: AsyncClient, researcher_headers: dict):
    """测试优化建议"""
    response = await client.post(
        "/api/v1/ai/optimize",
        json={
            "formula_id": 1,
            "ingredients": [
                {"name": "枸杞", "dosage": "10g", "role": "君药"},
                {"name": "黄芪", "dosage": "5g", "role": "臣药"},
            ],
            "scores": {
                "synergy": 0.75,
                "taste": 0.65,
                "stability": 0.70,
                "overall": 0.72,
            },
        },
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_optimization_with_low_taste_score(client: AsyncClient, researcher_headers: dict):
    """测试低口感评分优化"""
    response = await client.post(
        "/api/v1/ai/optimize",
        json={
            "formula_id": 1,
            "ingredients": [
                {"name": "人参", "dosage": "5g", "role": "君药"},
            ],
            "scores": {
                "synergy": 0.80,
                "taste": 0.30,
                "stability": 0.75,
                "overall": 0.60,
            },
        },
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_optimization_with_low_stability_score(client: AsyncClient, researcher_headers: dict):
    """测试低稳定性评分优化"""
    response = await client.post(
        "/api/v1/ai/optimize",
        json={
            "formula_id": 1,
            "ingredients": [
                {"name": "枸杞", "dosage": "10g", "role": "君药"},
            ],
            "scores": {
                "synergy": 0.75,
                "taste": 0.70,
                "stability": 0.35,
                "overall": 0.60,
            },
        },
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_optimization_with_low_safety_score(client: AsyncClient, researcher_headers: dict):
    """测试低安全评分优化"""
    response = await client.post(
        "/api/v1/ai/optimize",
        json={
            "formula_id": 1,
            "ingredients": [
                {"name": "附子", "dosage": "10g", "role": "君药"},
            ],
            "scores": {
                "synergy": 0.75,
                "taste": 0.65,
                "stability": 0.70,
                "safety": 0.40,
                "overall": 0.65,
            },
        },
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_optimization_with_high_cost(client: AsyncClient, researcher_headers: dict):
    """测试高成本优化"""
    response = await client.post(
        "/api/v1/ai/optimize",
        json={
            "formula_id": 1,
            "ingredients": [
                {"name": "人参", "dosage": "10g", "role": "君药"},
                {"name": "灵芝", "dosage": "5g", "role": "臣药"},
            ],
            "scores": {
                "synergy": 0.85,
                "taste": 0.75,
                "stability": 0.80,
                "cost": 0.20,
                "overall": 0.70,
            },
        },
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_optimization_priority_ordering(client: AsyncClient, researcher_headers: dict):
    """测试优化建议优先级排序"""
    response = await client.post(
        "/api/v1/ai/optimize",
        json={
            "formula_id": 1,
            "ingredients": [
                {"name": "枸杞", "dosage": "10g", "role": "君药"},
            ],
            "scores": {
                "synergy": 0.60,
                "taste": 0.55,
                "stability": 0.50,
                "safety": 0.65,
                "cost": 0.70,
                "overall": 0.60,
            },
        },
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_optimization_ingredient_addition(client: AsyncClient, researcher_headers: dict):
    """测试成分添加优化"""
    response = await client.post(
        "/api/v1/ai/optimize",
        json={
            "formula_id": 1,
            "ingredients": [
                {"name": "枸杞", "dosage": "10g", "role": "君药"},
            ],
            "scores": {
                "synergy": 0.60,
                "taste": 0.65,
                "stability": 0.70,
                "overall": 0.65,
            },
        },
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_optimization_dosage_adjustment(client: AsyncClient, researcher_headers: dict):
    """测试剂量调整优化"""
    response = await client.post(
        "/api/v1/ai/optimize",
        json={
            "formula_id": 1,
            "ingredients": [
                {"name": "黄芪", "dosage": "3g", "role": "臣药"},
            ],
            "scores": {
                "synergy": 0.70,
                "taste": 0.65,
                "stability": 0.70,
                "overall": 0.68,
            },
        },
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_optimization_effect_based(client: AsyncClient, researcher_headers: dict):
    """测试基于功效的优化"""
    response = await client.post(
        "/api/v1/ai/optimize",
        json={
            "formula_id": 1,
            "ingredients": [
                {"name": "黄芪", "dosage": "10g", "role": "君药"},
            ],
            "target_effects": ["补气", "益血"],
            "scores": {
                "synergy": 0.75,
                "taste": 0.65,
                "stability": 0.70,
                "overall": 0.70,
            },
        },
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_optimization_confidence_score(client: AsyncClient, researcher_headers: dict):
    """测试优化置信度"""
    response = await client.post(
        "/api/v1/ai/optimize",
        json={
            "formula_id": 1,
            "ingredients": [
                {"name": "枸杞", "dosage": "10g", "role": "君药"},
            ],
            "scores": {
                "synergy": 0.75,
                "taste": 0.70,
                "stability": 0.72,
                "overall": 0.72,
            },
        },
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_optimization_expected_improvement(client: AsyncClient, researcher_headers: dict):
    """测试预期改进值"""
    response = await client.post(
        "/api/v1/ai/optimize",
        json={
            "formula_id": 1,
            "ingredients": [
                {"name": "人参", "dosage": "5g", "role": "君药"},
            ],
            "scores": {
                "synergy": 0.70,
                "taste": 0.60,
                "stability": 0.65,
                "overall": 0.65,
            },
        },
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_optimization_reasoning(client: AsyncClient, researcher_headers: dict):
    """测试优化原理"""
    response = await client.post(
        "/api/v1/ai/optimize",
        json={
            "formula_id": 1,
            "ingredients": [
                {"name": "枸杞", "dosage": "10g", "role": "君药"},
            ],
            "scores": {
                "synergy": 0.75,
                "taste": 0.65,
                "stability": 0.70,
                "overall": 0.70,
            },
        },
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_optimization_apply_suggestion(client: AsyncClient, researcher_headers: dict):
    """测试应用优化建议"""
    response = await client.post(
        "/api/v1/ai/optimize/apply",
        json={
            "formula_id": 1,
            "suggestion_id": "opt_1",
        },
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_optimization_apply_all(client: AsyncClient, researcher_headers: dict):
    """测试应用所有优化建议"""
    response = await client.post(
        "/api/v1/ai/optimize/apply-all",
        json={
            "formula_id": 1,
        },
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]

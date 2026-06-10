"""AI API 端点测试"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_generate_formula_rule_engine(client: AsyncClient, researcher_headers: dict):
    """测试规则引擎配方生成"""
    response = await client.post(
        "/api/v1/ai/generate",
        json={
            "target_effects": ["补气", "养血"],
            "constraints": {"max_candidates": 3},
            "use_llm": False,
        },
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "candidates" in data
    assert "total" in data
    assert "generator" in data
    assert data["generator"] == "rule_engine"


@pytest.mark.asyncio
async def test_generate_formula_llm_fallback(client: AsyncClient, researcher_headers: dict):
    """测试 LLM 配方生成（回退到规则引擎）"""
    response = await client.post(
        "/api/v1/ai/generate",
        json={
            "target_effects": ["补气"],
            "use_llm": True,
        },
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "candidates" in data


@pytest.mark.asyncio
async def test_safety_check(client: AsyncClient, researcher_headers: dict):
    """测试安全检查"""
    response = await client.post(
        "/api/v1/ai/safety-check",
        json={
            "ingredient_names": ["人参", "枸杞", "黄芪"],
            "peptide_sequences": None,
        },
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "passed" in data or "checks" in data


@pytest.mark.asyncio
async def test_synergy_analysis(client: AsyncClient, researcher_headers: dict):
    """测试协同分析"""
    response = await client.post(
        "/api/v1/ai/synergy-analysis",
        json={
            "herb_names": ["人参", "枸杞", "黄芪"],
            "peptide_sequences": None,
        },
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "score" in data or "synergy_pairs" in data


@pytest.mark.asyncio
async def test_chat(client: AsyncClient, researcher_headers: dict):
    """测试智能对话"""
    response = await client.post(
        "/api/v1/ai/chat",
        json={
            "question": "如何设计一个补气的配方？",
            "history": None,
            "stream": False,
        },
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data


@pytest.mark.asyncio
async def test_taste_predict(client: AsyncClient, researcher_headers: dict):
    """测试口感预测"""
    response = await client.post(
        "/api/v1/ai/taste-predict",
        json={
            "ingredients": [
                {"name": "枸杞", "type": "herb"},
                {"name": "人参", "type": "herb"},
            ],
        },
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "sweetness" in data or "bitterness" in data or "score" in data


@pytest.mark.asyncio
async def test_stability_predict(client: AsyncClient, researcher_headers: dict):
    """测试稳定性预测"""
    response = await client.post(
        "/api/v1/ai/stability",
        json={
            "ingredients": [
                {"name": "枸杞", "type": "herb"},
            ],
            "storage_temp": 25.0,
        },
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "score" in data or "stability" in data or "shelf_life" in data


@pytest.mark.asyncio
async def test_peptide_score(client: AsyncClient, researcher_headers: dict):
    """测试活性肽评分"""
    response = await client.post(
        "/api/v1/ai/peptide-score",
        json={
            "sequences": ["LVFFA", "AAVFL"],
            "target_activity": "ACE_inhibitory",
        },
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "scores" in data or "score" in data


@pytest.mark.asyncio
async def test_model_status(client: AsyncClient, researcher_headers: dict):
    """测试模型状态"""
    response = await client.get(
        "/api/v1/ai/models/status",
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "llm" in data
    assert "formula_gpt" in data
    assert "synergy_net" in data
    assert "safety_checker" in data


@pytest.mark.asyncio
async def test_update_llm_config(client: AsyncClient, admin_headers: dict):
    """测试更新 LLM 配置"""
    response = await client.post(
        "/api/v1/ai/models/config",
        json={
            "provider": "deepseek",
            "api_key": "test_key_123",
            "base_url": "https://api.deepseek.com",
            "model": "deepseek-chat",
            "max_tokens": 4096,
            "temperature": 0.7,
        },
        headers=admin_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_analyze_formula(client: AsyncClient, researcher_headers: dict):
    """测试配方智能分析"""
    response = await client.post(
        "/api/v1/ai/analyze/formula",
        json={
            "formula_id": 1,
            "ingredients": [
                {"name": "枸杞", "type": "herb"},
                {"name": "黄芪", "type": "herb"},
            ],
            "target_effects": ["补气", "养血"],
        },
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "ingredient_analysis" in data or "effect_prediction" in data


@pytest.mark.asyncio
async def test_recommend_formulas(client: AsyncClient, researcher_headers: dict):
    """测试配方推荐"""
    response = await client.post(
        "/api/v1/ai/recommend/formulas",
        json={
            "user_id": 1,
            "based_on_formula_id": 1,
            "target_effects": ["补气"],
            "limit": 3,
        },
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "recommendations" in data or "items" in data


@pytest.mark.asyncio
async def test_predict_trends(client: AsyncClient, researcher_headers: dict):
    """测试趋势预测"""
    response = await client.post(
        "/api/v1/ai/predict/trends",
        json={
            "timeframe": "30d",
            "metrics": ["formulas", "experiments", "success_rate"],
        },
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "formulas" in data or "predictions" in data


@pytest.mark.asyncio
async def test_analyze_experiment(client: AsyncClient, researcher_headers: dict):
    """测试实验分析"""
    response = await client.post(
        "/api/v1/ai/analyze/experiment",
        json={
            "experiment_id": 1,
            "experiment_data": {
                "effectiveness": 85,
                "stability": 90,
                "taste_score": 75,
            },
        },
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "result_summary" in data or "analysis" in data


@pytest.mark.asyncio
async def test_neural_generate(client: AsyncClient, researcher_headers: dict):
    """测试神经网络配方生成"""
    response = await client.post(
        "/api/v1/ai/generate/neural",
        json={
            "target_effects": ["补气", "养血"],
            "priority_values": {"补气": 0.8, "养血": 0.6},
            "constraints": {"max_candidates": 3},
            "max_candidates": 3,
        },
        headers=researcher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "candidates" in data
    assert "total" in data
    assert "generator" in data


@pytest.mark.asyncio
async def test_generate_formula_invalid_effects(client: AsyncClient, researcher_headers: dict):
    """测试无效功效参数"""
    response = await client.post(
        "/api/v1/ai/generate",
        json={
            "target_effects": [],
            "use_llm": False,
        },
        headers=researcher_headers,
    )
    assert response.status_code == 422 or response.status_code == 400


@pytest.mark.asyncio
async def test_safety_check_empty_ingredients(client: AsyncClient, researcher_headers: dict):
    """测试空成分安全检查"""
    response = await client.post(
        "/api/v1/ai/safety-check",
        json={
            "ingredient_names": [],
        },
        headers=researcher_headers,
    )
    assert response.status_code == 422 or response.status_code == 400


@pytest.mark.asyncio
async def test_chat_empty_question(client: AsyncClient, researcher_headers: dict):
    """测试空问题"""
    response = await client.post(
        "/api/v1/ai/chat",
        json={
            "question": "",
            "stream": False,
        },
        headers=researcher_headers,
    )
    assert response.status_code == 422 or response.status_code == 400

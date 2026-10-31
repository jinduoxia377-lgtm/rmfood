"""AI API 端点测试"""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def test_client():
    """同步测试客户端"""
    from app.main import create_app
    from app.api.deps import get_current_user, get_current_active_user
    from unittest.mock import MagicMock
    from app.models import User

    app = create_app()

    async def _mock_user():
        u = MagicMock(spec=User)
        u.id = 1
        u.username = "test_researcher"
        u.role = "researcher"
        u.is_active = True
        return u

    app.dependency_overrides[get_current_user] = _mock_user
    app.dependency_overrides[get_current_active_user] = _mock_user

    with TestClient(app) as client:
        yield client


@pytest.fixture
async def async_test_client():
    """异步测试客户端（带 CSRF 处理）"""
    from app.main import create_app
    from app.api.deps import get_current_user, get_current_active_user
    from unittest.mock import MagicMock
    from app.models import User
    from httpx import ASGITransport, AsyncClient

    app = create_app()

    async def _mock_user():
        u = MagicMock(spec=User)
        u.id = 1
        u.username = "test_researcher"
        u.role = "researcher"
        u.is_active = True
        return u

    app.dependency_overrides[get_current_user] = _mock_user
    app.dependency_overrides[get_current_active_user] = _mock_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 设置 CSRF token（手动设置以绕过 CSRF 中间件）
        client.cookies.set("csrf_token", "test_csrf_token_for_unit_tests")
        client.headers["X-CSRF-Token"] = "test_csrf_token_for_unit_tests"
        yield client


@pytest.fixture
async def admin_test_client():
    """管理员角色的异步测试客户端"""
    from app.main import create_app
    from app.api.deps import get_current_user, get_current_active_user
    from unittest.mock import MagicMock
    from app.models import User
    from httpx import ASGITransport, AsyncClient

    app = create_app()

    async def _mock_admin_user():
        u = MagicMock(spec=User)
        u.id = 1
        u.username = "test_admin"
        u.role = "admin"
        u.is_active = True
        return u

    app.dependency_overrides[get_current_user] = _mock_admin_user
    app.dependency_overrides[get_current_active_user] = _mock_admin_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.cookies.set("csrf_token", "test_csrf_token_for_unit_tests")
        client.headers["X-CSRF-Token"] = "test_csrf_token_for_unit_tests"
        yield client


@pytest.mark.asyncio
async def test_generate_formula_rule_engine(async_test_client, researcher_headers: dict):
    response = await async_test_client.post(
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
    # 现在使用 GA 引擎，失败时回退到规则引擎
    assert data["generator"] in ("ga_optimizer", "rule_engine_fallback")
    if data["candidates"]:
        # 验证候选格式
        c = data["candidates"][0]
        assert "formula_name" in c
        assert "herb_combination" in c
        assert len(c["herb_combination"]) > 0
        for herb in c["herb_combination"]:
            assert "name" in herb
            assert "dosage" in herb
            assert "role" in herb


@pytest.mark.asyncio
async def test_func(async_test_client, researcher_headers: dict):
    """测试 LLM 配方生成（回退到规则引擎）"""
    response = await async_test_client.post(
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
async def test_func(async_test_client, researcher_headers: dict):
    """测试安全检查"""
    response = await async_test_client.post(
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
async def test_func(async_test_client, researcher_headers: dict):
    """测试协同分析"""
    response = await async_test_client.post(
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
async def test_func(async_test_client, researcher_headers: dict):
    """测试智能对话"""
    response = await async_test_client.post(
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
async def test_func(async_test_client, researcher_headers: dict):
    """测试口感预测"""
    response = await async_test_client.post(
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
async def test_func(async_test_client, researcher_headers: dict):
    """测试稳定性预测"""
    response = await async_test_client.post(
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
async def test_func(async_test_client, researcher_headers: dict):
    """测试活性肽评分"""
    response = await async_test_client.post(
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
async def test_func(async_test_client, researcher_headers: dict):
    """测试模型状态"""
    response = await async_test_client.get(
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
async def test_update_llm_config(admin_test_client, admin_headers: dict):
    """测试更新 LLM 配置"""
    response = await admin_test_client.post(
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
async def test_func(async_test_client, researcher_headers: dict):
    """测试配方智能分析"""
    response = await async_test_client.post(
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
async def test_func(async_test_client, researcher_headers: dict):
    """测试配方推荐"""
    response = await async_test_client.post(
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
async def test_func(async_test_client, researcher_headers: dict):
    """测试趋势预测"""
    response = await async_test_client.post(
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
async def test_func(async_test_client, researcher_headers: dict):
    """测试实验分析"""
    response = await async_test_client.post(
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
async def test_func(async_test_client, researcher_headers: dict):
    """测试高级优化配方生成"""
    response = await async_test_client.post(
        "/api/v1/ai/generate/advanced",
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
async def test_func(async_test_client, researcher_headers: dict):
    """测试无效功效参数"""
    response = await async_test_client.post(
        "/api/v1/ai/generate",
        json={
            "target_effects": [],
            "use_llm": False,
        },
        headers=researcher_headers,
    )
    assert response.status_code == 422 or response.status_code == 400


@pytest.mark.asyncio
async def test_func(async_test_client, researcher_headers: dict):
    """测试空成分安全检查"""
    response = await async_test_client.post(
        "/api/v1/ai/safety-check",
        json={
            "ingredient_names": [],
        },
        headers=researcher_headers,
    )
    assert response.status_code == 422 or response.status_code == 400


@pytest.mark.asyncio
async def test_func(async_test_client, researcher_headers: dict):
    """测试空问题"""
    response = await async_test_client.post(
        "/api/v1/ai/chat",
        json={
            "question": "",
            "stream": False,
        },
        headers=researcher_headers,
    )
    assert response.status_code == 422 or response.status_code == 400


@pytest.mark.asyncio
async def test_chat_rule_engine_fallback_marks_model(async_test_client, researcher_headers: dict):
    """LLM 不可用时非流式 /chat 降级规则引擎：
    - 必须返回 model=rule-engine-fallback（与流式一致，供前端显示降级徽标）；
    - 回复内容必须内嵌「规则引擎」来源水印，防止复制后冒充大模型。
    """
    from unittest.mock import MagicMock, patch

    import app.api.ai_modules.chat as chat_module

    fake_llm = MagicMock()
    fake_llm.is_available = False
    fake_llm.config = MagicMock(provider="test", model="test", api_key=None, key_from_db=False)

    question = f"设计一个补气配方-降级标注测试-{id(fake_llm)}"
    with patch.object(chat_module, "_get_llm_service", return_value=fake_llm):
        response = await async_test_client.post(
            "/api/v1/ai/chat",
            json={"question": question, "history": None, "stream": False},
            headers=researcher_headers,
        )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data.get("model") == "rule-engine-fallback"
    assert "规则引擎" in data.get("content", "")
    assert "非大模型推理" in data.get("content", "")

"""app/services/formula/integration_service.py 单元测试

覆盖统一配方集成服务的请求/响应模型、缓存与两种生成管线。
"""
import pytest

from app.services.formula.integration_service import (
    FormulaIntegrationService,
    DeepGenerationRequest,
    DeepGenerationResponse,
    GenerationMode,
)


class TestModels:
    def test_generation_mode_values(self):
        assert GenerationMode.STANDARD.value == "standard"
        assert GenerationMode.DEEP_INTEGRATION.value == "deep_integration"

    def test_request_defaults(self):
        req = DeepGenerationRequest(ingredients=[{"name": "黄芪"}])
        assert req.mode == GenerationMode.DEEP_INTEGRATION
        assert req.target_efficacy == 0.75
        assert req.safety_priority is True
        assert req.target_population == "adult"
        assert req.use_caching is True
        assert req.user_preferences == {}


class TestCache:
    def test_cache_stats_empty(self):
        svc = FormulaIntegrationService()
        stats = svc.get_cache_stats()
        assert isinstance(stats, dict)
        assert stats.get("size", 0) == 0

    def test_clear_cache(self):
        svc = FormulaIntegrationService()
        svc._cache["k"] = DeepGenerationResponse(
            success=True, formula_id="F1", optimized_ratios={}
        )
        svc.clear_cache()
        assert len(svc._cache) == 0


class TestGeneration:
    def test_standard_mode_small(self):
        svc = FormulaIntegrationService()
        response = svc.orchestrate_deep_generation(
            DeepGenerationRequest(
                ingredients=[{"name": "黄芪", "percentage": 100}],
                mode=GenerationMode.STANDARD,
            )
        )
        assert isinstance(response, DeepGenerationResponse)
        assert response.formula_id.startswith("DGF-")
        assert isinstance(response.optimized_ratios, dict)

    def test_deep_mode_two_ingredients(self):
        svc = FormulaIntegrationService()
        response = svc.orchestrate_deep_generation(
            DeepGenerationRequest(
                ingredients=[
                    {"name": "黄芪", "percentage": 60},
                    {"name": "当归", "percentage": 40},
                ],
                mode=GenerationMode.DEEP_INTEGRATION,
            )
        )
        assert isinstance(response, DeepGenerationResponse)
        assert response.formula_id.startswith("DGF-")
        assert isinstance(response.optimized_ratios, dict)
        assert isinstance(response.recommendations, list)

    def test_caching(self):
        svc = FormulaIntegrationService()
        req = DeepGenerationRequest(
            ingredients=[{"name": "黄芪", "percentage": 100}],
            mode=GenerationMode.STANDARD,
            use_caching=True,
        )
        r1 = svc.orchestrate_deep_generation(req)
        assert r1.cache_hit is False
        r2 = svc.orchestrate_deep_generation(req)
        assert r2.cache_hit is True
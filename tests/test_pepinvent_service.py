"""
PepINVERT 服务层单元测试
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timezone

from backend.app.services.ai_models.pepinvent_service import (
    PepinventService,
    GenerateRequest,
    OptimizeRequest,
    SampleRequest,
    GenerateResponse,
    ServiceUnavailableError,
)


class TestPepinventServiceInitialization:
    """测试服务初始化"""

    def test_service_creation(self):
        service = PepinventService()
        assert service is not None
        assert service._cache == {}

    def test_service_with_mock_adapter(self):
        mock_adapter = Mock()
        mock_adapter.is_available = True
        mock_adapter.is_simulation_mode = False
        service = PepinventService(adapter=mock_adapter)
        assert service._adapter is mock_adapter


class TestEffectMapping:
    """测试功效目标映射"""

    def setup_method(self):
        self.service = PepinventService()

    @pytest.mark.parametrize("effects,expected_objectives", [
        (["ACE抑制"], {"ACE_inhibitory": 1.0}),
        (["抗氧化"], {"antioxidant": 1.0}),
        (["降血压"], {"ACE_inhibitory": 1.0}),
        (["ACE抑制", "抗氧化"], {"ACE_inhibitory": 0.5, "antioxidant": 0.5}),
        ([], {"ACE_inhibitory": 0.5, "antioxidant": 0.5}),  # 默认值
    ])
    def test_map_effects_to_objectives(self, effects, expected_objectives):
        result = self.service._map_effects_to_objectives(effects)
        
        for key in expected_objectives:
            assert key in result
            assert abs(result[key] - expected_objectives[key]) < 0.01

    def test_weights_sum_to_one(self):
        effects = ["ACE抑制", "抗氧化", "DPP-IV抑制"]
        result = self.service._map_effects_to_objectives(effects)
        total = sum(result.values())
        assert abs(total - 1.0) < 0.01


class TestConstraintApplication:
    """测试约束条件应用"""

    def setup_method(self):
        self.service = PepinventService()

    def test_filter_by_exclude_sequences(self):
        results = [
            {"sequence": "VLGYT"},
            {"sequence": "LRPFF"},
            {"sequence": "YFYP"},
        ]
        constraints = {"exclude_sequences": ["LRPFF"]}
        filtered = self.service._apply_constraints(results, constraints)
        
        assert len(filtered) == 2
        assert all(r["sequence"] != "LRPFF" for r in filtered)

    def test_filter_by_length_range(self):
        results = [
            {"sequence": "AA"},      # 太短
            {"sequence": "VLGYT"},   # 正常
            {"sequence": "A" * 60}, # 太长
        ]
        constraints = {"min_length": 3, "max_length": 50}
        filtered = self.service._apply_constraints(results, constraints)
        
        assert len(filtered) == 1
        assert filtered[0]["sequence"] == "VLGYT"

    def test_no_constraints_returns_all(self):
        results = [{"sequence": f"SEQ{i}"} for i in range(10)]
        filtered = self.service._apply_constraints(results, {})
        assert len(filtered) == 10


class TestPeptideScoring:
    """测试肽评分功能"""

    def setup_method(self):
        self.service = PepinventService()

    def test_score_peptides_returns_composite_scores(self):
        peptides = [
            {
                "sequence": "VLGYT",
                "properties": {"molecular_weight": 563.64, "logp": -0.4},
                "smiles": "test",
            }
        ]
        objectives = {"ACE_inhibitory": 1.0}
        
        scored = self.service._score_peptides(peptides, objectives)
        
        assert len(scored) == 1
        assert "composite_score" in scored[0]
        assert 0 <= scored[0]["composite_score"] <= 1.0

    def test_multiple_objectives_weighted_correctly(self):
        peptides = [
            {"sequence": "VLGYT", "properties": {}, "smiles": ""}
        ]
        objectives = {"ACE_inhibitory": 0.7, "antioxidant": 0.3}
        
        scored = self.service._score_peptides(peptides, objectives)
        score = scored[0]["composite_score"]
        
        assert 0 <= score <= 1.0


class TestDiverseSubsetSelection:
    """测试多样性子集选择"""

    def setup_method(self):
        self.service = PepinventService()

    def test_select_subset_smaller_than_total(self):
        sequences = [f"SEQ{i}" for i in range(10)]
        sim_matrix = [[0.5] * 10 for _ in range(10)]
        for i in range(10):
            sim_matrix[i][i] = 1.0
        
        selected = self.service._select_diverse_subset(
            sequences, sim_matrix, target_size=5
        )
        
        assert len(selected) == 5
        assert all(isinstance(idx, int) for idx in selected)

    def test_select_all_when_target_larger(self):
        sequences = ["A", "B", "C"]
        sim_matrix = [[1, 0.3, 0.3], [0.3, 1, 0.3], [0.3, 0.3, 1]]
        
        selected = self.service._select_diverse_subset(
            sequences, sim_matrix, target_size=10
        )
        
        assert len(selected) == 3


class TestCaching:
    """测试缓存功能"""

    def setup_method(self):
        self.service = PepinventService()

    def test_set_and_get_cache(self):
        import time as _time
        test_data = {"test": "data"}
        key = "test_key_123"
        
        self.service._set_cache(key, test_data)
        cached = self.service._get_from_cache(key)
        
        assert cached is not None
        assert cached["test"] == "data"

    def test_cache_miss_returns_none(self):
        result = self.service._get_from_cache("nonexistent_key")
        assert result is None

    def test_cache_clear(self):
        self.service._set_cache("key1", "val1")
        self.service._set_cache("key2", "val2")
        assert len(self.service._cache) > 0
        
        self.service.clear_cache()
        assert len(self.service._cache) == 0


class TestServiceStatus:
    """测试服务状态接口"""

    def test_status_contains_required_fields(self):
        mock_adapter = Mock()
        mock_adapter.get_status.return_value = {
            "available": True,
            "initialized": True,
            "simulation_mode": False,
            "device": "cpu",
            "dependencies": {},
            "config": {},
        }
        service = PepinventService(adapter=mock_adapter)
        
        status = service.get_service_status()
        
        assert "service_name" in status
        assert "version" in status
        assert "adapter_status" in status
        assert "cache_stats" in status


class TestInputValidation:
    """测试输入验证"""

    @pytest.mark.asyncio
    async def test_generate_with_empty_effects_raises_error(self):
        service = PepinventService()
        
        with pytest.raises(ValueError, match="target_effects"):
            await service.generate_peptides([])

    @pytest.mark.asyncio
    async def test_generate_with_invalid_max_candidates_raises_error(self):
        service = PepinventService()
        
        with pytest.raises(ValueError, match="max_candidates"):
            await service.generate_peptides(["ACE抑制"], max_candidates=100)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

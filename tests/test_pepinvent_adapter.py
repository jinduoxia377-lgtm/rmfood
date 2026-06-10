"""
PepINVERT 适配器层单元测试
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
import asyncio

from backend.app.services.ai_models.pepinvent_adapter import (
    PepinventAdapter,
    ServiceUnavailableError,
    PeptideResult,
    _STANDARD_AMINO_ACIDS,
)


class TestPepinventAdapterInitialization:
    """测试适配器初始化"""

    def test_adapter_creation_with_default_config(self):
        adapter = PepinventAdapter()
        assert adapter is not None
        assert adapter.is_available in [True, False]

    def test_adapter_in_simulation_mode_when_deps_missing(self):
        with patch('backend.app.services.ai_models.pepinvent_adapter.check_dependencies') as mock_deps:
            mock_deps.return_value = {
                'available': False,
                'missing': ['torch', 'rdkit'],
                'version_info': {}
            }
            adapter = PepinventAdapter()
            assert adapter.is_simulation_mode is True

    def test_adapter_initialization_state(self):
        adapter = PepinventAdapter()
        assert adapter.is_initialized is False


class TestSequenceValidation:
    """测试序列验证"""

    @pytest.mark.parametrize("sequence,expected_valid,expected_error", [
        ("VLGYT", True, ""),
        ("A", False, "序列长度至少为2个氨基酸"),
        ("", False, "序列不能为空"),
        ("VLGYTX", False, "包含无效氨基酸字符: X"),
        ("V" * 51, False, "序列长度不能超过50个氨基酸"),
        (123, False, "序列必须是字符串"),
    ])
    def test_validate_sequence(self, sequence, expected_valid, expected_error):
        valid, error = PepinventAdapter.validate_sequence(sequence)
        assert valid == expected_valid
        if expected_error:
            assert expected_error in error

    @pytest.mark.parametrize("objectives,expected_valid", [
        ({"ACE_inhibitory": 0.7, "antioxidant": 0.3}, True),
        ({}, False),
        ({"invalid_objective": 0.5}, False),
        ({"ACE_inhibitory": 1.2}, False),
        ({"ACE_inhibitory": 0.0}, False),
        ({"ACE_inhibitory": 0.5, "antioxidant": 0.6}, True),  # 总和 >1 但接近
    ])
    def test_validate_objectives(self, objectives, expected_valid):
        valid, error = PepinventAdapter.validate_objectives(objectives)
        assert valid == expected_valid


class TestPropertyCalculation:
    """测试性质计算"""

    def setup_method(self):
        self.adapter = PepinventAdapter()

    def test_calculate_properties_basic(self):
        sequences = ["VLGYT"]
        props = self.adapter.calculate_properties(sequences)
        assert len(props) == 1
        assert "molecular_weight" in props[0]
        assert "logp" in props[0]
        assert "tpsa" in props[0]
        assert props[0]["is_valid"] is True
        assert props[0]["amino_acid_count"] == 5

    def test_molecular_weight_calculation(self):
        sequences = ["AAAAA"]  # 5个丙氨酸
        props = self.adapter.calculate_properties(sequences)
        mw = props[0]["molecular_weight"]
        assert mw > 0
        assert isinstance(mw, float)

    def test_empty_sequences(self):
        props = self.adapter.calculate_properties([])
        assert props == []

    @pytest.mark.parametrize("sequence,expected_range", [
        ("VLGYT", (400, 700)),   # 中等长度
        ("A", (70, 100)),         # 最短有效
        ("V" * 15, (1200, 1800)), # 较长序列
    ])
    def test_molecular_weight_ranges(self, sequence, expected_range):
        props = self.adapter.calculate_properties([sequence])
        mw = props[0]["molecular_weight"]
        assert expected_range[0] <= mw <= expected_range[1]


class TestDiversityCalculation:
    """测试多样性计算"""

    def setup_method(self):
        self.adapter = PepinventAdapter()

    def test_single_sequence_diversity(self):
        result = self.adapter.calculate_diversity(["VLGYT"])
        assert result["unique_count"] == 1
        assert result["diversity_score"] == 1.0

    def test_identical_sequences(self):
        sequences = ["VLGYT"] * 5
        result = self.adapter.calculate_diversity(sequences)
        assert result["unique_count"] == 1
        assert result["average_similarity"] == 1.0

    def test_different_sequences_high_diversity(self):
        sequences = ["AAAAA", "VVVVV", "LLLLL", "IIIII"]
        result = self.adapter.calculate_diversity(sequences)
        assert result["diversity_score"] > 0.8
        assert result["unique_count"] == 4

    def test_empty_sequences(self):
        result = self.adapter.calculate_diversity([])
        assert result["average_similarity"] == 0.0
        assert result["unique_count"] == 0


class TestSimulationModeSampling:
    """测试模拟模式下的采样功能"""

    @pytest.mark.asyncio
    async def test_simulation_sampling_returns_results(self):
        adapter = PepinventAdapter()
        await adapter.initialize()
        
        results = await adapter.sample_peptides(num_samples=5)
        assert len(results) == 5
        
        for r in results:
            assert "sequence" in r
            assert "log_probability" in r
            assert "properties" in r
            assert len(r["sequence"]) >= 2

    @pytest.mark.asyncio
    async def test_simulation_sampling_with_query(self):
        adapter = PepinventAdapter()
        await adapter.initialize()
        
        results = await adapter.sample_peptides(
            num_samples=3,
            query_sequence="VLGYT",
            masked_positions=[1, 3]
        )
        assert len(results) == 3

    @pytest.mark.asyncio
    async def test_simulation_rl_optimization(self):
        adapter = PepinventAdapter()
        await adapter.initialize()
        
        results = await adapter.optimize_with_rl(
            seed_sequences=["VLGYT"],
            objectives={"ACE_inhibitory": 0.7, "antioxidant": 0.3},
            iterations=5
        )
        assert len(results) > 0
        
        for r in results:
            assert "sequence" in r
            assert "scores" in r
            assert "weighted_score" in r
            assert 0 <= r["weighted_score"] <= 1.0


class TestObjectiveEvaluation:
    """测试目标评估函数"""

    def setup_method(self):
        self.adapter = PepinventAdapter()

    def test_ace_inhibitory_scoring(self):
        score = self.adapter._score_ace_inhibitory("YFYP")
        assert 0 <= score <= 1.0

    def test_antioxidant_scoring(self):
        props = {"logp": -0.5}
        score = self.adapter._score_antioxidant("HYWCM", props)
        assert 0 <= score <= 1.0

    def test_permeability_scoring(self):
        props = {"logp": 1.5, "molecular_weight": 400, "tpsa": 80}
        score = self.adapter._score_permeability(props)
        assert 0 <= score <= 1.0

    def test_all_objectives_return_valid_scores(self):
        objectives = [
            "ACE_inhibitory", "antioxidant", "DPP_IV_inhibitory",
            "permeability", "stability", "solubility"
        ]
        for obj in objectives:
            scores = self.adapter._evaluate_objectives("VLGYT", {obj: 1.0})
            assert obj in scores
            assert 0 <= scores[obj] <= 1.0


class TestServiceStatus:
    """测试服务状态接口"""

    def test_get_status_returns_dict(self):
        adapter = PepinventAdapter()
        status = adapter.get_status()
        
        assert isinstance(status, dict)
        assert "available" in status
        assert "initialized" in status
        assert "simulation_mode" in status
        assert "device" in status
        assert "dependencies" in status
        assert "config" in status


class TestMutationOperations:
    """测试序列变异操作"""

    def setup_method(self):
        self.adapter = PepinventAdapter()

    def test_mutate_sequence_changes_length_sometimes(self):
        original = "VLGYT"
        mutated = self.adapter._mutate_sequence(original, mutation_rate=0.5)
        assert len(mutated) >= 2

    def test_mutate_preserves_valid_amino_acids(self):
        original = "VLGYT"
        mutated = self.adapter._mutate_sequence(original)
        for aa in mutated:
            assert aa in _STANDARD_AMINO_ACIDS

    def test_generate_variants_produces_multiple(self):
        variants = self.adapter._generate_variants("VLGYT", n=5)
        assert len(variants) == 5


class TestEdgeCases:
    """边界条件测试"""

    def setup_method(self):
        self.adapter = PepinventAdapter()

    def test_very_long_sequence_validation(self):
        long_seq = "A" * 50
        valid, error = PepinventAdapter.validate_sequence(long_seq)
        assert valid is True

    def test_just_over_limit_sequence(self):
        too_long = "A" * 51
        valid, error = PepinventAdapter.validate_sequence(too_long)
        assert valid is False
        assert "50" in error

    def test_special_characters_rejected(self):
        special_seqs = ["VL-GYT", "VL GYT", "VL\nGYT", "VL\tGYT"]
        for seq in special_seqs:
            valid, _ = PepinventAdapter.validate_sequence(seq)
            assert valid is False

    def test_unicode_characters_rejected(self):
        unicode_seq = "VL日本語"
        valid, _ = PepinventAdapter.validate_sequence(unicode_seq)
        assert valid is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

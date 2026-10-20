"""app/services/formula/synergy_calculators_1/2 单元测试

覆盖 Bliss 独立、PK 相互作用、Gibbs 稳定性、网络药理学与味觉矩阵计算器。
"""
import pytest

from app.services.formula.synergy_engine import SynergyEngine
from app.services.formula.synergy_models import TasteType


class TestBlissIndependence:
    def test_valid_pair(self):
        engine = SynergyEngine()
        score = engine.bliss_independence(0.7, 0.6)
        assert score.score is not None
        assert 0 <= score.confidence <= 1

    def test_invalid_efficacy_a(self):
        engine = SynergyEngine()
        with pytest.raises(ValueError):
            engine.bliss_independence(-0.1, 0.6)

    def test_invalid_efficacy_b(self):
        engine = SynergyEngine()
        with pytest.raises(ValueError):
            engine.bliss_independence(0.7, 1.5)

    def test_with_alpha(self):
        engine = SynergyEngine()
        score = engine.bliss_independence(0.5, 0.5, alpha=0.2)
        assert score.score is not None


class TestPkInteraction:
    def test_valid(self):
        engine = SynergyEngine()
        score = engine.pk_interaction(auc_a=100, auc_b=80, auc_combination=200)
        assert score.score is not None


class TestGibbsStability:
    def test_valid(self):
        engine = SynergyEngine()
        score = engine.gibbs_stability(-20, 50, [-5, -3])
        assert score.score is not None


class TestNetworkPharmacology:
    def test_valid(self):
        engine = SynergyEngine()
        score = engine.network_pharmacology(
            targets_a=["EGFR", "VEGF", "TNF"],
            targets_b=["EGFR", "IL6", "NFkB"],
        )
        assert score.score is not None

    def test_empty_targets_raises(self):
        engine = SynergyEngine()
        with pytest.raises(ValueError):
            engine.network_pharmacology([], ["EGFR"])

    def test_with_pathways_database(self):
        engine = SynergyEngine()
        score = engine.network_pharmacology(
            targets_a=["EGFR"],
            targets_b=["VEGF"],
            pathways_database={"path1": ["EGFR", "VEGF"]},
        )
        assert score.score is not None


class TestTasteMatrix:
    def test_valid(self):
        engine = SynergyEngine()
        profile_a = {TasteType.BITTER: 0.3, TasteType.UMAMI: 0.2}
        profile_b = {TasteType.BITTER: 0.4, TasteType.SWEET: 0.3}
        score = engine.taste_matrix(profile_a, profile_b)
        assert score.score is not None
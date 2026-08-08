"""Tests for TCMSPDataLoader

Tests cover:
- Data loading from builtin herbs
- Classic formulae loading
- Herb vocabulary generation
- Training batch generation
- Efficacy-based querying
"""

import pytest
import random

from app.services.ai.models.data_loader import TCMSPDataLoader, HerbSample, FormulaSample


class TestDataLoaderInit:
    """Test data loader initialization."""

    def test_default_init(self):
        loader = TCMSPDataLoader()
        assert loader.use_builtin is True
        assert loader.use_classic_formulae is True

    def test_custom_init(self):
        loader = TCMSPDataLoader(
            use_builtin=False,
            use_classic_formulae=False,
        )
        assert loader.use_builtin is False
        assert loader.use_classic_formulae is False

    def test_singleton(self):
        from app.services.ai.models.data_loader import get_data_loader
        loader1 = get_data_loader()
        loader2 = get_data_loader()
        assert loader1 is loader2


class TestDataLoaderLoad:
    """Test data loading functionality."""

    def test_load_all(self):
        loader = TCMSPDataLoader()
        result = loader.load_all()

        assert "herbs" in result
        assert "formulae" in result
        assert "stats" in result
        assert isinstance(result["herbs"], dict)
        assert isinstance(result["formulae"], list)

    def test_load_builtin_herbs(self):
        loader = TCMSPDataLoader()
        loader.load_all()

        # Should have at least the builtin herbs
        assert loader.herb_count >= 20

    def test_load_classic_formulae(self):
        loader = TCMSPDataLoader()
        loader.load_all()

        # Should have classic formulae
        assert loader.formula_count >= 4

    def test_is_loaded_flag(self):
        loader = TCMSPDataLoader()
        assert loader.is_loaded is False

        loader.load_all()
        assert loader.is_loaded is True


class TestDataLoaderVocabulary:
    """Test vocabulary generation."""

    def test_get_herb_vocab(self):
        loader = TCMSPDataLoader()
        loader.load_all()

        vocab = loader.get_herb_vocab()
        assert isinstance(vocab, list)
        assert len(vocab) > 0
        assert "hq" in vocab  # 黄芪

    def test_get_herb_vocab_sorted(self):
        loader = TCMSPDataLoader()
        loader.load_all()

        vocab = loader.get_herb_vocab()
        assert vocab == sorted(vocab)

    def test_get_herb_by_id(self):
        loader = TCMSPDataLoader()
        loader.load_all()

        herb = loader.get_herb_by_id("hq")
        assert herb is not None
        assert herb.herb_id == "hq"
        assert herb.name_cn == "黄芪"

    def test_get_herb_by_id_not_found(self):
        loader = TCMSPDataLoader()
        loader.load_all()

        herb = loader.get_herb_by_id("nonexistent")
        assert herb is None


class TestDataLoaderQuerying:
    """Test herb querying functionality."""

    def test_get_samples_by_effect(self):
        loader = TCMSPDataLoader()
        loader.load_all()

        herbs = loader.get_samples_by_effect("补气")
        assert isinstance(herbs, list)
        assert len(herbs) > 0

        # All returned herbs should have the effect
        for herb in herbs:
            assert "补气" in herb.efficacy_scores
            assert herb.efficacy_scores["补气"] > 0

    def test_get_samples_by_effect_empty(self):
        loader = TCMSPDataLoader()
        loader.load_all()

        herbs = loader.get_samples_by_effect("不存在的功效")
        assert herbs == []

    def test_get_samples_by_multiple_effects(self):
        loader = TCMSPDataLoader()
        loader.load_all()

        # Query for multiple effects
        herbs_qi = loader.get_samples_by_effect("补气")
        herbs_xue = loader.get_samples_by_effect("养血")

        assert len(herbs_qi) > 0
        assert len(herbs_xue) > 0


class TestDataLoaderBatchGeneration:
    """Test training batch generation."""

    def test_generate_batch(self):
        loader = TCMSPDataLoader()
        loader.load_all()

        batch, samples = loader.generate_training_batch(
            batch_size=8,
            max_seq_len=8,
        )

        assert len(batch["signals"]) == 8
        assert len(batch["target_herbs"]) == 8
        assert len(batch["target_dosages"]) == 8
        assert len(batch["target_stops"]) == 8

    def test_generate_batch_small(self):
        loader = TCMSPDataLoader()
        loader.load_all()

        # Request more samples than available
        batch, samples = loader.generate_training_batch(
            batch_size=100,
            max_seq_len=8,
        )

        # Should return at least some samples
        assert len(batch["signals"]) > 0

    def test_generate_batch_consistency(self):
        loader = TCMSPDataLoader()
        loader.load_all()

        # Generate two batches and verify they have same structure
        batch1, _ = loader.generate_training_batch(batch_size=4)
        batch2, _ = loader.generate_training_batch(batch_size=4)

        assert len(batch1["signals"]) == len(batch2["signals"])
        assert len(batch1["target_herbs"]) == len(batch2["target_herbs"])


class TestDataLoaderFormulae:
    """Test classic formulae loading."""

    def test_classic_formulae_loaded(self):
        loader = TCMSPDataLoader()
        loader.load_all()

        # Should have loaded classic formulae
        assert loader.formula_count >= 4

    def test_formula_sample_structure(self):
        loader = TCMSPDataLoader()
        loader.load_all()

        if loader.formula_count > 0:
            sample = loader._formulae[0]
            assert hasattr(sample, "herb_ids")
            assert hasattr(sample, "dosages")
            assert hasattr(sample, "target_effects")
            assert hasattr(sample, "signal_vector")
            assert hasattr(sample, "stop_sequence")


class TestDataLoaderEdgeCases:
    """Test edge cases."""

    def test_empty_data_dir(self):
        loader = TCMSPDataLoader(data_dir="/nonexistent/path")
        loader.load_all()
        # Should still work with builtin herbs
        assert loader.herb_count > 0

    def test_no_builtin(self):
        loader = TCMSPDataLoader(use_builtin=False, use_classic_formulae=False)
        loader.load_all()
        # Should have minimal data
        assert loader.herb_count >= 0
        assert loader.formula_count >= 0

    def test_herb_sample_creation(self):
        sample = HerbSample(
            herb_id="test",
            name_cn="测试药材",
            efficacy_scores={"补气": 0.8},
            safety_index=0.9,
            cost_per_gram=0.1,
            dosage_min=3.0,
            dosage_max=15.0,
            dosage_step=1.0,
        )
        assert sample.herb_id == "test"
        assert sample.name_cn == "测试药材"
        assert sample.efficacy_scores["补气"] == 0.8

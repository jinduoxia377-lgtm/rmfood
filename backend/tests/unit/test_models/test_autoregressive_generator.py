"""Tests for AutoregressiveFormulaGenerator

Tests cover:
- Basic generation
- Min/max herb constraints
- Template prefix injection
- Exclude herbs
- Output format validation
"""


from app.services.ai.models.autoregressive_generator import (
    AutoregressiveFormulaGenerator,
)


class TestGeneratorInit:
    """Test generator initialization."""

    def test_default_init(self):
        gen = AutoregressiveFormulaGenerator()
        assert gen.max_seq_len == 12
        assert gen.min_seq_len == 3
        assert gen.stop_threshold == 0.7

    def test_custom_params(self):
        gen = AutoregressiveFormulaGenerator(
            hidden_dim=256,
            n_layers=2,
            max_seq_len=8,
            min_seq_len=2,
        )
        assert gen.hidden_dim == 256
        assert gen.max_seq_len == 8
        assert gen.min_seq_len == 2

    def test_with_herb_vocab(self):
        vocab = ["hq", "ds", "gz", "rs"]
        gen = AutoregressiveFormulaGenerator(herb_vocab=vocab)
        assert gen.herb_vocab == vocab


class TestGeneratorGenerate:
    """Test generation functionality."""

    def test_basic_generation(self):
        gen = AutoregressiveFormulaGenerator(herb_vocab=["hq", "ds", "gz", "rs", "dg"])
        signal = [0.5] * 40
        formula = gen.generate(signal=signal)

        assert isinstance(formula, dict)
        assert len(formula) >= 3  # min_herbs
        assert len(formula) <= 12  # max_herbs

        # All keys should be in vocab
        for herb in formula.keys():
            assert herb in ["hq", "ds", "gz", "rs", "dg"]

        # All values should be positive floats
        for herb, dosage in formula.items():
            assert isinstance(dosage, float)
            assert dosage > 0

    def test_generation_with_min_herbs(self):
        gen = AutoregressiveFormulaGenerator(
            herb_vocab=["hq", "ds", "gz", "rs", "dg", "bq"],
            min_seq_len=5,
        )
        signal = [0.5] * 40
        formula = gen.generate(signal=signal, min_herbs=5)

        assert len(formula) >= 5

    def test_generation_with_max_herbs(self):
        gen = AutoregressiveFormulaGenerator(
            herb_vocab=["hq", "ds", "gz", "rs", "dg", "bq"],
            max_seq_len=4,
        )
        signal = [0.5] * 40
        formula = gen.generate(signal=signal, max_herbs=4)

        assert len(formula) <= 4

    def test_generation_with_exclude_herbs(self):
        gen = AutoregressiveFormulaGenerator(herb_vocab=["hq", "ds", "gz", "rs"])
        signal = [0.5] * 40
        formula = gen.generate(signal=signal, exclude_herbs=["hq", "ds"])

        for herb in formula.keys():
            assert herb not in ["hq", "ds"]

    def test_generation_with_template_prefix(self):
        gen = AutoregressiveFormulaGenerator(
            herb_vocab=["hq", "ds", "gz", "rs", "dg"],
            min_seq_len=3,
        )
        signal = [0.5] * 40
        formula = gen.generate(
            signal=signal,
            template_prefix=["hq", "ds"],
        )

        # Template herbs should be in the formula
        assert "hq" in formula
        assert "ds" in formula

    def test_generation_empty_vocab(self):
        gen = AutoregressiveFormulaGenerator(herb_vocab=[])
        signal = [0.5] * 40
        formula = gen.generate(signal=signal)

        # Should return empty or minimal formula
        assert isinstance(formula, dict)

    def test_generation_dosage_range(self):
        gen = AutoregressiveFormulaGenerator(herb_vocab=["hq", "ds", "gz", "rs"])
        signal = [0.5] * 40
        formula = gen.generate(signal=signal)

        for herb, dosage in formula.items():
            assert 1.0 <= dosage <= 30.0

    def test_generation_total_dosage(self):
        gen = AutoregressiveFormulaGenerator(herb_vocab=["hq", "ds", "gz", "rs"])
        signal = [0.5] * 40
        formula = gen.generate(signal=signal)

        total = sum(formula.values())
        # Total should be around 60g
        assert 40 <= total <= 80

    def test_generation_reproducibility(self):
        """Same seed should produce same results."""
        gen1 = AutoregressiveFormulaGenerator(herb_vocab=["hq", "ds", "gz"])
        gen2 = AutoregressiveFormulaGenerator(herb_vocab=["hq", "ds", "gz"])

        signal = [0.5] * 40
        f1 = gen1.generate(signal=signal)
        f2 = gen2.generate(signal=signal)

        # With same seed, results should be identical
        assert f1 == f2


class TestGeneratorWithTemplate:
    """Test template-based generation."""

    def test_generate_with_template(self):
        gen = AutoregressiveFormulaGenerator(
            herb_vocab=["hq", "ds", "gz", "rs", "bq", "gq"],
        )
        signal = [0.5] * 40
        formula = gen.generate_with_template(
            signal=signal,
            template_herbs=["hq", "ds"],
        )

        assert "hq" in formula
        assert "ds" in formula
        assert len(formula) >= 3

    def test_generate_with_template_exceeds_max(self):
        gen = AutoregressiveFormulaGenerator(
            herb_vocab=["hq", "ds", "gz", "rs"],
            max_seq_len=3,
        )
        signal = [0.5] * 40
        # Template has 2 herbs, max is 3
        formula = gen.generate_with_template(
            signal=signal,
            template_herbs=["hq", "ds"],
            max_herbs=3,
        )

        assert len(formula) <= 3


class TestGeneratorEdgeCases:
    """Test edge cases."""

    def test_generation_with_no_signal(self):
        gen = AutoregressiveFormulaGenerator(herb_vocab=["hq", "ds"])
        formula = gen.generate(signal=[])
        assert isinstance(formula, dict)

    def test_generation_with_partial_signal(self):
        gen = AutoregressiveFormulaGenerator(herb_vocab=["hq", "ds", "gz"])
        signal = [0.5, 0.5]  # Shorter than input_dim
        formula = gen.generate(signal=signal)
        assert isinstance(formula, dict)

    def test_temperature_effect(self):
        """Lower temperature should be more deterministic."""
        gen_low = AutoregressiveFormulaGenerator(
            herb_vocab=["hq", "ds", "gz", "rs"],
            temperature=0.1,
        )
        gen_high = AutoregressiveFormulaGenerator(
            herb_vocab=["hq", "ds", "gz", "rs"],
            temperature=2.0,
        )

        signal = [0.5] * 40
        f1 = gen_low.generate(signal=signal)
        f2 = gen_high.generate(signal=signal)

        # Both should produce valid formulas
        assert len(f1) >= 3
        assert len(f2) >= 3

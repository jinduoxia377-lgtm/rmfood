"""Tests for FormulaDiscriminator

Tests cover:
- Basic discrimination
- Training from market formulas
- Novelty scoring
- Incremental updates
"""


from app.services.ai.models.formula_discriminator import FormulaDiscriminator


class TestDiscriminatorInit:
    """Test discriminator initialization."""

    def test_default_init(self):
        disc = FormulaDiscriminator()
        assert not disc._initialized

    def test_init_with_market_formulas(self):
        market = [
            {"hq": 10.0, "ds": 8.0},
            {"hq": 12.0, "gz": 6.0},
            {"ds": 10.0, "bq": 8.0},
        ]
        disc = FormulaDiscriminator(market_formulas=market)
        assert disc._initialized
        assert disc._market_size == 3


class TestDiscriminate:
    """Test discrimination functionality."""

    def test_discriminate_empty(self):
        disc = FormulaDiscriminator()
        result = disc.discriminate({})
        assert result.is_real == 0.5
        assert result.is_generated == 0.5

    def test_discriminate_with_training(self):
        market = [
            {"hq": 10.0, "ds": 8.0},
            {"hq": 12.0, "gz": 6.0},
        ]
        disc = FormulaDiscriminator(market_formulas=market)

        # Similar to market formula
        similar = {"hq": 11.0, "ds": 7.0}
        result = disc.discriminate(similar)
        assert result.is_real > 0.5  # Likely real

        # Very different
        different = {"unknown1": 10.0, "unknown2": 10.0}
        result2 = disc.discriminate(different)
        assert result2.novelty_score > result.novelty_score

    def test_discriminate_single_herb(self):
        disc = FormulaDiscriminator()
        result = disc.discriminate({"hq": 15.0})
        assert 0.0 <= result.is_real <= 1.0

    def test_novelty_score_range(self):
        disc = FormulaDiscriminator()
        result = disc.discriminate({"hq": 10.0, "ds": 8.0})
        assert 0.0 <= result.novelty_score <= 1.0
        assert 0.0 <= result.confidence <= 1.0


class TestIncrementalUpdate:
    """Test incremental formula updates."""

    def test_update_with_new_formula(self):
        disc = FormulaDiscriminator()
        disc._initialized = True
        disc._market_size = 10

        disc.update_with_new_formula({"hq": 10.0, "ds": 8.0})
        assert disc._market_size == 11

    def test_update_updates_frequencies(self):
        disc = FormulaDiscriminator()
        disc._initialized = True
        disc._market_size = 100
        disc.market_herb_freq = {"hq": 0.5, "ds": 0.3}

        disc.update_with_new_formula({"hq": 10.0})
        # hq frequency should increase
        assert disc.market_herb_freq["hq"] > 0.5


class TestEdgeCases:
    """Test edge cases."""

    def test_discriminate_many_herbs(self):
        disc = FormulaDiscriminator()
        formula = {f"herb_{i}": 5.0 for i in range(20)}
        result = disc.discriminate(formula)
        assert 0.0 <= result.is_real <= 1.0

    def test_discriminate_large_dosage(self):
        disc = FormulaDiscriminator()
        result = disc.discriminate({"hq": 100.0})
        assert 0.0 <= result.is_real <= 1.0

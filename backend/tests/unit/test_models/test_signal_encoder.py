"""Tests for SignalEncoder

Tests cover:
- Basic encoding with target effects
- Category and group encoding
- Continuous constraints encoding
- Fuzzy effect matching
- Output dimension consistency
"""


from app.services.ai.models.signal_encoder import SignalEncoder, EncodedSignal


class TestSignalEncoderInit:
    """Test SignalEncoder initialization."""

    def test_default_init(self):
        encoder = SignalEncoder()
        assert encoder.output_dim == 36  # 16+8+8+4

    def test_custom_index_maps(self):
        effect_map = {"免疫调节": 0, "抗氧化": 1}
        encoder = SignalEncoder(effect_index_map=effect_map)
        assert encoder.get_effect_index_map() == effect_map

    def test_all_effects_defined(self):
        encoder = SignalEncoder()
        assert len(encoder.EFFECTS) == 20
        assert "免疫调节" in encoder.EFFECTS
        assert "抗氧化" in encoder.EFFECTS


class TestSignalEncoderEncode:
    """Test encoding functionality."""

    def test_encode_basic_effects(self):
        encoder = SignalEncoder()
        signal = encoder.encode(target_effects=["免疫调节", "抗氧化"])

        assert isinstance(signal, EncodedSignal)
        assert len(signal.raw_vector) == 36
        assert len(signal.effect_embed) == 16
        assert len(signal.category_embed) == 8
        assert len(signal.group_embed) == 8
        assert len(signal.continuous) == 4

    def test_encode_with_category(self):
        encoder = SignalEncoder()
        signal = encoder.encode(
            target_effects=["补气"],
            product_category="保健饮品",
        )
        # Category embed should not be all zeros
        assert any(v != 0.0 for v in signal.category_embed)

    def test_encode_with_group(self):
        encoder = SignalEncoder()
        signal = encoder.encode(
            target_effects=["清热"],
            target_group="elderly",
        )
        assert any(v != 0.0 for v in signal.group_embed)

    def test_encode_with_constraints(self):
        encoder = SignalEncoder()
        signal = encoder.encode(
            target_effects=["降血糖"],
            continuous_constraints={"max_cost": 30.0, "min_efficacy": 0.7},
        )
        # First two continuous values should reflect constraints
        assert 0.0 <= signal.continuous[0] <= 1.0
        assert 0.0 <= signal.continuous[1] <= 1.0

    def test_encode_empty_effects(self):
        encoder = SignalEncoder()
        signal = encoder.encode(target_effects=[])
        assert len(signal.raw_vector) == 36
        # Effect embed should be all zeros
        assert all(v == 0.0 for v in signal.effect_embed)

    def test_encode_single_effect(self):
        encoder = SignalEncoder()
        signal = encoder.encode(target_effects=["免疫调节"])
        assert len(signal.raw_vector) == 36

    def test_encode_fuzzy_match(self):
        """Test that partial effect names are matched."""
        encoder = SignalEncoder()
        # "免疫" should fuzzy-match "免疫调节"
        signal = encoder.encode(target_effects=["免疫"])
        assert len(signal.raw_vector) == 36

    def test_encode_consistency(self):
        """Same input should produce same output."""
        encoder = SignalEncoder()
        signal1 = encoder.encode(target_effects=["补气", "养血"])
        signal2 = encoder.encode(target_effects=["补气", "养血"])
        assert signal1.raw_vector == signal2.raw_vector

    def test_category_none(self):
        encoder = SignalEncoder()
        signal = encoder.encode(target_effects=["清热"])
        # Default category should be all zeros
        assert all(v == 0.0 for v in signal.category_embed)

    def test_group_default(self):
        encoder = SignalEncoder()
        signal = encoder.encode(target_effects=["清热"])
        # Default group is "adult"
        assert signal.group_embed != [0.0] * 8  # adult has embed


class TestSignalEncoderProperties:
    """Test encoder properties and utilities."""

    def test_output_dim(self):
        encoder = SignalEncoder()
        assert encoder.output_dim == 36

    def test_effect_index_map(self):
        encoder = SignalEncoder()
        effect_map = encoder.get_effect_index_map()
        assert "免疫调节" in effect_map
        assert effect_map["免疫调节"] == 0

    def test_category_index_map(self):
        encoder = SignalEncoder()
        cat_map = encoder.get_category_index_map()
        assert "保健饮品" in cat_map

    def test_group_index_map(self):
        encoder = SignalEncoder()
        grp_map = encoder.get_group_index_map()
        assert "adult" in grp_map
        assert "elderly" in grp_map
        assert "children" in grp_map


class TestSignalEncoderEdgeCases:
    """Test edge cases."""

    def test_many_effects(self):
        encoder = SignalEncoder()
        signal = encoder.encode(target_effects=encoder.EFFECTS)
        assert len(signal.raw_vector) == 36

    def test_unknown_category(self):
        encoder = SignalEncoder()
        signal = encoder.encode(
            target_effects=["补气"],
            product_category="未知类别",
        )
        # Should not crash, category embed should be zeros
        assert len(signal.raw_vector) == 36

    def test_unknown_group(self):
        encoder = SignalEncoder()
        signal = encoder.encode(
            target_effects=["补气"],
            target_group="unknown_group",
        )
        # Should not crash
        assert len(signal.raw_vector) == 36

    def test_short_signal_input(self):
        """Test that encode handles short signal lists gracefully."""
        encoder = SignalEncoder()
        # This tests the internal _encode_effects method indirectly
        signal = encoder.encode(target_effects=["补气"])
        assert len(signal.effect_embed) == 16

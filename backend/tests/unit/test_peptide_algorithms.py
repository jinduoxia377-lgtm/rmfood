"""
Unit tests for the peptide analysis core algorithms.

Tests cover:
- SequencePreprocessor: validate_sequence, standardize, quality_assess
- FeatureExtractor: extract_all_features and sub-extractors
- FoodPeptideAnalyzer: full analysis pipeline (6 modules)

All tests are pure unit tests with no DB dependencies.
"""
import pytest

from app.services.peptide_analysis_v2.core_algorithms.preprocessor import (
    SequencePreprocessor,
    STANDARD_AMINO_ACIDS,
    AA_MOLECULAR_WEIGHTS,
    PKA_SIDE_CHAIN,
    ValidationResult,
    StandardizedSequence,
    QualityMetrics,
)
from app.services.peptide_analysis_v2.core_algorithms.feature_extractor import (
    FeatureExtractor,
    AA_PROPERTIES,
    FeatureVector,
)
from app.services.peptide_analysis_v2.core_algorithms.food_peptide_analyzer import (
    FoodPeptideAnalyzer,
    FoodPeptideAnalysisResult,
)


# ════════════════════════════════════════════════════════════════
# SequencePreprocessor Tests
# ════════════════════════════════════════════════════════════════


class TestSequencePreprocessorValidate:
    """Tests for SequencePreprocessor.validate_sequence()"""

    @pytest.fixture
    def preprocessor(self):
        return SequencePreprocessor()

    @pytest.mark.asyncio
    async def test_valid_standard_sequence_vlgytkegn(self, preprocessor):
        result = await preprocessor.validate_sequence("VLGYTKEGN")
        assert result.is_valid is True
        assert isinstance(result, ValidationResult)
        assert len(result.errors) == 0
        assert result.quality_score > 0.0

    @pytest.mark.asyncio
    async def test_valid_known_peptide_vpp(self, preprocessor):
        result = await preprocessor.validate_sequence("VPP")
        assert result.is_valid is True
        assert result.quality_score > 0.0

    @pytest.mark.asyncio
    async def test_valid_known_peptide_ipp(self, preprocessor):
        result = await preprocessor.validate_sequence("IPP")
        assert result.is_valid is True
        assert result.quality_score > 0.0

    @pytest.mark.asyncio
    async def test_valid_all_20_amino_acids(self, preprocessor):
        all_aas = "ACDEFGHIKLMNPQRSTVWY"
        result = await preprocessor.validate_sequence(all_aas)
        assert result.is_valid is True
        assert result.quality_score > 0.7

    @pytest.mark.asyncio
    async def test_valid_long_sequence_high_quality(self, preprocessor):
        seq = "MVLSEGEWQLVLHVWAKVEADVAGHGQDILIRLFKSHPETLEKFDRVKHLKTEAEMKASEDLKKHGVTVLTALGGILKKKGHHEAEIKPLAQSHATKHKIPV"
        result = await preprocessor.validate_sequence(seq)
        assert result.is_valid is True
        assert result.quality_score > 0.7

    @pytest.mark.asyncio
    async def test_invalid_character_x(self, preprocessor):
        result = await preprocessor.validate_sequence("VLGX123")
        assert result.is_valid is False
        assert len(result.errors) > 0
        error_codes = [e.code for e in result.errors]
        assert "INVALID_CHARACTER" in error_codes

    @pytest.mark.asyncio
    async def test_invalid_characters_hello_world(self, preprocessor):
        result = await preprocessor.validate_sequence("hello world")
        assert result.is_valid is False
        error_codes = [e.code for e in result.errors]
        assert "INVALID_CHARACTER" in error_codes

    @pytest.mark.asyncio
    async def test_empty_string_input(self, preprocessor):
        result = await preprocessor.validate_sequence("")
        assert result.is_valid is False
        assert len(result.errors) >= 1
        assert result.errors[0].code == "EMPTY_INPUT"
        assert result.quality_score == 0.0

    @pytest.mark.asyncio
    async def test_none_input(self, preprocessor):
        result = await preprocessor.validate_sequence(None)
        assert result.is_valid is False
        assert len(result.errors) >= 1
        assert result.errors[0].code == "EMPTY_INPUT"

    @pytest.mark.asyncio
    async def test_integer_input(self, preprocessor):
        result = await preprocessor.validate_sequence(12345)
        assert result.is_valid is False
        assert result.errors[0].code == "EMPTY_INPUT"

    @pytest.mark.asyncio
    async def test_too_short_single_amino_acid(self, preprocessor):
        result = await preprocessor.validate_sequence("A")
        assert result.is_valid is False
        error_codes = [e.code for e in result.errors]
        assert "SEQUENCE_TOO_SHORT" in error_codes

    @pytest.mark.asyncio
    async def test_too_long_exceeds_5000(self, preprocessor):
        seq = "A" * 5001
        result = await preprocessor.validate_sequence(seq)
        assert result.is_valid is False
        error_codes = [e.code for e in result.errors]
        assert "SEQUENCE_TOO_LONG" in error_codes

    @pytest.mark.asyncio
    async def test_boundary_length_exactly_2(self, preprocessor):
        result = await preprocessor.validate_sequence("AC")
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_boundary_length_exactly_5000(self, preprocessor):
        seq = "ACDEFGHIKLMNPQRSTVWY" * 250  # 5000 chars
        result = await preprocessor.validate_sequence(seq)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_quality_score_range_0_to_1(self, preprocessor):
        for seq in ["VLGYTKEGN", "VPP", "ACDEFGHIKLMNPQRSTVWY"]:
            result = await preprocessor.validate_sequence(seq)
            assert 0.0 <= result.quality_score <= 1.0

    @pytest.mark.asyncio
    async def test_invalid_sequence_quality_score_decreases_with_errors(self, preprocessor):
        result = await preprocessor.validate_sequence("X")
        assert result.quality_score <= 0.8  # penalized by errors


class TestSequencePreprocessorStandardize:
    """Tests for SequencePreprocessor.standardize()"""

    @pytest.fixture
    def preprocessor(self):
        return SequencePreprocessor()

    @pytest.mark.asyncio
    async def test_lowercase_to_uppercase(self, preprocessor):
        result = await preprocessor.standardize("vlgytkegn")
        assert result.value == "VLGYTKEGN"
        assert result.original_value == "vlgytkegn"

    @pytest.mark.asyncio
    async def test_spaces_removed(self, preprocessor):
        result = await preprocessor.standardize("V L G Y T K E G N")
        assert result.value == "VLGYTKEGN"
        assert " " not in result.value

    @pytest.mark.asyncio
    async def test_mixed_case_and_spaces(self, preprocessor):
        result = await preprocessor.standardize("vLg Yt kE gN")
        assert result.value == "VLGYTKEGN"

    @pytest.mark.asyncio
    async def test_returns_standardized_sequence_type(self, preprocessor):
        result = await preprocessor.standardize("VLGYTKEGN")
        assert isinstance(result, StandardizedSequence)
        assert result.standardized_length == len("VLGYTKEGN")

    @pytest.mark.asyncio
    async def test_original_length_preserved(self, preprocessor):
        original = "V L G Y T K E G N"
        result = await preprocessor.standardize(original)
        assert result.original_length == len(original)
        assert result.standardized_length == 9  # spaces removed

    @pytest.mark.asyncio
    async def test_digits_removed(self, preprocessor):
        result = await preprocessor.standardize("V1L2G3Y")
        assert result.value == "VLGY"

    @pytest.mark.asyncio
    async def test_modification_detection(self, preprocessor):
        result = await preprocessor.standardize("M[Ox]VLGYT")
        assert len(result.modifications_detected) == 1
        assert result.modifications_detected[0].type.upper() == "OX"
        assert "M" in result.value

    @pytest.mark.asyncio
    async def test_already_standard_sequence_unchanged(self, preprocessor):
        seq = "VLGYTKEGN"
        result = await preprocessor.standardize(seq)
        assert result.value == seq
        assert result.modifications_detected == []

    @pytest.mark.asyncio
    async def test_empty_after_standardization(self, preprocessor):
        result = await preprocessor.standardize("123 !@#")
        assert result.value == ""


class TestSequencePreprocessorQualityAssess:
    """Tests for SequencePreprocessor.quality_assess()"""

    @pytest.fixture
    def preprocessor(self):
        return SequencePreprocessor()

    @pytest.mark.asyncio
    async def test_returns_quality_metrics_type(self, preprocessor):
        result = await preprocessor.quality_assess("VLGYTKEGN")
        assert isinstance(result, QualityMetrics)

    @pytest.mark.asyncio
    async def test_high_diversity_high_complexity(self, preprocessor):
        result = await preprocessor.quality_assess("ACDEFGHIKLMNPQRSTVWY")
        assert result.complexity_score > 3.5  # near max entropy for 20 AAs
        assert result.overall_quality > 0.5

    @pytest.mark.asyncio
    async def test_low_diversity_low_complexity(self, preprocessor):
        result = await preprocessor.quality_assess("AAAAAAA")
        assert result.complexity_score < 1.0  # near zero entropy
        assert result.overall_quality < 0.7

    @pytest.mark.asyncio
    async def test_repeated_sequence_detected(self, preprocessor):
        result = await preprocessor.quality_assess("VLGYVLGYVLGY")
        assert result.has_repeats is True
        assert len(result.repeat_units) > 0

    @pytest.mark.asyncio
    async def test_no_repeats_in_random_sequence(self, preprocessor):
        result = await preprocessor.quality_assess("ACDEFGHIKLMNPQ")
        assert result.has_repeats is False

    @pytest.mark.asyncio
    async def test_overall_quality_range_0_to_1(self, preprocessor):
        for seq in ["VLGYTKEGN", "AAAAAAA", "ACDEFGHIKLMNPQRSTVWY"]:
            result = await preprocessor.quality_assess(seq)
            assert 0.0 <= result.overall_quality <= 1.0

    @pytest.mark.asyncio
    async def test_very_short_sequence_quality_zero(self, preprocessor):
        result = await preprocessor.quality_assess("A")
        assert result.overall_quality == 0.0

    @pytest.mark.asyncio
    async def test_complexity_score_range(self, preprocessor):
        result = await preprocessor.quality_assess("ACDEFGHIKLMNPQRSTVWY")
        # Shannon entropy max for 20 AAs is log2(20) ~ 4.3219
        assert 0.0 <= result.complexity_score <= 4.33

    @pytest.mark.asyncio
    async def test_single_aa_repeats_flagged(self, preprocessor):
        result = await preprocessor.quality_assess("AAAAAAAAAAAA")
        assert result.has_repeats is True


# ════════════════════════════════════════════════════════════════
# Molecular Weight Calculation Tests (via Preprocessor constants)
# ════════════════════════════════════════════════════════════════


class TestMolecularWeightConstants:
    """Tests for the AA_MOLECULAR_WEIGHTS constants and their usage"""

    def test_all_20_amino_acids_have_weights(self):
        assert len(AA_MOLECULAR_WEIGHTS) == 20
        for aa in STANDARD_AMINO_ACIDS:
            assert aa in AA_MOLECULAR_WEIGHTS

    def test_known_weight_alanine(self):
        assert AA_MOLECULAR_WEIGHTS['A'] == pytest.approx(89.0932, abs=0.001)

    def test_known_weight_glycine(self):
        assert AA_MOLECULAR_WEIGHTS['G'] == pytest.approx(75.0666, abs=0.001)

    def known_weight_tryptophan(self):
        assert AA_MOLECULAR_WEIGHTS['W'] == pytest.approx(204.2262, abs=0.001)

    def test_all_weights_positive(self):
        for aa, weight in AA_MOLECULAR_WEIGHTS.items():
            assert weight > 0, f"Weight for {aa} should be positive"

    def test_molecular_weight_sum_for_dipeptide(self):
        """Calculate MW for VPP = V + P + P"""
        expected = (
            AA_MOLECULAR_WEIGHTS['V']
            + AA_MOLECULAR_WEIGHTS['P']
            + AA_MOLECULAR_WEIGHTS['P']
        )
        assert expected == pytest.approx(
            117.1463 + 115.1300 + 115.1300, abs=0.01
        )

    def test_molecular_weight_sum_for_tri_peptide(self):
        """Calculate MW for IPP = I + P + P"""
        expected = (
            AA_MOLECULAR_WEIGHTS['I']
            + AA_MOLECULAR_WEIGHTS['P']
            + AA_MOLECULAR_WEIGHTS['P']
        )
        assert expected == pytest.approx(
            131.1729 + 115.1300 + 115.1300, abs=0.01
        )


class TestPKAConstants:
    """Tests for PKA_SIDE_CHAIN constants"""

    def test_pka_side_chain_has_7_entries(self):
        assert len(PKA_SIDE_CHAIN) == 7

    def test_known_pka_values(self):
        assert PKA_SIDE_CHAIN['D'] == 3.86
        assert PKA_SIDE_CHAIN['E'] == 4.25
        assert PKA_SIDE_CHAIN['H'] == 6.88
        assert PKA_SIDE_CHAIN['C'] == 8.33
        assert PKA_SIDE_CHAIN['Y'] == 10.07
        assert PKA_SIDE_CHAIN['K'] == 10.53
        assert PKA_SIDE_CHAIN['R'] == 12.48

    def test_pka_values_ordered_acidic_to_basic(self):
        pka_values = list(PKA_SIDE_CHAIN.values())
        assert pka_values == sorted(pka_values)


# ════════════════════════════════════════════════════════════════
# FeatureExtractor Tests
# ════════════════════════════════════════════════════════════════


class TestFeatureExtractor:
    """Tests for FeatureExtractor.extract_all_features()"""

    @pytest.fixture
    def extractor(self):
        return FeatureExtractor()

    @pytest.mark.asyncio
    async def test_returns_feature_vector(self, extractor):
        result = await extractor.extract_all_features("VLGYTKEGN")
        assert isinstance(result, FeatureVector)

    @pytest.mark.asyncio
    async def test_feature_vector_has_sequence(self, extractor):
        result = await extractor.extract_all_features("VLGYTKEGN")
        assert result.sequence == "VLGYTKEGN"

    @pytest.mark.asyncio
    async def test_total_dimensions_exceeds_100(self, extractor):
        result = await extractor.extract_all_features("VLGYTKEGN")
        assert result.total_dimensions > 100

    @pytest.mark.asyncio
    async def test_molecular_weight_positive(self, extractor):
        result = await extractor.extract_all_features("VLGYTKEGN")
        assert result.physicochemical.molecular_weight > 0

    @pytest.mark.asyncio
    async def test_molecular_weight_known_peptide(self, extractor):
        """Insulin B chain: FVNQHLCGSHLVEALYLVCGERGFFYTPKT (30 AA)"""
        insulin_b = "FVNQHLCGSHLVEALYLVCGERGFFYTPKT"
        result = await extractor.extract_all_features(insulin_b)
        actual_mw = result.physicochemical.molecular_weight
        # 30 AA peptide MW should be in reasonable range (~3000-4500 Da)
        assert 3000 < actual_mw < 5000, f"MW out of range: {actual_mw:.2f}"

    @pytest.mark.asyncio
    async def test_gravy_range(self, extractor):
        result = await extractor.extract_all_features("VLGYTKEGN")
        # GRAVY should be a finite number
        assert isinstance(result.physicochemical.gravy, float)
        assert -5.0 < result.physicochemical.gravy < 5.0

    @pytest.mark.asyncio
    async def test_composition_has_aa_frequencies(self, extractor):
        result = await extractor.extract_all_features("VLGYTKEGN")
        assert len(result.composition.aa_frequencies) > 0
        assert len(result.composition.aa_percentages) > 0
        total_pct = sum(result.composition.aa_percentages.values())
        assert abs(total_pct - 100.0) < 1.0

    @pytest.mark.asyncio
    async def test_dipeptide_frequencies(self, extractor):
        result = await extractor.extract_all_features("VLGYTKEGN")
        assert len(result.composition.dipeptide_frequencies) > 0
        # Each dipeptide frequency should be between 0 and 1
        for freq in result.composition.dipeptide_frequencies.values():
            assert 0.0 < freq <= 1.0

    @pytest.mark.asyncio
    async def test_structural_propensity_values(self, extractor):
        result = await extractor.extract_all_features("VLGYTKEGN")
        assert result.structural.helix_propensity > 0
        assert result.structural.sheet_propensity > 0
        assert result.structural.turn_propensity > 0

    @pytest.mark.asyncio
    async def test_functional_sites_extraction(self, extractor):
        result = await extractor.extract_all_features("VLGYTKEGN")
        assert isinstance(result.functional.signal_peptide_probability, float)
        assert 0.0 <= result.functional.signal_peptide_probability <= 1.0
        assert isinstance(result.functional.transmembrane_helices, int)
        assert result.functional.transmembrane_helices >= 0

    @pytest.mark.asyncio
    async def test_extraction_version_set(self, extractor):
        result = await extractor.extract_all_features("VLGYTKEGN")
        assert result.extraction_version == "v2.0"
        assert result.extraction_timestamp != ""


# ════════════════════════════════════════════════════════════════
# FoodPeptideAnalyzer Tests
# ════════════════════════════════════════════════════════════════


class TestFoodPeptideAnalyzer:
    """Tests for FoodPeptideAnalyzer full pipeline"""

    @pytest.fixture
    def analyzer(self):
        return FoodPeptideAnalyzer()

    @pytest.mark.asyncio
    async def test_valid_peptide_returns_full_result(self, analyzer):
        result = await analyzer.analyze("VLGYTKEGN")
        assert isinstance(result, FoodPeptideAnalysisResult)
        assert result.validation.is_valid is True
        assert result.physicochemical is not None
        assert result.secondary_structure is not None
        assert result.bioactivity is not None
        assert result.safety is not None

    @pytest.mark.asyncio
    async def test_known_ace_inhibitor_peptides(self, analyzer):
        """Known ACE-inhibitory peptides should have non-zero scores."""
        for seq in ["VPP", "IPP", "VLGYTKEGN"]:
            result = await analyzer.analyze(seq)
            assert result.bioactivity.ace_inhibition['score'] > 0
            assert result.bioactivity.ace_inhibition['tier'] in ('low', 'moderate', 'high')

    @pytest.mark.asyncio
    async def test_safety_assessment_for_normal_peptide(self, analyzer):
        result = await analyzer.analyze("VLGYTKEGN")
        assert result.safety.risk_level in ('low', 'medium', 'high')
        assert 0.0 <= result.safety.safety_score <= 1.0
        assert 0.0 <= result.safety.digestive_stability <= 1.0

    @pytest.mark.asyncio
    async def test_safety_toxic_cluster_detected(self, analyzer):
        result = await analyzer.analyze("RRRRRR")
        assert len(result.safety.toxicity_flags) > 0

    @pytest.mark.asyncio
    async def test_food_application_score_range(self, analyzer):
        result = await analyzer.analyze("VLGYTKEGN")
        assert 0.0 <= result.food_application_score <= 100.0

    @pytest.mark.asyncio
    async def test_application_suggestions_non_empty(self, analyzer):
        result = await analyzer.analyze("VLGYTKEGN")
        assert len(result.application_suggestions) > 0

    @pytest.mark.asyncio
    async def test_invalid_sequence_short_circuits(self, analyzer):
        result = await analyzer.analyze("")
        assert result.validation.is_valid is False
        assert result.physicochemical is None

    @pytest.mark.asyncio
    async def test_secondary_structure_dominant(self, analyzer):
        result = await analyzer.analyze("VLGYTKEGN")
        assert result.secondary_structure.dominant_structure in (
            "alpha_helix", "beta_sheet", "random_coil"
        )
        total_pct = (
            result.secondary_structure.alpha_helix_pct
            + result.secondary_structure.beta_sheet_pct
            + result.secondary_structure.random_coil_pct
        )
        assert abs(total_pct - 100.0) < 2.0

    @pytest.mark.asyncio
    async def test_physicochemical_mw_matches_manual(self, analyzer):
        """Verify MW for IPP against manual AA_PROPERTIES calculation."""
        result = await analyzer.analyze("IPP")
        expected_mw = sum(
            AA_PROPERTIES.get(aa, {}).get('mw', 0) for aa in "IPP"
        )
        assert abs(result.physicochemical.molecular_weight - expected_mw) < 0.5

    @pytest.mark.asyncio
    async def test_batch_analyze_returns_list(self, analyzer):
        results = await analyzer.batch_analyze(["VPP", "IPP", "VLGYTKEGN"])
        assert isinstance(results, list)
        assert len(results) == 3
        for r in results:
            assert isinstance(r, FoodPeptideAnalysisResult)

    @pytest.mark.asyncio
    async def test_processing_time_recorded(self, analyzer):
        result = await analyzer.analyze("VLGYTKEGN")
        assert result.processing_time_ms >= 0

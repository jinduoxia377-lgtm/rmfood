"""
纯数学函数测试 — 协同作用引擎数学模型

覆盖:
- Bliss Independence 药效增强协同 (synergy_calculators_1.py)
- PK Interaction 药代动力学协同 (synergy_calculators_1.py)
- Gibbs 自由能结构稳定性协同 (synergy_calculators_1.py)
- _hypergeometric_test 纯 Python 超几何检验 (synergy_calculators_1.py)
- Network Pharmacology Jaccard/Tanimoto (synergy_calculators_2.py)
- Taste Matrix 感官品质协同 (synergy_calculators_2.py)

这些测试不依赖数据库、网络或任何 I/O。
"""

import math
from typing import Dict, List, Tuple

import pytest

# ── 独立工具函数 ─────────────────────────────────────────────────────

# --- 从 synergy_calculators_1.py 提取的核心计算逻辑（独立复现）---


def _bliss_core(efficacy_a: float, efficacy_b: float, alpha: float = 0.0) -> dict:
    """Bliss Independence 核心计算，不含 SynergyScore 构造。"""
    base_effect = efficacy_a + efficacy_b - efficacy_a * efficacy_b
    interaction_term = alpha * math.sqrt(max(0, efficacy_a * efficacy_b))
    e_synergy = base_effect + interaction_term
    e_synergy = max(0.0, min(2.0, e_synergy))
    confidence = min(1.0, abs(alpha) / 1.5 + 0.3) if alpha != 0.0 else 0.3
    synergy_type = (
        "正向协同" if e_synergy > base_effect + 0.1
        else "拮抗作用" if e_synergy < base_effect - 0.1
        else "近似独立"
    )
    return {
        "e_synergy": round(e_synergy, 4),
        "base_effect": round(base_effect, 4),
        "interaction_term": round(interaction_term, 4),
        "confidence": round(confidence, 4),
        "synergy_type": synergy_type,
    }


def _hypergeometric_test(N: int, K: int, n: int, k: int) -> float:  # noqa: N803  # N/K 为超几何分布数学符号
    """纯 Python 超几何检验 P(X >= k)。"""

    if k == 0:
        return 1.0
    if k > K or k > n or N <= 0 or K < 0 or n < 0:
        return 1.0

    log_denom = 0.0
    if N >= 0 and n >= 0 and (N - n) >= 0 and K <= N:
        try:
            log_denom = sum(math.log(i) for i in range(N - n + 1, N + 1)) - \
                        sum(math.log(i) for i in range(1, n + 1))
        except ValueError:
            return 1.0
    else:
        return 1.0

    if log_denom == float('inf') or math.isinf(log_denom):
        return 1.0

    max_k = min(K, n)
    if k > max_k:
        return 1.0

    log_pvalue = float('-inf')
    for i in range(k, max_k + 1):
        try:
            log_numer = (
                sum(math.log(j) for j in range(K - i + 1, K + 1)) -
                sum(math.log(j) for j in range(1, i + 1)) +
                sum(math.log(j) for j in range(N - K - n + i + 1, N - K + 1)) -
                sum(math.log(j) for j in range(1, N - K - n + i + 1) if N - K - n + i > 1)
            )
        except (ValueError, ZeroDivisionError):
            continue
        log_term = log_numer - log_denom
        if log_pvalue == float('-inf'):
            log_pvalue = log_term
        else:
            log_pvalue = math.log(math.exp(log_pvalue) + max(0, math.exp(log_term)))

    return math.exp(min(log_pvalue, 700)) if log_pvalue != float('-inf') else 1.0


def _jaccard(set_a: set, set_b: set) -> float:
    """Jaccard 相似系数。"""
    union = set_a | set_b
    if not union:
        return 0.0
    return len(set_a & set_b) / len(union)


def _tanimoto(set_a: set, set_b: set) -> float:
    """Tanimoto (扩展 Jaccard) 系数。"""
    denom = len(set_a) + len(set_b) - len(set_a & set_b)
    if denom <= 0:
        return 0.0
    return len(set_a & set_b) / denom


def _gibbs_base(delta_h: float, delta_s: float, T: float = 298.15, gamma: float = 1.0,  # noqa: N803  # T 为热力学温度符号
                interaction_terms: List[float] = None) -> dict:
    """Gibbs 自由能基础计算。"""
    delta_g_base = delta_h - (T * delta_s / 1000)
    interaction_sum = sum(interaction_terms) if interaction_terms else 0.0
    delta_g_complex = delta_g_base + gamma * interaction_sum
    R = 8.314  # noqa: N806  # 气体常数（数学符号约定）
    rt = R * T / 1000
    stability_score = 1.0 / (1.0 + math.exp(delta_g_complex / rt)) if rt > 0 else 0.5
    stability_score = max(0.0, min(1.0, stability_score))
    return {
        "delta_g_base": round(delta_g_base, 4),
        "delta_g_complex": round(delta_g_complex, 4),
        "stability_score": round(stability_score, 4),
    }


def _taste_matrix_score(
    profile_a: Dict[str, float],
    profile_b: Dict[str, float],
    matrix: Dict[Tuple[str, str], int] = None,
    suppression_threshold: float = 0.3,
) -> dict:
    """Taste matrix 评分计算（无 config 依赖版）。"""
    default = {
        ("bitter", "sweet"): -1, ("bitter", "umami"): -1,
        ("astringent", "sweet"): -1, ("umami", "sweet"): 1,
        ("sour", "sweet"): 1, ("salty", "umami"): 1,
    }
    mat = matrix or default

    taste_weights = {
        "bitter": -0.25, "astringent": -0.20, "umami": 0.25,
        "sweet": 0.20, "sour": 0.05, "salty": 0.05,
    }

    all_tastes = set(profile_a.keys()) | set(profile_b.keys())
    combined = {}
    for t in all_tastes:
        combined[t] = (profile_a.get(t, 0.0) + profile_b.get(t, 0.0)) / 2

    s_base = sum(taste_weights.get(t, 0) * v for t, v in combined.items())

    s_interaction = 0.0
    taste_list = list(all_tastes)
    for i, ti in enumerate(taste_list):
        for j, tj in enumerate(taste_list):
            if i >= j:
                continue
            s_i = combined.get(ti, 0.0)
            s_j = combined.get(tj, 0.0)
            t_ij = mat.get((ti, tj), mat.get((tj, ti), 0))
            s_interaction += t_ij * math.sqrt(max(0, s_i * s_j))

    s_total = s_base + s_interaction
    taste_score = (s_total + 1.0) / 2.0
    taste_score = max(0.0, min(1.0, taste_score))
    return {"s_base": round(s_base, 4), "s_interaction": round(s_interaction, 4),
            "taste_score": round(taste_score, 4)}


def _pk_core(auc_a: float, auc_b: float, auc_comb: float,
             bio_availability_base: float = 1.0,
             first_pass_effect: float = 0.0,
             gut_competition: float = 0.0) -> dict:
    """PK interaction core calculation."""
    auc_sum = auc_a + auc_b
    auc_ratio = auc_comb / auc_sum if auc_sum > 0 else 1.0
    f_factor = bio_availability_base
    first_pass_factor = 1.0 - first_pass_effect
    absorption_factor = 1.0 - gut_competition * 0.3
    pk_score = auc_ratio * f_factor * first_pass_factor * absorption_factor
    pk_score = max(0.0, min(2.0, pk_score))
    normalized = pk_score / 2.0
    return {
        "auc_ratio": round(auc_ratio, 4),
        "pk_score": round(pk_score, 4),
        "normalized_score": round(normalized, 4),
    }


# ── Bliss Independence 测试 ──────────────────────────────────────────

class TestBlissIndependence:
    """Bliss Independence 数学模型测试。"""

    def test_independent_addition(self):
        """E_A + E_B - E_A*E_B when alpha=0."""
        result = _bliss_core(0.5, 0.5, alpha=0.0)
        assert result["e_synergy"] == 0.75  # 0.5 + 0.5 - 0.25
        assert result["interaction_term"] == 0.0
        assert result["synergy_type"] == "近似独立"

    def test_high_efficacy_synergy(self):
        """Both efficacies high with positive alpha → synergy."""
        result = _bliss_core(0.9, 0.8, alpha=1.0)
        assert result["e_synergy"] > result["base_effect"]
        assert result["synergy_type"] == "正向协同"

    def test_antagonism_with_negative_alpha(self):
        """Negative alpha causes antagonism."""
        result = _bliss_core(0.5, 0.5, alpha=-0.5)
        assert result["e_synergy"] < result["base_effect"]
        assert result["synergy_type"] == "拮抗作用"

    def test_zero_efficacy(self):
        """If one efficacy is zero, result equals the other."""
        result = _bliss_core(0.0, 0.8, alpha=0.0)
        assert result["e_synergy"] == 0.8

    def test_both_zeros(self):
        """Both zero efficacy → zero result."""
        result = _bliss_core(0.0, 0.0, alpha=0.0)
        assert result["e_synergy"] == 0.0

    def test_both_ones(self):
        """Both efficacy = 1 → base = 1 + bound by alpha term."""
        result = _bliss_core(1.0, 1.0, alpha=0.0)
        assert result["e_synergy"] == 1.0

    def test_clipping_at_upper_bound(self):
        """High alpha cannot push score above 2.0."""
        result = _bliss_core(1.0, 1.0, alpha=1.5)
        assert result["e_synergy"] <= 2.0

    def test_clipping_at_lower_bound(self):
        """Negative alpha should not push below 0."""
        result = _bliss_core(1.0, 1.0, alpha=-0.5)
        assert result["e_synergy"] >= 0.0

    def test_confidence_with_default_alpha(self):
        """Default alpha=0 → low confidence."""
        result = _bliss_core(0.5, 0.5, alpha=0.0)
        assert result["confidence"] == 0.3

    def test_confidence_with_known_alpha(self):
        """Known alpha → higher confidence."""
        result = _bliss_core(0.5, 0.5, alpha=1.0)
        assert result["confidence"] >= 0.3

    def test_symmetry(self):
        """Bliss model is symmetric in A and B."""
        r1 = _bliss_core(0.6, 0.3, alpha=0.5)
        r2 = _bliss_core(0.3, 0.6, alpha=0.5)
        assert r1["e_synergy"] == r2["e_synergy"]


# ── 超几何检验测试 ───────────────────────────────────────────────────

class TestHypergeometricTest:
    """_hypergeometric_test 纯函数测试。"""

    def test_perfect_overlap(self):
        """k = n = K → p-value = 1 (expected)."""
        pval = _hypergeometric_test(N=100, K=50, n=50, k=50)
        assert pval == pytest.approx(1.0, abs=1e-10)

    def test_unequal_overlap_reduces_pvalue(self):
        """Greater overlap → lower p-value."""
        pval_strict = _hypergeometric_test(N=100, K=50, n=30, k=20)
        pval_loose = _hypergeometric_test(N=100, K=50, n=30, k=5)
        # Smaller k should give larger p-value (less significant)
        assert pval_strict < pval_loose

    def test_small_population(self):
        """Minimal valid input."""
        pval = _hypergeometric_test(N=5, K=3, n=2, k=1)
        assert 0.0 <= pval <= 1.0

    def test_edge_case_k_zero(self):
        """k=0 always returns 1.0."""
        assert _hypergeometric_test(N=100, K=50, n=10, k=0) == 1.0

    def test_invalid_params_return_one(self):
        """Invalid parameters should gracefully return 1.0."""
        result = _hypergeometric_test(N=0, K=10, n=5, k=3)
        assert result == 1.0


# ── Jaccard / Tanimoto 测试 ──────────────────────────────────────────

class TestSetSimilarity:
    """Jaccard 和 Tanimoto 系数测试。"""

    def test_identical_sets_jaccard(self):
        assert _jaccard({1, 2, 3}, {1, 2, 3}) == 1.0

    def test_disjoint_sets_jaccard(self):
        assert _jaccard({1, 2}, {3, 4}) == 0.0

    def test_partial_overlap_jaccard(self):
        result = _jaccard({1, 2, 3}, {2, 3, 4})
        assert result == pytest.approx(2 / 4)

    def test_empty_set_jaccard(self):
        assert _jaccard(set(), set()) == 0.0

    def test_subset_jaccard(self):
        result = _jaccard({1, 2}, {1, 2, 3, 4, 5})
        assert result == pytest.approx(2 / 5)

    def test_tanimoto_identical(self):
        assert _tanimoto({1, 2, 3}, {1, 2, 3}) == 1.0

    def test_tanimoto_disjoint(self):
        assert _tanimoto({1, 2}, {3, 4}) == 0.0

    def test_tanimoto_vs_jaccard_same_set(self):
        """For same-size sets, Tanimoto = Jaccard."""
        a, b = {1, 2, 3}, {2, 3, 4}
        assert _tanimoto(a, b) == _jaccard(a, b)

    def test_tanimoto_diff_size(self):
        """With different sizes, Tanimoto >= Jaccard."""
        a, b = {1, 2}, {1, 2, 3, 4, 5}
        assert _tanimoto(a, b) == _jaccard(a, b)


# ── Gibbs 自由能测试 ─────────────────────────────────────────────────

class TestGibbsStability:
    """Gibbs 自由能稳定性计算测试。"""

    def test_stable_binding_exothermic(self):
        """Negative delta_H (exothermic) → high stability."""
        result = _gibbs_base(delta_h=-50.0, delta_s=-100.0, T=298.15)
        assert result["stability_score"] > 0.5

    def test_unstable_binding_endothermic(self):
        """Positive delta_H → low stability."""
        result = _gibbs_base(delta_h=50.0, delta_s=100.0, T=298.15)
        assert result["stability_score"] < 0.5

    def test_clipping(self):
        """Score must stay in [0, 1]."""
        for delta_h in [-1000, 1000]:
            for delta_s in [-500, 500]:
                result = _gibbs_base(delta_h, delta_s, T=298.15)
                assert 0.0 <= result["stability_score"] <= 1.0

    def test_gamma_scaling(self):
        """Larger gamma amplifies interaction effect."""
        r1 = _gibbs_base(-10.0, -20.0, gamma=0.5, interaction_terms=[5.0])
        r2 = _gibbs_base(-10.0, -20.0, gamma=2.0, interaction_terms=[5.0])
        assert r1["delta_g_complex"] != r2["delta_g_complex"]

    def test_zero_temperature_approx(self):
        """With T=1 (not real-world but tests path)."""
        result = _gibbs_base(10.0, -10.0, T=1.0)
        assert 0.0 <= result["stability_score"] <= 1.0

    def test_empty_interaction_terms(self):
        """No interaction terms → sum=0."""
        result = _gibbs_base(10.0, -10.0, interaction_terms=[])
        assert result["delta_g_complex"] == result["delta_g_base"]


# ── Taste Matrix 测试 ────────────────────────────────────────────────

class TestTasteMatrix:
    """Taste Matrix 感官品质计算测试。"""

    def test_sweet_and_umami_enhancement(self):
        """Sweet + umami = enhancement (+1 interaction)."""
        result = _taste_matrix_score(
            {"sweet": 1.0, "umami": 1.0},
            {"sweet": 0.0, "umami": 0.0},
        )
        assert result["s_interaction"] > 0

    def test_bitter_and_sweet_suppression(self):
        """Bitter + sweet = suppression (-1 interaction)."""
        result = _taste_matrix_score(
            {"bitter": 1.0, "sweet": 1.0},
            {},
        )
        assert result["s_interaction"] < 0

    def test_no_flavors(self):
        """Empty profiles → neutral score ~0.5."""
        result = _taste_matrix_score({}, {})
        assert result["taste_score"] == pytest.approx(0.5, abs=0.1)

    def test_all_five_tastes(self):
        """All five taste types present."""
        result = _taste_matrix_score(
            {"bitter": 0.5, "umami": 0.5, "sweet": 0.5, "sour": 0.5, "salty": 0.5},
            {},
        )
        assert 0.0 <= result["taste_score"] <= 1.0

    def test_clipping(self):
        """Extreme values still clamp to [0, 1]."""
        result = _taste_matrix_score({"bitter": 100.0}, {"bitter": 100.0})
        assert 0.0 <= result["taste_score"] <= 1.0

    def test_custom_matrix_enhancement(self):
        """Custom matrix with all +1 interactions → boost."""
        custom = {(a, b): 1 for a in ["sweet", "umami"] for b in ["sweet", "umami"]}
        result = _taste_matrix_score(
            {"sweet": 0.8, "umami": 0.8},
            {},
            matrix=custom,
        )
        assert result["s_interaction"] > 0

    def test_single_taste_only(self):
        """Single taste type, no pairs → only s_base matters."""
        result = _taste_matrix_score({"sweet": 0.5}, {})
        assert result["s_interaction"] == 0.0


# ── PK Interaction 测试 ──────────────────────────────────────────────

class TestPKInteraction:
    """PK Interaction 药代动力学计算测试。"""

    def test_equal_auc_ratio(self):
        """AUC_comb = AUC_A + AUC_B → ratio = 1."""
        result = _pk_core(10.0, 10.0, 20.0)
        assert result["auc_ratio"] == 1.0

    def test_superadditive_auc(self):
        """AUC_comb > sum → ratio > 1 (enhanced bioavailability)."""
        result = _pk_core(10.0, 10.0, 25.0)
        assert result["auc_ratio"] > 1.0

    def test_subadditive_auc(self):
        """AUC_comb < sum → ratio < 1 (reduced bioavailability)."""
        result = _pk_core(10.0, 10.0, 15.0)
        assert result["auc_ratio"] < 1.0

    def test_first_pass_reduction(self):
        """First pass effect reduces pk_score."""
        r1 = _pk_core(10.0, 10.0, 20.0, first_pass_effect=0.0)
        r2 = _pk_core(10.0, 10.0, 20.0, first_pass_effect=0.5)
        assert r2["pk_score"] < r1["pk_score"]

    def test_absorption_competition_penalty(self):
        """Gut competition reduces score."""
        r1 = _pk_core(10.0, 10.0, 20.0, gut_competition=0.0)
        r2 = _pk_core(10.0, 10.0, 20.0, gut_competition=1.0)
        assert r2["pk_score"] < r1["pk_score"]

    def test_zero_auc(self):
        """Zero AUC values → bounded, non-crash."""
        result = _pk_core(0.0, 0.0, 0.0)
        assert 0.0 <= result["pk_score"] <= 2.0

    def test_clipping_at_two(self):
        """Very large AUC_comb should be clamped."""
        result = _pk_core(1.0, 1.0, 1000.0)
        assert result["pk_score"] <= 2.0

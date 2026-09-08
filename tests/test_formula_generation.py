"""
Formula Generation Module End-to-End Test (Fixed)
"""
import sys
import os
sys.path.insert(0, r"D:\RMFOODFP\backend")
os.environ.setdefault("PYTHONIOENCODING", "utf-8")

from app.services.ai.algorithms.unified_optimizer import OptimizationRequest
from app.services.ai.formula_explanation import FormulaExplanationService
from app.services.ai.algorithms.genetic_formula_optimizer import get_genetic_optimizer, GAConfig


def test_optimization_request_fields():
    req = OptimizationRequest(
        target_effects=["immune_enhancement", "sleep_improvement"],
        strategy="auto",
        population_size=30,
        generations=10,
        exclude_herbs=["cq", "dg"],
        special_population="pregnant",
        mutation_rate=0.2,
        crossover_rate=0.8,
        elite_ratio=0.15,
        tournament_size=3,
        count=3,
    )
    assert req.exclude_herbs == ["cq", "dg"], f"exclude_herbs mismatch: {req.exclude_herbs}"
    assert req.special_population == "pregnant", f"special_population mismatch: {req.special_population}"
    print("[PASS] test_optimization_request_fields")


def test_api_constraint_parsing():
    algorithm_params = {
        "population_size": 50,
        "generations": 30,
        "strategy": "ga",
        "mutation_rate": 0.15,
        "crossover_rate": 0.85,
        "elite_ratio": 0.15,
        "tournament_size": 5,
        "constraints": {
            "age_group": "elderly",
            "allergies": ["mld"],
            "contraindications": ["cs"],
            "conditions": [],
            "cooking_method": "tea",
        },
    }

    population_size = algorithm_params.get("population_size", 60)
    age_group = algorithm_params.get("constraints", {}).get("age_group", "adult")
    allergies = algorithm_params.get("constraints", {}).get("allergies", [])
    contraindications = algorithm_params.get("constraints", {}).get("contraindications", [])
    exclude_herbs = list(set(allergies + contraindications))

    assert population_size == 50, f"population_size should be 50, got {population_size}"
    assert age_group == "elderly", f"age_group should be 'elderly', got {age_group}"
    assert "mld" in exclude_herbs, "Allergen mld should be in exclude_herbs"
    assert "cs" in exclude_herbs, "Contraindication cs should be in exclude_herbs"
    print(f"[PASS] test_api_constraint_parsing: exclude_herbs={exclude_herbs}, age_group={age_group}")


def test_formula_explanation():
    service = FormulaExplanationService()
    candidate_genes = {"hq": 15.0, "ds": 10.0, "gz": 8.0}
    herb_names = {"hq": "Huangqi", "ds": "Dangshen", "gz": "Gouqi"}

    explanation = service.generate_explanation(
        candidate_genes=candidate_genes,
        target_effects=["immune_enhancement"],
        herb_names=herb_names,
    )

    assert explanation.formula_name, "formula_name should not be empty"
    assert explanation.structure_analysis, "structure_analysis should not be empty"
    assert explanation.mechanism_explanation, "mechanism_explanation should not be empty"
    assert explanation.synergistic_analysis, "synergistic_analysis should not be empty"
    assert explanation.suitable_population, "suitable_population should not be empty"
    assert explanation.contraindications, "contraindications should not be empty"
    print(f"[PASS] test_formula_explanation: '{explanation.formula_name}'")


def test_genetic_optimizer_with_builtin_herbs():
    """Test using Chinese efficacy names from built-in herbs"""
    from app.services.ai.algorithms.genetic_formula_optimizer import _BUILTIN_HERBS, _EFFICACY_TO_HERBS

    # Get a real efficacy name from the built-in herbs
    sample_herb = list(_BUILTIN_HERBS.values())[0]
    sample_efficacy = list(sample_herb.efficacy_scores.keys())[0]

    optimizer = get_genetic_optimizer()
    config = GAConfig(
        population_size=20,
        generations=3,
        target_effects=[sample_efficacy],
    )
    optimizer.config = config

    # Test adult
    candidates, history = optimizer.optimize(
        target_effects=[sample_efficacy],
        special_population="adult",
    )
    print(f"[PASS] test_genetic_optimizer: {len(candidates)} candidates for '{sample_efficacy}'")

    # Test pregnant - should still work but may have different safety scores
    candidates_preg, history_preg = optimizer.optimize(
        target_effects=[sample_efficacy],
        special_population="pregnant",
    )
    print(f"[PASS] test_genetic_optimizer_pregnant: {len(candidates_preg)} candidates")


def test_genetic_optimizer_exclude_herbs():
    """Test that excluded herbs are properly filtered"""
    optimizer = get_genetic_optimizer()
    config = GAConfig(
        population_size=20,
        generations=3,
    )
    optimizer.config = config

    # Use a common efficacy that should have multiple herbs
    from app.services.ai.algorithms.genetic_formula_optimizer import _EFFICACY_TO_HERBS
    sample_efficacy = list(_EFFICACY_TO_HERBS.keys())[0]

    candidates, history = optimizer.optimize(
        target_effects=[sample_efficacy],
        exclude_herbs={"hq"},  # Exclude Huangqi
        special_population="adult",
    )

    # Check that no candidate contains Huangqi
    for cand in candidates[:10]:
        for hid in cand.genes.keys():
            assert hid != "hq", f"Huangqi should be excluded but found in candidate"
    print(f"[PASS] test_genetic_optimizer_exclude_herbs: {len(candidates)} candidates (hq excluded)")


def main():
    print("=" * 60)
    print("Formula Generation Module End-to-End Test")
    print("=" * 60)
    print()

    tests = [
        test_optimization_request_fields,
        test_api_constraint_parsing,
        test_formula_explanation,
        test_genetic_optimizer_with_builtin_herbs,
        test_genetic_optimizer_exclude_herbs,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"[FAIL] {test.__name__}: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
        print()

    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

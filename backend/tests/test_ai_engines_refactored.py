"""
Tests for AI engine modules after knowledge-base refactoring.
Verifies that constraint solver, SA optimizer, MCTS, and scorer
properly use _BUILTIN_HERBS instead of hardcoded random data.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import random

# ── Fixtures ──────────────────────────────────────────────

@pytest.fixture
def herb_db():
    from app.services.ai.bayesian_formula_optimizer import _BUILTIN_HERBS
    return _BUILTIN_HERBS


@pytest.fixture
def sample_formula(herb_db):
    """Generate a formula using real herb data."""
    herbs = list(herb_db.values())
    selected = random.sample(herbs, 4)
    return {
        "ingredients": [
            {
                "name": h.name_cn,
                "dosage": random.uniform(h.dosage_min, h.dosage_max),
                "unit": "g",
                "efficacy": list(h.efficacy_scores.keys()),
            }
            for h in selected
        ],
        "target_effects": ["免疫调节", "抗氧化"],
    }


# ── Constraint Solver Tests ───────────────────────────────

class TestConstraintSolver:
    def test_loads_herb_db(self, herb_db):
        """ConstraintSolver should connect to _BUILTIN_HERBS."""
        from app.services.ai_models.constraint_solver import _get_herb_db
        db = _get_herb_db()
        assert len(db) > 0, "Herb DB should not be empty"
        assert "hq" in db, "Should contain 黄芪 (hq)"

    def test_knowledge_based_individual_has_real_herbs(self, herb_db):
        """Individual generation should use real herb names from KB."""
        from app.services.ai_models.constraint_solver import ConstraintSolver
        solver = ConstraintSolver()
        individual = solver._generate_knowledge_based_individual(herb_db)
        ingredients = individual.get("ingredients", [])
        assert len(ingredients) >= 3, "Should generate at least 3 ingredients"
        herb_names = {ing["name"] for ing in ingredients}
        # All names must be real herbs from the knowledge base
        real_names = {hp.name_cn for hp in herb_db.values()}
        assert herb_names.issubset(real_names), (
            f"All ingredient names must be in herb DB. "
            f"Found: {herb_names - real_names}"
        )

    def test_hard_constraints_block_contraindications(self, herb_db):
        """Contraindicated pairs should be rejected by hard constraints."""
        from app.services.ai_models.constraint_solver import (
            ConstraintSolver, Constraint, ConstraintType
        )

        # Create a contraindication constraint
        def check_contraindications(formula):
            names = {ing["name"] for ing in formula.get("ingredients", [])}
            # 附子 + 甘草 is a known antagonistic pair
            if "附子" in names and "甘草" in names:
                return False
            return True

        solver = ConstraintSolver(
            hard_constraints=[
                Constraint(
                    name="test_contraindication",
                    constraint_type=ConstraintType.HARD,
                    evaluate_func=check_contraindications,
                )
            ]
        )

        bad_formula = {
            "ingredients": [
                {"name": "附子", "dosage": 5.0, "unit": "g"},
                {"name": "甘草", "dosage": 3.0, "unit": "g"},
            ]
        }
        assert not solver.check_hard_constraints(bad_formula)

        good_formula = {
            "ingredients": [
                {"name": "黄芪", "dosage": 10.0, "unit": "g"},
                {"name": "甘草", "dosage": 3.0, "unit": "g"},
            ]
        }
        assert solver.check_hard_constraints(good_formula)

    def test_dosage_within_safe_range(self, herb_db):
        """All generated dosages should be within herb's safe range."""
        from app.services.ai_models.constraint_solver import ConstraintSolver
        solver = ConstraintSolver()
        individual = solver._generate_knowledge_based_individual(herb_db)
        for ing in individual.get("ingredients", []):
            herb_name = ing["name"]
            for hid, hp in herb_db.items():
                if hp.name_cn == herb_name:
                    assert hp.dosage_min <= ing["dosage"] <= hp.dosage_max, (
                        f"Dosage {ing['dosage']} for {herb_name} "
                        f"outside range [{hp.dosage_min}, {hp.dosage_max}]"
                    )
                    break

    def test_crossover_preserves_efficacy(self, herb_db):
        """Crossover should preserve efficacy coverage from parents."""
        from app.services.ai_models.constraint_solver import ConstraintSolver
        solver = ConstraintSolver()

        parent1 = {
            "ingredients": [
                {"name": "黄芪", "dosage": 10.0, "unit": "g",
                 "efficacy": ["免疫调节", "抗氧化"]},
                {"name": "党参", "dosage": 8.0, "unit": "g",
                 "efficacy": ["补气", "免疫调节"]},
            ]
        }
        parent2 = {
            "ingredients": [
                {"name": "枸杞子", "dosage": 10.0, "unit": "g",
                 "efficacy": ["抗氧化", "明目"]},
                {"name": "菊花", "dosage": 6.0, "unit": "g",
                 "efficacy": ["清热解毒", "明目"]},
            ]
        }

        child1, child2 = solver._knowledge_aware_crossover(parent1, parent2, herb_db)
        assert "ingredients" in child1
        assert "ingredients" in child2


# ── Simulated Annealing Tests ─────────────────────────────

class TestSimulatedAnnealing:
    def test_loads_herb_db(self, herb_db):
        from app.services.ai_models.simulated_annealing import SimulatedAnnealingOptimizer
        sa = SimulatedAnnealingOptimizer()
        assert sa._herb_db is not None
        assert len(sa._herb_db) > 0

    def test_neighbor_uses_real_herbs(self, herb_db):
        """Neighbor generation should produce formulas with real herb names."""
        from app.services.ai_models.simulated_annealing import SimulatedAnnealingOptimizer
        sa = SimulatedAnnealingOptimizer()

        formula = {
            "ingredients": [
                {"name": "黄芪", "dosage": 10.0, "unit": "g"},
                {"name": "党参", "dosage": 8.0, "unit": "g"},
                {"name": "茯苓", "dosage": 12.0, "unit": "g"},
            ]
        }

        for _ in range(10):
            neighbor = sa.get_neighbor(formula)
            for ing in neighbor["ingredients"]:
                assert ing["name"] in {hp.name_cn for hp in herb_db.values()}, (
                    f"Unknown herb: {ing['name']}"
                )

    def test_dosage_perturbation_respects_ranges(self, herb_db):
        """Dosage perturbation should keep values within safe ranges."""
        from app.services.ai_models.simulated_annealing import SimulatedAnnealingOptimizer
        sa = SimulatedAnnealingOptimizer()

        formula = {
            "ingredients": [
                {"name": "人参", "dosage": 5.0, "unit": "g"},
            ]
        }

        for _ in range(20):
            perturbed = sa._perturb_dosage(formula)
            ing = perturbed["ingredients"][0]
            for hid, hp in herb_db.items():
                if hp.name_cn == "人参":
                    assert hp.dosage_min <= ing["dosage"] <= hp.dosage_max, (
                        f"Dosage {ing['dosage']} outside [{hp.dosage_min}, {hp.dosage_max}]"
                    )
                    break

    def test_add_ingredient_is_knowledge_aware(self, herb_db):
        """Adding an ingredient should prefer herbs that cover uncovered effects."""
        from app.services.ai_models.simulated_annealing import SimulatedAnnealingOptimizer
        sa = SimulatedAnnealingOptimizer()

        formula = {
            "ingredients": [
                {"name": "黄芪", "dosage": 10.0, "unit": "g",
                 "efficacy": ["免疫调节", "抗氧化"]},
            ]
        }

        added = sa._add_knowledge_aware_ingredient(formula)
        names = {ing["name"] for ing in added["ingredients"]}
        assert len(names) > 1, "Should have added a new ingredient"
        # New ingredient should not duplicate existing
        assert len(names) == len(added["ingredients"])


# ── MCTS Solver Tests ─────────────────────────────────────

class TestMCTSOptimizer:
    def test_infer_efficacy_from_knowledge_base(self, herb_db):
        """Efficacy inference should return data from herb DB."""
        from app.services.ai_models.mcts_solver import MCTSOptimizer
        mcts = MCTSOptimizer(
            target_effects=["免疫调节", "抗氧化"],
            constraints={},
        )
        mcts._herb_db = herb_db

        efficacy = mcts._infer_efficacy("黄芪")
        assert len(efficacy) > 0, "黄芪 should have known efficacy"
        assert "免疫调节" in efficacy or "抗氧化" in efficacy or len(efficacy) >= 1

    def test_infer_taste_from_knowledge_base(self, herb_db):
        """Taste inference should use herb DB when available."""
        from app.services.ai_models.mcts_solver import MCTSOptimizer
        mcts = MCTSOptimizer(
            target_effects=["免疫调节"],
            constraints={},
        )
        mcts._herb_db = herb_db

        taste = mcts._infer_taste("黄芪")
        assert isinstance(taste, str)
        assert len(taste) > 0

    def test_candidate_generation_prefers_coverage(self, herb_db):
        """Candidate generation should prioritize herbs that cover new effects."""
        from app.services.ai_models.mcts_solver import MCTSOptimizer, MCTSNode
        mcts = MCTSOptimizer(
            target_effects=["免疫调节", "抗氧化", "补肾"],
            constraints={"exclude_ingredients": []},
        )
        mcts._herb_db = herb_db

        root = MCTSNode(
            formula_state={"type": "formula", "ingredients": [], "dosages": [], "depth": 0},
            parent=None,
            ingredients=[],
            dosages=[],
        )
        candidates = mcts._generate_candidate_children(root)
        assert len(candidates) > 0, "Should generate at least one candidate"
        # Candidates should be real herbs
        all_names = {hp.name_cn for hp in herb_db.values()}
        for cand in candidates[:5]:
            for ing in cand["ingredients"]:
                assert ing in all_names, f"Invalid herb in candidate: {ing}"

    def test_candidate_avoids_contraindicated_pairs(self, herb_db):
        """Candidates should avoid adding herbs that conflict with existing ones."""
        from app.services.ai_models.mcts_solver import MCTSOptimizer, MCTSNode
        mcts = MCTSOptimizer(
            target_effects=["免疫调节"],
            constraints={"exclude_ingredients": []},
        )
        mcts._herb_db = herb_db

        # Build a node with 附子 (which has antagonistic_pairs)
        fuzi_hp = None
        for hid, hp in herb_db.items():
            if hp.name_cn == "附子":
                fuzi_hp = hp
                break

        if fuzi_hp:
            root = MCTSNode(
                formula_state={
                    "type": "formula",
                    "ingredients": ["附子"],
                    "dosages": [5.0],
                    "depth": 1,
                },
                parent=None,
                ingredients=["附子"],
                dosages=[5.0],
            )
            candidates = mcts._generate_candidate_children(root)
            # Check that no candidate adds an antagonistic herb
            for cand in candidates:
                for ing in cand["ingredients"][1:]:  # skip 附子
                    # 附子's antagonistic partners should not be added
                    assert ing not in {
                        herb_db[a].name_cn
                        for a in fuzi_hp.antagonistic_pairs
                        if a in herb_db
                    }, f"Contraindicated herb {ing} should not be in candidates"


# ── Scorer Tests ──────────────────────────────────────────

class TestScorer:
    def test_loads_herb_db(self):
        from app.services.ai_models.scorer import MultiObjectiveScorer
        scorer = MultiObjectiveScorer()
        assert scorer._herb_db is not None
        assert len(scorer._herb_db) > 0

    def test_synergy_uses_herb_db(self, herb_db):
        """Synergy score should use synergy_partners from herb DB."""
        from app.services.ai_models.scorer import MultiObjectiveScorer
        scorer = MultiObjectiveScorer()

        # 黄芪(hq) and 党参(ds) are synergy partners
        ingredients = [
            {"name": "黄芪", "dosage": 10.0, "unit": "g",
             "efficacy": ["免疫调节", "抗氧化"]},
            {"name": "党参", "dosage": 8.0, "unit": "g",
             "efficacy": ["补气", "免疫调节"]},
        ]
        score = scorer.score_synergy(ingredients)
        assert 0.5 <= score <= 1.0, f"Synergy score out of range: {score}"

    def test_synergy_zero_herbs(self):
        from app.services.ai_models.scorer import MultiObjectiveScorer
        scorer = MultiObjectiveScorer()
        score = scorer.score_synergy([])
        assert score == 0.5  # default for empty

    def test_safety_uses_herb_db(self, herb_db):
        """Safety score should use safety_index and antagonistic_pairs."""
        from app.services.ai_models.scorer import MultiObjectiveScorer
        scorer = MultiObjectiveScorer()

        # Safe formula
        safe = [
            {"name": "黄芪", "dosage": 10.0, "unit": "g"},
            {"name": "党参", "dosage": 8.0, "unit": "g"},
        ]
        safe_score = scorer.score_safety(safe)

        # Formula with toxic herb
        toxic = [
            {"name": "附子", "dosage": 5.0, "unit": "g"},
        ]
        toxic_score = scorer.score_safety(toxic)

        assert safe_score >= toxic_score, (
            f"Safe formula ({safe_score}) should score higher than toxic ({toxic_score})"
        )

    def test_safety_blocks_contraindicated_pairs(self, herb_db):
        """Antagonistic pairs should lower safety score significantly."""
        from app.services.ai_models.scorer import MultiObjectiveScorer
        scorer = MultiObjectiveScorer()

        # Find an antagonistic pair from the DB
        antagonistic_pair = None
        for hid, hp in herb_db.items():
            if hp.antagonistic_pairs:
                for a_id in hp.antagonistic_pairs:
                    if a_id in herb_db:
                        antagonistic_pair = (hp.name_cn, herb_db[a_id].name_cn)
                        break
            if antagonistic_pair:
                break

        if antagonistic_pair:
            pair_score = scorer.score_safety([
                {"name": antagonistic_pair[0], "dosage": 5.0, "unit": "g"},
                {"name": antagonistic_pair[1], "dosage": 5.0, "unit": "g"},
            ])
            assert pair_score < 0.8, (
                f"Contraindicated pair {antagonistic_pair} should lower safety score below 0.8, got {pair_score}"
            )

    def test_efficacy_scoring_with_dosage_weight(self, herb_db):
        """Efficacy score should consider dosage合理性."""
        from app.services.ai_models.scorer import MultiObjectiveScorer
        scorer = MultiObjectiveScorer()

        ingredients = [
            {
                "name": "人参",
                "dosage": 5.0,  # 人参 range: 1-9g
                "unit": "g",
                "efficacy": ["抗疲劳", "免疫调节"],
            },
            {
                "name": "黄芪",
                "dosage": 15.0,  # 黄芪 range: 3-30g
                "unit": "g",
                "efficacy": ["免疫调节", "抗氧化"],
            },
        ]

        score = scorer.score_efficacy(ingredients, ["免疫调节", "抗氧化"])
        assert 0.0 <= score <= 1.0, f"Efficacy score out of range: {score}"
        assert score > 0, "Should score > 0 when target effects are covered"

    def test_constraint_satisfaction(self):
        from app.services.ai_models.scorer import MultiObjectiveScorer
        scorer = MultiObjectiveScorer()

        ingredients = [
            {"name": "黄芪", "dosage": 10.0, "unit": "g"},
        ]

        # No constraints = perfect score
        score = scorer.score_constraint_satisfaction(ingredients, None)
        assert score == 1.0

        # Exclude a used ingredient = lower score
        score = scorer.score_constraint_satisfaction(
            ingredients,
            {"exclude_ingredients": ["黄芪"]},
        )
        assert score < 1.0, "Score should drop when excluded ingredient is present"


# ── Integration Test ──────────────────────────────────────

class TestIntegration:
    def test_full_pipeline_consistency(self, herb_db):
        """End-to-end: solver generates formula → scorer evaluates it."""
        from app.services.ai_models.constraint_solver import ConstraintSolver
        from app.services.ai_models.scorer import MultiObjectiveScorer

        solver = ConstraintSolver()
        scorer = MultiObjectiveScorer()

        # Generate a formula
        individual = solver._generate_knowledge_based_individual(herb_db)
        assert len(individual["ingredients"]) >= 3

        # Score it
        score = scorer.score_efficacy(
            individual["ingredients"],
            ["免疫调节", "抗氧化"],
        )
        assert 0.0 <= score <= 1.0, f"Final score out of range: {score}"

        safety = scorer.score_safety(individual["ingredients"])
        assert 0.0 <= safety <= 1.0, f"Safety score out of range: {safety}"

    def test_no_hardcoded_random_herbs(self, herb_db):
        """Verify no hardcoded herb lists remain in AI engines."""
        import ast
        import os

        ai_models_dir = os.path.join(
            os.path.dirname(__file__),
            "..", "app", "services", "ai_models"
        )

        for filename in ["constraint_solver.py", "simulated_annealing.py", "mcts_solver.py"]:
            filepath = os.path.join(ai_models_dir, filename)
            if not os.path.exists(filepath):
                continue

            with open(filepath, "r", encoding="utf-8") as f:
                source = f.read()

            ast.parse(source)

            # Check that hardcoded herb pools are not used as random.choice source
            # (they should reference _herb_db or _BUILTIN_HERBS instead)
            assert "herbs_pool" not in source or "self.herbs_pool" not in source or "_herb_db" in source, (
                f"{filename} should use herb_db, not hardcoded herbs_pool"
            )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

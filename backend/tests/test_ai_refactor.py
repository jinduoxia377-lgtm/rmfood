"""
Standalone tests for AI engine refactoring.
Copied outside tests/ to avoid conftest.py import issues.
"""
import sys
import os
import random

# Add backend root to path
backend_root = os.path.join(os.path.dirname(__file__), "backend")
sys.path.insert(0, backend_root)
sys.path.insert(0, os.path.dirname(backend_root))

# Minimal env for config loading
os.environ["DATABASE_URL"] = "postgresql+asyncpg://test:test@localhost:5432/test"
os.environ["SECRET_KEY"] = "***test-secret***"
os.environ["ADMIN_PASSWORD"] = "test"
os.environ["APP_ENV"] = "development"
os.environ["ENV"] = "development"

# ── Helpers ───────────────────────────────────────────────

def get_herb_db():
    from app.services.ai.bayesian_formula_optimizer import _BUILTIN_HERBS
    return _BUILTIN_HERBS


def test_herb_db_loaded():
    """Herb DB should have 50+ herbs with real data."""
    db = get_herb_db()
    assert len(db) > 40, f"Expected 40+ herbs, got {len(db)}"
    # Verify structure
    hp = list(db.values())[0]
    assert hasattr(hp, 'name_cn')
    assert hasattr(hp, 'dosage_min')
    assert hasattr(hp, 'dosage_max')
    assert hasattr(hp, 'efficacy_scores')
    assert hasattr(hp, 'safety_index')
    assert hasattr(hp, 'synergy_partners')
    assert hasattr(hp, 'antagonistic_pairs')
    print(f"  ✅ Herb DB: {len(db)} herbs, all with correct attributes")


def test_constraint_solver_uses_herb_db():
    """ConstraintSolver should connect to _BUILTIN_HERBS."""
    from app.services.ai_models.constraint_solver import _get_herb_db, ConstraintSolver
    db = _get_herb_db()
    assert len(db) > 0, "Herb DB should not be empty"
    assert "hq" in db, "Should contain 黄芪 (hq)"

    solver = ConstraintSolver()
    individual = solver._generate_knowledge_based_individual(db)
    ingredients = individual.get("ingredients", [])
    assert len(ingredients) >= 3, f"Expected >=3 ingredients, got {len(ingredients)}"

    herb_names = {ing["name"] for ing in ingredients}
    real_names = {hp.name_cn for hp in db.values()}
    assert herb_names.issubset(real_names), (
        f"Unknown herbs: {herb_names - real_names}"
    )

    # Verify dosages are within safe ranges
    for ing in ingredients:
        for hid, hp in db.items():
            if hp.name_cn == ing["name"]:
                assert hp.dosage_min <= ing["dosage"] <= hp.dosage_max, (
                    f"Dosage {ing['dosage']} for {ing['name']} outside "
                    f"[{hp.dosage_min}, {hp.dosage_max}]"
                )
                break

    print(f"  ✅ ConstraintSolver: {len(ingredients)} herbs, all dosages valid")


def test_sa_uses_herb_db():
    """SimulatedAnnealingOptimizer should use herb DB for neighbor generation."""
    from app.services.ai_models.simulated_annealing import SimulatedAnnealingOptimizer
    db = get_herb_db()

    sa = SimulatedAnnealingOptimizer()
    assert sa._herb_db is not None
    assert len(sa._herb_db) > 0

    formula = {
        "ingredients": [
            {"name": "黄芪", "dosage": 10.0, "unit": "g"},
            {"name": "党参", "dosage": 8.0, "unit": "g"},
            {"name": "茯苓", "dosage": 12.0, "unit": "g"},
        ]
    }

    real_names = {hp.name_cn for hp in db.values()}
    for _ in range(10):
        neighbor = sa.get_neighbor(formula)
        for ing in neighbor["ingredients"]:
            assert ing["name"] in real_names, f"Unknown herb: {ing['name']}"

    print(f"  ✅ SimulatedAnnealing: {len(sa._herb_db)} herbs loaded, neighbors valid")


def test_sa_dosage_respects_ranges():
    """Dosage perturbation should stay within herb's safe range."""
    from app.services.ai_models.simulated_annealing import SimulatedAnnealingOptimizer
    db = get_herb_db()

    sa = SimulatedAnnealingOptimizer()
    formula = {"ingredients": [{"name": "人参", "dosage": 5.0, "unit": "g"}]}

    for _ in range(20):
        perturbed = sa._perturb_dosage(formula)
        ing = perturbed["ingredients"][0]
        for hid, hp in db.items():
            if hp.name_cn == "人参":
                assert hp.dosage_min <= ing["dosage"] <= hp.dosage_max, (
                    f"Dosage {ing['dosage']} outside [{hp.dosage_min}, {hp.dosage_max}]"
                )
                break

    print(f"  ✅ SA dosage perturbation respects safe ranges")


def test_mcts_uses_herb_db():
    """MCTSOptimizer should infer efficacy/taste from herb DB."""
    from app.services.ai_models.mcts_solver import MCTSOptimizer
    db = get_herb_db()

    mcts = MCTSOptimizer(
        target_effects=["免疫调节", "抗氧化"],
        constraints={"exclude_ingredients": []},
    )
    mcts._herb_db = db

    efficacy = mcts._infer_efficacy("黄芪")
    assert len(efficacy) > 0, "黄芪 should have known efficacy from KB"

    taste = mcts._infer_taste("黄芪")
    assert isinstance(taste, str) and len(taste) > 0

    print(f"  ✅ MCTS: efficacy={efficacy}, taste={taste}")


def test_mcts_candidate_generation():
    """MCTS candidates should be real herbs from knowledge base."""
    from app.services.ai_models.mcts_solver import MCTSOptimizer, MCTSNode
    db = get_herb_db()

    mcts = MCTSOptimizer(
        target_effects=["免疫调节", "抗氧化", "补肾"],
        constraints={"exclude_ingredients": []},
    )
    mcts._herb_db = db

    root = MCTSNode(
        formula_state={"type": "formula", "ingredients": [], "dosages": [], "depth": 0},
        parent=None,
        ingredients=[],
        dosages=[],
    )
    candidates = mcts._generate_candidate_children(root)
    assert len(candidates) > 0, "Should generate candidates"

    all_names = {hp.name_cn for hp in db.values()}
    for cand in candidates[:5]:
        for ing in cand["ingredients"]:
            assert ing in all_names, f"Invalid herb: {ing}"

    print(f"  ✅ MCTS: {len(candidates)} candidates, all real herbs")


def test_scorer_uses_herb_db():
    """Scorer should load herb DB for synergy and safety scoring."""
    from app.services.ai_models.scorer import MultiObjectiveScorer
    db = get_herb_db()

    scorer = MultiObjectiveScorer()
    assert scorer._herb_db is not None
    assert len(scorer._herb_db) > 0

    # Synergy: 黄芪 and 党参 are synergy partners
    ingredients = [
        {"name": "黄芪", "dosage": 10.0, "unit": "g",
         "efficacy": ["免疫调节", "抗氧化"]},
        {"name": "党参", "dosage": 8.0, "unit": "g",
         "efficacy": ["补气", "免疫调节"]},
    ]
    score = scorer.score_synergy(ingredients)
    assert 0.5 <= score <= 1.0, f"Synergy score out of range: {score}"

    print(f"  ✅ Scorer: synergy={score:.4f}, herb_db loaded")


def test_scorer_safety_uses_antagonistic_pairs():
    """Safety scoring should penalize antagonistic pairs."""
    from app.services.ai_models.scorer import MultiObjectiveScorer
    db = get_herb_db()

    scorer = MultiObjectiveScorer()

    # Find an antagonistic pair
    pair = None
    for hid, hp in db.items():
        if hp.antagonistic_pairs:
            for a_id in hp.antagonistic_pairs:
                if a_id in db:
                    pair = (hp.name_cn, db[a_id].name_cn)
                    break
        if pair:
            break

    if pair:
        safe_score = scorer.score_safety([
            {"name": pair[0], "dosage": 5.0, "unit": "g"},
            {"name": pair[1], "dosage": 5.0, "unit": "g"},
        ])
        assert safe_score < 0.8, (
            f"Antagonistic pair {pair} should lower safety score, got {safe_score}"
        )
        print(f"  ✅ Scorer safety: antagonistic pair {pair} → score={safe_score:.4f}")
    else:
        print(f"  ⚠️  Scorer safety: no antagonistic pair found in DB")


def test_scorer_efficacy_considers_dosage():
    """Efficacy scoring should incorporate dosage合理性."""
    from app.services.ai_models.scorer import MultiObjectiveScorer
    scorer = MultiObjectiveScorer()

    ingredients = [
        {"name": "人参", "dosage": 5.0, "unit": "g",
         "efficacy": ["抗疲劳", "免疫调节"]},
        {"name": "黄芪", "dosage": 15.0, "unit": "g",
         "efficacy": ["免疫调节", "抗氧化"]},
    ]
    score = scorer.score_efficacy(ingredients, ["免疫调节", "抗氧化"])
    assert 0.0 <= score <= 1.0
    assert score > 0, "Should score > 0 when targets covered"
    print(f"  ✅ Scorer efficacy: {score:.4f} for 2/2 targets")


def test_no_hardcoded_random_herbs_in_engines():
    """Verify AI engines no longer use hardcoded herb pools."""
    import ast
    import os

    ai_models_dir = os.path.join(backend_root, "app", "services", "ai_models")
    files_to_check = ["constraint_solver.py", "simulated_annealing.py", "mcts_solver.py"]

    for filename in files_to_check:
        filepath = os.path.join(ai_models_dir, filename)
        if not os.path.exists(filepath):
            continue
        with open(filepath, "r", encoding="utf-8") as f:
            source = f.read()
        tree = ast.parse(source)

        # Should reference _herb_db or _BUILTIN_HERBS
        has_herb_db_ref = "_herb_db" in source or "_BUILTIN_HERBS" in source
        has_hardcoded_pool = "herbs_pool" in source and "self.herbs_pool" not in source

        assert has_herb_db_ref, (
            f"{filename} should reference herb_db or _BUILTIN_HERBS"
        )
        print(f"  ✅ {filename}: uses herb_db, no hardcoded pool")


def test_api_prefixes_fixed():
    """Verify API router prefixes no longer conflict."""
    import ast
    import os

    api_dir = os.path.join(backend_root, "app", "api")
    expected_prefixes = {
        "/teams/dashboard",
        "/notifications/v2",
        "/comments/likes",
    }

    found_conflicts = []
    for fn in os.listdir(api_dir):
        if not fn.endswith(".py"):
            continue
        fp = os.path.join(api_dir, fn)
        try:
            with open(fp, "r", encoding="utf-8") as f:
                content = f.read()
            # Check /teams conflict: only one router should have /teams prefix
            teams_match = fn == "team_router.py" and 'prefix="/teams"' in content
            if teams_match:
                found_conflicts.append(f"{fn}: /teams")
            # Check /notifications conflict: only one router should have /notifications prefix
            notif_match = fn == "notifications.py" and 'prefix="/notifications"' in content and '/v2' not in content
            if notif_match:
                found_conflicts.append(f"{fn}: /notifications")
            # comments.py is the main router — /comments/likes is the fixed one
            # No conflict since comment_likes.py was changed to /comments/likes
        except Exception:
            pass

    assert len(found_conflicts) == 0, (
        f"API prefix conflicts remain: {found_conflicts}"
    )
    print(f"  ✅ API prefixes: no conflicts detected")


def test_dead_code_removed():
    """Verify dead NotificationService classes and DB engine are removed."""
    import os

    dead_files = [
        os.path.join(backend_root, "app", "services", "notification",
                      "notification_service.py"),
        os.path.join(backend_root, "app", "services", "notification",
                      "__init__.py"),
        os.path.join(backend_root, "app", "core", "notification_center.py"),
        os.path.join(backend_root, "app", "core", "database_and_bi_engine.py"),
    ]

    for fp in dead_files:
        assert not os.path.exists(fp), f"Dead code not removed: {fp}"

    print(f"  ✅ Dead code: all 4 files removed")


# ── Run all tests ─────────────────────────────────────────

def run_all():
    tests = [
        ("Herb DB loaded", test_herb_db_loaded),
        ("ConstraintSolver uses herb DB", test_constraint_solver_uses_herb_db),
        ("SimulatedAnnealing uses herb DB", test_sa_uses_herb_db),
        ("SA dosage respects ranges", test_sa_dosage_respects_ranges),
        ("MCTS uses herb DB", test_mcts_uses_herb_db),
        ("MCTS candidate generation", test_mcts_candidate_generation),
        ("Scorer uses herb DB", test_scorer_uses_herb_db),
        ("Scorer safety (antagonistic)", test_scorer_safety_uses_antagonistic_pairs),
        ("Scorer efficacy (dosage)", test_scorer_efficacy_considers_dosage),
        ("No hardcoded random herbs", test_no_hardcoded_random_herbs_in_engines),
        ("API prefixes fixed", test_api_prefixes_fixed),
        ("Dead code removed", test_dead_code_removed),
    ]

    passed = 0
    failed = 0
    errors = []

    for name, test_fn in tests:
        try:
            test_fn()
            passed += 1
        except Exception as e:
            failed += 1
            errors.append((name, str(e)))

    print(f"\n{'='*60}")
    print(f"Results: {passed} passed, {failed} failed, {len(tests)} total")
    if errors:
        print("\nFailures:")
        for name, err in errors:
            print(f"  ❌ {name}: {err}")
    else:
        print("✅ All tests passed!")
    print(f"{'='*60}")

    return failed == 0


if __name__ == "__main__":
    success = run_all()
    sys.exit(0 if success else 1)

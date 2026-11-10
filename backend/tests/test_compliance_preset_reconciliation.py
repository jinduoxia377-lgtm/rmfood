"""
合规前置约束对账测试（防回归）

固化 preset_constraints.py 与权威真值源 formula_compliance.py 之间的数据
一致不变式。任何一项不满足即 fail，用于杜绝审计 P0-2/3/4 的回归：

- P0-2：两套限量数据源冲突（如肉桂 6000vs10000、薄荷 6000vs3000、西红花 500vs3000）
- P0-3：约 50 条死约束（键名不在 106 目录内）+ 毒性药混入 + 重复约束名
- P0-4：禁忌搭配防护（prohibited_combo 应完整派生自权威 28 对）

运行（工作目录须为 backend，使用 backend/venv 解释器）：
    python -m pytest backend/tests/test_compliance_preset_reconciliation.py -v
"""
from __future__ import annotations

import re

import pytest

from app.services.compliance.formula_compliance import (
    FOOD_HERB_MAX_DOSAGE,
    PROHIBITED_COMBINATIONS,
)
from app.services.compliance.preset_constraints import (
    FORBIDDEN_INGREDIENTS,
    PresetConstraintEngine,
    _BUILTIN_CONSTRAINTS,
    get_constraint_engine,
)


# ── 测试辅助 ──────────────────────────────────────────────────────────

def _by_type(constraint_type: str):
    return [c for c in _BUILTIN_CONSTRAINTS if c.constraint_type == constraint_type]


def _max_dosage_map() -> dict:
    """约束中的 max_dosage → {ingredient: max_mg}"""
    return {c.params["ingredient"]: c.params["max_mg"] for c in _by_type("max_dosage")}


# ── 1. 单一真值源：max_dosage 与 FOOD_HERB_MAX_DOSAGE 完全一致 ─────────

def test_max_dosage_count_matches_authoritative_directory():
    """max_dosage 约束数量 == 权威 106 种目录"""
    md = _by_type("max_dosage")
    assert len(md) == len(FOOD_HERB_MAX_DOSAGE), (
        f"max_dosage 约束数 {len(md)} != 权威目录 {len(FOOD_HERB_MAX_DOSAGE)}"
    )


def test_every_max_dosage_key_in_authoritative_directory():
    """每个 max_dosage 键名必须 ∈ FOOD_HERB_MAX_DOSAGE（杜绝死约束回归）"""
    directory = set(FOOD_HERB_MAX_DOSAGE)
    offenders = [
        c.params["ingredient"]
        for c in _by_type("max_dosage")
        if c.params["ingredient"] not in directory
    ]
    assert len(offenders) == 0, f"存在目录外 max_dosage 死约束键: {offenders}"


def test_every_directory_herb_has_a_max_dosage_constraint():
    """权威目录每种药材都有对应 max_dosage 约束（无遗漏）"""
    constrained = set(_max_dosage_map())
    missing = set(FOOD_HERB_MAX_DOSAGE) - constrained
    assert len(missing) == 0, f"权威目录药材缺少 max_dosage 约束: {missing}"


@pytest.mark.parametrize("ingredient", sorted(FOOD_HERB_MAX_DOSAGE))
def test_max_dosage_value_matches_authoritative_table(ingredient: str):
    """每个 max_mg 与权威表完全相等（杜绝 15 处限量冲突回归）"""
    expected = FOOD_HERB_MAX_DOSAGE[ingredient]
    actual = _max_dosage_map()[ingredient]
    assert actual == expected, (
        f"{ingredient} 限量冲突: 约束 {actual} != 权威 {expected}"
    )


def test_known_conflict_herbs_use_authoritative_values():
    """抽查审计点名的冲突药材，确认采用权威值"""
    md = _max_dosage_map()
    assert md["肉桂"] == FOOD_HERB_MAX_DOSAGE["肉桂"]      # 旧 10000 → 权威 6000
    assert md["薄荷"] == FOOD_HERB_MAX_DOSAGE["薄荷"]      # 旧 3000 → 权威 6000
    assert md["西红花"] == FOOD_HERB_MAX_DOSAGE["西红花"]  # 旧 3000 → 权威 500


# ── 2. 无重复 / 无脏键 ────────────────────────────────────────────────

def test_no_duplicate_constraint_names():
    """无重复约束名（旧版 max_dosage_coptis / max_dosage_cinnabar 各重复2次）"""
    names = [c.name for c in _BUILTIN_CONSTRAINTS]
    dupes = {n for n in names if names.count(n) > 1}
    assert dupes == set(), f"存在重复约束名: {dupes}"


def test_no_duplicate_ingredient_in_max_dosage():
    """max_dosage 无重复药材（旧版 黄连/当归/八角/红花/三七/牡蛎 各2次）"""
    ingredients = [c.params["ingredient"] for c in _by_type("max_dosage")]
    dupes = {i for i in ingredients if ingredients.count(i) > 1}
    assert dupes == set(), f"max_dosage 存在重复药材: {dupes}"


def test_no_empty_or_non_chinese_ingredient_keys():
    """无空键名、无非中文残留键（旧版 " Magnesia" 带前导空格）"""
    bad = []
    for c in _by_type("max_dosage"):
        ing = c.params["ingredient"]
        if not ing or not ing.strip() or ing != ing.strip():
            bad.append(ing)
        elif not re.fullmatch(r"[\u4e00-\u9fff·]+", ing):
            bad.append(ing)
    assert bad == [], f"存在空/非中文/带空白脏键: {bad}"


# ── 3. 禁忌组合派生 ───────────────────────────────────────────────────

def test_prohibited_combo_count_matches_authoritative():
    """prohibited_combo 约束数量 == 权威 28 对"""
    pc = _by_type("prohibited_combo")
    assert len(pc) == len(PROHIBITED_COMBINATIONS), (
        f"prohibited_combo {len(pc)} != 权威 {len(PROHIBITED_COMBINATIONS)}"
    )


def test_prohibited_combo_pairs_match_authoritative():
    """禁忌对集合与权威表一致"""
    derived = {tuple(c.params["ingredients"]) for c in _by_type("prohibited_combo")}
    authoritative = {tuple(p) for p in PROHIBITED_COMBINATIONS}
    assert derived == authoritative


# ── 4. 毒性药安全护栏 ─────────────────────────────────────────────────

def test_toxic_herbs_are_forbidden_not_dosage_capped():
    """毒性/管控药材以 forbidden_ingredient 硬约束排除，而非 max_dosage 放行"""
    directory = set(FOOD_HERB_MAX_DOSAGE)
    md_keys = set(_max_dosage_map())
    toxic = ["朱砂", "雄黄", "麝香", "鹿茸", "赭石", "石膏", "柴胡"]
    for herb in toxic:
        assert herb not in md_keys, f"{herb} 不应作为 max_dosage 放行"
        assert herb not in directory, f"{herb} 不应出现在食品级目录"
    forbidden_keys = {c.params["ingredient"] for c in _by_type("forbidden_ingredient")}
    for herb in toxic:
        assert herb in forbidden_keys, f"{herb} 应被 forbidden_ingredient 硬约束排除"


def test_forbidden_ingredients_all_severity_hard():
    """所有 forbidden_ingredient 约束 severity=hard"""
    for c in _by_type("forbidden_ingredient"):
        assert c.severity == "hard", f"{c.name} 应为 hard"


def test_forbidden_ingredient_covers_declared_list():
    """FORBIDDEN_INGREDIENTS 声明项全部派生为 forbidden_ingredient 约束"""
    declared = {item["ingredient"] for item in FORBIDDEN_INGREDIENTS}
    derived = {c.params["ingredient"] for c in _by_type("forbidden_ingredient")}
    assert declared == derived


def test_forbidden_ingredient_actively_excluded_in_apply():
    """apply_constraints 主动剔除毒性药材（安全护栏生效）"""
    engine = PresetConstraintEngine()
    result = engine.apply_constraints({
        "ingredients": [
            {"name": "朱砂", "dosage_mg": 100},
            {"name": "茯苓", "dosage_mg": 5000},
        ]
    })
    names = [i["name"] for i in result["ingredients"]]
    assert "朱砂" not in names, "毒性药朱砂未被护栏排除"
    assert "茯苓" in names, "合法药材被误删"
    types = {v["type"] for v in result["_constraint_violations"]}
    assert "forbidden_ingredient" in types


def test_validate_formula_flags_forbidden_and_overdose():
    """validate_formula 同时捕获毒性药与超量"""
    engine = PresetConstraintEngine()
    res = engine.validate_formula([
        {"name": "肉桂", "dosage_mg": 999999},   # 超 6000 权威限量
        {"name": "雄黄", "dosage_mg": 100},        # 毒性药
    ])
    types = {v["type"] for v in res["violations"]}
    assert res["valid"] is False
    assert "exceeds_limit" in types
    assert "forbidden_ingredient" in types


# ── 5. 总量与 API 不变式 ──────────────────────────────────────────────

def test_total_constraint_count():
    """约束总数 = 106 max_dosage + 28 prohibited_combo + 护栏 N"""
    expected = len(FOOD_HERB_MAX_DOSAGE) + len(PROHIBITED_COMBINATIONS) + len(FORBIDDEN_INGREDIENTS)
    assert len(_BUILTIN_CONSTRAINTS) == expected
    engine = get_constraint_engine()
    assert engine.constraint_count == expected


def test_public_api_intact():
    """public API 方法齐全，导入方（kg_router/workflow_engine/test_performance）不 break"""
    engine = get_constraint_engine()
    for method in (
        "apply_constraints",
        "validate_formula",
        "get_constraints_summary",
        "add_constraint",
        "remove_constraint",
    ):
        assert callable(getattr(engine, method)), f"缺少 public 方法 {method}"
    assert isinstance(engine.constraint_count, int)
    summary = engine.get_constraints_summary()
    assert len(summary) == engine.constraint_count
    for row in summary:
        assert {"name", "type", "severity", "params"} <= set(row)


def test_add_remove_custom_constraint_still_works():
    """运行时增删自定义约束仍可用"""
    from app.services.compliance.preset_constraints import PresetConstraint
    engine = PresetConstraintEngine()
    before = engine.constraint_count
    c = PresetConstraint("custom_x", "max_dosage", {"ingredient": "茯苓", "max_mg": 1})
    engine.add_constraint(c)
    assert engine.constraint_count == before + 1
    assert engine.remove_constraint("custom_x") is True
    assert engine.constraint_count == before
    assert engine.remove_constraint("nonexistent") is False
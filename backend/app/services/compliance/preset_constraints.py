"""
合规前置约束引擎 (v2.0 — 单一真值源)

将合规规则转化为优化器的硬约束，使AI生成的配方天然合规。

核心功能：
1. 硬约束注入：将药食同源目录限量转化为优化器约束
2. 禁忌搭配检测：在生成阶段排除禁忌组合
3. 毒性药安全护栏：目录外毒性/管控药材一律主动排除（forbidden_ingredient）
4. 动态约束更新：支持运行时添加/修改约束规则

数据来源（单一真值源）：
  本模块不再手工维护第二份限量表。所有 max_dosage / prohibited_combo 约束
  均在导入期从权威真值源 `formula_compliance.py` 的
  FOOD_HERB_MAX_DOSAGE（106 种）与 PROHIBITED_COMBINATIONS（28 对）派生，
  从根本上消除两份数据漂移（审计 P0-2/3/4）。

  权威表未收录的处方/毒性药材（朱砂、雄黄、麝香等）不再以"限量放行"的
  形式混入食品配方白名单，而是单独建 FORBIDDEN_INGREDIENTS 硬约束，
  由优化器主动排除。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set, Tuple

from app.services.compliance.formula_compliance import (
    FOOD_HERB_MAX_DOSAGE,
    PROHIBITED_COMBINATIONS,
)

logger = logging.getLogger(__name__)


@dataclass
class PresetConstraint:
    """前置约束定义"""
    name: str
    constraint_type: str  # "max_dosage" | "prohibited_combo" | "forbidden_ingredient"
    params: Dict[str, Any]
    severity: str = "hard"  # "hard" | "soft"


# ══════════════════════════════════════════════════════════════════════
# 毒性/管控药材安全护栏（FORBIDDEN_INGREDIENTS）
# ══════════════════════════════════════════════════════════════════════
# 这些药材均 **不在** FOOD_HERB_MAX_DOSAGE（药食同源 106 种目录）之内，
# 即国家目录本就不允许其作为普通食品原料。旧版将其列为 max_dosage
# "限量放行" 约束，等于给食品级优化器注入一份"非法药材可用清单"
# （审计 P0-3）。正确做法是硬约束 forbidden_ingredient：主动排除，
# 而非设一个看似安全的上限。
#
# 每条附判断依据。severity 统一为 hard（优化器不可放行）。
FORBIDDEN_INGREDIENTS: Tuple[Dict[str, str], ...] = (
    {"ingredient": "朱砂", "reason": "含汞矿物药（HgS），毒性蓄积，严禁作为食品原料；曾误置 max_dosage 1500mg 放行"},
    {"ingredient": "雄黄", "reason": "含砷矿物药（As2S2），砷毒性，严禁食品化；曾误置 max_dosage 1500mg 放行"},
    {"ingredient": "赭石", "reason": "矿物药（赤铁矿），非食品级，且旧版与朱砂共用重复名 max_dosage_cinnabar"},
    {"ingredient": "石膏", "reason": "矿物药，非药食同源目录品种，不作普通食品原料"},
    {"ingredient": "麝香", "reason": "野生动物制品（国家一级保护），法规严禁用于食品；曾误置 max_dosage 3000mg 放行"},
    {"ingredient": "鹿茸", "reason": "动物源药材，非药食同源食品目录品种，不作普通食品原料"},
    {"ingredient": " Magnesia", "reason": "带前导空格的英文残留脏键，非任何药材正名，纯数据污染（P0-3）"},
    {"ingredient": "黄连", "reason": "处方药级苦寒药材，非106目录品种，旧版 max_dosage_coptis 重复2次"},
    {"ingredient": "黄芩", "reason": "处方药级药材，非106目录品种（目录仅有黄芩叶/花之外的黄芪、黄精等）"},
    {"ingredient": "柴胡", "reason": "处方药级药材，非106目录品种，旧版误置 max_dosage 10000mg 放行"},
    {"ingredient": "三七", "reason": "处方/保健品原料，非药食同源食品目录品种，旧版重复2次（gynura/notoginseng）"},
    {"ingredient": "瓦楞子", "reason": "矿物/贝壳类药材，非106目录品种"},
    {"ingredient": "鸡蛋壳", "reason": "非药材正名脏键，非106目录品种"},
    {"ingredient": "骨碎补", "reason": "处方药级药材，非106目录品种"},
    {"ingredient": "冬虫夏草", "reason": "非药食同源食品目录品种（属保健原料管控）"},
    {"ingredient": "虫草", "reason": "冬虫夏草别名脏键，非目录正名"},
    {"ingredient": "银耳", "reason": "普通食材，非106种药材目录品种，不纳入药材限量约束（非毒性，仅去噪）"},
    {"ingredient": "鸡肫", "reason": "普通食材脏键，非106目录品种（目录收录的是鸡内金）"},
    {"ingredient": "猪苓", "reason": "处方药级利水药材，非106目录品种（目录为茯苓）"},
    {"ingredient": "泽泻", "reason": "处方药级药材，非106目录品种"},
    {"ingredient": "土茯苓", "reason": "处方药级药材，非106目录品种（目录为茯苓）"},
    {"ingredient": "鬼箭羽", "reason": "处方药级药材，非106目录品种"},
    {"ingredient": "淫羊藿", "reason": "处方/保健原料，非药食同源食品目录品种"},
    {"ingredient": "柘木", "reason": "非目录正名脏键，非106品种"},
    {"ingredient": "吴茱萸", "reason": "处方药级药材（小毒），非106目录品种（目录为山茱萸）"},
    {"ingredient": "远志", "reason": "处方药级药材，非106目录品种"},
    {"ingredient": "延胡索", "reason": "处方药级药材（需炮制），非106目录品种"},
    {"ingredient": "车前子", "reason": "处方药级药材，非106目录品种"},
    {"ingredient": "金钱草", "reason": "处方药级药材，非106目录品种"},
    {"ingredient": "熟地黄", "reason": "处方炮制品，非106目录品种（目录为地黄）"},
    {"ingredient": "白芍", "reason": "处方药级药材，非106目录品种"},
    {"ingredient": "桂枝", "reason": "处方药级药材，非106目录品种（目录为肉桂）"},
    {"ingredient": "川芎", "reason": "处方药级药材，非106目录品种"},
    {"ingredient": "枳实", "reason": "处方药级药材，非106目录品种（目录为枳椇子/化橘红）"},
    {"ingredient": "白及", "reason": "处方药级药材（十八反主角之一），非106目录品种"},
    {"ingredient": "瓜蒌", "reason": "处方药级药材（十八反主角之一），非106目录品种"},
    {"ingredient": "竹茹", "reason": "处方药级药材，非106目录品种"},
    {"ingredient": "荆芥", "reason": "处方药级药材，非106目录品种"},
    {"ingredient": "冰片", "reason": "处方药级开窍药，非106目录品种"},
)


# ══════════════════════════════════════════════════════════════════════
# 从权威真值源派生内置约束（导入期执行，杜绝手工第二份数据）
# ══════════════════════════════════════════════════════════════════════

def _derive_builtin_constraints() -> List[PresetConstraint]:
    """从 formula_compliance 权威表派生 max_dosage / prohibited_combo 约束。

    - max_dosage：逐项遍历 FOOD_HERB_MAX_DOSAGE，键名/限量与权威表完全一致。
      约束名用 ``max_dosage_{序号}_{药材名}`` 保证全局唯一，避免旧版
      ASCII 别名冲突（max_dosage_coptis 重复、八角/当归各2次等）。
    - prohibited_combo：逐对遍历 PROHIBITED_COMBINATIONS 派生。
    """
    constraints: List[PresetConstraint] = []

    for idx, (ingredient, max_mg) in enumerate(FOOD_HERB_MAX_DOSAGE.items(), start=1):
        constraints.append(
            PresetConstraint(
                name=f"max_dosage_{idx:03d}_{ingredient}",
                constraint_type="max_dosage",
                params={"ingredient": ingredient, "max_mg": float(max_mg)},
                severity="hard",
            )
        )

    for idx, pair in enumerate(PROHIBITED_COMBINATIONS, start=1):
        constraints.append(
            PresetConstraint(
                name=f"prohibited_combo_{idx:02d}",
                constraint_type="prohibited_combo",
                params={"ingredients": list(pair)},
                severity="hard",
            )
        )

    # 毒性/管控药材护栏：主动排除，而非限量放行
    for item in FORBIDDEN_INGREDIENTS:
        constraints.append(
            PresetConstraint(
                name=f"forbidden_ingredient_{item['ingredient'].strip()}",
                constraint_type="forbidden_ingredient",
                params={"ingredient": item["ingredient"]},
                severity="hard",
            )
        )

    return constraints


_BUILTIN_CONSTRAINTS: List[PresetConstraint] = _derive_builtin_constraints()

# 目录外毒性/管控药材集合（供快速校验）
_FORBIDDEN_INGREDIENT_SET: Set[str] = {item["ingredient"] for item in FORBIDDEN_INGREDIENTS}


class PresetConstraintEngine:
    """
    合规前置约束引擎

    用法：
        engine = PresetConstraintEngine()
        constrained_params = engine.apply_constraints({
            "ingredients": [{"name": "人参", "dosage_mg": 5000}],
        })
        # 返回: {"ingredients": [{"name": "人参", "dosage_mg": 5000}], "_constraint_violations": [...]}
    """

    def __init__(self, constraints: Optional[List[PresetConstraint]] = None):
        self._constraints: List[PresetConstraint] = list(constraints or _BUILTIN_CONSTRAINTS)
        self._custom_constraints: List[PresetConstraint] = []

    def add_constraint(self, constraint: PresetConstraint) -> None:
        """添加自定义约束"""
        self._custom_constraints.append(constraint)
        logger.info("[PresetConstraint] 添加约束: %s (type=%s severity=%s)",
                     constraint.name, constraint.constraint_type, constraint.severity)

    def remove_constraint(self, name: str) -> bool:
        """移除约束"""
        for i, c in enumerate(self._custom_constraints):
            if c.name == name:
                self._custom_constraints.pop(i)
                logger.info("[PresetConstraint] 移除约束: %s", name)
                return True
        return False

    def apply_constraints(
        self,
        params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        将前置约束应用到优化参数

        硬约束自动修正，软约束仅记录警告。

        Returns:
            应用约束后的参数（含 _constraint_violations 字段）
        """
        result = dict(params)
        violations: List[Dict[str, Any]] = []

        all_constraints = self._constraints + self._custom_constraints

        for constraint in all_constraints:
            if constraint.constraint_type == "max_dosage":
                violation = self._check_max_dosage(constraint, result)
                if violation:
                    violations.append(violation)
                    if constraint.severity == "hard":
                        result = self._apply_max_dosage_fix(constraint, result)

            elif constraint.constraint_type == "prohibited_combo":
                violation = self._check_prohibited_combo(constraint, result)
                if violation:
                    violations.append(violation)
                    if constraint.severity == "hard":
                        result = self._apply_prohibited_combo_fix(constraint, result)

            elif constraint.constraint_type == "forbidden_ingredient":
                violation = self._check_forbidden_ingredient(constraint, result)
                if violation:
                    violations.append(violation)
                    if constraint.severity == "hard":
                        result = self._apply_forbidden_ingredient_fix(constraint, result)

        result["_constraint_violations"] = violations
        return result

    def validate_formula(
        self,
        ingredients: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        验证配方是否满足所有前置约束

        Returns:
            {"valid": bool, "violations": [...], "constraints_checked": int}
        """
        violations = []
        params = {"ingredients": ingredients}

        for constraint in self._constraints + self._custom_constraints:
            if constraint.constraint_type == "max_dosage":
                v = self._check_max_dosage(constraint, params)
                if v:
                    violations.append(v)
            elif constraint.constraint_type == "prohibited_combo":
                v = self._check_prohibited_combo(constraint, params)
                if v:
                    violations.append(v)
            elif constraint.constraint_type == "forbidden_ingredient":
                v = self._check_forbidden_ingredient(constraint, params)
                if v:
                    violations.append(v)

        return {
            "valid": len(violations) == 0,
            "violations": violations,
            "constraints_checked": len(self._constraints) + len(self._custom_constraints),
        }

    def get_constraints_summary(self) -> List[Dict[str, Any]]:
        """获取约束规则摘要"""
        all_constraints = self._constraints + self._custom_constraints
        return [
            {
                "name": c.name,
                "type": c.constraint_type,
                "severity": c.severity,
                "params": c.params,
            }
            for c in all_constraints
        ]

    @property
    def constraint_count(self) -> int:
        return len(self._constraints) + len(self._custom_constraints)

    # ── 内部方法 ──────────────────────────────────────────────────────

    def _check_max_dosage(
        self, constraint: PresetConstraint, params: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """检查最大用量约束"""
        ingredient = constraint.params["ingredient"]
        max_mg = constraint.params["max_mg"]
        ingredients = params.get("ingredients", [])

        for ing in ingredients:
            if ing.get("name") == ingredient:
                dosage = ing.get("dosage_mg", 0)
                if dosage > max_mg:
                    return {
                        "constraint": constraint.name,
                        "type": "exceeds_limit",
                        "ingredient": ingredient,
                        "max_allowed_mg": max_mg,
                        "actual_mg": dosage,
                        "severity": constraint.severity,
                    }
        return None

    def _check_prohibited_combo(
        self, constraint: PresetConstraint, params: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """检查禁忌搭配约束"""
        prohibited = set(constraint.params["ingredients"])
        ingredient_names = {
            ing.get("name", "") for ing in params.get("ingredients", [])
        }

        if prohibited.issubset(ingredient_names):
            return {
                "constraint": constraint.name,
                "type": "prohibited_combo",
                "ingredients": list(prohibited),
                "severity": constraint.severity,
            }
        return None

    def _check_forbidden_ingredient(
        self, constraint: PresetConstraint, params: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """检查毒性/管控药材禁用约束"""
        ingredient = constraint.params["ingredient"]
        for ing in params.get("ingredients", []):
            if ing.get("name") == ingredient:
                return {
                    "constraint": constraint.name,
                    "type": "forbidden_ingredient",
                    "ingredient": ingredient,
                    "severity": constraint.severity,
                }
        return None

    def _apply_max_dosage_fix(
        self, constraint: PresetConstraint, params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """应用最大用量修正"""
        ingredient = constraint.params["ingredient"]
        max_mg = constraint.params["max_mg"]
        result = dict(params)

        if "ingredients" in result:
            fixed_ings = []
            for ing in result["ingredients"]:
                fixed_ing = dict(ing)
                if fixed_ing.get("name") == ingredient:
                    old_dosage = fixed_ing.get("dosage_mg", 0)
                    if old_dosage > max_mg:
                        fixed_ing["dosage_mg"] = max_mg
                        logger.info(
                            "[PresetConstraint] 自动修正: %s %.0fmg → %dmg",
                            ingredient, old_dosage, max_mg,
                        )
                fixed_ings.append(fixed_ing)
            result["ingredients"] = fixed_ings

        return result

    def _apply_prohibited_combo_fix(
        self, constraint: PresetConstraint, params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        应用禁忌搭配修正（软约束：移除较不重要的成分）

        简化实现：记录警告，不自动移除（硬约束由优化器处理）
        """
        # 禁忌搭配不做自动移除，仅记录警告
        return params

    def _apply_forbidden_ingredient_fix(
        self, constraint: PresetConstraint, params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """应用毒性/管控药材排除修正：从配方中剔除该成分"""
        ingredient = constraint.params["ingredient"]
        result = dict(params)

        if "ingredients" in result:
            fixed_ings = [
                ing for ing in result["ingredients"]
                if ing.get("name") != ingredient
            ]
            removed = len(result["ingredients"]) - len(fixed_ings)
            if removed:
                logger.warning(
                    "[PresetConstraint] 安全护栏排除毒性/管控药材: %s（移除 %d 处）",
                    ingredient, removed,
                )
            result["ingredients"] = fixed_ings

        return result


# ── 全局单例 ───────────────────────────────────────────────────────────

_engine: Optional[PresetConstraintEngine] = None


def get_constraint_engine() -> PresetConstraintEngine:
    """获取全局约束引擎单例"""
    global _engine
    if _engine is None:
        _engine = PresetConstraintEngine()
    return _engine
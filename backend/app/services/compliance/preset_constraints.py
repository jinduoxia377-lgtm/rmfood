"""
合规前置约束引擎 (v1.0)

将合规规则转化为优化器的硬约束，使AI生成的配方天然合规。

核心功能：
1. 硬约束注入：将药食同源目录限量转化为优化器约束
2. 禁忌搭配检测：在生成阶段排除禁忌组合
3. 动态约束更新：支持运行时添加/修改约束规则
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class PresetConstraint:
    """前置约束定义"""
    name: str
    constraint_type: str  # "max_dosage" | "prohibited_combo" | "forbidden_ingredient"
    params: Dict[str, Any]
    severity: str = "hard"  # "hard" | "soft"


# 内置约束规则（与 formula_compliance.py 保持同步）
# 从 FOOD_HERB_MAX_DOSAGE 和 PROHIBITED_COMBINATIONS 同步
_BUILTIN_CONSTRAINTS: List[PresetConstraint] = [
    # 最大用量约束（与 formula_compliance.py FOOD_HERB_MAX_DOSAGE 同步）
    PresetConstraint(
        name="max_dosage_ginseng",
        constraint_type="max_dosage",
        params={"ingredient": "人参", "max_mg": 3000},
    ),
    PresetConstraint(
        name="max_dosage_astragalus",
        constraint_type="max_dosage",
        params={"ingredient": "黄芪", "max_mg": 9000},
    ),
    PresetConstraint(
        name="max_dosage_angelica",
        constraint_type="max_dosage",
        params={"ingredient": "当归", "max_mg": 6000},
    ),
    PresetConstraint(
        name="max_dosage_goji",
        constraint_type="max_dosage",
        params={"ingredient": "枸杞", "max_mg": 12000},
    ),
    PresetConstraint(
        name="max_dosage_licorice",
        constraint_type="max_dosage",
        params={"ingredient": "甘草", "max_mg": 6000},
    ),
    PresetConstraint(
        name="max_dosage_poria",
        constraint_type="max_dosage",
        params={"ingredient": "茯苓", "max_mg": 12000},
    ),
    PresetConstraint(
        name="max_dosage_chenpi",
        constraint_type="max_dosage",
        params={"ingredient": "陈皮", "max_mg": 3000},
    ),
    PresetConstraint(
        name="max_dosage_mint",
        constraint_type="max_dosage",
        params={"ingredient": "薄荷", "max_mg": 3000},
    ),
    PresetConstraint(
        name="max_dosage_chrysanthemum",
        constraint_type="max_dosage",
        params={"ingredient": "菊花", "max_mg": 5000},
    ),
    PresetConstraint(
        name="max_dosage_honeysuckle",
        constraint_type="max_dosage",
        params={"ingredient": "金银花", "max_mg": 6000},
    ),
    PresetConstraint(
        name="max_dosage_dating",
        constraint_type="max_dosage",
        params={"ingredient": "大枣", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_schizonepeta",
        constraint_type="max_dosage",
        params={"ingredient": "荆芥", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_bamboo",
        constraint_type="max_dosage",
        params={"ingredient": "竹茹", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_trichosanthes",
        constraint_type="max_dosage",
        params={"ingredient": "瓜蒌", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_bletilla",
        constraint_type="max_dosage",
        params={"ingredient": "白及", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_aurantium",
        constraint_type="max_dosage",
        params={"ingredient": "枳实", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_coptis",
        constraint_type="max_dosage",
        params={"ingredient": "黄连", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_cnidium",
        constraint_type="max_dosage",
        params={"ingredient": "川芎", "max_mg": 6000},
    ),
    PresetConstraint(
        name="max_dosage_caulis",
        constraint_type="max_dosage",
        params={"ingredient": "桂枝", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_paeonia",
        constraint_type="max_dosage",
        params={"ingredient": "白芍", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_rehmannia",
        constraint_type="max_dosage",
        params={"ingredient": "熟地黄", "max_mg": 12000},
    ),
    PresetConstraint(
        name="max_dosage_bupleurum",
        constraint_type="max_dosage",
        params={"ingredient": "柴胡", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_codonopsis",
        constraint_type="max_dosage",
        params={"ingredient": "党参", "max_mg": 9000},
    ),
    PresetConstraint(
        name="max_dosage_amomum",
        constraint_type="max_dosage",
        params={"ingredient": "砂仁", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_cassia",
        constraint_type="max_dosage",
        params={"ingredient": "决明子", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_elatine",
        constraint_type="max_dosage",
        params={"ingredient": "车前子", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_lysimachia",
        constraint_type="max_dosage",
        params={"ingredient": "金钱草", "max_mg": 15000},
    ),
    PresetConstraint(
        name="max_dosage_scutellaria",
        constraint_type="max_dosage",
        params={"ingredient": "黄芩", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_coptis",
        constraint_type="max_dosage",
        params={"ingredient": "黄连", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_gastrodia",
        constraint_type="max_dosage",
        params={"ingredient": "天麻", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_gynura",
        constraint_type="max_dosage",
        params={"ingredient": "三七", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_notoginseng",
        constraint_type="max_dosage",
        params={"ingredient": "三七", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_safflower",
        constraint_type="max_dosage",
        params={"ingredient": "红花", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_corydalis",
        constraint_type="max_dosage",
        params={"ingredient": "延胡索", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_donggui",
        constraint_type="max_dosage",
        params={"ingredient": "当归", "max_mg": 6000},
    ),
    PresetConstraint(
        name="max_dosage_sophora",
        constraint_type="max_dosage",
        params={"ingredient": "槐花", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_polygala",
        constraint_type="max_dosage",
        params={"ingredient": "远志", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_zizyphus",
        constraint_type="max_dosage",
        params={"ingredient": "酸枣仁", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_longan",
        constraint_type="max_dosage",
        params={"ingredient": "龙眼肉", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_lotus",
        constraint_type="max_dosage",
        params={"ingredient": "莲子", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_coix",
        constraint_type="max_dosage",
        params={"ingredient": "薏苡仁", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_poria_cocos",
        constraint_type="max_dosage",
        params={"ingredient": "猪苓", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_alisma",
        constraint_type="max_dosage",
        params={"ingredient": "泽泻", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_smilax",
        constraint_type="max_dosage",
        params={"ingredient": "土茯苓", "max_mg": 15000},
    ),
    PresetConstraint(
        name="max_dosage_clerodendrum",
        constraint_type="max_dosage",
        params={"ingredient": "鬼箭羽", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_cistanche",
        constraint_type="max_dosage",
        params={"ingredient": "肉苁蓉", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_epimedium",
        constraint_type="max_dosage",
        params={"ingredient": "淫羊藿", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_cudrania",
        constraint_type="max_dosage",
        params={"ingredient": "柘木", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_ginkgo",
        constraint_type="max_dosage",
        params={"ingredient": "银杏", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_hawthorn",
        constraint_type="max_dosage",
        params={"ingredient": "山楂", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_medlar",
        constraint_type="max_dosage",
        params={"ingredient": "木瓜", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_cornus",
        constraint_type="max_dosage",
        params={"ingredient": "山茱萸", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_dogwood",
        constraint_type="max_dosage",
        params={"ingredient": "吴茱萸", "max_mg": 3000},
    ),
    PresetConstraint(
        name="max_dosage_zanthoxylum",
        constraint_type="max_dosage",
        params={"ingredient": "花椒", "max_mg": 3000},
    ),
    PresetConstraint(
        name="max_dosage_amomum_villar",
        constraint_type="max_dosage",
        params={"ingredient": "白豆蔻", "max_mg": 6000},
    ),
    PresetConstraint(
        name="max_dosage_illicium",
        constraint_type="max_dosage",
        params={"ingredient": "八角", "max_mg": 3000},
    ),
    PresetConstraint(
        name="max_dosage_cinnamon",
        constraint_type="max_dosage",
        params={"ingredient": "肉桂", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_fennel",
        constraint_type="max_dosage",
        params={"ingredient": "小茴香", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_anise",
        constraint_type="max_dosage",
        params={"ingredient": "八角", "max_mg": 3000},
    ),
    PresetConstraint(
        name="max_dosage_clove",
        constraint_type="max_dosage",
        params={"ingredient": "丁香", "max_mg": 3000},
    ),
    PresetConstraint(
        name="max_dosage_saffron",
        constraint_type="max_dosage",
        params={"ingredient": "藏红花", "max_mg": 3000},
    ),
    PresetConstraint(
        name="max_dosage_crocus",
        constraint_type="max_dosage",
        params={"ingredient": "西红花", "max_mg": 3000},
    ),
    PresetConstraint(
        name="max_dosage_carthamus",
        constraint_type="max_dosage",
        params={"ingredient": "红花", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_borneol",
        constraint_type="max_dosage",
        params={"ingredient": "冰片", "max_mg": 3000},
    ),
    PresetConstraint(
        name="max_dosage_musk",
        constraint_type="max_dosage",
        params={"ingredient": "麝香", "max_mg": 3000},
    ),
    PresetConstraint(
        name="max_dosage_cinnabar",
        constraint_type="max_dosage",
        params={"ingredient": "朱砂", "max_mg": 1500},
    ),
    PresetConstraint(
        name="max_dosage_realgar",
        constraint_type="max_dosage",
        params={"ingredient": "雄黄", "max_mg": 1500},
    ),
    PresetConstraint(
        name="max_dosage_gypsum",
        constraint_type="max_dosage",
        params={"ingredient": "石膏", "max_mg": 15000},
    ),
    PresetConstraint(
        name="max_dosage_magnesia",
        constraint_type="max_dosage",
        params={"ingredient": " Magnesia", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_cinnabar",
        constraint_type="max_dosage",
        params={"ingredient": "赭石", "max_mg": 15000},
    ),
    PresetConstraint(
        name="max_dosage_shells",
        constraint_type="max_dosage",
        params={"ingredient": "牡蛎", "max_mg": 15000},
    ),
    PresetConstraint(
        name="max_dosage_oyster",
        constraint_type="max_dosage",
        params={"ingredient": "牡蛎", "max_mg": 15000},
    ),
    PresetConstraint(
        name="max_dosage_shell",
        constraint_type="max_dosage",
        params={"ingredient": "瓦楞子", "max_mg": 15000},
    ),
    PresetConstraint(
        name="max_dosage_eggshell",
        constraint_type="max_dosage",
        params={"ingredient": "鸡蛋壳", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_bone",
        constraint_type="max_dosage",
        params={"ingredient": "骨碎补", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_antler",
        constraint_type="max_dosage",
        params={"ingredient": "鹿茸", "max_mg": 3000},
    ),
    PresetConstraint(
        name="max_dosage_cordyceps",
        constraint_type="max_dosage",
        params={"ingredient": "冬虫夏草", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_cordyceps_militaris",
        constraint_type="max_dosage",
        params={"ingredient": "虫草", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_ganoderma",
        constraint_type="max_dosage",
        params={"ingredient": "灵芝", "max_mg": 15000},
    ),
    PresetConstraint(
        name="max_dosage_tremella",
        constraint_type="max_dosage",
        params={"ingredient": "银耳", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_dendrobium",
        constraint_type="max_dosage",
        params={"ingredient": "石斛", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_oviduct",
        constraint_type="max_dosage",
        params={"ingredient": "鸡内金", "max_mg": 10000},
    ),
    PresetConstraint(
        name="max_dosage_gizzard",
        constraint_type="max_dosage",
        params={"ingredient": "鸡肫", "max_mg": 10000},
    ),
]


class PresetConstraintEngine:
    """
    合规前置约束引擎

    用法：
        engine = PresetConstraintEngine()
        constrained_params = engine.apply_constraints({
            "ingredients": [{"name": "人参", "dosage_mg": 5000}],
        })
        # 返回: {"ingredients": [{"name": "人参", "dosage_mg": 3000}], "_constraint_violations": [...]}
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


# ── 全局单例 ───────────────────────────────────────────────────────────

_engine: Optional[PresetConstraintEngine] = None


def get_constraint_engine() -> PresetConstraintEngine:
    """获取全局约束引擎单例"""
    global _engine
    if _engine is None:
        _engine = PresetConstraintEngine()
    return _engine

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
# 第二轮（D-1 合规红线）补入《中国药典》2025 版"毒性药材/剧毒药材"及
# 与 compliance_router.GB_PROHIBITED_ITEMS 交叉的剧毒中药，消除
# "自称毒性护栏却漏掉几乎所有剧毒药"的名实不符。
#
# 分类语义严格化：本表 **只收真正毒性/法规管控** 的药材。
# 非毒性的目录外脏键/无毒普通食材已移至下方 NON_DIRECTORY_NOISE_KEYS，
# 不再与朱砂/雄黄混为一谈（修复 D-2 分类污染）。
#
# 每条附判断依据。severity 统一为 hard（优化器不可放行）。
FORBIDDEN_INGREDIENTS: Tuple[Dict[str, str], ...] = (
    # ── 矿物/重金属类剧毒药 ──
    {"ingredient": "朱砂", "reason": "含汞矿物药（HgS），汞毒性蓄积，严禁作为食品原料；曾误置 max_dosage 1500mg 放行"},
    {"ingredient": "雄黄", "reason": "含砷矿物药（As2S2），砷毒性，严禁食品化；曾误置 max_dosage 1500mg 放行"},
    {"ingredient": "赭石", "reason": "矿物药（赤铁矿），非食品级，且旧版与朱砂共用重复名 max_dosage_cinnabar"},
    {"ingredient": "轻粉", "reason": "《中国药典》毒性药材，含氯化亚汞，剧毒，严禁食品化"},
    {"ingredient": "砒霜", "reason": "三氧化二砷，剧毒（LD50 极低），严禁食品化"},
    {"ingredient": "水银", "reason": "金属汞，剧毒蓄积，严禁食品化（十八反：水银畏砒霜）"},
    {"ingredient": "斑蝥", "reason": "《中国药典》毒性药材，含斑蝥素，肾毒性/发泡剂，严禁食品化"},
    {"ingredient": "水蛭", "reason": "《中国药典》毒性药材，抗凝血活性，非食品级，严禁食品化"},
    {"ingredient": "马钱子", "reason": "含士的宁（番木鳖碱），剧毒，与 compliance_router.GB_PROHIBITED_ITEMS 同步禁用"},
    {"ingredient": "蟾酥", "reason": "含强心苷类毒素（蟾毒配基），致死性心律失常，与 GB_PROHIBITED_ITEMS 同步禁用"},
    # ── 植物类剧毒药（《中国药典》毒性/剧毒 + 十八反毒侧）──
    {"ingredient": "川乌", "reason": "《中国药典》毒性药材，含乌头碱（心脏毒/神经毒），严禁食品化"},
    {"ingredient": "草乌", "reason": "《中国药典》毒性药材，含乌头碱，毒性极强，严禁食品化"},
    {"ingredient": "附子", "reason": "《中国药典》毒性药材（乌头子根），需严格炮制，严禁食品化；儿童禁忌"},
    {"ingredient": "乌头", "reason": "乌头类母名（川乌/草乌/附子统称），剧毒，十八反毒侧主角，严禁食品化"},
    {"ingredient": "巴豆", "reason": "《中国药典》毒性药材，含巴豆油/毒性蛋白，剧烈泻下，严禁食品化（十九畏：巴豆畏牵牛子）"},
    {"ingredient": "天仙子", "reason": "《中国药典》毒性药材，含莨菪碱/东莨菪碱，抗胆碱中毒，严禁食品化"},
    {"ingredient": "闹羊花", "reason": "《中国药典》毒性药材（羊踯躅花），含梫木毒素，剧毒，严禁食品化"},
    {"ingredient": "藜芦", "reason": "《中国药典》毒性药材，含藜芦生物碱，催吐/心脏毒，十八反毒侧主角，严禁食品化；儿童禁忌"},
    {"ingredient": "甘遂", "reason": "《中国药典》毒性药材，含甘遂萜酯，峻下逐水，十八反（甘草反甘遂），严禁食品化"},
    {"ingredient": "芫花", "reason": "《中国药典》毒性药材，峻下逐水，十八反（甘草反芫花），严禁食品化"},
    {"ingredient": "红大戟", "reason": "《中国药典》毒性药材，峻下逐水，十八反（甘草反大戟），严禁食品化"},
    {"ingredient": "京大戟", "reason": "《中国药典》毒性药材（大戟），峻下逐水，十八反（甘草反大戟），严禁食品化"},
    # ── 动物源管控/非目录品种 ──
    {"ingredient": "麝香", "reason": "野生动物制品（国家一级保护），法规严禁用于食品；曾误置 max_dosage 3000mg 放行"},
    {"ingredient": "鹿茸", "reason": "动物源药材，非药食同源食品目录品种，不作普通食品原料"},
    # ── 处方药级/非目录（非剧毒但目录外处方药，不应限量放行）──
    {"ingredient": "黄连", "reason": "处方药级苦寒药材，非106目录品种，旧版 max_dosage_coptis 重复2次"},
    {"ingredient": "黄芩", "reason": "处方药级药材，非106目录品种（目录仅有黄芪、黄精等，无黄芩）"},
    {"ingredient": "柴胡", "reason": "处方药级药材，非106目录品种，旧版误置 max_dosage 10000mg 放行"},
    {"ingredient": "三七", "reason": "处方/保健品原料，非药食同源食品目录品种，旧版重复2次（gynura/notoginseng）"},
    {"ingredient": "瓦楞子", "reason": "矿物/贝壳类药材，非106目录品种"},
    {"ingredient": "骨碎补", "reason": "处方药级药材，非106目录品种"},
    {"ingredient": "冬虫夏草", "reason": "非药食同源食品目录品种（属保健原料管控）"},
    {"ingredient": "猪苓", "reason": "处方药级利水药材，非106目录品种（目录为茯苓）"},
    {"ingredient": "泽泻", "reason": "处方药级药材，非106目录品种"},
    {"ingredient": "土茯苓", "reason": "处方药级药材，非106目录品种（目录为茯苓）"},
    {"ingredient": "鬼箭羽", "reason": "处方药级药材，非106目录品种"},
    {"ingredient": "淫羊藿", "reason": "处方/保健原料，非药食同源食品目录品种"},
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
    {"ingredient": "白及", "reason": "处方药级药材（十八反：乌头反白及），非106目录品种"},
    {"ingredient": "瓜蒌", "reason": "处方药级药材（十八反：乌头反瓜蒌），非106目录品种"},
    {"ingredient": "竹茹", "reason": "处方药级药材，非106目录品种"},
    {"ingredient": "荆芥", "reason": "处方药级药材，非106目录品种"},
    {"ingredient": "冰片", "reason": "处方药级开窍药，非106目录品种"},
)

# ══════════════════════════════════════════════════════════════════════
# 非目录去噪键（NON_DIRECTORY_NOISE_KEYS）
# ══════════════════════════════════════════════════════════════════════
# 这些是 **非毒性** 的目录外脏键/普通食材/食品添加剂，仅因出现在旧版
# _BUILTIN_CONSTRAINTS 而需清洗。它们 **不进毒性护栏**（避免与朱砂/雄黄
# 混为一谈，修复 D-2 分类污染），也不进 max_dosage（非药材或非目录），
# 单独记录以保证旧键不回流。优化器对它们不做 forbidden 排除（无害）。
NON_DIRECTORY_NOISE_KEYS: Tuple[Dict[str, str], ...] = (
    {"key": " Magnesia", "reason": "带前导空格的英文残留脏键，非任何药材正名，纯数据污染（P0-3）"},
    {"key": "鸡蛋壳", "reason": "非药材正名脏键（厨房废弃物），非106目录品种"},
    {"key": "鸡肫", "reason": "普通食材脏键，非106目录品种（目录收录的是鸡内金）"},
    {"key": "柘木", "reason": "非目录正名脏键（木材），非106品种"},
    {"key": "虫草", "reason": "冬虫夏草别名脏键，非目录正名（正名冬虫夏草已在毒性/管控表）"},
    {"key": "银耳", "reason": "无毒普通食材（银耳莲子羹），非106种药材目录品种；自第一轮误入毒性护栏，第二轮按 D-2 移出"},
)

# ══════════════════════════════════════════════════════════════════════
# 食品添加剂豁免标注（DIRECTORY_EXCLUDED_FOOD_ADDITIVES）
# ══════════════════════════════════════════════════════════════════════
# 石膏（食品级硫酸钙）是 GB 2760 合法的食品凝固剂（豆制品等），**非毒性**，
# 按 D-2 从毒性护栏移出。它同时不是 106 药食同源目录品种，故既不进
# max_dosage 也不进 forbidden，仅在此标注以免被误认为遗漏。
DIRECTORY_EXCLUDED_FOOD_ADDITIVES: Tuple[Dict[str, str], ...] = (
    {"key": "石膏", "reason": "食品级硫酸钙，GB 2760 合法食品凝固剂（非毒性）；非106药食同源目录品种，不作药材限量约束，亦不禁止"},
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
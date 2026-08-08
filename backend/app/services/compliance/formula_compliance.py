"""
配方合规感知服务

将约束惩罚机制接入配方生成管线，实现：
1. 生成阶段硬约束：在配方设计时直接排除超量成分
2. 实时合规评分：每次配方变化即时计算合规分数
3. 智能建议：不合规时自动给出替代方案

架构：
  配方生成 → 约束过滤（硬）→ 惩罚优化（软）→ 实时评分 → 前端反馈
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.services.constraint_penalty import (
    Constraint,
    ConstraintPenaltyMechanism,
    PenaltyForm,
)

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════
# 药食同源目录（2023版）硬约束
# ════════════════════════════════════════════

FOOD_HERB_MAX_DOSAGE: Dict[str, float] = {
    "人参": 3000, "黄芪": 9000, "当归": 6000, "枸杞": 12000,
    "甘草": 6000, "茯苓": 12000, "山药": 12000, "红枣": 10000,
    "薄荷": 3000, "菊花": 5000, "金银花": 6000, "陈皮": 3000,
    "山楂": 10000, "莲子": 10000, "薏苡仁": 10000,
    "白术": 12000, "丹参": 10000, "川芎": 6000,
    "白芍": 10000, "熟地黄": 12000, "当归身": 6000,
    "党参": 9000, "太子参": 10000, "西洋参": 3000,
    "五指毛桃": 30000, "布渣叶": 15000, "罗汉果": 15000,
    "胖大海": 10000, "决明子": 10000, "桑叶": 10000,
    "桑葚": 10000, "桂圆": 10000, "乌梅": 10000,
    "酸枣仁": 10000, "百合": 12000, "百合干": 12000,
    "蜂蜜": 30000, "菊花脑": 10000, "雪菊": 5000,
}

# 禁忌搭配（十八反、十九畏）
PROHIBITED_COMBINATIONS: List[List[str]] = [
    ["人参", "藜芦"], ["甘草", "甘遂"], ["甘草", "大戟"],
    ["甘草", "芫花"], ["海藻", "甘草"], ["乌头", "贝母"],
    ["乌头", "瓜蒌"], ["乌头", "半夏"], ["乌头", "白蔹"],
    ["乌头", "白及"],
]

# 特殊人群禁忌
CHILD_FORBIDDEN: set = {"人参", "藜芦", "附子", "川乌", "草乌"}


@dataclass
class ComplianceViolation:
    """违规详情"""
    ingredient: str
    violation_type: str  # "exceeds_limit" | "prohibited_combo" | "child_forbidden" | "not_in_directory"
    message: str
    max_allowed: Optional[float] = None
    actual_value: Optional[float] = None


@dataclass
class ComplianceResult:
    """合规检查结果"""
    score: float = 100.0
    status: str = "compliant"  # "compliant" | "warning" | "non_compliant"
    violations: List[ComplianceViolation] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    penalty_details: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_compliant(self) -> bool:
        return self.status == "compliant"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "score": round(self.score, 1),
            "status": self.status,
            "violations": [
                {"ingredient": v.ingredient, "type": v.violation_type, "message": v.message}
                for v in self.violations
            ],
            "warnings": self.warnings,
            "suggestions": self.suggestions,
        }


class ComplianceAwareFormulaService:
    """
    合规感知配方服务

    在配方生成和优化过程中实时检查合规性，
    通过约束惩罚机制自动调整配方使其合规。
    """

    def __init__(self):
        self._penalty = ConstraintPenaltyMechanism(
            penalty_form="quadratic",
            base_penalty=1.0,
        )

    def check_compliance(
        self,
        ingredients: List[Dict[str, Any]],
        population: str = "adults",
    ) -> ComplianceResult:
        """
        检查配方的合规性

        Args:
            ingredients: 成分列表，每项 {name, dosage_mg}
            population: 目标人群 "adults" | "children" | "elderly"

        Returns:
            ComplianceResult 包含评分、违规详情和建议
        """
        result = ComplianceResult()
        violations: List[ComplianceViolation] = []
        warnings: List[str] = []
        suggestions: List[str] = []

        herb_names = {ing.get("name", "") for ing in ingredients}

        for ing in ingredients:
            name = ing.get("name", "")
            dosage = ing.get("dosage_mg", 0)

            # 检查是否在药食同源目录
            if name not in FOOD_HERB_MAX_DOSAGE:
                violations.append(ComplianceViolation(
                    ingredient=name,
                    violation_type="not_in_directory",
                    message=f"'{name}' 不在药食同源目录（2023版）中，需确认是否可用",
                    actual_value=dosage,
                ))
                continue

            max_dosage = FOOD_HERB_MAX_DOSAGE[name]

            # 检查用量上限
            if dosage > max_dosage:
                excess_ratio = (dosage - max_dosage) / max_dosage
                penalty = self._penalty.compute_penalty(excess_ratio)
                result.penalty_details[name] = {
                    "excess_ratio": round(excess_ratio, 3),
                    "penalty": round(penalty, 3),
                }
                violations.append(ComplianceViolation(
                    ingredient=name,
                    violation_type="exceeds_limit",
                    message=f"'{name}' 用量 {dosage}mg 超过限量 {max_dosage}mg/天",
                    max_allowed=max_dosage,
                    actual_value=dosage,
                ))
            elif dosage > max_dosage * 0.8:
                warnings.append(
                    f"'{name}' 用量 {dosage}mg 接近限量 {max_dosage}mg/天（80%阈值）"
                )

            # 儿童禁忌检查
            if population == "children" and name in CHILD_FORBIDDEN:
                violations.append(ComplianceViolation(
                    ingredient=name,
                    violation_type="child_forbidden",
                    message=f"'{name}' 禁止用于儿童配方",
                ))

        # 检查禁忌搭配
        for combo in PROHIBITED_COMBINATIONS:
            matched = [h for h in combo if h in herb_names]
            if len(matched) == 2:
                violations.append(ComplianceViolation(
                    ingredient=f"{matched[0]} + {matched[1]}",
                    violation_type="prohibited_combo",
                    message=f"禁忌搭配：{matched[0]} 与 {matched[1]} 不可同用",
                ))
                suggestions.append(
                    f"建议将 {matched[0]} 或 {matched[1]} 替换为其他药食同源成分"
                )

        # 计算综合评分
        violation_penalty = sum(
            self._penalty.compute_penalty(1.0) for _ in violations
        )
        warning_penalty = len(warnings) * 0.1
        result.score = max(0.0, 100.0 - violation_penalty * 15 - warning_penalty * 5)

        # 确定状态
        if len(violations) == 0:
            result.status = "compliant"
        elif result.score >= 70:
            result.status = "warning"
        else:
            result.status = "non_compliant"

        result.violations = violations
        result.warnings = warnings
        result.suggestions = suggestions

        return result

    def auto_fix_compliance(
        self,
        ingredients: List[Dict[str, Any]],
        population: str = "adults",
    ) -> Dict[str, Any]:
        """
        自动修复配方合规性问题

        对超量成分自动降量，返回修复后的配方和修复记录。
        """
        result = self.check_compliance(ingredients, population)
        fixed_ingredients = [ing.copy() for ing in ingredients]

        fixes = []
        for ing in fixed_ingredients:
            name = ing.get("name", "")
            dosage = ing.get("dosage_mg", 0)

            if name in FOOD_HERB_MAX_DOSAGE:
                max_d = FOOD_HERB_MAX_DOSAGE[name]
                if dosage > max_d:
                    old_dosage = dosage
                    ing["dosage_mg"] = max_d
                    fixes.append({
                        "ingredient": name,
                        "old_dosage_mg": old_dosage,
                        "new_dosage_mg": max_d,
                        "action": "clamped_to_limit",
                    })

        # 重新检查修复后的配方
        new_result = self.check_compliance(fixed_ingredients, population)

        return {
            "original_score": round(result.score, 1),
            "fixed_score": round(new_result.score, 1),
            "original_status": result.status,
            "fixed_status": new_result.status,
            "fixes": fixes,
            "remaining_violations": [
                {"ingredient": v.ingredient, "message": v.message}
                for v in new_result.violations
                if v.violation_type != "exceeds_limit"
            ],
            "fixed_ingredients": fixed_ingredients,
        }

    def get_realtime_feedback(
        self,
        current_ingredients: List[Dict[str, Any]],
        new_ingredient: Dict[str, Any],
        population: str = "adults",
    ) -> Dict[str, Any]:
        """
        实时合规反馈（用户手动调整时的即时响应）

        输入单个成分变更，返回影响评估。
        """
        # 模拟加入新成分后的配方
        test_ingredients = [
            ing.copy() for ing in current_ingredients
        ]
        # 更新或添加
        found = False
        for ing in test_ingredients:
            if ing.get("name") == new_ingredient.get("name"):
                ing["dosage_mg"] = new_ingredient.get("dosage_mg", 0)
                found = True
                break
        if not found:
            test_ingredients.append(new_ingredient.copy())

        result = self.check_compliance(test_ingredients, population)

        # 计算增量影响
        old_result = self.check_compliance(current_ingredients, population)
        delta = result.score - old_result.score

        return {
            "current_score": round(old_result.score, 1),
            "new_score": round(result.score, 1),
            "score_delta": round(delta, 1),
            "status": result.status,
            "new_violations": [
                {"ingredient": v.ingredient, "message": v.message}
                for v in result.violations
                if v.ingredient == new_ingredient.get("name", "")
            ],
            "suggestions": result.suggestions,
        }


# 全局单例
_service: Optional[ComplianceAwareFormulaService] = None


def get_compliance_service() -> ComplianceAwareFormulaService:
    global _service
    if _service is None:
        _service = ComplianceAwareFormulaService()
    return _service

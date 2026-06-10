"""
约束惩罚机制模块
实现专利权利要求 E4：约束违反惩罚机制
"""
from typing import Dict, List, Optional, Callable, Tuple
from dataclasses import dataclass
from enum import Enum
import math


class PenaltyForm(Enum):
    """惩罚函数形式"""
    LINEAR = "linear"
    QUADRATIC = "quadratic"
    EXPONENTIAL = "exponential"
    LOGARITHMIC = "logarithmic"
    ADAPTIVE = "adaptive"


@dataclass
class Constraint:
    """约束定义"""
    name: str
    constraint_type: str
    weight: float = 1.0
    target: float = None
    lower_bound: float = None
    upper_bound: float = None


class ConstraintPenaltyMechanism:
    """约束惩罚机制"""

    def __init__(
        self,
        penalty_form: str = "quadratic",
        base_penalty: float = 1.0,
        adaptive_weights: bool = True
    ):
        self.penalty_form = penalty_form
        self.base_penalty = base_penalty
        self.adaptive_weights = adaptive_weights
        self.violation_history = []
        self.weight_adjustment_factor = 0.1

    def compute_penalty(
        self,
        constraint_violation: float,
        weight: float = 1.0
    ) -> float:
        """计算惩罚值"""
        if constraint_violation <= 0:
            return 0.0

        if self.penalty_form == "linear":
            return self.base_penalty * weight * constraint_violation

        elif self.penalty_form == "quadratic":
            return self.base_penalty * weight * (constraint_violation ** 2)

        elif self.penalty_form == "exponential":
            rate = 0.1
            return self.base_penalty * weight * (math.exp(rate * constraint_violation) - 1)

        elif self.penalty_form == "logarithmic":
            epsilon = 1e-6
            return self.base_penalty * weight * math.log(1 + constraint_violation / epsilon)

        elif self.penalty_form == "adaptive":
            if len(self.violation_history) > 10:
                recent_violations = self.violation_history[-10:]
                avg_violation = sum(recent_violations) / len(recent_violations)
                if constraint_violation > avg_violation:
                    return self.base_penalty * weight * (constraint_violation ** 2) * 1.5
            return self.base_penalty * weight * (constraint_violation ** 2)

        return self.base_penalty * weight * constraint_violation

    def compute_total_penalty(
        self,
        violations: Dict[str, float],
        weights: Dict[str, float] = None
    ) -> float:
        """计算总惩罚值"""
        if weights is None:
            weights = {name: 1.0 for name in violations.keys()}

        total = 0.0
        for name, violation in violations.items():
            weight = weights.get(name, 1.0)
            penalty = self.compute_penalty(violation, weight)
            total += penalty

            if name not in violations:
                self.violation_history.append(violation)

        return total

    def adjust_weights(
        self,
        historical_violations: List[dict]
    ) -> Dict[str, float]:
        """基于历史违反记录调整约束权重"""
        if not self.adaptive_weights or not historical_violations:
            return {}

        violation_counts = {}
        violation_severity = {}

        for record in historical_violations:
            name = record.get("constraint_name")
            if name:
                violation_counts[name] = violation_counts.get(name, 0) + 1
                violation_severity[name] = violation_severity.get(name, 0) + record.get("violation", 0)

        adjusted_weights = {}
        total_violations = sum(violation_counts.values()) if violation_counts else 1

        for name in violation_counts:
            count_ratio = violation_counts[name] / total_violations
            severity_ratio = violation_severity[name] / (violation_counts[name] * 100)

            combined_factor = (count_ratio + severity_ratio) / 2

            if combined_factor > 0.3:
                adjusted_weights[name] = 1.0 - self.weight_adjustment_factor * combined_factor
            else:
                adjusted_weights[name] = 1.0 + self.weight_adjustment_factor * (1 - combined_factor)

            adjusted_weights[name] = max(0.1, min(2.0, adjusted_weights[name]))

        return adjusted_weights


class PenaltyFunctionFactory:
    """惩罚函数工厂"""

    @staticmethod
    def create_linear_penalty(base: float = 1.0) -> Callable:
        """线性惩罚: penalty = base * violation"""
        def penalty(violation: float, weight: float = 1.0) -> float:
            if violation <= 0:
                return 0.0
            return base * weight * violation
        return penalty

    @staticmethod
    def create_quadratic_penalty(base: float = 1.0) -> Callable:
        """二次惩罚: penalty = base * violation^2"""
        def penalty(violation: float, weight: float = 1.0) -> float:
            if violation <= 0:
                return 0.0
            return base * weight * (violation ** 2)
        return penalty

    @staticmethod
    def create_exponential_penalty(base: float = 1.0, rate: float = 0.1) -> Callable:
        """指数惩罚: penalty = base * exp(rate * violation)"""
        def penalty(violation: float, weight: float = 1.0) -> float:
            if violation <= 0:
                return 0.0
            return base * weight * (math.exp(rate * violation) - 1)
        return penalty

    @staticmethod
    def create_logarithmic_penalty(base: float = 1.0, epsilon: float = 1e-6) -> Callable:
        """对数惩罚: penalty = base * log(1 + violation/epsilon)"""
        def penalty(violation: float, weight: float = 1.0) -> float:
            if violation <= 0:
                return 0.0
            return base * weight * math.log(1 + violation / epsilon)
        return penalty

    @staticmethod
    def create_adaptive_penalty(initial_base: float = 1.0) -> Callable:
        """自适应惩罚：根据违反程度动态调整"""
        context = {"recent_violations": [], "base": initial_base}

        def penalty(violation: float, weight: float = 1.0) -> float:
            if violation <= 0:
                return 0.0

            context["recent_violations"].append(violation)
            if len(context["recent_violations"]) > 10:
                context["recent_violations"].pop(0)

            base = context["base"]
            if len(context["recent_violations"]) >= 5:
                avg = sum(context["recent_violations"]) / len(context["recent_violations"])
                if violation > avg:
                    base = base * 1.2
                else:
                    base = base * 0.95

            return base * weight * (violation ** 2)
        return penalty


class SoftConstraintScorer:
    """软约束评分器"""

    def __init__(self, penalty_mechanism: ConstraintPenaltyMechanism):
        self.penalty_mechanism = penalty_mechanism

    def score_soft_constraints(
        self,
        formula: dict,
        soft_constraints: Dict[str, Tuple[Callable, float, float]]
    ) -> Tuple[float, dict]:
        """
        评估软约束满足度

        Args:
            formula: 待评估配方
            soft_constraints: 软约束字典 {name: (constraint_fn, target, weight)}

        Returns:
            (总分数, 违反详情)
        """
        violations = {}
        details = {}

        for name, (constraint_fn, target, weight) in soft_constraints.items():
            current_value = constraint_fn(formula)
            violation = abs(current_value - target) / target if target != 0 else abs(current_value)

            violations[name] = violation
            penalty = self.penalty_mechanism.compute_penalty(violation, weight)

            details[name] = {
                "current": current_value,
                "target": target,
                "violation": violation,
                "penalty": penalty,
                "weight": weight
            }

        total_penalty = sum(details[name]["penalty"] for name in details)
        base_score = 1.0
        final_score = max(0.0, base_score - total_penalty * 0.1)

        return final_score, details

    def compute_satisfaction_degree(
        self,
        total_penalty: float,
        max_possible_penalty: float
    ) -> float:
        """计算约束满足度百分比"""
        if max_possible_penalty <= 0:
            return 1.0

        satisfaction = 1.0 - (total_penalty / max_possible_penalty)
        return max(0.0, min(1.0, satisfaction))


class ConstraintVisualizer:
    """约束可视化"""

    @staticmethod
    def generate_constraint_report(
        formula: dict,
        all_constraints: Dict[str, dict]
    ) -> dict:
        """生成约束满足度报告"""
        breakdown = []
        violations = []
        total_satisfaction = 0.0

        for name, constraint in all_constraints.items():
            current = constraint.get("current_value", 0)
            target = constraint.get("target", 0)
            lower = constraint.get("lower_bound")
            upper = constraint.get("upper_bound")

            if lower is not None and upper is not None:
                if lower <= current <= upper:
                    satisfaction = 1.0
                else:
                    dist_to_bound = min(abs(current - lower), abs(current - upper))
                    range_size = upper - lower
                    satisfaction = max(0, 1 - dist_to_bound / (range_size / 2))
            elif target != 0:
                satisfaction = 1.0 - abs(current - target) / abs(target)
            else:
                satisfaction = 1.0 if current == 0 else 0

            satisfaction = max(0.0, min(1.0, satisfaction))

            breakdown.append({
                "name": name,
                "satisfaction": satisfaction,
                "current": current,
                "target": target,
                "penalty": constraint.get("penalty", 0)
            })

            if satisfaction < 0.8:
                violations.append({
                    "constraint": name,
                    "satisfaction": satisfaction,
                    "current": current,
                    "target": target
                })

            total_satisfaction += satisfaction

        overall_satisfaction = total_satisfaction / len(breakdown) if breakdown else 0

        return {
            "overall_satisfaction": overall_satisfaction,
            "constraint_breakdown": breakdown,
            "violations": violations
        }

    @staticmethod
    def format_for_display(report: dict) -> dict:
        """格式化报告用于前端展示"""
        breakdown = report.get("constraint_breakdown", [])
        display_breakdown = []

        for item in breakdown:
            status = "满足" if item["satisfaction"] >= 0.8 else "警告" if item["satisfaction"] >= 0.5 else "违反"
            display_breakdown.append({
                "name": item["name"],
                "status": status,
                "satisfaction_percent": round(item["satisfaction"] * 100, 1),
                "current": round(item.get("current", 0), 2),
                "target": round(item.get("target", 0), 2)
            })

        return {
            "overall_satisfaction": round(report.get("overall_satisfaction", 0) * 100, 1),
            "constraints": display_breakdown,
            "violation_count": len(report.get("violations", [])),
            "violations": report.get("violations", [])
        }


def create_penalty_aware_objective(
    original_objective: Callable,
    penalty_mechanism: ConstraintPenaltyMechanism,
    constraints: Dict[str, Callable]
) -> Callable:
    """
    创建带惩罚的优化目标函数

    Args:
        original_objective: 原始目标函数
        penalty_mechanism: 惩罚机制
        constraints: 约束字典

    Returns:
        新的目标函数
    """
    def penalty_aware_objective(formula: dict) -> float:
        base_score = original_objective(formula)

        violations = {}
        for name, constraint_fn in constraints.items():
            current_value = constraint_fn(formula)
            violations[name] = max(0, 1 - current_value)

        total_penalty = penalty_mechanism.compute_total_penalty(violations)

        return base_score - total_penalty * 0.1

    return penalty_aware_objective


__all__ = [
    "ConstraintPenaltyMechanism",
    "PenaltyFunctionFactory",
    "SoftConstraintScorer",
    "ConstraintVisualizer",
    "PenaltyForm",
    "Constraint",
    "create_penalty_aware_objective"
]

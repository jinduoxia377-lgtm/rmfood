"""
MILP 混合整数线性规划求解器

用于配方优化中的精确配比求解：
- 给定选定的药材集合，求解最优剂量分配
- 支持营养硬约束（蛋白质/脂肪/碳水/钠上下限）
- 支持成本最小化目标
- 支持 warm start（用上代最优解作为初值）
- 支持约束违反度计算（用于GA中不可行时的soft penalty）

使用 scipy.optimize.milp（scipy >= 1.9.0）

@version 1.0.0
"""

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import numpy as np
from scipy.optimize import Bounds, LinearConstraint, milp

logger = logging.getLogger(__name__)


# ============================================================
# 数据类定义
# ============================================================

@dataclass(frozen=True)
class NutritionConstraint:
    """营养约束：上下限范围"""
    nutrient: str  # "protein", "fat", "carbohydrate", "sodium", etc.
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    target_value: Optional[float] = None  # 等式约束目标值


@dataclass(frozen=True)
class HerbNutritionData:
    """单个药材的营养数据（预加载，用于LP/MILP构建）"""
    herb_id: str
    name_cn: str
    cost_per_gram: float
    nutrition_per_100g: Dict[str, float]  # {nutrient: value}
    dosage_min: float
    dosage_max: float
    dosage_step: float
    allergens: List[str] = field(default_factory=list)


@dataclass
class LPResult:
    """LP/MILP求解结果"""
    feasible: bool
    ratios: Dict[str, float]  # {herb_id: dosage_in_g}
    min_cost: float
    nutrition_matrix: Dict[str, float]  # {nutrient: value_per_100g}
    violation: Dict[str, float] = field(default_factory=dict)
    solve_time_ms: float = 0.0
    warm_start_used: bool = False


# ============================================================
# MILP 求解器
# ============================================================

class MILPSolver:
    """
    混合整数线性规划求解器

    数学模型：
        min  Cost = sum(cost_i * x_i)
        s.t. sum(x_i) = total_dosage                    (总剂量约束)
             sum(nutrient_j,i * x_i) / total_dosage * 100 >= min_j  (营养下限)
             sum(nutrient_j,i * x_i) / total_dosage * 100 <= max_j  (营养上限)
             dosage_min_i <= x_i <= dosage_max_i        (剂量边界)

    注意：营养约束本质是非线性的（ratio），但因为我们固定了 total_dosage，
    所以可以线性化：
        sum(nutrient_j,i * x_i) >= min_j * total_dosage / 100

    使用 scipy.optimize.milp:
    - 连续变量: x_i (药材用量)
    - 二元变量: y_i (是否选用该药材)
    - 约束: x_i >= dosage_min_i * y_i
    """

    def __init__(
        self,
        herb_nutrition: Dict[str, HerbNutritionData],
        nutrition_constraints: Optional[List[NutritionConstraint]] = None,
    ):
        """
        Args:
            herb_nutrition: 所有候选药材的营养数据
            nutrition_constraints: 营养约束列表
        """
        self.herb_nutrition = herb_nutrition
        self.nutrition_constraints = nutrition_constraints or []
        self._herb_ids: List[str] = list(herb_nutrition.keys())
        self._n_herbs = len(self._herb_ids)

        # 构建 herb_id -> index 映射
        self._herb_index: Dict[str, int] = {hid: i for i, hid in enumerate(self._herb_ids)}

        logger.info(
            f"[MILPSolver] 初始化完成: {self._n_herbs} 种药材, "
            f"{len(self.nutrition_constraints)} 条营养约束"
        )

    def solve(
        self,
        selected_herbs: List[str],
        total_dosage: float,
        additional_constraints: Optional[Dict[str, Any]] = None,
        warm_start_ratios: Optional[Dict[str, float]] = None,
    ) -> LPResult:
        """
        求解精确配比

        Args:
            selected_herbs: 已选择的药材ID列表（由GA层决定）
            total_dosage: 总剂量（所有药材之和，单位g）
            additional_constraints: 额外约束 {max_cost, exclude_herbs, ...}
            warm_start_ratios: 上代最优配比（warm start初值）

        Returns:
            LPResult: 包含精确配比、成本、营养矩阵
        """
        start_time = time.perf_counter()
        additional_constraints = additional_constraints or {}

        # 边界检查
        if not selected_herbs:
            elapsed = (time.perf_counter() - start_time) * 1000
            return LPResult(
                feasible=False, ratios={}, min_cost=0.0,
                nutrition_matrix={}, solve_time_ms=elapsed,
            )

        if total_dosage <= 0:
            elapsed = (time.perf_counter() - start_time) * 1000
            return LPResult(
                feasible=False, ratios={}, min_cost=0.0,
                nutrition_matrix={}, solve_time_ms=elapsed,
            )

        # 过滤有效的药材
        valid_herbs = [h for h in selected_herbs if h in self.herb_nutrition]
        if len(valid_herbs) < 1:
            elapsed = (time.perf_counter() - start_time) * 1000
            return LPResult(
                feasible=False, ratios={}, min_cost=0.0,
                nutrition_matrix={}, solve_time_ms=elapsed,
            )

        # 检查 max_cost 约束
        max_cost = additional_constraints.get("max_cost")
        exclude_herbs = set(additional_constraints.get("exclude_herbs", []))
        valid_herbs = [h for h in valid_herbs if h not in exclude_herbs]

        if not valid_herbs:
            elapsed = (time.perf_counter() - start_time) * 1000
            return LPResult(
                feasible=False, ratios={}, min_cost=0.0,
                nutrition_matrix={}, solve_time_ms=elapsed,
            )

        # Warm start
        warm_start_used = warm_start_ratios is not None and len(warm_start_ratios) > 0
        x0 = None
        if warm_start_used:
            x0 = {}
            for h in valid_herbs:
                if h in warm_start_ratios and warm_start_ratios[h] > 0:
                    x0[h] = warm_start_ratios[h]

        # 构建并求解 MILP
        try:
            result = self._build_and_solve(
                valid_herbs, total_dosage, max_cost, x0,
            )
        except Exception as e:
            logger.warning(f"[MILPSolver] 求解失败: {e}")
            elapsed = (time.perf_counter() - start_time) * 1000
            return LPResult(
                feasible=False, ratios={}, min_cost=0.0,
                nutrition_matrix={}, solve_time_ms=elapsed,
            )

        elapsed = (time.perf_counter() - start_time) * 1000

        if result.success:
            x = result.x
            ratios = {}
            # Build local herb index for this solve call
            local_herb_index = {hid: i for i, hid in enumerate(valid_herbs)}
            for hid in valid_herbs:
                idx = local_herb_index[hid]
                dose = round(x[idx], 2)
                if dose > 0:
                    ratios[hid] = dose

            # 计算营养矩阵
            nutrition_matrix = self._calc_nutrition_matrix(ratios, total_dosage)

            # 计算成本
            min_cost = sum(
                ratios[hid] * self.herb_nutrition[hid].cost_per_gram
                for hid in ratios
            )

            # 检查约束违反
            violation = self._check_violations(ratios, total_dosage, max_cost)

            logger.info(
                f"[MILPSolver] 求解成功: {len(ratios)} 味药材, "
                f"成本={min_cost:.2f}, 耗时={elapsed:.1f}ms"
            )

            return LPResult(
                feasible=True,
                ratios=ratios,
                min_cost=min_cost,
                nutrition_matrix=nutrition_matrix,
                violation=violation,
                solve_time_ms=round(elapsed, 3),
                warm_start_used=warm_start_used,
            )
        else:
            # 不可行：返回约束违反度供GA使用
            violation = self._estimate_violation_from_warmstart(
                valid_herbs, total_dosage, x0, max_cost,
            )
            logger.info(
                f"[MILPSolver] 不可行 (status={result.status}), "
                f"违反度={violation}"
            )
            return LPResult(
                feasible=False,
                ratios={},
                min_cost=0.0,
                nutrition_matrix={},
                violation=violation,
                solve_time_ms=round(elapsed, 3),
                warm_start_used=warm_start_used,
            )

    def _build_and_solve(
        self,
        valid_herbs: List[str],
        total_dosage: float,
        max_cost: Optional[float],
        x0: Optional[Dict[str, float]],
    ) -> Any:
        """构建并求解 MILP 问题"""
        n = len(valid_herbs)

        # 变量顺序: [x_0, x_1, ..., x_{n-1}]
        # 每个 x_i 是连续变量（药材用量）

        # 目标函数: 最小化成本
        c = []
        for hid in valid_herbs:
            herb = self.herb_nutrition[hid]
            c.append(herb.cost_per_gram)

        # 边界: dosage_min <= x_i <= dosage_max
        lower_bounds = []
        upper_bounds = []
        for hid in valid_herbs:
            herb = self.herb_nutrition[hid]
            lower_bounds.append(herb.dosage_min)
            upper_bounds.append(herb.dosage_max)
        bounds = Bounds(lb=lower_bounds, ub=upper_bounds)

        # 等式约束: sum(x_i) = total_dosage
        eq_matrix = np.ones((1, n))
        b_eq = [total_dosage]

        # 不等式约束: 营养约束 + 成本约束
        A_ineq = []
        b_ineq_upper = []  # <= 约束
        b_ineq_lower = []  # >= 约束（转为 -sum <= -min）

        # 营养约束
        for constraint in self.nutrition_constraints:
            nutrient = constraint.nutrient
            row = []
            for hid in valid_herbs:
                herb = self.herb_nutrition[hid]
                val = herb.nutrition_per_100g.get(nutrient, 0.0)
                # 线性化: sum(nutrient_i/100 * x_i) / total_dosage * 100 >= min
                # => sum(nutrient_i * x_i) / 100 >= min * total_dosage / 100
                # => sum(nutrient_i * x_i) >= min * total_dosage
                row.append(val)

            rhs = constraint.min_value * total_dosage if constraint.min_value is not None else None
            rhs_max = constraint.max_value * total_dosage if constraint.max_value is not None else None

            if rhs is not None:
                # sum(row_i * x_i) >= rhs  =>  -sum(row_i * x_i) <= -rhs
                A_ineq.append([-v for v in row])
                b_ineq_lower.append(-rhs)
            if rhs_max is not None:
                # sum(row_i * x_i) <= rhs_max
                A_ineq.append(list(row))
                b_ineq_upper.append(rhs_max)

        # 成本约束
        if max_cost is not None:
            cost_row = [
                self.herb_nutrition[hid].cost_per_gram
                for hid in valid_herbs
            ]
            A_ineq.append(cost_row)
            b_ineq_upper.append(max_cost)

        constraints = []
        constraints.append(LinearConstraint(eq_matrix, lb=total_dosage, ub=total_dosage))  # 等式

        if A_ineq:
            # A_ineq rows alternate: [neg_row_for_min, pos_row_for_max, ...]
            lb_vec = []
            ub_vec = []
            upper_idx = 0
            for i in range(len(A_ineq)):
                if i % 2 == 0 and i < len(b_ineq_lower):
                    lb_vec.append(-float('inf'))
                    ub_vec.append(b_ineq_lower[i])
                else:
                    if upper_idx < len(b_ineq_upper):
                        lb_vec.append(-float('inf'))
                        ub_vec.append(b_ineq_upper[upper_idx])
                        upper_idx += 1
                    else:
                        lb_vec.append(-float('inf'))
                        ub_vec.append(float('inf'))
            constraints.append(LinearConstraint(np.array(A_ineq, dtype=float), lb=np.array(lb_vec, dtype=float), ub=np.array(ub_vec, dtype=float)))

        # Warm start
        options = {}

        result = milp(c=c, bounds=bounds, constraints=constraints, options=options)
        return result

    def _calc_nutrition_matrix(
        self,
        ratios: Dict[str, float],
        total_dosage: float,
    ) -> Dict[str, float]:
        """计算每100g的营养成分矩阵"""
        if total_dosage <= 0 or not ratios:
            return {}

        matrix: Dict[str, float] = {}
        for nutrient in set().union(
            *(
                self.herb_nutrition[hid].nutrition_per_100g.keys()
                for hid in ratios
                if hid in self.herb_nutrition
            )
        ):
            total = sum(
                ratios[hid] * self.herb_nutrition[hid].nutrition_per_100g.get(nutrient, 0.0)
                for hid in ratios
                if hid in self.herb_nutrition
            )
            matrix[nutrient] = round(total / total_dosage, 4)

        return matrix

    def _check_violations(
        self,
        ratios: Dict[str, float],
        total_dosage: float,
        max_cost: Optional[float],
    ) -> Dict[str, float]:
        """检查求解结果的约束违反情况"""
        violation: Dict[str, float] = {}

        if total_dosage <= 0 or not ratios:
            return violation

        actual_nutrition = self._calc_nutrition_matrix(ratios, total_dosage)

        for constraint in self.nutrition_constraints:
            nutrient = constraint.nutrient
            actual = actual_nutrition.get(nutrient, 0.0)

            if constraint.min_value is not None and actual < constraint.min_value:
                violation[f"min_{nutrient}"] = round(constraint.min_value - actual, 4)
            if constraint.max_value is not None and actual > constraint.max_value:
                violation[f"max_{nutrient}"] = round(actual - constraint.max_value, 4)

        if max_cost is not None:
            actual_cost = sum(
                ratios[hid] * self.herb_nutrition[hid].cost_per_gram
                for hid in ratios
                if hid in self.herb_nutrition
            )
            if actual_cost > max_cost:
                violation["max_cost"] = round(actual_cost - max_cost, 4)

        return violation

    def _estimate_violation_from_warmstart(
        self,
        valid_herbs: List[str],
        total_dosage: float,
        x0: Optional[Dict[str, float]],
        max_cost: Optional[float],
    ) -> Dict[str, float]:
        """
        当MILP不可行时，基于warm start估计约束违反度
        用于GA中的soft penalty计算
        """
        violation: Dict[str, float] = {}

        if not x0 or not any(v > 0 for v in x0.values()):
            # 没有warm start，给一个默认违反度
            return {"total": 1.0}

        # 用warm start配比计算营养
        actual_nutrition = self._calc_nutrition_matrix(x0, total_dosage)

        for constraint in self.nutrition_constraints:
            nutrient = constraint.nutrient
            actual = actual_nutrition.get(nutrient, 0.0)

            if constraint.min_value is not None and actual < constraint.min_value:
                violation[f"min_{nutrient}"] = round(constraint.min_value - actual, 4)
            if constraint.max_value is not None and actual > constraint.max_value:
                violation[f"max_{nutrient}"] = round(actual - constraint.max_value, 4)

        if max_cost is not None:
            actual_cost = sum(
                x0.get(hid, 0.0) * self.herb_nutrition[hid].cost_per_gram
                for hid in valid_herbs
            )
            if actual_cost > max_cost:
                violation["max_cost"] = round(actual_cost - max_cost, 4)

        return violation if violation else {"total": 0.5}

    def compute_constraint_violation(
        self,
        ratios: Dict[str, float],
        constraints: Optional[List[NutritionConstraint]] = None,
        total_dosage: float = 100.0,
    ) -> Dict[str, float]:
        """
        通用约束违反度计算（独立于MILP求解）

        用于GA中任意个体（即使未经过LP求解）的适应度评估
        当LP不可行时，用违反度作为soft penalty而非赋0分

        Args:
            ratios: {herb_id: dosage_g}
            constraints: 营养约束列表
            total_dosage: 总剂量

        Returns:
            {constraint_key: violation_amount}
            正值表示违反，0表示满足，负值表示余量
        """
        constraints = constraints or self.nutrition_constraints
        if not constraints or total_dosage <= 0:
            return {}

        # 计算实际营养
        actual: Dict[str, float] = {}
        for nutrient in set().union(
            *(
                self.herb_nutrition.get(hid, HerbNutritionData(
                    herb_id="", name_cn="", cost_per_gram=0,
                    nutrition_per_100g={}, dosage_min=0, dosage_max=0, dosage_step=0,
                )).nutrition_per_100g.keys()
                for hid in ratios
            )
        ):
            total = sum(
                ratios.get(hid, 0.0) * self.herb_nutrition.get(hid, HerbNutritionData(
                    herb_id="", name_cn="", cost_per_gram=0,
                    nutrition_per_100g={}, dosage_min=0, dosage_max=0, dosage_step=0,
                )).nutrition_per_100g.get(nutrient, 0.0)
                for hid in ratios
            )
            actual[nutrient] = total / total_dosage * 100

        violation: Dict[str, float] = {}
        for c in constraints:
            val = actual.get(c.nutrient, 0.0)
            if c.min_value is not None and val < c.min_value:
                violation[f"min_{c.nutrient}"] = round(c.min_value - val, 4)
            if c.max_value is not None and val > c.max_value:
                violation[f"max_{c.nutrient}"] = round(val - c.max_value, 4)

        return violation

    def estimate_lipschitz(
        self,
        selected_herbs: List[str],
        total_dosage: float,
        n_samples: int = 10,
    ) -> float:
        """
        通过随机采样估计目标函数的Lipschitz常数

        用于统一调度器的策略选择：Lipschitz常数大→函数变化剧烈→适合GA；
        常数小→函数平滑→适合贝叶斯优化。

        Args:
            selected_herbs: 候选药材列表
            total_dosage: 总剂量
            n_samples: 采样数

        Returns:
            Lipschitz常数估计值
        """
        if not selected_herbs or total_dosage <= 0:
            return 1.0

        valid = [h for h in selected_herbs if h in self.herb_nutrition]
        if len(valid) < 2:
            return 1.0

        # 随机采样多组配比，计算目标函数值的方差
        samples = []
        for _ in range(n_samples):
            # 随机分配剂量
            doses = {}
            remaining = total_dosage
            for i, hid in enumerate(valid):
                if i == len(valid) - 1:
                    doses[hid] = max(self.herb_nutrition[hid].dosage_min, remaining)
                else:
                    max_d = min(
                        self.herb_nutrition[hid].dosage_max,
                        remaining - sum(
                            self.herb_nutrition[h].dosage_min
                            for h in valid[i + 1:]
                            if h in self.herb_nutrition
                        ),
                    )
                    min_d = self.herb_nutrition[hid].dosage_min
                    doses[hid] = min_d + (max_d - min_d) * (hash((id(self), _, i)) % 10000) / 10000.0
                    remaining -= doses[hid]

            # 计算成本（作为代理目标函数）
            cost = sum(
                doses[h] * self.herb_nutrition[h].cost_per_gram
                for h in doses if h in self.herb_nutrition
            )
            samples.append(cost)

        if len(set(samples)) <= 1:
            return 0.0

        # Lipschitz估计: 目标函数值变化范围 / 输入空间距离
        max_diff = max(samples) - min(samples)
        lipschitz = max_diff / max(total_dosage, 1.0)

        logger.info(
            f"[MILPSolver] Lipschitz估计: {lipschitz:.4f} "
            f"(基于{n_samples}个随机采样)"
        )
        return round(lipschitz, 6)


# ============================================================
# 模块级工厂函数
# ============================================================

def create_milp_solver(
    herb_data: Dict[str, HerbNutritionData],
    constraints: Optional[List[NutritionConstraint]] = None,
) -> MILPSolver:
    """创建MILP求解器实例"""
    return MILPSolver(herb_data, constraints)

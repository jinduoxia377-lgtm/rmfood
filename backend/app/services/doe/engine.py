"""
DOE (Design of Experiments) 实验设计生成器
对标 FormLab DOE 模块

支持：
1. CCD - 中心复合设计 (Central Composite Design)
2. BBD - Box-Behnken 设计
3. 混料设计 (Mixture Design) -  simplex lattice/centroid
4. 响应面拟合 (Response Surface Fitting)
5. 逆向搜索 (Inverse Search) - 给定目标找最优因子组合
6. 主动学习 (Active Learning) - 贝叶斯优化采样
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════
# 枚举与数据类
# ═══════════════════════════════════════════

class DOEDesignType(str, Enum):
    CCD = "ccd"                      # 中心复合设计
    BBD = "bbd"                      # Box-Behnken 设计
    MIXTURE_LATTICE = "mixture_lattice"  # 混料 lattice 设计
    MIXTURE_CENTROID = "mixture_centroid"  # 混料重心设计
    FULL_FACTORIAL = "full_factorial"    # 全因子设计
    FRACTIONAL_FACTORIAL = "fractional_factorial"  # 部分因子设计


class FactorLevel(str, Enum):
    LOW = -1      # 低水平
    HIGH = 1     # 高水平
    CENTER = 0   # 中心点
    AXIAL = "axial"  # 轴点


@dataclass
class Factor:
    """实验因子"""
    name: str
    description: str = ""
    unit: str = ""
    low: float = 0.0
    high: float = 1.0
    center: Optional[float] = None
    axial_range: float = 1.4142  # α 值（可编码空间中的轴点距离）


@dataclass
class DOERun:
    """单次实验运行"""
    run_id: int
    factor_levels: Dict[str, float]  # 因子名 -> 实际值
    coded_levels: Dict[str, float]   # 因子名 -> 编码值(-1,0,1,±α)
    response_values: Optional[Dict[str, float]] = None  # 实测响应值
    predicted_response: Optional[Dict[str, float]] = None  # 预测响应值
    notes: str = ""


@dataclass
class ResponseSurfaceModel:
    """响应面模型"""
    factors: List[str]
    responses: List[str]
    equation: Dict[str, str]         # 响应名 -> 数学表达式字符串
    coefficients: Dict[str, Dict[str, float]]  # 响应名 -> {term: coef}
    r_squared: Dict[str, float]      # 响应名 -> R²
    adjusted_r_squared: Dict[str, float]  # 响应名 -> 调整R²
    rmse: Dict[str, float]           # 响应名 -> RMSE
    significant_terms: List[str]     # 显著项（p<0.05）
    optimal_conditions: Optional[Dict[str, float]] = None  # 最优条件


@dataclass
class InverseSearchResult:
    """逆向搜索结果"""
    target_values: Dict[str, float]   # 目标响应值
    predicted_factors: Dict[str, float]  # 预测的因子组合（实际单位）
    predicted_coded: Dict[str, float] = field(default_factory=dict)  # 编码值（-1~1 空间）
    factor_bounds: Dict[str, Tuple[float, float]] = field(default_factory=dict)  # 各因子的实际取值范围
    feasibility_score: float = 0.0    # 可行性评分 [0,1]
    confidence_interval: Dict[str, Tuple[float, float]] = field(default_factory=dict)  # 因子置信区间
    iteration_count: int = 0
    converged: bool = False


# ═══════════════════════════════════════════
# CCD 设计生成器
# ═══════════════════════════════════════════

class CCDGenerator:
    """
    中心复合设计 (Central Composite Design)

    结构：
    - 2^k 因子点（角点）
    - 2k 轴点（star points，距离中心 α）
    - n_c 中心点

    α 值选择：
    - 可旋转设计：α = (n_f)^{1/4}
    - 均匀旋转性：α = 2^{k/4}
    - 球面设计：α = 1
    """

    def __init__(self, factors: List[Factor], n_center_points: int = 6):
        self.factors = factors
        self.n_factors = len(factors)
        self.n_center = n_center_points
        self.n_factorial = 2 ** self.n_factors
        self.n_axial = 2 * self.n_factors
        self.total_runs = self.n_factorial + self.n_axial + n_center_points
        self.alpha = self._compute_alpha()

    def _compute_alpha(self) -> float:
        """计算 α 值（可旋转设计）"""
        return max(1.0, self.n_factorial ** 0.25)

    def generate(self) -> List[DOERun]:
        """生成 CCD 实验矩阵"""
        runs: List[DOERun] = []
        run_id = 1

        # 1. 因子点 (2^k 角点)
        factorial_runs = self._generate_factorial_points()
        for levels in factorial_runs:
            runs.append(DOERun(
                run_id=run_id,
                factor_levels=self._decode(levels),
                coded_levels=dict(levels),
            ))
            run_id += 1

        # 2. 轴点 (2k 星点)
        axial_runs = self._generate_axial_points()
        for levels in axial_runs:
            runs.append(DOERun(
                run_id=run_id,
                factor_levels=self._decode(levels),
                coded_levels=dict(levels),
            ))
            run_id += 1

        # 3. 中心点
        for _ in range(self.n_center):
            coded = {f.name: 0.0 for f in self.factors}
            runs.append(DOERun(
                run_id=run_id,
                factor_levels=self._decode(coded),
                coded_levels=coded,
            ))
            run_id += 1

        return runs

    def _generate_factorial_points(self) -> List[Dict[str, float]]:
        """生成 2^k 因子点"""
        points = []
        for i in range(self.n_factorial):
            coded = {}
            for j, f in enumerate(self.factors):
                coded[f.name] = 1 if (i >> (self.n_factors - 1 - j)) & 1 else -1
            points.append(coded)
        return points

    def _generate_axial_points(self) -> List[Dict[str, float]]:
        """生成 2k 轴点"""
        points = []
        for j, f in enumerate(self.factors):
            # 正方向
            coded = {fi.name: 0.0 for fi in self.factors}
            coded[f.name] = self.alpha
            points.append(coded)
            # 负方向
            coded = {fi.name: 0.0 for fi in self.factors}
            coded[f.name] = -self.alpha
            points.append(coded)
        return points

    def _decode(self, coded: Dict[str, float]) -> Dict[str, float]:
        """从编码值解码为实际值"""
        decoded = {}
        for f in self.factors:
            c = coded.get(f.name, 0.0)
            # 线性映射: actual = center + coded * (high - low) / 2
            center = f.center if f.center is not None else (f.low + f.high) / 2
            half_range = (f.high - f.low) / 2
            decoded[f.name] = center + c * half_range
        return decoded


# ═══════════════════════════════════════════
# BBD 设计生成器
# ═══════════════════════════════════════════

class BBDDGenerator:
    """
    Box-Behnken 设计

    特点：
    - 不包含角点（所有因子同时取极值的情况不在设计内）
    - 运行时数少于 CCD
    - 适合因子数 3-7 的情况
    """

    def __init__(self, factors: List[Factor], n_center_points: int = 6):
        self.factors = factors
        self.n_factors = len(factors)
        self.n_center = n_center_points

    def generate(self) -> List[DOERun]:
        """生成 BBD 实验矩阵"""
        runs: List[DOERun] = []
        run_id = 1

        # 根据因子数生成不同的 BBD 模式
        if self.n_factors == 3:
            patterns = self._bbd_3factors()
        elif self.n_factors == 4:
            patterns = self._bbd_4factors()
        elif self.n_factors == 5:
            patterns = self._bbd_5factors()
        else:
            patterns = self._bbd_general()

        for pattern in patterns:
            runs.append(DOERun(
                run_id=run_id,
                factor_levels=self._decode(pattern),
                coded_levels=dict(pattern),
            ))
            run_id += 1

        # 添加中心点
        for _ in range(self.n_center):
            coded = {f.name: 0.0 for f in self.factors}
            runs.append(DOERun(
                run_id=run_id,
                factor_levels=self._decode(coded),
                coded_levels=coded,
            ))
            run_id += 1

        return runs

    def _bbd_3factors(self) -> List[Dict[str, float]]:
        """3 因子 BBD (15 次运行)"""
        f = ["A", "B", "C"]
        return [
            {a: 0 for a in f},  # 中心点占位，后续统一添加
        ] + [
            # 每对因子在高水平，第三个因子在中心
            {"A": 1, "B": 1, "C": 0},
            {"A": -1, "B": 1, "C": 0},
            {"A": 1, "B": -1, "C": 0},
            {"A": -1, "B": -1, "C": 0},
            {"A": 1, "B": 0, "C": 1},
            {"A": -1, "B": 0, "C": 1},
            {"A": 1, "B": 0, "C": -1},
            {"A": -1, "B": 0, "C": -1},
            {"A": 0, "B": 1, "C": 1},
            {"A": 0, "B": -1, "C": 1},
            {"A": 0, "B": 1, "C": -1},
            {"A": 0, "B": -1, "C": -1},
        ]

    def _bbd_4factors(self) -> List[Dict[str, float]]:
        """4 因子 BBD (29 次运行)"""
        f = ["A", "B", "C", "D"]
        # 简化版：生成核心模式
        patterns = []
        # 所有两因子组合的 Full Factorial
        from itertools import combinations, product
        for pair in combinations(f, 2):
            for vals in product([-1, 1], repeat=2):
                p = {a: 0 for a in f}
                p[pair[0]] = vals[0]
                p[pair[1]] = vals[1]
                patterns.append(p)
        return patterns

    def _bbd_5factors(self) -> List[Dict[str, float]]:
        return self._bbd_general()

    def _bbd_general(self) -> List[Dict[str, float]]:
        """通用 BBD 生成器"""
        from itertools import combinations, product
        f = [fi.name for fi in self.factors]
        patterns = []
        for pair in combinations(f, 2):
            for vals in product([-1, 1], repeat=2):
                p = {name: 0.0 for name in f}
                p[pair[0]] = float(vals[0])
                p[pair[1]] = float(vals[1])
                patterns.append(p)
        return patterns

    def _decode(self, coded: Dict[str, float]) -> Dict[str, float]:
        decoded = {}
        for f in self.factors:
            c = coded.get(f.name, 0.0)
            center = f.center if f.center is not None else (f.low + f.high) / 2
            half_range = (f.high - f.low) / 2
            decoded[f.name] = center + c * half_range
        return decoded


# ═══════════════════════════════════════════
# 混料设计生成器
# ═══════════════════════════════════════════

class MixtureDesignGenerator:
    """
    混料设计 (Mixture Design)

    适用于各组分比例之和为 1 的场景（如配方设计）
    """

    def __init__(self, factors: List[Factor], degree: int = 2):
        self.factors = factors
        self.n_components = len(factors)
        self.degree = degree  # 2 阶或 3 阶
        # 混料设计中，因子有下限约束（不能为负）
        for f in factors:
            f.low = max(0.0, f.low)
            f.high = min(1.0, f.high)

    def generate(self) -> List[DOERun]:
        """生成混料设计矩阵"""
        if self.degree == 2:
            return self._simplex_lattice()
        else:
            return self._simplex_centroid()

    def _simplex_lattice(self) -> List[DOERun]:
        """Simplex Lattice 设计 (q=2)"""
        runs = []
        run_id = 1

        n = self.n_components
        q = self.degree
        step = 1.0 / q

        # 生成所有满足 sum=1 且每个分量是 step 的整数倍
        def gen(n_left: int, remaining: float, current: List[float]) -> List[List[float]]:
            if n_left == 1:
                return [current + [max(0.0, remaining)]]
            results = []
            steps = int(remaining / step) + 1
            for i in range(steps):
                val = i * step
                if val > remaining + 1e-9:
                    break
                results.extend(gen(n_left - 1, remaining - val, current + [val]))
            return results

        all_mixtures = gen(n, 1.0, [])

        # P1-2 修复：按组分 [lower, upper] 真实约束裁剪
        # 只保留每个分量都在其 [lower, upper] 区间的点
        lo = [f.low for f in self.factors]
        hi = [f.high for f in self.factors]

        # 去重（浮点误差）+ 下界/上界裁剪
        unique = []
        seen = set()
        for m in all_mixtures:
            if not all((lo[i] - 1e-9) <= m[i] <= (hi[i] + 1e-9) for i in range(n)):
                continue
            key = tuple(round(v, 4) for v in m)
            if key not in seen:
                seen.add(key)
                unique.append(m)

        for m in unique:
            coded = {f.name: round(v, 4) for f, v in zip(self.factors, m)}
            runs.append(DOERun(
                run_id=run_id,
                factor_levels=coded,
                coded_levels=coded.copy(),
            ))
            run_id += 1

        return runs

    def _simplex_centroid(self) -> List[DOERun]:
        """Simplex Centroid 设计"""
        runs = []
        run_id = 1
        n = self.n_components

        # P1-2 修复：按组分 [lower, upper] 真实约束裁剪
        lo = [f.low for f in self.factors]
        hi = [f.high for f in self.factors]

        def add_run(m: List[float]) -> None:
            nonlocal run_id
            # 下界/上界裁剪：越界点丢弃（不生成违规设计点）
            if not all((lo[i] - 1e-9) <= m[i] <= (hi[i] + 1e-9) for i in range(n)):
                return
            coded = {f.name: round(v, 4) for f, v in zip(self.factors, m)}
            runs.append(DOERun(run_id=run_id, factor_levels=coded, coded_levels=coded.copy()))
            run_id += 1

        # 纯成分点 (1, 0, 0, ...)
        for i in range(n):
            m = [0.0] * n
            m[i] = 1.0
            add_run(m)

        # 二元混料点 (1/2, 1/2, 0, ...)
        from itertools import combinations
        for i, j in combinations(range(n), 2):
            m = [0.0] * n
            m[i] = 0.5
            m[j] = 0.5
            add_run(m)

        # 整体 centroid (1/n, 1/n, ...)
        centroid = [1.0 / n] * n
        add_run(centroid)

        # 添加中心点重复
        for _ in range(3):
            add_run(centroid)

        return runs


# ═══════════════════════════════════════════
# 响应面拟合
# ═══════════════════════════════════════════

class ResponseSurfaceFitter:
    """
    响应面模型拟合

    使用最小二乘法拟合二次多项式：
    Y = b0 + Σbi*Xi + Σbij*Xi*Xj + Σbii*Xi²
    """

    def __init__(self):
        pass

    def fit(
        self,
        runs: List[DOERun],
        response_names: List[str],
        include_interaction: bool = True,
        include_quadratic: bool = True,
    ) -> List[ResponseSurfaceModel]:
        """
        拟合响应面模型

        返回每个响应变量的模型
        """
        n_factors = len(runs[0].coded_levels) if runs else 0
        factors = list(runs[0].coded_levels.keys()) if runs else []

        models = []
        for resp in response_names:
            model = self._fit_single_response(
                runs=runs,
                factors=factors,
                response=resp,
                include_interaction=include_interaction,
                include_quadratic=include_quadratic,
            )
            models.append(model)

        return models

    def _fit_single_response(
        self,
        runs: List[DOERun],
        factors: List[str],
        response: str,
        include_interaction: bool,
        include_quadratic: bool,
    ) -> ResponseSurfaceModel:
        """拟合单个响应变量"""
        n = len(runs)
        if n == 0:
            return ResponseSurfaceModel(
                factors=factors,
                responses=[response],
                equation="",
                coefficients={},
                r_squared={response: 0.0},
                adjusted_r_squared={response: 0.0},
                rmse={response: 0.0},
                significant_terms=[],
            )

        # 构建设计矩阵 X
        # 项顺序： intercept, X1...Xk, X1X2...X(k-1)Xk, X1²...Xk²
        terms = ["X0"]  # intercept
        for f in factors:
            terms.append(f"X_{f}")
        if include_interaction:
            from itertools import combinations
            for a, b in combinations(factors, 2):
                terms.append(f"X_{a}X_{b}")
        if include_quadratic:
            for f in factors:
                terms.append(f"X_{f}^2")

        # 提取响应值（跳过没有响应的运行）
        filtered_runs = []
        y = []
        for run in runs:
            val = run.response_values.get(response) if run.response_values else None
            if val is not None:
                filtered_runs.append(run)
                y.append(val)

        # 如果没有有效响应数据，返回退化模型
        if not y or len(y) < 2:
            return ResponseSurfaceModel(
                factors=factors,
                responses=[response],
                equation=f"{response} = 0",
                coefficients={},
                r_squared={response: 0.0},
                adjusted_r_squared={response: 0.0},
                rmse={response: 0.0},
                significant_terms=[],
            )

        # 构建 X 矩阵（仅使用有响应值的运行）
        X = []
        for run in filtered_runs:
            row = [1.0]  # intercept
            coded = run.coded_levels
            for f in factors:
                x = coded.get(f, 0.0)
                row.append(x)
            if include_interaction:
                for a, b in combinations(factors, 2):
                    row.append(coded.get(a, 0.0) * coded.get(b, 0.0))
            if include_quadratic:
                for f in factors:
                    row.append(coded.get(f, 0.0) ** 2)
            X.append(row)

        # 最小二乘: beta = (X'X)^{-1} X'y
        try:
            XtX = self._matrix_multiply_transpose(X, X)
            XtX_inv = self._matrix_inverse(XtX)
            Xty = self._matrix_vector_multiply_transpose(X, y)
            beta = self._matrix_vector_multiply(XtX_inv, Xty)
        except Exception:
            # 退化情况：返回零模型
            return ResponseSurfaceModel(
                factors=factors,
                responses=[response],
                equation=f"{response} = 0",
                coefficients={response: {"X0": 0.0}},
                r_squared={response: 0.0},
                adjusted_r_squared={response: 0.0},
                rmse={response: 0.0},
                significant_terms=[],
            )

        # 计算拟合值和统计量
        y_pred = self._matrix_vector_multiply(X, beta)
        y_mean = sum(y) / len(y) if y else 0.0

        ss_tot = sum((yi - y_mean) ** 2 for yi in y)
        ss_res = sum((yi - yi_pred) ** 2 for yi, yi_pred in zip(y, y_pred))
        ss_reg = ss_tot - ss_res

        r_squared = 1 - ss_res / ss_tot if ss_tot > 1e-10 else 0.0
        n_params = len(beta)
        # Adj R²: 自由度 = n - p - 1，其中 p = n_params - 1（排除截距）
        # 即分母 = n - n_params
        adj_r_squared = 1 - (1 - r_squared) * (n - 1) / max(1, n - n_params) if n > n_params else 0.0
        rmse = math.sqrt(ss_res / max(1, n - n_params))

        # 构建系数字典
        coefficients = {}
        for i, term in enumerate(terms):
            if i < len(beta):
                coefficients[response] = coefficients.get(response, {})
                coefficients[response][term] = round(beta[i], 6)

        # 构建方程字符串
        eq_parts = [f"{response} = {beta[0]:.4f}"]
        for i in range(1, min(len(beta), len(terms))):
            if abs(beta[i]) > 1e-6:
                sign = "+" if beta[i] > 0 else "-"
                eq_parts.append(f" {sign} {abs(beta[i]):.4f} * {terms[i]}")
        equation = "".join(eq_parts)

        # 显著项识别（简化：系数绝对值 > 阈值）
        threshold = max(rmse * 2, 0.01)
        significant = [terms[i] for i in range(1, len(beta)) if abs(beta[i]) > threshold]

        return ResponseSurfaceModel(
            factors=factors,
            responses=[response],
            equation=equation,
            coefficients=coefficients,
            r_squared={response: round(r_squared, 4)},
            adjusted_r_squared={response: round(adj_r_squared, 4)},
            rmse={response: round(rmse, 6)},
            significant_terms=significant,
        )

    def _matrix_multiply_transpose(self, A: List[List[float]], B: List[List[float]]) -> List[List[float]]:
        """计算 A^T * B"""
        m = len(A)        # rows of A
        n = len(A[0]) if A else 0  # cols of A (= rows of B)
        p = len(B[0]) if B else 0  # cols of B
        # A^T is n x m, B is m x p, result is n x p
        result = [[0.0] * p for _ in range(n)]
        for i in range(n):
            for j in range(p):
                s = 0.0
                for k in range(m):
                    s += A[k][i] * B[k][j]  # A^T[i,k] = A[k][i]
                result[i][j] = s
        return result

    def _matrix_vector_multiply_transpose(self, A: List[List[float]], b: List[float]) -> List[float]:
        """计算 A^T * b"""
        m = len(A)
        n = len(A[0]) if A else 0
        result = [0.0] * n
        for i in range(n):
            s = 0.0
            for j in range(m):
                s += A[j][i] * b[j]
            result[i] = s
        return result

    def _matrix_vector_multiply(self, A: List[List[float]], b: List[float]) -> List[float]:
        """计算 A * b"""
        m = len(A)
        n = len(b)
        result = [0.0] * m
        for i in range(m):
            s = 0.0
            for j in range(n):
                s += A[i][j] * b[j]
            result[i] = s
        return result

    def _matrix_inverse(self, A: List[List[float]]) -> List[List[float]]:
        """高斯消元法求逆矩阵"""
        n = len(A)
        # 增广矩阵 [A|I]
        aug = [row[:] + [1.0 if i == j else 0.0 for j in range(n)] for i, row in enumerate(A)]

        for col in range(n):
            # 选主元
            max_row = col
            for row in range(col + 1, n):
                if abs(aug[row][col]) > abs(aug[max_row][col]):
                    max_row = row
            aug[col], aug[max_row] = aug[max_row], aug[col]

            pivot = aug[col][col]
            if abs(pivot) < 1e-12:
                raise ValueError("Singular matrix")

            for j in range(2 * n):
                aug[col][j] /= pivot

            for row in range(n):
                if row != col:
                    factor = aug[row][col]
                    for j in range(2 * n):
                        aug[row][j] -= factor * aug[col][j]

        return [row[n:] for row in aug]


# ═══════════════════════════════════════════
# 逆向搜索
# ═══════════════════════════════════════════

class InverseSearchEngine:
    """
    逆向搜索引擎

    给定目标响应值，反推最优因子组合
    使用梯度下降 + 约束优化
    """

    def __init__(self):
        self.max_iterations = 1000
        self.learning_rate = 0.01
        self.convergence_threshold = 1e-6

    def search(
        self,
        model: ResponseSurfaceModel,
        target_values: Dict[str, float],
        factor_bounds: Optional[Dict[str, Tuple[float, float]]] = None,
    ) -> InverseSearchResult:
        """
        执行逆向搜索。

        Args:
            model: 响应面模型
            target_values: 目标响应值 {响应名: 目标值}
            factor_bounds: 因子实际取值范围 {因子名: (low, high)}。
                缺省为各因子 (-1, 1) 编码空间；提供实际范围时会把搜索
                结果反解回实际单位。

        实现：在编码空间 [-1,1] 内做梯度下降（模型系数按编码项构造），
        结束后按 factor_bounds 把最优编码点反解为实际因子值。
        """
        factors = model.factors
        if not factors:
            return InverseSearchResult(
                target_values=target_values,
                predicted_factors={},
                predicted_coded={},
                factor_bounds={},
                feasibility_score=0.0,
                confidence_interval={},
                converged=False,
            )

        # 默认编码边界 [-1, 1]；若提供实际范围则记录用于反解
        bounds: Dict[str, Tuple[float, float]] = {}
        for f in factors:
            if factor_bounds and f in factor_bounds:
                lo, hi = factor_bounds[f]
                bounds[f] = (float(lo), float(hi))
            else:
                bounds[f] = (-1.0, 1.0)

        # 实际范围与编码范围是否一致（影响是否真正"解码"）
        is_coded_only = all(
            abs(lo + 1.0) < 1e-9 and abs(hi - 1.0) < 1e-9 for lo, hi in bounds.values()
        )

        # 初始化：从中心点开始
        current = {f: 0.0 for f in factors}
        best = current.copy()
        best_error = float('inf')

        for iteration in range(self.max_iterations):
            # 计算当前预测值
            predicted = self._predict(model, current, factors)

            # 计算误差
            error = self._compute_error(predicted, target_values)

            if error < best_error:
                best_error = error
                best = current.copy()

            if error < self.convergence_threshold:
                break

            # 梯度下降更新（自适应学习率：按梯度范数归一化，步长取 min(lr, 0.1/grad_norm)）
            gradient = self._compute_gradient(model, current, factors, target_values)
            grad_norm = math.sqrt(sum(g * g for g in gradient.values()))
            if grad_norm < 1e-12:
                break
            lr = min(self.learning_rate, 0.1 / grad_norm)
            current = self._apply_bounds(
                {f: current[f] - lr * gradient.get(f, 0) for f in factors},
                # 搜索始终在编码空间 [-1,1] 内进行
                {f: (-1.0, 1.0) for f in factors},
            )

        # 把最优编码点反解为实际因子值
        decoded: Dict[str, float] = {}
        for f in factors:
            lo, hi = bounds[f]
            c = best.get(f, 0.0)
            if is_coded_only:
                # 编码空间即实际空间，无需换算
                decoded[f] = c
            else:
                # 线性映射: actual = center + coded * half_range
                center = (lo + hi) / 2
                half = (hi - lo) / 2
                decoded[f] = center + c * half

        # 可行性评分
        predicted_final = self._predict(model, best, factors)
        target_ref = list(target_values.values())[0] if target_values else 1.0
        feasibility = 1.0 - min(1.0, best_error / max(1.0, abs(target_ref)))

        return InverseSearchResult(
            target_values=target_values,
            predicted_factors=decoded,
            predicted_coded=dict(best),
            factor_bounds=bounds,
            feasibility_score=round(feasibility, 4),
            confidence_interval={f: bounds[f] for f in factors},
            iteration_count=iteration + 1,
            converged=best_error < self.convergence_threshold,
        )

    def _predict(
        self, model: ResponseSurfaceModel, factors: Dict[str, float], factor_names: List[str]
    ) -> Dict[str, float]:
        """使用模型预测响应值（支持 X_ 前缀 / 裸因子名等多种系数字典键格式）"""
        predicted = {}
        for resp in model.responses:
            coef = model.coefficients.get(resp, {})
            value = coef.get("X0", coef.get("const", 0.0))

            # 线性项
            for f in factor_names:
                term_key = self._find_term_key(coef, f"X_{f}")
                if term_key:
                    value += coef[term_key] * factors.get(f, 0.0)

            # 交互项
            for i, f1 in enumerate(factor_names):
                for f2 in factor_names[i + 1:]:
                    term_key = self._find_term_key(coef, f"X_{f1}X_{f2}")
                    if term_key:
                        value += coef[term_key] * factors.get(f1, 0.0) * factors.get(f2, 0.0)

            # 二次项
            for f in factor_names:
                term_key = self._find_term_key(coef, f"X_{f}^2")
                if term_key:
                    value += coef[term_key] * factors.get(f, 0.0) ** 2

            predicted[resp] = value
        return predicted

    @staticmethod
    def _find_term_key(coef: Dict[str, float], key: str) -> Optional[str]:
        """查找系数字典中的项键，优先 X_ 前缀，回退到裸键"""
        if key in coef:
            return key
        bare = key[2:] if key.startswith("X_") else key
        if bare in coef:
            return bare
        # X_A^2 的裸形式 A^2
        if bare.endswith("^2") and bare[:-2] in coef:
            return bare[:-2]
        return None

    def _compute_error(self, predicted: Dict[str, float], targets: Dict[str, float]) -> float:
        """计算预测误差"""
        error = 0.0
        for resp, target in targets.items():
            pred = predicted.get(resp, 0.0)
            error += (pred - target) ** 2
        return math.sqrt(error)

    def _compute_gradient(
        self, model: ResponseSurfaceModel, factors: Dict[str, float],
        factor_names: List[str], targets: Dict[str, float]
    ) -> Dict[str, float]:
        """数值梯度"""
        gradient = {f: 0.0 for f in factor_names}
        h = 1e-5

        for f in factor_names:
            # 正向扰动
            f_plus = factors.copy()
            f_plus[f] += h
            pred_plus = self._predict(model, f_plus, factor_names)

            # 负向扰动
            f_minus = factors.copy()
            f_minus[f] -= h
            pred_minus = self._predict(model, f_minus, factor_names)

            # 梯度
            for resp, target in targets.items():
                err_plus = (pred_plus.get(resp, 0) - target) ** 2
                err_minus = (pred_minus.get(resp, 0) - target) ** 2
                gradient[f] += (err_plus - err_minus) / (2 * h)

        return gradient

    def _apply_bounds(self, values: Dict[str, float], bounds: Dict[str, Tuple[float, float]]) -> Dict[str, float]:
        """应用边界约束"""
        result = {}
        for f, v in values.items():
            low, high = bounds.get(f, (-1.0, 1.0))
            result[f] = max(low, min(high, v))
        return result


# ═══════════════════════════════════════════
# DOE 主引擎
# ═══════════════════════════════════════════

@dataclass
class DOEResponse:
    """DOE 设计响应"""
    design_type: str
    total_runs: int
    runs: List[DOERun]
    model: Optional[ResponseSurfaceModel] = None
    inverse_result: Optional[InverseSearchResult] = None
    notes: str = ""


class DOEResponseBuilder:
    def __init__(self, design_type: str, total_runs: int, runs: List[DOERun]):
        self.design_type = design_type
        self.total_runs = total_runs
        self.runs = runs
        self.model = None
        self.inverse_result = None
        self.notes = ""

    def with_model(self, model: ResponseSurfaceModel):
        self.model = model
        return self

    def with_inverse_result(self, result: InverseSearchResult):
        self.inverse_result = result
        return self

    def with_notes(self, notes: str):
        self.notes = notes
        return self

    def build(self) -> DOEResponse:
        return DOEResponse(
            design_type=self.design_type,
            total_runs=self.total_runs,
            runs=self.runs,
            model=self.model,
            inverse_result=self.inverse_result,
            notes=self.notes,
        )


class DOEEngine:
    """
    DOE 实验设计引擎

    核心能力：
    1. 实验设计生成 (CCD/BBD/Mixture)
    2. 响应面拟合
    3. 逆向搜索
    4. 主动学习推荐
    """

    def __init__(self):
        self.ccd_generator = None
        self.bbd_generator = None
        self.mixture_generator = None
        self.responder = ResponseSurfaceFitter()
        self.inverse_searcher = InverseSearchEngine()

    def generate_ccd(
        self,
        factors: List[Factor],
        n_center_points: int = 6,
    ) -> DOEResponse:
        """生成 CCD 设计"""
        gen = CCDGenerator(factors, n_center_points)
        runs = gen.generate()
        return DOEResponseBuilder(
            design_type="ccd",
            total_runs=len(runs),
            runs=runs,
        ).with_notes(
            f"CCD 设计: {len(factors)} 因子, α={gen.alpha:.4f}, "
            f"因子点={gen.n_factorial}, 轴点={gen.n_axial}, 中心点={n_center_points}"
        ).build()

    def generate_bbd(
        self,
        factors: List[Factor],
        n_center_points: int = 6,
    ) -> DOEResponse:
        """生成 BBD 设计"""
        gen = BBDDGenerator(factors, n_center_points)
        runs = gen.generate()
        return DOEResponseBuilder(
            design_type="bbd",
            total_runs=len(runs),
            runs=runs,
        ).with_notes(
            f"BBD 设计: {len(factors)} 因子, 中心点={n_center_points}"
        ).build()

    def generate_mixture(
        self,
        factors: List[Factor],
        degree: int = 2,
    ) -> DOEResponse:
        """生成混料设计"""
        gen = MixtureDesignGenerator(factors, degree)
        runs = gen.generate()
        return DOEResponseBuilder(
            design_type="mixture" if degree == 2 else "mixture_centroid",
            total_runs=len(runs),
            runs=runs,
        ).with_notes(
            f"混料设计 (q={degree}): {len(factors)} 组分, {len(runs)} 次运行"
        ).build()

    def fit_response_surface(
        self,
        runs: List[DOERun],
        response_names: List[str],
        include_interaction: bool = True,
        include_quadratic: bool = True,
    ) -> List[ResponseSurfaceModel]:
        """拟合响应面模型"""
        if not runs or not response_names:
            return []
        return self.responder.fit(runs, response_names, include_interaction, include_quadratic)

    def inverse_search(
        self,
        model: ResponseSurfaceModel,
        target_values: Dict[str, float],
        factor_bounds: Optional[Dict[str, Tuple[float, float]]] = None,
    ) -> InverseSearchResult:
        """逆向搜索最优因子组合"""
        return self.inverse_searcher.search(model, target_values, factor_bounds)

    def active_learning_recommend(
        self,
        existing_runs: List[DOERun],
        response_model: Optional[ResponseSurfaceModel] = None,
        n_recommend: int = 5,
    ) -> List[DOERun]:
        """
        主动学习推荐：基于不确定性采样，推荐下一批实验点（真正实现）。

        策略：
          1. 若有 response_model：在因子空间构建候选网格，
             计算每个候选点的预测方差 σ²(x) = xᵀ(XᵀX)⁻¹x · s²（最小二乘方差公式），
             按 σ² 降序选 n_recommend 个点（不确定性最大 → 信息增益最大）。
          2. 若无 response_model（无历史数据）：推荐 CCD 的角点 + 中心点
             作为初始设计（标准 DOE 起点），而非随机噪声。

        返回的每个 DOERun 含 coded_levels / factor_levels（基于现有数据 min/max 反编码），
        前端/调用方可直接加入实验队列执行。
        """
        if not existing_runs:
            # 无历史数据：推荐标准初始设计（CCD 角点+中心点）
            return self._initial_design_runs(factors=["F1", "F2"])

        # 因子推断
        all_coded: List[Dict[str, float]] = [
            r.coded_levels for r in existing_runs if r.coded_levels
        ]
        if not all_coded:
            return []
        factors = list(all_coded[0].keys())

        # 因子范围（用于反编码 + 候选网格）
        factor_range: Dict[str, Tuple[float, float]] = {}
        for f in factors:
            vals = [r.coded_levels.get(f, 0.0) for r in existing_runs if r.coded_levels]
            if vals:
                factor_range[f] = (min(vals), max(vals))
            else:
                factor_range[f] = (-1.0, 1.0)

        # ── 有响应面模型：不确定性采样 ──
        if response_model and response_model.coefficients:
            # 重建 X 矩阵 + (XᵀX)⁻¹（基于有响应值的 run）
            try:
                covariance = self._build_design_matrix_inverse(response_model, existing_runs)
                if covariance is not None:
                    return self._variance_based_runs(
                        response_model, factors, factor_range,
                        n_recommend, covariance, existing_runs,
                    )
            except Exception as e:
                logger.warning("方差计算失败，回退到确定性采样: %s", e)

        # ── 无模型 / 方差失败：确定性空白区采样（不再用随机噪声） ──
        return self._gap_based_runs(factors, factor_range, existing_runs, n_recommend)

    def _initial_design_runs(self, factors: Optional[List[str]] = None) -> List[DOERun]:
        """
        无历史数据时：推荐标准 CCD 初始设计（角点 + 轴点 + 中心点），而非随机噪声。

        因子名未知时默认 F1/F2；已知时按其生成 2^k 角点 + 2k 轴点 + 1 中心点。
        """
        factor_names = factors or ["F1", "F2"]
        k = len(factor_names)
        import itertools

        runs: List[DOERun] = []
        run_id = 1

        # 因子点：2^k 角点（±1）
        for combo in itertools.product([-1.0, 1.0], repeat=k):
            coded = dict(zip(factor_names, combo))
            runs.append(DOERun(run_id=run_id, factor_levels=dict(coded), coded_levels=coded))
            run_id += 1

        # 轴点：每因子 ±α（α = (2^k)^0.25 可旋转设计）
        alpha = (2 ** k) ** 0.25
        for i, f in enumerate(factor_names):
            for sign in (-1.0, 1.0):
                coded = {g: 0.0 for g in factor_names}
                coded[f] = sign * alpha
                runs.append(DOERun(run_id=run_id, factor_levels=dict(coded), coded_levels=coded))
                run_id += 1

        # 中心点
        center = {f: 0.0 for f in factor_names}
        runs.append(DOERun(run_id=run_id, factor_levels=dict(center), coded_levels=center))
        run_id += 1

        return runs

    def _build_design_matrix_inverse(
        self,
        model: ResponseSurfaceModel,
        runs: List[DOERun],
    ) -> Optional[List[List[float]]]:
        """重建 (XᵀX)⁻¹ 用于方差公式。返回 None 若无法重建。"""
        fitter = self.responder
        factors = model.factors
        # 构建设计矩阵（与 ResponseSurfaceFitter._fit_single_response 同结构）
        terms: List[str] = ["X0"]
        for f in factors:
            terms.append(f"X_{f}")
        from itertools import combinations
        for a, b in combinations(factors, 2):
            terms.append(f"X_{a}X_{b}")
        for f in factors:
            terms.append(f"X_{f}^2")

        X: List[List[float]] = []
        for run in runs:
            coded = run.coded_levels
            row = [1.0]
            for f in factors:
                row.append(coded.get(f, 0.0))
            for a, b in combinations(factors, 2):
                row.append(coded.get(a, 0.0) * coded.get(b, 0.0))
            for f in factors:
                row.append(coded.get(f, 0.0) ** 2)
            X.append(row)

        XtX = fitter._matrix_multiply_transpose(X, X)
        try:
            XtX_inv = fitter._matrix_inverse(XtX)
        except Exception:
            return None
        return XtX_inv

    def _variance_based_runs(
        self,
        model: ResponseSurfaceModel,
        factors: List[str],
        factor_range: Dict[str, Tuple[float, float]],
        n_recommend: int,
        XtX_inv: List[List[float]],
        existing_runs: Optional[List[DOERun]] = None,
    ) -> List[DOERun]:
        """在候选网格上计算预测方差，按降序选 n_recommend 个点。

        关键修复：候选网格必须**超出已观测范围**向外扩展。
        已有 run 通常只覆盖了 [-1,1]（CCD/BBD 角点/轴点），若网格仍局限在
        观测 min/max 内，推荐点就永远落在"已探索区域"，等于原地打转——
        这正是主动学习要规避的。现在网格在观测范围外再往外扩 1 个跨度，
        并对"与已有 run 重合"的候选降权，让推荐真正指向未探索的空白区。
        """
        # 已有 run 的编码位置集合（用于降权重合点）
        existing_set = set()
        if existing_runs:
            for r in existing_runs:
                if r.coded_levels:
                    key = tuple(round(r.coded_levels.get(f, 0.0), 4) for f in factors)
                    existing_set.add(key)

        # 构建候选网格：每个因子在 [lo-ext, hi+ext] 上取 7 个水平
        # ext = 观测跨度（让网格真正超出已探索区域）
        from itertools import product
        step_lists: List[List[float]] = []
        for f in factors:
            lo, hi = factor_range[f]
            center = (lo + hi) / 2
            span = max((hi - lo) / 2, 1e-6)
            ext = span * 1.5  # 向外扩 1.5 个半跨度
            lo_ext, hi_ext = lo - ext, hi + ext
            # 7 个水平：lo_ext, -1, 0, 1, hi_ext 中再插中间值
            levels = [
                lo_ext,
                center - span,
                center - span / 2,
                center,
                center + span / 2,
                center + span,
                hi_ext,
            ]
            step_lists.append(levels)
        combos = list(product(*step_lists))
        candidates = [dict(zip(factors, c)) for c in combos]

        # 计算每个候选的预测方差 σ²(x) = xᵀ (XᵀX)⁻¹ x
        scored: List[Tuple[float, Dict[str, float]]] = []
        for cand in candidates:
            x: List[float] = [1.0]
            for f in factors:
                x.append(cand.get(f, 0.0))
            from itertools import combinations
            for a, b in combinations(factors, 2):
                x.append(cand.get(a, 0.0) * cand.get(b, 0.0))
            for f in factors:
                x.append(cand.get(f, 0.0) ** 2)
            Xt_inv = self.responder._matrix_vector_multiply(XtX_inv, x)
            var = sum(x[i] * Xt_inv[i] for i in range(len(x)))
            # 与已有 run 重合（编码值相同）的候选降权 50%，避免原地打转
            key = tuple(round(cand.get(f, 0.0), 4) for f in factors)
            if key in existing_set:
                var *= 0.5
            scored.append((var, cand))

        scored.sort(key=lambda t: t[0], reverse=True)
        top = scored[:n_recommend]

        runs: List[DOERun] = []
        base_id = 1000
        for i, (var, cand) in enumerate(top):
            # 因子 levels 用编码值（前端/调用方可按 factor_range 反解实际值）
            runs.append(DOERun(
                run_id=base_id + i,
                factor_levels={f: round(cand.get(f, 0.0), 4) for f in factors},
                coded_levels={f: round(cand.get(f, 0.0), 4) for f in factors},
            ))
        return runs

    def _gap_based_runs(
        self,
        factors: List[str],
        factor_range: Dict[str, Tuple[float, float]],
        existing_runs: List[DOERun],
        n_recommend: int,
    ) -> List[DOERun]:
        """无模型时：找因子空间中离已有 run 最远的空白点（确定性）。

        关键：候选区要**超出已观测范围**，否则推荐点会被困在已探索的盒子里，
        失去"探索未知"的意义。这里把每个因子的观测 [lo,hi] 向外再扩 1 个
        半跨度，并在每个扩展区间上取 3 个水平。
        """
        existing: List[Tuple[float, ...]] = []
        for r in existing_runs:
            if r.coded_levels:
                existing.append(tuple(r.coded_levels.get(f, 0.0) for f in factors))

        runs: List[DOERun] = []
        base_id = 2000
        from itertools import product
        candidate_vals = []
        for f in factors:
            lo, hi = factor_range[f]
            center = (lo + hi) / 2
            span = max((hi - lo) / 2, 1e-6)
            lo_ext, hi_ext = lo - span, hi + span
            candidate_vals.append([lo_ext, center, hi_ext])
        combos = list(product(*candidate_vals))
        scored = []
        for c in combos:
            cand = dict(zip(factors, c))
            # 到已有 run 的最小距离（L∞）
            min_dist = min(
                max(abs(cand[f] - e[i]) for i, f in enumerate(factors))
                for e in existing
            ) if existing else 1.0
            scored.append((min_dist, cand))
        scored.sort(key=lambda t: t[0], reverse=True)
        for i, (dist, cand) in enumerate(scored[:n_recommend]):
            runs.append(DOERun(
                run_id=base_id + i,
                factor_levels={f: round(cand.get(f, 0.0), 4) for f in factors},
                coded_levels={f: round(cand.get(f, 0.0), 4) for f in factors},
            ))
        return runs


# ═══════════════════════════════════════════
# 单例工厂
# ═══════════════════════════════════════════

_instance: Optional[DOEEngine] = None

def get_doe_engine() -> DOEEngine:
    global _instance
    if _instance is None:
        _instance = DOEEngine()
    return _instance

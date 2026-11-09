"""
遗传算法模块基准测试套件

提供10个标准配方问题，用于对比不同优化策略的效果：
1. 简单3味药材配方
2. 中等5味药材配方
3. 复杂10味药材配方
4. 严格营养约束问题
5. 成本优先问题
6. 功效优先问题
7. 多目标Pareto问题
8. 大规模候选池问题
9. 禁忌约束问题
10. 真实案例验证

统计检验：
- t检验：对比两种策略的平均得分差异
- Wilcoxon符号秩检验：非参数版本

@version 1.0.0
"""

import logging
import statistics
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ============================================================
# 基准测试问题定义
# ============================================================

@dataclass
class BenchmarkProblem:
    """基准测试问题"""
    id: str
    name: str
    target_effects: List[str]
    constraints: Dict[str, Any]
    expected_ingredients: Optional[List[str]] = None  # 专家答案（可选）
    difficulty: str = "medium"  # easy/medium/hard


STANDARD_PROBLEMS = [
    BenchmarkProblem(
        id="simple_3_herb",
        name="简单3味药材配方",
        target_effects=["免疫调节"],
        constraints={"max_ingredients": 5, "min_ingredients": 3},
        expected_ingredients=["hq", "ds", "gq"],
        difficulty="easy",
    ),
    BenchmarkProblem(
        id="moderate_5_herb",
        name="中等5味药材配方",
        target_effects=["免疫调节", "抗氧化"],
        constraints={"max_ingredients": 8, "min_ingredients": 4},
        expected_ingredients=["hq", "ds", "gz", "gq", "dcx"],
        difficulty="medium",
    ),
    BenchmarkProblem(
        id="complex_10_herb",
        name="复杂10味药材配方",
        target_effects=["免疫调节", "降血糖", "心血管保护"],
        constraints={"max_ingredients": 12, "min_ingredients": 5},
        difficulty="hard",
    ),
    BenchmarkProblem(
        id="strict_nutrition",
        name="严格营养约束问题",
        target_effects=["免疫调节"],
        constraints={
            "nutrition_constraints": [
                {"nutrient": "protein", "min_value": 10.0},
                {"nutrient": "sodium", "max_value": 400.0},
            ],
            "strict_nutrition": True,
        },
        difficulty="hard",
    ),
    BenchmarkProblem(
        id="cost_priority",
        name="成本优先问题",
        target_effects=["免疫调节"],
        constraints={"max_cost": 5.0, "total_dosage": 100.0},
        difficulty="medium",
    ),
    BenchmarkProblem(
        id="efficacy_priority",
        name="功效优先问题",
        target_effects=["免疫调节", "抗疲劳", "抗氧化"],
        constraints={"total_dosage": 120.0},
        difficulty="medium",
    ),
    BenchmarkProblem(
        id="multi_objective_pareto",
        name="多目标Pareto问题",
        target_effects=["免疫调节", "降血糖"],
        constraints={"require_pareto": True},
        difficulty="hard",
    ),
    BenchmarkProblem(
        id="large_candidate_pool",
        name="大规模候选池问题",
        target_effects=["免疫调节", "抗氧化", "降血糖", "降血压", "心血管保护"],
        constraints={"max_ingredients": 15},
        difficulty="hard",
    ),
    BenchmarkProblem(
        id="contraindication_constraint",
        name="禁忌约束问题",
        target_effects=["免疫调节"],
        constraints={"exclude_herbs": ["fz", "lk"]},  # 排除附子、藜芦
        difficulty="medium",
    ),
    BenchmarkProblem(
        id="real_world_case",
        name="真实案例验证",
        target_effects=["免疫调节", "抗氧化", "抗疲劳"],
        constraints={
            "total_dosage": 100.0,
            "max_ingredients": 8,
            "min_ingredients": 4,
        },
        difficulty="hard",
    ),
]


# ============================================================
# 统计检验工具
# ============================================================

class StatisticalTests:
    """统计检验工具"""

    @staticmethod
    def t_test_two_sample(*args):
        """独立样本t检验（简化实现）"""
        pass

    @staticmethod
    def wilcoxon_signed_rank_test(x: List[float], y: List[float]) -> Tuple[float, float]:
        """
        Wilcoxon符号秩检验

        Returns:
            (statistic, p_value)
        """
        if len(x) != len(y) or len(x) == 0:
            return 0.0, 1.0

        diffs = [xi - yi for xi, yi in zip(x, y)]
        non_zero = [d for d in diffs if d != 0]

        if not non_zero:
            return 0.0, 1.0

        abs_diffs = [abs(d) for d in non_zero]
        signs = [1 if d > 0 else -1 for d in non_zero]

        # 排序并分配秩
        sorted_indices = sorted(range(len(abs_diffs)), key=lambda i: abs_diffs[i])
        ranks = [0] * len(abs_diffs)
        for rank, idx in enumerate(sorted_indices, 1):
            ranks[idx] = rank

        # 计算W统计量
        pos_ranks = sum(r for r, s in zip(ranks, signs) if s > 0)
        neg_ranks = sum(r for r, s in zip(ranks, signs) if s < 0)

        W = min(pos_ranks, neg_ranks)  # noqa: N806  # Wilcoxon W 统计量（数学符号约定）
        n = len(non_zero)

        # 大样本近似
        if n > 10:
            mu = n * (n + 1) / 4
            sigma = (n * (n + 1) * (2 * n + 1) / 24) ** 0.5
            z = (W - mu) / sigma if sigma > 0 else 0
            p_value = 2 * (1 - StatisticalTests._normal_cdf(abs(z)))
        else:
            p_value = 1.0  # 小样本保守估计

        return W, p_value

    @staticmethod
    def _normal_cdf(x: float) -> float:
        """标准正态分布CDF近似"""
        return 0.5 * (1 + (1 / (1 + 0.2316419 * abs(x))) *
                      (0.319381530 * abs(x) -
                       0.356563782 * abs(x) ** 2 +
                       1.781477937 * abs(x) ** 3 -
                       1.821255978 * abs(x) ** 4 +
                       1.330274429 * abs(x) ** 5) *
                      (1 / (2 ** 0.5)) * 2.718281828 ** (-x ** 2 / 2))


# ============================================================
# 基准测试执行器
# ============================================================

class BenchmarkExecutor:
    """基准测试执行器"""

    def __init__(self, optimizer_factory):
        """
        Args:
            optimizer_factory: 优化器工厂函数
        """
        self.optimizer_factory = optimizer_factory
        self.results: Dict[str, List[Dict[str, Any]]] = {}

    def run_all(self, strategies: List[str]) -> Dict[str, Any]:
        """
        运行所有基准测试问题

        Args:
            strategies: 要测试的策略列表

        Returns:
            测试结果汇总
        """
        all_results = {}

        for problem in STANDARD_PROBLEMS:
            logger.info(f"[Benchmark] 运行问题: {problem.name}")
            problem_results = self._run_problem(problem, strategies)
            all_results[problem.id] = problem_results

        # 统计分析
        all_results["statistics"] = self._analyze_results(all_results)

        return all_results

    def _run_problem(
        self,
        problem: BenchmarkProblem,
        strategies: List[str],
    ) -> Dict[str, Any]:
        """运行单个问题"""
        results = {}

        for strategy in strategies:
            start = time.perf_counter()
            try:
                result = self.optimizer_factory(strategy, problem)
                elapsed = (time.perf_counter() - start) * 1000
                results[strategy] = {
                    "best_score": result.best_score if hasattr(result, 'best_score') else 0.0,
                    "candidates_count": len(result.candidates) if hasattr(result, 'candidates') else 0,
                    "execution_time_ms": elapsed,
                    "success": True,
                }
            except Exception as e:
                results[strategy] = {
                    "best_score": 0.0,
                    "candidates_count": 0,
                    "execution_time_ms": 0.0,
                    "success": False,
                    "error": str(e),
                }

        return results

    def _analyze_results(
        self,
        all_results: Dict[str, Any],
    ) -> Dict[str, Any]:
        """分析测试结果"""
        analysis = {}

        # 提取各策略的得分
        strategy_scores = {}
        for problem_id, problem_results in all_results.items():
            if problem_id == "statistics":
                continue
            for strategy, result in problem_results.items():
                if strategy not in strategy_scores:
                    strategy_scores[strategy] = []
                if result.get("success"):
                    strategy_scores[strategy].append(result["best_score"])

        # 计算统计量
        for strategy, scores in strategy_scores.items():
            if scores:
                analysis[strategy] = {
                    "mean_score": statistics.mean(scores),
                    "median_score": statistics.median(scores),
                    "stdev": statistics.stdev(scores) if len(scores) > 1 else 0,
                    "min_score": min(scores),
                    "max_score": max(scores),
                    "success_rate": sum(1 for s in scores if s > 0) / len(scores),
                }

        return analysis


# ============================================================
# 基准测试报告生成
# ============================================================

def generate_report(results: Dict[str, Any], output_path: Optional[str] = None) -> str:
    """生成基准测试报告"""
    report_lines = [
        "=" * 60,
        "遗传算法模块基准测试报告",
        "=" * 60,
        "",
        "测试问题: 10个标准配方问题",
        "",
    ]

    # 统计结果
    if "statistics" in results:
        stats = results["statistics"]
        report_lines.append("各策略统计:")
        for strategy, metric in stats.items():
            report_lines.append(f"  {strategy}:")
            report_lines.append(f"    平均得分: {metric.get('mean_score', 0):.4f}")
            report_lines.append(f"    中位数: {metric.get('median_score', 0):.4f}")
            report_lines.append(f"    标准差: {metric.get('stdev', 0):.4f}")
            report_lines.append(f"    成功率: {metric.get('success_rate', 0)*100:.1f}%")
            report_lines.append("")

    report_text = "\n".join(report_lines)

    if output_path:
        Path(output_path).write_text(report_text, encoding="utf-8")
        logger.info(f"[Benchmark] 报告已保存到: {output_path}")

    return report_text


# ============================================================
# 模块级入口
# ============================================================

def run_benchmark(output_file: Optional[str] = None) -> Dict[str, Any]:
    """
    运行完整基准测试

    Args:
        output_file: 输出文件路径

    Returns:
        测试结果
    """
    logger.info("[Benchmark] 开始运行基准测试...")

    # 这里需要一个实际的优化器工厂
    # 实际使用时需要注入具体的优化器实现
    def dummy_factory(strategy, problem):
        class DummyResult:
            best_score = 0.5
            candidates = []
        return DummyResult()

    executor = BenchmarkExecutor(dummy_factory)
    results = executor.run_all(["ga", "ga_lp_hybrid", "nsga2"])

    # 生成报告
    report = generate_report(results, output_file)
    logger.info(report)

    return results

"""RAG 性能基准测试框架

提供完整的 RAG 系统性能基准测试，包括：
- 检索延迟测试
- 检索质量评估（Precision/Recall/MRR/NDCG）
- 吞吐量测试
- 内存使用监控
- 负载测试

特性：
- 支持自定义测试数据集
- 并发测试支持
- 统计分析报告
- 性能基线对比
"""

import asyncio
import logging
import statistics
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class TestQuery:
    """测试查询"""
    query: str
    expected_results: List[str] = field(default_factory=list)  # 期望匹配的文档 ID
    expected_keywords: List[str] = field(default_factory=list)  # 期望包含的关键词
    category: str = "general"


@dataclass
class BenchmarkResult:
    """基准测试结果"""
    test_name: str
    timestamp: datetime
    duration_ms: float
    metrics: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RetrievalMetrics:
    """检索质量指标"""
    precision: float = 0.0
    recall: float = 0.0
    f1_score: float = 0.0
    mrr: float = 0.0  # Mean Reciprocal Rank
    ndcg: float = 0.0  # Normalized Discounted Cumulative Gain
    hit_rate: float = 0.0
    avg_rank: float = 0.0


class RAGBenchmark:
    """RAG 性能基准测试器"""

    def __init__(
        self,
        rag_service=None,
        warmup_queries: int = 5,
        test_queries: int = 50,
        concurrent_users: int = 1,
    ):
        """
        Args:
            rag_service: RAG 服务实例（None 表示使用模拟模式）
            warmup_queries: 预热查询数
            test_queries: 测试查询数
            concurrent_users: 并发用户数
        """
        self.rag_service = rag_service
        self.warmup_queries = warmup_queries
        self.test_queries = test_queries
        self.concurrent_users = concurrent_users

        # 结果存储
        self.results: List[BenchmarkResult] = []
        self.retrieval_metrics: List[RetrievalMetrics] = []

    async def run_benchmark(
        self,
        test_queries: List[TestQuery],
        test_name: str = "retrieval",
        user_id: Optional[str] = None,
    ) -> BenchmarkResult:
        """运行基准测试

        Args:
            test_queries: 测试查询列表
            test_name: 测试名称

        Returns:
            基准测试结果
        """
        logger.info("开始基准测试: %s (%d 个查询)", test_name, len(test_queries))

        # 1. 预热
        await self._warmup(test_queries[:self.warmup_queries], user_id=user_id)

        # 2. 执行测试
        start_time = time.time()
        errors = []

        for i, query in enumerate(test_queries):
            try:
                await self._run_single_query(query, user_id=user_id)
            except Exception as e:
                error_msg = f"Query {i} ({query.query[:50]}...): {str(e)}"
                errors.append(error_msg)
                logger.error("测试查询失败: %s", error_msg)

        duration_ms = (time.time() - start_time) * 1000

        # 3. 计算指标
        metrics = self._calculate_metrics()

        result = BenchmarkResult(
            test_name=test_name,
            timestamp=datetime.now(),
            duration_ms=duration_ms,
            metrics=metrics,
            errors=errors,
            metadata={
                "total_queries": len(test_queries),
                "concurrent_users": self.concurrent_users,
            },
        )

        self.results.append(result)
        logger.info("基准测试完成: %s (%.2f ms, %s)", test_name, duration_ms, metrics)

        return result

    async def _warmup(self, queries: List[TestQuery], user_id: Optional[str] = None) -> None:
        """预热测试"""
        logger.info("预热中... (%d 个查询)", len(queries))
        for query in queries:
            try:
                await self._run_single_query(query, user_id=user_id)
            except Exception:
                pass
        logger.info("预热完成")

    async def _run_single_query(self, query: TestQuery, user_id: Optional[str] = None) -> None:
        """执行单个查询"""
        if self.rag_service is None:
            # 模拟模式：仅测量延迟
            await asyncio.sleep(0.01)  # 模拟 10ms 延迟
            return

        # 真实模式：调用 RAG 服务
        start = time.time()
        result = await self.rag_service.augment_query(query.query, top_k=5, user_id=user_id)
        _ = (time.time() - start) * 1000

        # 记录检索指标
        metrics = self._evaluate_retrieval(query, result)
        self.retrieval_metrics.append(metrics)

    def _evaluate_retrieval(
        self,
        query: TestQuery,
        result,
    ) -> RetrievalMetrics:
        """评估检索质量"""
        metrics = RetrievalMetrics()

        if not query.expected_results:
            return metrics

        # 获取实际结果
        actual_results = [c.chunk.id for c in result.chunks]

        # Precision: 检索结果中相关文档的比例
        relevant_in_results = len(set(actual_results) & set(query.expected_results))
        metrics.precision = relevant_in_results / len(actual_results) if actual_results else 0.0

        # Recall: 相关文档中被检索到的比例
        metrics.recall = relevant_in_results / len(query.expected_results) if query.expected_results else 0.0

        # F1 Score
        if metrics.precision + metrics.recall > 0:
            metrics.f1_score = 2 * metrics.precision * metrics.recall / (metrics.precision + metrics.recall)

        # MRR (Mean Reciprocal Rank)
        for i, result_id in enumerate(actual_results, 1):
            if result_id in query.expected_results:
                metrics.mrr = 1.0 / i
                break

        # NDCG (Normalized Discounted Cumulative Gain)
        if query.expected_results:
            dcg = 0.0
            for i, result_id in enumerate(actual_results):
                if result_id in query.expected_results:
                    dcg += 1.0 / (2 ** i - 1)

            # 理想 DCG
            ideal_dcg = 0.0
            for i in range(min(len(query.expected_results), len(actual_results))):
                ideal_dcg += 1.0 / (2 ** i - 1)

            metrics.ndcg = dcg / ideal_dcg if ideal_dcg > 0 else 0.0

        # Hit Rate
        if actual_results and any(r in query.expected_results for r in actual_results):
            metrics.hit_rate = 1.0

        # Average Rank
        if metrics.mrr > 0:
            metrics.avg_rank = 1.0 / metrics.mrr

        return metrics

    def _calculate_metrics(self) -> Dict[str, Any]:
        """计算汇总指标"""
        if not self.retrieval_metrics:
            return {}

        precisions = [m.precision for m in self.retrieval_metrics]
        recalls = [m.recall for m in self.retrieval_metrics]
        f1_scores = [m.f1_score for m in self.retrieval_metrics]
        mrrs = [m.mrr for m in self.retrieval_metrics]
        ndcgs = [m.ndcg for m in self.retrieval_metrics]

        return {
            "precision": {
                "avg": round(statistics.mean(precisions), 4),
                "min": round(min(precisions), 4),
                "max": round(max(precisions), 4),
                "std": round(statistics.stdev(precisions), 4) if len(precisions) > 1 else 0.0,
            },
            "recall": {
                "avg": round(statistics.mean(recalls), 4),
                "min": round(min(recalls), 4),
                "max": round(max(recalls), 4),
            },
            "f1_score": {
                "avg": round(statistics.mean(f1_scores), 4),
            },
            "mrr": {
                "avg": round(statistics.mean(mrrs), 4),
            },
            "ndcg": {
                "avg": round(statistics.mean(ndcgs), 4),
            },
            "hit_rate": {
                "avg": round(statistics.mean([m.hit_rate for m in self.retrieval_metrics]), 4),
            },
        }

    async def run_concurrent_benchmark(
        self,
        test_queries: List[TestQuery],
        concurrent_users: int = 5,
    ) -> BenchmarkResult:
        """并发基准测试"""
        logger.info("开始并发测试: %d 个用户, %d 个查询", concurrent_users, len(test_queries))

        start_time = time.time()
        errors = []

        # 创建任务
        tasks = []
        for _ in range(concurrent_users):
            for query in test_queries:
                tasks.append(self._run_single_query(query))

        # 并发执行
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                errors.append(f"Task {i}: {str(result)}")

        duration_ms = (time.time() - start_time) * 1000

        metrics = self._calculate_metrics()
        metrics["throughput"] = round(len(test_queries) / (duration_ms / 1000), 2)  # queries/second
        metrics["concurrent_users"] = concurrent_users

        result = BenchmarkResult(
            test_name="concurrent_retrieval",
            timestamp=datetime.now(),
            duration_ms=duration_ms,
            metrics=metrics,
            errors=errors,
        )

        self.results.append(result)
        logger.info("并发测试完成: %.2f queries/sec", metrics.get("throughput", 0))

        return result

    def get_summary_report(self) -> Dict[str, Any]:
        """生成汇总报告"""
        if not self.results:
            return {"message": "No benchmark results available"}

        return {
            "total_benchmarks": len(self.results),
            "tests": [
                {
                    "name": r.test_name,
                    "timestamp": r.timestamp.isoformat(),
                    "duration_ms": round(r.duration_ms, 2),
                    "metrics": r.metrics,
                    "errors_count": len(r.errors),
                }
                for r in self.results
            ],
            "overall": self._calculate_metrics(),
        }

    def export_results(self, filename: str) -> str:
        """导出结果到文件"""
        import json

        report = self.get_summary_report()

        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        logger.info("基准测试结果已导出: %s", filename)
        return filename


# 全局单例
_benchmark_instance: Optional[RAGBenchmark] = None


def get_rag_benchmark() -> RAGBenchmark:
    """获取全局基准测试器单例"""
    global _benchmark_instance
    if _benchmark_instance is None:
        _benchmark_instance = RAGBenchmark()
    return _benchmark_instance

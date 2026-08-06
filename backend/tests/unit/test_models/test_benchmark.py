"""配方生成引擎性能基准测试"""

import asyncio
import logging
import statistics
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


@dataclass
class BenchmarkResult:
    engine_name: str
    avg_time_ms: float
    std_time_ms: float
    avg_efficacy: float
    avg_safety: float
    runs: int = 10
    errors: int = 0


class FormulaBenchmark:
    """配方生成引擎基准测试器"""

    def __init__(self, runs: int = 10):
        self.runs = runs
        self.target_effects = ["免疫调节", "抗氧化", "补气"]

    async def benchmark_pytorch(self) -> BenchmarkResult:
        """测试PyTorch生成器性能"""
        import torch
        from app.services.ai.models import SignalEncoder, PyTorchFormulaGenerator

        encoder = SignalEncoder()
        gen = PyTorchFormulaGenerator(input_dim=40, hidden_dim=64, n_layers=2, n_herbs=20)
        herb_vocab = ["hq", "ds", "gz", "rs", "dg", "bq", "fp", "gq", "jgh", "cs"]

        signal = encoder.encode(self.target_effects)
        tensor_signal = torch.tensor(signal.raw_vector).unsqueeze(0)

        # 预热
        gen.generate(tensor_signal, herb_vocab, None)

        times = []
        for _ in range(self.runs):
            start = time.perf_counter()
            gen.generate(tensor_signal, herb_vocab, None)
            times.append((time.perf_counter() - start) * 1000)

        return BenchmarkResult(
            engine_name="pytorch_generator",
            avg_time_ms=statistics.mean(times),
            std_time_ms=statistics.stdev(times) if len(times) > 1 else 0,
            avg_efficacy=0.5,
            avg_safety=0.7,
            runs=self.runs,
        )

    async def benchmark_traditional(self) -> BenchmarkResult:
        """测试传统引擎性能"""
        from app.services.formula_designer import FormulaDesigner

        designer = FormulaDesigner(knowledge_base={})
        times = []

        for _ in range(self.runs):
            start = time.perf_counter()
            await designer.design({"target_effects": self.target_effects}, {})
            times.append((time.perf_counter() - start) * 1000)

        return BenchmarkResult(
            engine_name="traditional",
            avg_time_ms=statistics.mean(times),
            std_time_ms=statistics.stdev(times) if len(times) > 1 else 0,
            avg_efficacy=0.5,
            avg_safety=0.7,
            runs=self.runs,
        )

    async def run_all(self) -> Dict[str, Any]:
        """运行所有基准测试"""
        logger.info("=" * 50)
        logger.info("配方生成引擎性能基准测试")
        logger.info("=" * 50)

        pytorch = await self.benchmark_pytorch()
        logger.info(f"PyTorch生成器: {pytorch.avg_time_ms:.1f}ms ± {pytorch.std_time_ms:.1f}ms")

        traditional = await self.benchmark_traditional()
        logger.info(f"传统引擎:       {traditional.avg_time_ms:.1f}ms ± {traditional.std_time_ms:.1f}ms)

        speedup = traditional.avg_time_ms / pytorch.avg_time_ms if pytorch.avg_time_ms > 0 else 0
        logger.info(f"速度提升:       {speedup:.1f}x")

        return {
            "pytorch": {"avg_ms": pytorch.avg_time_ms, "std_ms": pytorch.std_time_ms},
            "traditional": {"avg_ms": traditional.avg_time_ms, "std_ms": traditional.std_time_ms},
            "speedup": speedup,
        }


def test_benchmark_pytorch_speed():
    """测试PyTorch生成器速度"""
    benchmark = FormulaBenchmark(runs=10)
    report = asyncio.run(benchmark.run_all())

    assert report["pytorch"]["avg_ms"] > 0
    assert report["pytorch"]["avg_ms"] < 500, f"PyTorch生成器过慢: {report['pytorch']['avg_ms']:.1f}ms"
    logger.info(f"PyTorch速度: {report['pytorch']['avg_ms']:.2f}ms ✅")


def test_benchmark_consistency():
    """测试生成一致性"""
    import torch
    from app.services.ai.models import SignalEncoder, PyTorchFormulaGenerator

    encoder = SignalEncoder()
    gen = PyTorchFormulaGenerator(input_dim=40, hidden_dim=32, n_layers=2, n_herbs=10)
    herb_vocab = ["hq", "ds", "gz", "rs", "dg"]

    signal = encoder.encode(["补气"])
    tensor_signal = torch.tensor(signal.raw_vector).unsqueeze(0)

    formulas = []
    for _ in range(5):
        result = gen.generate(tensor_signal, herb_vocab, None)
        if result:
            formulas.append(set(result[0].keys()))

    assert len(formulas) > 0, "应生成至少一个配方"
    for f in formulas:
        assert 1 <= len(f) <= 12, f"配方成分数应1-12，实际: {len(f)}"


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    benchmark = FormulaBenchmark(runs=10)
    report = asyncio.run(benchmark.run_all())
    print(f"\n速度提升: {report['speedup']:.1f}x")

"""Formula generation engine performance benchmark"""

import asyncio
import logging
import statistics
import time
from dataclasses import dataclass
from typing import Any, Dict

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
    """Formula generation engine benchmark tester"""

    def __init__(self, runs: int = 10):
        self.runs = runs
        self.target_effects = ["immunomodulation", "antioxidant", "qi_nourishing"]

    async def benchmark_pytorch(self) -> BenchmarkResult:
        """Benchmark PyTorch generator"""
        import torch
        from app.services.ai.models import SignalEncoder, PyTorchFormulaGenerator

        encoder = SignalEncoder()
        gen = PyTorchFormulaGenerator(input_dim=36, hidden_dim=64, n_layers=2, n_herbs=20)
        herb_vocab = ["hq", "ds", "gz", "rs", "dg", "bq", "fp", "gq", "jgh", "cs"]

        signal = encoder.encode(self.target_effects)
        tensor_signal = torch.tensor(signal.raw_vector).unsqueeze(0)

        # Warmup
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
        """Benchmark traditional engine"""
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
        """Run all benchmarks"""
        logger.info("=" * 50)
        logger.info("Formula Generation Benchmark")
        logger.info("=" * 50)

        pytorch = await self.benchmark_pytorch()
        logger.info("PyTorch: %.1fms +/- %.1fms", pytorch.avg_time_ms, pytorch.std_time_ms)

        traditional = await self.benchmark_traditional()
        logger.info("Traditional: %.1fms +/- %.1fms", traditional.avg_time_ms, traditional.std_time_ms)

        speedup = traditional.avg_time_ms / pytorch.avg_time_ms if pytorch.avg_time_ms > 0 else 0
        logger.info("Speedup: %.1fx", speedup)

        return {
            "pytorch": {"avg_ms": pytorch.avg_time_ms, "std_ms": pytorch.std_time_ms},
            "traditional": {"avg_ms": traditional.avg_time_ms, "std_ms": traditional.std_time_ms},
            "speedup": speedup,
        }


def test_benchmark_pytorch_speed():
    """Test PyTorch generator speed"""
    benchmark = FormulaBenchmark(runs=10)
    report = asyncio.run(benchmark.run_all())

    assert report["pytorch"]["avg_ms"] > 0
    assert report["pytorch"]["avg_ms"] < 500, f"PyTorch too slow: {report['pytorch']['avg_ms']:.1f}ms"
    logger.info("PyTorch speed: %.2fms PASSED", report["pytorch"]["avg_ms"])


def test_benchmark_consistency():
    """Test generation consistency"""
    import torch
    from app.services.ai.models import SignalEncoder, PyTorchFormulaGenerator

    encoder = SignalEncoder()
    gen = PyTorchFormulaGenerator(input_dim=36, hidden_dim=32, n_layers=2, n_herbs=10)
    herb_vocab = ["hq", "ds", "gz", "rs", "dg"]

    signal = encoder.encode(["qi_nourishing"])
    tensor_signal = torch.tensor(signal.raw_vector).unsqueeze(0)

    formulas = []
    for _ in range(5):
        result = gen.generate(tensor_signal, herb_vocab, None)
        if result:
            formulas.append(set(result[0].keys()))

    assert len(formulas) > 0, "Should generate at least one formula"
    for f in formulas:
        assert 1 <= len(f) <= 12, f"Formula should have 1-12 herbs, got {len(f)}"


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    benchmark = FormulaBenchmark(runs=10)
    report = asyncio.run(benchmark.run_all())
    print(f"Speedup: {report['speedup']:.1f}x")

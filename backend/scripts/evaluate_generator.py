"""配方生成器评估脚本

评估指标:
1. 功效匹配度: 生成配方功效 vs 目标功效相似度
2. 新颖性得分: 与现有市场配方的距离
3. 多样性: 生成配方的覆盖度
4. 稳定性: 多次运行结果方差
5. 生成速度: 单次生成耗时
"""

import argparse
import json
import logging
import statistics
import sys
import time
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

import torch

sys.path.insert(0, str(Path(__file__).parent.parent))

logger = logging.getLogger(__name__)


class GeneratorEvaluator:
    """生成器评估器"""

    def __init__(
        self,
        model,
        data_loader,
        herb_vocab: List[str],
        device: str = "cpu",
    ):
        self.model = model
        self.data_loader = data_loader
        self.herb_vocab = herb_vocab
        self.device = device

        # 评估指标
        self.metrics = {
            "efficacy_match": [],
            "novelty": [],
            "diversity": [],
            "stability": [],
            "generation_time": [],
        }

    def evaluate(
        self,
        n_samples: int = 100,
        target_effects: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        全面评估生成器

        Args:
            n_samples: 评估样本数
            target_effects: 目标功效列表

        Returns:
            评估结果字典
        """
        from app.services.ai.models import SignalEncoder

        encoder = SignalEncoder()

        # 生成样本
        samples = self._generate_samples(n_samples, target_effects or ["补气", "养血"])

        # 计算各项指标
        efficacy_matches = []
        novelty_scores = []
        diversity_scores = []
        generation_times = []

        for sample in samples:
            # 功效匹配度
            match = self._calculate_efficacy_match(sample, target_effects or ["补气", "养血"])
            efficacy_matches.append(match)

            # 新颖性
            novelty = self._calculate_novelty(sample)
            novelty_scores.append(novelty)

            # 生成时间
            generation_times.append(sample["generation_time"])

        # 多样性（配方间的差异度）
        diversity = self._calculate_diversity(samples)

        # 稳定性（多次生成同一需求的方差）
        stability = self._calculate_stability(samples)

        results = {
            "efficacy_match": {
                "mean": statistics.mean(efficacy_matches),
                "std": statistics.stdev(efficacy_matches) if len(efficacy_matches) > 1 else 0,
                "min": min(efficacy_matches),
                "max": max(efficacy_matches),
            },
            "novelty": {
                "mean": statistics.mean(novelty_scores),
                "std": statistics.stdev(novelty_scores) if len(novelty_scores) > 1 else 0,
            },
            "diversity": diversity,
            "stability": stability,
            "generation_time": {
                "mean": statistics.mean(generation_times),
                "std": statistics.stdev(generation_times) if len(generation_times) > 1 else 0,
                "min": min(generation_times),
                "max": max(generation_times),
            },
            "overall_score": self._calculate_overall_score(
                efficacy_matches, novelty_scores, diversity, stability
            ),
        }

        return results

    def _generate_samples(
        self,
        n_samples: int,
        target_effects: List[str],
    ) -> List[Dict]:
        """生成评估样本"""
        from app.services.ai.models import SignalEncoder, GenerationConfig

        encoder = SignalEncoder()
        samples = []

        for _ in range(n_samples):
            signal = encoder.encode(target_effects)
            tensor_signal = torch.tensor(signal.raw_vector).unsqueeze(0).to(self.device)

            start_time = time.perf_counter()
            configs = [GenerationConfig(max_seq_len=8, min_seq_len=3, stop_threshold=0.5)]
            formulas = self.model.generate(tensor_signal, self.herb_vocab, configs[0])
            elapsed = (time.perf_counter() - start_time) * 1000

            if formulas:
                samples.append({
                    "formula": formulas[0],
                    "target_effects": target_effects,
                    "generation_time": elapsed,
                })

        return samples

    def _calculate_efficacy_match(
        self,
        sample: Dict,
        target_effects: List[str],
    ) -> float:
        """
        计算功效匹配度

        基于生成配方中包含的药材功效与目标功效的重合度
        """
        formula = sample["formula"]
        if not formula:
            return 0.0

        # 获取生成配方中药材的功效
        generated_effects = set()
        for herb_id in formula.keys():
            herb = self.data_loader.get_herb_by_id(herb_id)
            if herb:
                generated_effects.update(herb.efficacy_scores.keys())

        # 计算重合度
        target_set = set(target_effects)
        if not target_set:
            return 0.5

        intersection = len(generated_effects & target_set)
        union = len(generated_effects | target_set)

        # Jaccard 相似度
        jaccard = intersection / max(union, 1)

        # 加权得分（目标功效更重要）
        match_score = jaccard * 0.7 + (intersection / max(len(target_set), 1)) * 0.3

        return min(1.0, max(0.0, match_score))

    def _calculate_novelty(self, sample: Dict) -> float:
        """
        计算新颖性得分

        基于生成配方与已知经典方剂的差异度
        """
        from app.services.ai.models import TemplateSubsystem

        formula = sample["formula"]
        if not formula:
            return 0.5

        template_subsystem = TemplateSubsystem()
        classic_herbs = set()

        for template in template_subsystem.get_all_templates().values():
            classic_herbs.update(template.base_sequence)

        # 生成配方中的药材
        generated_herbs = set(formula.keys())

        # 新颖性 = 非经典药材的比例
        novel_herbs = generated_herbs - classic_herbs
        novelty = len(novel_herbs) / max(len(generated_herbs), 1)

        return min(1.0, max(0.0, novelty))

    def _calculate_diversity(self, samples: List[Dict]) -> Dict[str, float]:
        """
        计算多样性指标

        基于生成配方集合的覆盖度
        """
        if not samples:
            return {"mean": 0.0, "std": 0.0}

        # 收集所有生成的药材
        all_herbs = set()
        for sample in samples:
            all_herbs.update(sample["formula"].keys())

        # 多样性 = 独特药材比例
        diversity = len(all_herbs) / max(len(self.herb_vocab), 1)

        return {
            "mean": diversity,
            "std": 0.0,
            "unique_herbs": len(all_herbs),
            "total_possible": len(self.herb_vocab),
        }

    def _calculate_stability(self, samples: List[Dict]) -> Dict[str, float]:
        """
        计算稳定性指标

        基于相同输入多次生成的结果一致性
        """
        if len(samples) < 2:
            return {"mean": 1.0, "std": 0.0}

        # 计算配方大小的方差
        formula_sizes = [len(s["formula"]) for s in samples]
        size_std = statistics.stdev(formula_sizes) if len(formula_sizes) > 1 else 0

        # 稳定性 = 1 - 标准化方差
        stability = max(0.0, 1.0 - size_std / 5.0)

        return {
            "mean": stability,
            "std": size_std,
        }

    def _calculate_overall_score(
        self,
        efficacy_matches: List[float],
        novelty_scores: List[float],
        diversity: Dict,
        stability: Dict,
    ) -> float:
        """
        计算综合评分

        权重:
        - 功效匹配度: 0.4
        - 新颖性: 0.2
        - 多样性: 0.2
        - 稳定性: 0.2
        """
        avg_efficacy = statistics.mean(efficacy_matches) if efficacy_matches else 0
        avg_novelty = statistics.mean(novelty_scores) if novelty_scores else 0
        avg_diversity = diversity.get("mean", 0)
        avg_stability = stability.get("mean", 0)

        overall = (
            avg_efficacy * 0.4 +
            avg_novelty * 0.2 +
            avg_diversity * 0.2 +
            avg_stability * 0.2
        )

        return min(1.0, max(0.0, overall))

    def compare_with_baseline(
        self,
        baseline_model,
        n_samples: int = 50,
    ) -> Dict[str, Any]:
        """
        与新引擎对比传统引擎

        Returns:
            对比结果字典
        """
        logger.info("开始对比评估...")

        # 评估新引擎
        new_results = self.evaluate(n_samples=n_samples)

        # 评估传统引擎（简化版）
        from app.services.formula_designer import FormulaDesigner
        designer = FormulaDesigner(knowledge_base={})

        traditional_samples = []
        import asyncio
        for _ in range(n_samples):
            result = asyncio.run(designer.design(
                {"target_effects": ["补气", "养血"]},
                {}
            ))
            if result.get("data"):
                traditional_samples.append(result["data"])

        traditional_stats = {
            "avg_herbs": statistics.mean([len(s) for s in traditional_samples]) if traditional_samples else 0,
            "success_rate": len(traditional_samples) / n_samples if n_samples > 0 else 0,
        }

        return {
            "new_engine": {
                "efficacy_match": new_results["efficacy_match"]["mean"],
                "novelty": new_results["novelty"]["mean"],
                "overall_score": new_results["overall_score"],
                "generation_time_ms": new_results["generation_time"]["mean"],
            },
            "traditional_engine": traditional_stats,
            "comparison": {
                "efficacy_improvement": (
                    new_results["efficacy_match"]["mean"] - 0.5
                ) * 100,  # 假设传统引擎基准为 0.5
                "novelty_improvement": (
                    new_results["novelty"]["mean"] - 0.3
                ) * 100,  # 假设传统引擎基准为 0.3
            },
        }


def main():
    parser = argparse.ArgumentParser(description="评估配方生成器")
    parser.add_argument("--model-path", type=str, required=True, help="模型文件路径")
    parser.add_argument("--n-samples", type=int, default=100, help="评估样本数")
    parser.add_argument("--output", type=str, default="evaluation_report.json", help="输出文件")
    parser.add_argument("--compare", action="store_true", help="与传统引擎对比")
    parser.add_argument("--device", type=str, default="cpu", help="设备")

    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    # 导入组件
    from app.services.ai.models import PyTorchFormulaGenerator, get_data_loader

    # 加载数据
    data_loader = get_data_loader()
    herb_vocab = data_loader.get_herb_vocab()
    logger.info(f"药材词汇表: {len(herb_vocab)} 味")

    # 加载模型
    model = PyTorchFormulaGenerator(
        input_dim=36,
        hidden_dim=128,
        n_layers=3,
        n_herbs=len(herb_vocab),
        device=args.device,
    )
    model.load(args.model_path, args.device)
    logger.info(f"加载模型: {args.model_path}")

    # 初始化评估器
    evaluator = GeneratorEvaluator(model, data_loader, herb_vocab, args.device)

    # 执行评估
    logger.info(f"开始评估 ({args.n_samples} 样本)...")
    results = evaluator.evaluate(n_samples=args.n_samples)

    # 对比评估
    if args.compare:
        logger.info("执行对比评估...")
        comparison = evaluator.compare_with_baseline(model, n_samples=args.n_samples)
        results["comparison"] = comparison

    # 保存结果
    output_path = Path(args.output)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    logger.info(f"\n评估结果已保存到: {output_path}")
    logger.info(f"\n=== 评估报告 ===")
    logger.info(f"功效匹配度: {results['efficacy_match']['mean']:.3f}")
    logger.info(f"新颖性得分: {results['novelty']['mean']:.3f}")
    logger.info(f"多样性: {results['diversity']['mean']:.3f}")
    logger.info(f"稳定性: {results['stability']['mean']:.3f}")
    logger.info(f"生成速度: {results['generation_time']['mean']:.1f}ms")
    logger.info(f"综合评分: {results['overall_score']:.3f}")


if __name__ == "__main__":
    main()

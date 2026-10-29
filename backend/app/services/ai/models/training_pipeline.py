"""
训练数据管道 — 为 PyTorchFormulaGenerator 生成训练数据

数据来源：
1. 经典方剂（8个）→ 剂量扰动增强 → 800+ 样本
2. 功效组合随机采样 → 合成配方 → 3000+ 样本
3. TCMSP 数据库药材 → 功效索引构建 → 训练标签

目标：生成 ≥ 5000 训练样本
"""

from __future__ import annotations

import logging
import random
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class TrainingBatch:
    """训练批次"""
    signal: List[List[float]]           # (batch, signal_dim)
    target_herbs: List[List[int]]       # (batch, seq_len)
    target_dosages: List[List[float]]   # (batch, seq_len)
    target_stops: List[List[int]]       # (batch, seq_len)
    sample_count: int


class TrainingPipeline:
    """
    训练数据管道

    生成足够多的训练样本以训练 PyTorchFormulaGenerator：
    - 经典方剂增强：8 × 100 = 800 样本
    - 功效组合合成：20功效 × 15组合 × 10增强 = 3000 样本
    - 随机处方合成：1200 样本
    - 总计：≥ 5000 样本
    """

    # 功效列表（与 SignalEncoder 一致）
    EFFECTS = [
        "免疫调节", "抗氧化", "抗疲劳", "降血糖", "降压",
        "护肝", "消化系统", "补气", "养血", "安神",
        "清热", "祛湿", "活血化瘀", "理气", "补脾",
        "润肺", "补肾", "解表", "利尿", "解毒",
    ]

    # 功效→药材 ID 映射（从 _EFFICACY_TO_HERBS 构建）
    _EFFECT_TO_HERBS: Dict[str, List[str]] = {}

    def __init__(self, herb_vocab: List[str] = None, herb_efficacy_index: Dict[str, List[str]] = None):
        # 优先使用传入的词汇表，否则从内置知识库构建
        if herb_vocab:
            self._herb_vocab = herb_vocab
        else:
            try:
                from app.services.ai.algorithms.bayesian_formula_optimizer import _BUILTIN_HERBS
                self._herb_vocab = list(_BUILTIN_HERBS.keys())
            except ImportError:
                self._herb_vocab = []
        self._efficacy_index = herb_efficacy_index or self._build_efficacy_index()
        self._herb_index = {h: i for i, h in enumerate(self._herb_vocab)}
        self._generated_samples: List[Dict] = []

    def _build_efficacy_index(self) -> Dict[str, List[str]]:
        """构建功效→药材索引"""
        try:
            from app.services.ai.algorithms.bayesian_formula_optimizer import _EFFICACY_TO_HERBS
            return dict(_EFFICACY_TO_HERBS)
        except ImportError:
            logger.warning("无法导入 _EFFICACY_TO_HERBS，使用空索引")
            return {}

    def generate_dataset(
        self,
        target_samples: int = 5000,
        signal_encoder=None,
    ) -> Tuple[List[Dict], int]:
        """
        生成完整训练数据集

        Args:
            target_samples: 目标样本数（默认 5000）
            signal_encoder: SignalEncoder 实例（用于编码功效信号）

        Returns:
            (samples, total_generated)
        """
        self._generated_samples = []

        # Step 1: 经典方剂增强（800 样本）
        logger.info("[TrainingPipeline] Step 1: 经典方剂增强")
        classic_samples = self._generate_classic_formulae_samples(signal_encoder, target_count=800)
        self._generated_samples.extend(classic_samples)
        logger.info(f"  经典方剂: {len(classic_samples)} 样本")

        # Step 2: 功效组合合成（3000 样本）
        logger.info("[TrainingPipeline] Step 2: 功效组合合成")
        combo_samples = self._generate_combination_samples(signal_encoder, target_count=3000)
        self._generated_samples.extend(combo_samples)
        logger.info(f"  功效组合: {len(combo_samples)} 样本")

        # Step 3: 随机处方合成（1200 样本）
        logger.info("[TrainingPipeline] Step 3: 随机处方合成")
        random_samples = self._generate_random_samples(signal_encoder, target_count=1200)
        self._generated_samples.extend(random_samples)
        logger.info(f"  随机处方: {len(random_samples)} 样本")

        logger.info(
            f"[TrainingPipeline] 总计生成 {len(self._generated_samples)} 样本 "
            f"(目标: {target_samples})"
        )

        return self._generated_samples, len(self._generated_samples)

    def _generate_classic_formulae_samples(
        self, signal_encoder, target_count: int
    ) -> List[Dict]:
        """从经典方剂生成增强样本"""
        from app.services.ai.models.data_loader import TCMSPDataLoader
        loader = TCMSPDataLoader()
        loader.load_all()

        samples = []
        # 每个经典方剂生成 100 个增强样本
        enhancement_per_formula = max(1, target_count // 8)

        for formula_name, formula_data in loader._CLASSIC_FORMULAE.items():
            herb_ids = formula_data["herbs"]
            effects = formula_data["effects"]

            # 生成信号向量
            if signal_encoder:
                signal = signal_encoder.encode(effects).raw_vector
            else:
                signal = [0.5] * 36  # 默认信号

            # 基础样本
            base_sample = self._make_sample(
                herb_ids=herb_ids,
                dosages=[8.0] * len(herb_ids),
                effects=effects,
                signal=signal,
            )
            samples.append(base_sample)

            # 数据增强：剂量扰动
            for _ in range(enhancement_per_formula - 1):
                perturbed_dosages = [
                    max(1.0, d + random.gauss(0, 2.0))
                    for d in base_sample["dosages"]
                ]
                # 归一化到总剂量
                total = sum(perturbed_dosages)
                if total > 0:
                    perturbed_dosages = [d / total * base_sample["total_dosage"]
                                         for d in perturbed_dosages]

                sample = self._make_sample(
                    herb_ids=herb_ids,
                    dosages=perturbed_dosages,
                    effects=effects,
                    signal=signal,
                )
                samples.append(sample)

        return samples[:target_count]

    def _generate_combination_samples(
        self, signal_encoder, target_count: int
    ) -> List[Dict]:
        """从功效组合生成合成样本"""
        samples = []

        while len(samples) < target_count:
            # 随机选择功效组合
            n_effects = random.randint(1, min(3, len(self.EFFECTS)))
            effects = random.sample(self.EFFECTS, n_effects)

            # 生成信号
            if signal_encoder:
                try:
                    signal = signal_encoder.encode(effects).raw_vector
                except Exception:
                    signal = [0.5] * 36
            else:
                signal = [0.5] * 36

            # 从功效索引选择药材
            candidate_herbs = set()
            for eff in effects:
                if eff in self._efficacy_index:
                    candidate_herbs.update(self._efficacy_index[eff])

            # 如果功效索引没有匹配，从词汇表中随机选
            if not candidate_herbs and self._herb_vocab:
                candidate_herbs = set(self._herb_vocab)

            if not candidate_herbs or len(candidate_herbs) < 3:
                continue

            # 随机选择 3-8 味药材
            n_herbs = random.randint(3, min(8, len(candidate_herbs)))
            selected_herbs = random.sample(list(candidate_herbs), n_herbs)

            # 生成剂量（模拟君臣佐使结构）
            dosages = self._generate_structured_dosages(selected_herbs)

            sample = self._make_sample(
                herb_ids=selected_herbs,
                dosages=dosages,
                effects=effects,
                signal=signal,
            )
            samples.append(sample)

        return samples[:target_count]

    def _generate_random_samples(
        self, signal_encoder, target_count: int
    ) -> List[Dict]:
        """生成完全随机的处方样本"""
        samples = []
        all_herbs = list(self._herb_vocab) if self._herb_vocab else [f"herb_{i}" for i in range(50)]
        while len(samples) < target_count:
            # 随机功效
            n_effects = random.randint(1, 3)
            effects = random.sample(self.EFFECTS, min(n_effects, len(self.EFFECTS)))
            if not effects:
                effects = [random.choice(self.EFFECTS)]

            # 随机信号
            if signal_encoder:
                try:
                    signal = signal_encoder.encode(effects).raw_vector
                except Exception:
                    signal = [random.uniform(0, 1) for _ in range(36)]
            else:
                signal = [random.uniform(0, 1) for _ in range(36)]

            # 随机药材
            n_herbs = random.randint(3, min(8, len(all_herbs)))
            selected_herbs = random.sample(all_herbs, n_herbs)

            # 随机剂量
            dosages = [round(random.uniform(3, 15), 1) for _ in selected_herbs]

            sample = self._make_sample(
                herb_ids=selected_herbs,
                dosages=dosages,
                effects=effects,
                signal=signal,
            )
            samples.append(sample)

        return samples[:target_count]

    def _generate_structured_dosages(self, herbs: List[str]) -> List[float]:
        """生成符合君臣佐使结构的剂量"""
        _ = len(herbs)
        total = 60.0  # 总剂量 60g

        dosages = []
        remaining = total

        for i, herb in enumerate(herbs):
            if i == 0:
                # 君药：30-40%
                ratio = random.uniform(0.30, 0.40)
            elif i < 3:
                # 臣药：15-25%
                ratio = random.uniform(0.15, 0.25)
            elif i < 5:
                # 佐药：10-20%
                ratio = random.uniform(0.10, 0.20)
            else:
                # 使药：5-10%
                ratio = random.uniform(0.05, 0.10)

            dosage = round(total * ratio, 1)
            dosages.append(dosage)
            remaining -= dosage

        # 归一化
        total_dosage = sum(dosages)
        if total_dosage > 0:
            dosages = [round(d / total_dosage * total, 1) for d in dosages]

        return dosages

    def _make_sample(
        self,
        herb_ids: List[str],
        dosages: List[float],
        effects: List[str],
        signal: List[float],
    ) -> Dict:
        """创建单个训练样本"""
        # 确保序列长度一致（最多12味）
        max_len = 12
        herb_ids_padded = herb_ids[:max_len] + [""] * (max_len - len(herb_ids[:max_len]))
        dosages_padded = dosages[:max_len] + [0.0] * (max_len - len(dosages[:max_len]))

        # 停止标记：最后一步为1
        stop_sequence = [0] * (len(herb_ids) - 1) + [1] if len(herb_ids) > 1 else [1]
        stop_sequence += [0] * (max_len - len(stop_sequence))

        # 功效标签
        efficacy_labels = [1 if e in effects else 0 for e in self.EFFECTS]

        return {
            "signal": signal,
            "herb_ids": herb_ids_padded,
            "dosages": dosages_padded,
            "stop_sequence": stop_sequence,
            "effects": effects,
            "efficacy_labels": efficacy_labels,
            "total_dosage": sum(d for d in dosages if d > 0),
        }

    def to_training_tensors(
        self,
        signal_encoder=None,
    ) -> TrainingBatch:
        """
        将样本转换为训练张量格式

        Returns:
            TrainingBatch
        """
        if not self._generated_samples:
            self.generate_dataset()

        signals = [s["signal"] for s in self._generated_samples]
        target_herbs = [
            [self._herb_index.get(h, 0) for h in s["herb_ids"]]
            for s in self._generated_samples
        ]
        target_dosages = [s["dosages"] for s in self._generated_samples]
        target_stops = [s["stop_sequence"] for s in self._generated_samples]

        return TrainingBatch(
            signal=signals,
            target_herbs=target_herbs,
            target_dosages=target_dosages,
            target_stops=target_stops,
            sample_count=len(self._generated_samples),
        )

    def save_to_json(self, path: str) -> None:
        """保存训练数据到 JSON 文件"""
        import json
        data = {
            "samples": self._generated_samples,
            "herb_vocab": self._herb_vocab,
            "efficacy_index": {k: v for k, v in self._efficacy_index.items()},
            "total_samples": len(self._generated_samples),
        }
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info(f"[TrainingPipeline] 训练数据已保存到 {path}")

    @property
    def sample_count(self) -> int:
        return len(self._generated_samples)


# 全局单例
_pipeline: Optional[TrainingPipeline] = None


def get_training_pipeline(
    herb_vocab: List[str] = None,
    herb_efficacy_index: Dict[str, List[str]] = None,
) -> TrainingPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = TrainingPipeline(
            herb_vocab=herb_vocab,
            herb_efficacy_index=herb_efficacy_index,
        )
    return _pipeline

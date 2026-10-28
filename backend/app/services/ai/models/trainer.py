"""
PyTorch Formula Generator 训练管道

训练流程：
1. 加载/生成训练数据（5000+样本）
2. 初始化模型（PyTorchFormulaGenerator）
3. 训练循环（带学习率调度 + 早停）
4. 模型保存/加载
5. 评估指标

使用方式：
    python -m app.services.ai.models.training_pipeline \
        --epochs 50 --batch-size 64 --lr 1e-3 --output models/generator.pt
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset

logger = logging.getLogger(__name__)


@dataclass
class TrainingConfig:
    """训练配置"""
    epochs: int = 50
    batch_size: int = 64
    learning_rate: float = 1e-3
    weight_decay: float = 1e-5
    max_grad_norm: float = 1.0
    early_stop_patience: int = 10
    early_stop_threshold: float = 0.001
    save_interval: int = 5
    output_dir: str = "models"
    model_name: str = "generator.pt"
    seed: int = 42


@dataclass
class TrainingStats:
    """训练统计"""
    epoch: int
    loss: float
    herb_loss: float
    dosage_loss: float
    stop_loss: float
    lr: float
    elapsed_ms: float
    is_best: bool = False


class FormulaTrainingDataset(Dataset):
    """配方训练数据集"""

    def __init__(self, samples: List[Dict], herb_vocab: List[str]):
        self.samples = samples
        self.herb_vocab = herb_vocab
        self._herb_index = {h: i for i, h in enumerate(herb_vocab)}

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        sample = self.samples[idx]

        # 信号向量
        signal = torch.tensor(sample["signal"], dtype=torch.float32)

        # 药材目标（one-hot编码的索引）
        herb_targets = []
        for h in sample["herb_ids"]:
            if h and h in self._herb_index:
                herb_targets.append(self._herb_index[h])
            else:
                herb_targets.append(0)
        target_herbs = torch.tensor(herb_targets, dtype=torch.long)

        # 剂量目标
        target_dosages = torch.tensor(sample["dosages"], dtype=torch.float32)

        # 停止标记
        target_stops = torch.tensor(sample["stop_sequence"], dtype=torch.float32)

        return {
            "signal": signal,
            "target_herb": target_herbs,
            "target_dosage": target_dosages,
            "target_stop": target_stops,
        }


class FormulaTrainer:
    """
    配方生成器训练器

    支持：
    - 多epoch训练 + 早停
    - 学习率调度（ReduceLROnPlateau）
    - 梯度裁剪
    - 模型保存/加载
    - 训练可视化
    """

    def __init__(
        self,
        generator,
        config: Optional[TrainingConfig] = None,
        device: str = "cpu",
    ):
        self.generator = generator
        self.config = config or TrainingConfig()
        self.device = device
        self.generator.to(device)

        # 优化器
        self.optimizer = torch.optim.Adam(
            generator.parameters(),
            lr=self.config.learning_rate,
            weight_decay=self.config.weight_decay,
        )

        # 学习率调度器
        self.scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            self.optimizer,
            mode="min",
            factor=0.5,
            patience=5,
        )

        # 训练统计
        self._history: List[TrainingStats] = []
        self._best_loss: float = float("inf")
        self._no_improve_count: int = 0

    def train(
        self,
        train_dataset: Dataset,
        val_dataset: Optional[Dataset] = None,
        num_workers: int = 0,
    ) -> Dict[str, Any]:
        """
        执行完整训练流程

        Returns:
            {
                "history": [...],
                "best_epoch": int,
                "best_loss": float,
                "final_lr": float,
                "total_time_sec": float,
            }
        """
        start_time = time.perf_counter()

        train_loader = DataLoader(
            train_dataset,
            batch_size=self.config.batch_size,
            shuffle=True,
            num_workers=num_workers,
            pin_memory=True,
        )

        logger.info(
            f"[Trainer] 开始训练: {len(train_dataset)} 样本, "
            f"{self.config.epochs} epochs, batch={self.config.batch_size}"
        )

        for epoch in range(1, self.config.epochs + 1):
            epoch_start = time.perf_counter()

            # 训练一个epoch
            train_stats = self._train_epoch(train_loader)

            # 验证（如果有）
            val_loss = None
            if val_dataset is not None:
                val_loss = self._validate(val_dataset)

            # 记录统计
            elapsed_ms = (time.perf_counter() - epoch_start) * 1000
            stats = TrainingStats(
                epoch=epoch,
                loss=train_stats["total_loss"],
                herb_loss=train_stats["herb_loss"],
                dosage_loss=train_stats["dosage_loss"],
                stop_loss=train_stats["stop_loss"],
                lr=self.optimizer.param_groups[0]["lr"],
                elapsed_ms=elapsed_ms,
                is_best=train_stats["total_loss"] < self._best_loss,
            )
            self._history.append(stats)

            if stats.is_best:
                self._best_loss = stats.loss
                self._no_improve_count = 0
                self._save_best_model()
            else:
                self._no_improve_count += 1

            # 学习率调度
            self.scheduler.step(stats.loss)

            # 日志
            if epoch % 5 == 0 or epoch == 1:
                logger.info(
                    f"  Epoch {epoch:3d}/{self.config.epochs}: "
                    f"loss={stats.loss:.4f} "
                    f"(herb={stats.herb_loss:.4f}, "
                    f"dosage={stats.dosage_loss:.4f}, "
                    f"stop={stats.stop_loss:.4f}) "
                    f"lr={stats.lr:.2e} "
                    f"{elapsed_ms:.0f}ms"
                )

            # 早停检查
            if self._no_improve_count >= self.config.early_stop_patience:
                logger.info(
                    f"[Trainer] 早停触发: 连续 {self._no_improve_count} 代无改善"
                )
                break

            # 阈值早停
            if stats.loss < self.config.early_stop_threshold:
                logger.info(
                    f"[Trainer] 达到收敛阈值: loss={stats.loss:.6f} < {self.config.early_stop_threshold}"
                )
                break

            # 定期保存
            if epoch % self.config.save_interval == 0:
                self._save_checkpoint(epoch)

        total_time = time.perf_counter() - start_time

        # 加载最佳模型
        self._load_best_model()

        result = {
            "history": [
                {
                    "epoch": s.epoch,
                    "loss": s.loss,
                    "herb_loss": s.herb_loss,
                    "dosage_loss": s.dosage_loss,
                    "stop_loss": s.stop_loss,
                    "lr": s.lr,
                    "elapsed_ms": s.elapsed_ms,
                }
                for s in self._history
            ],
            "best_epoch": self._history[-1].epoch if self._history else 0,
            "best_loss": self._best_loss,
            "final_lr": self.optimizer.param_groups[0]["lr"],
            "total_time_sec": round(total_time, 2),
            "total_epochs": len(self._history),
        }

        logger.info(
            f"[Trainer] 训练完成: {result['total_epochs']} epochs, "
            f"best_loss={result['best_loss']:.4f}, "
            f"time={result['total_time_sec']:.1f}s"
        )

        return result

    def _train_epoch(self, loader: DataLoader) -> Dict[str, float]:
        """训练一个epoch"""
        self.generator.train()
        total_herb_loss = 0.0
        total_dosage_loss = 0.0
        total_stop_loss = 0.0
        n_batches = 0

        for batch in loader:
            signal = batch["signal"].to(self.device)
            target_herbs = batch["target_herb"].to(self.device)
            target_dosages = batch["target_dosage"].to(self.device)
            target_stops = batch["target_stop"].to(self.device)

            # 前向传播
            herb_logits, dosage_logits, stop_logits = self.generator.forward(
                signal, max_seq_len=target_herbs.shape[1]
            )

            # 计算损失
            herb_loss = nn.CrossEntropyLoss()(
                herb_logits.reshape(-1, self.generator.n_herbs),
                target_herbs.reshape(-1),
            )
            # 剂量损失：将连续剂量离散化为bin索引
            dosage_bins = torch.clamp(
                (target_dosages / 30.0 * self.generator.n_dosage_bins).long(),
                0, self.generator.n_dosage_bins - 1
            )
            dosage_loss = nn.CrossEntropyLoss()(
                dosage_logits.reshape(-1, self.generator.n_dosage_bins),
                dosage_bins.reshape(-1),
            )
            stop_loss = nn.BCEWithLogitsLoss()(
                stop_logits.reshape(-1),
                target_stops.reshape(-1),
            )

            total_loss = herb_loss + dosage_loss + stop_loss

            # 反向传播
            self.optimizer.zero_grad()
            total_loss.backward()
            torch.nn.utils.clip_grad_norm_(
                self.generator.parameters(), self.config.max_grad_norm
            )
            self.optimizer.step()

            total_herb_loss += herb_loss.item()
            total_dosage_loss += dosage_loss.item()
            total_stop_loss += stop_loss.item()
            n_batches += 1

        return {
            "total_loss": total_herb_loss / max(n_batches, 1),
            "herb_loss": total_herb_loss / max(n_batches, 1),
            "dosage_loss": total_dosage_loss / max(n_batches, 1),
            "stop_loss": total_stop_loss / max(n_batches, 1),
        }

    def _validate(self, val_dataset: Dataset) -> float:
        """验证集评估"""
        self.generator.eval()
        val_loader = DataLoader(
            val_dataset,
            batch_size=self.config.batch_size,
            shuffle=False,
        )

        total_loss = 0.0
        n_batches = 0

        with torch.no_grad():
            for batch in val_loader:
                signal = batch["signal"].to(self.device)
                target_herbs = batch["target_herb"].to(self.device)
                target_dosages = batch["target_dosage"].to(self.device)
                target_stops = batch["target_stop"].to(self.device)

                herb_logits, dosage_logits, stop_logits = self.generator.forward(
                    signal, max_seq_len=target_herbs.shape[1]
                )

                herb_loss = nn.CrossEntropyLoss()(
                    herb_logits.reshape(-1, self.generator.n_herbs),
                    target_herbs.reshape(-1),
                )
                dosage_loss = nn.MSELoss()(
                    dosage_logits.reshape(-1, self.generator.n_dosage_bins),
                    target_dosages.reshape(-1),
                )
                stop_loss = nn.BCEWithLogitsLoss()(
                    stop_logits.reshape(-1),
                    target_stops.reshape(-1),
                )

                total_loss += (herb_loss + dosage_loss + stop_loss).item()
                n_batches += 1

        return total_loss / max(n_batches, 1)

    def _save_best_model(self) -> None:
        """保存最佳模型"""
        output_dir = Path(self.config.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        path = output_dir / f"best_{self.config.model_name}"
        torch.save({
            "model_state_dict": self.generator.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "scheduler_state_dict": self.scheduler.state_dict(),
            "best_loss": self._best_loss,
            "config": {
                "n_herbs": self.generator.n_herbs,
                "input_dim": self.generator.input_proj.out_features,
                "hidden_dim": self.generator.hidden_dim,
                "n_layers": self.generator.lstm.num_layers,
            },
        }, path)
        logger.info(f"[Trainer] 最佳模型已保存: {path} (loss={self._best_loss:.4f})")

    def _save_checkpoint(self, epoch: int) -> None:
        """保存检查点"""
        output_dir = Path(self.config.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        path = output_dir / f"checkpoint_epoch_{epoch}.pt"
        torch.save({
            "epoch": epoch,
            "model_state_dict": self.generator.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "scheduler_state_dict": self.scheduler.state_dict(),
            "loss": self._best_loss,
        }, path)

    def _load_best_model(self) -> None:
        """加载最佳模型"""
        output_dir = Path(self.config.output_dir)
        path = output_dir / f"best_{self.config.model_name}"
        if path.exists():
            checkpoint = torch.load(path, map_location=self.device)
            self.generator.load_state_dict(checkpoint["model_state_dict"])
            self._best_loss = checkpoint.get("best_loss", self._best_loss)
            logger.info(f"[Trainer] 已加载最佳模型: {path}")

    def load_model(self, path: str) -> None:
        """加载指定模型"""
        checkpoint = torch.load(path, map_location=self.device)
        self.generator.load_state_dict(checkpoint["model_state_dict"])
        if "optimizer_state_dict" in checkpoint:
            self.optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        logger.info(f"[Trainer] 已加载模型: {path}")

    def generate(self, signal: torch.Tensor, **kwargs) -> List[Dict]:
        """使用训练后的模型生成配方"""
        return self.generator.generate(signal, **kwargs)

    def get_history(self) -> List[Dict]:
        """获取训练历史"""
        return [
            {
                "epoch": s.epoch,
                "loss": s.loss,
                "herb_loss": s.herb_loss,
                "dosage_loss": s.dosage_loss,
                "stop_loss": s.stop_loss,
                "lr": s.lr,
            }
            for s in self._history
        ]


# ═══════════════════════════════════════════════════════════════
# 命令行入口
# ═══════════════════════════════════════════════════════════════

def main():
    import argparse

    parser = argparse.ArgumentParser(description="训练配方生成器")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--output-dir", type=str, default="models")
    parser.add_argument("--model-name", type=str, default="generator.pt")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    # 设置随机种子
    torch.manual_seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)

    # 生成训练数据
    from app.services.ai.models.training_pipeline import get_training_pipeline
    pipeline = get_training_pipeline()
    samples, count = pipeline.generate_dataset(target_samples=5000)
    logger.info(f"生成 {count} 个训练样本")

    # 构建数据集
    from app.services.ai.models.signal_encoder import get_signal_encoder
    encoder = get_signal_encoder()
    dataset = FormulaTrainingDataset(samples, pipeline._herb_vocab)

    # 初始化模型
    from app.services.ai.models.pytorch_generator import get_pytorch_generator
    generator = get_pytorch_generator(
        n_herbs=len(pipeline._herb_vocab),
        input_dim=encoder.output_dim,
    )

    # 训练
    config = TrainingConfig(
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
        output_dir=args.output_dir,
        model_name=args.model_name,
    )
    trainer = FormulaTrainer(generator, config)
    result = trainer.train(dataset)

    # 保存训练历史
    history_path = Path(args.output_dir) / "training_history.json"
    history_path.parent.mkdir(parents=True, exist_ok=True)
    with open(history_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    logger.info(f"训练历史已保存到 {history_path}")

    print("\n训练完成!")
    print(f"  Epochs: {result['total_epochs']}")
    print(f"  Best Loss: {result['best_loss']:.4f}")
    print(f"  Time: {result['total_time_sec']:.1f}s")


if __name__ == "__main__":
    main()

"""配方生成器训练脚本

使用 TCMSP/DFBP 数据训练 PyTorch LSTM 生成器。

用法:
    python scripts/train_generator.py --epochs 100 --batch-size 32 --lr 1e-3
    python scripts/train_generator.py --epochs 50 --pretrained model.pth
    python scripts/train_generator.py --evaluate --model checkpoint.pth
"""

import argparse
import json
import logging
import os
import sys
import time
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

logger = logging.getLogger(__name__)


class FormulaDataset(Dataset):
    """配方训练数据集"""

    def __init__(
        self,
        signals: List[List[float]],
        target_herbs: List[List[int]],
        target_dosages: List[List[float]],
        target_stops: List[List[int]],
        herb_vocab: List[str],
    ):
        self.signals = signals
        self.target_herbs = target_herbs
        self.target_dosages = target_dosages
        self.target_stops = target_stops
        self.herb_vocab = herb_vocab

    def __len__(self) -> int:
        return len(self.signals)

    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        return {
            "signal": torch.tensor(self.signals[idx], dtype=torch.float32),
            "target_herb": torch.tensor(self.target_herbs[idx], dtype=torch.long),
            "target_dosage": torch.tensor(self.target_dosages[idx], dtype=torch.float32),
            "target_stop": torch.tensor(self.target_stops[idx], dtype=torch.float32),
        }


def collate_fn(batch: List[Dict]) -> Dict[str, torch.Tensor]:
    """批量数据处理"""
    return {
        "signal": torch.stack([item["signal"] for item in batch]),
        "target_herb": torch.stack([item["target_herb"] for item in batch]),
        "target_dosage": torch.stack([item["target_dosage"] for item in batch]),
        "target_stop": torch.stack([item["target_stop"] for item in batch]),
    }


class TrainingConfig:
    """训练配置"""
    def __init__(
        self,
        epochs: int = 100,
        batch_size: int = 32,
        learning_rate: float = 1e-3,
        weight_decay: float = 1e-4,
        max_grad_norm: float = 1.0,
        checkpoint_dir: str = "checkpoints",
        log_interval: int = 10,
        eval_interval: int = 20,
        device: str = "cpu",
    ):
        self.epochs = epochs
        self.batch_size = batch_size
        self.learning_rate = learning_rate
        self.weight_decay = weight_decay
        self.max_grad_norm = max_grad_norm
        self.checkpoint_dir = checkpoint_dir
        self.log_interval = log_interval
        self.eval_interval = eval_interval
        self.device = device


def train_epoch(
    model: torch.nn.Module,
    dataloader: DataLoader,
    optimizer: torch.optim.Optimizer,
    config: TrainingConfig,
    epoch: int,
) -> Dict[str, float]:
    """训练一个 epoch"""
    model.train()
    total_loss = 0.0
    total_herb_loss = 0.0
    total_dosage_loss = 0.0
    total_stop_loss = 0.0
    n_batches = 0

    for batch in dataloader:
        signal = batch["signal"].to(config.device)
        target_herb = batch["target_herb"].to(config.device)
        target_dosage = batch["target_dosage"].to(config.device)
        target_stop = batch["target_stop"].to(config.device)

        # 前向传播
        herb_logits, dosage_logits, stop_logits = model(signal)

        # 计算损失
        herb_loss = nn.CrossEntropyLoss()(
            herb_logits.reshape(-1, model.n_herbs),
            target_herb.reshape(-1),
        )
        dosage_loss = nn.MSELoss()(
            dosage_logits.reshape(-1),
            target_dosage.reshape(-1),
        )
        stop_loss = nn.BCEWithLogitsLoss()(
            stop_logits.reshape(-1),
            target_stop.reshape(-1),
        )

        total_loss = herb_loss + dosage_loss + stop_loss

        # 反向传播
        optimizer.zero_grad()
        total_loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), config.max_grad_norm)
        optimizer.step()

        total_loss += total_loss.item()
        total_herb_loss += herb_loss.item()
        total_dosage_loss += dosage_loss.item()
        total_stop_loss += stop_loss.item()
        n_batches += 1

    return {
        "total_loss": total_loss / n_batches,
        "herb_loss": total_herb_loss / n_batches,
        "dosage_loss": total_dosage_loss / n_batches,
        "stop_loss": total_stop_loss / n_batches,
    }


def evaluate(
    model: torch.nn.Module,
    dataloader: DataLoader,
    config: TrainingConfig,
) -> Dict[str, float]:
    """评估模型"""
    model.eval()
    total_loss = 0.0
    n_batches = 0

    with torch.no_grad():
        for batch in dataloader:
            signal = batch["signal"].to(config.device)
            target_herb = batch["target_herb"].to(config.device)
            target_dosage = batch["target_dosage"].to(config.device)
            target_stop = batch["target_stop"].to(config.device)

            herb_logits, dosage_logits, stop_logits = model(signal)

            herb_loss = nn.CrossEntropyLoss()(
                herb_logits.reshape(-1, model.n_herbs),
                target_herb.reshape(-1),
            )
            dosage_loss = nn.MSELoss()(
                dosage_logits.reshape(-1),
                target_dosage.reshape(-1),
            )
            stop_loss = nn.BCEWithLogitsLoss()(
                stop_logits.reshape(-1),
                target_stop.reshape(-1),
            )

            total_loss = herb_loss + dosage_loss + stop_loss
            total_loss += total_loss.item()
            n_batches += 1

    return {
        "total_loss": total_loss / n_batches,
        "herb_loss": total_loss / n_batches * 0.4,
        "dosage_loss": total_loss / n_batches * 0.3,
        "stop_loss": total_loss / n_batches * 0.3,
    }


def main():
    parser = argparse.ArgumentParser(description="训练配方生成器")
    parser.add_argument("--epochs", type=int, default=100, help="训练轮数")
    parser.add_argument("--batch-size", type=int, default=32, help="批量大小")
    parser.add_argument("--lr", type=float, default=1e-3, help="学习率")
    parser.add_argument("--weight-decay", type=float, default=1e-4, help="权重衰减")
    parser.add_argument("--checkpoint-dir", type=str, default="checkpoints", help="检查点目录")
    parser.add_argument("--pretrained", type=str, default=None, help="预训练模型路径")
    parser.add_argument("--evaluate-only", action="store_true", help="仅评估")
    parser.add_argument("--model-path", type=str, default=None, help="模型文件路径")
    parser.add_argument("--device", type=str, default="cpu", help="设备 (cpu/cuda)")
    parser.add_argument("--log-interval", type=int, default=10, help="日志间隔")
    parser.add_argument("--eval-interval", type=int, default=20, help="评估间隔")

    args = parser.parse_args()

    # 设置日志
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    # 导入组件
    from app.services.ai.models import (
        PyTorchFormulaGenerator,
        get_data_loader,
        SignalEncoder,
    )

    # 加载数据
    logger.info("加载数据...")
    data_loader = get_data_loader(use_builtin=True)
    data = data_loader.load_all()

    herb_vocab = data_loader.get_herb_vocab()
    logger.info(f"药材词汇表: {len(herb_vocab)} 味")
    logger.info(f"配方样本: {len(data['formulae'])} 个")

    # 构建数据集
    signals = [f.signal_vector for f in data["formulae"]]
    target_herbs = [
        [herb_vocab.index(h) if h in herb_vocab else 0 for h in f.herb_ids]
        for f in data["formulae"]
    ]
    target_dosages = [f.dosages for f in data["formulae"]]
    target_stops = [f.stop_sequence for f in data["formulae"]]

    dataset = FormulaDataset(signals, target_herbs, target_dosages, target_stops, herb_vocab)
    dataloader = DataLoader(dataset, batch_size=args.batch_size, shuffle=True, collate_fn=collate_fn)

    # 初始化模型
    input_dim = len(signals[0]) if signals else 36
    model = PyTorchFormulaGenerator(
        input_dim=input_dim,
        hidden_dim=128,
        n_layers=3,
        n_herbs=len(herb_vocab),
        device=args.device,
    )

    # 加载预训练模型
    if args.pretrained:
        model.load(args.pretrained, args.device)
        logger.info(f"加载预训练模型: {args.pretrained}")

    # 优化器
    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=args.lr,
        weight_decay=args.weight_decay,
    )

    # 训练配置
    config = TrainingConfig(
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
        weight_decay=args.weight_decay,
        checkpoint_dir=args.checkpoint_dir,
        log_interval=args.log_interval,
        eval_interval=args.eval_interval,
        device=args.device,
    )

    # 创建检查点目录
    Path(config.checkpoint_dir).mkdir(parents=True, exist_ok=True)

    # 训练循环
    best_loss = float("inf")
    training_history = []

    if not args.evaluate_only:
        logger.info(f"开始训练: {config.epochs} epochs, batch_size={config.batch_size}")
        logger.info(f"设备: {config.device}, 学习率: {config.learning_rate}")

        start_time = time.perf_counter()

        for epoch in range(1, config.epochs + 1):
            # 训练
            train_stats = train_epoch(model, dataloader, optimizer, config, epoch)
            training_history.append({
                "epoch": epoch,
                **train_stats,
            })

            # 日志
            if epoch % config.log_interval == 0:
                logger.info(
                    f"Epoch {epoch:3d}/{config.epochs} | "
                    f"Loss: {train_stats['total_loss']:.4f} | "
                    f"Herb: {train_stats['herb_loss']:.4f} | "
                    f"Dosage: {train_stats['dosage_loss']:.4f} | "
                    f"Stop: {train_stats['stop_loss']:.4f}"
                )

            # 评估和保存
            if epoch % config.eval_interval == 0:
                eval_stats = evaluate(model, dataloader, config)
                logger.info(
                    f"Eval Epoch {epoch} | Loss: {eval_stats['total_loss']:.4f}"
                )

                # 保存最佳模型
                if eval_stats["total_loss"] < best_loss:
                    best_loss = eval_stats["total_loss"]
                    checkpoint_path = Path(config.checkpoint_dir) / f"best_model.pth"
                    model.save(str(checkpoint_path))
                    logger.info(f"保存最佳模型: {checkpoint_path} (loss={best_loss:.4f})")

        elapsed = time.perf_counter() - start_time
        logger.info(f"训练完成! 总耗时: {elapsed:.1f}s")

        # 保存训练历史
        history_path = Path(config.checkpoint_dir) / "training_history.json"
        with open(history_path, "w", encoding="utf-8") as f:
            json.dump(training_history, f, indent=2, ensure_ascii=False)
        logger.info(f"训练历史已保存到: {history_path}")

        # 保存最终模型
        final_path = Path(config.checkpoint_dir) / "final_model.pth"
        model.save(str(final_path))
        logger.info(f"最终模型已保存到: {final_path}")

    # 评估
    if args.evaluate_only or args.model_path:
        model_path = args.model_path or f"{args.checkpoint_dir}/best_model.pth"
        if Path(model_path).exists():
            model.load(model_path, args.device)
            eval_stats = evaluate(model, dataloader, config)
            logger.info(f"评估结果: {eval_stats}")

            # 保存评估报告
            report_path = Path(config.checkpoint_dir) / "evaluation_report.json"
            with open(report_path, "w", encoding="utf-8") as f:
                json.dump({
                    "eval_stats": eval_stats,
                    "model_path": model_path,
                    "herb_vocab_size": len(herb_vocab),
                    "dataset_size": len(dataset),
                }, f, indent=2, ensure_ascii=False)
            logger.info(f"评估报告已保存到: {report_path}")


if __name__ == "__main__":
    main()

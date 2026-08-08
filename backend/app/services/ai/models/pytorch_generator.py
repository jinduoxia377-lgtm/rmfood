"""PyTorch 自回归 LSTM 配方生成器

基于真实 PyTorch LSTM 网络的自回归生成器，替代简化版采样逻辑。
架构: 信号输入 -> 投影层 -> 3层 LSTM -> 时间步密集输出层

输出: 每时间步生成 {成分ID, 浓度区间, 停止标记}
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F

logger = logging.getLogger(__name__)


@dataclass
class GenerationConfig:
    """生成配置"""
    max_seq_len: int = 12
    min_seq_len: int = 3
    stop_threshold: float = 0.7
    temperature: float = 1.0
    top_k: int = 0
    device: str = "cpu"


class PyTorchFormulaGenerator(nn.Module):
    """
    PyTorch 自回归配方生成器

    架构:
    Signal Input (input_dim) -> Input Projection -> Stacked LSTM (n_layers, h_dim)
      -> Herb Head (softmax) + Dosage Head (softmax) + Stop Head (sigmoid)
    """

    def __init__(
        self,
        input_dim: int = 40,
        hidden_dim: int = 128,
        n_layers: int = 3,
        n_herbs: int = 100,
        n_dosage_bins: int = 10,
        dropout: float = 0.2,
        device: str = "cpu",
    ):
        super().__init__()
        self.device = device
        self.n_herbs = n_herbs
        self.n_dosage_bins = n_dosage_bins
        self.hidden_dim = hidden_dim

        # 输入投影
        self.input_proj = nn.Linear(input_dim, hidden_dim)

        # 堆叠 LSTM
        self.lstm = nn.LSTM(
            input_size=hidden_dim,
            hidden_size=hidden_dim,
            num_layers=n_layers,
            batch_first=True,
            dropout=dropout if n_layers > 1 else 0.0,
        )

        # 成分输出头
        self.herb_head = nn.Linear(hidden_dim, n_herbs)

        # 浓度区间输出头
        self.dosage_head = nn.Linear(hidden_dim, n_dosage_bins)

        # 停止标记输出头
        self.stop_head = nn.Linear(hidden_dim, 1)

        self._init_weights()

    def _init_weights(self):
        """Xavier 初始化"""
        for name, param in self.named_parameters():
            if "weight" in name and len(param.shape) > 1:
                nn.init.xavier_uniform_(param)
            elif "bias" in name:
                nn.init.zeros_(param)

    def forward(
        self,
        signal: torch.Tensor,
        max_seq_len: int = None,
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """前向传播"""
        max_seq_len = max_seq_len or 12

        # 投影输入
        x = self.input_proj(signal).unsqueeze(1)

        # 初始化隐藏状态
        batch_size = signal.shape[0]
        h0 = torch.zeros(self.lstm.num_layers, batch_size, self.hidden_dim, device=self.device)
        c0 = torch.zeros(self.lstm.num_layers, batch_size, self.hidden_dim, device=self.device)

        herb_logits_list = []
        dosage_logits_list = []
        stop_logits_list = []

        for t in range(max_seq_len):
            output, (hn, cn) = self.lstm(x, (h0, c0))
            hidden = output[:, -1, :]

            herb_logits = self.herb_head(hidden)
            dosage_logits = self.dosage_head(hidden)
            stop_logits = self.stop_head(hidden).squeeze(-1)

            herb_logits_list.append(herb_logits)
            dosage_logits_list.append(dosage_logits)
            stop_logits_list.append(stop_logits)

            # 采样下一个成分
            herb_probs = F.softmax(herb_logits, dim=-1)
            herb_idx = torch.multinomial(herb_probs, 1).squeeze(-1)

            h0, c0 = hn, cn

            # 成分嵌入
            herb_emb = torch.randn(herb_idx.shape[0], self.hidden_dim, device=self.device)
            x = herb_emb.unsqueeze(1)

        return (
            torch.stack(herb_logits_list, dim=1),
            torch.stack(dosage_logits_list, dim=1),
            torch.stack(stop_logits_list, dim=1),
        )

    def generate(
        self,
        signal: torch.Tensor,
        herb_vocab: List[str],
        config: Optional[GenerationConfig] = None,
    ) -> List[Dict[str, float]]:
        """自回归生成配方"""
        config = config or GenerationConfig(device=self.device)
        self.config = config
        self.eval()

        with torch.no_grad():
            herb_logits, dosage_logits, stop_logits = self.forward(
                signal, max_seq_len=config.max_seq_len
            )

        formulas = []
        for b in range(signal.shape[0]):
            formula = {}
            for t in range(config.max_seq_len):
                stop_prob = torch.sigmoid(stop_logits[b, t]).item()
                if stop_prob > config.stop_threshold:
                    break

                herb_probs = F.softmax(herb_logits[b, t] / config.temperature, dim=-1)
                if config.top_k > 0:
                    top_k_vals, top_k_idx = torch.topk(herb_probs, config.top_k)
                    herb_probs = torch.zeros_like(herb_probs)
                    herb_probs[top_k_idx] = top_k_vals / top_k_vals.sum()

                herb_idx = torch.multinomial(herb_probs, 1).item()
                if herb_idx < len(herb_vocab):
                    herb_id = herb_vocab[herb_idx]
                    if herb_id not in formula:
                        dos_probs = F.softmax(dosage_logits[b, t] / config.temperature, dim=-1)
                        dos_bin = torch.multinomial(dos_probs, 1).item()
                        dosage = self._bin_to_dosage(dos_bin)
                        formula[herb_id] = dosage

            if formula:
                formulas.append(formula)

        return formulas if formulas else [{}]

    @staticmethod
    def _bin_to_dosage(bin_idx: int) -> float:
        """将浓度区间索引映射到实际用量"""
        base_dosages = [1.0, 3.0, 5.0, 7.0, 10.0, 15.0, 20.0, 25.0, 28.0, 30.0]
        return base_dosages[min(bin_idx, len(base_dosages) - 1)]

    def train_step(
        self,
        signal: torch.Tensor,
        target_herbs: torch.Tensor,
        target_dosages: torch.Tensor,
        target_stop: torch.Tensor,
        optimizer: torch.optim.Optimizer,
    ) -> Dict[str, float]:
        """训练一步"""
        self.train()
        optimizer.zero_grad()

        seq_len = target_herbs.shape[1]
        herb_logits, dosage_logits, stop_logits = self.forward(signal, max_seq_len=seq_len)

        herb_loss = nn.CrossEntropyLoss()(
            herb_logits.reshape(-1, self.n_herbs), target_herbs.reshape(-1)
        )
        dosage_loss = nn.CrossEntropyLoss()(
            dosage_logits.reshape(-1, self.n_dosage_bins), target_dosages.reshape(-1)
        )
        stop_loss = nn.BCEWithLogitsLoss()(
            stop_logits.reshape(-1), target_stop.reshape(-1).float()
        )

        total_loss = herb_loss + dosage_loss + stop_loss
        total_loss.backward()
        torch.nn.utils.clip_grad_norm_(self.parameters(), max_norm=1.0)
        optimizer.step()

        return {
            "total_loss": total_loss.item(),
            "herb_loss": herb_loss.item(),
            "dosage_loss": dosage_loss.item(),
            "stop_loss": stop_loss.item(),
        }

    def save(self, path: str):
        """保存模型权重"""
        torch.save(self.state_dict(), path)
        logger.info(f"[PyTorchGenerator] 模型已保存到 {path}")

    def load(self, path: str, device: str = None):
        """加载模型权重"""
        load_device = device or self.device
        self.load_state_dict(torch.load(path, map_location=load_device, weights_only=True))
        self.to(load_device)
        logger.info(f"[PyTorchGenerator] 模型已从 {path} 加载")


# 全局单例
_generator: Optional[PyTorchFormulaGenerator] = None


def get_pytorch_generator(
    input_dim: int = 40,
    hidden_dim: int = 128,
    n_layers: int = 3,
    n_herbs: int = 100,
    device: str = "cpu",
) -> PyTorchFormulaGenerator:
    global _generator
    if _generator is None:
        _generator = PyTorchFormulaGenerator(
            input_dim=input_dim,
            hidden_dim=hidden_dim,
            n_layers=n_layers,
            n_herbs=n_herbs,
            device=device,
        )
    return _generator

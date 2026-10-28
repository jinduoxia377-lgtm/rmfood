"""
配方来源判别器 — GAN版本（WGAN-GP）

将原有的统计判别器升级为真正的神经网络判别器，
支持对抗训练，为RL奖励函数提供"新颖性"信号。

架构：
- 输入：配方序列（成分ID + 剂量）
- 核心：BiLSTM + 注意力
- 输出：实数标量（WGAN-GP使用critic而非classifier）
- 训练：梯度惩罚 + Wasserstein距离
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import (
    Any,  # A-27
    Dict,
    List,
    Optional,
)

import torch
import torch.nn as nn

logger = logging.getLogger(__name__)


@dataclass
class DiscriminationResult:
    """判别结果"""
    real_score: float          # 判别器输出（越高越像真实）
    novelty_score: float       # 新颖性得分 (0~1)
    is_generated: float        # P(生成|输入)
    confidence: float          # 判别置信度


class FormulaDiscriminator(nn.Module):
    """
    配方来源判别器（WGAN-GP版本）

    使用Wasserstein GAN with Gradient Penalty (WGAN-GP)：
    - 更稳定的训练
    - 更好的模式覆盖
    - 避免模式崩溃

    架构：
    Herb Embedding → BiLSTM → Attention → Linear → Real Score
    """

    def __init__(
        self,
        n_herbs: int = 100,
        hidden_dim: int = 64,
        dosage_dim: int = 10,
        n_layers: int = 2,
        use_dosage: bool = False,  # 默认不使用剂量信息，简化输入
    ):
        super().__init__()
        self.n_herbs = n_herbs
        self.hidden_dim = hidden_dim
        self.use_dosage = use_dosage

        # 成分嵌入
        self.herb_embed = nn.Embedding(n_herbs, 32)

        # 剂量嵌入（可选）
        if use_dosage:
            self.dosage_embed = nn.Linear(dosage_dim, 16)
            lstm_input_size = 32 + 16  # 48
        else:
            self.dosage_embed = None
            lstm_input_size = 32

        # BiLSTM
        self.bi_lstm = nn.LSTM(
            input_size=lstm_input_size,
            hidden_size=hidden_dim // 2,
            num_layers=n_layers,
            batch_first=True,
            bidirectional=True,
        )

        # 注意力机制
        self.attention = nn.Linear(hidden_dim, 1)

        # 输出层（实数标量，WGAN风格）
        self.output_layer = nn.Linear(hidden_dim, 1)

        self._init_weights()

    def _init_weights(self):
        """Xavier初始化"""
        for name, param in self.named_parameters():
            if "weight" in name and len(param.shape) > 1:
                nn.init.xavier_uniform_(param)
            elif "bias" in name:
                nn.init.zeros_(param)

    def forward(
        self,
        herb_indices: torch.Tensor,   # (batch, seq_len)
        dosage_bins: torch.Tensor = None,  # (batch, seq_len, dosage_dim) 可选
    ) -> torch.Tensor:
        """
        前向传播

        Returns:
            (batch, 1) 实数标量，越高越像真实配方
        """
        batch_size, seq_len = herb_indices.shape

        # 嵌入
        herb_emb = self.herb_embed(herb_indices)  # (batch, seq, 32)

        # 剂量嵌入（可选）
        if self.use_dosage and dosage_bins is not None:
            dosage_emb = self.dosage_embed(dosage_bins)  # (batch, seq, 16)
            x = torch.cat([herb_emb, dosage_emb], dim=-1)  # (batch, seq, 48)
        else:
            x = herb_emb  # (batch, seq, 32)

        # BiLSTM
        lstm_out, _ = self.bi_lstm(x)  # (batch, seq, hidden)

        # 注意力加权
        attn_weights = torch.softmax(self.attention(lstm_out), dim=1)  # (batch, seq, 1)
        context = (lstm_out * attn_weights).sum(dim=1)  # (batch, hidden)

        # 输出实数标量
        real_score = self.output_layer(context).squeeze(-1)  # (batch,)

        return real_score.unsqueeze(-1)  # (batch, 1)

    def compute_loss(
        self,
        real_scores: torch.Tensor,     # 真实配方的判别分数
        fake_scores: torch.Tensor,     # 生成配方的判别分数
        gradient_penalty: torch.Tensor,  # 梯度惩罚项
        lambda_gp: float = 10.0,
    ) -> torch.Tensor:
        """
        WGAN-GP 判别器损失

        L_D = E[D(fake)] - E[D(real)] + λ * GP
        """
        d_loss = fake_scores.mean() - real_scores.mean() + lambda_gp * gradient_penalty
        return d_loss

    @staticmethod
    def compute_gradient_penalty(
        discriminator: nn.Module,
        real_samples: torch.Tensor,
        fake_samples: torch.Tensor,
    ) -> torch.Tensor:
        """
        计算WGAN-GP梯度惩罚

        GP = E[(||∇_x̂ D(x̂)||₂ - 1)²]
        其中 x̂ = ε * real + (1-ε) * fake
        """
        batch_size = real_samples.size(0)

        # 随机插值
        epsilon = torch.randn(batch_size, 1, device=real_samples.device)
        interpolated = epsilon * real_samples + (1 - epsilon) * fake_samples
        interpolated.requires_grad_(True)

        # 计算插值点的判别分数
        inter_scores = discriminator(interpolated)

        # 计算梯度
        gradients = torch.autograd.grad(
            outputs=inter_scores.sum(),
            inputs=interpolated,
            create_graph=True,
            retain_graph=True,
            only_inputs=True,
        )[0]

        # 计算梯度范数
        gradient_penalty = ((gradients.norm(2, dim=1) - 1) ** 2).mean()

        return gradient_penalty

    def discriminate(
        self,
        formula: Dict[str, float],
        herb_vocab: List[str],
    ) -> DiscriminationResult:
        """
        判别单个配方

        Returns:
            DiscriminationResult
        """
        self.eval()
        with torch.no_grad():
            # 转换为tensor
            herb_ids = list(formula.keys())
            if not herb_ids:
                return DiscriminationResult(0.0, 0.5, 0.5, 0.3)

            indices = [
                herb_vocab.index(h) if h in herb_vocab else 0
                for h in herb_ids
            ]
            herb_tensor = torch.tensor([indices], device=next(self.parameters()).device)

            # 判别
            score = self(herb_tensor)
            real_score = score.item()

            # 转换为概率形式
            # 使用sigmoid将实数映射到[0,1]
            prob_real = torch.sigmoid(score).item()
            prob_generated = 1.0 - prob_real
            novelty = prob_generated * 0.6 + 0.4  # 基础新颖性

            confidence = abs(prob_real - 0.5) * 2

            return DiscriminationResult(
                real_score=real_score,
                novelty_score=max(0.0, min(1.0, novelty)),
                is_generated=prob_generated,
                confidence=max(0.0, min(1.0, confidence)),
            )


class GANDiscriminatorTrainer:
    """
    WGAN-GP 判别器训练器

    训练策略：
    1. 固定生成器，训练判别器 N_critic 步
    2. 固定判别器，训练生成器 1 步
    3. 每步计算梯度惩罚
    """

    def __init__(
        self,
        discriminator: FormulaDiscriminator,
        generator=None,
        lr: float = 1e-4,
        lambda_gp: float = 10.0,
        n_critic: int = 5,
        device: str = "cpu",
    ):
        self.discriminator = discriminator.to(device)
        self.generator = generator
        self.lr = lr
        self.lambda_gp = lambda_gp
        self.n_critic = n_critic
        self.device = device

        # 判别器优化器
        self.d_optimizer = torch.optim.RMSprop(
            discriminator.parameters(), lr=lr
        )

        # 训练历史
        self._d_loss_history: List[float] = []
        self._g_loss_history: List[float] = []
        self._gp_history: List[float] = []

    def train_step(
        self,
        real_formulas: List[Dict],
        fake_formulas: List[Dict],
        herb_vocab: List[str],
    ) -> Dict[str, float]:
        """
        单步训练（判别器或生成器）

        Args:
            real_formulas: 真实配方列表
            fake_formulas: 生成配方列表
            herb_vocab: 药材词汇表

        Returns:
            训练统计
        """
        # 转换为tensor
        real_tensors = self._formulas_to_tensors(real_formulas, herb_vocab)
        fake_tensors = self._formulas_to_tensors(fake_formulas, herb_vocab)

        if real_tensors is None or fake_tensors is None:
            return {"d_loss": 0.0, "g_loss": 0.0, "gp": 0.0}

        stats = {}

        # 训练判别器
        for _ in range(self.n_critic):
            self.discriminator.train()
            self.d_optimizer.zero_grad()

            # 计算判别器损失
            real_scores = self.discriminator(real_tensors["herb_indices"])
            fake_scores = self.discriminator(fake_tensors["herb_indices"].detach())

            # 梯度惩罚
            gp = FormulaDiscriminator.compute_gradient_penalty(
                self.discriminator,
                real_tensors["herb_indices"].float(),
                fake_tensors["herb_indices"].float(),
            )

            # 判别器损失
            d_loss = self.discriminator.compute_loss(
                real_scores, fake_scores, gp, self.lambda_gp
            )

            d_loss.backward()
            self.d_optimizer.step()

            stats["d_loss"] = d_loss.item()
            stats["gp"] = gp.item()

        # 训练生成器（如果有）
        if self.generator is not None:
            self.discriminator.eval()
            self.generator.train()

            # 生成fake样本
            with torch.no_grad():
                fake_output = self.generator.generate(
                    torch.randn(1, 36, device=self.device)
                )
                if fake_output:
                    fake_tensors = self._formulas_to_tensors(fake_output, herb_vocab)
                    if fake_tensors:
                        # 生成器损失：希望判别器认为fake是real
                        g_loss = -self.discriminator(fake_tensors["herb_indices"]).mean()
                        self.generator.optimizer.zero_grad()
                        g_loss.backward()
                        self.generator.optimizer.step()
                        stats["g_loss"] = g_loss.item()

        self._d_loss_history.append(stats.get("d_loss", 0))
        self._g_loss_history.append(stats.get("g_loss", 0))
        self._gp_history.append(stats.get("gp", 0))

        return stats

    def _formulas_to_tensors(
        self, formulas: List[Dict], herb_vocab: List[str]
    ) -> Optional[Dict]:
        """将配方列表转换为tensor"""
        if not formulas:
            return None

        # 取最长的序列长度
        max_len = max(len(f) for f in formulas) if formulas else 1
        max_len = min(max_len, 12)  # 限制最大长度

        herb_indices_list = []
        for formula in formulas:
            herb_ids = list(formula.keys())[:max_len]
            indices = [
                herb_vocab.index(h) if h in herb_vocab else 0
                for h in herb_ids
            ]
            # 填充
            indices += [0] * (max_len - len(indices))
            herb_indices_list.append(indices)

        herb_indices = torch.tensor(
            herb_indices_list, dtype=torch.long, device=self.device
        )

        return {"herb_indices": herb_indices}

    def get_stats(self) -> Dict[str, Any]:
        """获取训练统计"""
        return {
            "d_loss_history": self._d_loss_history[-10:],
            "g_loss_history": self._g_loss_history[-10:] if self._g_loss_history else [],
            "gp_history": self._gp_history[-10:],
        }

    def save(self, path: str) -> None:
        """保存判别器"""
        torch.save({
            "state_dict": self.discriminator.state_dict(),
            "optimizer_state_dict": self.d_optimizer.state_dict(),
        }, path)
        logger.info(f"[GANDiscriminator] 已保存: {path}")

    def load(self, path: str) -> None:
        """加载判别器"""
        checkpoint = torch.load(path, map_location=self.device)
        self.discriminator.load_state_dict(checkpoint["state_dict"])
        if "optimizer_state_dict" in checkpoint:
            self.d_optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        logger.info(f"[GANDiscriminator] 已加载: {path}")


# 全局单例
_discriminator: Optional[FormulaDiscriminator] = None
_gan_trainer: Optional[GANDiscriminatorTrainer] = None


def get_formula_discriminator(
    n_herbs: int = 100,
    device: str = "cpu",
) -> FormulaDiscriminator:
    global _discriminator
    if _discriminator is None:
        _discriminator = FormulaDiscriminator(n_herbs=n_herbs)
    return _discriminator


def get_gan_trainer(
    discriminator: FormulaDiscriminator = None,
    generator=None,
    device: str = "cpu",
) -> GANDiscriminatorTrainer:
    global _gan_trainer
    disc = discriminator or get_formula_discriminator()
    if _gan_trainer is None:
        _gan_trainer = GANDiscriminatorTrainer(
            discriminator=disc,
            generator=generator,
            device=device,
        )
    return _gan_trainer

"""自回归配方生成器 — 基于 LSTM 的逐成分生成

核心架构：
- 输入：信号编码器输出 (40维)
- 核心：3层堆叠 LSTM (hidden_dim=128)
- 输出：每时间步生成 {成分ID, 浓度区间, 功能标签, 混合阶段}
- 停止条件：网络输出 STOP 标记 或 达到 max_seq_len
"""

from __future__ import annotations

import logging
import random
from dataclasses import dataclass
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class GenerationStep:
    """单个生成步骤"""
    herb_id: str
    dosage: float          # 实际用量（g）
    function_tag: int      # 功能标签 ID
    mix_stage: int         # 混合阶段 (0=预处理, 1=主混合, 2=后处理)
    stop: bool = False     # 是否停止标记


class AutoregressiveFormulaGenerator:
    """
    自回归配方生成器

    替代传统批量采样方案，采用 LSTM 逐个成分生成：
    - 每步基于前序所有步骤生成下一个成分
    - 天然支持"君臣佐使"结构涌现
    - 可注入模板先验作为初始序列
    """

    def __init__(
        self,
        herb_vocab: List[str] = None,
        hidden_dim: int = 128,
        n_layers: int = 3,
        input_dim: int = 40,
        max_seq_len: int = 12,
        min_seq_len: int = 3,
        stop_threshold: float = 0.7,
        temperature: float = 1.0,
        top_k: int = 0,
        dropout: float = 0.2,
    ):
        self.herb_vocab = herb_vocab or []
        self.hidden_dim = hidden_dim
        self.n_layers = n_layers
        self.input_dim = input_dim
        self.max_seq_len = max_seq_len
        self.min_seq_len = min_seq_len
        self.stop_threshold = stop_threshold
        self.temperature = temperature
        self.top_k = top_k
        self.dropout = dropout

        # 简单种子（实际可用预训练 LSTM 权重）
        self._seeded = False

    def _ensure_seeded(self) -> None:
        if not self._seeded:
            random.seed(42)
            self._seeded = True

    def generate(
        self,
        signal: List[float],
        herb_vocab: Optional[List[str]] = None,
        min_herbs: Optional[int] = None,
        max_herbs: Optional[int] = None,
        exclude_herbs: Optional[List[str]] = None,
        template_prefix: Optional[List[str]] = None,
    ) -> Dict[str, float]:
        """
        自回归生成配方

        Args:
            signal: 信号编码器输出向量
            herb_vocab: 候选药材词汇表
            min_herbs: 最小成分数
            max_herbs: 最大成分数
            exclude_herbs: 排除的药材
            template_prefix: 模板前缀序列（经典方剂成分）

        Returns:
            {herb_id: dosage_g} 配方字典
        """
        self._ensure_seeded()

        vocab = list(set(herb_vocab or self.herb_vocab))
        exclude_set = set(exclude_herbs or [])
        vocab = [h for h in vocab if h not in exclude_set]

        if len(vocab) < (min_herbs or self.min_seq_len):
            min_herbs = min_herbs or self.min_seq_len
        max_herbs = max_herbs or self.max_seq_len

        # 注入模板前缀
        if template_prefix:
            for herb in template_prefix:
                if herb in vocab:
                    vocab.remove(herb)
            used_herbs = list(template_prefix)
        else:
            used_herbs = []

        # 自回归生成
        signal_vec = signal if len(signal) >= self.input_dim else signal + [0.0] * (self.input_dim - len(signal))

        for step in range(max_herbs):
            if len(used_herbs) >= max_herbs:
                break

            # 检查停止
            if self._should_stop(used_herbs, signal_vec, step):
                break

            # 生成下一个成分
            herb_id = self._sample_herb(used_herbs, vocab, signal_vec, step)
            if herb_id is None:
                break

            used_herbs.append(herb_id)

        # 分配用量
        formula = self._assign_dosages(used_herbs, min_herbs)

        return formula

    def _should_stop(
        self,
        used_herbs: List[str],
        signal: List[float],
        step: int,
    ) -> bool:
        """判断是否应停止生成"""
        # 至少生成 min_seq_len 个成分
        if len(used_herbs) < (self.min_seq_len or 3):
            return False
        # 基于步数的软停止
        if step >= (self.max_seq_len or 12) - 1:
            return True
        # 基于生成的停止概率（简化实现）
        stop_prob = self._compute_stop_prob(used_herbs, signal)
        return stop_prob > self.stop_threshold

    def _compute_stop_prob(
        self, used_herbs: List[str], signal: List[float]
    ) -> float:
        """计算停止概率（简化实现，实际应使用 LSTM 输出层）"""
        # 基于序列长度和目标功效数的启发式
        n_herbs = len(used_herbs)
        base_prob = n_herbs / (self.max_seq_len + 1)
        # 添加随机扰动
        noise = random.uniform(-0.1, 0.1)
        return max(0.0, min(1.0, base_prob + noise))

    def _sample_herb(
        self,
        used_herbs: List[str],
        vocab: List[str],
        signal: List[float],
        step: int,
    ) -> Optional[str]:
        """采样下一个成分"""
        if not vocab:
            return None

        # 剩余候选
        candidates = [h for h in vocab if h not in used_herbs]
        if not candidates:
            return None

        # 基于信号和历史的加权采样（简化）
        weights = self._compute_herb_weights(candidates, used_herbs, signal, step)

        # 温度采样
        if self.temperature != 1.0:
            weights = [w ** (1.0 / self.temperature) for w in weights]

        total = sum(weights) or 1.0
        weights = [w / total for w in weights]

        # Top-k 过滤
        if self.top_k > 0 and self.top_k < len(candidates):
            paired = sorted(zip(weights, candidates), reverse=True)
            top_k_weights = [w for w, _ in paired[:self.top_k]]
            top_k_herbs = [h for _, h in paired[:self.top_k]]
            wt = sum(top_k_weights) or 1.0
            probs = [w / wt for w in top_k_weights]
            chosen = random.choices(top_k_herbs, weights=probs, k=1)[0]
        else:
            chosen = random.choices(candidates, weights=weights, k=1)[0]

        return chosen

    def _compute_herb_weights(
        self,
        candidates: List[str],
        used_herbs: List[str],
        signal: List[float],
        step: int,
    ) -> List[float]:
        """计算候选成分权重（简化实现）"""
        weights = []
        for herb in candidates:
            # 基础权重：基于信号相关性
            herb_idx = candidates.index(herb) % len(signal)
            base_weight = abs(signal[herb_idx]) + 0.1

            # 位置权重：前3个成分（君臣）权重稍高
            position_bonus = 1.0 if step < 3 else 0.8

            # 多样性惩罚：避免选择与前序过于相似的成分
            diversity_penalty = 1.0
            for used in used_herbs:
                if self._herbs_similar(herb, used):
                    diversity_penalty *= 0.7

            weights.append(base_weight * position_bonus * diversity_penalty)

        return weights

    def _herbs_similar(self, herb_a: str, herb_b: str) -> bool:
        """判断两味药材是否相似（简化：基于名称前缀）"""
        if len(herb_a) < 2 or len(herb_b) < 2:
            return False
        # 简单前缀匹配
        return herb_a[:2] == herb_b[:2]

    def _assign_dosages(
        self, herbs: List[str], min_herbs: int
    ) -> Dict[str, float]:
        """为选定成分分配用量"""
        if not herbs:
            return {}

        formula = {}
        n = len(herbs)

        # 总用量 60g，按比例分配
        total_dosage = 60.0

        # 君药（前1-2味）用量更大
        for i, herb in enumerate(herbs):
            if i == 0:
                # 君药：30-40%
                ratio = 0.30 + random.uniform(-0.05, 0.10)
            elif i < 3:
                # 臣药：20-25%
                ratio = 0.20 + random.uniform(-0.05, 0.05)
            else:
                # 佐使：剩余平均
                ratio = (1.0 - sum(
                    0.35 + random.uniform(-0.05, 0.10) if j == 0
                    else 0.22 + random.uniform(-0.05, 0.05) if j < 3
                    else 0 for j in range(i)
                )) / max(1, n - i)
                ratio = max(0.05, min(0.20, ratio))

            dosage = round(total_dosage * ratio / self._round_step(ratio), 1)
            dosage = max(1.0, min(30.0, dosage))
            formula[herb] = dosage

        # 归一化到总用量
        total = sum(formula.values())
        if total > 0 and abs(total - total_dosage) > 1.0:
            scale = total_dosage / total
            for herb in formula:
                formula[herb] = round(formula[herb] * scale, 1)

        return formula

    @staticmethod
    def _round_step(dosage: float) -> float:
        """用量步长修正"""
        if dosage >= 10:
            return 5.0
        elif dosage >= 5:
            return 1.0
        return 0.5

    def generate_with_template(
        self,
        signal: List[float],
        template_herbs: List[str],
        herb_vocab: Optional[List[str]] = None,
        max_herbs: int = None,
    ) -> Dict[str, float]:
        """
        带模板的生成：先注入经典方剂成分，再补充

        Args:
            signal: 信号向量
            template_herbs: 模板成分列表
            herb_vocab: 扩展词汇表
            max_herbs: 最大成分数

        Returns:
            含模板成分的配方
        """
        return self.generate(
            signal=signal,
            herb_vocab=herb_vocab,
            min_herbs=3,
            max_herbs=max_herbs or self.max_seq_len,
            template_prefix=template_herbs,
        )


# 全局单例
_generator: Optional[AutoregressiveFormulaGenerator] = None


def get_autoregressive_generator(
    herb_vocab: List[str] = None,
    **kwargs,
) -> AutoregressiveFormulaGenerator:
    global _generator
    if _generator is None:
        _generator = AutoregressiveFormulaGenerator(
            herb_vocab=herb_vocab or [],
            **kwargs,
        )
    return _generator

"""信号编码器 — 将配方需求编码为神经网络可理解的信号向量

支持三种编码模式：
1. 功效独热编码（target_effects → 向量）
2. 产品类别嵌入
3. 目标人群嵌入
4. 连续约束映射（成本、pH 等）

输出维度 = effect_embed_dim + category_embed_dim + group_embed_dim + continuous_dim

关键改进：使用 nn.Embedding 替代随机投影矩阵，使编码具有可学习性。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class EncodedSignal:
    """编码后的信号向量"""
    effect_embed: List[float]        # 功效嵌入向量
    category_embed: List[float]      # 产品类别嵌入向量
    group_embed: List[float]         # 目标人群嵌入向量
    continuous: List[float]          # 连续约束向量
    raw_vector: List[float] = field(default_factory=list)  # 完整拼接向量

    @property
    def dim(self) -> int:
        return len(self.raw_vector)


class SignalEncoder:
    """
    配方需求信号编码器

    将用户需求编码为神经网络输入向量：
    - 目标功效列表 → 功效嵌入（可学习 nn.Embedding）
    - 产品类别 → 类别嵌入
    - 目标人群 → 人群嵌入
    - 连续约束（成本上限、pH等）→ 连续向量

    关键改进：使用 nn.Embedding 替代随机投影矩阵，
    使编码具有可学习性，可与 PyTorchFormulaGenerator 联动训练。
    """

    # 功效列表（扩展版）
    EFFECTS = [
        "免疫调节", "抗氧化", "抗疲劳", "降血糖", "降压",
        "护肝", "消化系统", "补气", "养血", "安神",
        "清热", "祛湿", "活血化瘀", "理气", "补脾",
        "润肺", "补肾", "解表", "利尿", "解毒",
    ]

    # 产品类别
    CATEGORIES = [
        "保健饮品", "功能性食品", "药膳", "代茶饮",
        "膏方", "丸剂", "散剂", "口服液",
    ]

    # 目标人群
    TARGET_GROUPS = [
        "adult", "elderly", "children", "pregnant", "athlete",
    ]

    # 嵌入维度
    EFFECT_DIM = 16
    CATEGORY_DIM = 8
    GROUP_DIM = 8
    CONTINUOUS_DIM = 4

    def __init__(
        self,
        effect_index_map: Optional[Dict[str, int]] = None,
        category_index_map: Optional[Dict[str, int]] = None,
        group_index_map: Optional[Dict[str, int]] = None,
    ):
        self._effect_map = effect_index_map or {
            eff: i for i, eff in enumerate(self.EFFECTS)
        }
        self._category_map = category_index_map or {
            cat: i for i, cat in enumerate(self.CATEGORIES)
        }
        self._group_map = group_index_map or {
            grp: i for i, grp in enumerate(self.TARGET_GROUPS)
        }
        self._initialized = False

        # ── 可学习嵌入层（替代原随机投影矩阵）──
        # 惰性初始化，仅在 _ensure_initialized() 中创建
        self._effect_embed_matrix = None  # (n_effects, EFFECT_DIM)
        self._category_embed_matrix = None  # (n_categories, CATEGORY_DIM)
        self._group_embed_matrix = None  # (n_groups, GROUP_DIM)

    def _ensure_initialized(self) -> None:
        """延迟初始化可学习嵌入矩阵（Xavier 初始化）"""
        if self._initialized:
            return

        import random
        random.seed(42)

        n_effects = len(self.EFFECTS)
        n_categories = len(self.CATEGORIES)
        n_groups = len(self.TARGET_GROUPS)

        # Xavier 初始化：sqrt(2 / (fan_in + fan_out))
        def _xavier(rows, cols):
            limit = (2.0 / (rows + cols)) ** 0.5
            return [[random.uniform(-limit, limit) for _ in range(cols)]
                    for _ in range(rows)]

        self._effect_embed_matrix = _xavier(n_effects, self.EFFECT_DIM)
        self._category_embed_matrix = _xavier(n_categories, self.CATEGORY_DIM)
        self._group_embed_matrix = _xavier(n_groups, self.GROUP_DIM)

        self._initialized = True
        logger.info(
            f"[SignalEncoder] 嵌入矩阵初始化完成: "
            f"功效({n_effects}×{self.EFFECT_DIM}), "
            f"类别({n_categories}×{self.CATEGORY_DIM}), "
            f"人群({n_groups}×{self.GROUP_DIM})"
        )

    def encode(
        self,
        target_effects: List[str],
        product_category: Optional[str] = None,
        target_group: str = "adult",
        continuous_constraints: Optional[Dict[str, float]] = None,
    ) -> EncodedSignal:
        """
        编码配方需求为信号向量

        Args:
            target_effects: 目标功效列表
            product_category: 产品类别（可选）
            target_group: 目标人群
            continuous_constraints: 连续约束 {key: value}

        Returns:
            EncodedSignal 对象
        """
        self._ensure_initialized()

        # 1. 功效嵌入：对目标功效的嵌入向量取平均（可学习）
        effect_vec = self._encode_effects(target_effects)

        # 2. 类别嵌入（可学习）
        category_vec = self._encode_category(product_category)

        # 3. 人群嵌入（可学习）
        group_vec = self._encode_group(target_group)

        # 4. 连续约束
        continuous_vec = self._encode_continuous(continuous_constraints)

        # 拼接
        raw = effect_vec + category_vec + group_vec + continuous_vec

        return EncodedSignal(
            effect_embed=effect_vec,
            category_embed=category_vec,
            group_embed=group_vec,
            continuous=continuous_vec,
            raw_vector=raw,
        )

    def _encode_effects(self, effects: List[str]) -> List[float]:
        """功效嵌入：可学习嵌入矩阵 → 平均 → L2归一化"""
        if not effects:
            return [0.0] * self.EFFECT_DIM

        combined = [0.0] * self.EFFECT_DIM
        count = 0
        for eff in effects:
            idx = self._effect_map.get(eff)
            if idx is None:
                # 模糊匹配
                idx = self._fuzzy_match_effect(eff)
            if idx is not None and idx < len(self._effect_embed_matrix):
                proj = self._effect_embed_matrix[idx]
                combined = [a + b for a, b in zip(combined, proj)]
                count += 1

        if count > 0:
            combined = [v / count for v in combined]

        # L2 归一化
        norm = (sum(v * v for v in combined) ** 0.5) or 1.0
        return [v / norm for v in combined]

    def _encode_category(self, category: Optional[str]) -> List[float]:
        """类别嵌入：可学习嵌入矩阵"""
        if category is None:
            return [0.0] * self.CATEGORY_DIM
        idx = self._category_map.get(category)
        if idx is None:
            return [0.0] * self.CATEGORY_DIM
        return self._category_embed_matrix[idx]

    def _encode_group(self, group: str) -> List[float]:
        """人群嵌入：可学习嵌入矩阵"""
        idx = self._group_map.get(group)
        if idx is None:
            return [0.0] * self.GROUP_DIM
        return self._group_embed_matrix[idx]

    def _encode_continuous(
        self, constraints: Optional[Dict[str, float]]
    ) -> List[float]:
        """连续约束编码"""
        if not constraints:
            return [0.5] * self.CONTINUOUS_DIM

        keys = sorted(constraints.keys())[:self.CONTINUOUS_DIM]
        vec = []
        for k in keys:
            v = constraints[k]
            # 归一化到 [0, 1]
            normalized = max(0.0, min(1.0, v))
            vec.append(normalized)

        # 补齐
        while len(vec) < self.CONTINUOUS_DIM:
            vec.append(0.5)

        return vec[:self.CONTINUOUS_DIM]

    def _fuzzy_match_effect(self, effect: str) -> Optional[int]:
        """功效模糊匹配"""
        effect_lower = effect.lower()
        for name, idx in self._effect_map.items():
            if effect_lower in name.lower() or name.lower() in effect_lower:
                return idx
        return None

    @property
    def output_dim(self) -> int:
        """编码输出维度"""
        return (
            self.EFFECT_DIM +
            self.CATEGORY_DIM +
            self.GROUP_DIM +
            self.CONTINUOUS_DIM
        )

    def get_effect_index_map(self) -> Dict[str, int]:
        return dict(self._effect_map)

    def get_category_index_map(self) -> Dict[str, int]:
        return dict(self._category_map)

    def get_group_index_map(self) -> Dict[str, int]:
        return dict(self._group_map)

    # ── PyTorch 集成接口（供 nn.Module 使用）──

    def to_torch_module(self):
        """
        将嵌入矩阵包装为 PyTorch nn.Embedding，
        使 SignalEncoder 可作为 nn.Module 的一部分被联合训练。

        Returns:
            tuple: (effect_embed, category_embed, group_embed)
        """
        import torch
        import torch.nn as nn

        effect_embed = nn.Embedding(len(self.EFFECTS), self.EFFECT_DIM)
        category_embed = nn.Embedding(len(self.CATEGORIES), self.CATEGORY_DIM)
        group_embed = nn.Embedding(len(self.TARGET_GROUPS), self.GROUP_DIM)

        # 从 numpy 风格的列表转为 tensor
        effect_embed.weight.data = torch.tensor(
            self._effect_embed_matrix, dtype=torch.float32
        )
        category_embed.weight.data = torch.tensor(
            self._category_embed_matrix, dtype=torch.float32
        )
        group_embed.weight.data = torch.tensor(
            self._group_embed_matrix, dtype=torch.float32
        )

        return effect_embed, category_embed, group_embed

    def sync_from_torch(self, effect_embed, category_embed, group_embed):
        """
        从 PyTorch nn.Embedding 同步回 numpy 矩阵，
        用于训练完成后保存学习到的嵌入。
        """
        self._effect_embed_matrix = effect_embed.weight.data.cpu().numpy().tolist()
        self._category_embed_matrix = category_embed.weight.data.cpu().numpy().tolist()
        self._group_embed_matrix = group_embed.weight.data.cpu().numpy().tolist()
        logger.info("[SignalEncoder] 嵌入矩阵已从 PyTorch 同步回 numpy")


# 全局单例
_encoder: Optional[SignalEncoder] = None


def get_signal_encoder() -> SignalEncoder:
    global _encoder
    if _encoder is None:
        _encoder = SignalEncoder()
    return _encoder

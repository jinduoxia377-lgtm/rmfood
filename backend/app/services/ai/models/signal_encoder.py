"""信号编码器 — 将配方需求编码为神经网络可理解的信号向量

支持三种编码模式：
1. 功效独热编码（target_effects → 向量）
2. 产品类别嵌入
3. 目标人群嵌入
4. 连续约束映射（成本、pH 等）

输出维度 = effect_embed_dim + category_embed_dim + group_embed_dim + continuous_dim
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
    - 目标功效列表 → 功效嵌入
    - 产品类别 → 类别嵌入
    - 目标人群 → 人群嵌入
    - 连续约束（成本上限、pH等）→ 连续向量
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

    # 简单线性投影矩阵（简化版，实际可用可学习嵌入）
    _EFFECT_PROJ: Optional[List[List[float]]] = None
    _CATEGORY_PROJ: Optional[List[List[float]]] = None
    _GROUP_PROJ: Optional[List[List[float]]] = None

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

    def _ensure_initialized(self) -> None:
        """延迟初始化投影矩阵"""
        if self._initialized:
            return
        import random
        random.seed(42)
        # 简单随机投影（实际应用中应加载预训练权重）
        n_effects = len(self.EFFECTS)
        self._EFFECT_PROJ = [
            [random.uniform(-0.1, 0.1) for _ in range(self.EFFECT_DIM)]
            for _ in range(n_effects)
        ]
        self._CATEGORY_PROJ = [
            [random.uniform(-0.1, 0.1) for _ in range(self.CATEGORY_DIM)]
            for _ in range(len(self.CATEGORIES))
        ]
        self._GROUP_PROJ = [
            [random.uniform(-0.1, 0.1) for _ in range(self.GROUP_DIM)]
            for _ in range(len(self.TARGET_GROUPS))
        ]
        self._initialized = True

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

        # 1. 功效嵌入：对目标功效的嵌入向量取平均
        effect_vec = self._encode_effects(target_effects)

        # 2. 类别嵌入
        category_vec = self._encode_category(product_category)

        # 3. 人群嵌入
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
        """功效嵌入：独热 + 投影 → 平均"""
        if not effects:
            return [0.0] * self.EFFECT_DIM

        combined = [0.0] * self.EFFECT_DIM
        count = 0
        for eff in effects:
            idx = self._effect_map.get(eff)
            if idx is None:
                # 模糊匹配
                idx = self._fuzzy_match_effect(eff)
            if idx is not None and idx < len(self._EFFECT_PROJ):
                proj = self._EFFECT_PROJ[idx]
                combined = [a + b for a, b in zip(combined, proj)]
                count += 1

        if count > 0:
            combined = [v / count for v in combined]

        # L2 归一化
        norm = (sum(v * v for v in combined) ** 0.5) or 1.0
        return [v / norm for v in combined]

    def _encode_category(self, category: Optional[str]) -> List[float]:
        """类别嵌入"""
        if category is None:
            return [0.0] * self.CATEGORY_DIM
        idx = self._category_map.get(category)
        if idx is None:
            return [0.0] * self.CATEGORY_DIM
        return self._CATEGORY_PROJ[idx]

    def _encode_group(self, group: str) -> List[float]:
        """人群嵌入"""
        idx = self._group_map.get(group)
        if idx is None:
            return [0.0] * self.GROUP_DIM
        return self._GROUP_PROJ[idx]

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


# 全局单例
_encoder: Optional[SignalEncoder] = None


def get_signal_encoder() -> SignalEncoder:
    global _encoder
    if _encoder is None:
        _encoder = SignalEncoder()
    return _encoder

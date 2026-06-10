"""
EncoderNetwork - 编码器网络
基于专利 US 11,742,060 B2 实现配方目标属性的编码
输入：功效向量、约束条件
输出：配方特征向量表示
"""
import logging
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


class EncoderNetwork:
    """编码器网络 - 将配方目标属性编码为特征向量"""

    def __init__(
        self,
        efficacy_dim: int = 64,
        constraint_dim: int = 32,
        hidden_dims: list[int] | None = None,
        output_dim: int = 128,
    ):
        """
        初始化编码器网络

        Args:
            efficacy_dim: 功效向量维度
            constraint_dim: 约束条件向量维度
            hidden_dims: 隐藏层维度列表
            output_dim: 输出特征向量维度
        """
        self.efficacy_dim = efficacy_dim
        self.constraint_dim = constraint_dim
        self.output_dim = output_dim

        if hidden_dims is None:
            hidden_dims = [256, 128]

        self.hidden_dims = hidden_dims
        self._initialize_weights()

    def _initialize_weights(self):
        """初始化网络权重"""
        input_dim = self.efficacy_dim + self.constraint_dim

        self.weights = []
        self.biases = []

        prev_dim = input_dim
        for hidden_dim in self.hidden_dims:
            self.weights.append(np.random.randn(prev_dim, hidden_dim).astype(np.float32) * 0.01)
            self.biases.append(np.zeros(hidden_dim, dtype=np.float32))
            prev_dim = hidden_dim

        self.output_weight = np.random.randn(prev_dim, self.output_dim).astype(np.float32) * 0.01
        self.output_bias = np.zeros(self.output_dim, dtype=np.float32)

    def _relu(self, x: np.ndarray) -> np.ndarray:
        """ReLU 激活函数"""
        return np.maximum(0, x)

    def _relu_derivative(self, x: np.ndarray) -> np.ndarray:
        """ReLU 导数"""
        return (x > 0).astype(np.float32)

    def encode_efficacy(self, efficacy_vector: list[float] | np.ndarray) -> np.ndarray:
        """
        编码功效向量

        Args:
            efficacy_vector: 功效向量，如 [0.8, 0.6, 0.9] 对应降血压、抗氧化、降血糖

        Returns:
            编码后的功效特征
        """
        if isinstance(efficacy_vector, list):
            efficacy_vector = np.array(efficacy_vector, dtype=np.float32)

        if len(efficacy_vector) < self.efficacy_dim:
            padding = np.zeros(self.efficacy_dim - len(efficacy_vector), dtype=np.float32)
            efficacy_vector = np.concatenate([efficacy_vector, padding])
        elif len(efficacy_vector) > self.efficacy_dim:
            efficacy_vector = efficacy_vector[:self.efficacy_dim]

        efficacy_norm = efficacy_vector / (np.linalg.norm(efficacy_vector) + 1e-8)
        return efficacy_norm

    def encode_constraints(self, constraints: dict[str, Any]) -> np.ndarray:
        """
        编码约束条件

        Args:
            constraints: 约束条件字典

        Returns:
            编码后的约束特征
        """
        constraint_features = np.zeros(self.constraint_dim, dtype=np.float32)

        if constraints.get("max_ingredients"):
            constraint_features[0] = min(1.0, constraints["max_ingredients"] / 10.0)

        if constraints.get("min_safety"):
            constraint_features[1] = constraints["min_safety"]

        if constraints.get("budget_level"):
            constraint_features[2] = constraints["budget_level"] / 5.0

        if constraints.get("preferred_taste"):
            taste_map = {"甜": 0.3, "苦": 0.6, "酸": 0.4, "辣": 0.5, "咸": 0.4}
            constraint_features[3] = taste_map.get(constraints["preferred_taste"], 0.5)

        if constraints.get("exclude_ingredients"):
            constraint_features[4] = min(1.0, len(constraints["exclude_ingredients"]) / 20.0)

        if constraints.get("shelf_life_requirement"):
            constraint_features[5] = constraints["shelf_life_requirement"] / 36.0

        if constraints.get("target_cost"):
            constraint_features[6] = min(1.0, constraints["target_cost"] / 1000.0)

        if constraints.get("pregnancy_safe"):
            constraint_features[7] = 1.0 if constraints["pregnancy_safe"] else 0.0

        return constraint_features

    def forward(self, efficacy_vector: np.ndarray, constraint_vector: np.ndarray) -> np.ndarray:
        """
        前向传播

        Args:
            efficacy_vector: 编码后的功效向量
            constraint_vector: 编码后的约束向量

        Returns:
            配方特征向量
        """
        x = np.concatenate([efficacy_vector, constraint_vector])

        for i, (weight, bias) in enumerate(zip(self.weights, self.biases)):
            x = np.dot(x, weight) + bias
            x = self._relu(x)

        output = np.dot(x, self.output_weight) + self.output_bias
        output = self._relu(output)

        output_norm = output / (np.linalg.norm(output) + 1e-8)
        return output_norm

    def encode(
        self,
        target_attributes: dict[str, Any],
        constraints: dict[str, Any] | None = None,
    ) -> np.ndarray:
        """
        编码配方目标属性

        Args:
            target_attributes: 目标属性，包含功效向量等
            constraints: 约束条件

        Returns:
            配方特征向量
        """
        constraints = constraints or {}

        efficacy_vector = target_attributes.get("efficacy_vector", [])
        if not isinstance(efficacy_vector, np.ndarray):
            efficacy_vector = self.encode_efficacy(efficacy_vector)

        constraint_vector = self.encode_constraints(constraints)

        feature_vector = self.forward(efficacy_vector, constraint_vector)

        logger.debug(f"编码特征向量维度: {feature_vector.shape}, 范数: {np.linalg.norm(feature_vector):.4f}")

        return feature_vector

    def batch_encode(
        self,
        target_attributes_list: list[dict[str, Any]],
        constraints_list: list[dict[str, Any]] | None = None,
    ) -> np.ndarray:
        """
        批量编码

        Args:
            target_attributes_list: 目标属性列表
            constraints_list: 约束条件列表

        Returns:
            批量特征向量 (batch_size, output_dim)
        """
        constraints_list = constraints_list or [{}] * len(target_attributes_list)

        batch_features = []
        for attrs, constraints in zip(target_attributes_list, constraints_list):
            feature = self.encode(attrs, constraints)
            batch_features.append(feature)

        return np.array(batch_features, dtype=np.float32)


class FormulaEncoder:
    """配方编码器 - 高维功效空间映射"""

    EFFECTIVENESS_EMBEDDINGS = {
        "降血压": [0.9, 0.3, 0.2, 0.1, 0.0, 0.0, 0.0, 0.0],
        "抗氧化": [0.2, 0.9, 0.3, 0.2, 0.1, 0.0, 0.0, 0.0],
        "降血糖": [0.3, 0.4, 0.9, 0.2, 0.1, 0.0, 0.0, 0.0],
        "补气养阴": [0.1, 0.2, 0.1, 0.9, 0.3, 0.2, 0.0, 0.0],
        "抗疲劳": [0.2, 0.3, 0.2, 0.4, 0.9, 0.3, 0.1, 0.0],
        "改善睡眠": [0.1, 0.1, 0.1, 0.3, 0.2, 0.9, 0.2, 0.0],
        "增强免疫": [0.3, 0.4, 0.2, 0.2, 0.3, 0.1, 0.9, 0.1],
        "护肝": [0.2, 0.3, 0.2, 0.1, 0.2, 0.1, 0.3, 0.8],
    }

    def __init__(self):
        self.encoder = EncoderNetwork()

    def encode_effects(self, effects: list[str]) -> np.ndarray:
        """将功效名称列表转换为功效向量"""
        effect_vector = np.zeros(64, dtype=np.float32)

        for i, effect_name in enumerate(effects):
            if effect_name in self.EFFECTIVENESS_EMBEDDINGS:
                embedding = np.array(self.EFFECTIVENESS_EMBEDDINGS[effect_name], dtype=np.float32)
                effect_vector[i * 8:(i + 1) * 8] = embedding

        return effect_vector

    def encode_formula_request(
        self,
        target_effects: list[str],
        constraints: dict[str, Any] | None = None,
    ) -> np.ndarray:
        """
        编码配方请求

        Args:
            target_effects: 目标功效列表
            constraints: 约束条件

        Returns:
            配方特征向量
        """
        efficacy_vector = self.encode_effects(target_effects)

        target_attributes = {"efficacy_vector": efficacy_vector}

        return self.encoder.encode(target_attributes, constraints)

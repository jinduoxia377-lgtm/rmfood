"""
DecoderNetwork - 解码器网络
基于专利 US 11,742,060 B2 实现配方成分概率分布生成
输入：特征向量 + 优先级权重
输出：配方成分概率分布
实现自注意力机制和多样性采样
"""
import logging
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


class SelfAttention:
    """自注意力机制"""

    def __init__(self, embed_dim: int, num_heads: int = 4):
        """
        初始化自注意力层

        Args:
            embed_dim: 嵌入维度
            num_heads: 注意力头数量
        """
        self.embed_dim = embed_dim
        self.num_heads = num_heads
        self.head_dim = embed_dim // num_heads

        self.query_weight = np.random.randn(embed_dim, embed_dim).astype(np.float32) * 0.01
        self.key_weight = np.random.randn(embed_dim, embed_dim).astype(np.float32) * 0.01
        self.value_weight = np.random.randn(embed_dim, embed_dim).astype(np.float32) * 0.01
        self.output_weight = np.random.randn(embed_dim, embed_dim).astype(np.float32) * 0.01

    def split_heads(self, x: np.ndarray) -> np.ndarray:
        """将输入分割为多个注意力头"""
        batch_size = x.shape[0]
        x = x.reshape(batch_size, -1, self.num_heads, self.head_dim)
        return x.transpose(0, 2, 1, 3)

    def forward(self, x: np.ndarray) -> np.ndarray:
        """
        前向传播

        Args:
            x: 输入张量 (batch_size, seq_len, embed_dim)

        Returns:
            注意力输出 (batch_size, seq_len, embed_dim)
        """
        batch_size = x.shape[0]

        q = np.dot(x, self.query_weight)
        k = np.dot(x, self.key_weight)
        v = np.dot(x, self.value_weight)

        q = self.split_heads(q)
        k = self.split_heads(k)
        v = self.split_heads(v)

        scores = np.matmul(q, k.transpose(0, 1, 3, 2)) / np.sqrt(self.head_dim)
        attention_weights = self._softmax(scores)

        attention_output = np.matmul(attention_weights, v)
        attention_output = attention_output.transpose(0, 2, 1, 3)
        attention_output = attention_output.reshape(batch_size, -1, self.embed_dim)

        output = np.dot(attention_output, self.output_weight)

        return output + x

    def _softmax(self, x: np.ndarray) -> np.ndarray:
        """Softmax 函数"""
        exp_x = np.exp(x - np.max(x, axis=-1, keepdims=True))
        return exp_x / (np.sum(exp_x, axis=-1, keepdims=True) + 1e-8)


class DecoderNetwork:
    """解码器网络 - 将特征向量解码为配方成分概率分布"""

    INGREDIENT_POOL = {
        "菊花": {"category": "花草", "efficacy": ["降血压", "清热"], "taste": "微苦"},
        "山楂": {"category": "果实", "efficacy": ["降血脂", "消食"], "taste": "酸"},
        "决明子": {"category": "种子", "efficacy": ["降血压", "润肠"], "taste": "苦"},
        "葛根": {"category": "根茎", "efficacy": ["降血压", "舒筋"], "taste": "甘"},
        "杜仲叶": {"category": "叶", "efficacy": ["降血压", "补肾"], "taste": "微甘"},
        "罗布麻叶": {"category": "叶", "efficacy": ["降血压", "安神"], "taste": "淡"},
        "枸杞子": {"category": "果实", "efficacy": ["抗氧化", "养肝"], "taste": "甜"},
        "红枣": {"category": "果实", "efficacy": ["补气", "养血"], "taste": "甜"},
        "茯苓": {"category": "菌类", "efficacy": ["利湿", "健脾"], "taste": "淡"},
        "山药": {"category": "根茎", "efficacy": ["补气", "健脾"], "taste": "甘"},
        "桑葚": {"category": "果实", "efficacy": ["抗氧化", "补血"], "taste": "甜酸"},
        "黑芝麻": {"category": "种子", "efficacy": ["抗氧化", "补肾"], "taste": "香"},
        "苦瓜": {"category": "果实", "efficacy": ["降血糖", "清热"], "taste": "苦"},
        "桑叶": {"category": "叶", "efficacy": ["降血糖", "清肺"], "taste": "淡"},
        "玉竹": {"category": "根茎", "efficacy": ["降血糖", "养阴"], "taste": "甘"},
        "黄精": {"category": "根茎", "efficacy": ["降血糖", "补气"], "taste": "甘"},
        "麦冬": {"category": "根茎", "efficacy": ["降血糖", "润肺"], "taste": "微甘"},
        "知母": {"category": "根茎", "efficacy": ["降血糖", "清热"], "taste": "苦"},
        "人参": {"category": "根茎", "efficacy": ["补气", "提高免疫"], "taste": "甘微苦"},
        "西洋参": {"category": "根茎", "efficacy": ["补气", "养阴"], "taste": "甘微苦"},
        "太子参": {"category": "根茎", "efficacy": ["补气", "健脾"], "taste": "甘"},
        "白术": {"category": "根茎", "efficacy": ["健脾", "利湿"], "taste": "甘苦"},
        "甘草": {"category": "根茎", "efficacy": ["调和", "补气"], "taste": "甜"},
        "刺五加": {"category": "根茎", "efficacy": ["抗疲劳", "安神"], "taste": "微甘"},
        "红景天": {"category": "根茎", "efficacy": ["抗疲劳", "提高免疫"], "taste": "微甘"},
        "五味子": {"category": "果实", "efficacy": ["抗疲劳", "敛肺"], "taste": "酸"},
        "巴戟天": {"category": "根茎", "efficacy": ["抗疲劳", "补肾"], "taste": "甘"},
        "淫羊藿": {"category": "叶", "efficacy": ["抗疲劳", "温肾"], "taste": "辛"},
        "肉苁蓉": {"category": "根茎", "efficacy": ["抗疲劳", "补肾"], "taste": "甘"},
        "酸枣仁": {"category": "种子", "efficacy": ["改善睡眠", "安神"], "taste": "酸"},
        "百合": {"category": "鳞茎", "efficacy": ["改善睡眠", "润肺"], "taste": "微甘"},
        "龙眼肉": {"category": "果实", "efficacy": ["改善睡眠", "补血"], "taste": "甜"},
        "莲子": {"category": "种子", "efficacy": ["改善睡眠", "健脾"], "taste": "甘"},
        "远志": {"category": "根茎", "efficacy": ["改善睡眠", "益智"], "taste": "苦"},
        "合欢花": {"category": "花草", "efficacy": ["改善睡眠", "解郁"], "taste": "淡"},
        "黄芪": {"category": "根茎", "efficacy": ["增强免疫", "补气", "固表"], "taste": "甘"},
        "党参": {"category": "根茎", "efficacy": ["增强免疫", "补气"], "taste": "甘"},
        "灵芝": {"category": "菌类", "efficacy": ["增强免疫", "安神"], "taste": "淡苦"},
        "香菇": {"category": "菌类", "efficacy": ["增强免疫", "健脾"], "taste": "鲜"},
        "虫草": {"category": "菌类", "efficacy": ["增强免疫", "补肾"], "taste": "淡"},
        "银耳": {"category": "菌类", "efficacy": ["增强免疫", "润肺"], "taste": "淡"},
    }

    def __init__(
        self,
        input_dim: int = 128,
        hidden_dim: int = 256,
        num_heads: int = 4,
        num_layers: int = 3,
    ):
        """
        初始化解码器网络

        Args:
            input_dim: 输入特征向量维度
            hidden_dim: 隐藏层维度
            num_heads: 注意力头数量
            num_layers: 解码器层数
        """
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.num_heads = num_heads
        self.num_layers = num_layers

        self.feature_proj = np.random.randn(input_dim, hidden_dim).astype(np.float32) * 0.01
        self.priority_proj = np.random.randn(8, hidden_dim).astype(np.float32) * 0.01

        self.attention_layers = [
            SelfAttention(hidden_dim, num_heads) for _ in range(num_layers)
        ]

        self.ingredient_weight = np.random.randn(hidden_dim, 64).astype(np.float32) * 0.01
        self.ingredient_bias = np.zeros(64, dtype=np.float32)

        self.category_weight = np.random.randn(hidden_dim, 8).astype(np.float32) * 0.01
        self.category_bias = np.zeros(8, dtype=np.float32)

        self._initialize_ingredient_probs()

    def _initialize_ingredient_probs(self):
        """初始化成分先验概率"""
        self.prior_probs = {}
        for ingredient, info in self.INGREDIENT_POOL.items():
            base_prob = 0.5
            self.prior_probs[ingredient] = base_prob

    def _relu(self, x: np.ndarray) -> np.ndarray:
        """ReLU 激活函数"""
        return np.maximum(0, x)

    def apply_priority_weights(
        self,
        feature_vector: np.ndarray,
        priority_values: dict[str, float],
    ) -> np.ndarray:
        """
        应用优先级权重调整特征向量

        Args:
            feature_vector: 特征向量
            priority_values: 优先级权重字典

        Returns:
            调整后的特征向量
        """
        priority_vector = np.zeros(8, dtype=np.float32)

        priority_map = {
            "efficacy": 0,
            "safety": 1,
            "taste": 2,
            "stability": 3,
            "cost": 4,
            "convenience": 5,
            "synergy": 6,
            " novelty": 7,
        }

        for priority_name, priority_value in priority_values.items():
            if priority_name in priority_map:
                priority_vector[priority_map[priority_name]] = priority_value

        priority_vector = priority_vector / (np.linalg.norm(priority_vector) + 1e-8)

        adapted_feature = feature_vector * (1 + priority_vector[:len(feature_vector)] * 0.3)

        return adapted_feature / (np.linalg.norm(adapted_feature) + 1e-8)

    def decode(
        self,
        feature_vector: np.ndarray,
        priority_values: dict[str, float] | None = None,
    ) -> dict[str, np.ndarray]:
        """
        解码特征向量为成分概率分布

        Args:
            feature_vector: 编码器输出的特征向量
            priority_values: 优先级权重

        Returns:
            包含成分概率和分类概率的字典
        """
        priority_values = priority_values or {}

        adapted_feature = self.apply_priority_weights(feature_vector, priority_values)

        x = np.dot(adapted_feature, self.feature_proj)
        x = self._relu(x)

        seq_len = 8
        x = np.tile(x, (seq_len, 1))

        for attention_layer in self.attention_layers:
            x = attention_layer.forward(x.reshape(1, seq_len, -1)).reshape(seq_len, -1)

        ingredient_logits = np.dot(x, self.ingredient_weight) + self.ingredient_bias
        ingredient_probs = self._softmax(ingredient_logits)

        category_logits = np.dot(x, self.category_weight) + self.category_bias
        category_probs = self._softmax(category_logits)

        return {
            "ingredient_probs": ingredient_probs,
            "category_probs": category_probs,
            "feature_adapted": adapted_feature,
        }

    def _softmax(self, x: np.ndarray) -> np.ndarray:
        """Softmax 函数"""
        exp_x = np.exp(x - np.max(x, axis=-1, keepdims=True))
        return exp_x / (np.sum(exp_x, axis=-1, keepdims=True) + 1e-8)

    def sample_ingredients(
        self,
        ingredient_probs: np.ndarray,
        num_ingredients: int = 6,
        diversity_factor: float = 0.3,
        constraints: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """
        多样性采样成分

        Args:
            ingredient_probs: 成分概率分布
            num_ingredients: 采样成分数量
            diversity_factor: 多样性因子 (0-1)，值越高越多样性
            constraints: 约束条件

        Returns:
            采样的成分列表
        """
        constraints = constraints or {}

        ingredient_names = list(self.INGREDIENT_POOL.keys())
        probs = ingredient_probs[:len(ingredient_names)]

        exclude_ingredients = set(constraints.get("exclude_ingredients", []))
        preferred_taste = constraints.get("preferred_taste", None)

        adjusted_probs = probs.copy()

        for i, name in enumerate(ingredient_names):
            if name in exclude_ingredients:
                adjusted_probs[i] = 0.0
                continue

            info = self.INGREDIENT_POOL[name]

            if preferred_taste:
                if preferred_taste in info["taste"]:
                    adjusted_probs[i] *= 1.2
                else:
                    adjusted_probs[i] *= 0.8

        if diversity_factor > 0:
            noise = np.random.gumbel(0, diversity_factor, size=adjusted_probs.shape)
            adjusted_probs = np.log(adjusted_probs + 1e-8) + noise
            adjusted_probs = self._softmax(adjusted_probs)

        adjusted_probs = adjusted_probs / (np.sum(adjusted_probs) + 1e-8)

        num_to_sample = min(num_ingredients, len(ingredient_names))
        sampled_indices = np.random.choice(
            len(ingredient_names),
            size=num_to_sample,
            replace=False,
            p=adjusted_probs,
        )

        sampled_ingredients = []
        for idx in sampled_indices:
            name = ingredient_names[idx]
            info = self.INGREDIENT_POOL[name]
            sampled_ingredients.append({
                "name": name,
                "category": info["category"],
                "efficacy": info["efficacy"],
                "taste": info["taste"],
                "probability": float(adjusted_probs[idx]),
            })

        sampled_ingredients.sort(key=lambda x: x["probability"], reverse=True)

        return sampled_ingredients

    def generate_distribution(
        self,
        feature_vector: np.ndarray,
        priority_values: dict[str, float] | None = None,
    ) -> dict[str, Any]:
        """
        生成配方成分分布

        Args:
            feature_vector: 特征向量
            priority_values: 优先级权重

        Returns:
            成分分布信息
        """
        decode_result = self.decode(feature_vector, priority_values)

        ingredient_names = list(self.INGREDIENT_POOL.keys())
        ingredient_probs = decode_result["ingredient_probs"]

        distribution = {
            name: float(ingredient_probs[i])
            for i, name in enumerate(ingredient_names)
            if i < len(ingredient_probs)
        }

        return {
            "distribution": distribution,
            "top_ingredients": sorted(
                distribution.items(),
                key=lambda x: x[1],
                reverse=True,
            )[:10],
            "feature_adapted": decode_result["feature_adapted"].tolist(),
        }


class FormulaDecoder:
    """配方解码器 - 整合解码器网络和采样逻辑"""

    def __init__(self):
        self.decoder = DecoderNetwork()

    async def generate_candidates(
        self,
        feature_vector: np.ndarray,
        priority_values: dict[str, float] | None = None,
        constraints: dict[str, Any] | None = None,
        num_candidates: int = 3,
    ) -> list[list[dict[str, Any]]]:
        """
        生成多个配方候选

        Args:
            feature_vector: 特征向量
            priority_values: 优先级权重
            constraints: 约束条件
            num_candidates: 候选数量

        Returns:
            多个配方候选列表
        """
        constraints = constraints or {}

        decode_result = self.decoder.decode(feature_vector, priority_values)
        ingredient_probs = decode_result["ingredient_probs"]

        candidates = []
        for i in range(num_candidates):
            diversity = 0.2 + 0.2 * i
            ingredients = self.decoder.sample_ingredients(
                ingredient_probs,
                num_ingredients=constraints.get("max_ingredients", 6),
                diversity_factor=diversity,
                constraints=constraints,
            )
            candidates.append(ingredients)

        return candidates

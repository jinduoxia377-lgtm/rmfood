"""
数据预处理管道
提供配方数据的标准化、缺失值填充、特征编码、归一化等功能
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import Any, TypedDict

logger = logging.getLogger(__name__)


def _dot_product(v1: list[float], v2: list[float]) -> float:
    return sum(a * b for a, b in zip(v1, v2))


def _vector_norm(v: list[float]) -> float:
    return math.sqrt(sum(x * x for x in v))


def _cosine_similarity(v1: list[float], v2: list[float]) -> float:
    norm1 = _vector_norm(v1)
    norm2 = _vector_norm(v2)
    if norm1 < 1e-8 or norm2 < 1e-8:
        return 0.0
    return _dot_product(v1, v2) / (norm1 * norm2)


def _euclidean_distance(v1: list[float], v2: list[float]) -> float:
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(v1, v2)))


def _vector_mean(vectors: list[list[float]]) -> list[float]:
    if not vectors:
        return []
    dim = len(vectors[0])
    return [sum(v[i] for v in vectors) / len(vectors) for i in range(dim)]


def _vector_std(vectors: list[list[float]]) -> list[float]:
    if not vectors:
        return []
    dim = len(vectors[0])
    means = _vector_mean(vectors)
    variances = []
    for i in range(dim):
        variance = sum((v[i] - means[i]) ** 2 for v in vectors) / len(vectors)
        variances.append(math.sqrt(variance))
    return variances


class MinMaxScaler:
    """最小最大归一化器"""

    def __init__(self):
        self.min_vals: list[float] = []
        self.max_vals: list[float] = []
        self.fitted = False

    def fit(self, data: list[list[float]]) -> "MinMaxScaler":
        if not data:
            return self

        data_arr = [list(col) for col in zip(*data)]
        self.min_vals = [min(col) for col in data_arr]
        self.max_vals = [max(col) for col in data_arr]

        for i in range(len(self.min_vals)):
            if self.min_vals[i] == self.max_vals[i]:
                self.max_vals[i] = self.min_vals[i] + 1.0

        self.fitted = True
        return self

    def transform(self, data: list[list[float]]) -> list[list[float]]:
        if not data or not self.fitted:
            return data

        result = []
        for row in data:
            normalized = []
            for i, val in enumerate(row):
                range_val = self.max_vals[i] - self.min_vals[i]
                if range_val == 0:
                    normalized.append(0.0)
                else:
                    normalized.append((val - self.min_vals[i]) / range_val)
            result.append(normalized)
        return result

    def inverse_transform(self, data: list[list[float]]) -> list[list[float]]:
        if not data or not self.fitted:
            return data

        result = []
        for row in data:
            original = []
            for i, val in enumerate(row):
                range_val = self.max_vals[i] - self.min_vals[i]
                original.append(val * range_val + self.min_vals[i])
            result.append(original)
        return result


class StandardScaler:
    """标准化缩放器 (Z-score)"""

    def __init__(self):
        self.means: list[float] = []
        self.stds: list[float] = []
        self.fitted = False

    def fit(self, data: list[list[float]]) -> "StandardScaler":
        if not data:
            return self

        data_arr = [list(col) for col in zip(*data)]
        self.means = [sum(col) / len(col) for col in data_arr]
        self.stds = []
        for i, col in enumerate(data_arr):
            variance = sum((x - self.means[i]) ** 2 for x in col) / len(col)
            std = math.sqrt(variance)
            self.stds.append(std if std > 1e-8 else 1.0)

        self.fitted = True
        return self

    def transform(self, data: list[list[float]]) -> list[list[float]]:
        if not data or not self.fitted:
            return data

        result = []
        for row in data:
            standardized = [(val - self.means[i]) / self.stds[i] for i, val in enumerate(row)]
            result.append(standardized)
        return result

    def inverse_transform(self, data: list[list[float]]) -> list[list[float]]:
        if not data or not self.fitted:
            return data

        result = []
        for row in data:
            original = [val * self.stds[i] + self.means[i] for i, val in enumerate(row)]
            result.append(original)
        return result


class HerbFeatures(TypedDict):
    """药材特征结构"""
    herb_id: int | None
    name: str
    category: str | None
    properties: dict[str, Any]
    is_food_homology: bool
    effect_vector: list[float]


class FormulaFeatures(TypedDict):
    """配方特征结构"""
    formula_id: int | None
    herb_features: list[HerbFeatures]
    effect_vector: list[float]
    composition_vector: list[float]
    synergy_features: list[float]


@dataclass
class PreprocessingConfig:
    """预处理配置"""
    normalization_method: str = "minmax"
    missing_value_strategy: str = "mean"
    effect_vector_dim: int = 32
    default_category: str = "其他"
    default_effect_score: float = 0.0


EFFECT_ENCODINGS: dict[str, list[float]] = {
    "补气": [1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    "补血": [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    "滋阴": [0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    "壮阳": [0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0],
    "活血": [0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0],
    "化瘀": [0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0],
    "清热": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0],
    "解毒": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0],
    "降血压": [0.7, 0.0, 0.3, 0.0, 0.5, 0.0, 0.8, 0.0],
    "降血糖": [0.6, 0.0, 0.5, 0.0, 0.0, 0.0, 0.7, 0.3],
    "降血脂": [0.5, 0.3, 0.0, 0.0, 0.6, 0.2, 0.4, 0.0],
    "抗氧化": [0.3, 0.4, 0.5, 0.2, 0.0, 0.0, 0.6, 0.5],
    "抗炎": [0.2, 0.0, 0.3, 0.0, 0.0, 0.4, 0.9, 0.3],
    "免疫调节": [0.8, 0.5, 0.4, 0.3, 0.0, 0.0, 0.5, 0.4],
    "抗疲劳": [0.9, 0.6, 0.3, 0.5, 0.0, 0.0, 0.2, 0.0],
    "改善睡眠": [0.5, 0.4, 0.7, 0.2, 0.0, 0.0, 0.0, 0.0],
    "润肺": [0.4, 0.0, 0.8, 0.0, 0.0, 0.0, 0.5, 0.0],
    "止咳": [0.3, 0.0, 0.6, 0.0, 0.0, 0.3, 0.7, 0.2],
    "平喘": [0.3, 0.0, 0.5, 0.0, 0.4, 0.2, 0.6, 0.0],
    "养胃": [0.7, 0.4, 0.6, 0.0, 0.0, 0.0, 0.3, 0.0],
    "健脾": [0.8, 0.3, 0.4, 0.0, 0.0, 0.0, 0.2, 0.0],
    "消食": [0.5, 0.2, 0.3, 0.0, 0.3, 0.4, 0.4, 0.0],
    "通便": [0.4, 0.3, 0.5, 0.0, 0.2, 0.5, 0.3, 0.0],
    "利尿": [0.4, 0.0, 0.3, 0.3, 0.7, 0.4, 0.2, 0.0],
    "保肝": [0.6, 0.5, 0.4, 0.2, 0.3, 0.3, 0.7, 0.4],
    "护肾": [0.7, 0.4, 0.5, 0.6, 0.3, 0.0, 0.4, 0.3],
    "补脑": [0.8, 0.6, 0.5, 0.4, 0.0, 0.0, 0.3, 0.2],
    "延缓衰老": [0.5, 0.5, 0.6, 0.5, 0.0, 0.0, 0.6, 0.6],
    "减肥": [0.4, 0.5, 0.4, 0.0, 0.5, 0.3, 0.5, 0.0],
    "美容": [0.4, 0.6, 0.5, 0.3, 0.0, 0.0, 0.5, 0.5],
}

CATEGORY_ENCODINGS: dict[str, list[float]] = {
    "补益药": [1.0, 0.0, 0.0, 0.0, 0.0],
    "清热药": [0.0, 1.0, 0.0, 0.0, 0.0],
    "解表药": [0.0, 0.0, 1.0, 0.0, 0.0],
    "活血药": [0.0, 0.0, 0.0, 1.0, 0.0],
    "收涩药": [0.0, 0.0, 0.0, 0.0, 1.0],
    "其他": [0.2, 0.2, 0.2, 0.2, 0.2],
}


class ParameterNormalizer:
    """参数标准化模块"""

    def __init__(self, config: PreprocessingConfig | None = None):
        self.config = config or PreprocessingConfig()
        self._minmax_scaler = MinMaxScaler()
        self._standard_scaler = StandardScaler()
        self._fitted = False

    def fit(self, data: list[list[float]]) -> "ParameterNormalizer":
        """拟合标准化器"""
        if not data:
            logger.warning("训练数据为空，跳过标准化器拟合")
            return self

        if self.config.normalization_method == "minmax":
            self._minmax_scaler.fit(data)
        elif self.config.normalization_method == "standard":
            self._standard_scaler.fit(data)

        self._fitted = True
        return self

    def transform(self, data: list[list[float]]) -> list[list[float]]:
        """应用标准化变换"""
        if not data:
            return []

        if not self._fitted:
            logger.warning("标准化器未拟合，先执行 fit")
            self.fit(data)

        if self.config.normalization_method == "minmax":
            result = self._minmax_scaler.transform(data)
        else:
            result = self._standard_scaler.transform(data)

        return result

    def fit_transform(self, data: list[list[float]]) -> list[list[float]]:
        """拟合并应用变换"""
        self.fit(data)
        return self.transform(data)

    def inverse_transform(self, data: list[list[float]]) -> list[list[float]]:
        """反标准化"""
        if not data:
            return []

        if self.config.normalization_method == "minmax":
            result = self._minmax_scaler.inverse_transform(data)
        else:
            result = self._standard_scaler.inverse_transform(data)

        return result


class MissingValueHandler:
    """缺失值填充策略"""

    def __init__(self, strategy: str = "mean"):
        self.strategy = strategy
        self._column_means: dict[int, float] = {}
        self._column_defaults: dict[int, Any] = {}

    def compute_statistics(self, data: list[list[Any]]) -> None:
        """计算列统计信息"""
        if not data:
            return

        num_cols = len(data[0]) if data else 0
        for col_idx in range(num_cols):
            col_values = [row[col_idx] for row in data]
            numeric_values = []

            for val in col_values:
                if val is not None and val != "" and val != "null":
                    try:
                        numeric_values.append(float(val))
                    except (ValueError, TypeError):
                        pass

            if numeric_values:
                self._column_means[col_idx] = sum(numeric_values) / len(numeric_values)
            else:
                self._column_means[col_idx] = 0.0

    def fill(self, data: list[list[Any]]) -> list[list[Any]]:
        """填充缺失值"""
        if not data:
            return []

        self.compute_statistics(data)
        result = []

        for row in data:
            new_row = []
            for col_idx, val in enumerate(row):
                if val is None or val == "" or val == "null":
                    if self.strategy == "mean":
                        new_row.append(self._column_means.get(col_idx, 0.0))
                    elif self.strategy == "default":
                        new_row.append(self._column_defaults.get(col_idx, 0.0))
                    else:
                        new_row.append(0.0)
                else:
                    new_row.append(val)
            result.append(new_row)

        return result

    def set_default(self, column_idx: int, default_value: Any) -> None:
        """设置列的默认值"""
        self._column_defaults[column_idx] = default_value


class EffectEncoder:
    """功效标签转向量编码"""

    def __init__(self, effect_encodings: dict[str, list[float]] | None = None):
        self.effect_encodings = effect_encodings or EFFECT_ENCODINGS
        self.effect_list = list(self.effect_encodings.keys())
        self.vector_dim = len(self.effect_encodings[self.effect_list[0]]) if self.effect_list else 8

    def encode_single(self, effect: str) -> list[float]:
        """编码单个功效"""
        effect_clean = effect.strip()
        if effect_clean in self.effect_encodings:
            return self.effect_encodings[effect_clean].copy()

        effect_lower = effect_clean.lower()
        for known_effect, vector in self.effect_encodings.items():
            if known_effect in effect_lower or effect_lower in known_effect:
                return vector.copy()

        base_vector = [0.0] * self.vector_dim
        char_sum = sum(ord(c) for c in effect_clean)
        for i in range(len(base_vector)):
            base_vector[i] = (char_sum % (i + 10)) / 10.0

        return base_vector

    def encode_multi(self, effects: list[str]) -> list[float]:
        """编码多个功效（取平均）"""
        if not effects:
            return [0.0] * self.vector_dim

        vectors = [self.encode_single(e) for e in effects]
        result = []
        for i in range(self.vector_dim):
            result.append(sum(v[i] for v in vectors) / len(vectors))
        return result

    def encode_to_dim(self, effects: list[str], target_dim: int) -> list[float]:
        """编码功效到指定维度"""
        base_vector = self.encode_multi(effects)

        if target_dim <= self.vector_dim:
            return base_vector[:target_dim]

        extended = base_vector + [0.0] * (target_dim - self.vector_dim)
        return extended

    def get_all_effects(self) -> list[str]:
        """获取所有已知功效列表"""
        return self.effect_list.copy()


class HerbFeatureExtractor:
    """药材属性特征提取"""

    def __init__(
        self,
        effect_encoder: EffectEncoder | None = None,
        category_encodings: dict[str, list[float]] | None = None,
    ):
        self.effect_encoder = effect_encoder or EffectEncoder()
        self.category_encodings = category_encodings or CATEGORY_ENCODINGS
        self.default_category = "其他"

    def extract(self, herb_data: dict[str, Any]) -> HerbFeatures:
        """提取单个药材特征"""
        properties = herb_data.get("properties") or {}
        effects = properties.get("effects", []) if isinstance(properties, dict) else []

        if isinstance(effects, str):
            effects = [e.strip() for e in effects.split(",")]

        category = herb_data.get("category") or self.default_category
        if category not in self.category_encodings:
            category = self.default_category

        effect_vector = self.effect_encoder.encode_multi(effects)
        category_vector = self.category_encodings.get(category, self.category_encodings[self.default_category])

        base_features = [
            1.0 if herb_data.get("is_food_homology") else 0.0,
            len(effects) / 10.0,
            1.0 if herb_data.get("source") else 0.0,
        ]

        herb_features: HerbFeatures = {
            "herb_id": herb_data.get("id"),
            "name": herb_data.get("name", ""),
            "category": category,
            "properties": properties,
            "is_food_homology": bool(herb_data.get("is_food_homology")),
            "effect_vector": effect_vector + category_vector + base_features,
        }

        return herb_features

    def extract_batch(self, herbs_data: list[dict[str, Any]]) -> list[HerbFeatures]:
        """批量提取药材特征"""
        return [self.extract(h) for h in herbs_data]


class CompatibilityFeatureBuilder:
    """配伍特征构建"""

    def __init__(self, effect_encoder: EffectEncoder | None = None):
        self.effect_encoder = effect_encoder or EffectEncoder()

    def build_pairwise_features(
        self,
        herb1_features: HerbFeatures,
        herb2_features: HerbFeatures,
    ) -> list[float]:
        """构建两个药材之间的配伍特征"""
        v1 = herb1_features["effect_vector"]
        v2 = herb2_features["effect_vector"]

        cosine_sim = _cosine_similarity(v1, v2)
        euclidean_dist = _euclidean_distance(v1, v2)
        dot_product = _dot_product(v1, v2)

        feature_vector = [
            float(cosine_sim),
            float(euclidean_dist / 10.0),
            float(dot_product / 100.0),
            1.0 if herb1_features["category"] == herb2_features["category"] else 0.0,
            1.0 if herb1_features["is_food_homology"] == herb2_features["is_food_homology"] else 0.0,
        ]

        return feature_vector

    def build_formula_features(
        self,
        herb_features_list: list[HerbFeatures],
    ) -> list[float]:
        """构建配方整体配伍特征"""
        if not herb_features_list:
            return [0.0] * 10

        effect_vectors = [h["effect_vector"] for h in herb_features_list]

        avg_effect = _vector_mean(effect_vectors)
        std_effect = _vector_std(effect_vectors)

        pairwise_scores = []
        for i in range(len(effect_vectors)):
            for j in range(i + 1, len(effect_vectors)):
                cos_sim = _cosine_similarity(effect_vectors[i], effect_vectors[j])
                pairwise_scores.append(cos_sim)

        avg_pairwise = sum(pairwise_scores) / len(pairwise_scores) if pairwise_scores else 0.0

        diversity = len(set(h["category"] for h in herb_features_list if h["category"]))

        formula_features = avg_effect[:5] + [
            sum(std_effect) / len(std_effect) if std_effect else 0.0,
            float(avg_pairwise),
            float(diversity / max(len(herb_features_list), 1)),
            float(len(herb_features_list) / 10.0),
            float(sum(1 for h in herb_features_list if h["is_food_homology"]) / max(len(herb_features_list), 1)),
        ]

        return formula_features


class DataPreprocessingPipeline:
    """数据预处理管道主类"""

    def __init__(self, config: PreprocessingConfig | None = None):
        self.config = config or PreprocessingConfig()

        self.normalizer = ParameterNormalizer(self.config)
        self.missing_handler = MissingValueHandler(strategy=self.config.missing_value_strategy)
        self.effect_encoder = EffectEncoder()
        self.herb_extractor = HerbFeatureExtractor(effect_encoder=self.effect_encoder)
        self.compatibility_builder = CompatibilityFeatureBuilder(effect_encoder=self.effect_encoder)

        self._is_fitted = False

    def fit(self, training_data: list[dict[str, Any]]) -> "DataPreprocessingPipeline":
        """
        拟合预处理管道

        Args:
            training_data: 训练数据列表，每项包含 herbs 和 target_effects
        """
        all_vectors = []

        for item in training_data:
            herbs = item.get("herbs", [])

            herb_features = self.herb_extractor.extract_batch(herbs)
            for hf in herb_features:
                all_vectors.append(hf["effect_vector"])

        if all_vectors:
            self.normalizer.fit(all_vectors)
            self._is_fitted = True

        logger.info(f"预处理管道拟合完成，特征维度: {len(all_vectors[0]) if all_vectors else 0}")
        return self

    def transform(self, data: dict[str, Any]) -> FormulaFeatures:
        """
        转换单个配方数据

        Args:
            data: 包含 herbs 和 target_effects 的字典

        Returns:
            特征化的配方数据
        """
        herbs = data.get("herbs", [])
        target_effects = data.get("target_effects", [])

        herb_features = self.herb_extractor.extract_batch(herbs)

        if self._is_fitted:
            for hf in herb_features:
                norm_vec = self.normalizer.transform([hf["effect_vector"]])[0]
                hf["effect_vector"] = norm_vec

        effect_vector = self.effect_encoder.encode_to_dim(
            target_effects, self.config.effect_vector_dim
        )

        formula_features = self.compatibility_builder.build_formula_features(herb_features)

        composition_vector = self._build_composition_vector(herbs)

        result: FormulaFeatures = {
            "formula_id": data.get("formula_id"),
            "herb_features": herb_features,
            "effect_vector": effect_vector,
            "composition_vector": composition_vector,
            "synergy_features": formula_features,
        }

        return result

    def fit_transform(self, training_data: list[dict[str, Any]]) -> list[FormulaFeatures]:
        """拟合并转换训练数据"""
        self.fit(training_data)
        return [self.transform(item) for item in training_data]

    def transform_batch(self, data_list: list[dict[str, Any]]) -> list[FormulaFeatures]:
        """批量转换配方数据"""
        return [self.transform(item) for item in data_list]

    def _build_composition_vector(self, herbs: list[dict[str, Any]]) -> list[float]:
        """构建成分组成向量"""
        categories = {}
        for herb in herbs:
            cat = herb.get("category", "其他")
            categories[cat] = categories.get(cat, 0) + 1

        total = len(herbs) if herbs else 1
        composition = [
            categories.get("补益药", 0) / total,
            categories.get("清热药", 0) / total,
            categories.get("解表药", 0) / total,
            categories.get("活血药", 0) / total,
            categories.get("收涩药", 0) / total,
            categories.get("其他", 0) / total,
            sum(1 for h in herbs if h.get("is_food_homology")) / total,
            total / 20.0,
        ]

        return composition


data_preprocessing_pipeline = DataPreprocessingPipeline()

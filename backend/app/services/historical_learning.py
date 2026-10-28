"""
历史配方学习增强模块
实现专利权利要求 G2、G3：历史配方学习增强
"""
import math
import random
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Set


@dataclass
class FormulaEmbedding:
    """配方嵌入向量"""
    formula_id: str
    ingredients_vec: List[float]
    dosages_vec: List[float]
    effects_vec: List[float]
    properties_vec: List[float]
    combined_vec: List[float] = field(default_factory=list)

    def __post_init__(self):
        if not self.combined_vec:
            self.combined_vec = (
                self.ingredients_vec * 0.4 +
                self.dosages_vec * 0.3 +
                self.effects_vec * 0.2 +
                self.properties_vec * 0.1
            )


class EnhancedHistoricalLearner:
    """增强的历史配方学习器"""

    def __init__(
        self,
        similarity_threshold: float = 0.75,
        min_samples: int = 10,
        embedding_model: str = "formula_v2"
    ):
        self.similarity_threshold = similarity_threshold
        self.min_samples = min_samples
        self.embedding_model = embedding_model
        self.formula_library = {}
        self.embedding_cache = {}

    def add_formula(self, formula: dict):
        """添加配方到库"""
        formula_id = formula.get("id", str(random.randint(10000, 99999)))
        self.formula_library[formula_id] = formula

        embedding = self._create_embedding(formula)
        self.embedding_cache[formula_id] = embedding

    def _create_embedding(self, formula: dict) -> FormulaEmbedding:
        """创建配方嵌入"""
        ingredients = formula.get("ingredients", {})
        effects = formula.get("effects", [])
        properties = formula.get("properties", {})

        ingredients_vec = self._encode_ingredients(ingredients)
        dosages_vec = list(ingredients.values())
        effects_vec = self._encode_effects(effects)
        properties_vec = list(properties.values()) if properties else [0.0] * 5

        return FormulaEmbedding(
            formula_id=formula.get("id", ""),
            ingredients_vec=ingredients_vec,
            dosages_vec=dosages_vec,
            effects_vec=effects_vec,
            properties_vec=properties_vec
        )

    def _encode_ingredients(self, ingredients: Dict[str, float]) -> List[float]:
        """编码成分为向量"""
        ingredient_vocab = sorted(set(ingredients.keys()))
        return [ingredients.get(ing, 0.0) for ing in ingredient_vocab]

    def _encode_effects(self, effects: List[str]) -> List[float]:
        """编码功效为向量"""
        effect_vocab = ["抗炎", "抗氧化", "免疫调节", "抗菌", "抗病毒"]
        return [1.0 if eff in effects else 0.0 for eff in effect_vocab]

    def find_similar_formulas(
        self,
        query_formula: dict,
        top_k: int = 10,
        include_metadata: bool = True
    ) -> List[dict]:
        """查找相似配方"""
        if not self.formula_library:
            return []

        query_embedding = self._create_embedding(query_formula)
        similarities = []

        for formula_id, embedding in self.embedding_cache.items():
            sim = self.compute_similarity_embeddings(query_embedding, embedding)
            similarities.append((formula_id, sim))

        similarities.sort(key=lambda x: x[1], reverse=True)
        top_k = similarities[:top_k]

        results = []
        for formula_id, sim in top_k:
            if sim >= self.similarity_threshold:
                formula = self.formula_library[formula_id].copy()
                formula["similarity_score"] = sim

                if include_metadata:
                    formula["metadata"] = {
                        "embedding_model": self.embedding_model,
                        "match_type": "high" if sim > 0.9 else "medium" if sim > 0.8 else "low"
                    }

                results.append(formula)

        return results

    def compute_similarity_embeddings(
        self,
        emb1: FormulaEmbedding,
        emb2: FormulaEmbedding,
        method: str = "cosine"
    ) -> float:
        """计算嵌入向量相似度"""
        if method == "cosine":
            return self._cosine_similarity(emb1.combined_vec, emb2.combined_vec)
        elif method == "euclidean":
            return 1.0 / (1.0 + self._euclidean_distance(emb1.combined_vec, emb2.combined_vec))
        elif method == "manhattan":
            return 1.0 / (1.0 + self._manhattan_distance(emb1.combined_vec, emb2.combined_vec))
        else:
            return self._cosine_similarity(emb1.combined_vec, emb2.combined_vec)

    def compute_similarity(
        self,
        formula1: dict,
        formula2: dict,
        method: str = "cosine"
    ) -> float:
        """计算配方相似度"""
        emb1 = self._create_embedding(formula1)
        emb2 = self._create_embedding(formula2)
        return self.compute_similarity_embeddings(emb1, emb2, method)

    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """余弦相似度"""
        if not vec1 or not vec2 or len(vec1) != len(vec2):
            return 0.0

        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = math.sqrt(sum(a * a for a in vec1))
        norm2 = math.sqrt(sum(b * b for b in vec2))

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return dot_product / (norm1 * norm2)

    def _euclidean_distance(self, vec1: List[float], vec2: List[float]) -> float:
        """欧氏距离"""
        if not vec1 or not vec2:
            return float('inf')

        return math.sqrt(sum((a - b) ** 2 for a, b in zip(vec1, vec2)))

    def _manhattan_distance(self, vec1: List[float], vec2: List[float]) -> float:
        """曼哈顿距离"""
        if not vec1 or not vec2:
            return float('inf')

        return sum(abs(a - b) for a, b in zip(vec1, vec2))

    def get_recommendations(
        self,
        user_preferences: dict,
        context: dict = None,
        n_recommendations: int = 5
    ) -> List[dict]:
        """基于历史和偏好推荐配方"""
        target_effects = user_preferences.get("target_effects", [])
        max_cost = user_preferences.get("max_cost", float('inf'))
        preferred_ingredients = user_preferences.get("preferred_ingredients", [])

        scored_formulas = []

        for formula_id, formula in self.formula_library.items():
            score = 0.0

            formula_effects = set(formula.get("effects", []))
            target_set = set(target_effects)
            if target_set:
                effect_match = len(formula_effects & target_set) / len(target_set)
                score += effect_match * 0.5

            ingredients = set(formula.get("ingredients", {}).keys())
            if preferred_ingredients:
                pref_set = set(preferred_ingredients)
                ingredient_match = len(ingredients & pref_set) / len(pref_set)
                score += ingredient_match * 0.3

            formula_cost = formula.get("cost", 0)
            if formula_cost <= max_cost:
                score += 0.2

            scored_formulas.append((formula.copy(), score))

        scored_formulas.sort(key=lambda x: x[1], reverse=True)
        recommendations = [f[0] for f in scored_formulas[:n_recommendations]]

        return recommendations


class EnhancedSimilarityCalculator:
    """增强相似度计算器"""

    def __init__(self):
        self.weights = {
            "ingredients": 0.4,
            "dosages": 0.3,
            "effects": 0.2,
            "properties": 0.1
        }

    def compute_weighted_similarity(
        self,
        formula1: dict,
        formula2: dict
    ) -> float:
        """加权相似度计算"""
        ing_sim = self.compute_ingredient_similarity(formula1, formula2)
        dos_sim = self.compute_dosage_similarity(formula1, formula2)
        eff_sim = self.compute_effect_similarity(formula1, formula2)
        prop_sim = self.compute_property_similarity(formula1, formula2)

        total = (
            ing_sim * self.weights["ingredients"] +
            dos_sim * self.weights["dosages"] +
            eff_sim * self.weights["effects"] +
            prop_sim * self.weights["properties"]
        )

        return total

    def compute_ingredient_similarity(
        self,
        formula1: dict,
        formula2: dict
    ) -> float:
        """成分相似度"""
        ing1 = set(formula1.get("ingredients", {}).keys())
        ing2 = set(formula2.get("ingredients", {}).keys())

        if not ing1 or not ing2:
            return 0.0

        return self.compute_jaccard_similarity(ing1, ing2)

    def compute_dosage_similarity(
        self,
        formula1: dict,
        formula2: dict
    ) -> float:
        """剂量相似度"""
        dos1 = formula1.get("dosage", 0)
        dos2 = formula2.get("dosage", 0)

        if dos1 == 0 and dos2 == 0:
            return 1.0

        diff = abs(dos1 - dos2)
        max_val = max(dos1, dos2)

        if max_val == 0:
            return 1.0

        return 1.0 - min(1.0, diff / max_val)

    def compute_effect_similarity(
        self,
        formula1: dict,
        formula2: dict
    ) -> float:
        """功效相似度"""
        eff1 = set(formula1.get("effects", []))
        eff2 = set(formula2.get("effects", []))

        if not eff1 or not eff2:
            return 0.0

        return self.compute_jaccard_similarity(eff1, eff2)

    def compute_property_similarity(
        self,
        formula1: dict,
        formula2: dict
    ) -> float:
        """属性相似度"""
        props1 = formula1.get("properties", {})
        props2 = formula2.get("properties", {})

        common_keys = set(props1.keys()) & set(props2.keys())
        if not common_keys:
            return 0.0

        similarities = []
        for key in common_keys:
            v1, v2 = props1[key], props2[key]
            if v1 == 0 and v2 == 0:
                similarities.append(1.0)
            else:
                diff = abs(v1 - v2)
                max_val = max(abs(v1), abs(v2))
                similarities.append(1.0 - min(1.0, diff / max_val if max_val != 0 else 0))

        return sum(similarities) / len(similarities)

    @staticmethod
    def compute_jaccard_similarity(set1: Set, set2: Set) -> float:
        """Jaccard相似度"""
        if not set1 or not set2:
            return 0.0

        intersection = len(set1 & set2)
        union = len(set1 | set2)

        return intersection / union if union > 0 else 0.0

    @staticmethod
    def compute_pearson_correlation(
        vector1: List[float],
        vector2: List[float]
    ) -> float:
        """Pearson相关系数"""
        if not vector1 or not vector2 or len(vector1) != len(vector2):
            return 0.0

        n = len(vector1)
        mean1 = sum(vector1) / n
        mean2 = sum(vector2) / n

        numerator = sum((a - mean1) * (b - mean2) for a, b in zip(vector1, vector2))
        denom1 = math.sqrt(sum((a - mean1) ** 2 for a in vector1))
        denom2 = math.sqrt(sum((b - mean2) ** 2 for b in vector2))

        if denom1 == 0 or denom2 == 0:
            return 0.0

        return numerator / (denom1 * denom2)


class KnowledgeGraphEnhancer:
    """知识图谱增强器"""

    def __init__(self):
        self.graph = defaultdict(list)
        self.entity_weights = defaultdict(float)

    def build_graph_from_formulas(
        self,
        formulas: List[dict]
    ) -> dict:
        """从配方构建知识图谱"""
        for formula in formulas:
            formula_id = formula.get("id", "")
            ingredients = formula.get("ingredients", {}).keys()
            effects = formula.get("effects", [])

            for ing in ingredients:
                self.add_relationship(formula_id, ing, "contains", 1.0)
                for eff in effects:
                    self.add_relationship(ing, eff, "contributes_to", 0.8)

            for i, eff1 in enumerate(effects):
                for eff2 in effects[i+1:]:
                    self.add_relationship(eff1, eff2, "co_occurs", 0.5)

        return dict(self.graph)

    def add_relationship(
        self,
        entity1: str,
        entity2: str,
        relationship: str,
        weight: float = 1.0
    ):
        """添加关系"""
        self.graph[entity1].append({
            "target": entity2,
            "relationship": relationship,
            "weight": weight
        })
        self.entity_weights[entity1] += weight
        self.entity_weights[entity2] += weight

    def get_related_entities(
        self,
        entity: str,
        relationship: str = None,
        max_depth: int = 2
    ) -> List[dict]:
        """获取相关实体"""
        results = []
        visited = set()

        def dfs(current_entity: str, depth: int, path: List[str]):
            if depth > max_depth or current_entity in visited:
                return

            visited.add(current_entity)
            path.append(current_entity)

            for edge in self.graph.get(current_entity, []):
                if relationship is None or edge["relationship"] == relationship:
                    results.append({
                        "entity": edge["target"],
                        "relationship": edge["relationship"],
                        "weight": edge["weight"],
                        "path": path.copy()
                    })

                dfs(edge["target"], depth + 1, path.copy())

        dfs(entity, 0, [])
        return results

    def compute_entity_importance(
        self,
        entity: str,
        method: str = "degree"
    ) -> float:
        """计算实体重要性"""
        if method == "degree":
            return self.entity_weights.get(entity, 0.0) / len(self.graph)
        elif method == "pagerank":
            return self._pagerank(entity)
        return self.entity_weights.get(entity, 0.0)

    def _pagerank(self, entity: str, iterations: int = 10, damping: float = 0.85) -> float:
        """简化的PageRank计算"""
        if entity not in self.graph:
            return 0.0

        n = len(self.graph)
        pr = {e: 1.0 / n for e in self.graph}

        for _ in range(iterations):
            new_pr = {}
            for node in self.graph:
                score = (1 - damping) / n
                for edge in self.graph[node]:
                    if edge["target"] in pr:
                        score += damping * pr[edge["target"]] * edge["weight"]
                new_pr[node] = score

            pr = new_pr

        return pr.get(entity, 0.0)


class FeedbackLearningSystem:
    """反馈学习系统"""

    def __init__(self):
        self.feedback_history = []
        self.weight_adjustments = {}

    def record_feedback(
        self,
        formula_id: str,
        user_id: str,
        feedback_type: str,
        rating: float = None,
        comments: str = None
    ):
        """记录用户反馈"""
        self.feedback_history.append({
            "formula_id": formula_id,
            "user_id": user_id,
            "feedback_type": feedback_type,
            "rating": rating,
            "comments": comments
        })

    def analyze_patterns(self) -> dict:
        """分析反馈模式"""
        if not self.feedback_history:
            return {"patterns": [], "insights": []}

        accept_count = sum(1 for f in self.feedback_history if f["feedback_type"] == "accept")
        reject_count = sum(1 for f in self.feedback_history if f["feedback_type"] == "reject")
        modify_count = sum(1 for f in self.feedback_history if f["feedback_type"] == "modify")

        total = len(self.feedback_history)
        patterns = {
            "acceptance_rate": accept_count / total if total > 0 else 0,
            "rejection_rate": reject_count / total if total > 0 else 0,
            "modification_rate": modify_count / total if total > 0 else 0,
            "total_feedbacks": total
        }

        return {"patterns": patterns, "insights": []}

    def update_similarity_weights(
        self,
        feedback_data: List[dict]
    ) -> dict:
        """基于反馈更新相似度权重"""
        ingredient_adjustments = defaultdict(lambda: {"positive": 0, "negative": 0})

        for feedback in feedback_data:
            if feedback["feedback_type"] == "accept":
                delta = 1
            elif feedback["feedback_type"] == "reject":
                delta = -1
            else:
                delta = 0.5

            if delta != 0:
                for ing in feedback.get("ingredients", []):
                    if delta > 0:
                        ingredient_adjustments[ing]["positive"] += delta
                    else:
                        ingredient_adjustments[ing]["negative"] += abs(delta)

        adjustments = {}
        for ing, counts in ingredient_adjustments.items():
            total = counts["positive"] + counts["negative"]
            if total > 0:
                adjustments[ing] = counts["positive"] / total

        self.weight_adjustments = adjustments
        return adjustments

    def get_improvement_suggestions(
        self,
        formula: dict
    ) -> List[dict]:
        """获取配方改进建议"""
        suggestions = []
        formula_ingredients = set(formula.get("ingredients", {}).keys())

        for ing, weight in self.weight_adjustments.items():
            if weight > 0.7:
                suggestions.append({
                    "type": "add_ingredient",
                    "ingredient": ing,
                    "confidence": weight,
                    "reason": "高接受率成分"
                })
            elif weight < 0.3:
                suggestions.append({
                    "type": "remove_ingredient",
                    "ingredient": ing,
                    "confidence": 1 - weight,
                    "reason": "低接受率成分"
                })

        suggestions.sort(key=lambda x: x["confidence"], reverse=True)
        return suggestions[:5]


__all__ = [
    "EnhancedHistoricalLearner",
    "EnhancedSimilarityCalculator",
    "KnowledgeGraphEnhancer",
    "FeedbackLearningSystem",
    "FormulaEmbedding"
]

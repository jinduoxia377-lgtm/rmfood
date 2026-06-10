"""
DiversityEnhancer - 配方多样性增强算法
基于余弦相似度计算配方多样性，实现多样性惩罚机制避免生成高度相似的配方
"""
import logging
import random
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


class DiversityEnhancer:
    """配方多样性增强器"""

    def __init__(
        self,
        diversity_threshold: float = 0.7,
        penalty_weight: float = 0.2,
        perturbation_strength: float = 0.1,
    ):
        self.diversity_threshold = diversity_threshold
        self.penalty_weight = penalty_weight
        self.perturbation_strength = perturbation_strength
        self.ingredient_vectors = {}
        self._initialize_ingredient_vectors()

    def _initialize_ingredient_vectors(self) -> None:
        """初始化成分向量空间"""
        efficacy_features = {
            "补气": ["人参", "黄芪", "党参", "西洋参", "太子参", "山药"],
            "养血": ["红枣", "枸杞子", "龙眼肉", "当归", "熟地黄", "阿胶"],
            "滋阴": ["麦冬", "石斛", "玉竹", "百合", "沙参", "枸杞子"],
            "温阳": ["肉桂", "附子", "干姜", "鹿茸", "杜仲"],
            "清热": ["菊花", "金银花", "夏枯草", "鱼腥草", "蒲公英"],
            "利湿": ["茯苓", "薏苡仁", "泽泻", "猪苓", "车前子"],
            "安神": ["酸枣仁", "远志", "合欢花", "夜交藤", "茯神"],
            "活血": ["丹参", "川芎", "红花", "桃仁", "三七"],
            "理气": ["陈皮", "香附", "木香", "枳壳", "佛手"],
            "健脾": ["山楂", "麦芽", "神曲", "鸡内金", "白术"],
        }

        taste_features = {
            "甘": 0.9,
            "甜": 0.85,
            "酸": 0.3,
            "苦": 0.4,
            "辣": 0.2,
            "辛": 0.25,
            "咸": 0.35,
            "淡": 0.5,
        }

        safety_features = {
            "safe": 1.0,
            "caution": 0.7,
            "warning": 0.4,
            "toxic": 0.1,
        }

        all_ingredients = set()
        for ingredients in efficacy_features.values():
            all_ingredients.update(ingredients)

        for ingredient in all_ingredients:
            efficacy_vector = []
            for category, members in efficacy_features.items():
                efficacy_vector.append(1.0 if ingredient in members else 0.0)

            taste_vector = [
                taste_features.get("甘", 0.5),
                taste_features.get("酸", 0.3),
                taste_features.get("苦", 0.4),
                taste_features.get("辣", 0.2),
            ]

            self.ingredient_vectors[ingredient] = {
                "efficacy": np.array(efficacy_vector),
                "taste": np.array(taste_vector),
                "safety": np.array([safety_features["safe"]]),
            }

    def _compute_cosine_similarity(
        self,
        vec1: np.ndarray,
        vec2: np.ndarray,
    ) -> float:
        """计算余弦相似度"""
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return float(np.dot(vec1, vec2) / (norm1 * norm2))

    def _compute_formula_vector(
        self,
        ingredients: list[dict[str, Any]],
    ) -> np.ndarray:
        """计算配方向量"""
        if not ingredients:
            return np.zeros(50)

        efficacy_vectors = []
        taste_vectors = []

        for ing in ingredients:
            name = ing.get("name", "")
            if name in self.ingredient_vectors:
                efficacy_vectors.append(self.ingredient_vectors[name]["efficacy"])
                taste_vectors.append(self.ingredient_vectors[name]["taste"])

        if not efficacy_vectors:
            return np.zeros(50)

        avg_efficacy = np.mean(efficacy_vectors, axis=0)
        avg_taste = np.mean(taste_vectors, axis=0)

        combined = np.concatenate([avg_efficacy, avg_taste])
        if len(combined) < 50:
            combined = np.pad(combined, (0, 50 - len(combined)))
        elif len(combined) > 50:
            combined = combined[:50]

        return combined

    def compute_diversity_score(
        self,
        formula1: list[dict[str, Any]],
        formula2: list[dict[str, Any]],
    ) -> float:
        """
        计算两个配方之间的多样性得分

        Args:
            formula1: 配方1成分列表
            formula2: 配方2成分列表

        Returns:
            多样性得分 (0-1)，越大约束束相似
        """
        vec1 = self._compute_formula_vector(formula1)
        vec2 = self._compute_formula_vector(formula2)

        similarity = self._compute_cosine_similarity(vec1, vec2)

        diversity_score = 1.0 - similarity

        return round(diversity_score, 4)

    def compute_pairwise_diversity(
        self,
        formulas: list[list[dict[str, Any]]],
    ) -> list[list[float]]:
        """
        计算配方列表两两之间的多样性矩阵

        Args:
            formulas: 配方列表

        Returns:
            多样性矩阵
        """
        n = len(formulas)
        diversity_matrix = [[0.0] * n for _ in range(n)]

        for i in range(n):
            for j in range(i + 1, n):
                score = self.compute_diversity_score(formulas[i], formulas[j])
                diversity_matrix[i][j] = score
                diversity_matrix[j][i] = score

        return diversity_matrix

    def apply_diversity_penalty(
        self,
        candidates: list[dict[str, Any]],
        base_scores: list[float],
    ) -> list[float]:
        """
        对候选配方应用多样性惩罚

        Args:
            candidates: 候选配方列表
            base_scores: 基础分数列表

        Returns:
            调整后的分数列表
        """
        if len(candidates) <= 1:
            return base_scores

        formulas = [c.get("ingredients", []) or c.get("herb_combination", []) for c in candidates]
        diversity_matrix = self.compute_pairwise_diversity(formulas)

        adjusted_scores = base_scores.copy()

        for i in range(len(candidates)):
            for j in range(i + 1, len(candidates)):
                diversity = diversity_matrix[i][j]

                if diversity < self.diversity_threshold:
                    penalty = self.penalty_weight * (1.0 - diversity / self.diversity_threshold)
                    adjusted_scores[i] -= penalty * base_scores[i]
                    adjusted_scores[j] -= penalty * base_scores[j]

        adjusted_scores = [max(0.0, s) for s in adjusted_scores]

        return adjusted_scores

    def add_perturbation(
        self,
        formula: list[dict[str, Any]],
        available_ingredients: list[dict[str, Any]] | None = None,
    ) -> list[dict[str, Any]]:
        """
        对配方添加随机扰动以增加创新性

        Args:
            formula: 原始配方
            available_ingredients: 可用成分列表

        Returns:
            扰动后的配方
        """
        if random.random() > self.perturbation_strength:
            return formula

        perturbed = [ing.copy() for ing in formula]

        action = random.choice(["add", "replace", "remove", "adjust"])

        if action == "add" and available_ingredients:
            candidates = [ing for ing in available_ingredients if ing not in perturbed]
            if candidates:
                new_ing = random.choice(candidates).copy()
                perturbed.append(new_ing)

        elif action == "remove" and len(perturbed) > 2:
            removed = random.choice(perturbed)
            perturbed.remove(removed)

        elif action == "replace" and available_ingredients:
            if perturbed:
                target = random.choice(perturbed)
                candidates = [ing for ing in available_ingredients if ing not in perturbed]
                if candidates:
                    new_ing = random.choice(candidates).copy()
                    idx = perturbed.index(target)
                    perturbed[idx] = new_ing

        elif action == "adjust" and perturbed:
            target = random.choice(perturbed)
            if "dosage" in target:
                variation = random.uniform(-0.2, 0.2)
                target["dosage"] *= (1.0 + variation)

        return perturbed

    def select_diverse_candidates(
        self,
        candidates: list[dict[str, Any]],
        scores: list[float],
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        """
        选择多样性最大的候选配方

        Args:
            candidates: 候选配方列表
            scores: 候选配方分数
            top_k: 选择数量

        Returns:
            选中的配方列表
        """
        if len(candidates) <= top_k:
            return candidates

        formulas = [c.get("ingredients", []) or c.get("herb_combination", []) for c in candidates]
        diversity_matrix = self.compute_pairwise_diversity(formulas)

        selected_indices = []
        remaining_indices = list(range(len(candidates)))

        first_idx = scores.index(max(scores))
        selected_indices.append(first_idx)
        remaining_indices.remove(first_idx)

        for _ in range(min(top_k - 1, len(remaining_indices))):
            best_next_idx = None
            best_min_diversity = -1.0

            for candidate_idx in remaining_indices:
                min_diversity = min(
                    diversity_matrix[candidate_idx][selected_idx]
                    for selected_idx in selected_indices
                )

                if min_diversity > best_min_diversity:
                    best_min_diversity = min_diversity
                    best_next_idx = candidate_idx

            if best_next_idx is not None:
                selected_indices.append(best_next_idx)
                remaining_indices.remove(best_next_idx)

        result = [candidates[idx] for idx in selected_indices]
        result.sort(key=lambda x: scores[candidates.index(x)], reverse=True)

        return result

    def optimize_for_diversity(
        self,
        candidates: list[dict[str, Any]],
        scores: list[float],
        target_diversity: float = 0.5,
    ) -> list[dict[str, Any]]:
        """
        优化配方列表以达到目标多样性

        Args:
            candidates: 候选配方列表
            scores: 候选配方分数
            target_diversity: 目标多样性分数

        Returns:
            优化后的配方列表
        """
        if not candidates:
            return []

        formulas = [c.get("ingredients", []) or c.get("herb_combination", []) for c in candidates]
        diversity_matrix = self.compute_pairwise_diversity(formulas)

        avg_diversity = np.mean(diversity_matrix)

        if avg_diversity >= target_diversity:
            return candidates

        optimized = []
        remaining = list(range(len(candidates)))

        remaining.sort(key=lambda i: scores[i], reverse=True)

        while remaining and len(optimized) < len(candidates):
            current_idx = remaining.pop(0)
            optimized.append(candidates[current_idx])

            if len(remaining) > 1:
                current_formula = formulas[current_idx]
                remaining_forms = [formulas[i] for i in remaining]
                diversities = [
                    self.compute_diversity_score(current_formula, f)
                    for f in remaining_forms
                ]

                low_diversity_indices = [
                    i for i, d in enumerate(diversities) if d < target_diversity
                ]

                for idx in sorted(low_diversity_indices, reverse=True):
                    if remaining[idx] in remaining:
                        remaining.pop(idx if idx < len(remaining) else len(remaining) - 1)

        return optimized[:10]


class DiversityMetrics:
    """多样性指标计算器"""

    @staticmethod
    def calculate_shannon_entropy(labels: list[str]) -> float:
        """计算香农熵"""
        if not labels:
            return 0.0

        label_counts = {}
        for label in labels:
            label_counts[label] = label_counts.get(label, 0) + 1

        total = len(labels)
        entropy = 0.0

        for count in label_counts.values():
            if count > 0:
                p = count / total
                entropy -= p * np.log2(p)

        return round(entropy, 4)

    @staticmethod
    def calculate_category_coverage(
        items: list[dict[str, Any]],
        category_key: str = "efficacy",
    ) -> float:
        """计算类别覆盖率"""
        if not items:
            return 0.0

        all_categories = set()
        covered_categories = set()

        for item in items:
            categories = item.get(category_key, [])
            if isinstance(categories, str):
                categories = [categories]
            all_categories.update(categories)
            covered_categories.update(categories)

        if not all_categories:
            return 0.0

        return round(len(covered_categories) / len(all_categories), 4)

    @staticmethod
    def calculate_similarity_variance(
        similarity_matrix: list[list[float]],
    ) -> float:
        """计算相似度方差"""
        if not similarity_matrix or len(similarity_matrix) <= 1:
            return 0.0

        n = len(similarity_matrix)
        similarities = []

        for i in range(n):
            for j in range(i + 1, n):
                similarities.append(similarity_matrix[i][j])

        if not similarities:
            return 0.0

        mean_sim = np.mean(similarities)
        variance = np.var(similarities)

        return round(variance, 4)

"""
⚠️ MOCK IMPLEMENTATION - 模拟实现，非真实 AI 模型

基于专利 US 11,742,060 B2 描述的架构，但当前使用 random.sample() 和
启发式评分模拟配方生成。
整合了 Encoder、Decoder、Scorer 三个子模块，但均使用规则/随机方法。
接入真实神经网络模型后替换为推理实现。
"""
import logging
import random
from typing import Any

import numpy as np

from .encoder import FormulaEncoder
from .decoder import FormulaDecoder
from .scorer import MultiObjectiveScorer, DiversityScorer

logger = logging.getLogger(__name__)


class MockNeuralFormulaEngine:
    """神经网络配方生成引擎（模拟实现）"""

    def __init__(self):
        self.encoder = FormulaEncoder()
        self.decoder = FormulaDecoder()
        self.scorer = MultiObjectiveScorer()
        self.diversity_scorer = DiversityScorer()

    async def generate_formula(
        self,
        target_attributes: dict[str, Any],
        priority_values: dict[str, float] | None = None,
        constraints: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        生成配方候选

        Args:
            target_attributes: 目标属性，包含目标功效列表等
            priority_values: 优先级权重
            constraints: 约束条件

        Returns:
            配方候选列表
        """
        constraints = constraints or {}
        priority_values = priority_values or {}

        target_effects = target_attributes.get("target_effects", [])
        if isinstance(target_effects, str):
            target_effects = [target_effects]

        logger.info(f"开始生成配方: 目标功效={target_effects}, 约束={constraints}")

        feature_vector = self.encoder.encode_formula_request(target_effects, constraints)

        candidates_raw = await self.decoder.generate_candidates(
            feature_vector=feature_vector,
            priority_values=priority_values,
            constraints=constraints,
            num_candidates=constraints.get("max_candidates", 3),
        )

        candidates_formatted = []
        for i, ingredients in enumerate(candidates_raw):
            candidate = {
                "id": f"neural_candidate_{i + 1}",
                "name": f"神经网络方案-{i + 1}（{'+'.join(target_effects[:2])}）",
                "ingredients": [self._format_ingredient(ing) for ing in ingredients],
                "target_effects": target_effects,
                "confidence": round(random.uniform(0.7, 0.95), 2),
            }
            candidates_formatted.append(candidate)

        scored_candidates = self.scorer.rank_candidates(
            candidates_formatted,
            target_effects,
            constraints,
        )

        for candidate in scored_candidates:
            ingredients = candidate.get("ingredients", [])
            diversity_score = self.diversity_scorer.calculate_diversity(ingredients)
            candidate["diversity_score"] = diversity_score

            score_result = candidate.get("score_result", {})
            candidate["final_score"] = score_result.get("final_score", 0.0)

            candidate["roles"] = self._assign_roles(ingredients)

        logger.info(f"生成完成: {len(scored_candidates)} 个候选配方")

        return {
            "candidates": scored_candidates,
            "target_effects": target_effects,
            "constraints": constraints,
            "total_candidates": len(scored_candidates),
            "engine": "NeuralFormulaEngine",
            "patent": "US 11,742,060 B2",
        }

    def _format_ingredient(self, ingredient: dict[str, Any]) -> dict[str, Any]:
        """格式化成分信息"""
        return {
            "name": ingredient.get("name", ""),
            "role": "待定",
            "category": ingredient.get("category", ""),
            "efficacy": ingredient.get("efficacy", []),
            "taste": ingredient.get("taste", ""),
            "probability": ingredient.get("probability", 0.0),
        }

    def _assign_roles(self, ingredients: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """分配君臣佐使角色"""
        if not ingredients:
            return ingredients

        sorted_ingredients = sorted(
            ingredients,
            key=lambda x: x.get("probability", 0.0),
            reverse=True,
        )

        role_assignment = {
            0: "君",
            1: "臣",
            2: "臣",
            3: "佐",
            4: "佐",
            5: "使",
        }

        result = []
        for i, ingredient in enumerate(sorted_ingredients):
            ingredient_copy = ingredient.copy()
            if i < len(sorted_ingredients):
                ingredient_copy["role"] = role_assignment.get(i, "使")
            else:
                ingredient_copy["role"] = "使"
            result.append(ingredient_copy)

        return result

    async def generate_with_iterative_refinement(
        self,
        target_attributes: dict[str, Any],
        priority_values: dict[str, float] | None = None,
        constraints: dict[str, Any] | None = None,
        num_iterations: int = 3,
    ) -> dict[str, Any]:
        """
        迭代优化生成配方

        Args:
            target_attributes: 目标属性
            priority_values: 优先级权重
            constraints: 约束条件
            num_iterations: 迭代次数

        Returns:
            优化后的配方候选
        """
        constraints = constraints or {}
        best_candidates = []

        for iteration in range(num_iterations):
            constraints_copy = constraints.copy()
            if iteration > 0:
                if best_candidates:
                    top_candidate = best_candidates[0]
                    top_ingredients = [ing["name"] for ing in top_candidate.get("ingredients", [])]
                    constraints_copy["exclude_ingredients"] = list(
                        set(constraints_copy.get("exclude_ingredients", [])) | set(top_ingredients[:2])
                    )

            result = await self.generate_formula(
                target_attributes,
                priority_values,
                constraints_copy,
            )

            best_candidates = result.get("candidates", [])

        return {
            "candidates": best_candidates,
            "iterations": num_iterations,
            "target_effects": target_attributes.get("target_effects", []),
        }

    async def generate_diverse_candidates(
        self,
        target_attributes: dict[str, Any],
        priority_values: dict[str, float] | None = None,
        constraints: dict[str, Any] | None = None,
        num_diversity_groups: int = 3,
    ) -> dict[str, Any]:
        """
        生成多样化候选配方组

        Args:
            target_attributes: 目标属性
            priority_values: 优先级权重
            constraints: 约束条件
            num_diversity_groups: 多样性组数量

        Returns:
            多样化配方组
        """
        constraints = constraints or {}
        priority_values = priority_values or {}

        diversity_priority_sets = [
            {"efficacy": 0.9, "safety": 0.5, "taste": 0.3, "stability": 0.3},
            {"safety": 0.9, "efficacy": 0.5, "taste": 0.3, "stability": 0.3},
            {"taste": 0.9, "efficacy": 0.5, "safety": 0.3, "stability": 0.3},
        ]

        all_candidates = []

        for i in range(min(num_diversity_groups, len(diversity_priority_sets))):
            priority_copy = priority_values.copy()
            priority_copy.update(diversity_priority_sets[i])

            result = await self.generate_formula(
                target_attributes,
                priority_copy,
                constraints,
            )

            candidates = result.get("candidates", [])
            for candidate in candidates:
                candidate["diversity_group"] = i + 1
                candidate["diversity_focus"] = list(diversity_priority_sets[i].keys())[
                    list(diversity_priority_sets[i].values()).index(
                        max(diversity_priority_sets[i].values())
                    )
                ]

            all_candidates.extend(candidates)

        all_candidates.sort(key=lambda x: x.get("final_score", 0.0), reverse=True)

        return {
            "candidates": all_candidates[:constraints.get("max_candidates", 9)],
            "diversity_groups": num_diversity_groups,
            "total_candidates": len(all_candidates),
        }


class FormulaCandidate:
    """配方候选数据类"""

    def __init__(self, ingredients: list[dict[str, Any]], target_effects: list[str]):
        self.ingredients = ingredients
        self.target_effects = target_effects
        self.scores: dict[str, float] = {}

    def add_score(self, dimension: str, score: float):
        """添加评分维度"""
        self.scores[dimension] = score

    def get_total_score(self) -> float:
        """获取总分"""
        if not self.scores:
            return 0.0
        weights = {"efficacy": 0.30, "safety": 0.30, "taste": 0.20, "stability": 0.20}
        return sum(self.scores.get(dim, 0.0) * weights.get(dim, 0.0) for dim in weights)

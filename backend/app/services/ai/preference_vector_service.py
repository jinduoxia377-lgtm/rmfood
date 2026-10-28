"""用户偏好向量服务 — 从配方反馈中学习用户偏好

整合用户反馈数据，构建用户偏好向量，用于：
- 个性化配方推荐
- 剂量偏好调整
- 食材偏好学习
- 功效目标优化

数据来源：
- FormulaFeedback 表（配方反馈）
- 用户聊天记录
- 用户画像数据
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class UserPreferenceVector:
    """用户偏好向量"""
    user_id: int
    # 食材偏好（正权重=喜欢，负权重=不喜欢）
    ingredient_weights: Dict[str, float] = field(default_factory=dict)
    # 功效偏好（目标效果权重）
    effect_weights: Dict[str, float] = field(default_factory=dict)
    # 剂量偏好（偏好剂量范围）
    dosage_preference: Dict[str, float] = field(default_factory=lambda: {
        "low": 0.0, "medium": 0.5, "high": 1.0
    })
    # 烹饪形式偏好
    preparation_preference: Dict[str, float] = field(default_factory=lambda: {
        "汤剂": 0.0, "膏方": 0.0, "代茶饮": 0.0, "胶囊": 0.0
    })
    # 预算敏感度
    budget_sensitivity: float = 0.5
    # 风险偏好（保守/激进）
    risk_preference: float = 0.5
    # 更新时间
    last_updated: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    # 反馈历史
    feedback_count: int = 0


class PreferenceVectorService:
    """用户偏好向量服务

    从用户反馈中学习偏好，提供个性化推荐权重。
    """

    def __init__(self, decay_rate: float = 0.95, learning_rate: float = 0.1):
        """
        Args:
            decay_rate: 时间衰减率（每次更新旧权重乘以该值）
            learning_rate: 学习率（新反馈的权重增量系数）
        """
        self._preferences: Dict[int, UserPreferenceVector] = {}
        self._decay_rate = decay_rate
        self._learning_rate = learning_rate

    def get_preference(self, user_id: int) -> UserPreferenceVector:
        """获取用户偏好向量（不存在则创建默认）"""
        if user_id not in self._preferences:
            self._preferences[user_id] = UserPreferenceVector(user_id=user_id)
        return self._preferences[user_id]

    def update_from_feedback(
        self,
        user_id: int,
        feedback_type: str,
        ingredients: List[str],
        formula_id: Optional[str] = None,
        dosage_level: str = "medium",
    ) -> UserPreferenceVector:
        """从反馈更新偏好向量

        Args:
            user_id: 用户 ID
            feedback_type: 反馈类型（approve/reject/modify/like/dislike）
            ingredients: 配方中的食材列表
            formula_id: 配方 ID（可选）
            dosage_level: 剂量水平（low/medium/high）

        Returns:
            更新后的偏好向量
        """
        pref = self.get_preference(user_id)

        # 时间衰减（旧权重衰减）
        for ingredient in pref.ingredient_weights:
            pref.ingredient_weights[ingredient] *= self._decay_rate

        for effect in pref.effect_weights:
            pref.effect_weights[effect] *= self._decay_rate

        # 根据反馈类型调整权重
        weight_delta = self._get_weight_delta(feedback_type)

        # 更新食材偏好
        for ingredient in ingredients:
            current = pref.ingredient_weights.get(ingredient, 0.0)
            pref.ingredient_weights[ingredient] = current + weight_delta

        # 更新剂量偏好
        if dosage_level in pref.dosage_preference:
            current = pref.dosage_preference[dosage_level]
            pref.dosage_preference[dosage_level] = current + weight_delta * 0.5

        # 更新反馈计数
        pref.feedback_count += 1
        pref.last_updated = datetime.now(timezone.utc)

        logger.info(
            "用户 %d 偏好更新: feedback=%s, ingredients=%s, delta=%.2f",
            user_id, feedback_type, ingredients, weight_delta
        )

        return pref

    def update_from_chat_feedback(
        self,
        user_id: int,
        feedback_text: str,
        mentioned_ingredients: List[str] = None,
    ) -> UserPreferenceVector:
        """从聊天反馈文本学习偏好

        Args:
            user_id: 用户 ID
            feedback_text: 反馈文本
            mentioned_ingredients: 提到的食材（可选）

        Returns:
            更新后的偏好向量
        """
        pref = self.get_preference(user_id)
        mentioned_ingredients = mentioned_ingredients or []

        # 简单的情感分析（中文关键词）
        positive_keywords = ["喜欢", "不错", "好", "满意", "有效", "适合"]
        negative_keywords = ["不喜欢", "不好", "差", "无效", "不适合", "过敏"]

        is_positive = any(kw in feedback_text for kw in positive_keywords)
        is_negative = any(kw in feedback_text for kw in negative_keywords)

        if is_positive:
            weight_delta = self._learning_rate * 0.5
        elif is_negative:
            weight_delta = -self._learning_rate * 0.5
        else:
            weight_delta = 0.0

        # 更新提到的食材权重
        for ingredient in mentioned_ingredients:
            current = pref.ingredient_weights.get(ingredient, 0.0)
            pref.ingredient_weights[ingredient] = current + weight_delta

        pref.feedback_count += 1
        pref.last_updated = datetime.now(timezone.utc)

        return pref

    def get_personalized_weight(
        self,
        user_id: int,
        ingredient: str,
        default_weight: float = 0.5,
    ) -> float:
        """获取食材的个性化权重

        Args:
            user_id: 用户 ID
            ingredient: 食材名称
            default_weight: 默认权重

        Returns:
            个性化权重（0-1 范围）
        """
        pref = self.get_preference(user_id)
        user_weight = pref.ingredient_weights.get(ingredient, 0.0)

        # 将用户权重映射到 0-1 范围
        # 假设用户权重范围是 [-1, 1]，映射到 [0, 1]
        normalized = (user_weight + 1.0) / 2.0
        normalized = max(0.0, min(1.0, normalized))

        # 与默认权重混合
        personalized = default_weight * 0.7 + normalized * 0.3

        return personalized

    def get_preferred_ingredients(
        self,
        user_id: int,
        top_k: int = 10,
    ) -> List[tuple[str, float]]:
        """获取用户最偏好的食材列表

        Returns:
            [(食材名称，权重), ...] 按权重降序
        """
        pref = self.get_preference(user_id)
        sorted_items = sorted(
            pref.ingredient_weights.items(),
            key=lambda x: x[1],
            reverse=True
        )
        return sorted_items[:top_k]

    def get_disliked_ingredients(
        self,
        user_id: int,
        top_k: int = 5,
    ) -> List[tuple[str, float]]:
        """获取用户最不喜欢的食材列表

        Returns:
            [(食材名称，权重), ...] 按权重升序
        """
        pref = self.get_preference(user_id)
        sorted_items = sorted(
            pref.ingredient_weights.items(),
            key=lambda x: x[1]
        )
        return sorted_items[:top_k]

    def get_preference_summary(self, user_id: int) -> Dict[str, Any]:
        """获取用户偏好摘要

        Returns:
            偏好摘要字典
        """
        pref = self.get_preference(user_id)

        # 计算偏好方向
        total_weight = sum(pref.ingredient_weights.values())
        positive_count = sum(1 for w in pref.ingredient_weights.values() if w > 0.1)
        negative_count = sum(1 for w in pref.ingredient_weights.values() if w < -0.1)

        return {
            "user_id": user_id,
            "total_ingredients_tracked": len(pref.ingredient_weights),
            "positive_preferences": positive_count,
            "negative_preferences": negative_count,
            "avg_weight": total_weight / len(pref.ingredient_weights) if pref.ingredient_weights else 0.0,
            "total_feedbacks": pref.feedback_count,
            "last_updated": pref.last_updated.isoformat(),
            "top_preferred": pref.ingredient_weights.most_common(5) if hasattr(pref.ingredient_weights, 'most_common') else [],
            "top_disliked": sorted(pref.ingredient_weights.items(), key=lambda x: x[1])[:5],
        }

    def _get_weight_delta(self, feedback_type: str) -> float:
        """根据反馈类型计算权重增量"""
        delta_map = {
            "approve": self._learning_rate,
            "like": self._learning_rate * 0.8,
            "reject": -self._learning_rate,
            "dislike": -self._learning_rate * 0.8,
            "modify": 0.0,  # 修改反馈不直接影响权重
            "neutral": 0.0,
        }
        return delta_map.get(feedback_type, 0.0)

    def get_all_users_summary(self) -> Dict[int, Dict[str, Any]]:
        """获取所有用户的偏好摘要（用于分析）"""
        return {
            user_id: self.get_preference_summary(user_id)
            for user_id in self._preferences
        }

    def clear_user(self, user_id: int) -> None:
        """清除用户偏好数据"""
        if user_id in self._preferences:
            del self._preferences[user_id]
            logger.info("用户 %d 偏好数据已清除", user_id)


# 全局单例
_service_instance: PreferenceVectorService | None = None


def get_preference_vector_service() -> PreferenceVectorService:
    """获取全局偏好向量服务单例"""
    global _service_instance
    if _service_instance is None:
        _service_instance = PreferenceVectorService()
    return _service_instance

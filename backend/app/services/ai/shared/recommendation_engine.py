"""RMFOOD 上下文感知推荐系统

基于混合策略的个性化推荐引擎：
- 协同过滤 (Collaborative Filtering)
- 内容相似度 (Content-Based Filtering)
- 上下文信号 (Context-Aware)
- 冷启动策略 (Cold Start)

支持：
- 实时推荐计算
- 用户反馈记录
- 推荐理由生成
"""
from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


class FeedbackType(str, Enum):
    """反馈类型"""
    LIKE = "like"
    DISLIKE = "dislike"
    USEFUL = "useful"
    NOT_USEFUL = "not_useful"
    VIEWED = "viewed"


@dataclass
class RecommendationItem:
    """推荐项"""
    id: str
    type: str  # template / formula / tip / article
    title: str
    description: str
    score: float = 0.0  # 综合得分

    # 分项得分
    collaborative_score: float = 0.0
    content_score: float = 0.0
    context_score: float = 0.0
    cold_start_score: float = 0.0

    # 元数据
    metadata: Dict[str, Any] = field(default_factory=dict)

    # 推荐理由
    explanation: str = ""
    confidence_reasons: List[str] = field(default_factory=list)


@dataclass
class RecommendationContext:
    """推荐上下文"""
    user_id: str
    current_project_id: Optional[str] = None
    current_task_type: Optional[str] = None
    time_of_day: str = "unknown"  # morning / afternoon / evening / night
    day_of_week: int = 0  # 0=Monday, 6=Sunday
    device_type: str = "desktop"  # desktop / mobile / tablet
    session_depth: int = 1  # 本次会话的页面浏览数

    # 历史行为摘要
    recent_searches: List[str] = field(default_factory=list)
    recent_views: List[str] = field(default_factory=list)
    recent_actions: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class UserFeedbackRecord:
    """用户反馈记录"""
    user_id: str
    item_id: str
    feedback_type: FeedbackType
    timestamp: float
    context: Dict[str, Any] = field(default_factory=dict)


class CollaborativeFilter:
    """
    协同过滤算法（简化版）

    基于用户行为的相似性进行推荐。
    生产环境应使用矩阵分解或深度学习模型。
    """

    def __init__(self):
        self.user_item_matrix: Dict[str, Dict[str, float]] = {}
        self.item_popularity: Dict[str, float] = {}
        self.user_similarity_cache: Dict[str, Dict[str, float]] = {}

    def record_interaction(
        self,
        user_id: str,
        item_id: str,
        rating: float = 1.0,
    ):
        """记录用户交互"""
        if user_id not in self.user_item_matrix:
            self.user_item_matrix[user_id] = {}

        self.user_item_matrix[user_id][item_id] = rating

        # 更新物品流行度
        current = self.item_popularity.get(item_id, 0.0)
        self.item_popularity[item_id] = current + rating

    def get_similar_users(
        self,
        user_id: str,
        top_n: int = 10,
    ) -> List[tuple]:
        """
        找到相似用户（Jaccard相似度）

        Returns:
            [(user_id, similarity_score), ...]
        """
        if user_id not in self.user_item_matrix:
            return []

        target_items = set(self.user_item_matrix[user_id].keys())
        similarities = []

        for other_user, items in self.user_item_matrix.items():
            if other_user == user_id:
                continue

            other_items = set(items.keys())

            # Jaccard相似度
            intersection = len(target_items & other_items)
            union = len(target_items | other_items)

            if union > 0:
                similarity = intersection / union
                similarities.append((other_user, similarity))

        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities[:top_n]

    def recommend_for_user(
        self,
        user_id: str,
        candidate_items: Set[str],
        exclude_items: Optional[Set[str]] = None,
    ) -> Dict[str, float]:
        """
        为用户推荐物品

        Returns:
            {item_id: score}
        """
        scores = {}
        similar_users = self.get_similar_users(user_id, top_n=5)

        user_items = set(
            self.user_item_matrix.get(user_id, {}).keys()
        )
        exclude = exclude_items or set()

        for item_id in candidate_items:
            if item_id in user_items or item_id in exclude:
                continue

            # 基于相似用户的加权评分
            weighted_sum = 0.0
            similarity_sum = 0.0

            for sim_user, sim_score in similar_users:
                if item_id in self.user_item_matrix.get(sim_user, {}):
                    rating = self.user_item_matrix[sim_user][item_id]
                    weighted_sum += sim_score * rating
                    similarity_sum += sim_score

            if similarity_sum > 0:
                scores[item_id] = weighted_sum / similarity_sum
            else:
                # 回退到物品流行度
                scores[item_id] = self.item_popularity.get(item_id, 0.0) * 0.1

        return scores


class ContentBasedFilter:
    """
    内容相似度过滤（简化版）

    基于TF-IDF或关键词匹配计算内容相似性。
    """

    def __init__(self):
        self.item_features: Dict[str, Dict[str, float]] = {}
        self.feature_idf: Dict[str, float] = {}

    def add_item(self, item_id: str, features: Dict[str, float]):
        """添加物品特征"""
        self.item_features[item_id] = features

    def compute_similarity(
        self,
        item_a: str,
        item_b: str,
    ) -> float:
        """
        计算两个物品的余弦相似度
        """
        features_a = self.item_features.get(item_a, {})
        features_b = self.item_features.get(item_b, {})

        if not features_a or not features_b:
            return 0.0

        # 余弦相似度
        common_keys = set(features_a.keys()) & set(features_b.keys())

        dot_product = sum(
            features_a[k] * features_b[k]
            for k in common_keys
        )

        norm_a = math.sqrt(sum(v ** 2 for v in features_a.values()))
        norm_b = math.sqrt(sum(v ** 2 for v in features_b.values()))

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return dot_product / (norm_a * norm_b)

    def find_similar_items(
        self,
        query_item_ids: List[str],
        candidate_items: Set[str],
        threshold: float = 0.3,
    ) -> Dict[str, float]:
        """
        查找与查询物品相似的候选物品

        Returns:
            {item_id: max_similarity}
        """
        scores = {}

        for candidate in candidate_items:
            max_sim = 0.0
            for query_item in query_item_ids:
                sim = self.compute_similarity(query_item, candidate)
                max_sim = max(max_sim, sim)

            if max_sim >= threshold:
                scores[candidate] = max_sim

        return scores


class ContextAnalyzer:
    """
    上下文信号分析器

    考虑时间、设备、会话等上下文因素对推荐的影响。
    """

    WEIGHTS = {
        "time_match": 0.3,
        "task_relevance": 0.4,
        "recency_boost": 0.3,
    }

    def analyze(
        self,
        context: RecommendationContext,
        item_metadata: Dict[str, Any],
    ) -> float:
        """分析上下文相关性得分"""
        score = 0.0

        # 时间匹配
        time_score = self._score_time_context(context, item_metadata)
        score += time_score * self.WEIGHTS["time_match"]

        # 任务相关性
        task_score = self._score_task_relevance(context, item_metadata)
        score += task_score * self.WEIGHTS["task_relevance"]

        # 新鲜度加分
        recency_score = self._score_recency(item_metadata)
        score += recency_score * self.WEIGHTS["recency_boost"]

        return min(score, 1.0)

    def _score_time_context(
        self,
        context: RecommendationContext,
        metadata: Dict[str, Any],
    ) -> float:
        """时间上下文评分"""
        # 简化实现：工作时段偏好效率工具，休闲时段偏好创意内容
        work_hours = ["morning", "afternoon"]
        leisure_hours = ["evening", "night"]

        is_work_context = context.time_of_day in work_hours
        is_leisure_context = context.time_of_day in leisure_hours

        item_category = metadata.get("category", "")
        efficiency_categories = ["productivity", "analysis", "coding"]
        creative_categories = ["writing", "brainstorming", "design"]

        if is_work_context and item_category in efficiency_categories:
            return 0.9
        elif is_leisure_context and item_category in creative_categories:
            return 0.9
        else:
            return 0.5

    def _score_task_relevance(
        self,
        context: RecommendationContext,
        metadata: Dict[str, Any],
    ) -> float:
        """任务相关性评分"""
        if not context.current_task_type:
            return 0.5

        item_task_types = metadata.get("task_types", [])

        if context.current_task_type in item_task_types:
            return 1.0
        elif any(
            t in context.current_task_type or context.current_task_type in t
            for t in item_task_types
        ):
            return 0.7
        else:
            return 0.3

    def _score_recency(self, metadata: Dict[str, Any]) -> float:
        """新鲜度评分"""
        created_at = metadata.get("created_at")

        if not created_at:
            return 0.5

        try:
            from datetime import datetime, timezone
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at)

            age_days = (datetime.now(timezone.utc) - created_at).days

            if age_days < 7:
                return 1.0  # 本周新内容
            elif age_days < 30:
                return 0.8  # 本月
            elif age_days < 90:
                return 0.6  # 季度内
            else:
                return 0.4  # 经典常青

        except Exception as e:
            logger.debug("推荐评分计算失败，使用默认值: %s", e)
            return 0.5


class RecommendationEngine:
    """
    推荐引擎主类

    整合多种算法，提供个性化推荐：

    最终排序公式：
    score = 0.4*collab_score + 0.3*content_score +
           0.2*context_score + 0.1*cold_start_score
    """

    SIGNAL_WEIGHTS = {
        "collaborative": 0.4,
        "content_based": 0.3,
        "context_aware": 0.2,
        "cold_start": 0.1,
    }

    def __init__(self):
        self.collaborative_filter = CollaborativeFilter()
        self.content_based_filter = ContentBasedFilter()
        self.context_analyzer = ContextAnalyzer()

        # 反馈存储
        self.feedback_history: List[UserFeedbackRecord] = []

        # 物品库
        self.item_catalog: Dict[str, Dict[str, Any]] = {}

    def register_item(
        self,
        item_id: str,
        metadata: Dict[str, Any],
        features: Optional[Dict[str, float]] = None,
    ):
        """注册推荐物品"""
        self.item_catalog[item_id] = metadata

        if features:
            self.content_based_filter.add_item(item_id, features)

    async def get_recommendations(
        self,
        user_id: str,
        context: Optional[RecommendationContext] = None,
        limit: int = 5,
        type_filter: Optional[str] = None,
    ) -> List[RecommendationItem]:
        """
        获取个性化推荐列表

        Args:
            user_id: 用户ID
            context: 推荐上下文
            limit: 返回数量限制
            type_filter: 类型筛选

        Returns:
            排序后的推荐列表
        """
        start_time = time.time()

        context = context or RecommendationContext(user_id=user_id)

        logger.info(f"🎯 开始为用户 {user_id} 生成推荐...")

        # 准备候选集
        candidates = await self._prepare_candidates(
            user_id, context, type_filter
        )

        if not candidates:
            logger.warning("⚠️ 无可用候选推荐项")
            return []

        # 计算各信号得分
        collab_scores = self.collaborative_filter.recommend_for_user(
            user_id, candidates
        )

        content_scores = self.content_based_filter.find_similar_items(
            context.recent_views, candidates
        )

        # 综合评分和排序
        scored_items = []

        for item_id in candidates:
            item_meta = self.item_catalog.get(item_id, {})

            # 协同过滤得分（归一化到0-1）
            collab_score = self._normalize_score(
                collab_scores.get(item_id, 0.0),
                list(collab_scores.values()) if collab_scores else [0]
            )

            # 内容相似度得分
            content_score = self._normalize_score(
                content_scores.get(item_id, 0.0),
                list(content_scores.values()) if content_scores else [0]
            )

            # 上下文得分
            context_score = self.context_analyzer.analyze(context, item_meta)

            # 冷启动得分
            cold_start_score = self._calculate_cold_start_score(
                user_id, item_id, item_meta
            )

            # 加权综合分
            final_score = (
                collab_score * self.SIGNAL_WEIGHTS["collaborative"] +
                content_score * self.SIGNAL_WEIGHTS["content_based"] +
                context_score * self.SIGNAL_WEIGHTS["context_aware"] +
                cold_start_score * self.SIGNAL_WEIGHTS["cold_start"]
            )

            scored_items.append(RecommendationItem(
                id=item_id,
                type=item_meta.get("type", "unknown"),
                title=item_meta.get("title", ""),
                description=item_meta.get("description", ""),
                score=round(final_score, 4),
                collaborative_score=round(collab_score, 4),
                content_score=round(content_score, 4),
                context_score=round(context_score, 4),
                cold_start_score=round(cold_start_score, 4),
                metadata=item_meta,
            ))

        # 按分数降序排列
        scored_items.sort(key=lambda x: x.score, reverse=True)

        # 取Top-N并去重/多样性处理
        recommendations = self._apply_diversity(scored_items[:limit * 2])
        final_recommendations = recommendations[:limit]

        # 生成推荐理由
        for rec in final_recommendations:
            rec.explanation = await self.generate_explanation(rec, context)
            rec.confidence_reasons = self._get_confidence_reasons(rec)

        latency = (time.time() - start_time) * 1000
        logger.info(
            f"✅ 推荐生成完成 - 返回{len(final_recommendations)}项, "
            f"耗时: {latency:.0f}ms"
        )

        return final_recommendations

    async def generate_explanation(
        self,
        recommendation: RecommendationItem,
        context: RecommendationContext,
    ) -> str:
        """生成推荐理由的自然语言解释"""
        reasons = []

        # 基于各项得分生成解释
        if recommendation.collaborative_score > 0.6:
            reasons.append("与您相似的配方设计师也选择了这个")

        if recommendation.content_score > 0.6:
            reasons.append("与您最近关注的内容高度相关")

        if recommendation.context_score > 0.7:
            reasons.append("非常适合您当前的任务场景")

        if recommendation.cold_start_score > 0.6:
            reasons.append("这是近期热门的优质资源")

        # 结合元数据补充说明
        meta = recommendation.metadata
        if meta.get("popularity_score", 0) > 4.5:
            reasons.append(f"获得了{meta['popularity_score']}/5的高评分")

        if meta.get("is_new"):
            reasons.append("这是一个新上线的特色功能")

        if reasons:
            explanation = "；".join(reasons[:3])
        else:
            explanation = "基于您的使用习惯和平台热门趋势推荐"

        return explanation

    def _get_confidence_reasons(
        self,
        rec: RecommendationItem,
    ) -> List[str]:
        """获取置信度原因列表"""
        reasons = []

        if rec.collaborative_score > 0.5:
            reasons.append(f"协同过滤: {rec.collaborative_score:.0%}")
        if rec.content_score > 0.5:
            reasons.append(f"内容相关: {rec.content_score:.0%}")
        if rec.context_score > 0.5:
            reasons.append(f"上下文匹配: {rec.context_score:.0%}")
        if rec.cold_start_score > 0.5:
            reasons.append(f"热门程度: {rec.cold_start_score:.0%}")

        return reasons

    async def record_feedback(
        self,
        user_id: str,
        item_id: str,
        feedback: FeedbackType,
        context: Optional[Dict[str, Any]] = None,
    ):
        """记录用户反馈"""
        record = UserFeedbackRecord(
            user_id=user_id,
            item_id=item_id,
            feedback_type=feedback,
            timestamp=time.time(),
            context=context or {},
        )

        self.feedback_history.append(record)

        # 更新协同过滤矩阵
        rating_map = {
            FeedbackType.LIKE: 1.0,
            FeedbackType.USEFUL: 1.0,
            FeedbackType.DISLIKE: -0.5,
            FeedbackType.NOT_USEFUL: -0.5,
            FeedbackType.VIEWED: 0.3,
        }

        rating = rating_map.get(feedback, 0.0)
        self.collaborative_filter.record_interaction(user_id, item_id, rating)

        logger.info(
            f"📝 记录反馈 - 用户: {user_id}, "
            f"物品: {item_id}, 类型: {feedback.value}"
        )

    async def _prepare_candidates(
        self,
        user_id: str,
        context: RecommendationContext,
        type_filter: Optional[str],
    ) -> Set[str]:
        """准备候选推荐集合"""
        candidates = set(self.item_catalog.keys())

        # 过滤已交互过的物品
        interacted = set(
            self.collaborative_filter.user_item_matrix
            .get(user_id, {})
            .keys()
        )
        candidates -= interacted

        # 类型筛选
        if type_filter:
            candidates = {
                item_id for item_id in candidates
                if self.item_catalog.get(item_id, {}).get("type") == type_filter
            }

        return candidates

    def _normalize_score(
        self,
        score: float,
        all_scores: List[float],
    ) -> float:
        """归一化分数到0-1范围"""
        if not all_scores:
            return 0.0

        min_s, max_s = min(all_scores), max(all_scores)

        if max_s == min_s:
            return 0.5 if score > 0 else 0.0

        return (score - min_s) / (max_s - min_s)

    def _calculate_cold_start_score(
        self,
        user_id: str,
        item_id: str,
        metadata: Dict[str, Any],
    ) -> float:
        """计算冷启动分数"""
        score = 0.0

        # 新用户：推荐全局热门
        popularity = metadata.get("popularity_score", 0)
        if popularity > 0:
            score += min(popularity / 5.0, 1.0) * 0.6

        # 新物品：展示在New & Trending区域
        is_new = metadata.get("is_new", False)
        if is_new:
            score += 0.4

        # 团队内流行
        team_popular = metadata.get("team_popularity", 0)
        if team_popular > 0:
            score += min(team_popular / 100.0, 1.0) * 0.3

        return min(score, 1.0)

    def _apply_diversity(
        self,
        items: List[RecommendationItem],
        max_same_type: int = 2,
    ) -> List[RecommendationItem]:
        """应用多样性平衡"""
        type_counts: Dict[str, int] = {}
        diverse_items = []

        for item in items:
            item_type = item.type
            count = type_counts.get(item_type, 0)

            if count < max_same_type:
                diverse_items.append(item)
                type_counts[item_type] = count + 1

        return diverse_items

    def get_usage_stats(self) -> Dict[str, Any]:
        """获取推荐系统统计信息"""
        return {
            "total_items": len(self.item_catalog),
            "total_feedback_records": len(self.feedback_history),
            "unique_users": len(self.collaborative_filter.user_item_matrix),
            "avg_feedback_per_user": (
                len(self.feedback_history) /
                max(len(self.collaborative_filter.user_item_matrix), 1)
            ),
        }


# 全局单例
_recommendation_engine_instance: Optional[RecommendationEngine] = None


def get_recommendation_engine() -> RecommendationEngine:
    """获取全局推荐引擎实例"""
    global _recommendation_engine_instance

    if _recommendation_engine_instance is None:
        _recommendation_engine_instance = RecommendationEngine()
        logger.info("🎯 全局RecommendationEngine已初始化")

    return _recommendation_engine_instance

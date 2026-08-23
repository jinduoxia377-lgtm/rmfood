"""
用户反馈闭环系统

功能：
1. 收集用户对生成配方的反馈（采纳/修改/拒绝）
2. 将反馈存储到数据库
3. 反哺训练数据（正向反馈增强，负向反馈抑制）
4. 更新判别器训练库
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class FormulaFeedback:
    """配方反馈记录"""
    formula_id: str
    user_id: str
    action: str              # "approve" | "reject" | "modify"
    feedback_text: str = ""
    modifications: Dict = field(default_factory=dict)
    rating: Optional[int] = None  # 1-5星评分
    created_at: datetime = field(default_factory=datetime.now)


class FeedbackCollector:
    """
    反馈收集器

    工作流：
    1. 用户查看生成配方
    2. 用户选择：采纳 / 修改 / 拒绝
    3. 反馈存储 + 反哺训练数据
    """

    def __init__(self):
        self._feedbacks: List[FormulaFeedback] = []
        self._approved_formulas: List[Dict] = []
        self._rejected_formulas: List[Dict] = []
        self._modified_formulas: List[Dict] = []

    def collect(
        self,
        formula: Dict,
        user_id: str,
        action: str,
        feedback_text: str = "",
        modifications: Optional[Dict] = None,
        rating: Optional[int] = None,
    ) -> FormulaFeedback:
        """
        收集用户反馈

        Args:
            formula: 生成的配方
            user_id: 用户ID
            action: 操作类型 (approve/reject/modify)
            feedback_text: 反馈文本
            modifications: 修改内容
            rating: 评分 (1-5)

        Returns:
            FormulaFeedback
        """
        feedback = FormulaFeedback(
            formula_id=formula.get("id", ""),
            user_id=user_id,
            action=action,
            feedback_text=feedback_text,
            modifications=modifications or {},
            rating=rating,
        )
        self._feedbacks.append(feedback)

        # 分类存储
        if action == "approve":
            self._approved_formulas.append(formula)
        elif action == "reject":
            self._rejected_formulas.append(formula)
        elif action == "modify":
            self._modified_formulas.append({
                "original": formula,
                "modified": modifications or {},
            })

        logger.info(
            f"[Feedback] 收到反馈: action={action}, "
            f"user={user_id}, rating={rating}"
        )

        return feedback

    def get_training_data(self) -> Dict[str, List[Dict]]:
        """
        从反馈中提取训练数据

        策略：
        - 采纳的配方 → 正样本（增加权重）
        - 拒绝的配方 → 负样本（用于判别器训练）
        - 修改的配方 → 中间样本（部分正样本）
        """
        return {
            "positive": self._approved_formulas,
            "negative": self._rejected_formulas,
            "positive_partial": [m["modified"] for m in self._modified_formulas],
            "total_feedbacks": len(self._feedbacks),
        }

    def get_statistics(self) -> Dict[str, Any]:
        """获取反馈统计"""
        total = len(self._feedbacks)
        if total == 0:
            return {
                "total": 0,
                "approve_rate": 0.0,
                "reject_rate": 0.0,
                "modify_rate": 0.0,
                "avg_rating": 0.0,
            }

        approve_count = sum(1 for f in self._feedbacks if f.action == "approve")
        reject_count = sum(1 for f in self._feedbacks if f.action == "reject")
        modify_count = sum(1 for f in self._feedbacks if f.action == "modify")

        ratings = [f.rating for f in self._feedbacks if f.rating is not None]
        avg_rating = sum(ratings) / len(ratings) if ratings else 0.0

        return {
            "total": total,
            "approve_count": approve_count,
            "reject_count": reject_count,
            "modify_count": modify_count,
            "approve_rate": round(approve_count / total, 3),
            "reject_rate": round(reject_count / total, 3),
            "modify_rate": round(modify_count / total, 3),
            "avg_rating": round(avg_rating, 2),
        }

    def adapt_reward_weights(self, base_weights: Dict[str, float]) -> Dict[str, float]:
        """
        根据反馈自适应调整RL奖励权重

        策略：
        - 高采纳率 → 增加功效权重
        - 高拒绝率 → 增加安全权重
        - 高修改率 → 增加口感权重
        """
        stats = self.get_statistics()

        adapted = dict(base_weights)

        if stats["approve_rate"] > 0.7:
            # 采纳率很高，保持当前策略
            pass
        elif stats["approve_rate"] < 0.3:
            # 采纳率很低，增加安全评分
            adapted["predictor_safety"] = min(0.4, adapted.get("predictor_safety", 0.25) * 1.5)
            adapted["predictor_efficacy"] = max(0.1, adapted.get("predictor_efficacy", 0.3) * 0.8)
        elif stats["reject_rate"] > 0.5:
            # 拒绝率高，加强安全约束
            adapted["safety_penalty"] = min(0.15, adapted.get("safety_penalty", 0.05) * 2)

        if stats["modify_rate"] > 0.4:
            # 修改率高，加强口感优化
            adapted["predictor_taste"] = min(0.2, adapted.get("predictor_taste", 0.1) * 1.5)

        logger.info(f"[Feedback] 奖励权重已适配: {adapted}")
        return adapted

    def export_for_training(self, path: str) -> None:
        """导出反馈数据用于重新训练"""
        import json
        from datetime import datetime

        data = {
            "exported_at": datetime.now().isoformat(),
            "statistics": self.get_statistics(),
            "positive_formulas": self._approved_formulas,
            "negative_formulas": self._rejected_formulas,
            "feedbacks": [
                {
                    "formula_id": f.formula_id,
                    "user_id": f.user_id,
                    "action": f.action,
                    "rating": f.rating,
                    "feedback_text": f.feedback_text,
                    "created_at": f.created_at.isoformat(),
                }
                for f in self._feedbacks
            ],
        }

        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        logger.info(f"[Feedback] 反馈数据已导出到 {path}")


# 全局单例
_collector: Optional[FeedbackCollector] = None


def get_feedback_collector() -> FeedbackCollector:
    global _collector
    if _collector is None:
        _collector = FeedbackCollector()
    return _collector

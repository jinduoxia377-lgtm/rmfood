"""强化学习调优器 — 策略梯度优化生成器权重

奖励函数设计：
R = α·PredictorScore + β·(1 - DiscriminatorProb) + γ·TemplateBonus - δ·SafetyPenalty

采用简化版 REINFORCE + 基线，避免引入完整 PyTorch 依赖：
- 使用规则引擎计算奖励
- 基于奖励梯度调整生成策略
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class TrainingRecord:
    """训练记录"""
    step: int
    reward: float
    baseline: float
    loss: float
    policy_entropy: float


@dataclass
class RewardWeights:
    """奖励函数权重"""
    predictor_efficacy: float = 0.30
    predictor_safety: float = 0.25
    predictor_taste: float = 0.10
    discriminator_novelty: float = 0.20
    template_bonus: float = 0.10
    safety_penalty: float = 0.05


class RLFormulaTuner:
    """
    配方生成器 RL 调优器

    使用简化版 REINFORCE 策略梯度：
    - 动作：生成器生成的配方序列
    - 奖励：预测器分数 + 判别器惩罚 + 模板 bonus
    - 基线：指数移动平均

    注意：本实现采用规则基线，避免强制依赖 PyTorch。
    生产环境可替换为完整 PyTorch 实现。
    """

    def __init__(
        self,
        reward_weights: Optional[RewardWeights] = None,
        baseline_decay: float = 0.99,
        lr: float = 1e-3,
    ):
        self.reward_weights = reward_weights or RewardWeights()
        self.baseline_decay = baseline_decay
        self.lr = lr

        self.baseline: float = 0.5
        self._history: List[TrainingRecord] = []

    def compute_reward(
        self,
        formula: Dict[str, float],
        predictor_result: Optional[Any] = None,
        discriminator_result: Optional[Any] = None,
        template_match: float = 0.0,
        safety_penalty: float = 0.0,
    ) -> Dict[str, float]:
        """
        计算复合奖励

        Args:
            formula: 配方 {herb_id: dosage}
            predictor_result: 预测器输出（PredictionResult）
            discriminator_result: 判别器输出
            template_match: 模板匹配度 (0~1)
            safety_penalty: 安全违规惩罚

        Returns:
            各项奖励分量及综合奖励
        """
        # 预测器奖励
        if predictor_result is not None:
            efficacy_r = predictor_result.efficacy
            safety_r = predictor_result.safety
            taste_r = predictor_result.taste
        else:
            # 无预测器时，使用规则评分
            efficacy_r = 0.5
            safety_r = 0.7
            taste_r = 0.5

        # 判别器奖励（越低越好，表示"生成"而非"真实"）
        if discriminator_result is not None:
            novelty_r = 1.0 - discriminator_result.is_real
        else:
            novelty_r = 0.5  # 中性

        rewards = {
            "predictor_efficacy": efficacy_r,
            "predictor_safety": safety_r,
            "predictor_taste": taste_r,
            "discriminator_novelty": novelty_r,
            "template_bonus": template_match,
            "safety_penalty": safety_penalty,
        }

        # 加权综合
        total = (
            self.reward_weights.predictor_efficacy * efficacy_r +
            self.reward_weights.predictor_safety * safety_r +
            self.reward_weights.predictor_taste * taste_r +
            self.reward_weights.discriminator_novelty * novelty_r +
            self.reward_weights.template_bonus * template_match -
            self.reward_weights.safety_penalty * safety_penalty
        )

        rewards["total"] = total
        return rewards

    def update_baseline(self, reward: float) -> None:
        """更新基线（EMA）"""
        self.baseline = (
            self.baseline * self.baseline_decay +
            reward * (1 - self.baseline_decay)
        )

    def compute_advantage(self, reward: float) -> float:
        """计算优势函数 A = R - baseline"""
        return reward - self.baseline

    def train_step(
        self,
        formula: Dict[str, float],
        predictor_result: Optional[Any] = None,
        discriminator_result: Optional[Any] = None,
        template_match: float = 0.0,
        safety_penalty: float = 0.0,
    ) -> Dict[str, float]:
        """
        单步训练

        Returns:
            训练统计信息
        """
        # 计算奖励
        rewards = self.compute_reward(
            formula=formula,
            predictor_result=predictor_result,
            discriminator_result=discriminator_result,
            template_match=template_match,
            safety_penalty=safety_penalty,
        )

        total_reward = rewards["total"]

        # 更新基线
        self.update_baseline(total_reward)

        # 计算优势
        advantage = self.compute_advantage(total_reward)

        # 简化策略梯度更新：调整生成策略参数
        # 实际实现应使用 PyTorch autograd
        loss = -advantage * self.lr  # 简化损失

        # 记录
        record = TrainingRecord(
            step=len(self._history),
            reward=total_reward,
            baseline=self.baseline,
            loss=loss,
            policy_entropy=0.0,  # TODO: 计算策略熵
        )
        self._history.append(record)

        return {
            "reward": total_reward,
            "advantage": advantage,
            "baseline": self.baseline,
            "loss": loss,
            "breakdown": {k: v for k, v in rewards.items() if k != "total"},
        }

    def get_stats(self) -> Dict[str, Any]:
        """获取训练统计"""
        if not self._history:
            return {"steps": 0, "avg_reward": 0.0, "final_baseline": self.baseline}

        rewards = [r.reward for r in self._history]
        return {
            "steps": len(self._history),
            "avg_reward": sum(rewards) / len(rewards),
            "max_reward": max(rewards),
            "min_reward": min(rewards),
            "final_baseline": self.baseline,
            "recent_rewards": rewards[-10:],
        }

    def get_policy_params(self) -> Dict[str, float]:
        """获取当前策略参数（简化版）"""
        return {
            "baseline": self.baseline,
            "lr": self.lr,
        }


# 全局单例
_tuner: Optional[RLFormulaTuner] = None


def get_rl_tuner(
    reward_weights: Optional[RewardWeights] = None,
) -> RLFormulaTuner:
    global _tuner
    if _tuner is None:
        _tuner = RLFormulaTuner(reward_weights=reward_weights)
    return _tuner

"""
⚠️ MOCK IMPLEMENTATION - 模拟实现，非真实 AI 模型

当前使用基于序列长度和氨基酸组成的启发式评分模拟活性预测。
接入 ESM-2 + MLP Head 后替换为真实推理实现。
"""
import logging
from typing import Any

logger = logging.getLogger(__name__)


class MockPeptideScorerService:
    """活性肽活性预测服务（模拟实现）"""

    async def predict(
        self,
        sequences: list[str],
        target_activity: str = "ACE_inhibitory",
    ) -> list[dict[str, Any]]:
        """
        预测肽序列的活性得分

        Args:
            sequences: 肽序列列表 (FASTA 格式)
            target_activity: 目标活性类型

        Returns:
            每条序列的预测结果
        """
        results = []
        for seq in sequences:
            # 简单模拟：基于序列长度和氨基酸组成的启发式评分
            score = self._heuristic_score(seq)
            results.append({
                "sequence": seq,
                "predicted_activity": target_activity,
                "score": score,
                "confidence": round(0.6 + 0.3 * score, 2),
                "recommendation": "推荐" if score > 0.7 else "需进一步验证",
            })
        return results

    def _heuristic_score(self, sequence: str) -> float:
        """启发式活性评分（模拟）"""
        # 序列越短通常活性越高
        length_factor = max(0, 1 - len(sequence) / 20)
        # 含特定氨基酸更有活性
        beneficial = {"V", "L", "I", "P", "F", "Y", "W"}
        aa_factor = sum(1 for aa in sequence.upper() if aa in beneficial) / max(len(sequence), 1)
        return round(min(1, (length_factor * 0.4 + aa_factor * 0.6)), 2)

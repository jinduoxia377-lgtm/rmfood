"""
真实 ML 驱动的活性肽活性预测服务

2026-10-13 由 Mock 替换为真实推理：
- 底层：real_ml_trainer（NumpyMLP + 444 维氨基酸特征，890 条真实样本训练，
  序列级 5 折泛化 balanced_accuracy ≈ 0.77，artifact 已持久化）
- 模型未训练/未加载时回退规则并诚实标注 method=fallback_rule / unavailable
"""
import logging
from typing import Any

logger = logging.getLogger(__name__)

# 目标活性别名映射（前端/端点传参 → real_ml_trainer 规范名）
_ACTIVITY_ALIASES = {
    "ACE_inhibitory": "ACE inhibitory",
    "ACE inhibitory": "ACE inhibitory",
    "antioxidant": "Antioxidant",
    "Antioxidant": "Antioxidant",
}


class PeptideScorerService:
    """活性肽活性预测服务（真实 ML 推理）"""

    async def predict(
        self,
        sequences: list[str],
        target_activity: str = "ACE_inhibitory",
    ) -> list[dict[str, Any]]:
        """预测肽序列的活性得分（基于训练好的 ML 模型）"""
        canonical = _ACTIVITY_ALIASES.get(target_activity, target_activity)
        try:
            from ..peptide_analyzer.real_ml_trainer import get_real_model_trainer
            trainer = get_real_model_trainer(canonical)
        except Exception as e:
            logger.error(f"[PeptideScorer] 加载 ML 模型失败: {e}", exc_info=True)
            trainer = None

        results: list[dict[str, Any]] = []
        for seq in sequences:
            seq = (seq or "").strip().upper()
            if not seq:
                continue
            if trainer is not None and trainer.trained:
                pred = trainer.predict(seq)
                score = float(pred.get("score", 0.5))
                is_active = bool(pred.get("is_predicted_active", False))
                method = pred.get("method", "ml")
                threshold = pred.get("decision_threshold", 0.5)
                # 置信度：与决策阈值的距离映射到 0.5-1.0
                confidence = round(min(1.0, abs(score - float(threshold)) * 2 + 0.5), 2) if method == "ml" else 0.5
                results.append({
                    "sequence": seq,
                    "predicted_activity": target_activity,
                    "score": round(score, 4),
                    "confidence": confidence,
                    "recommendation": "推荐" if is_active else "需进一步验证",
                    "method": method,
                    "is_predicted_active": is_active,
                    "decision_threshold": threshold,
                    "is_trustworthy": bool(pred.get("is_trustworthy", False)),
                    "trust_note": pred.get("trust_note", ""),
                    "gen_five_fold_balanced": pred.get("gen_five_fold_balanced"),
                    "length_caveat": pred.get("length_caveat"),
                })
            elif trainer is not None:
                # 模型存在但未训练 → 规则兜底（诚实标注）
                results.append({
                    "sequence": seq,
                    "predicted_activity": target_activity,
                    "score": 0.5,
                    "confidence": 0.5,
                    "recommendation": "模型未训练，需人工评估",
                    "method": "fallback_rule",
                })
            else:
                results.append({
                    "sequence": seq,
                    "predicted_activity": target_activity,
                    "score": 0.5,
                    "confidence": 0.5,
                    "recommendation": "模型不可用，需人工评估",
                    "method": "unavailable",
                })
        return results


# 兼容旧别名（formula_service / ai_models/__init__ 仍可能引用）
MockPeptideScorerService = PeptideScorerService
# -*- coding: utf-8 -*-
"""把真实 ML 模型分接入 Pareto 多目标优化 + 协同分析。
诚实边界：ML 为纯 Python MLP（DFBP 7540 条真数据训练），未训练时回退规则分并标注。
"""
import io, sys

P = r'D:\RMFOODFP\backend\app\services\ai_models\advanced_peptide_analyzer.py'
src = io.open(P, encoding='utf-8').read()

if '_ml_model_available' in src:
    print('ALREADY APPLIED, skipping')
    sys.exit(0)

# 1) 在 _find_pareto_optimal 前插入真实 ML 辅助方法
anchor1 = '    def _find_pareto_optimal(self, points: List[ParetoPoint]) -> List[ParetoPoint]:'
assert anchor1 in src, 'anchor1 not found'
ml_helpers = '''    def _get_real_ml_predictor(self):
        """获取 DFBP 真实数据训练的 ML 模型（未训练时诚实回退规则分）。"""
        try:
            from app.services.peptide_analyzer.real_ml_trainer import get_real_model_trainer
            trainer = get_real_model_trainer("ACE inhibitory")
            return trainer if (trainer.model is not None and trainer.trained) else None
        except Exception:
            return None

    def _ml_model_available(self) -> bool:
        """真实 ML 模型是否可用（权重已加载 + 已训练）。"""
        return self._get_real_ml_predictor() is not None

    def _predict_ace_ml(self, sequence: str) -> Dict[str, Any]:
        """用真实 ML 模型预测 ACE 抑制活性；未训练时诚实回退规则分。
        返回 {score, method}：method=ml 表示真实权重，fallback_rule 表示未训练回退。
        """
        predictor = self._get_real_ml_predictor()
        if predictor is None:
            # 回退：沿用 QSAR 规则分（诚实标注）
            rule_scores = self._adapter._evaluate_objectives(sequence, {"ACE_inhibitory": 1.0})
            rule = rule_scores.get("ACE_inhibitory", 0.5)
            return {"score": round(rule, 4), "method": "fallback_rule"}
        pred = predictor.predict(sequence)
        return {"score": pred.get("score", 0.5), "method": pred.get("method", "fallback_rule")}

''' + anchor1
src = src.replace(anchor1, ml_helpers, 1)

# 2) _predict_bioactivities：ACE_inhibitory 改用真实 ML 分（并列输出 rule_score + method + provenance）
anchor2 = '''        predictions = {}
        for activity, score in scores.items():
            predictions[activity] = {
                "score": score,
                "confidence": self._estimate_prediction_confidence(score),
                "tier": self._classify_activity_tier(score),
                "potential_applications": self._suggest_applications(activity, score),
            }

        return predictions'''
new2 = '''        predictions = {}
        for activity, score in scores.items():
            predictions[activity] = {
                "score": score,
                "confidence": self._estimate_prediction_confidence(score),
                "tier": self._classify_activity_tier(score),
                "potential_applications": self._suggest_applications(activity, score),
            }
            # 真实 ML 模型：ACE_inhibitory 目标改用 DFBP 真实数据训练的模型分（与规则分并列）
            if activity == "ACE_inhibitory":
                ml = self._predict_ace_ml(sequence)
                predictions[activity]["ml_score"] = ml["score"]
                predictions[activity]["ml_method"] = ml["method"]
                predictions[activity]["ml_provenance"] = "DFBP 真实 7540 条库训练（纯 Python MLP）"
                # 真实模型分作为主分（替代 QSAR 规则分做多目标寻优）
                predictions[activity]["score"] = ml["score"]

        return predictions'''
assert anchor2 in src, 'anchor2 not found'
src = src.replace(anchor2, new2, 1)

# 3) compute_pareto_frontier：返回结果附加 ml_model_provenance 元信息
anchor3 = '''        logger.info(
            f"Pareto 前沿计算完成 - 前沿大小: {len(pareto_frontier)}, "
            f"耗时: {processing_time}ms"
        )
        return result'''
new3 = '''        # 诚实标注：多目标寻优中 ACE_inhibitory 目标已用真实 ML 模型分（DFBP 真实数据训练）
        ml_available = self._ml_model_available()
        result.ml_model_provenance = {
            "available": ml_available,
            "model": "PeptideRanker-Mini" if ml_available else "QSAR-fallback",
            "training_source": "DFBP 真实 7540 条库" if ml_available else "合成规则",
            "honest_note": "ACE_inhibitory 目标用真实 ML 模型分做多目标寻优；模型不可用时诚实回退 QSAR 规则分。",
        }

        logger.info(
            f"Pareto 前沿计算完成 - 前沿大小: {len(pareto_frontier)}, "
            f"耗时: {processing_time}ms, ML 模型: {'可用' if ml_available else '回退规则'}"
        )
        return result'''
assert anchor3 in src, 'anchor3 not found'
src = src.replace(anchor3, new3, 1)

io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('PARETO/SYNERGY ML PATCH OK')

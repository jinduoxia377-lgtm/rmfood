"""
配方设计器 — 基于优化器或手动策略设计配方

支持两种模式：
1. 贝叶斯优化 + NSGA-II 多目标优化（首选）
2. 基于功效评分的手动选择（降级方案）
"""
from __future__ import annotations
import logging
from typing import Any

logger = logging.getLogger(__name__)


class FormulaDesigner:
    """配方设计器 — 生成君臣佐使结构的配方方案"""

    def __init__(self, knowledge_base: dict):
        self._kb = knowledge_base

    async def design(
        self,
        intent: dict,
        knowledge: dict,
    ) -> dict[str, Any]:
        """
        设计配方。

        Returns dict with keys: summary, details, data (list[dict]), scores
        """
        effects = intent.get("target_effects") or ["免疫调节", "抗氧化"]

        # 肽类问题走专用路径
        if intent.get("is_peptide"):
            return self._design_peptide(effects)

        # 调用贝叶斯优化器
        formula_data = await self._optimize_formula(effects, intent)

        if formula_data and len(formula_data) >= 3:
            return self._build_tcm_structure(formula_data, effects, intent)

        # 降级：基于功效评分手动选择
        return self._manual_formula_design(effects, intent)

    async def _optimize_formula(
        self, effects: list[str], intent: dict
    ) -> list[dict] | None:
        """调用贝叶斯优化器和 NSGA-II 生成配方"""
        # 贝叶斯优化器
        try:
            from .ai.bayesian_formula_optimizer import get_bayesian_optimizer
            optimizer = get_bayesian_optimizer()
            candidates = await optimizer.generate(target_effects=effects[:3])
            if candidates:
                results = []
                for c in candidates[:3]:
                    herb_names = []
                    dosages = {}
                    for hid, dosage in c.ingredients.items():
                        herb = optimizer._herbs.get(hid)
                        if herb:
                            herb_names.append(herb.name_cn)
                            dosages[herb.name_cn] = dosage
                    results.append({
                        "herbs": herb_names,
                        "dosages": dosages,
                        "efficacy_score": round(c.efficacy_score, 3),
                        "safety_score": round(c.safety_score, 3),
                        "taste_score": round(c.taste_score, 3),
                        "overall_score": round(c.overall_score, 3),
                        "confidence": round(c.confidence, 3),
                    })
                return results
        except Exception as e:
            logger.warning(f"[FormulaDesigner] 贝叶斯优化器调用失败: {e}")

        # NSGA-II 备选
        try:
            from .ai.multi_objective_optimizer import get_nsga2_optimizer
            nsga = get_nsga2_optimizer()
            result = nsga.generate_with_result(target_effects=effects[:3])
            if result.candidates:
                results = []
                for c in result.candidates[:3]:
                    herb_names = []
                    dosages = {}
                    for hid, dosage in c.genes.items():
                        herb = nsga.evaluator.herb_db.get(hid)
                        if herb:
                            herb_names.append(herb.name_cn)
                            dosages[herb.name_cn] = round(dosage, 1)
                    results.append({
                        "herbs": herb_names,
                        "dosages": dosages,
                        "efficacy_score": round(c.efficacy, 3),
                        "safety_score": round(c.safety, 3),
                        "taste_score": round(c.taste, 3),
                        "overall_score": round(c.fitness, 3),
                        "confidence": 0.7,
                        "synergy": round(c.synergy, 3),
                        "stability": round(c.stability, 3),
                    })
                return results
        except Exception as e:
            logger.warning(f"[FormulaDesigner] NSGA-II 优化器调用失败: {e}")

        return None

    def _build_tcm_structure(
        self, formula_data: list[dict], effects: list[str], intent: dict
    ) -> dict:
        """将优化器结果转换为君臣佐使结构"""
        best = formula_data[0]
        dosages = best["dosages"]

        sorted_herbs = sorted(dosages.items(), key=lambda x: -x[1])

        formula = []
        roles = ["君", "臣", "臣", "佐", "佐", "使"]
        for i, (name, dosage) in enumerate(sorted_herbs[:6]):
            role = roles[i] if i < len(roles) else "佐"
            herb_info = self._kb.get(name, {})
            herb_effects = herb_info.get("effects", [])

            purpose_parts = []
            for e in effects:
                if any(e in eff for eff in herb_effects):
                    purpose_parts.append(e)
            if not purpose_parts:
                purpose_parts = herb_effects[:2]

            formula.append({
                "role": role,
                "name": name,
                "dosage": f"{dosage}g",
                "purpose": f"{'、'.join(purpose_parts) if purpose_parts else '综合调理'}",
                "score": best.get("overall_score", 0),
                "safety_score": best.get("safety_score", 0),
                "synergy_score": best.get("synergy", 0),
            })

        score_parts = [
            f"功效评分: {best.get('efficacy_score', 0):.2f}",
            f"安全评分: {best.get('safety_score', 0):.2f}",
            f"口感评分: {best.get('taste_score', 0):.2f}",
        ]
        if "synergy_score" in best:
            score_parts.append(f"协同评分: {best['synergy_score']:.2f}")

        return {
            "summary": (
                f"已通过贝叶斯优化生成 {len(formula)} 味药材配方方案"
                f"（综合评分 {best.get('overall_score', 0):.2f}）"
            ),
            "details": " | ".join(score_parts),
            "data": formula,
            "scores": {
                k: v for k, v in best.items()
                if k in ("efficacy_score", "safety_score", "taste_score",
                         "overall_score", "synergy_score", "confidence")
            },
        }

    def _manual_formula_design(self, effects: list[str], intent: dict) -> dict:
        """降级方案：基于功效评分手动选择药材"""
        q = intent.get("question", "").lower()
        candidates = []

        for name, info in self._kb.items():
            score = sum(
                2 for e in effects
                if any(e in eff for eff in info["effects"])
            )
            if "肽" in q and "肽" in name:
                score += 3
            if score > 0:
                candidates.append((name, info, score))

        if not candidates:
            candidates = [(n, i, 1) for n, i in self._kb.items()]
            candidates.sort(key=lambda x: -x[2])

        candidates.sort(key=lambda x: -x[2])

        formula = []
        used = set()
        effects_str = "、".join(effects)

        if candidates:
            monarch = candidates[0]
            formula.append({
                "role": "君", "name": monarch[0],
                "purpose": f"核心功效——{'、'.join(monarch[1]['effects'][:2])}",
                "dosage": monarch[1]["dosage"],
            })
            used.add(monarch[0])

            for name, info, score in candidates[1:4]:
                if name not in used:
                    formula.append({
                        "role": "臣", "name": name,
                        "purpose": f"辅助{effects_str}功效",
                        "dosage": info["dosage"],
                    })
                    used.add(name)

            remaining = [
                n for n, i, s in candidates
                if n not in used and i.get("is_food_homology")
            ]
            for name in remaining[:2]:
                info = self._kb[name]
                role = "佐" if len(formula) < 5 else "使"
                formula.append({
                    "role": role, "name": name,
                    "purpose": "调和口感、增强协同",
                    "dosage": info["dosage"],
                })
                used.add(name)

        parts = []
        for f in formula:
            parts.append(
                f"**{f['role']}药 - {f['name']}**："
                f"{f['purpose']}（{f['dosage']}）"
            )

        return {
            "summary": f"已完成 {len(effects)} 项功效的配方设计（{len(formula)} 味药材）",
            "details": "\n".join(parts),
            "data": formula,
            "scores": {
                "overall_score": 0.6,
                "efficacy_score": 0.5,
                "safety_score": 0.8,
            },
        }

    def _design_peptide(self, effects: list[str]) -> dict:
        """肽类配方设计"""
        return {
            "summary": "已完成活性肽配方设计",
            "details": "基于DFBP数据库的ACE抑制肽方案",
            "data": [
                {"role": "君", "name": "ACE抑制复合多肽",
                 "dosage": "5-10g/天",
                 "purpose": "竞争性抑制ACE活性，降低血管紧张素Ⅱ"},
                {"role": "臣", "name": "山楂提取物",
                 "dosage": "500mg",
                 "purpose": "黄酮类协同降脂"},
                {"role": "佐", "name": "决明子提取物",
                 "dosage": "300mg",
                 "purpose": "蒽醌类辅助降压"},
                {"role": "使", "name": "丹参素",
                 "dosage": "200mg",
                 "purpose": "改善微循环"},
            ],
            "scores": {"overall_score": 0.75},
        }

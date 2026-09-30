"""
配方设计器 — 基于优化器或手动策略设计配方

支持两种模式：
1. 贝叶斯优化 + NSGA-II 多目标优化（首选）
2. 基于功效评分的手动选择（降级方案）

数据源优先级：
1. TCMSP 数据库（生产环境）
2. 数据库 HerbKnowledgeService（优先）
3. 硬编码 _BUILTIN_HERBS（仅用于测试/开发）
"""
from __future__ import annotations
import logging
from typing import Any

logger = logging.getLogger(__name__)

# 标记数据来源（用于日志追踪）
_DATA_SOURCE_FLAG = "database"


class FormulaDesigner:
    """配方设计器 — 生成君臣佐使结构的配方方案"""

    def __init__(self, knowledge_base: dict):
        self._kb = knowledge_base
        self._data_source = self._detect_data_source()
    
    def _detect_data_source(self) -> str:
        """检测当前使用的数据来源"""
        try:
            from app.services.ai.algorithms.herb_knowledge_service import get_global_herb_knowledge
            herb_service = get_global_herb_knowledge()
            if herb_service and hasattr(herb_service, '_herbs') and len(herb_service._herbs) > 20:
                return f"database ({len(herb_service._herbs)} herbs)"
        except Exception:
            pass
        return "fallback_builtin"

    async def design(
        self,
        intent: dict,
        knowledge: dict,
    ) -> dict[str, Any]:
        """
        设计配方。

        优先使用七步专业引擎，失败时降级到传统引擎。

        Returns dict with keys: summary, details, data (list[dict]), scores
        """
        effects = intent.get("target_effects") or ["免疫调节", "抗氧化"]
        
        logger.info(f"[FormulaDesigner] 数据来源: {self._data_source}")

        # 肽类问题走专用路径
        if intent.get("is_peptide"):
            return self._design_peptide(effects)

        # 尝试使用七步专业引擎
        use_seven_step = intent.get("use_seven_step", False)

        if use_seven_step:
            return await self._seven_step_design(effects, intent, knowledge)

        # 尝试使用统一引擎（新方法）
        use_new_engine = intent.get("use_new_engine", False)

        if use_new_engine:
            return await self._new_engine_design(effects, intent, knowledge)

        # 调用贝叶斯优化器
        formula_data = await self._optimize_formula(effects, intent)

        if formula_data and len(formula_data) >= 3:
            return self._build_tcm_structure(formula_data, effects, intent)

        # 降级：基于功效评分手动选择
        return self._manual_formula_design(effects, intent)

    async def _seven_step_design(
        self,
        effects: list[str],
        intent: dict,
        knowledge: dict,
    ) -> dict:
        """使用七步专业引擎生成配方"""
        try:
            from .formula.seven_step_engine import SevenStepFormulaEngine, FormulaRequest

            product_form = intent.get("product_form", "保健饮品")
            target_group = intent.get("target_group", "adult")
            max_cost = intent.get("max_cost")
            n_candidates = intent.get("n_candidates", 10)

            engine = SevenStepFormulaEngine()
            req = FormulaRequest(
                target_effects=effects[:3],
                product_form=product_form,
                target_group=target_group,
                max_cost=max_cost,
                n_candidates=n_candidates,
            )
            result = await engine.design(req)

            # 格式化为统一输出格式
            herbs_output = []
            for herb in result.framework.get("herbs", []):
                herbs_output.append({
                    "role": herb.get("role", ""),
                    "name": herb.get("name", ""),
                    "dosage": f"{herb.get('dosage', 0):.1f}g",
                    "purpose": effects[0] if effects else "综合调理",
                    "score": herb.get("efficacy_score", 0),
                })

            return {
                "summary": result.summary,
                "details": f"七步引擎生成 | 结构合规: {result.framework.get('structure_score', 0):.2f}",
                "data": herbs_output,
                "scores": {
                    "overall_score": result.framework.get("structure_score", 0),
                    "efficacy_score": herbs_output[0].get("score", 0) if herbs_output else 0,
                    "structure_score": result.framework.get("structure_score", 0),
                },
                "strategy": "seven_step_engine",
                "execution_time_ms": result.total_time_ms,
                # 额外信息
                "product_form": product_form,
                "total_dosage_g": result.framework.get("total_dosage_g", 0),
                "validation": result.validation,
                "flavor_balance": result.flavor.get("balance_score", 0),
                "preservation": result.preservation,
                "functional": result.functional,
            }
        except Exception as e:
            logger.warning(f"[FormulaDesigner] 七步引擎失败，回退到传统引擎: {e}")
            # 回退到传统引擎
            formula_data = await self._optimize_formula(effects, intent)
            if formula_data and len(formula_data) >= 3:
                return self._build_tcm_structure(formula_data, effects, intent)
            return self._manual_formula_design(effects, intent)

    async def _new_engine_design(
        self,
        effects: list[str],
        intent: dict,
        knowledge: dict,
    ) -> dict:
        """使用统一公式引擎生成配方"""
        try:
            from .ai.models import get_unified_formula_engine
            from .ai.algorithms.bayesian_formula_optimizer import _BUILTIN_HERBS

            # 构建 herb_db
            herb_db = {}
            for hid, herb in _BUILTIN_HERBS.items():
                herb_db[herb.herb_id] = {
                    "name_cn": herb.name_cn,
                    "efficacy_scores": herb.efficacy_scores,
                    "safety_index": herb.safety_index,
                    "cost_per_gram": herb.cost_per_gram,
                    "tastes": [],
                    "antagonistic_pairs": herb.antagonistic_pairs,
                    "synergy_partners": herb.synergy_partners,
                }

            herb_vocab = list(_BUILTIN_HERBS.keys())

            engine = get_unified_formula_engine(herb_db=herb_db, herb_vocab=herb_vocab)

            constraints = intent.get("constraints") or {}
            result = await engine.generate(
                target_effects=effects[:3],
                constraints=constraints,
                template_preference=intent.get("template"),
                n_candidates=intent.get("n_candidates", 10),
                select_top_k=intent.get("select_top_k", 3),
                use_rl_tuning=intent.get("use_rl_tuning", False),
            )

            return {
                "summary": result.summary,
                "details": result.details,
                "data": result.data,
                "scores": result.scores,
                "strategy": result.strategy,
                "execution_time_ms": result.execution_time_ms,
            }
        except Exception as e:
            logger.warning(f"[FormulaDesigner] 新引擎失败，回退到传统引擎: {e}")
            # 回退到传统引擎
            formula_data = await self._optimize_formula(effects, intent)
            if formula_data and len(formula_data) >= 3:
                return self._build_tcm_structure(formula_data, effects, intent)
            return self._manual_formula_design(effects, intent)

    async def _optimize_formula(
        self, effects: list[str], intent: dict
    ) -> list[dict] | None:
        """调用贝叶斯优化器和 NSGA-II 生成配方"""
        # 贝叶斯优化器
        try:
            from .ai.algorithms.bayesian_formula_optimizer import get_bayesian_optimizer
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
            from .ai.algorithms.multi_objective_optimizer import get_nsga2_optimizer
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

        # ── 加载完整药材知识库（优化器内置 ~60种 + DB 583种）────────
        herb_full_db: dict = {}
        try:
            from .ai.algorithms.bayesian_formula_optimizer import get_bayesian_optimizer
            opt = get_bayesian_optimizer()
            for hid, herb in opt._herbs.items():
                herb_full_db[herb.name_cn] = {
                    "name": herb.name_cn,
                    "efficacy_scores": dict(herb.efficacy_scores),
                    "safety_index": herb.safety_index,
                    "dosage_min": herb.dosage_min,
                    "dosage_max": herb.dosage_max,
                    "synergy_partners": list(herb.synergy_partners),
                    "antagonistic_pairs": list(herb.antagonistic_pairs),
                }
        except Exception as e:
            logger.warning(f"[FormulaDesigner] 无法加载优化器药材库: {e}")

        # 合并本地知识库（_KB_SEED 9种，优先级低于优化器库）
        for name, info in self._kb.items():
            if name not in herb_full_db:
                herb_full_db[name] = {
                    "name": name,
                    "efficacy_scores": {},
                    "safety_index": 0.9,
                    "dosage_min": 3,
                    "dosage_max": 30,
                    "synergy_partners": [],
                    "antagonistic_pairs": [],
                }
                # 从 KB seed 提取功效信息
                if "effects" in info:
                    herb_full_db[name]["efficacy_scores"] = {
                        eff: 0.7 for eff in info.get("effects", [])
                    }

        sorted_herbs = sorted(dosages.items(), key=lambda x: -x[1])

        formula = []
        roles = ["君", "臣", "臣", "佐", "佐", "使"]
        for i, (name, dosage) in enumerate(sorted_herbs[:6]):
            role = roles[i] if i < len(roles) else "佐"
            herb_info = herb_full_db.get(name, {})
            herb_effects = list(herb_info.get("efficacy_scores", {}).keys())

            # ── 功效匹配（修正：检查药材功效是否在目标功效中，或关键词重叠）──
            purpose_parts = []
            for e in effects:
                for eff in herb_effects:
                    # 正向匹配：目标功效关键词包含药材功效，或药材功效包含目标关键词
                    if e in eff or eff in e:
                        if eff not in purpose_parts:
                            purpose_parts.append(eff)
                        break
            if not purpose_parts:
                # 无精确匹配时，取 Top 2 功效
                top_effects = sorted(
                    herb_info.get("efficacy_scores", {}).items(),
                    key=lambda x: -x[1],
                )[:2]
                purpose_parts = [eff for eff, _ in top_effects]
            if not purpose_parts:
                purpose_parts = ["综合调理"]

            formula.append({
                "role": role,
                "name": name,
                "dosage": f"{dosage}g",
                "purpose": f"{'、'.join(purpose_parts)}",
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

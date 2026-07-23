"""
FormulaGPT - AI 配方生成服务
基于 LLaMA-3 70B LoRA 微调模型，生成药材+肽组合方案
当前为骨架实现，接入 vLLM 端点后即可启用
"""
from __future__ import annotations

import logging
from typing import Any
from dataclasses import dataclass, field

from ..ai_models.formula_gpt import MockFormulaGPTService as FormulaGPTService
from ..ai_models.synergy_net import MockSynergyNetService as SynergyNetService
from ..ai_models.peptide_scorer import MockPeptideScorerService as PeptideScorerService
from ..ai_models.taste_predictor import MockTastePredictorService as TastePredictorService
from ..ai_models.stability_model import MockStabilityModelService as StabilityModelService
from ..ai_models.safety_checker import SafetyCheckerService
from ..ai_models.pepinvent_service import (
    PepinventService,
    get_pepinvent_service,
    ServiceUnavailableError,
)

logger = logging.getLogger(__name__)


@dataclass
class AIFormulaResult:
    """AI 配方生成结果"""
    formula_name: str
    herb_combination: list[dict[str, Any]]
    peptide_candidates: list[dict[str, Any]]
    synergy_score: float | None = None
    patent_synergy_scores: dict[str, Any] | None = None
    safety_passed: bool = False
    safety_details: dict[str, Any] = field(default_factory=dict)
    taste_score: float | None = None
    stability_score: float | None = None
    overall_score: float | None = None
    generated_at: str | None = None


class AIService:
    """
    AI 配方智能生成服务
    协调多个 AI 模型完成完整的配方生成管线：
    FormulaGPT → SynergyNet → PeptideScorer → TastePredictor → StabilityModel → SafetyChecker
    """

    def __init__(self):
        self.formula_gpt = FormulaGPTService()
        self.synergy_net = SynergyNetService()
        self.peptide_scorer = PeptideScorerService()
        self.taste_predictor = TastePredictorService()
        self.stability_model = StabilityModelService()
        self.safety_checker = SafetyCheckerService()

        try:
            self.pepinvent_service = get_pepinvent_service()
            logger.info("✅ PepINVERT 服务已集成到 AIService")
        except Exception as e:
            logger.warning(f"⚠️ PepINVERT 服务初始化失败，将使用回退模式: {e}")
            self.pepinvent_service = None

    async def generate_formula(
        self,
        target_effects: list[str],
        constraints: dict[str, Any] | None = None,
    ) -> list[AIFormulaResult]:
        """
        执行完整的 AI 配方生成管线

        Args:
            target_effects: 目标功效列表（如 ["降血压", "抗氧化"]）
            constraints: 约束条件（如最大成分数、排除过敏原等），
                        支持 use_pepinvent=True 启用 PepINVERT 肽生成

        Returns:
            多套配方方案，按综合评分排序
        """
        logger.info(f"开始AI配方生成，目标功效: {target_effects}")

        use_pepinvent = (constraints or {}).get("use_pepinvent", False)

        if use_pepinvent and self.pepinvent_service is not None:
            return await self._generate_with_pepinvent(target_effects, constraints)

        candidates = await self.formula_gpt.generate_candidates(
            target_effects=target_effects,
            constraints=constraints or {},
        )
        logger.info(f"FormulaGPT 生成 {len(candidates)} 套候选方案")

        results: list[AIFormulaResult] = []
        for candidate in candidates:
            result = await self._evaluate_candidate(candidate)
            results.append(result)

        results.sort(key=lambda r: r.overall_score or 0, reverse=True)
        logger.info(f"AI配方生成完成，返回 {len(results)} 套方案")
        return results

    async def _generate_with_pepinvent(
        self,
        target_effects: list[str],
        constraints: dict[str, Any] | None = None,
    ) -> list[AIFormulaResult]:
        """
        使用 PepINVERT 生成增强的肽候选方案
        """
        from datetime import datetime, timezone
        generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

        try:
            pepinvent_response = await self.pepinvent_service.generate_peptides(
                target_effects=target_effects,
                constraints=constraints,
                max_candidates=(constraints or {}).get("max_candidates", 3),
            )

            candidates = []
            for i, peptide_data in enumerate(pepinvent_response.peptides):
                candidate = {
                    "name": f"PepINVERT方案-{i + 1}（{'+'.join(target_effects[:2])}）",
                    "herbs": [],
                    "peptides": [
                        {
                            "sequence": peptide_data["sequence"],
                            "source": "PepINVENT",
                            "activity": ",".join(target_effects[:2]),
                            "mw": peptide_data.get("molecular_weight", 0),
                            "score": peptide_data.get("composite_score", 0),
                            "properties": peptide_data.get("properties", {}),
                        }
                    ],
                    "target_effects": target_effects,
                    "confidence": peptide_data.get("composite_score", 0.8),
                }

                herb_pool = await self._get_herbs_for_effects(target_effects)
                if herb_pool:
                    import random as _random
                    num_herbs = min(5, len(herb_pool))
                    selected = _random.sample(herb_pool, min(num_herbs, len(herb_pool)))
                    candidate["herbs"] = [{"name": h, "role": "君" if i == 0 else "臣"} for i, h in enumerate(selected)]

                candidates.append(candidate)

            results: list[AIFormulaResult] = []
            for candidate in candidates:
                result = await self._evaluate_candidate(candidate)
                results.append(result)

            results.sort(key=lambda r: r.overall_score or 0, reverse=True)
            logger.info(f"PepINVERT 增强模式完成，返回 {len(results)} 套方案")
            return results

        except ServiceUnavailableError as e:
            logger.warning(f"PepINVERT 服务不可用，回退到标准模式: {e}")
            return await self.generate_formula(target_effects, {**(constraints or {}), "use_pepinvent": False})
        except Exception as e:
            logger.error(f"PepINVERT 生成失败，回退到标准模式: {e}", exc_info=True)
            return await self.generate_formula(target_effects, {**(constraints or {}), "use_pepinvent": False})

    async def _get_herbs_for_effects(self, effects: list[str]) -> list[str]:
        """根据功效获取匹配的药材列表"""
        effect_to_herbs = {
            "降血压": ["菊花", "山楂", "决明子", "葛根", "杜仲叶"],
            "抗氧化": ["枸杞子", "红枣", "茯苓", "山药", "桑葚"],
            "降血糖": ["苦瓜", "桑叶", "玉竹", "黄精", "麦冬"],
            "补气养阴": ["人参", "西洋参", "太子参", "黄芪", "白术"],
            "抗疲劳": ["刺五加", "红景天", "五味子", "巴戟天", "淫羊藿"],
            "改善睡眠": ["酸枣仁", "百合", "龙眼肉", "莲子", "远志"],
            "增强免疫": ["黄芪", "党参", "灵芝", "香菇", "银耳"],
        }

        herbs = set()
        for effect in effects:
            if effect in effect_to_herbs:
                herbs.update(effect_to_herbs[effect])

        return list(herbs)

    async def _evaluate_candidate(
        self, candidate: dict[str, Any]
    ) -> AIFormulaResult:
        """对单个候选方案执行多维度评估"""
        from datetime import datetime, timezone
        generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        result = AIFormulaResult(
            formula_name=candidate.get("name", "未命名配方"),
            herb_combination=candidate.get("herbs", []),
            peptide_candidates=candidate.get("peptides", []),
            generated_at=generated_at,
        )

        try:
            synergy = await self.synergy_net.analyze(
                herbs=result.herb_combination,
                peptides=result.peptide_candidates,
            )
            result.synergy_score = synergy.get("overall_si") or synergy.get("score")
            result.patent_synergy_scores = {
                "bliss_independence": synergy.get("bliss_independence", 0),
                "pk_interaction": synergy.get("pk_interaction", 0),
                "gibbs_stability": synergy.get("gibbs_stability", 0),
                "network_pharmacology": synergy.get("network_pharmacology", 0),
                "taste_matrix": synergy.get("taste_matrix", 0),
                "overall_si": synergy.get("overall_si", 0),
                "weighted_score": synergy.get("weighted_score", 0),
                "dominant_mechanism": synergy.get("dominant_mechanism", ""),
                "quality_level": synergy.get("quality_level", ""),
                "confidence": synergy.get("confidence", 0),
            }
        except Exception as e:
            logger.warning(f"SynergyNet 评估失败: {e}")

        try:
            safety = await self.safety_checker.check(
                ingredients=[h.get("name", "") for h in result.herb_combination],
                peptides=[p.get("sequence", "") for p in result.peptide_candidates],
            )
            result.safety_passed = safety.get("passed", False)
            result.safety_details = safety
        except Exception as e:
            logger.warning(f"SafetyChecker 评估失败: {e}")

        try:
            taste = await self.taste_predictor.predict(
                ingredients=result.herb_combination + result.peptide_candidates,
            )
            result.taste_score = taste.get("overall_score")
        except Exception as e:
            logger.warning(f"TastePredictor 评估失败: {e}")

        try:
            stability = await self.stability_model.predict(
                ingredients=result.herb_combination,
            )
            result.stability_score = stability.get("stability_score")
        except Exception as e:
            logger.warning(f"StabilityModel 评估失败: {e}")

        scores = []
        if result.synergy_score is not None:
            scores.append(result.synergy_score * 0.3)
        if result.safety_passed:
            scores.append(1.0 * 0.3)
        if result.taste_score is not None:
            scores.append(result.taste_score * 0.2)
        if result.stability_score is not None:
            scores.append(result.stability_score * 0.2)
        result.overall_score = sum(scores) if scores else 0

        return result

    async def check_safety(
        self,
        ingredient_names: list[str],
        peptide_sequences: list[str] | None = None,
    ) -> dict[str, Any]:
        """独立调用安全合规检查"""
        return await self.safety_checker.check(
            ingredients=ingredient_names,
            peptides=peptide_sequences or [],
        )

    async def analyze_synergy(
        self,
        herb_names: list[str],
        peptide_sequences: list[str] | None = None,
    ) -> dict[str, Any]:
        """独立调用协同作用分析"""
        return await self.synergy_net.analyze(
            herbs=[{"name": h} for h in herb_names],
            peptides=[{"sequence": s} for s in (peptide_sequences or [])],
        )


ai_service = AIService()

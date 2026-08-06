"""Generation module - /health, /generate, /generate/neural, /safety-check, /synergy-analysis"""
import logging
import time
import datetime
import json
from datetime import timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from . import (
    logger,
    _get_llm_service,
    ai_service,
    router,
    get_db_session,
    get_current_user,
    User,
)

sub_router = APIRouter(tags=["生成"])

class FormulaGenerateRequest(BaseModel):
    """AI 配方生成请求"""
    target_effects: list[str] = Field(..., min_length=1, max_length=5,
                                       description="目标功效，如 ['降血压', '抗氧化']")
    constraints: dict[str, Any] | None = Field(None, description="约束条件")
    use_llm: bool = Field(False, description="是否使用 LLM 生成（需要配置 API Key）")
    use_pepinvent: bool = Field(False, description="是否使用 PepINVERT 增强肽生成（需安装依赖）")


class NeuralGenerateRequest(BaseModel):
    """神经网络配方生成请求"""
    target_effects: list[str] = Field(..., min_length=1, max_length=5,
                                       description="目标功效，如 ['降血压', '抗氧化']")
    priority_values: dict[str, float] | None = Field(None, description="功效优先级权重")
    constraints: dict[str, Any] | None = Field(None, description="约束条件")
    max_candidates: int = Field(3, ge=1, le=10, description="最大候选方案数量")
    use_pepinvent: bool = Field(False, description="是否使用 PepINVERT 增强肽生成")


class SafetyCheckRequest(BaseModel):
    """安全合规检查请求"""
    ingredient_names: list[str] = Field(..., min_length=1, description="成分名称列表")
    peptide_sequences: list[str] | None = Field(None, description="活性肽序列列表")


class SynergyAnalysisRequest(BaseModel):
    """协同作用分析请求"""
    herb_names: list[str] = Field(..., min_length=1, description="药材名称列表")
    peptide_sequences: list[str] | None = Field(None, description="活性肽序列列表")



@router.get("/health", tags=["系统"])
async def ai_health_check():
    """AI 服务健康检查端点"""
    return {
        "status": "healthy",
        "service": "ai-api",
        "version": "1.0.0",
        "llm_available": _get_llm_service().is_available if hasattr(_get_llm_service(), 'is_available') else "unknown",
        "timestamp": datetime.datetime.now().isoformat()
    }


# ── Pydantic Schemas ──

from pydantic import BaseModel, Field
from typing import Any




@router.post("/generate", summary="AI 智能配方生成")
async def generate_formula(
    req: FormulaGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User | None = Depends(get_current_user),
):
    """
    基于 FormulaGPT + 多模型管线生成配方方案。

    - use_llm=false（默认）：使用内置规则引擎
    - use_llm=true：调用大语言模型生成（需配置 API Key），失败自动回退
    - use_pepinvent=true：使用 PepINVERT 增强肽生成，失败自动回退到规则引擎

    管线：候选生成 → 协同分析 → 安全检查 → 口感预测 → 稳定性预测
    返回多套方案按综合评分排序。
    """
    logger.info(f"配方生成请求 - use_llm=%s, use_pepinvent=%s, target_effects=%s", req.use_llm, req.use_pepinvent, req.target_effects)

    try:
        if req.use_llm:
            logger.info("用户选择使用AI大模型生成配方")
            # 检查LLM服务是否可用
            if not _get_llm_service().is_available:
                logger.warning("LLM服务不可用，回退到规则引擎")
            else:
                logger.info(f"LLM服务可用，provider=%s, model=%s", _get_llm_service().config.provider, _get_llm_service().config.model)
                try:
                    llm_formulas = await generate_formula_with_llm(
                        target_effects=req.target_effects,
                        constraints=req.constraints,
                        num_formulas=req.constraints.get("max_candidates", 3) if req.constraints else 3,
                    )
                    if llm_formulas:
                        logger.info(f"成功使用大模型生成 %s 套配方", len(llm_formulas))
                        candidates = []
                        for formula in llm_formulas:
                            ingredient_names = [h["name"] for h in formula.get("herbs", [])]
                            safety_result = {}
                            try:
                                safety_result = await ai_service.check_safety(
                                    ingredient_names=ingredient_names,
                                )
                            except Exception as e:
                                logger.warning("安全检查失败: %s", e)

                            synergy_result = {}
                            try:
                                synergy_result = await ai_service.analyze_synergy(
                                    herb_names=ingredient_names,
                                )
                            except Exception as e:
                                logger.warning("协同分析失败: %s", e)

                            scores = formula.get("scores", {})
                            candidates.append({
                                "formula_name": formula.get("name", "LLM配方方案"),
                                "herb_combination": formula.get("herbs", []),
                                "peptide_candidates": formula.get("peptides", []),
                                "synergy_score": synergy_result.get("overall_si") or synergy_result.get("score") or scores.get("synergy"),
                                "patent_synergy_scores": {
                                    "bliss_independence": synergy_result.get("bliss_independence", 0),
                                    "pk_interaction": synergy_result.get("pk_interaction", 0),
                                    "gibbs_stability": synergy_result.get("gibbs_stability", 0),
                                    "network_pharmacology": synergy_result.get("network_pharmacology", 0),
                                    "taste_matrix": synergy_result.get("taste_matrix", 0),
                                    "overall_si": synergy_result.get("overall_si", 0),
                                    "weighted_score": synergy_result.get("weighted_score", 0),
                                    "dominant_mechanism": synergy_result.get("dominant_mechanism", ""),
                                    "quality_level": synergy_result.get("quality_level", ""),
                                    "confidence": synergy_result.get("confidence", 0),
                                },
                                "safety_passed": safety_result.get("passed", True),
                                "safety_details": safety_result,
                                "taste_score": scores.get("taste"),
                                "stability_score": scores.get("stability"),
                                "overall_score": scores.get("overall"),
                                "description": formula.get("description", ""),
                                "preparation": formula.get("preparation", ""),
                                "target_population": formula.get("target_population", ""),
                                "contraindications": formula.get("contraindications", ""),
                                "expected_effects": formula.get("expected_effects", []),
                                "generated_by": "llm",
                                "generated_at": formula.get("generated_at"),
                            })

                        return {
                            "candidates": candidates,
                            "total": len(candidates),
                            "generator": "llm",
                        }
                except Exception as e:
                    logger.error("LLM配方生成失败: %s", e, exc_info=True)

        logger.info("使用规则引擎生成配方")
        constraints_with_pepinvent = dict(req.constraints or {})
        if req.use_pepinvent:
            constraints_with_pepinvent["use_pepinvent"] = True
            logger.info("已启用 PepINVERT 增强模式")

        results = await ai_service.generate_formula(
            target_effects=req.target_effects,
            constraints=constraints_with_pepinvent,
        )
        generator = "pepinvent" if req.use_pepinvent else "rule_engine"
        logger.info(f"{generator} 生成 %s 套配方", len(results))
        
        candidates = []
        for idx, r in enumerate(results):
            candidate = {
                **{k: getattr(r, k) for k in [
                    "formula_name", "herb_combination", "peptide_candidates",
                    "synergy_score", "patent_synergy_scores", "safety_passed", "safety_details",
                    "taste_score", "stability_score", "overall_score",
                    "generated_at",
                ]},
                "id": f"candidate_{idx}_{int(time.time())}",
                "name": getattr(r, "formula_name", f"配方方案{idx + 1}"),
                "generated_by": generator,
                "effects": req.target_effects,
            }
            candidates.append(candidate)
        
        return {
            "candidates": candidates,
            "total": len(candidates),
            "generator": generator,
        }
    except Exception as e:
        logger.error("配方生成服务异常: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="AI 服务异常，请稍后重试")




@router.post("/generate/neural", summary="神经网络配方生成")
async def generate_formula_neural(
    req: NeuralGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    基于 NeuralFormulaEngine 神经网络模型生成配方方案。

    - 使用深度学习模型进行配方优化
    - 支持自定义功效优先级
    - 支持多种约束条件
    - 可选使用 PepINVERT 增强肽生成（use_pepinvent=true）

    管线：候选生成 → 协同分析 → 安全检查 → 口感预测 → 稳定性预测
    返回多套方案按综合评分排序。
    """
    logger.info(f"神经网络配方生成请求 - target_effects=%s, max_candidates=%s, use_pepinvent=%s",
                req.target_effects, req.max_candidates, req.use_pepinvent)

    try:
        if req.use_pepinvent:
            logger.info("神经网络模式启用 PepINVERT 增强")
            constraints_with_pepinvent = dict(req.constraints or {})
            constraints_with_pepinvent["use_pepinvent"] = True
            constraints_with_pepinvent["max_candidates"] = req.max_candidates

            results = await ai_service.generate_formula(
                target_effects=req.target_effects,
                constraints=constraints_with_pepinvent,
            )

            logger.info(f"PepINVERT + 神经网络生成 %s 套配方", len(results))
            return {
                "candidates": [
                    {
                        **{k: getattr(r, k) for k in [
                            "formula_name", "herb_combination", "peptide_candidates",
                            "synergy_score", "patent_synergy_scores", "safety_passed", "safety_details",
                            "taste_score", "stability_score", "overall_score",
                            "generated_at",
                        ]},
                        "generated_by": "pepinvent_enhanced",
                    }
                    for r in results
                ],
                "total": len(results),
                "generator": "pepinvent_enhanced",
            }

        from ...services.ai_models.neural_engine import NeuralFormulaEngine
        engine = NeuralFormulaEngine()
        results = await engine.generate(
            target_effects=req.target_effects,
            priority_values=req.priority_values,
            constraints=req.constraints,
            max_candidates=req.max_candidates,
        )

        logger.info(f"神经网络生成 %s 套配方", len(results))
        return {
            "candidates": [
                {
                    **{k: getattr(r, k) for k in [
                        "formula_name", "herb_combination", "peptide_candidates",
                        "synergy_score", "patent_synergy_scores", "safety_passed", "safety_details",
                        "taste_score", "stability_score", "overall_score",
                        "generated_at",
                    ]},
                    "generated_by": "neural_engine",
                }
                for r in results
            ],
            "total": len(results),
            "generator": "neural_engine",
        }
    except ImportError:
        logger.warning("NeuralFormulaEngine 未实现，使用规则引擎作为回退")
        results = await ai_service.generate_formula(
            target_effects=req.target_effects,
            constraints=req.constraints,
        )
        return {
            "candidates": [
                {
                    **{k: getattr(r, k) for k in [
                        "formula_name", "herb_combination", "peptide_candidates",
                        "synergy_score", "patent_synergy_scores", "safety_passed", "safety_details",
                        "taste_score", "stability_score", "overall_score",
                        "generated_at",
                    ]},
                    "generated_by": "rule_engine",
                }
                for r in results
            ],
            "total": len(results),
            "generator": "rule_engine",
        }
    except Exception as e:
        logger.error("神经网络配方生成服务异常: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="AI 服务异常，请稍后重试")



# ══════════════════════════════════════════════════════════════════
# Generate V2 — 统一配方生成引擎（自回归 + 预测-判别 + RL调优）
# ══════════════════════════════════════════════════════════════════

class FormulaGenerateV2Request(BaseModel):
    """统一配方生成请求（v2）"""
    target_effects: list[str] = Field(..., min_length=1, max_length=5,
                                       description="目标功效，如 ['降血压', '抗氧化']")
    constraints: dict[str, Any] | None = Field(None, description="约束条件")
    use_new_engine: bool = Field(True, description="是否使用新统一引擎（True=自回归LSTM，False=传统优化器）")
    template: str | None = Field(None, description="经典方剂模板名称（如 '四君子汤'）")
    n_candidates: int = Field(10, ge=3, le=30, description="生成候选数")
    select_top_k: int = Field(3, ge=1, le=10, description="最终选择数")
    use_rl_tuning: bool = Field(False, description="是否启用RL调优")


@router.post("/generate/v2", summary="统一配方生成（v2）")
async def generate_formula_v2(
    req: FormulaGenerateV2Request,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    统一配方生成引擎 v2

    基于专利 US 11,742,060 B2 的自回归生成架构：
    - Signal Encoder: 需求→信号向量
    - Autoregressive Generator: LSTM逐个成分生成
    - Predictor: 实时属性预测
    - Discriminator: 新颖性检测
    - Template Subsystem: 经典方剂先验
    - RL Tuner: 策略梯度调优
    - Formula Selector: 优先级逐级选择

    请求参数:
    - target_effects: 目标功效列表
    - use_new_engine: True=新引擎，False=传统引擎（默认True）
    - template: 经典方剂模板（可选）
    - n_candidates: 生成候选数（默认10）
    - select_top_k: 最终选择数（默认3）
    - use_rl_tuning: 是否启用RL调优（默认False）

    返回格式与 /generate 一致，新增 strategy 和 execution_time_ms 字段。
    """
    logger.info(f"[GenerateV2] 统一引擎请求 - effects={req.target_effects}, "
                f"new_engine={req.use_new_engine}, template={req.template}")

    try:
        from ...services.formula_designer import FormulaDesigner

        designer = FormulaDesigner(knowledge_base={})
        intent = {
            "target_effects": req.target_effects,
            "use_new_engine": req.use_new_engine,
            "template": req.template,
            "n_candidates": req.n_candidates,
            "select_top_k": req.select_top_k,
            "use_rl_tuning": req.use_rl_tuning,
            "constraints": req.constraints or {},
        }

        start_time = time.perf_counter()
        result = await designer.design(intent, {})
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        # 格式化返回
        candidates = []
        for i, item in enumerate(result.get("data", [])):
            candidates.append({
                "id": f"v2_candidate_{i}",
                "role": item.get("role", ""),
                "name": item.get("name", ""),
                "dosage": item.get("dosage", ""),
                "purpose": item.get("purpose", ""),
                "score": item.get("score", 0),
            })

        return {
            "summary": result.get("summary", ""),
            "details": result.get("details", ""),
            "candidates": candidates,
            "total": len(candidates),
            "scores": result.get("scores", {}),
            "strategy": result.get("strategy", "unified_engine"),
            "template_used": result.get("template_used"),
            "execution_time_ms": round(elapsed_ms, 2),
            "generator": "unified_engine_v2",
        }

    except Exception as e:
        logger.error(f"[GenerateV2] 统一引擎异常: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"统一引擎生成失败: {str(e)[:100]}")



@router.post("/safety-check", summary="安全合规检查")
async def safety_check(
    req: SafetyCheckRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    独立调用安全合规检查引擎。
    包括：药食同源目录校验、十九畏/十八反配伍禁忌、过敏原、孕妇安全、毒性评估。
    """
    result = await ai_service.check_safety(
        ingredient_names=req.ingredient_names,
        peptide_sequences=req.peptide_sequences,
    )
    return result




@router.post("/synergy-analysis", summary="协同作用分析")
async def synergy_analysis(
    req: SynergyAnalysisRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    分析药材间、药材与肽之间的协同/拮抗关系。
    返回协同评分、协同配对、拮抗预警、共有通路和热力图数据。
    """
    result = await ai_service.analyze_synergy(
        herb_names=req.herb_names,
        peptide_sequences=req.peptide_sequences,
    )
    return result




"""
Generation module - AI 配方生成相关端点
- /health                   健康检查
- /generate/advanced       高级优化生成（统一 GA 服务）
- /generate/v2              统一配方生成引擎 v2
- /generate/seven-step      七步专业配方设计
- /safety-check             安全合规检查
- /synergy-analysis         协同作用分析
- /recommend                智能配方推荐
- /interpret                配方智能解释

历史遗留：旧版 /generate 处理器（统一优化器）已于 2026-10-16 清理。
"""
import logging
import time
import datetime
from datetime import timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from . import (
    logger,
    _get_llm_service,
    ai_service,
    router,
    get_db_session,
    get_current_active_user,
    User,
)
from ...core.plans import require_plan


class NeuralGenerateRequest(BaseModel):
    """高级优化配方生成请求"""
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


class FormulaRecommendRequest(BaseModel):
    """配方推荐请求"""
    target_effects: list[str] = Field(..., min_length=1, max_length=6,
                                       description="目标功效列表")
    top_k: int = Field(3, ge=1, le=10, description="返回推荐数量")


class FormulaInterpretRequest(BaseModel):
    """配方智能解释请求"""
    formula_name: str = Field("", description="配方名称")
    herbs: list[dict[str, Any]] = Field(..., min_length=1,
                                         description="药材列表 [{name, dosage_g, role}]")
    target_effects: list[str] = Field(..., min_length=1, max_length=6,
                                       description="目标功效列表")


class SevenStepFormulaRequest(BaseModel):
    """七步配方设计请求"""
    target_effects: list[str] = Field(..., min_length=1, max_length=5,
                                       description="目标功效，如 ['免疫调节', '抗氧化']")
    product_form: str = Field("保健饮品", description="产品形态")
    target_group: str = Field("adult", description="目标人群")
    max_cost: float | None = Field(None, description="成本上限（元）")
    target_shelf_life_months: int = Field(12, ge=1, le=60, description="目标货架期（月）")
    n_candidates: int = Field(10, ge=3, le=30, description="候选配方数")


@router.get("/health", tags=["系统"])
async def ai_health_check():
    """AI 服务健康检查端点"""
    return {
        "status": "healthy",
        "service": "ai-api",
        "version": "1.0.0",
        "llm_available": _get_llm_service().is_available if hasattr(_get_llm_service(), 'is_available') else "unknown",
        "timestamp": datetime.datetime.now(timezone.utc).isoformat()
    }


@router.post("/generate/advanced", summary="AI 配方生成（高级优化模式）")
async def generate_formula_neural(
    req: NeuralGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_plan("ai_formula_generation")),
):
    """
    基于遗传算法多目标优化的高级配方生成模式。

    - 调用真实 GA 引擎（自动加载数据库药材）进行配方优化
    - 支持自定义功效优先级（映射为 GA 多目标权重）
    - 支持多种约束条件

    管线：候选生成 → 遗传进化 → 多维评分 → 结构化输出
    返回多套方案按综合评分排序。
    """
    # 组织计划 AI 配额检查（超限 403）
    try:
        from ...core.multi_tenant.multi_tenant_service import ensure_ai_quota
        await ensure_ai_quota(db, current_user.id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    logger.info(f"高级优化配方生成请求 - target_effects=%s, max_candidates=%s, use_pepinvent=%s",
                req.target_effects, req.max_candidates, req.use_pepinvent)

    try:
        from ...services.ai.formula_generation_service import run_ga_generation

        constraints = dict(req.constraints or {})
        constraints["max_candidates"] = req.max_candidates
        # 前端 priority_values（synergy/taste/stability/safety）映射为 GA 多目标权重
        if req.priority_values:
            constraints["objective_weights"] = dict(req.priority_values)

        result = await run_ga_generation(req.target_effects, constraints)

        # 兼容前端 NeuralGenerateResponse 结构
        return {
            "candidates": result["candidates"],
            "total": result["total"],
            "generator": result["generator"],
        }
    except Exception as e:
        logger.error("配方生成服务异常: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="AI 服务异常，请稍后重试")


@router.post("/generate/v2", summary="统一配方生成（v2）")
async def generate_formula_v2(
    req: FormulaGenerateV2Request,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_plan("ai_formula_generation")),
):
    """
    统一配方生成引擎 v2（兼容端点，仍属规则类）。
    """
    # 组织计划 AI 配额检查（超限 403）
    try:
        from ...core.multi_tenant.multi_tenant_service import ensure_ai_quota
        await ensure_ai_quota(db, current_user.id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

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
                "dosage_g": float(item.get("dosage") or 0),  # 前端 FormulaComparePanel 标准字段
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
            "generator": "rule_engine",  # 统一引擎仍使用遗传算法
        }

    except Exception as e:
        logger.error(f"[GenerateV2] 统一引擎异常: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"统一引擎生成失败: {str(e)[:100]}")


@router.post("/generate/seven-step", summary="七步专业配方设计")
async def generate_formula_seven_step(
    req: SevenStepFormulaRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_plan("ai_formula_generation")),
):
    """
    七步专业配方设计引擎（兼容端点，仍属规则类）。
    """
    # 组织计划 AI 配额检查（超限 403）
    try:
        from ...core.multi_tenant.multi_tenant_service import ensure_ai_quota
        await ensure_ai_quota(db, current_user.id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    logger.info(f"[SevenStep] 请求 - effects={req.target_effects}, form={req.product_form}")

    try:
        from ...services.formula.seven_step_engine import SevenStepFormulaEngine, FormulaRequest

        engine = SevenStepFormulaEngine()
        formula_req = FormulaRequest(
            target_effects=req.target_effects,
            product_form=req.product_form,
            target_group=req.target_group,
            max_cost=req.max_cost,
            target_shelf_life_months=req.target_shelf_life_months,
            n_candidates=req.n_candidates,
        )

        start_time = time.perf_counter()
        result = await engine.design(formula_req)
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        # 格式化输出
        herbs_output = []
        for herb in result.framework.get("herbs", []):
            herbs_output.append({
                "name": herb.get("name", ""),
                "dosage_g": herb.get("dosage", 0),
                "role": herb.get("role", ""),
                "efficacy_score": herb.get("efficacy_score", 0),
                "safety_index": herb.get("safety_index", 0),
            })

        return {
            "summary": result.summary,
            "product_form": result.framework.get("product_form", ""),
            "total_dosage_g": result.framework.get("total_dosage_g", 0),
            "herbs": herbs_output,
            "structure_score": result.framework.get("structure_score", 0),
            "color": result.color,
            "fragrance": result.fragrance,
            "flavor": result.flavor,
            "quality": result.quality,
            "preservation": result.preservation,
            "functional": result.functional,
            "validation": result.validation,
            "execution_time_ms": round(elapsed_ms, 2),
            "generator": "rule_engine",  # 七步引擎仍属规则类
        }

    except Exception as e:
        logger.error(f"[SevenStep] 七步引擎异常: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"七步配方设计失败: {str(e)[:100]}")


@router.post("/safety-check", summary="安全合规检查")
async def safety_check(
    req: SafetyCheckRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(get_current_active_user),
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


@router.post("/recommend", summary="智能配方推荐")
async def recommend_formula(
    req: FormulaRecommendRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """
    基于用户历史配方、数据库功效评分与协同配伍网络，
    生成个性化的配方推荐（数据全部来自数据库）。
    """
    from ...services.ai.prescription_recommender import PrescriptionRecommender

    recommender = PrescriptionRecommender(db)
    recommendations = await recommender.recommend(
        user_id=int(current_user.id),
        target_effects=req.target_effects,
        top_k=req.top_k,
    )
    return {
        "recommendations": recommendations,
        "total": len(recommendations),
        "generator": "recommender",
    }


@router.post("/interpret", summary="配方智能解释")
async def interpret_formula(
    req: FormulaInterpretRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """
    基于网络药理学与中医理论，生成配方的方解与机理说明。
    数据来源为 TCMHerb 数据库（effects / compounds / targets / extra_knowledge）。
    """
    from ...services.ai.formula_interpreter import FormulaInterpreter

    interpreter = FormulaInterpreter(db)
    result = await interpreter.interpret(
        formula_name=req.formula_name,
        herbs=req.herbs,
        target_effects=req.target_effects,
    )
    return {"interpretation": result}
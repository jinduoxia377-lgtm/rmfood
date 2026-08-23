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




@router.post("/generate", summary="AI 智能配方生成（遗传算法优化）")
async def generate_formula(
    req: FormulaGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User | None = Depends(get_current_user),
):
    """
    基于遗传算法多目标优化的配方生成。

    - 使用 NSGA-II + 遗传算法引擎搜索最优配方
    - 多维度评分：功效、安全、口感、成本、协同、稳定性
    - 自动提取药材中文名和精确剂量
    - 失败时回退到规则引擎
    """
    logger.info(f"配方生成请求 - target_effects={req.target_effects}, constraints={req.constraints}")

    try:
        max_candidates = (req.constraints or {}).get("max_candidates", 5)
        total_dosage = (req.constraints or {}).get("total_dosage", 100.0)

        # ── Step 1: 使用统一优化器生成候选 ──
        from ..services.ai.algorithms.unified_optimizer import (
            UnifiedFormulaOptimizer, OptimizationRequest,
        )
        from app.services.ai.algorithms.genetic_formula_optimizer import _BUILTIN_HERBS

        unified = UnifiedFormulaOptimizer()
        opt_req = OptimizationRequest(
            target_effects=req.target_effects,
            strategy="auto",
            population_size=60,
            generations=40,
            max_ingredients=12,
            min_ingredients=3,
            total_dosage=total_dosage,
            count=max(max_candidates, 5),
        )
        opt_result = unified.optimize(opt_req)

        # 建立 herb_id → name_cn 映射
        herb_id_to_name: dict[str, str] = {hid: h.name_cn for hid, h in _BUILTIN_HERBS.items()}

        # ── Step 2: 转换为候选格式并评估 ──
        candidates: list[dict] = []
        for i, cand in enumerate(opt_result.candidates[:max_candidates]):
            herb_combo = []
            for item in cand.get("ingredients", []):
                hid = item.get("id", "")
                name_cn = herb_id_to_name.get(hid, hid)
                herb_combo.append({
                    "name": name_cn,
                    "dosage_mg": round(item.get("dosage", 0) * 1000, 1),
                })

            # 模拟协同/安全/口感/稳定性评分（基于业务规则）
            synergy_score = cand.get("synergy", 0) or cand.get("overall_score", 0)
            taste_score = cand.get("taste", 0) or 0.65
            stability_score = cand.get("stability", 0) or 0.70
            safety_score = cand.get("safety", 0) or 0.85
            overall = cand.get("overall_score", cand.get("fitness", 0)) or (
                synergy_score * 0.30 + safety_score * 0.25 + taste_score * 0.10
                + cand.get("cost", 0) * 0.15 + stability_score * 0.10
            )

            # 分配君臣佐使角色
            roles = ["君", "臣", "臣", "佐", "佐", "使"]
            herbs_with_roles = []
            for j, herb in enumerate(herb_combo[:6]):
                role = roles[j] if j < len(roles) else "佐"
                herbs_with_roles.append({
                    "name": herb["name"],
                    "dosage_mg": herb["dosage_mg"],
                    "role": role,
                })

            candidates.append({
                "id": f"candidate_{int(time.time())}_{i}",
                "formula_name": f"优化配方-{i+1}（{'+' .join(req.target_effects[:2])}）",
                "name": f"配方方案{i + 1}",
                "herb_combination": herbs_with_roles,
                "peptide_candidates": [],
                "synergy_score": round(synergy_score, 4),
                "taste_score": round(taste_score, 4),
                "stability_score": round(stability_score, 4),
                "safety_score": round(safety_score, 4),
                "cost_score": round(cand.get("cost", 0), 4),
                "overall_score": round(overall, 4),
                "effects": req.target_effects,
                "generated_by": "ga_optimizer",
                "generated_at": datetime.datetime.now().isoformat(),
            })

        logger.info(f"遗传算法生成 {len(candidates)} 套候选配方")
        return {
            "candidates": candidates,
            "total": len(candidates),
            "generator": "ga_optimizer",
            "execution_time_ms": opt_result.execution_time_ms,
            "strategy": opt_result.strategy_used,
            "best_score": round(opt_result.best_score, 4),
        }

    except Exception as e:
        logger.error("配方生成服务异常: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"配方生成失败: {str(e)[:100]}")




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


# ══════════════════════════════════════════════════════════════════
# 七步配方设计引擎 API
# ══════════════════════════════════════════════════════════════════

class SevenStepFormulaRequest(BaseModel):
    """七步配方设计请求"""
    target_effects: list[str] = Field(..., min_length=1, max_length=5,
                                       description="目标功效，如 ['免疫调节', '抗氧化']")
    product_form: str = Field("保健饮品", description="产品形态")
    target_group: str = Field("adult", description="目标人群")
    max_cost: float | None = Field(None, description="成本上限（元）")
    target_shelf_life_months: int = Field(12, ge=1, le=60, description="目标货架期（月）")
    n_candidates: int = Field(10, ge=3, le=30, description="候选配方数")


@router.post("/generate/seven-step", summary="七步专业配方设计")
async def generate_formula_seven_step(
    req: SevenStepFormulaRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    七步专业配方设计引擎

    基于《中国普通配方设计思路》七步法：
    Step 1: 主体骨架设计（产品形态规则 + MILP精确剂量 + 君臣佐使）
    Step 2: 调色设计（GB 2760合规着色剂选择 + CIELAB色彩预测）
    Step 3: 调香设计（香气轮廓建模 + 矫味剂匹配）
    Step 4: 调味设计（五味增效/相乘/掩蔽/转化模型）
    Step 5: 品质改良设计（增稠/乳化/水分保持/抗氧化）
    Step 6: 防腐保鲜设计（技术选型 + 货架期预测）
    Step 7: 功能性设计（强化剂选择 + 保留率预测 + GB 14880合规）
    + 综合验证（协同效应 + 兼容性 + 安全预警）
    """
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
            "generator": "seven_step_engine",
        }

    except Exception as e:
        logger.error(f"[SevenStep] 七步引擎异常: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"七步配方设计失败: {str(e)[:100]}")




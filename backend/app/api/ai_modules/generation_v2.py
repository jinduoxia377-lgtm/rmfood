"""
配方生成管线 — 统一调用 FormulaGenerationService（真实 GA 引擎）
支持 use_llm=true 时走 LLM 生成（llm_service.generate_formula_with_llm）。

响应契约（主路径 /generate）：
- candidates[].herb_combination[] 字段形态为 `{name, dosage, role}`：
  - name  : 药材中文名
  - dosage: 剂量字符串（如 "16.0g"）
  - role  : 君臣佐使角色（君/臣/佐/使）
- 与 genetic 系列端点（/generate/genetic、/generate/genetic/hybrid、
  /generate/unified、/generate/multi-objective 等）的
  `{name_cn, dosage_g}` 形态**不同**。
  两套契约并存属设计约定：前端已双向兼容
  （frontend/src/api/ai.ts 归一化同时处理 name/name_cn 与 dosage/dosage_g），
  后端**不修改响应结构**，避免破坏前端。
"""
import datetime
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.plans import require_plan
from ...services.ai.formula_generation_service import run_ga_generation
from . import (
    User,
    get_db_session,
    logger,
)

router = APIRouter()


# ════════════════════════════════════════════
# 请求/响应 Schema
# ════════════════════════════════════════════
class FormulaGenerateRequest(BaseModel):
    """AI 配方生成请求"""
    target_effects: list[str] = Field(..., min_length=1, max_length=5,
                                       description="目标功效标签（如 '增强免疫'、'抗氧化'）")
    constraints: dict[str, Any] | None = Field(None, description="约束条件")
    use_llm: bool = Field(False, description="是否使用 LLM 生成")
    use_pepinvent: bool = Field(False, description="是否使用 PepINVERT 增强肽生成")


def _format_llm_candidates(
    formulas: list[dict],
    target_effects: list[str],
    max_candidates: int,
) -> dict[str, Any]:
    """将 LLM 生成的配方结构化为与 GA 一致的候选响应。"""
    formatted: list[dict[str, Any]] = []
    for i, f in enumerate(formulas[:max_candidates]):
        herbs = f.get("herbs", []) or []
        herb_combo: list[dict[str, Any]] = []
        for j, h in enumerate(herbs[:6]):
            raw_dosage = str(h.get("dosage") or "").strip()
            if raw_dosage and not raw_dosage.lower().endswith("g"):
                raw_dosage = f"{raw_dosage}g"
            herb_combo.append({
                "name": h.get("name", ""),
                "dosage": raw_dosage,
                "role": h.get("role", "佐"),
            })

        scores = f.get("scores", {}) or {}
        def _score(key: str, default: float) -> float:
            try:
                return float(scores.get(key, default) or default)
            except (TypeError, ValueError):
                return default

        overall = _score("overall", _score("overall_score", 0.7))
        safety = _score("safety", _score("safety_score", 0.8))
        synergy = _score("synergy", _score("synergy_score", 0.6))

        formatted.append({
            "id": f"llm_candidate_{int(time.time())}_{i}",
            "formula_name": f.get("name", f"LLM配方-{i+1}"),
            "name": f.get("name", f"配方方案{i + 1}"),
            "herb_combination": herb_combo,
            "peptide_candidates": f.get("peptides", []) or [],
            "synergy_score": round(synergy, 4),
            "taste_score": round(_score("taste", 0.65), 4),
            "stability_score": round(_score("stability", 0.70), 4),
            "safety_score": round(safety, 4),
            "cost_score": round(_score("cost", 0.70), 4),
            "efficacy_score": round(_score("efficacy", 0.70), 4),
            "overall_score": round(overall, 4),
            "score": round(overall, 4),
            "safety_passed": safety >= 0.7,
            "effects": target_effects,
            "generated_by": "llm",
            "generated_at": datetime.datetime.now().isoformat(),
        })

    return {
        "candidates": formatted,
        "total": len(formatted),
        "generator": "llm",
        "execution_time_ms": 0.0,
        "strategy": "llm",
        "best_score": round(max((c["overall_score"] for c in formatted), default=0), 4),
    }


# ════════════════════════════════════════════
# 核心端点
# ════════════════════════════════════════════
@router.post("/generate", summary="AI 智能配方生成（遗传算法优化）")
async def generate_formula(
    req: FormulaGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_plan("ai_formula_generation")),
):
    """
    基于遗传算法多目标优化的配方生成管线。

    流程:
    1. 前端标签 → TCM 关键词映射
    2. 调用真实 GA 引擎（自动加载数据库药材）生成候选配方
    3. 将 herb_id → 中文名 + 剂量(g) 转换
    4. 分配君臣佐使角色
    5. 计算多维度评分
    6. 返回结构化候选方案列表

    use_llm=true 时改走 LLM 生成（llm_service.generate_formula_with_llm），
    LLM 不可用/无结果时自动回退 GA。

    响应契约：
    - candidates[].herb_combination[] 使用 `{name, dosage, role}` 形态
      （dosage 为字符串，如 "16.0g"）。
    - genetic 系列端点使用 `{name_cn, dosage_g}` 形态。
      两套契约并存，前端已双向兼容；后端保持本形态不变，避免破坏前端。
    """
    # 组织计划 AI 配额检查（超限 403）
    try:
        from ...core.multi_tenant.multi_tenant_service import ensure_ai_quota
        await ensure_ai_quota(db, current_user.id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    logger.info(f"[Generate] 请求 effects={req.target_effects}, use_llm={req.use_llm}, constraints={req.constraints}")
    start_ts = time.perf_counter()

    try:
        max_candidates = max(int((req.constraints or {}).get("max_candidates", 5) or 5), 3)

        if req.use_llm:
            from ...services.llm_service import generate_formula_with_llm
            formulas = await generate_formula_with_llm(
                req.target_effects,
                req.constraints,
                num_formulas=max_candidates,
            )
            if formulas:
                result = _format_llm_candidates(formulas, req.target_effects, max_candidates)
                result["execution_time_ms"] = round((time.perf_counter() - start_ts) * 1000, 2)
                logger.info(
                    f"[Generate/LLM] 完成: {result.get('total', 0)} 套候选, "
                    f"generator={result.get('generator')}"
                )
                return result
            logger.warning("[Generate] use_llm=true 但 LLM 不可用或未返回结果，回退 GA")

        result = await run_ga_generation(req.target_effects, req.constraints, user_id=str(current_user.id))
        elapsed_ms = (time.perf_counter() - start_ts) * 1000
        result["execution_time_ms"] = round(elapsed_ms, 2)
        logger.info(
            f"[Generate] 完成: {result.get('total', 0)} 套候选, {elapsed_ms:.0f}ms, "
            f"generator={result.get('generator')}"
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Generate] 配方生成失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"配方生成失败: {str(e)[:100]}")

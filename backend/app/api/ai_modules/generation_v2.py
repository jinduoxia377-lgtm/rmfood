"""
配方生成管线 — 统一调用 FormulaGenerationService（真实 GA 引擎）
"""
import logging
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from . import (
    logger,
    get_db_session,
    get_current_active_user,
    User,
)
from ...core.plans import require_plan

from ...services.ai.formula_generation_service import run_ga_generation

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
    """
    # 组织计划 AI 配额检查（超限 403）
    try:
        from ...core.multi_tenant.multi_tenant_service import ensure_ai_quota
        await ensure_ai_quota(db, current_user.id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    logger.info(f"[Generate] 请求 effects={req.target_effects}, constraints={req.constraints}")
    start_ts = time.perf_counter()

    try:
        result = await run_ga_generation(req.target_effects, req.constraints)
        elapsed_ms = (time.perf_counter() - start_ts) * 1000
        result["execution_time_ms"] = round(elapsed_ms, 2)
        logger.info(
            f"[Generate] 完成: {result.get('total', 0)} 套候选, {elapsed_ms:.0f}ms, "
            f"generator={result.get('generator')}"
        )
        return result
    except Exception as e:
        logger.error(f"[Generate] 配方生成失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"配方生成失败: {str(e)[:100]}")
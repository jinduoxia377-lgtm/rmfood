"""
配方智能校验与平台知识检索 API

- POST /ai/formula/validate        配方智能校验（需登录）
- POST /ai/formula/knowledge     平台知识检索（需登录）
- POST /ai/formula/repair-structured  非结构化文本修复为 JSON blocks（需登录）
- POST /ai/formula/feedback     提交配方反馈（需登录）
- GET  /ai/formula/{formula_id}/feedback 读取配方反馈列表（需登录）

依赖写法与 chat.py 保持一致：require_tenant + get_db_session + get_current_active_user。
"""
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.multi_tenant.org_resolver import resolve_effective_org_id
from ...core.multi_tenant.tenant_security import TenantContext, require_tenant
from ...models.formula_feedback import FormulaFeedback
from ...services.ai.formula_intelligence import (
    repair_formula_structure,
    retrieve_herb_knowledge,
    validate_formula,
)
from . import (
    User,
    get_current_active_user,
    get_db_session,
    logger,
)

sub_router = APIRouter(tags=["配方智能校验"])


class FormulaIngredientInput(BaseModel):
    """配方成分输入"""
    name: str = Field(..., min_length=1, max_length=200, description="成分名称")
    dosage_g: float = Field(..., ge=0, description="剂量（克/天）；0 表示未知剂量，仍参与成分识别与配伍检查")
    role: Optional[str] = Field(None, description="君臣佐使角色（可选）")


class FormulaValidateRequest(BaseModel):
    """配方校验请求"""
    formula_name: Optional[str] = Field(None, max_length=200, description="配方名称（可选）")
    ingredients: List[FormulaIngredientInput] = Field(
        ..., min_length=1, max_length=100, description="配方成分列表"
    )
    target_effects: Optional[List[str]] = Field(None, description="目标功效标签")
    user_profile_context: Optional[str] = Field(
        None, max_length=2000, description="用户画像上下文（含过敏原/饮食禁忌）"
    )


class KnowledgeRequest(BaseModel):
    """平台知识检索请求"""
    query: str = Field(..., min_length=1, max_length=200, description="检索关键词")
    top_k: int = Field(5, ge=1, le=20, description="返回条目数上限")


@sub_router.post("/formula/validate", summary="配方智能校验")
async def formula_validate(
    req: FormulaValidateRequest,
    tenant: TenantContext = Depends(require_tenant),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, Any]:
    """
    对配方成分执行科学级后验校验：

    - 原料库识别（FoodMaterial 名称/别名模糊匹配）
    - 药食同源标记 / 毒性等级 / 安全剂量范围 / 剂量状态
    - SafetyAlertSystem 三级安全预警
    - 两两配伍禁忌（十八反 / 十九畏 + CompatibilityChecker 4 层检测）
    - 用户画像过敏原匹配
    """
    try:
        result = await validate_formula(
            ingredients=[i.model_dump() for i in req.ingredients],
            target_effects=req.target_effects,
            user_profile=req.user_profile_context,
            db=db,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("配方智能校验失败: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="配方校验服务暂时不可用，请稍后重试")
    # 回显 formula_name，与前端 validateAiFormula 契约保持一致
    result["formula_name"] = req.formula_name
    return result


@sub_router.post("/formula/knowledge", summary="平台知识检索")
async def formula_knowledge(
    req: KnowledgeRequest,
    tenant: TenantContext = Depends(require_tenant),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, Any]:
    """
    从平台原料库（FoodMaterial）按关键词检索药材/食材知识，
    返回名称、功效、活性成分、安全剂量、禁忌等信息。
    """
    try:
        items = await retrieve_herb_knowledge(req.query, top_k=req.top_k, db=db)
    except Exception as exc:  # noqa: BLE001
        logger.error("平台知识检索失败: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="知识检索服务暂时不可用，请稍后重试")
    return {"query": req.query, "total": len(items), "items": items}


class RepairStructureRequest(BaseModel):
    """结构化修复请求"""
    content: str = Field(..., min_length=1, max_length=20000, description="非结构化配方文本")
    formula_name: Optional[str] = Field(None, max_length=200, description="配方名称（可选）")


@sub_router.post("/formula/repair-structured", summary="非结构化配方文本修复为 JSON blocks")
async def formula_repair_structured(
    req: RepairStructureRequest,
    tenant: TenantContext = Depends(require_tenant),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, Any]:
    """
    当 LLM 输出未按 JSON blocks 结构化时，调用 LLM（低温度）将其修复为
    结构化 JSON（blocks 格式与 academician 提示词一致：
    header/data-table/callout/metrics/list）。

    LLM 不可用或解析失败时返回 success:false（不返回 500）。
    """
    result = await repair_formula_structure(
        content=req.content,
        formula_name=req.formula_name,
        db=db,
        user_id=current_user.id,
    )
    return result


class FeedbackCreateRequest(BaseModel):
    """配方反馈提交请求"""
    formula_id: int = Field(..., gt=0, description="配方ID")
    rating: int = Field(..., ge=1, le=5, description="评分 1-5")
    symptom_change: Optional[str] = Field(None, max_length=2000, description="症状变化描述")
    metric_updates: Optional[List[dict[str, Any]]] = Field(None, description="客观指标更新列表")
    notes: Optional[str] = Field(None, max_length=2000, description="备注")


@sub_router.post("/formula/feedback", summary="提交配方反馈")
async def formula_feedback_create(
    req: FeedbackCreateRequest,
    tenant: TenantContext = Depends(require_tenant),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, Any]:
    """
    记录用户对 AI 生成配方的反馈（评分/症状变化/指标更新/备注），
    支撑「反馈迭代闭环」。
    """
    feedback = FormulaFeedback(
        user_id=current_user.id,
        organization_id=await resolve_effective_org_id(tenant.org_id, current_user, db),
        formula_id=req.formula_id,
        rating=req.rating,
        symptom_change=req.symptom_change,
        metric_updates=req.metric_updates or [],
        notes=req.notes,
    )
    db.add(feedback)
    try:
        await db.commit()
        await db.refresh(feedback)
    except Exception as exc:  # noqa: BLE001
        logger.error("配方反馈写入失败: %s", exc, exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail="反馈保存失败，请稍后重试")
    return {"success": True, "feedback": feedback.to_dict()}


@sub_router.get("/formula/{formula_id}/feedback", summary="读取配方反馈列表")
async def formula_feedback_list(
    formula_id: int,
    tenant: TenantContext = Depends(require_tenant),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, Any]:
    """
    读取指定配方的反馈列表（按创建时间倒序）。
    """
    try:
        result = await db.execute(
            select(FormulaFeedback)
            .where(FormulaFeedback.formula_id == formula_id)
            .order_by(FormulaFeedback.created_at.desc())
            .limit(100)
        )
        rows = list(result.scalars().all())
    except Exception as exc:  # noqa: BLE001
        logger.error("配方反馈读取失败: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="反馈读取失败，请稍后重试")
    return {
        "formula_id": formula_id,
        "total": len(rows),
        "items": [r.to_dict() for r in rows],
    }

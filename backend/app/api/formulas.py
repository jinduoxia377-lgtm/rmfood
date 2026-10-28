"""
配方管理路由
配方 CRUD、版本管理、审核流程、AI 推荐
"""
import logging
from typing import Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..schemas import (
    FormulaCreate, FormulaUpdate, FormulaResponse, FormulaListResponse,
    FormulaVersionResponse, FormulaReviewRequest,
    AIRecommendationRequest, AIRecommendationResponse,
    ApiResponse, SuccessResponse, PaginatedResponse,
    PeptideResponse
)
from ..schemas.formula import (
    BatchStatusUpdateRequest,
    IngredientResponse,
)
from ..services.formula import FormulaService
from ..models.enums import UserRole, FormulaStatus
from ..models.user_model import User
from ..models.formula import Formula
from ..services.auth import get_current_user as _required_get_current_user
from ..api.deps import get_db_session, PaginationParams, FormulaFilterParams, require_role, get_current_user as _optional_get_current_user
from ..core.plans import require_plan
from ..core.multi_tenant.tenant_security import TenantContext, require_tenant
from ..core.multi_tenant.tenant_quota import QuotaType, require_quota

from ..services.ai.formula_intelligence import _match_food_material


async def _enrich_ingredients_with_food_material(
    db: AsyncSession,
    composition: Optional[dict],
) -> dict:
    """
    用平台原料库（FoodMaterial）富化 composition.ingredients 中每个成分的 platform_data。

    富化字段：matched_name / food_homology / safe_dose_range / effects /
    active_ingredients / contraindications / toxicity_class / source。
    数据库不可用或未匹配时保持原样（不报错）。
    """
    if not composition or not isinstance(composition, dict):
        return composition or {}
    ingredients = composition.get("ingredients") or []
    if not ingredients:
        return composition

    enriched_ingredients = []
    for ing in ingredients:
        if not isinstance(ing, dict):
            enriched_ingredients.append(ing)
            continue
        name = str(ing.get("name") or "").strip()
        if not name:
            enriched_ingredients.append(ing)
            continue
        try:
            mat = await _match_food_material(db, name)
        except Exception as exc:  # noqa: BLE001
            logger.warning("[enrich] 成分 %s 原料库匹配失败（跳过富化）: %s", name, exc)
            mat = None
        if mat is not None:
            ing = {
                **ing,
                "platform_data": {
                    "matched_name": mat.name_cn,
                    "food_homology": bool(getattr(mat, "food_homology", False)),
                    "safe_dose_range": {
                        "min_g": getattr(mat, "safe_dose_min", None),
                        "max_g": getattr(mat, "safe_dose_max", None),
                    },
                    "effects": list(getattr(mat, "effects", None) or []),
                    "active_ingredients": list(getattr(mat, "active_ingredients", None) or []),
                    "contraindications": list(getattr(mat, "contraindications", None) or []),
                    "toxicity_class": getattr(mat, "toxicity_class", None),
                    "source": "平台原料库",
                },
            }
        enriched_ingredients.append(ing)
    return {**composition, "ingredients": enriched_ingredients}

router = APIRouter(prefix="/formulas", tags=["配方管理"])
logger = logging.getLogger(__name__)


async def _get_formula_with_ingredients(db: AsyncSession, formula_id: int):
    """按 ID 加载配方并 eager-load ingredients 关系。

    db.get() 返回的 ORM 对象不会加载懒加载关系，在 async 上下文中访问
    formula.ingredients 会触发 MissingGreenlet（greenlet_spawn has not been
    called）。分析/优化类端点统一用本辅助函数加载。
    """
    result = await db.execute(
        select(Formula)
        .options(selectinload(Formula.ingredients))
        .where(Formula.id == formula_id)
    )
    return result.scalar_one_or_none()


def _serialize_formula_response(result) -> dict:
    """将 Formula ORM 对象（须已加载 ingredients/peptides/creator/reviewer）序列化为
    FormulaResponse 兼容 dict。与 get_formula 一致：Pydantic 无法直接转换 Ingredient/Peptide
    ORM 对象为 dict，须逐列提取，否则触发 ResponseValidationError / 懒加载 MissingGreenlet。"""
    def _to_dict(obj):
        return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}

    ingredients = [_to_dict(i) for i in (result.ingredients or [])]
    peptides = [_to_dict(p) for p in (result.peptides or [])]
    status_val = result.status.value if hasattr(result.status, 'value') else str(result.status)
    return {
        "id": result.id,
        "code": result.code,
        "name": result.name,
        "description": result.description,
        "status": status_val,
        "version": result.version,
        "creator_id": result.creator_id,
        "creator_name": result.creator.username if result.creator else None,
        "reviewer_id": result.reviewer_id,
        "reviewed_at": result.reviewed_at.isoformat() if result.reviewed_at else None,
        "review_notes": result.review_notes,
        "safety_check": result.safety_check,
        "compliance_status": result.compliance_status,
        "ai_recommendations": result.ai_recommendations,
        "synergy_analysis": result.synergy_analysis,
        "ingredients": ingredients,
        "peptides": peptides,
        "created_at": result.created_at.isoformat() if result.created_at else None,
        "updated_at": result.updated_at.isoformat() if result.updated_at else None,
        "target_effects": result.target_effects,
        "composition": result.composition,
        "processing_method": result.processing_method,
        "dosage": result.dosage,
        "storage_conditions": result.storage_conditions,
        "shelf_life": result.shelf_life,
    }


async def _resolve_effective_org_id(
    tenant_org_id: Optional[int],
    current_user: Optional["User"],
    db: AsyncSession,
) -> Optional[int]:
    """解析当前请求的有效组织 ID（租户隔离核心）。

    优先级：
    1. tenant_org_id —— TenantMiddleware 从 JWT（Bearer 或 Cookie）解析出的 org_id
       （组织绑定用户，JWT 携带 org_id 声明）。
    2. current_user.organization_id —— 用户默认组织（users.organization_id）。
    3. organization_members 首个 active 组织 —— 本地库用户的真实组织关系
       （当前库中 9 个用户 organization_id 均为 NULL，真实关系在此表）。

    返回 None 表示匿名或无有效组织，调用方应拒绝访问（维持 P0 隔离）。
    """
    if tenant_org_id is not None:
        return tenant_org_id
    if current_user is None:
        return None
    if current_user.organization_id:
        return current_user.organization_id
    from sqlalchemy import text as _text
    row = (await db.execute(
        _text("SELECT organization_id FROM organization_members WHERE user_id = :uid AND is_active = TRUE ORDER BY id LIMIT 1"),
        {"uid": current_user.id},
    )).fetchone()
    return row.organization_id if row else None


async def _require_formula_access(
    tenant_org_id: Optional[int],
    current_user: Optional["User"],
    db: AsyncSession,
) -> int:
    """配方访问权限开关：解析有效组织，并执行组织级权限校验。

    P0 租户隔离：无有效组织（匿名/无组织成员）时拒绝，防止绕过
    organization_id 过滤列出全平台配方（跨租户泄漏）。

    返回有效 org_id（int），供调用方用于 organization_id 过滤，
    避免把 None 透传给 service 导致"不过滤组织"的 P0 泄漏。
    """
    org_id = await _resolve_effective_org_id(tenant_org_id, current_user, db)
    if org_id is None:
        raise HTTPException(status_code=403, detail="缺少租户上下文，禁止跨组织访问配方")
    if current_user is None:
        # org 已由 token 解析（org 绑定用户），无用户对象仍允许（保持原语义，
        # 不做组织权限开关校验），但返回有效 org_id 供过滤。
        return org_id
    from ..core.multi_tenant.multi_tenant_service import get_org_service
    svc = get_org_service(db)
    # 自定义角色授权（additive）：拥有 formula:read 的成员可访问
    if await svc.member_has_custom_permission(org_id, current_user.id, "formula", "read"):
        return org_id
    if not await svc.check_org_permission(org_id, current_user.id, "formula_access"):
        raise HTTPException(status_code=403, detail="该组织已关闭「配方访问」权限，仅所有者可操作")
    return org_id


@router.get("", summary="获取配方列表")
async def list_formulas(
    tenant: TenantContext = Depends(require_tenant),
    pagination: PaginationParams = Depends(),
    filters: FormulaFilterParams = Depends(),
    current_user: Optional[User] = Depends(_optional_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """分页获取配方列表，支持状态筛选和关键词搜索"""
    # 解析并校验有效组织（匿名/无组织成员 → 403；不再把 None 传给 service，
    # 避免 organization_id=None 时不过滤组织造成 P0 跨租户泄漏）
    org_id = await _require_formula_access(tenant.org_id, current_user, db)
    service = FormulaService(db)
    formulas, total = await service.list_formulas(
        page=pagination.page,
        page_size=pagination.page_size,
        status=FormulaStatus(filters.status) if filters.status else None,
        creator_id=filters.creator_id,
        search=filters.search,
        organization_id=org_id,
    )
    from ..schemas.formula import IngredientResponse as _IngResp, PeptideResponse as _PepResp
    formula_responses = []
    for f in formulas:
        ing_data = []
        for ing in f.ingredients:
            ing_data.append({
                "id": ing.id,
                "name": ing.name,
                "name_cn": ing.name_cn,
                "category": ing.category,
                "source": ing.source,
                "is_food_homology": ing.is_food_homology if ing.is_food_homology is not None else False,
                "properties": ing.properties,
            })
        pep_data = []
        for p in f.peptides:
            pep_data.append({
                "id": p.id,
                "sequence": p.sequence,
                "source_protein": p.source_protein,
                "source_organism": p.source_organism,
                "activity_type": p.activity_type,
                "activity_value": p.activity_value,
                "activity_unit": p.activity_unit,
                "molecular_weight": p.molecular_weight,
            })
        formula_responses.append({
            "id": f.id,
            "code": f.code,
            "status": f.status.value if hasattr(f.status, "value") else str(f.status),
            "version": f.version,
            "creator_id": f.creator_id,
            "creator_name": f.creator.username if f.creator else None,
            "reviewer_id": f.reviewer_id,
            "reviewed_at": f.reviewed_at.isoformat() if f.reviewed_at else None,
            "review_notes": f.review_notes,
            "safety_check": f.safety_check,
            "compliance_status": f.compliance_status,
            "ai_recommendations": f.ai_recommendations,
            "synergy_analysis": f.synergy_analysis,
            "created_at": f.created_at.isoformat() if f.created_at else None,
            "updated_at": f.updated_at.isoformat() if f.updated_at else None,
            "name": f.name,
            "description": f.description,
            "target_effects": f.target_effects,
            "composition": f.composition,
            "processing_method": f.processing_method,
            "dosage": f.dosage,
            "storage_conditions": f.storage_conditions,
            "shelf_life": f.shelf_life,
            "ingredients": ing_data,
            "peptides": pep_data,
        })
    return {
        "items": formula_responses,
        "total": total,
        "page": pagination.page,
        "page_size": pagination.page_size,
    }


@router.get("/recommendations", response_model=AIRecommendationResponse, summary="AI 配方推荐")
async def get_recommendations(
    data: AIRecommendationRequest,
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """基于目标功效获取 AI 成分推荐"""
    service = FormulaService(db)
    recommendations = await service.get_ai_recommendations(
        target_effects=data.target_effects,
        preferred_categories=data.preferred_categories,
        max_results=data.max_results,
    )
    return AIRecommendationResponse(
        recommendations=recommendations,
        total=len(recommendations),
    )


@router.get("/statistics", summary="配方统计数据")
async def get_formula_statistics(
    tenant: TenantContext = Depends(require_tenant),
    current_user: Optional[User] = Depends(_optional_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """返回配方统计数据（总数、状态分布）— 认证成员按组织过滤。

    有效组织解析（Cookie 认证兼容）：解析出 org_id 时按组织过滤统计；
    未解析（匿名/无组织成员）时返回 403，避免全局聚合计数泄漏
    （原实现回退全局计数，仅暴露数字，现与 list_formulas 的 403 语义对齐）。
    统计口径与默认列表一致：排除已归档（软删除 status=ARCHIVED），
    使 total_formulas 与列表 total 匹配，避免前端计数卡片与列表行数不一致。
    """
    from sqlalchemy import func, select as sa_select
    from datetime import datetime, timedelta, timezone
    from ..models.formula import Formula
    from ..models.user_model import User

    org_id = await _resolve_effective_org_id(tenant.org_id, current_user, db)
    if org_id is None:
        raise HTTPException(status_code=403, detail="缺少租户上下文，禁止访问配方统计")

    # 与默认列表口径一致：排除已归档（软删除 status=ARCHIVED），使 total_formulas 匹配列表 total。
    query = sa_select(func.count(Formula.id))
    query = query.where(Formula.organization_id == org_id, Formula.status != FormulaStatus.ARCHIVED)
    result = await db.execute(query)
    total = result.scalar() or 0

    status_query = sa_select(Formula.status, func.count(Formula.id)).group_by(Formula.status)
    status_query = status_query.where(Formula.organization_id == org_id, Formula.status != FormulaStatus.ARCHIVED)
    status_result = await db.execute(status_query)
    status_distribution = {}
    for s, c in status_result.all():
        key = s.value if hasattr(s, "value") else str(s)
        status_distribution[key] = c

    # recent creations (last 30 days, daily)
    now = datetime.now()  # 使用 naive datetime 匹配 TIMESTAMP WITHOUT TIME ZONE
    recent_creations = []
    for i in range(30):
        day = now - timedelta(days=29 - i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        cnt_q = sa_select(func.count(Formula.id)).where(
            Formula.created_at >= day_start, Formula.created_at < day_end
        )
        if org_id is not None:
            cnt_q = cnt_q.where(Formula.organization_id == org_id)
        cnt_q = cnt_q.where(Formula.status != FormulaStatus.ARCHIVED)
        cnt = (await db.execute(cnt_q)).scalar() or 0
        recent_creations.append({"date": day_start.strftime("%Y-%m-%d"), "count": int(cnt)})

    # trend: compare last 7 days vs prior 7 days
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)
    trend_q1 = sa_select(func.count(Formula.id)).where(
        Formula.created_at >= week_ago, Formula.created_at < now
    )
    trend_q2 = sa_select(func.count(Formula.id)).where(
        Formula.created_at >= two_weeks_ago, Formula.created_at < week_ago
    )
    if org_id is not None:
        trend_q1 = trend_q1.where(Formula.organization_id == org_id)
        trend_q2 = trend_q2.where(Formula.organization_id == org_id)
    trend_q1 = trend_q1.where(Formula.status != FormulaStatus.ARCHIVED)
    trend_q2 = trend_q2.where(Formula.status != FormulaStatus.ARCHIVED)
    created_now = (await db.execute(trend_q1)).scalar() or 0
    created_prev = (await db.execute(trend_q2)).scalar() or 0
    trend_data = [{"period": "last7d", "created": int(created_now), "updated": 0, "deleted": 0},
                  {"period": "prev7d", "created": int(created_prev), "updated": 0, "deleted": 0}]

    return {
        "total_formulas": int(total),
        "status_distribution": {k: int(v) for k, v in status_distribution.items()},
        "recent_creations": recent_creations,
        "trend_data": trend_data,
    }


@router.get("/{formula_id:int}", response_model=FormulaResponse, summary="获取配方详情")
async def get_formula(
    formula_id: int,
    tenant: TenantContext = Depends(require_tenant),
    current_user: Optional[User] = Depends(_optional_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取配方详情（含成分和肽段列表）"""
    # 解析有效组织：匿名/无组织成员 → 404（不泄露存在性），并拒绝访问
    # organization_id=None 的全局配方，维持 P0 租户隔离。
    org_id = await _resolve_effective_org_id(tenant.org_id, current_user, db)
    if org_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="配方不存在")
    service = FormulaService(db)
    result = await service.get_formula(formula_id)
    # 验证所属组织
    if result.organization_id is not None and result.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="配方不存在",
        )
    # 将 ORM 对象序列化为 dict（复用共享序列化助手，避免 Pydantic 无法转换 ORM 对象）
    return _serialize_formula_response(result)


@router.post("", response_model=FormulaResponse, status_code=201, summary="创建配方")
async def create_formula(
    data: FormulaCreate,
    _quota: None = Depends(require_quota(QuotaType.FORMULAS)),
    tenant: TenantContext = Depends(require_tenant),
    current_user: User = Depends(require_role(UserRole.RESEARCHER, UserRole.FORMULATOR)),
    db: AsyncSession = Depends(get_db_session),
):
    """创建新配方（草稿状态）"""
    # 组织权限开关：配方访问（返回有效 org_id，匿名/无组织成员 → 403）
    org_id = await _require_formula_access(tenant.org_id, current_user, db)
    # 组织计划配额拦截：配方数超限时阻止创建
    if org_id:
        from ..core.multi_tenant.multi_tenant_service import get_org_service
        try:
            await get_org_service(db)._check_quota(org_id, "formulas")
        except PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e))

    service = FormulaService(db)

    # 五期：用平台原料库富化成分的 platform_data（药食同源/安全剂量/功效成分/禁忌），
    # 让 AI 对话等入口保存的配方成分可溯源到平台真实数据。
    try:
        enriched_composition = await _enrich_ingredients_with_food_material(db, data.composition)
        if enriched_composition != (data.composition or {}):
            data = data.model_copy(update={"composition": enriched_composition})
    except Exception as exc:  # noqa: BLE001
        logger.warning("配方成分原料库富化失败（跳过，不影响保存）: %s", exc)

    return await service.create_formula(data, creator_id=current_user.id, organization_id=org_id)


@router.put("/{formula_id}", response_model=FormulaResponse, summary="更新配方")
async def update_formula(
    formula_id: int,
    data: FormulaUpdate,
    tenant: TenantContext = Depends(require_tenant),
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """更新配方（仅草稿和已驳回状态可编辑，需拥有资源权限）"""
    service = FormulaService(db)
    # 所有权校验 + 租户隔离
    # 解析有效组织：无组织成员 → 404（维持 P0 隔离，拒绝访问全局配方）
    org_id = await _resolve_effective_org_id(tenant.org_id, current_user, db)
    if org_id is None:
        raise HTTPException(status_code=404, detail="配方不存在")
    formula = await service.get_formula(formula_id)
    if formula.organization_id is not None and formula.organization_id != org_id:
        raise HTTPException(status_code=404, detail="配方不存在")
    is_owner = formula.creator_id == current_user.id
    is_admin = current_user.role in (UserRole.ADMIN, UserRole.FORMULATOR)
    if not is_owner and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权编辑此配方，仅创建者或配方师/管理员可编辑",
        )
    return await service.update_formula(formula_id, data, user_id=current_user.id)


@router.delete("/{formula_id}", response_model=SuccessResponse, summary="删除配方")
async def delete_formula(
    formula_id: int,
    tenant: TenantContext = Depends(require_tenant),
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """删除配方（软删除，归档处理）"""
    service = FormulaService(db)
    # 租户隔离验证
    # 解析有效组织：无组织成员 → 404（维持 P0 隔离，拒绝访问全局配方）
    org_id = await _resolve_effective_org_id(tenant.org_id, current_user, db)
    if org_id is None:
        raise HTTPException(status_code=404, detail="配方不存在")
    formula = await service.get_formula(formula_id)
    if formula.organization_id is not None and formula.organization_id != org_id:
        raise HTTPException(status_code=404, detail="配方不存在")
    await service.delete_formula(formula_id, user_id=current_user.id)
    return SuccessResponse(message="配方已归档删除")


# ── 版本管理 ──

@router.get("/{formula_id}/versions", response_model=list[FormulaVersionResponse], summary="版本历史")
async def get_version_history(
    formula_id: int,
    current_user: Optional[User] = Depends(_optional_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取配方版本历史"""
    service = FormulaService(db)
    return await service.get_version_history(formula_id)


@router.post("/{formula_id}/versions", response_model=FormulaVersionResponse, summary="创建新版本")
async def create_version(
    formula_id: int,
    change_summary: str = Query(..., description="变更说明"),
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """创建配方新版本快照"""
    service = FormulaService(db)
    return await service.create_version(formula_id, change_summary, current_user.id)


@router.post("/{formula_id}/versions/{version}/restore", response_model=FormulaResponse, summary="恢复版本")
async def restore_version(
    formula_id: int,
    version: int,
    current_user: User = Depends(require_role(UserRole.FORMULATOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
):
    """恢复到指定版本"""
    service = FormulaService(db)
    return await service.restore_version(formula_id, version, current_user.id)


# ── 审核流程 ──

@router.post("/{formula_id}/submit", response_model=FormulaResponse, summary="提交审核")
async def submit_for_review(
    formula_id: int,
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """提交配方进行审核"""
    service = FormulaService(db)
    return await service.submit_for_review(formula_id, current_user.id)


@router.post("/{formula_id}/review", response_model=FormulaResponse, summary="审核配方")
async def review_formula(
    formula_id: int,
    review: FormulaReviewRequest,
    current_user: User = Depends(require_role(UserRole.REVIEWER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
):
    """审核配方（审核员/管理员）"""
    service = FormulaService(db)
    return await service.review_formula(formula_id, review, current_user.id)


@router.post("/{formula_id}/publish", response_model=FormulaResponse, summary="发布配方")
async def publish_formula(
    formula_id: int,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
):
    """发布配方（仅管理员）"""
    service = FormulaService(db)
    return await service.publish_formula(formula_id, current_user.id)


@router.post("/{formula_id}/archive", response_model=FormulaResponse, summary="归档配方")
async def archive_formula(
    formula_id: int,
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """归档配方"""
    service = FormulaService(db)
    return await service.archive_formula(formula_id, current_user.id)


@router.patch("/batch-status", response_model=SuccessResponse, summary="批量更新配方状态")
async def batch_update_status(
    request: BatchStatusUpdateRequest,
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """批量更新配方状态（带 Pydantic Schema 校验）"""
    service = FormulaService(db)
    updated = await service.batch_update_status(request.ids, request.status, current_user.id)
    return SuccessResponse(
        message=f"成功更新 {updated} 个配方的状态",
        data={"updated": updated},
    )


# ── 配方成分计算 ──

@router.get("/{formula_id}/nutrition", summary="获取配方营养成分")
async def get_formula_nutrition(
    formula_id: int,
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """计算并返回配方的营养成分摘要（热量、宏量营养素、过敏原等）"""
    from ..models.formula import Formula
    from ..services.formula.nutrition_service import FormulaNutritionService

    result = await _get_formula_with_ingredients(db, formula_id)
    if not result:
        raise HTTPException(status_code=404, detail="配方不存在")

    # 获取配方成分及其用量
    ingredients_data = []
    for ing in result.ingredients:
        weight_g = ing.properties.get("weight_g", 0) if ing.properties else 0
        ingredients_data.append({
            "ingredient_id": ing.id,
            "name": ing.name,
            "weight_g": weight_g,
            "category": ing.category,
        })

    # 计算总重量
    total_weight = sum(d["weight_g"] for d in ingredients_data)
    if total_weight <= 0:
        return {
            "formula_id": formula_id,
            "total_weight_g": 0,
            "nutrition_per_100g": {},
            "total_nutrition": {},
            "allergens": [],
            "warnings": ["配方成分总重量为 0，无法计算营养成分"],
        }

    # 使用营养服务计算
    try:
        service = FormulaNutritionService()
        nutrition = service.calculate(ingredients_data, total_weight)
    except Exception as exc:  # noqa: BLE001
        logger.exception("配方营养成分计算失败 formula_id=%s", formula_id)
        return {
            "formula_id": formula_id,
            "total_weight_g": round(total_weight, 2),
            "nutrition_per_100g": {},
            "total_nutrition": {},
            "calories_per_100g": 0,
            "total_calories": 0,
            "allergens": [],
            "compliance": {},
            "warnings": [f"营养成分计算暂时不可用: {exc}"],
            "known_ingredients": 0,
            "unknown_ingredients": len(ingredients_data),
        }

    return {
        "formula_id": formula_id,
        "total_weight_g": round(total_weight, 2),
        "nutrition_per_100g": nutrition.get("per_100g", {}),
        "total_nutrition": nutrition.get("total", {}),
        "calories_per_100g": nutrition.get("calories_per_100g", 0),
        "total_calories": nutrition.get("total_calories", 0),
        "allergens": nutrition.get("allergens", []),
        "compliance": nutrition.get("compliance", {}),
        "known_ingredients": nutrition.get("known_ingredients", 0),
        "unknown_ingredients": nutrition.get("unknown_ingredients", 0),
        "warnings": nutrition.get("warnings", []),
    }


@router.post("/{formula_id}/nutrition/validate", summary="校验配方成分总量")
async def validate_formula_nutrition(
    formula_id: int,
    tolerance_pct: float = Query(5.0, ge=0.1, le=20.0, description="允许偏差百分比"),
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """校验配方成分总重量是否为 100%"""
    from ..models.formula import Formula
    from ..services.formula.nutrition_service import FormulaNutritionService

    result = await _get_formula_with_ingredients(db, formula_id)
    if not result:
        raise HTTPException(status_code=404, detail="配方不存在")

    ingredients_data = []
    total_weight = 0
    for ing in result.ingredients:
        weight_g = ing.properties.get("weight_g", 0) if ing.properties else 0
        total_weight += weight_g
        ingredients_data.append({
            "name": ing.name,
            "weight_g": weight_g,
            "total_weight_g": total_weight,
        })

    service = FormulaNutritionService()
    validation = service.validate_total_weight(ingredients_data, tolerance_pct)

    return {
        "formula_id": formula_id,
        "total_weight_g": round(total_weight, 2),
        "validation": validation,
    }


# ── LP 配比优化 ──

@router.post("/{formula_id}/optimize/lp", summary="MILP 配比优化")
async def optimize_formula_lp(
    formula_id: int,
    total_dosage_g: float = Query(100.0, gt=0, description="总剂量(g)"),
    max_cost: Optional[float] = Query(None, description="最大成本预算(元)，不限制传 null"),
    tenant: TenantContext = Depends(require_tenant),
    current_user: User = Depends(require_plan("ai_formula_generation")),
    db: AsyncSession = Depends(get_db_session),
):
    """使用 MILP 对配方成分进行精确配比优化，最小化成本并满足营养约束"""
    from ..models.formula import Formula
    from ..services.formula.lp_solver import MILPSolver, HerbNutritionData, NutritionConstraint
    from ..services.formula.nutrition_database import HERB_NUTRITION_DB

    # 验证配方存在及租户归属（有效组织解析，兼容 Cookie 认证/org_id=NULL）
    org_id = await _resolve_effective_org_id(tenant.org_id, current_user, db)
    formula = await _get_formula_with_ingredients(db, formula_id)
    if not formula:
        raise HTTPException(status_code=404, detail="配方不存在")
    if org_id is None or (formula.organization_id is not None and formula.organization_id != org_id):
        raise HTTPException(status_code=403, detail="无权访问此配方的优化功能")

    # 提取成分名称
    ingredient_names = [ing.name for ing in formula.ingredients]
    if not ingredient_names:
        return {
            "formula_id": formula_id,
            "formula_name": formula.name,
            "feasible": False,
            "message": "配方无成分数据，无法进行 LP 优化",
        }

    # 构建 MILP 求解器所需的药材营养数据
    herb_data: Dict[str, HerbNutritionData] = {}
    for name in ingredient_names:
        nutrition = HERB_NUTRITION_DB.get(name, {})
        ing = next((i for i in formula.ingredients if i.name == name), None)
        ing_props = (ing.properties or {}) if ing else {}
        herb_data[name] = HerbNutritionData(
            herb_id=name,
            name_cn=name,
            cost_per_gram=ing_props.get("cost_per_gram", 0.5),
            nutrition_per_100g=nutrition,
            dosage_min=ing_props.get("dosage_min", 1.0),
            dosage_max=ing_props.get("dosage_max", 50.0),
            dosage_step=ing_props.get("dosage_step", 1.0),
        )

    # 构建营养约束
    nutrition_constraints: list[NutritionConstraint] = [
        NutritionConstraint(nutrient="protein", min_value=5.0, max_value=40.0),
        NutritionConstraint(nutrient="fat", min_value=0.5, max_value=30.0),
        NutritionConstraint(nutrient="carbohydrate", min_value=20.0, max_value=80.0),
        NutritionConstraint(nutrient="sodium", max_value=20.0),
    ]

    solver = MILPSolver(herb_data, nutrition_constraints)
    additional_constraints = {}
    if max_cost is not None and max_cost > 0:
        additional_constraints["max_cost"] = max_cost

    result = solver.solve(
        selected_herbs=ingredient_names,
        total_dosage=total_dosage_g,
        additional_constraints=additional_constraints,
    )

    # 组装返回数据
    ratios_list = [
        {
            "ingredient": hid,
            "dosage_g": dose,
            "percentage": round(dose / total_dosage_g * 100, 2) if total_dosage_g > 0 else 0,
        }
        for hid, dose in result.ratios.items()
    ]

    return {
        "formula_id": formula_id,
        "formula_name": formula.name,
        "total_dosage_g": total_dosage_g,
        "feasible": result.feasible,
        "min_cost": round(result.min_cost, 2),
        "ratios": ratios_list,
        "nutrition_matrix": result.nutrition_matrix,
        "violation": result.violation if result.violation else {},
        "solve_time_ms": result.solve_time_ms,
    }


# ── 配方深度分析 ──

@router.post("/{formula_id}/synergy/analyze", summary="分析配方协同效应")
async def analyze_formula_synergy(
    formula_id: int,
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    from ..models.formula import Formula
    from ..services.formula.synergy_engine import SynergyEngine

    formula = await _get_formula_with_ingredients(db, formula_id)
    if not formula:
        raise HTTPException(status_code=404, detail="配方不存在")

    ingredient_names = [ing.name for ing in formula.ingredients]
    if len(ingredient_names) < 2:
        return {"formula_id": formula_id, "overall_si": None, "pairs": [], "message": "成分不足 2 个"}

    engine = SynergyEngine()
    pairs_results = []
    for i in range(len(ingredient_names)):
        for j in range(i + 1, len(ingredient_names)):
            a, b = ingredient_names[i], ingredient_names[j]
            try:
                report = engine.analyze_synergy(a, b)
                pairs_results.append({
                    "pair": f"{a} + {b}",
                    "overall_si": report.overall_si,
                    "dominant_mechanism": report.dominant_mechanism.value if report.dominant_mechanism else None,
                })
            except Exception as e:
                pairs_results.append({"pair": f"{a} + {b}", "error": str(e)})

    valid_si = [r["overall_si"] for r in pairs_results if r.get("overall_si") is not None]
    overall_si = sum(valid_si) / len(valid_si) if valid_si else None

    return {
        "formula_id": formula_id,
        "formula_name": formula.name,
        "ingredient_count": len(ingredient_names),
        "overall_si": round(overall_si, 4) if overall_si else None,
        "pairs": pairs_results,
    }


@router.post("/{formula_id}/stability/predict", summary="预测配方稳定性")
async def predict_formula_stability(
    formula_id: int,
    temperature_c: float = Query(25.0),
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    from ..models.formula import Formula
    from ..services.formula.stability_predictor import StabilityPredictor

    formula = await _get_formula_with_ingredients(db, formula_id)
    if not formula:
        raise HTTPException(status_code=404, detail="配方不存在")

    ingredient_names = [ing.name for ing in formula.ingredients]
    if not ingredient_names:
        return {"formula_id": formula_id, "message": "配方无成分数据"}

    predictor = StabilityPredictor()
    n = len(ingredient_names)
    # 从 stability_data 表加载真实稳定性参数
    db_entries = {}
    try:
        from ..models.herb_pharmaco_params import StabilityData
        result = await db.execute(select(StabilityData).where(StabilityData.herb_name_cn.in_(ingredient_names)))
        for row in result.scalars().all():
            db_entries[row.herb_name_cn] = {
                "ph_stability": {"min": 4.0, "max": 9.0, "optimal": [5.0, 8.0]},
                "temp_stability": {"max_temp_c": 80, "degradation_rate_25c": float(row.degradation_rate or 0.001)},
                "light_sensitivity": "medium",
                "oxidation_sensitivity": "medium",
                "shelf_life_months": float(row.shelf_life_months or 24.0),
                "source": row.source,
                "confidence": row.confidence,
            }
    except Exception:
        db_entries = {}

    pred = predictor.predict_stability(
        [{"name": name, "percentage": round(100.0 / n, 2)} for name in ingredient_names],
        storage_conditions={"temperature_c": temperature_c, "humidity_pct": 60, "light_exposure": "normal"},
        db_entries=db_entries,
    )

    return {
        "formula_id": formula_id,
        "formula_name": formula.name,
        "predicted_shelf_life_months": round(pred.predicted_shelf_life_months, 1),
        "stability_score": round(pred.stability_score, 1),
        "risk_factors": pred.risk_factors,
        "storage_recommendations": pred.storage_recommendations,
    }


@router.post("/{formula_id}/taste/predict", summary="预测配方风味")
async def predict_formula_taste(
    formula_id: int,
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    from ..models.formula import Formula
    from ..services.formula.taste_predictor import TastePredictor

    formula = await _get_formula_with_ingredients(db, formula_id)
    if not formula:
        raise HTTPException(status_code=404, detail="配方不存在")

    ingredient_names = [ing.name for ing in formula.ingredients]
    if not ingredient_names:
        return {"formula_id": formula_id, "message": "配方无成分数据"}

    predictor = TastePredictor()
    n = len(ingredient_names)
    ingredients_data = [{"name": name, "percentage": round(100.0 / n, 2)} for name in ingredient_names]
    taste_profile = predictor.predict_taste(ingredients_data)

    return {
        "formula_id": formula_id,
        "formula_name": formula.name,
        "taste_profile": {
            "bitter": round(taste_profile.bitter, 3),
            "sweet": round(taste_profile.sweet, 3),
            "umami": round(taste_profile.umami, 3),
            "astringent": round(taste_profile.astringent, 3),
            "sour": round(taste_profile.sour, 3),
        },
        "balance_score": round(taste_profile.balance_score, 3),
        "acceptability": round(taste_profile.acceptability, 3),
    }


@router.post("/{formula_id}/safety/check", summary="检查配方安全性")
async def check_formula_safety(
    formula_id: int,
    daily_dosage_g: float = Query(10.0),
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    from ..models.formula import Formula
    from ..services.formula.safety_alert_system import SafetyAlertSystem

    formula = await _get_formula_with_ingredients(db, formula_id)
    if not formula:
        raise HTTPException(status_code=404, detail="配方不存在")

    ingredients_data = [{"name": ing.name, "amount_g": (ing.properties or {}).get("weight_g", 0)} for ing in formula.ingredients]

    system = SafetyAlertSystem()
    result = system.check_formula_safety(
        ingredients=ingredients_data,
        daily_dosage_g=daily_dosage_g,
        target_group="adult",
    )

    return {
        "formula_id": formula_id,
        "formula_name": formula.name,
        "is_safe": result.is_safe,
        "overall_risk_score": round(result.overall_risk_score, 1),
        "alerts": [a.to_dict() for a in result.alerts],
        "recommendations": result.recommendations or [],
    }


@router.post("/{formula_id}/compatibility/check", summary="检查配方兼容性")
async def check_formula_compatibility(
    formula_id: int,
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    from ..models.formula import Formula
    from ..services.formula.compatibility_checker import CompatibilityChecker

    formula = await _get_formula_with_ingredients(db, formula_id)
    if not formula:
        raise HTTPException(status_code=404, detail="配方不存在")

    checker = CompatibilityChecker()
    ingredients_data = [{"name": ing.name, "amount_mg": ((ing.properties or {}).get("weight_g", 0) or 0) * 1000} for ing in formula.ingredients]

    report = checker.check_compatibility(
        ingredients=ingredients_data,
        formula_id=str(formula_id),
        target_population="adult",
    )

    return {
        "formula_id": formula_id,
        "formula_name": formula.name,
        "overall_score": report.overall_score,
        "total_checks": report.total_checks,
        "passed_checks": report.passed_checks,
        "error_count": report.error_count,
        "warning_count": report.warning_count,
        "issues": [{"level": i.level.value, "description": i.description} for i in report.issues],
    }


@router.post("/{formula_id}/effect/predict", summary="预测配方效果曲线")
async def predict_formula_effect(
    formula_id: int,
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    from ..models.formula import Formula
    from ..services.formula.effect_simulator import EffectSimulator

    formula = await _get_formula_with_ingredients(db, formula_id)
    if not formula:
        raise HTTPException(status_code=404, detail="配方不存在")

    simulator = EffectSimulator()
    total_weight = sum((ing.properties or {}).get("weight_g", 0) for ing in formula.ingredients) or 1

    formula_ingredients = [
        {
            "name": ing.name,
            "amount_mg": round(((ing.properties or {}).get("weight_g", 0) / total_weight) * 1000),
            "percentage": round(((ing.properties or {}).get("weight_g", 0) / total_weight) * 100, 2),
        }
        for ing in formula.ingredients
    ]

    prediction = simulator.predict_effect(formula_ingredients=formula_ingredients, body_weight_kg=70, simulation_hours=24)

    return {
        "formula_id": formula_id,
        "peak_time": round(prediction.peak_time, 2),
        "peak_concentration": round(prediction.peak_concentration, 2),
        "max_effect": round(prediction.max_effect, 4),
        "effect_duration": round(prediction.effect_duration, 2),
        "auc": round(prediction.auc, 2),
    }

# ── 配方模板 CRUD（管理员）──

@router.get("/templates", response_model=dict, summary="获取配方模板列表")
async def list_formula_templates(
    category: Optional[str] = None,
    include_inactive: bool = False,
    current_user: Optional[User] = Depends(_optional_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取配方模板列表（默认仅返回激活模板，可按分类筛选）"""
    from ..models.formula_template import FormulaTemplate

    query = select(FormulaTemplate)
    if not include_inactive:
        query = query.where(FormulaTemplate.is_active.is_(True))
    if category:
        query = query.where(FormulaTemplate.category == category)
    query = query.order_by(FormulaTemplate.is_featured.desc(), FormulaTemplate.usage_count.desc())

    result = await db.execute(query)
    templates = result.scalars().all()
    return {
        "items": [t.to_dict() for t in templates],
        "total": len(templates),
    }

@router.post("/templates", response_model=dict, summary="创建配方模板")
async def create_formula_template(
    request: dict = Body(...),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.FORMULATOR)),
    db: AsyncSession = Depends(get_db_session),
):
    """创建新配方模板"""
    from ..models.formula_template import FormulaTemplate

    code = request.get("code", "").strip()
    name = request.get("name", "").strip()
    if not code or not name:
        raise HTTPException(status_code=400, detail="code 和 name 不能为空")

    existing = await db.execute(
        select(FormulaTemplate).where(FormulaTemplate.code == code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="模板 code 已存在")

    template = FormulaTemplate(
        code=code,
        name=name,
        description=request.get("description"),
        category=request.get("category"),
        target_effects=request.get("effects", []),
        usage_count=0,
        is_featured=request.get("is_featured", False),
        created_by=current_user.id,
    )
    db.add(template)
    await db.flush()
    return template.to_dict()


@router.put("/templates/{template_code}", response_model=dict, summary="更新配方模板")
async def update_formula_template(
    template_code: str,
    request: dict = Body(...),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.FORMULATOR)),
    db: AsyncSession = Depends(get_db_session),
):
    """更新配方模板（仅管理员/配方师）"""
    from ..models.formula_template import FormulaTemplate

    result = await db.execute(
        select(FormulaTemplate).where(FormulaTemplate.code == template_code)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")

    for field in ["name", "description", "category", "effects", "is_featured"]:
        if field in request:
            if field == "effects":
                template.target_effects = request[field]
            else:
                setattr(template, field, request[field])

    await db.flush()
    return template.to_dict()


@router.delete("/templates/{template_code}", response_model=SuccessResponse, summary="删除配方模板")
async def delete_formula_template(
    template_code: str,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
):
    """删除配方模板（仅管理员）"""
    from ..models.formula_template import FormulaTemplate

    result = await db.execute(
        select(FormulaTemplate).where(FormulaTemplate.code == template_code)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")

    template.is_active = False
    await db.flush()
    return SuccessResponse(message=f"模板 {template_code} 已删除")


# ── 配方复制 ──

@router.post("/{formula_id}/copy", response_model=FormulaResponse, summary="复制配方")
async def copy_formula(
    formula_id: int,
    tenant: TenantContext = Depends(require_tenant),
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """基于现有配方创建新配方（草稿状态）"""
    from ..models.formula import Formula, Ingredient, Peptide, formula_ingredients, formula_peptides
    from ..services.formula import FormulaService
    from sqlalchemy import select as sa_select

    # 解析有效组织（Cookie 认证兼容）：无有效组织 → 403 拒绝复制
    org_id = await _resolve_effective_org_id(tenant.org_id, current_user, db)
    if org_id is None:
        raise HTTPException(status_code=403, detail="缺少租户上下文，禁止复制配方")

    source = await _get_formula_with_ingredients(db, formula_id)
    if not source:
        raise HTTPException(status_code=404, detail="源配方不存在")
    # 源配方归属校验：organization_id=None 的全局配方不暴露（P0 隔离）
    if source.organization_id is not None and source.organization_id != org_id:
        raise HTTPException(status_code=404, detail="源配方不存在")

    # 生成新配方（code 为 NOT NULL 唯一字段，须显式生成，与导入/创建一致）
    from datetime import datetime as _dt
    import uuid as _uuid
    new_formula = Formula(
        code=f"RMF-{_dt.now().strftime('%Y%m%d')}-{str(_uuid.uuid4())[:6].upper()}",
        name=f"{source.name} (副本)",
        description=source.description,
        status=FormulaStatus.DRAFT,
        version=1,
        target_effects=source.target_effects.copy() if source.target_effects else [],
        composition=source.composition.copy() if source.composition else {},
        processing_method=source.processing_method,
        dosage=source.dosage,
        storage_conditions=source.storage_conditions,
        shelf_life=source.shelf_life,
        creator_id=current_user.id,
        organization_id=org_id,
    )
    db.add(new_formula)
    await db.flush()

    # 复制成分关联
    ing_result = await db.execute(
        sa_select(formula_ingredients.c.ingredient_id)
        .where(formula_ingredients.c.formula_id == formula_id)
    )
    ingredient_ids = [row[0] for row in ing_result.all()]
    if ingredient_ids:
        await db.execute(
            formula_ingredients.insert(),
            [{"formula_id": new_formula.id, "ingredient_id": iid} for iid in ingredient_ids]
        )

    # 复制肽段关联
    pep_result = await db.execute(
        sa_select(formula_peptides.c.peptide_id)
        .where(formula_peptides.c.formula_id == formula_id)
    )
    peptide_ids = [row[0] for row in pep_result.all()]
    if peptide_ids:
        await db.execute(
            formula_peptides.insert(),
            [{"formula_id": new_formula.id, "peptide_id": pid} for pid in peptide_ids]
        )

    await db.commit()
    # 重新加载副本（FormulaService.get_formula eager-loads ingredients/peptides/creator/reviewer），
    # 经共享助手序列化为 FormulaResponse 兼容 dict（避免裸 ORM 对象触发 ResponseValidationError）。
    fresh = await FormulaService(db).get_formula(new_formula.id)
    return _serialize_formula_response(fresh)



@router.post('/optimize/multi-algorithm', summary='Multi-Algorithm Optimization')
async def multi_algorithm_optimize(
    request: dict = Body(...),
    current_user: User = Depends(require_plan("ai_formula_generation")),
    db: AsyncSession = Depends(get_db_session),
):
    from ..services.formula.multi_algorithm_orchestrator import (
        MultiAlgorithmOrchestrator, FusionConfig, AlgorithmType
    )
    ingredients = request.get('ingredients', [])
    if not ingredients:
        raise HTTPException(status_code=400, detail='配料列表不能为空')
    algorithms = request.get('algorithms', [])
    fusion_method = request.get('fusion_method', 'union')
    time_budget = request.get('time_budget', 30.0)
    valid_algorithms = [v.value for v in AlgorithmType]
    if not algorithms:
        algorithms = valid_algorithms
    for algo in algorithms:
        if algo not in valid_algorithms:
            raise HTTPException(status_code=400, detail=f'未知算法类型：{algo}')
    if fusion_method not in ('union', 'weighted', 'voting'):
        raise HTTPException(status_code=400, detail='无效的融合方法')
    config = FusionConfig(algorithms=algorithms, parallel_execution=True, time_budget=time_budget, fusion_method=fusion_method)
    orchestrator = MultiAlgorithmOrchestrator(config)
    result = await orchestrator.optimize(ingredients, request.get('constraints', {}))
    return {
        'success': result.get('success', False),
        'fusion_method': result.get('fusion_method', fusion_method),
        'total_solutions': result.get('total_solutions', 0),
        'computation_time': round(result.get('computation_time', 0), 3),
        'best_solution': result.get('best_solution', None),
        'pareto_frontier': result.get('pareto_frontier', []),
        'algorithms_used': result.get('algorithms_used', len(algorithms)),
        'algorithm_stats': orchestrator.get_algorithm_stats(),
    }


# ── 配方导出 ──

@router.get("/{formula_id}/export", summary="导出配方详情（PDF/Excel）")
async def export_formula(
    formula_id: int,
    format_type: str = Query("pdf", description="导出格式: pdf/excel/csv"),
    current_user: User = Depends(require_plan("advanced_report_export")),
    db: AsyncSession = Depends(get_db_session),
):
    """导出单个配方的详细信息为 PDF 或 Excel"""
    from ..models.formula import Formula

    formula = await _get_formula_with_ingredients(db, formula_id)
    if not formula:
        raise HTTPException(status_code=404, detail="配方不存在")

    if format_type in ("excel", "csv"):
        # 构建导出数据
        export_data = {
            "id": formula.id,
            "code": formula.code,
            "name": formula.name,
            "description": formula.description or "",
            "status": formula.status.value if hasattr(formula.status, "value") else str(formula.status),
            "version": formula.version,
            "target_effects": formula.target_effects or [],
            "dosage": formula.dosage or "",
            "processing_method": formula.processing_method or "",
            "storage_conditions": formula.storage_conditions or "",
            "shelf_life": formula.shelf_life or "",
            "ingredients": [
                {
                    "name": ing.name,
                    "category": ing.category,
                    "is_food_homology": ing.is_food_homology,
                    "properties": ing.properties or {},
                }
                for ing in formula.ingredients
            ],
            "peptides": [
                {
                    "sequence": p.sequence,
                    "source_protein": p.source_protein,
                    "activity_type": p.activity_type,
                }
                for p in formula.peptides
            ],
            "created_at": formula.created_at.isoformat(),
            "updated_at": formula.updated_at.isoformat(),
        }

        if format_type == "csv":
            import csv, io
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=["id", "code", "name", "description", "status", "version"])
            writer.writeheader()
            writer.writerow({k: v for k, v in export_data.items() if k != "ingredients"})
            return Response(
                content=output.getvalue(),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename={formula.code}.csv"},
            )
        else:
            # Excel: 返回 JSON（前端可用 xlsx 库转换）
            return export_data
    else:
        # PDF: 返回结构化数据（前端渲染）
        return {
            **export_data,
            "format": "pdf",
            "generated_at": datetime.now().isoformat(),
        }


# ── 应用优化结果 ──

@router.post("/{formula_id}/optimize/apply", response_model=FormulaResponse, summary="应用配比优化结果")
async def apply_optimization_result(
    formula_id: int,
    request: dict = Body(...),
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """将 MILP 或 RatioOptimizer 的结果应用到配方成分"""
    from ..models.formula import Formula

    formula = await _get_formula_with_ingredients(db, formula_id)
    if not formula:
        raise HTTPException(status_code=404, detail="配方不存在")

    ratios = request.get("ratios", [])
    if not ratios:
        raise HTTPException(status_code=400, detail="请提供优化后的配比数据")

    # 更新配方成分（简化版：直接更新 composition）
    new_ingredients = []
    for ratio in ratios:
        new_ingredients.append({
            "name": ratio.get("ingredient", ""),
            "dosage_g": ratio.get("dosage_g", 0),
            "percentage": ratio.get("percentage", 0),
        })

    formula.composition = {"ingredients": new_ingredients}
    await db.commit()
    await db.refresh(formula)

    return {
        "success": True,
        "formula_id": formula_id,
        "message": f"已应用 {len(new_ingredients)} 个成分的优化配比",
        "applied_ratios": new_ingredients,
    }


# ── 分析结果持久化 ──

@router.post("/{formula_id}/analysis/save", summary="保存分析结果")
async def save_analysis_result(
    formula_id: int,
    request: dict = Body(...),
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """保存深度分析结果到数据库，支持后续查看"""
    from ..models.formula import Formula

    formula = await _get_formula_with_ingredients(db, formula_id)
    if not formula:
        raise HTTPException(status_code=404, detail="配方不存在")

    # 保存分析结果到公式的 JSON 字段
    analysis_type = request.get("type", "general")
    result_data = request.get("result", {})

    if analysis_type == "synergy":
        formula.synergy_analysis = result_data
    elif analysis_type == "stability":
        formula.stability_analysis = result_data
    elif analysis_type == "taste":
        formula.taste_analysis = result_data
    elif analysis_type == "safety":
        formula.safety_check = result_data
    elif analysis_type == "compatibility":
        formula.compatibility_analysis = result_data
    elif analysis_type == "effect":
        formula.effect_prediction = result_data

    await db.commit()
    await db.refresh(formula)

    return {"success": True, "message": f"{analysis_type} 分析结果已保存"}


@router.get("/{formula_id}/analysis/history", summary="获取分析历史记录")
async def get_analysis_history(
    formula_id: int,
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取配方的分析历史记录"""
    from ..models.formula import Formula

    formula = await _get_formula_with_ingredients(db, formula_id)
    if not formula:
        raise HTTPException(status_code=404, detail="配方不存在")

    history = {
        "synergy": formula.synergy_analysis,
        "stability": formula.stability_analysis,
        "taste": formula.taste_analysis,
        "safety": formula.safety_check,
        "compatibility": formula.compatibility_analysis,
        "effect": formula.effect_prediction,
        "last_updated": formula.updated_at.isoformat() if formula.updated_at else None,
    }

    return {"formula_id": formula_id, "history": history}


# ── 操作日志 API ──

@router.get("/logs", summary="获取操作日志")
async def get_operation_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    start_date: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
    operator_id: Optional[int] = Query(None, description="操作者ID"),
    action: Optional[str] = Query(None, description="操作类型"),
    target_type: Optional[str] = Query(None, description="目标类型"),
    result: Optional[str] = Query(None, description="结果: success/failure/partial"),
    sort_field: str = Query("created_at", description="排序字段"),
    sort_order: str = Query("desc", description="排序方向"),
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """从审计日志表查询配方相关的操作日志"""
    from sqlalchemy import func, desc, asc
    from ..models.system import AuditLog

    query = select(AuditLog).where(AuditLog.entity_type == "formula")

    if start_date:
        query = query.where(func.date(AuditLog.created_at) >= start_date)
    if end_date:
        query = query.where(func.date(AuditLog.created_at) <= end_date)
    if operator_id:
        query = query.where(AuditLog.user_id == operator_id)
    if action:
        query = query.where(AuditLog.action == action)
    if target_type:
        query = query.where(AuditLog.entity_type == target_type)
    if result:
        query = query.where(AuditLog.status_code == 200 if result == "success" else AuditLog.status_code != 200)

    order_col = getattr(AuditLog, sort_field if sort_field in ("created_at",) else "created_at", AuditLog.created_at)
    query = query.order_by(desc(order_col) if sort_order == "desc" else asc(order_col))

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(query)).scalars().all()

    logs = []
    for row in rows:
        logs.append({
            "id": str(row.id),
            "operatorId": str(row.user_id) if row.user_id else None,
            "operatorName": row.username,
            "operatorRole": row.user_role,
            "action": row.action or "",
            "target_type": row.entity_type or "",
            "target_id": str(row.entity_id) if row.entity_id else "",
            "target_name": "",
            "details": row.details or {},
            "result": "success" if row.status_code and row.status_code < 300 else "failure",
            "ip_address": row.ip_address,
            "user_agent": row.user_agent,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        })

    return {"data": logs, "total": total, "page": page, "page_size": page_size}


@router.get("/logs/{log_id}", summary="获取操作日志详情")
async def get_operation_log_detail(
    log_id: str,
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取单个操作日志详情"""
    from ..models.system import AuditLog

    try:
        log = await db.get(AuditLog, int(log_id))
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="日志不存在")

    if not log:
        raise HTTPException(status_code=404, detail="日志不存在")

    return {
        "id": str(log.id),
        "operatorId": str(log.user_id) if log.user_id else None,
        "operatorName": log.username,
        "operatorRole": log.user_role,
        "action": log.action or "",
        "target_type": log.entity_type or "",
        "target_id": str(log.entity_id) if log.entity_id else "",
        "target_name": "",
        "details": log.details or {},
        "result": "success" if log.status_code and log.status_code < 300 else "failure",
        "ip_address": log.ip_address,
        "user_agent": log.user_agent,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }


@router.get("/logs/export", summary="导出操作日志")
async def export_operation_logs(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    format: str = Query("csv", description="导出格式: csv 或 excel"),
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """导出操作日志为 CSV 或 Excel"""
    from sqlalchemy import func
    from ..models.system import AuditLog

    query = select(AuditLog).where(AuditLog.entity_type == "formula")

    if start_date:
        query = query.where(func.date(AuditLog.created_at) >= start_date)
    if end_date:
        query = query.where(func.date(AuditLog.created_at) <= end_date)

    query = query.order_by(desc(AuditLog.created_at))
    rows = (await db.execute(query)).scalars().all()

    import csv, io
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["时间", "操作者", "角色", "动作", "目标类型", "目标ID", "结果", "IP"])
    for row in rows:
        writer.writerow([
            row.created_at.isoformat() if row.created_at else "",
            row.username or "",
            row.user_role or "",
            row.action or "",
            row.entity_type or "",
            row.entity_id or "",
            "success" if row.status_code and row.status_code < 300 else "failure",
            row.ip_address or "",
        ])

    from fastapi.responses import Response
    media_type = "text/csv" if format == "csv" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return Response(content=output.getvalue(), media_type=media_type, headers={
        "Content-Disposition": f"attachment; filename=operation_logs.{format}"
    })


@router.post("/logs/batch", summary="批量创建操作日志")
async def batch_create_operation_logs(
    logs: list[dict],
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """批量创建操作日志（供前端批量操作后记录）"""
    from ..models.system import AuditLog

    created = 0
    for log_data in logs:
        log_entry = AuditLog(
            user_id=current_user.id,
            action=log_data.get("action", ""),
            resource_type=log_data.get("target_type", ""),
            resource_id=int(log_data.get("target_id", 0)) if log_data.get("target_id") else None,
            details={
                **(log_data.get("details", {}) or {}),
                "username": log_data.get("operator_name") or current_user.username,
                "user_role": current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role),
                "method": "POST",
                "path": "/formulas/logs/batch",
                "status_code": 200,
            },
            ip_address=log_data.get("ip_address") or getattr(current_user, "last_login_ip", None),
        )
        db.add(log_entry)
        created += 1

    await db.commit()
    return {"success": True, "created": created}


# ── 权限检查 API ──

_ROLE_PERMISSIONS: dict[str, list[str]] = {
    "admin": [
        "formula:view", "formula:create", "formula:edit", "formula:delete",
        "formula:export", "formula:audit", "formula:manage", "formula:import",
    ],
    "researcher": [
        "formula:view", "formula:create", "formula:edit", "formula:delete",
        "formula:export", "formula:import",
    ],
    "viewer": [
        "formula:view",
    ],
}


@router.get("/permissions", summary="获取当前用户权限列表")
async def get_user_permissions(
    current_user: User = Depends(_required_get_current_user),
):
    """返回当前用户角色对应的全部权限"""
    role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    permissions = _ROLE_PERMISSIONS.get(role, [])
    return {"permissions": permissions}


@router.get("/permissions/check", summary="检查单一权限")
async def check_permission(
    permission: str = Query(..., description="要检查的权限名称"),
    current_user: User = Depends(_required_get_current_user),
):
    """检查当前用户是否拥有指定权限"""
    role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    allowed = _ROLE_PERMISSIONS.get(role, [])
    has_perm = permission in allowed
    return {"has_permission": has_perm}


# ── 批量删除 API ──

@router.post("/batch-delete", summary="批量删除配方")
async def batch_delete_formulas(
    request: dict = Body(...),
    tenant: TenantContext = Depends(require_tenant),
    current_user: User = Depends(_required_get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """批量软删除配方（按 ID 列表）"""
    from ..models.formula import Formula
    from ..models.enums import UserRole
    import uuid

    from datetime import datetime, timezone
    from sqlalchemy import select

    ids: list[int] = request.get("ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail="请提供要删除的配方 ID 列表")

    # 租户隔离：非管理员只能删除自己所属组织的配方（有效组织解析，兼容 Cookie 认证）
    org_id = await _resolve_effective_org_id(tenant.org_id, current_user, db)
    if current_user.role != UserRole.ADMIN:
        if org_id is None:
            raise HTTPException(status_code=403, detail="缺少租户上下文，禁止批量删除配方")
        formulas = await db.execute(
            select(Formula).where(
                Formula.id.in_(ids),
                Formula.organization_id == org_id,
            )
        )
    else:
        formulas = await db.execute(select(Formula).where(Formula.id.in_(ids)))

    existing = formulas.scalars().all()
    existing_ids = {f.id for f in existing}

    deleted = 0
    for f in existing:
        f.deleted_at = datetime.now()  # 使用 naive datetime
        deleted += 1

    await db.commit()

    # 记录操作日志
    from ..models.system import AuditLog
    if deleted > 0:
        log_entry = AuditLog(
            user_id=current_user.id,
            action="delete",
            resource_type="formula",
            resource_id=None,
            details={
                "deleted_count": deleted,
                "ids": list(existing_ids),
                "username": current_user.username,
                "user_role": current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role),
                "method": "POST",
                "path": "/formulas/batch-delete",
                "status_code": 200,
            },
            request_id=str(uuid.uuid4())[:16],
        )
        db.add(log_entry)
        await db.commit()

    return {"success": deleted, "failed": len(ids) - deleted}


# ═══════════════════════════════════════════════════════════
# 配方导入导出
# ═══════════════════════════════════════════════════════════

@router.get("/import/template", summary="下载配方导入模板（CSV）")
async def download_import_template(
    current_user: Optional[User] = Depends(_optional_get_current_user),
):
    """返回带表头和示例行的 CSV 导入模板（UTF-8 BOM，Excel 可直接打开）"""
    import csv
    import io

    from fastapi.responses import Response

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "name", "description", "effects", "composition",
        "processing_method", "dosage", "storage_conditions", "shelf_life",
    ])
    writer.writerow([
        "四物汤", "补血养血经典方", "补血,养血,调经",
        '{"当归": {"weight_g": 9, "unit": "g", "prep": "酒洗"}, "川芎": {"weight_g": 6, "unit": "g"}}',
        "水煎服", "每日1剂，分2次温服", "阴凉干燥", 18,
    ])
    writer.writerow([
        "四君子汤", "补气健脾基础方", "补气,健脾",
        '{"人参": {"weight_g": 9, "unit": "g"}, "白术": {"weight_g": 9, "unit": "g"}}',
        "水煎服", "每日1剂，分2次温服", "阴凉干燥", 18,
    ])
    return Response(
        content=buffer.getvalue().encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=formula_import_template.csv"},
    )


@router.post("/import", summary="批量导入配方（CSV/Excel）")
async def import_formulas(
    file: UploadFile = File(...),
    mode: str = Form("all"),
    options: str = Form("{}"),
    tenant: TenantContext = Depends(require_tenant),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.RESEARCHER, UserRole.FORMULATOR)),
    db: AsyncSession = Depends(get_db_session),
):
    """解析 CSV/Excel 文件，逐行创建配方。

    支持列：name, description, effects, composition, processing_method,
    dosage, storage_conditions, shelf_life
    mode: all / valid_only / skip_errors
    options: {"skipDuplicates": bool, "updateExisting": bool, "defaultStatus": str}
    """
    import io
    import json as _json
    import re as _re
    import uuid
    from datetime import datetime
    import pandas as pd
    from ..models.formula import Formula

    # 解析有效组织（Cookie 认证兼容）：无有效组织 → 403，避免创建 organization_id=None 孤儿配方
    org_id = await _resolve_effective_org_id(tenant.org_id, current_user, db)
    if org_id is None:
        raise HTTPException(status_code=403, detail="缺少租户上下文，禁止导入配方")

    try:
        opts = _json.loads(options) if options else {}
    except Exception:
        opts = {}
    skip_duplicates = opts.get("skipDuplicates", True)
    update_existing = opts.get("updateExisting", False)
    default_status = str(opts.get("defaultStatus", "draft")).lower()
    if default_status not in {s.value for s in FormulaStatus}:
        default_status = "draft"

    content = await file.read()
    filename = (file.filename or "").lower()
    try:
        if filename.endswith(".csv") or filename.endswith(".txt"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        return {
            "total": 0, "success": 0, "failed": 0, "skipped": 0,
            "errors": [{"row": 0, "field": "file", "reason": f"文件解析失败: {e}", "severity": "error"}],
        }

    # 列名映射（同时支持前端中文模板与英文别名）
    col_map = {}
    for c in df.columns:
        cl = str(c).strip().lower()
        if "配方名称" in cl or cl == "name":
            col_map["name"] = c
        elif "描述" in cl or cl == "description":
            col_map["description"] = c
        elif "标签" in cl or cl == "effects":
            col_map["effects"] = c
        elif "成分" in cl or cl == "composition":
            col_map["composition"] = c
        elif "制作步骤" in cl or "制备" in cl or cl == "processing_method":
            col_map["processing_method"] = c
        elif "用法用量" in cl or cl == "dosage" or ("用量" in cl and "成分" not in cl):
            col_map["dosage"] = c
        elif "储存" in cl or "存储" in cl or cl == "storage_conditions":
            col_map["storage_conditions"] = c
        elif "保质期" in cl or cl == "shelf_life":
            col_map["shelf_life"] = c
        elif "状态" in cl or cl == "status":
            col_map["status"] = c

    if "name" not in col_map:
        return {
            "total": 0, "success": 0, "failed": 0, "skipped": 0,
            "errors": [{"row": 0, "field": "name", "reason": "缺少必需列（配方名称 / name）", "severity": "error"}],
        }

    errors = []
    success = 0
    failed = 0
    skipped = 0
    total = 0

    def _get(row, key):
        col = col_map.get(key)
        if col is None:
            return None
        val = row.get(col)
        if isinstance(val, float) and pd.isna(val):
            return None
        return val

    def _parse_effects(raw):
        if raw is None:
            return []
        if isinstance(raw, list):
            return [str(x).strip() for x in raw if str(x).strip()]
        return [x.strip() for x in _re.split(r"[;；,、]", str(raw)) if x.strip()]

    def _parse_composition(raw):
        if raw is None:
            return {}
        text = str(raw).strip()
        # 若本身是 JSON dict，直接使用
        if text.startswith("{"):
            try:
                parsed = _json.loads(text)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                pass
        comp = {}
        # 前端模板格式：金银花|10g|g|君药;连翘|8g|g|臣药
        for part in _re.split(r"[;；]", text):
            part = part.strip()
            if not part:
                continue
            segs = _re.split(r"[|｜]", part)
            name = segs[0].strip()
            if not name:
                continue
            item = {}
            if len(segs) > 1:
                weight = segs[1].strip()
                wm = _re.match(r"^([\d.]+)", weight)
                item["weight_g"] = float(wm.group(1)) if wm else (weight if weight else 0)
            else:
                item["weight_g"] = 0
            if len(segs) > 2 and segs[2].strip():
                item["unit"] = segs[2].strip()
            else:
                item["unit"] = "g"
            if len(segs) > 3 and segs[3].strip():
                item["role"] = segs[3].strip()
            comp[name] = item
        # 若为空且包含 "名称:克数"，兼容简单格式
        if not comp and (":" in text or "：" in text):
            for part in _re.split(r"[;；]", text):
                part = part.strip()
                if ":" in part or "：" in part:
                    seg = _re.split(r"[:：]", part, maxsplit=1)
                    comp[seg[0].strip()] = {"weight_g": float(seg[1].strip()) if seg[1].strip().replace(".", "").isdigit() else seg[1].strip()}
        return comp

    _STATUS_MAP = {
        "草稿": "draft", "待审核": "pending_review", "已通过": "approved", "通过": "approved",
        "已发布": "published", "已驳回": "rejected", "已归档": "archived", "已取消": "cancelled",
    }

    def _parse_status(raw, fallback):
        if raw is None:
            return FormulaStatus(fallback)
        text = str(raw).strip().lower()
        if text in {s.value for s in FormulaStatus}:
            return FormulaStatus(text)
        if str(raw).strip() in _STATUS_MAP:
            return FormulaStatus(_STATUS_MAP[str(raw).strip()])
        return FormulaStatus(fallback)

    for idx, row in df.iterrows():
        total += 1
        try:
            name_raw = _get(row, "name")
            name = str(name_raw).strip() if name_raw is not None else ""
            if not name:
                raise ValueError("配方名称为空")

            code = f"RMF-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

            # 重复检查（按 name 精确匹配）
            if skip_duplicates:
                dup = await db.execute(select(Formula).where(Formula.name == name))
                if dup.scalar_one_or_none():
                    if update_existing:
                        existing = dup.scalar_one_or_none()
                        existing.description = _get(row, "description")
                        existing.target_effects = _parse_effects(_get(row, "effects"))
                        existing.composition = _parse_composition(_get(row, "composition"))
                        existing.processing_method = _get(row, "processing_method")
                        existing.dosage = _get(row, "dosage")
                        existing.storage_conditions = _get(row, "storage_conditions")
                        shelf = _get(row, "shelf_life")
                        if shelf is not None:
                            try:
                                existing.shelf_life = int(float(shelf))
                            except Exception:
                                pass
                        await db.flush()
                        success += 1
                    else:
                        skipped += 1
                    continue

            status_raw = _get(row, "status")
            formula = Formula(
                name=name,
                code=code,
                description=_get(row, "description"),
                status=_parse_status(status_raw, default_status),
                target_effects=_parse_effects(_get(row, "effects")),
                composition=_parse_composition(_get(row, "composition")),
                processing_method=_get(row, "processing_method"),
                dosage=_get(row, "dosage"),
                storage_conditions=_get(row, "storage_conditions"),
                shelf_life=int(float(_get(row, "shelf_life"))) if _get(row, "shelf_life") is not None else None,
                creator_id=current_user.id,
                organization_id=org_id,
            )
            db.add(formula)
            await db.flush()
            success += 1
        except Exception as e:
            failed += 1
            errors.append({
                "row": int(idx) + 2,
                "field": None,
                "reason": str(e),
                "severity": "error",
            })

    await db.commit()
    return {
        "total": total,
        "success": success,
        "failed": failed,
        "skipped": skipped,
        "errors": errors,
    }


@router.post("/export", summary="批量导出配方（CSV/Excel/PDF）")
async def export_formulas_batch(
    request: dict = Body(...),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.RESEARCHER, UserRole.FORMULATOR)),
    _plan_user: User = Depends(require_plan("advanced_report_export")),
    db: AsyncSession = Depends(get_db_session),
):
    """按条件导出配方。

    request: {"format": "csv"|"excel"|"pdf", "scope": "all"|"selected",
              "ids": [..], "includeIngredients": bool}
    """
    import io
    from fastapi.responses import Response
    from ..models.formula import Formula

    fmt = str(request.get("format", "csv")).lower()
    ids = request.get("ids") or []
    scope = request.get("scope", "all")

    query = select(Formula).order_by(Formula.id.desc())
    if ids:
        valid_ids = [int(i) for i in ids if str(i).isdigit()]
        if valid_ids:
            query = query.where(Formula.id.in_(valid_ids))
    if scope == "all":
        pass  # 全部
    result = await db.execute(query)
    formulas = result.scalars().all()

    rows = []
    for f in formulas:
        rows.append({
            "配方名称": f.name,
            "配方编码": f.code,
            "描述": f.description or "",
            "功效": ",".join(f.target_effects or []),
            "成分组成": _json_compact(f.composition),
            "制备方法": f.processing_method or "",
            "用法用量": f.dosage or "",
            "储存条件": f.storage_conditions or "",
            "保质期(月)": f.shelf_life if f.shelf_life is not None else "",
            "状态": f.status,
            "创建时间": f.created_at.isoformat() if f.created_at else "",
        })

    if fmt == "excel":
        import pandas as pd
        buffer = io.BytesIO()
        pd.DataFrame(rows).to_excel(buffer, index=False, engine="openpyxl")
        buffer.seek(0)
        return Response(
            content=buffer.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=formulas.xlsx"},
        )
    elif fmt == "pdf":
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(A4))
        styles = getSampleStyleSheet()
        elements = []
        if rows:
            headers = list(rows[0].keys())
            data = [headers]
            for r in rows:
                data.append([str(r.get(h, ""))[:60] for h in headers])
            table = Table(data)
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F6FEB")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]))
            elements.append(table)
        doc.build(elements)
        buffer.seek(0)
        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=formulas.pdf"},
        )
    else:
        import csv
        buffer = io.StringIO()
        fieldnames = list(rows[0].keys()) if rows else ["配方名称"]
        writer = csv.DictWriter(buffer, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)
        return Response(
            content=buffer.getvalue().encode("utf-8-sig"),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=formulas.csv"},
        )


def _json_compact(obj) -> str:
    import json as _json
    try:
        return _json.dumps(obj, ensure_ascii=False) if obj else ""
    except Exception:
        return ""

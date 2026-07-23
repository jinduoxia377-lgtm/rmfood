"""
配方管理路由
配方 CRUD、版本管理、审核流程、AI 推荐
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

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
from ..services.auth import get_current_user
from ..models.user_model import User
from ..models.enums import UserRole, FormulaStatus
from ..api.deps import get_db_session, PaginationParams, FormulaFilterParams, require_role
from ..core.tenant_security import TenantContext, require_tenant

router = APIRouter(prefix="/formulas", tags=["配方管理"])


@router.get("", summary="获取配方列表")
async def list_formulas(
    tenant: TenantContext = Depends(require_tenant),
    pagination: PaginationParams = Depends(),
    filters: FormulaFilterParams = Depends(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """分页获取配方列表，支持状态筛选和关键词搜索"""
    service = FormulaService(db)
    formulas, total = await service.list_formulas(
        page=pagination.page,
        page_size=pagination.page_size,
        status=FormulaStatus(filters.status) if filters.status else None,
        creator_id=filters.creator_id,
        search=filters.search,
        organization_id=tenant.org_id,
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
            "status": f.status.value,
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
    current_user: User = Depends(get_current_user),
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


@router.get("/{formula_id}", response_model=FormulaResponse, summary="获取配方详情")
async def get_formula(
    formula_id: int,
    tenant: TenantContext = Depends(require_tenant),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取配方详情（含成分和肽段列表）"""
    service = FormulaService(db)
    result = await service.get_formula(formula_id)
    # 验证所属组织
    if result.organization_id is not None and result.organization_id != tenant.org_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="配方不存在",
        )
    return result


@router.post("", response_model=FormulaResponse, status_code=201, summary="创建配方")
async def create_formula(
    data: FormulaCreate,
    tenant: TenantContext = Depends(require_tenant),
    current_user: User = Depends(require_role(UserRole.RESEARCHER, UserRole.FORMULATOR)),
    db: AsyncSession = Depends(get_db_session),
):
    """创建新配方（草稿状态）"""
    service = FormulaService(db)
    return await service.create_formula(data, creator_id=current_user.id, organization_id=tenant.org_id)


@router.put("/{formula_id}", response_model=FormulaResponse, summary="更新配方")
async def update_formula(
    formula_id: int,
    data: FormulaUpdate,
    tenant: TenantContext = Depends(require_tenant),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """更新配方（仅草稿和已驳回状态可编辑，需拥有资源权限）"""
    service = FormulaService(db)
    # 所有权校验 + 租户隔离
    formula = await service.get_formula(formula_id)
    if formula.organization_id is not None and formula.organization_id != tenant.org_id:
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """删除配方（软删除，归档处理）"""
    service = FormulaService(db)
    # 租户隔离验证
    formula = await service.get_formula(formula_id)
    if formula.organization_id is not None and formula.organization_id != tenant.org_id:
        raise HTTPException(status_code=404, detail="配方不存在")
    await service.delete_formula(formula_id, user_id=current_user.id)
    return SuccessResponse(message="配方已归档删除")


# ── 版本管理 ──

@router.get("/{formula_id}/versions", response_model=list[FormulaVersionResponse], summary="版本历史")
async def get_version_history(
    formula_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取配方版本历史"""
    service = FormulaService(db)
    return await service.get_version_history(formula_id)


@router.post("/{formula_id}/versions", response_model=FormulaVersionResponse, summary="创建新版本")
async def create_version(
    formula_id: int,
    change_summary: str = Query(..., description="变更说明"),
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """归档配方"""
    service = FormulaService(db)
    return await service.archive_formula(formula_id, current_user.id)


@router.patch("/batch-status", response_model=SuccessResponse, summary="批量更新配方状态")
async def batch_update_status(
    request: BatchStatusUpdateRequest,
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """计算并返回配方的营养成分摘要（热量、宏量营养素、过敏原等）"""
    from ..models.formula import Formula
    from ..services.formula.nutrition_service import FormulaNutritionService

    result = await db.get(Formula, formula_id)
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
    service = FormulaNutritionService()
    nutrition = service.calculate(ingredients_data, total_weight)

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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """校验配方成分总重量是否为 100%"""
    from ..models.formula import Formula
    from ..services.formula.nutrition_service import FormulaNutritionService

    result = await db.get(Formula, formula_id)
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

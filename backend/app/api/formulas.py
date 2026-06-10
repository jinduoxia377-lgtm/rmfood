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
    ApiResponse, SuccessResponse, PaginatedResponse
)
from ..services.formula import FormulaService
from ..services.auth import get_current_user
from ..models.user_model import User
from ..models.enums import UserRole, FormulaStatus
from ..api.deps import get_db_session, PaginationParams, FormulaFilterParams, require_role

router = APIRouter(prefix="/formulas", tags=["配方管理"])


@router.get("", response_model=FormulaListResponse, summary="获取配方列表")
async def list_formulas(
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
    )
    # 转换为 Pydantic 模型
    formula_responses = [
        FormulaResponse(
            id=f.id,
            code=f.code,
            status=f.status.value,
            version=f.version,
            creator_id=f.creator_id,
            reviewer_id=f.reviewer_id,
            reviewed_at=f.reviewed_at,
            review_notes=f.review_notes,
            safety_check=f.safety_check,
            compliance_status=f.compliance_status,
            ai_recommendations=f.ai_recommendations,
            synergy_analysis=f.synergy_analysis,
            created_at=f.created_at,
            updated_at=f.updated_at,
            name=f.name,
            description=f.description,
            target_effects=f.target_effects,
            composition=f.composition,
            processing_method=f.processing_method,
            dosage=f.dosage,
            storage_conditions=f.storage_conditions,
            shelf_life=f.shelf_life
        )
        for f in formulas
    ]
    return FormulaListResponse(
        items=formula_responses,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size
    )


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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取配方详情（含成分和肽段列表）"""
    service = FormulaService(db)
    return await service.get_formula(formula_id)


@router.post("", response_model=FormulaResponse, status_code=201, summary="创建配方")
async def create_formula(
    data: FormulaCreate,
    current_user: User = Depends(require_role(UserRole.RESEARCHER, UserRole.FORMULATOR)),
    db: AsyncSession = Depends(get_db_session),
):
    """创建新配方（草稿状态）"""
    service = FormulaService(db)
    return await service.create_formula(data, creator_id=current_user.id)


@router.put("/{formula_id}", response_model=FormulaResponse, summary="更新配方")
async def update_formula(
    formula_id: int,
    data: FormulaUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """更新配方（仅草稿和已驳回状态可编辑）"""
    service = FormulaService(db)
    return await service.update_formula(formula_id, data, user_id=current_user.id)


@router.delete("/{formula_id}", response_model=SuccessResponse, summary="删除配方")
async def delete_formula(
    formula_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """删除配方（软删除，归档处理）"""
    service = FormulaService(db)
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

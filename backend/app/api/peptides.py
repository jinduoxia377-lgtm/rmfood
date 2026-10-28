"""
肽管理路由
活性肽的CRUD操作
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import PaginationParams, get_db_session, require_role
from ..models.enums import UserRole
from ..models.user_model import User
from ..schemas import (
    PeptideCreate,
    PeptideListResponse,
    PeptideResponse,
    PeptideUpdate,
    SuccessResponse,
)
from ..services.auth import get_current_user
from ..services.peptide import PeptideService

router = APIRouter(prefix="/peptides", tags=["肽管理"])


@router.get("", response_model=PeptideListResponse, summary="获取肽列表")
async def list_peptides(
    pagination: PaginationParams = Depends(),
    search: str = None,
    activity_type: str = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """分页获取肽列表，支持序列搜索和活性类型筛选"""
    service = PeptideService(db)
    peptides, total = await service.list_peptides(
        page=pagination.page,
        page_size=pagination.page_size,
        search=search,
        activity_type=activity_type,
    )
    return PeptideListResponse(
        items=peptides,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size
    )


@router.get("/{peptide_id}", response_model=PeptideResponse, summary="获取肽详情")
async def get_peptide(
    peptide_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取肽详细信息"""
    service = PeptideService(db)
    return await service.get_peptide(peptide_id)


@router.post("", response_model=PeptideResponse, status_code=201, summary="创建肽")
async def create_peptide(
    data: PeptideCreate,
    current_user: User = Depends(require_role(UserRole.FORMULATOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
):
    """创建新肽"""
    service = PeptideService(db)
    return await service.create_peptide(data)


@router.put("/{peptide_id}", response_model=PeptideResponse, summary="更新肽")
async def update_peptide(
    peptide_id: int,
    data: PeptideUpdate,
    current_user: User = Depends(require_role(UserRole.FORMULATOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
):
    """更新肽信息"""
    service = PeptideService(db)
    return await service.update_peptide(peptide_id, data)


@router.delete("/{peptide_id}", response_model=SuccessResponse, summary="删除肽")
async def delete_peptide(
    peptide_id: int,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
):
    """删除肽（谨慎操作）"""
    service = PeptideService(db)
    await service.delete_peptide(peptide_id)
    return SuccessResponse(message="肽删除成功")

"""
成分管理路由
中药材、食品原料等成分的CRUD操作
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..schemas import (
    IngredientCreate, IngredientUpdate, IngredientResponse, IngredientListResponse,
    ApiResponse, SuccessResponse, PaginatedResponse
)
from ..services.ingredient import IngredientService
from ..services.auth import get_current_user
from ..models.user_model import User
from ..models.enums import UserRole
from ..api.deps import get_db_session, PaginationParams, require_role

router = APIRouter(prefix="/ingredients", tags=["成分管理"])


@router.get("", response_model=IngredientListResponse, summary="获取成分列表")
async def list_ingredients(
    pagination: PaginationParams = Depends(),
    search: str = None,
    category: str = None,
    is_food_homology: bool = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """分页获取成分列表，支持搜索、分类筛选和药食同源标记"""
    service = IngredientService(db)
    ingredients, total = await service.list_ingredients(
        page=pagination.page,
        page_size=pagination.page_size,
        search=search,
        category=category,
        is_food_homology=is_food_homology,
    )
    return IngredientListResponse(
        items=ingredients,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size
    )


@router.get("/{ingredient_id}", response_model=IngredientResponse, summary="获取成分详情")
async def get_ingredient(
    ingredient_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取成分详细信息"""
    service = IngredientService(db)
    return await service.get_ingredient(ingredient_id)


@router.post("", response_model=IngredientResponse, status_code=201, summary="创建成分")
async def create_ingredient(
    data: IngredientCreate,
    current_user: User = Depends(require_role(UserRole.FORMULATOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
):
    """创建新成分"""
    service = IngredientService(db)
    return await service.create_ingredient(data)


@router.put("/{ingredient_id}", response_model=IngredientResponse, summary="更新成分")
async def update_ingredient(
    ingredient_id: int,
    data: IngredientUpdate,
    current_user: User = Depends(require_role(UserRole.FORMULATOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
):
    """更新成分信息"""
    service = IngredientService(db)
    return await service.update_ingredient(ingredient_id, data)


@router.delete("/{ingredient_id}", response_model=SuccessResponse, summary="删除成分")
async def delete_ingredient(
    ingredient_id: int,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
):
    """删除成分（谨慎操作）"""
    service = IngredientService(db)
    await service.delete_ingredient(ingredient_id)
    return SuccessResponse(message="成分删除成功")

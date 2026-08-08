"""
成分管理路由 - 修复版 v2
将TCMHerb数据库对象正确映射到前端（仅 TCMSP 药学数据）
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from typing import List, Dict, Any

from ..schemas import (
    IngredientCreate, IngredientUpdate, IngredientResponse, IngredientListResponse,
    ApiResponse, SuccessResponse, PaginatedResponse
)
from ..services.ingredient import IngredientService
from ..services.auth import get_current_user
from ..models.user_model import User
from ..models.enums import UserRole
from ..models.external_data import TCMHerb
from ..api.deps import get_db_session, PaginationParams, require_role

router = APIRouter(prefix="/ingredients", tags=["成分管理"])
logger = logging.getLogger(__name__)


def _format_tcm_herb_for_frontend(herb) -> Dict[str, Any]:
    """将 TCMHerb 数据库对象格式化为前端期望的格式

    仅包含 TCMSP 药学数据：ob_percent, dl_value, compounds, targets, diseases
    """
    properties_list = []

    # 化合物数量
    compound_count = len(herb.compounds) if herb.compounds else 0
    properties_list.append({"name": "化合物数", "value": str(compound_count), "unit": "种"})

    # 靶点数量
    target_count = len(herb.targets) if herb.targets else 0
    properties_list.append({"name": "靶点数", "value": str(target_count), "unit": "个"})

    # 口服生物利用度
    if herb.ob_percent is not None:
        properties_list.append({"name": "口服生物利用度", "value": f"{herb.ob_percent:.1f}", "unit": "%"})

    # 类药性值
    if herb.dl_value is not None:
        properties_list.append({"name": "类药性", "value": f"{herb.dl_value:.2f}", "unit": ""})

    # 药食同源
    if herb.is_food_homology:
        properties_list.append({"name": "药食同源", "value": "是", "unit": ""})

    return {
        "id": str(herb.id),
        "name": herb.name_latin or herb.name_pinyin or "",
        "nameCn": herb.name_cn or "",
        "pinyin": herb.name_pinyin or "",
        "latin": herb.name_latin or "",
        "category": herb.category or "",
        "description": herb.effects or "",
        "properties": properties_list,
        # TCMSP 数据
        "ob_percent": herb.ob_percent,
        "dl_value": herb.dl_value,
        "is_food_homology": herb.is_food_homology,
        "compounds": herb.compounds or [],
        "targets": herb.targets or [],
        "diseases": herb.diseases or [],
    }


@router.get("", response_model=ApiResponse, summary="获取成分列表")
async def list_ingredients(
    pagination: PaginationParams = Depends(),
    search: str = None,
    category: str = None,
    is_food_homology: bool = None,
    db: AsyncSession = Depends(get_db_session),
):
    """分页获取成分列表，支持搜索、分类筛选和药食同源标记

    从 TCMHerb 表获取 TCMSP 药学数据
    """
    try:
        query = select(TCMHerb)
        count_query = select(func.count()).select_from(TCMHerb)

        if is_food_homology is not None:
            query = query.where(TCMHerb.is_food_homology == is_food_homology)
            count_query = count_query.where(TCMHerb.is_food_homology == is_food_homology)

        if category:
            query = query.where(TCMHerb.category == category)
            count_query = count_query.where(TCMHerb.category == category)

        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    TCMHerb.name_cn.ilike(search_pattern),
                    TCMHerb.name_latin.ilike(search_pattern),
                    TCMHerb.name_pinyin.ilike(search_pattern),
                )
            )
            count_query = count_query.where(
                or_(
                    TCMHerb.name_cn.ilike(search_pattern),
                    TCMHerb.name_latin.ilike(search_pattern),
                    TCMHerb.name_pinyin.ilike(search_pattern),
                )
            )

        total = (await db.execute(count_query)).scalar() or 0
        herbs = (await db.execute(
            query
            .order_by(TCMHerb.name_cn)
            .offset((pagination.page - 1) * pagination.page_size)
            .limit(pagination.page_size)
        )).scalars().all()

        formatted_data = [_format_tcm_herb_for_frontend(herb) for herb in herbs]

        return {
            "data": {
                "items": formatted_data,
                "total": total,
                "page": pagination.page,
                "page_size": pagination.page_size,
            },
            "message": "success",
            "success": True,
        }

    except Exception as e:
        logger.error(f"从TCMHerb表查询失败: {e}")
        raise HTTPException(status_code=500, detail="查询成分数据失败")


@router.get("/{ingredient_id}", response_model=IngredientResponse, summary="获取成分详情")
async def get_ingredient(
    ingredient_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """获取单个成分详情"""
    herb = (await db.execute(
        select(TCMHerb).where(TCMHerb.id == ingredient_id)
    )).scalar_one_or_none()

    if herb:
        return {
            "data": _format_tcm_herb_for_frontend(herb),
            "message": "success",
            "success": True,
        }

    raise HTTPException(status_code=404, detail="成分不存在")


@router.get("/stats", summary="获取成分统计")
async def get_ingredient_stats(
    db: AsyncSession = Depends(get_db_session),
):
    """获取成分统计数据（仅 TCMSP）"""
    try:
        total = (await db.execute(select(func.count()).select_from(TCMHerb))).scalar() or 0
        food_homology = (await db.execute(
            select(func.count()).where(TCMHerb.is_food_homology == True)
        )).scalar() or 0

        # 分类统计
        cat_result = await db.execute(
            select(TCMHerb.category, func.count())
            .group_by(TCMHerb.category)
            .order_by(func.count().desc())
        )
        categories = [{"category": row[0] or "未分类", "count": row[1]} for row in cat_result.all()]

        return {
            "data": {
                "total": total,
                "food_homology_count": food_homology,
                "categories": categories,
            },
            "message": "success",
            "success": True,
        }
    except Exception as e:
        logger.error("统计查询失败: %s", e)
        return {
            "data": {"total": 0, "categories": []},
            "message": "统计查询失败，请稍后重试",
            "success": False,
        }

"""RMFOOD 成分相关 Pydantic 模式"""
from typing import Optional

from pydantic import BaseModel, Field


class IngredientBase(BaseModel):
    """成分基础模式"""
    name: str = Field(..., min_length=1, max_length=200)
    name_cn: Optional[str] = Field(None, max_length=200)
    category: Optional[str] = Field(None, max_length=100)
    source: Optional[str] = Field(None, max_length=200)
    properties: Optional[dict] = None
    is_food_homology: bool = False


class IngredientCreate(IngredientBase):
    """成分创建"""
    pass


class IngredientUpdate(BaseModel):
    """成分更新"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    name_cn: Optional[str] = Field(None, max_length=200)
    category: Optional[str] = Field(None, max_length=100)
    source: Optional[str] = Field(None, max_length=200)
    properties: Optional[dict] = None
    is_food_homology: Optional[bool] = None


class IngredientResponse(IngredientBase):
    """成分响应"""
    id: int

    model_config = {"from_attributes": True}


class IngredientListResponse(BaseModel):
    """成分列表响应"""
    items: list[IngredientResponse]
    total: int
    page: int
    page_size: int

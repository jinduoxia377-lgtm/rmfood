"""
食品原料搜索请求/响应 Schema

用于 Potion AI VFT x RMFOOD 深度融合方案的搜索 API。
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class FoodMaterialFilter(BaseModel):
    """食品原料搜索筛选条件"""
    category: Optional[str] = None
    sub_category: Optional[str] = None
    food_homology: Optional[bool] = None
    toxicity_class: Optional[str] = None
    has_effects: Optional[List[str]] = None
    regulatory_status: Optional[str] = None
    min_ob: Optional[float] = Field(None, ge=0, le=100, description="最小口服生物利用度")
    min_dl: Optional[float] = Field(None, ge=0, le=5, description="最小类药性")
    min_data_quality: Optional[float] = Field(0.3, ge=0, le=1, description="最小数据质量")


class FoodMaterialSearchRequest(BaseModel):
    """食品原料搜索请求"""
    query: str = Field(..., min_length=1, max_length=200, description="搜索查询")
    filters: Optional[FoodMaterialFilter] = Field(default_factory=FoodMaterialFilter)
    page: int = Field(1, ge=1, description="页码")
    per_page: int = Field(20, ge=1, le=200, description="每页数量")
    sort_by: str = Field("relevance", description="排序: relevance|ob|dl|rating")
    search_modes: Optional[Dict[str, float]] = Field(
        default_factory=lambda: {"bm25": 0.4, "vector": 0.3, "rule": 0.3}
    )


class FoodMaterialSearchResponse(BaseModel):
    """食品原料搜索响应"""
    query: str
    total: int
    page: int
    per_page: int
    results: List[Dict[str, Any]]
    search_time_ms: float
    search_modes_used: Dict[str, float]


class RetailProductFilter(BaseModel):
    """零售产品搜索筛选条件"""
    category: Optional[str] = None
    formulation_type: Optional[str] = None
    brand: Optional[List[str]] = None
    price_range: Optional[Dict[str, Optional[float]]] = None
    min_rating: Optional[float] = Field(None, ge=0, le=5)
    has_ingredient: Optional[List[str]] = None
    effects: Optional[List[str]] = None


class RetailProductSearchRequest(BaseModel):
    """零售产品搜索请求"""
    query: str = Field(..., min_length=1, max_length=200)
    filters: Optional[RetailProductFilter] = Field(default_factory=RetailProductFilter)
    page: int = Field(1, ge=1)
    per_page: int = Field(20, ge=1, le=200)


class RetailProductSearchResponse(BaseModel):
    """零售产品搜索响应"""
    query: str
    total: int
    page: int
    per_page: int
    results: List[Dict[str, Any]]
    search_time_ms: float


class SearchSuggestionRequest(BaseModel):
    """搜索建议请求"""
    query: str = Field(..., min_length=1, max_length=100)
    limit: int = Field(10, ge=1, le=50)
    search_types: Optional[List[str]] = Field(
        default=["herbs", "peptides", "food_materials", "retail_products"]
    )


class SearchSuggestionResponse(BaseModel):
    """搜索建议响应"""
    suggestions: List[Dict[str, Any]]
    hot_queries: List[Dict[str, Any]] = Field(default_factory=list)


class NormalizeRequest(BaseModel):
    """名称标准化请求"""
    name: str = Field(..., min_length=1, max_length=200)
    search_type: str = Field("food_material", description="food_material | retail_product")


class NormalizeResponse(BaseModel):
    """名称标准化响应"""
    original: str
    canonical: str
    aliases_found: List[str]
    confidence: float


class PantryItem(BaseModel):
    """收藏项"""
    id: int
    item_type: str  # food_material | retail_product | herb | peptide
    item_id: int
    notes: Optional[str] = None
    added_at: Optional[str] = None


class PantryResponse(BaseModel):
    """收藏列表响应"""
    items: List[PantryItem]
    total: int

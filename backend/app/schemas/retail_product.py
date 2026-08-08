"""零售产品 Pydantic Schemas

用于 Potion AI VFT x RMFOOD 深度融合方案的零售产品 API 请求/响应模型。
对标 OpenFoodFacts 官方 Product Schema + RMFOORM 扩展字段。
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── RetailProduct Response Schema ───────────────────────────────

class RetailProductResponse(BaseModel):
    """零售产品详情响应"""
    id: int
    external_id: Optional[str] = None
    sku: Optional[str] = None
    brand: str
    product_name: str
    product_line: Optional[str] = None
    category: Optional[str] = None
    sub_category: Optional[str] = None
    formulation_type: Optional[str] = None
    effects: List[str] = Field(default_factory=list)
    target_population: List[str] = Field(default_factory=list)
    full_ingredients: Optional[str] = None
    key_ingredients: Dict[str, Any] = Field(default_factory=dict)
    price: Optional[float] = None
    currency: str = "CNY"
    package_size: Optional[str] = None
    volume_ml: Optional[float] = None
    weight_g: Optional[float] = None
    sales_channels: List[str] = Field(default_factory=list)
    avg_rating: Optional[float] = None
    review_count: Optional[int] = None
    monthly_sales: Optional[int] = None
    image_urls: List[str] = Field(default_factory=list)
    reg_number: Optional[str] = None
    reg_type: Optional[str] = None
    approved_region: Optional[str] = None
    allergens_tags: List[str] = Field(default_factory=list, description="过敏原标签")
    additives_tags: List[str] = Field(default_factory=list, description="添加剂标签")
    ecoscore_grade: Optional[str] = None  # 生态评分等级
    traces_tags: List[str] = Field(default_factory=list, description="潜在交叉污染物质")
    contaminants: List[str] = Field(default_factory=list, description="污染物标签")
    source: str = "crawl"
    data_quality: float = 1.0
    crawl_timestamp: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True, "extra": "ignore"}


# ── Paginated Response Wrapper ────────────────────────────────

class PaginatedProductResponse(BaseModel):
    """分页产品响应（统一格式）"""
    items: List[RetailProductResponse]
    total: int
    page: int
    page_size: int
    data_source: str  # postgresql_fts | postgresql_ilike | openfoodfacts_api | error_network


class PaginatedCategoryItem(BaseModel):
    """分类条目"""
    category: str
    count: int
    category_tag: Optional[str] = None


class CategoryListResponse(BaseModel):
    """分类列表响应"""
    categories: List[Dict[str, Any]]
    total: int


# ── Search Request Schema ──────────────────────────────────────

class RetailProductSearchRequest(BaseModel):
    """零售产品搜索请求"""
    query: str = Field(..., min_length=1, max_length=200)
    category: Optional[str] = None
    brand: Optional[str] = None
    formulation_type: Optional[str] = None
    min_price: Optional[float] = Field(None, ge=0)
    max_price: Optional[float] = Field(None, ge=0)
    min_rating: Optional[float] = Field(None, ge=0, le=5)
    effects: Optional[List[str]] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=200)
    realtime: bool = False


# ── Sync / Admin Response Schemas ──────────────────────────────

class SyncStatusResponse(BaseModel):
    """同步状态响应"""
    total_products: int = 0
    with_embedding: int = 0
    avg_quality: float = 0.0
    unique_brands: int = 0
    kb_categories: int = 0
    last_sync: Optional[dict] = None


class ImportReportResponse(BaseModel):
    """导入报告响应"""
    overall: Dict[str, Any]
    categories: List[Dict[str, Any]]
    quality_distribution: Dict[str, int]


class ImportErrorResponse(BaseModel):
    """导入错误日志响应"""
    errors: List[Dict[str, Any]]
    total: int


# ── FoodMaterial CRUD Schemas ──────────────────────────────────

class FoodMaterialBase(BaseModel):
    """食品原料基础模式"""
    name_cn: str = Field(..., min_length=1, max_length=200)
    name_latin: Optional[str] = Field(None, max_length=200)
    name_en: Optional[str] = Field(None, max_length=200)
    aliases: Optional[List[str]] = Field(default_factory=list)
    category: Optional[str] = Field(None, max_length=100)
    sub_category: Optional[str] = None
    food_homology: bool = False
    toxicity_class: Optional[str] = Field(None, max_length=20)
    active_ingredients: Optional[List[str]] = Field(default_factory=list)
    effects: Optional[List[str]] = Field(default_factory=list)
    indications: Optional[str] = None
    ob_percent: Optional[float] = None
    dl_value: Optional[float] = None
    bioavailability_score: Optional[float] = None
    safe_dose_min: Optional[float] = None
    safe_dose_max: Optional[float] = None
    contraindications: Optional[List[str]] = Field(default_factory=list)
    interactions: Optional[List[str]] = Field(default_factory=list)
    regulatory_status: Optional[str] = Field(None, max_length=50)
    approved_regions: Optional[List[str]] = Field(default_factory=list)
    max_daily_intake: Optional[str] = Field(None, max_length=50)
    suppliers: Optional[dict] = Field(default_factory=dict)
    origin_countries: Optional[List[str]] = Field(default_factory=list)
    description: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=500)
    msds_url: Optional[str] = Field(None, max_length=500)
    coa_url: Optional[str] = Field(None, max_length=500)
    source_db: str = Field(default="manual", max_length=50)
    data_quality: float = Field(default=1.0, ge=0, le=1)
    review_status: str = Field(default="pending", max_length=20)
    external_id: Optional[str] = Field(None, max_length=100)
    gb_code: Optional[str] = Field(None, max_length=50)


class FoodMaterialCreate(FoodMaterialBase):
    """创建食品原料"""
    pass


class FoodMaterialUpdate(BaseModel):
    """更新食品原料（所有字段可选）"""
    name_cn: Optional[str] = Field(None, min_length=1, max_length=200)
    name_latin: Optional[str] = Field(None, max_length=200)
    name_en: Optional[str] = Field(None, max_length=200)
    aliases: Optional[List[str]] = None
    category: Optional[str] = Field(None, max_length=100)
    sub_category: Optional[str] = None
    food_homology: Optional[bool] = None
    toxicity_class: Optional[str] = Field(None, max_length=20)
    active_ingredients: Optional[List[str]] = None
    effects: Optional[List[str]] = None
    indications: Optional[str] = None
    ob_percent: Optional[float] = None
    dl_value: Optional[float] = None
    bioavailability_score: Optional[float] = None
    safe_dose_min: Optional[float] = None
    safe_dose_max: Optional[float] = None
    contraindications: Optional[List[str]] = None
    interactions: Optional[List[str]] = None
    regulatory_status: Optional[str] = Field(None, max_length=50)
    approved_regions: Optional[List[str]] = None
    max_daily_intake: Optional[str] = Field(None, max_length=50)
    suppliers: Optional[dict] = None
    origin_countries: Optional[List[str]] = None
    description: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=500)
    msds_url: Optional[str] = Field(None, max_length=500)
    coa_url: Optional[str] = Field(None, max_length=500)
    source_db: Optional[str] = Field(None, max_length=50)
    data_quality: Optional[float] = Field(None, ge=0, le=1)
    review_status: Optional[str] = Field(None, max_length=20)
    external_id: Optional[str] = Field(None, max_length=100)
    gb_code: Optional[str] = Field(None, max_length=50)


class FoodMaterialResponse(FoodMaterialBase):
    """食品原料响应"""
    id: int

    model_config = {"from_attributes": True}


class FoodMaterialDeleted(BaseModel):
    """删除确认"""
    status: str = "deleted"
    id: int

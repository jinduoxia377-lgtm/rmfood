"""
食品原料搜索请求/响应 Schema

用于 Potion AI VFT x RMFOOD 深度融合方案的搜索 API。
"""
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

# ── 食品原料 CRUD 白名单 Schema (P0-7) ──────────────────────────
#
# 显式白名单可写字段，杜绝 FoodMaterial(**data) 直灌原始 dict
# 以及 for key in data: setattr 的越权写入 (id/review_status/审计字段)。
#
# 安全说明：id / created_at / updated_at / created_by /
#           reviewed_by / reviewed_at / embedding 不在白名单内，
#           由服务端按鉴权上下文与业务流程填充。

_WRITEABLE_MATERIAL_FIELDS = (
    "external_id", "gb_code", "name_cn", "name_latin", "name_en", "aliases",
    "category", "sub_category", "food_homology", "toxicity_class",
    "active_ingredients", "compound_refs",
    "effects", "indications",
    "ob_percent", "dl_value", "bioavailability_score",
    "safe_dose_min", "safe_dose_max", "contraindications", "interactions",
    "regulatory_status", "approved_regions", "max_daily_intake",
    "suppliers", "origin_countries",
    "description", "image_url", "msds_url", "coa_url",
    "source_db", "data_quality",
)


class FoodMaterialCreate(BaseModel):
    """创建食品原料请求体（显式白名单）"""
    external_id: Optional[str] = None
    gb_code: Optional[str] = None
    name_cn: str = Field(..., min_length=1, max_length=200, description="中文名称（必填）")
    name_latin: Optional[str] = None
    name_en: Optional[str] = None
    aliases: Optional[List[str]] = None
    category: Optional[str] = None
    sub_category: Optional[str] = None
    food_homology: Optional[bool] = None
    toxicity_class: Optional[str] = None
    active_ingredients: Optional[List[str]] = None
    compound_refs: Optional[List[int]] = None
    effects: Optional[List[str]] = None
    indications: Optional[str] = None
    ob_percent: Optional[float] = None
    dl_value: Optional[float] = None
    bioavailability_score: Optional[float] = None
    safe_dose_min: Optional[float] = None
    safe_dose_max: Optional[float] = None
    contraindications: Optional[List[str]] = None
    interactions: Optional[List[str]] = None
    regulatory_status: Optional[str] = None
    approved_regions: Optional[List[str]] = None
    max_daily_intake: Optional[str] = None
    suppliers: Optional[Dict[str, Any]] = None
    origin_countries: Optional[List[str]] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    msds_url: Optional[str] = None
    coa_url: Optional[str] = None
    # 数据来源允许显式指定（如 manual / fooddb / usda），
    # 但默认服务端会覆写为 "manual"。
    source_db: Optional[str] = None
    data_quality: Optional[float] = Field(None, ge=0, le=1)

    model_config = {"extra": "forbid"}  # 未知字段直接 422，不接受 id/审计字段注入


class FoodMaterialUpdate(BaseModel):
    """更新食品原料请求体（全部可选，partial update）"""
    external_id: Optional[str] = None
    gb_code: Optional[str] = None
    name_cn: Optional[str] = Field(None, min_length=1, max_length=200)
    name_latin: Optional[str] = None
    name_en: Optional[str] = None
    aliases: Optional[List[str]] = None
    category: Optional[str] = None
    sub_category: Optional[str] = None
    food_homology: Optional[bool] = None
    toxicity_class: Optional[str] = None
    active_ingredients: Optional[List[str]] = None
    compound_refs: Optional[List[int]] = None
    effects: Optional[List[str]] = None
    indications: Optional[str] = None
    ob_percent: Optional[float] = None
    dl_value: Optional[float] = None
    bioavailability_score: Optional[float] = None
    safe_dose_min: Optional[float] = None
    safe_dose_max: Optional[float] = None
    contraindications: Optional[List[str]] = None
    interactions: Optional[List[str]] = None
    regulatory_status: Optional[str] = None
    approved_regions: Optional[List[str]] = None
    max_daily_intake: Optional[str] = None
    suppliers: Optional[Dict[str, Any]] = None
    origin_countries: Optional[List[str]] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    msds_url: Optional[str] = None
    coa_url: Optional[str] = None
    source_db: Optional[str] = None
    data_quality: Optional[float] = Field(None, ge=0, le=1)

    model_config = {"extra": "forbid"}


# ── 字段级审校审计 (material_field_review) ─────────────────────
#
# 允许专家审校的安全关键字段白名单。审校端点据此校验 field_name，
# 防止对任意字段（尤其 id / 审计字段）建立伪造 provenance。
REVIEWABLE_MATERIAL_FIELDS = frozenset({
    "interactions",
    "contraindications",
    "active_ingredients",
    "effects",
    "safe_dose_min",
    "safe_dose_max",
    "regulatory_status",
    "toxicity_class",
    "max_daily_intake",
})


class MaterialFieldReviewCreate(BaseModel):
    """提交单字段审校（专家审校工作流）。

    reviewed_by 由服务端从 current_user 取，此处不接受任何身份字段
    （extra="forbid" 确保 reviewed_by/reviewed_at 传入即 422）。
    """
    field_name: str = Field(..., description="被审校字段名（须在 REVIEWABLE_MATERIAL_FIELDS 内）")
    value: Optional[Any] = Field(None, description="审校后的字段值（写入主表并存快照）")
    source: Optional[str] = Field(None, max_length=128, description="依据来源：本草/药典/文献/专家经验")
    review_note: Optional[str] = Field(None, description="审校备注")

    model_config = {"extra": "forbid"}


class MaterialFieldReviewResponse(BaseModel):
    """字段审校 provenance 响应"""
    id: int
    material_id: int
    field_name: str
    value: Optional[Any] = None
    source: Optional[str] = None
    review_note: Optional[str] = None
    reviewed_by: int
    reviewed_at: Optional[str] = None


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

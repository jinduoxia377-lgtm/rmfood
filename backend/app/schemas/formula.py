"""
配方相关 Pydantic 模式
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class FormulaBase(BaseModel):
    """配方基础模式"""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    target_effects: Optional[list[str]] = None
    composition: Optional[dict] = None
    processing_method: Optional[str] = None
    dosage: Optional[str] = None
    storage_conditions: Optional[str] = None
    shelf_life: Optional[int] = None


class FormulaCreate(FormulaBase):
    """配方创建"""
    ingredient_ids: list[int] = Field(default_factory=list)
    peptide_ids: list[int] = Field(default_factory=list)
    safety_check: Optional[dict] = None
    synergy_analysis: Optional[dict] = None


class FormulaUpdate(BaseModel):
    """配方更新"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    target_effects: Optional[list[str]] = None
    composition: Optional[dict] = None
    processing_method: Optional[str] = None
    dosage: Optional[str] = None
    storage_conditions: Optional[str] = None
    shelf_life: Optional[int] = None
    ingredient_ids: Optional[list[int]] = None
    peptide_ids: Optional[list[int]] = None


class IngredientResponse(BaseModel):
    """成分响应"""
    id: int
    name: str
    name_cn: Optional[str] = None
    category: Optional[str] = None
    source: Optional[str] = None
    is_food_homology: bool = False
    properties: Optional[dict] = None

    model_config = {"from_attributes": True}


class PeptideResponse(BaseModel):
    """肽段响应"""
    id: int
    sequence: str
    source_protein: Optional[str] = None
    source_organism: Optional[str] = None
    activity_type: Optional[str] = None
    activity_value: Optional[float] = None
    activity_unit: Optional[str] = None
    molecular_weight: Optional[float] = None

    model_config = {"from_attributes": True}


class FormulaResponse(FormulaBase):
    """配方响应"""
    id: int
    code: str
    status: str
    version: int
    creator_id: int
    creator_name: Optional[str] = None
    reviewer_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    safety_check: Optional[dict] = None
    compliance_status: Optional[dict] = None
    ai_recommendations: Optional[dict] = None
    synergy_analysis: Optional[dict] = None
    ingredients: list[dict] = Field(default_factory=list)
    peptides: list[dict] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FormulaListResponse(BaseModel):
    """配方列表响应"""
    items: list[FormulaResponse]
    total: int
    page: int
    page_size: int


class FormulaVersionResponse(BaseModel):
    """配方版本响应"""
    id: int
    formula_id: int
    version: int
    snapshot: dict
    change_summary: Optional[str] = None
    created_by: int
    created_at: datetime

    model_config = {"from_attributes": True}


class FormulaReviewRequest(BaseModel):
    """配方审核请求"""
    approved: bool
    review_notes: Optional[str] = None


class AIRecommendationRequest(BaseModel):
    """AI推荐请求"""
    target_effects: list[str]
    preferred_categories: list[str] = Field(default_factory=list)
    max_results: int = Field(default=5, ge=1, le=20)


class AIRecommendationResponse(BaseModel):
    """AI推荐响应"""
    recommendations: list[dict]
    total: int


class BatchStatusUpdateRequest(BaseModel):
    """批量更新配方状态请求"""
    ids: list[int] = Field(..., min_length=1, max_length=100, description="配方ID列表")
    status: str = Field(..., description="目标状态（draft/submitted/reviewed/approved/rejected/published/archived）")

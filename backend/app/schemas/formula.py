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


class FormulaResponse(FormulaBase):
    """配方响应"""
    id: int
    code: str
    status: str
    version: int
    creator_id: int
    reviewer_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    safety_check: Optional[dict] = None
    compliance_status: Optional[dict] = None
    ai_recommendations: Optional[dict] = None
    synergy_analysis: Optional[dict] = None
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

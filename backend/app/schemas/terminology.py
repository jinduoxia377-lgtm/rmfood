"""专业术语相关的Pydantic Schema"""
from typing import Optional, List, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime


class TermCategoryCreate(BaseModel):
    """创建术语分类"""
    name: str = Field(..., max_length=100)
    name_en: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    parent_id: Optional[int] = None
    level: int = Field(1, ge=1, le=5)
    sort_order: int = 0


class TermCategoryUpdate(BaseModel):
    """更新术语分类"""
    name: Optional[str] = Field(None, max_length=100)
    name_en: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    parent_id: Optional[int] = None
    level: Optional[int] = Field(None, ge=1, le=5)
    sort_order: Optional[int] = None


class TermCategoryOut(BaseModel):
    """术语分类输出"""
    id: int
    name: str
    name_en: Optional[str]
    description: Optional[str]
    parent_id: Optional[int]
    level: int
    sort_order: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TermCreate(BaseModel):
    """创建术语"""
    term: str = Field(..., max_length=200)
    term_en: Optional[str] = Field(None, max_length=200)
    pinyin: Optional[str] = Field(None, max_length=200)
    pinyin_abbr: Optional[str] = Field(None, max_length=100)
    abbreviation: Optional[str] = Field(None, max_length=50)
    definition: str = Field(...)
    definition_en: Optional[str] = None
    category_id: int
    subcategory: Optional[str] = Field(None, max_length=100)
    unit: Optional[str] = Field(None, max_length=50)
    examples: Optional[List[str]] = None
    synonyms: Optional[List[str]] = None
    related_terms: Optional[List[int]] = None
    source: Optional[str] = Field(None, max_length=200)
    is_standard: bool = True
    confidence: float = Field(1.0, ge=0.0, le=1.0)
    frequency: int = 0


class TermUpdate(BaseModel):
    """更新术语"""
    term: Optional[str] = Field(None, max_length=200)
    term_en: Optional[str] = Field(None, max_length=200)
    pinyin: Optional[str] = Field(None, max_length=200)
    pinyin_abbr: Optional[str] = Field(None, max_length=100)
    abbreviation: Optional[str] = Field(None, max_length=50)
    definition: Optional[str] = None
    definition_en: Optional[str] = None
    category_id: Optional[int] = None
    subcategory: Optional[str] = Field(None, max_length=100)
    unit: Optional[str] = Field(None, max_length=50)
    examples: Optional[List[str]] = None
    synonyms: Optional[List[str]] = None
    related_terms: Optional[List[int]] = None
    source: Optional[str] = Field(None, max_length=200)
    is_standard: Optional[bool] = None
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    frequency: Optional[int] = None


class TermOut(BaseModel):
    """术语输出"""
    id: int
    term: str
    term_en: Optional[str]
    pinyin: Optional[str]
    pinyin_abbr: Optional[str]
    abbreviation: Optional[str]
    definition: str
    definition_en: Optional[str]
    category_id: int
    category_name: Optional[str]
    subcategory: Optional[str]
    unit: Optional[str]
    examples: Optional[List[str]]
    synonyms: Optional[List[str]]
    related_terms: Optional[List[int]]
    source: Optional[str]
    is_standard: bool
    confidence: float
    frequency: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TermVariantCreate(BaseModel):
    """创建术语变体"""
    variant: str = Field(..., max_length=200)
    term_id: int
    similarity: float = Field(0.8, ge=0.0, le=1.0)
    variant_type: str = Field("synonym", pattern="^(synonym|typo|abbreviation)$")


class TermVariantOut(BaseModel):
    """术语变体输出"""
    id: int
    variant: str
    term_id: int
    term: Optional[str]
    similarity: float
    variant_type: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class TermValidationRequest(BaseModel):
    """术语验证请求"""
    term: str = Field(..., max_length=200)
    category_id: Optional[int] = None
    strict_mode: bool = False


class TermValidationResponse(BaseModel):
    """术语验证响应"""
    input_term: str
    is_valid: bool
    confidence: float
    matched_term: Optional[TermOut] = None
    suggested_term: Optional[str] = None
    correction_needed: bool = False
    alternatives: Optional[List[dict]] = None


class BatchTermValidationRequest(BaseModel):
    """批量术语验证请求"""
    terms: List[str]
    category_id: Optional[int] = None
    strict_mode: bool = False


class TermNormalizationRuleCreate(BaseModel):
    """创建标准化规则"""
    pattern: str = Field(..., max_length=500)
    replacement: str = Field(..., max_length=500)
    rule_type: str = Field("regex", pattern="^(regex|exact|fuzzy)$")
    priority: int = 100
    description: Optional[str] = None
    enabled: bool = True


class TermNormalizationRuleOut(BaseModel):
    """标准化规则输出"""
    id: int
    pattern: str
    replacement: str
    rule_type: str
    priority: int
    description: Optional[str]
    enabled: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TermSearchRequest(BaseModel):
    """术语搜索请求"""
    query: str = Field(..., max_length=200)
    category_id: Optional[int] = None
    fuzzy_search: bool = True
    max_results: int = 10


class TermStatisticsOut(BaseModel):
    """术语统计输出"""
    category_id: Optional[int]
    category_name: Optional[str]
    total_terms: int
    validation_count: int
    correction_count: int
    accuracy_rate: float
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TermSuggestionRequest(BaseModel):
    """术语建议请求"""
    input: str = Field(..., max_length=200)
    limit: int = Field(5, ge=1, le=20)
    include_synonyms: bool = True


class TermSuggestionResponse(BaseModel):
    """术语建议响应"""
    suggestions: List[dict] = []
    matched_term: Optional[dict] = None
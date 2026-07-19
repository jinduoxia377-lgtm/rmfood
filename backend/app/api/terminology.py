"""专业术语API接口"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..models.terminology import Term, TermCategory, TermVariant, TermNormalizationRule
from ..schemas.terminology import (
    TermCreate, TermUpdate, TermOut,
    TermCategoryCreate, TermCategoryUpdate, TermCategoryOut,
    TermVariantCreate, TermVariantOut,
    TermValidationRequest, TermValidationResponse,
    BatchTermValidationRequest,
    TermSearchRequest,
    TermSuggestionRequest, TermSuggestionResponse,
    TermNormalizationRuleCreate, TermNormalizationRuleOut
)
from ..schemas.base import ApiResponse, PaginatedResponse
from .deps import get_db
from ..services.terminology_service import TerminologyService

router = APIRouter(prefix="/api/terminology", tags=["术语管理"])


def get_terminology_service(db: Session = Depends(get_db)) -> TerminologyService:
    """获取术语服务实例"""
    return TerminologyService(db)


# ========== 术语分类 API ==========

@router.get("/categories", response_model=ApiResponse[List[TermCategoryOut]])
def get_categories(db: Session = Depends(get_db)):
    """获取所有术语分类"""
    categories = db.query(TermCategory).order_by(TermCategory.sort_order).all()
    return ApiResponse(data=[TermCategoryOut.from_orm(c) for c in categories])


@router.get("/categories/{category_id}", response_model=ApiResponse[TermCategoryOut])
def get_category(category_id: int, db: Session = Depends(get_db)):
    """获取单个分类"""
    category = db.query(TermCategory).filter(TermCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="分类不存在")
    return ApiResponse(data=TermCategoryOut.from_orm(category))


@router.post("/categories", response_model=ApiResponse[TermCategoryOut])
def create_category(category: TermCategoryCreate, db: Session = Depends(get_db)):
    """创建分类"""
    existing = db.query(TermCategory).filter(TermCategory.name == category.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="分类名称已存在")
    
    db_category = TermCategory(**category.dict())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    
    return ApiResponse(data=TermCategoryOut.from_orm(db_category))


@router.put("/categories/{category_id}", response_model=ApiResponse[TermCategoryOut])
def update_category(category_id: int, category: TermCategoryUpdate, db: Session = Depends(get_db)):
    """更新分类"""
    db_category = db.query(TermCategory).filter(TermCategory.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="分类不存在")
    
    if category.name:
        existing = db.query(TermCategory).filter(
            TermCategory.name == category.name,
            TermCategory.id != category_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="分类名称已存在")
        db_category.name = category.name
    
    if category.name_en is not None:
        db_category.name_en = category.name_en
    if category.description is not None:
        db_category.description = category.description
    if category.parent_id is not None:
        db_category.parent_id = category.parent_id
    if category.level is not None:
        db_category.level = category.level
    if category.sort_order is not None:
        db_category.sort_order = category.sort_order
    
    db.commit()
    db.refresh(db_category)
    
    return ApiResponse(data=TermCategoryOut.from_orm(db_category))


@router.delete("/categories/{category_id}", response_model=ApiResponse)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    """删除分类"""
    category = db.query(TermCategory).filter(TermCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="分类不存在")
    
    # 检查是否有术语关联
    term_count = db.query(Term).filter(Term.category_id == category_id).count()
    if term_count > 0:
        raise HTTPException(status_code=400, detail=f"该分类下有 {term_count} 个术语，无法删除")
    
    db.delete(category)
    db.commit()
    
    return ApiResponse(message="分类删除成功")


# ========== 术语 API ==========

@router.get("/terms", response_model=ApiResponse[PaginatedResponse[TermOut]])
def get_terms(
    category_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    sort_by: str = "created_at",
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db)
):
    """分页获取术语列表"""
    query = db.query(Term)
    
    if category_id:
        query = query.filter(Term.category_id == category_id)
    
    # 排序
    if hasattr(Term, sort_by):
        sort_column = getattr(Term, sort_by)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(Term.created_at.desc())
    
    # 分页
    total = query.count()
    offset = (page - 1) * page_size
    terms = query.offset(offset).limit(page_size).all()
    
    # 转换为输出格式
    service = TerminologyService(db)
    term_out_list = [service._term_to_out(t) for t in terms]
    
    return ApiResponse(data=PaginatedResponse(
        items=term_out_list,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    ))


@router.get("/terms/{term_id}", response_model=ApiResponse[TermOut])
def get_term(term_id: int, db: Session = Depends(get_db)):
    """获取单个术语"""
    service = TerminologyService(db)
    term = service.get_term(term_id)
    if not term:
        raise HTTPException(status_code=404, detail="术语不存在")
    return ApiResponse(data=term)


@router.post("/terms", response_model=ApiResponse[TermOut])
def create_term(term: TermCreate, db: Session = Depends(get_db)):
    """创建术语"""
    # 检查分类是否存在
    category = db.query(TermCategory).filter(TermCategory.id == term.category_id).first()
    if not category:
        raise HTTPException(status_code=400, detail="分类不存在")
    
    # 检查术语是否已存在
    existing = db.query(Term).filter(Term.term == term.term).first()
    if existing:
        raise HTTPException(status_code=400, detail="术语已存在")
    
    db_term = Term(**term.dict())
    db.add(db_term)
    db.commit()
    db.refresh(db_term)
    
    service = TerminologyService(db)
    return ApiResponse(data=service._term_to_out(db_term))


@router.put("/terms/{term_id}", response_model=ApiResponse[TermOut])
def update_term(term_id: int, term: TermUpdate, db: Session = Depends(get_db)):
    """更新术语"""
    db_term = db.query(Term).filter(Term.id == term_id).first()
    if not db_term:
        raise HTTPException(status_code=404, detail="术语不存在")
    
    if term.term:
        existing = db.query(Term).filter(
            Term.term == term.term,
            Term.id != term_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="术语已存在")
        db_term.term = term.term
    
    if term.term_en is not None:
        db_term.term_en = term.term_en
    if term.pinyin is not None:
        db_term.pinyin = term.pinyin
    if term.pinyin_abbr is not None:
        db_term.pinyin_abbr = term.pinyin_abbr
    if term.abbreviation is not None:
        db_term.abbreviation = term.abbreviation
    if term.definition is not None:
        db_term.definition = term.definition
    if term.definition_en is not None:
        db_term.definition_en = term.definition_en
    if term.category_id is not None:
        category = db.query(TermCategory).filter(TermCategory.id == term.category_id).first()
        if not category:
            raise HTTPException(status_code=400, detail="分类不存在")
        db_term.category_id = term.category_id
    if term.subcategory is not None:
        db_term.subcategory = term.subcategory
    if term.unit is not None:
        db_term.unit = term.unit
    if term.examples is not None:
        db_term.examples = term.examples
    if term.synonyms is not None:
        db_term.synonyms = term.synonyms
    if term.related_terms is not None:
        db_term.related_terms = term.related_terms
    if term.source is not None:
        db_term.source = term.source
    if term.is_standard is not None:
        db_term.is_standard = term.is_standard
    if term.confidence is not None:
        db_term.confidence = term.confidence
    if term.frequency is not None:
        db_term.frequency = term.frequency
    
    db.commit()
    db.refresh(db_term)
    
    service = TerminologyService(db)
    return ApiResponse(data=service._term_to_out(db_term))


@router.delete("/terms/{term_id}", response_model=ApiResponse)
def delete_term(term_id: int, db: Session = Depends(get_db)):
    """删除术语"""
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="术语不存在")
    
    # 删除相关变体
    db.query(TermVariant).filter(TermVariant.term_id == term_id).delete()
    
    db.delete(term)
    db.commit()
    
    return ApiResponse(message="术语删除成功")


# ========== 术语验证 API ==========

@router.post("/validate", response_model=ApiResponse[TermValidationResponse])
def validate_term(request: TermValidationRequest, db: Session = Depends(get_db)):
    """验证单个术语"""
    service = TerminologyService(db)
    result = service.validate_term(request.term, request.category_id, request.strict_mode)
    return ApiResponse(data=result)


@router.post("/validate/batch", response_model=ApiResponse[List[TermValidationResponse]])
def batch_validate_terms(request: BatchTermValidationRequest, db: Session = Depends(get_db)):
    """批量验证术语"""
    service = TerminologyService(db)
    results = service.batch_validate_terms(request.terms, request.category_id, request.strict_mode)
    return ApiResponse(data=results)


# ========== 术语搜索 API ==========

@router.post("/search", response_model=ApiResponse[List[TermOut]])
def search_terms(request: TermSearchRequest, db: Session = Depends(get_db)):
    """搜索术语"""
    service = TerminologyService(db)
    results = service.search_terms(request.query, request.category_id, request.fuzzy_search, request.max_results)
    return ApiResponse(data=results)


@router.get("/search", response_model=ApiResponse[List[TermOut]])
def search_terms_get(
    query: str = Query(..., max_length=200),
    category_id: Optional[int] = None,
    fuzzy_search: bool = True,
    max_results: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """搜索术语（GET方式）"""
    service = TerminologyService(db)
    results = service.search_terms(query, category_id, fuzzy_search, max_results)
    return ApiResponse(data=results)


# ========== 术语建议 API ==========

@router.post("/suggest", response_model=ApiResponse[TermSuggestionResponse])
def suggest_terms(request: TermSuggestionRequest, db: Session = Depends(get_db)):
    """获取术语建议"""
    service = TerminologyService(db)
    suggestions = service.suggest_terms(request.input, request.limit, request.include_synonyms)
    return ApiResponse(data=TermSuggestionResponse(suggestions=suggestions))


# ========== 术语变体 API ==========

@router.post("/variants", response_model=ApiResponse[TermVariantOut])
def create_term_variant(variant: TermVariantCreate, db: Session = Depends(get_db)):
    """创建术语变体"""
    # 检查术语是否存在
    term = db.query(Term).filter(Term.id == variant.term_id).first()
    if not term:
        raise HTTPException(status_code=400, detail="术语不存在")
    
    # 检查变体是否已存在
    existing = db.query(TermVariant).filter(TermVariant.variant == variant.variant).first()
    if existing:
        raise HTTPException(status_code=400, detail="变体已存在")
    
    db_variant = TermVariant(**variant.dict())
    db.add(db_variant)
    db.commit()
    db.refresh(db_variant)
    
    return ApiResponse(data=TermVariantOut(
        id=db_variant.id,
        variant=db_variant.variant,
        term_id=db_variant.term_id,
        term=term.term,
        similarity=db_variant.similarity,
        variant_type=db_variant.variant_type,
        created_at=db_variant.created_at
    ))


@router.get("/variants", response_model=ApiResponse[List[TermVariantOut]])
def get_term_variants(term_id: Optional[int] = None, db: Session = Depends(get_db)):
    """获取术语变体列表"""
    query = db.query(TermVariant)
    if term_id:
        query = query.filter(TermVariant.term_id == term_id)
    
    variants = query.all()
    result = []
    for v in variants:
        term = db.query(Term).filter(Term.id == v.term_id).first()
        result.append(TermVariantOut(
            id=v.id,
            variant=v.variant,
            term_id=v.term_id,
            term=term.term if term else None,
            similarity=v.similarity,
            variant_type=v.variant_type,
            created_at=v.created_at
        ))
    
    return ApiResponse(data=result)


@router.delete("/variants/{variant_id}", response_model=ApiResponse)
def delete_term_variant(variant_id: int, db: Session = Depends(get_db)):
    """删除术语变体"""
    variant = db.query(TermVariant).filter(TermVariant.id == variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="变体不存在")
    
    db.delete(variant)
    db.commit()
    
    return ApiResponse(message="变体删除成功")


# ========== 标准化规则 API ==========

@router.get("/normalization-rules", response_model=ApiResponse[List[TermNormalizationRuleOut]])
def get_normalization_rules(db: Session = Depends(get_db)):
    """获取所有标准化规则"""
    rules = db.query(TermNormalizationRule).order_by(TermNormalizationRule.priority).all()
    return ApiResponse(data=[TermNormalizationRuleOut.from_orm(r) for r in rules])


@router.post("/normalization-rules", response_model=ApiResponse[TermNormalizationRuleOut])
def create_normalization_rule(rule: TermNormalizationRuleCreate, db: Session = Depends(get_db)):
    """创建标准化规则"""
    db_rule = TermNormalizationRule(**rule.dict())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    
    return ApiResponse(data=TermNormalizationRuleOut.from_orm(db_rule))


@router.put("/normalization-rules/{rule_id}", response_model=ApiResponse[TermNormalizationRuleOut])
def update_normalization_rule(rule_id: int, rule: TermNormalizationRuleCreate, db: Session = Depends(get_db)):
    """更新标准化规则"""
    db_rule = db.query(TermNormalizationRule).filter(TermNormalizationRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    
    db_rule.pattern = rule.pattern
    db_rule.replacement = rule.replacement
    db_rule.rule_type = rule.rule_type
    db_rule.priority = rule.priority
    db_rule.description = rule.description
    db_rule.enabled = rule.enabled
    
    db.commit()
    db.refresh(db_rule)
    
    return ApiResponse(data=TermNormalizationRuleOut.from_orm(db_rule))


@router.delete("/normalization-rules/{rule_id}", response_model=ApiResponse)
def delete_normalization_rule(rule_id: int, db: Session = Depends(get_db)):
    """删除标准化规则"""
    rule = db.query(TermNormalizationRule).filter(TermNormalizationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    
    db.delete(rule)
    db.commit()
    
    return ApiResponse(message="规则删除成功")


# ========== 术语统计 API ==========

@router.get("/statistics", response_model=ApiResponse)
def get_statistics(db: Session = Depends(get_db)):
    """获取术语统计信息"""
    total_terms = db.query(Term).count()
    total_categories = db.query(TermCategory).count()
    total_variants = db.query(TermVariant).count()
    total_validations = db.query(TermValidation).count()
    
    # 按分类统计
    category_stats = []
    categories = db.query(TermCategory).all()
    for cat in categories:
        term_count = db.query(Term).filter(Term.category_id == cat.id).count()
        category_stats.append({
            "category_id": cat.id,
            "category_name": cat.name,
            "term_count": term_count
        })
    
    return ApiResponse(data={
        "total_terms": total_terms,
        "total_categories": total_categories,
        "total_variants": total_variants,
        "total_validations": total_validations,
        "category_stats": category_stats
    })


# ═══════════════════════════════════════════
# 配方输入术语校验 API
# ═══════════════════════════════════════════

@router.post("/validate-input", response_model=ApiResponse[TermValidationResponse])
def validate_term_input(
    request: TermValidationRequest,
    db: Session = Depends(get_db),
):
    """
    验证配方输入中的术语是否标准。

    返回：
    - is_valid: 是否是标准术语
    - standard_name: 标准名称（如果是别名）
    - suggestions: 相似术语建议
    - category: 所属分类
    """
    service = TerminologyService(db)
    result = service.validate_term(request.term)
    return ApiResponse(data=TermValidationResponse(**result))


@router.post("/batch-validate", response_model=ApiResponse)
def batch_validate_terms(
    request: BatchTermValidationRequest,
    db: Session = Depends(get_db),
):
    """批量验证术语"""
    service = TerminologyService(db)
    results = []
    for term_text in request.terms:
        result = service.validate_term(term_text)
        results.append({
            "term": term_text,
            **result,
        })
    return ApiResponse(data={"results": results, "total": len(results)})


@router.get("/suggest", response_model=ApiResponse)
def suggest_terms(
    query: str = Query(..., min_length=1, description="搜索关键词"),
    category: Optional[str] = Query(None, description="分类过滤"),
    limit: int = Query(10, ge=1, le=50, description="返回数量"),
    db: Session = Depends(get_db),
):
    """
    术语建议（用于配方输入时的自动补全）。

    支持模糊匹配和拼音首字母匹配。
    """
    service = TerminologyService(db)
    suggestions = service.search_terms(query, category=category, limit=limit)
    return ApiResponse(data=suggestions)

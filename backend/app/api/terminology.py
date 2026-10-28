"""专业术语API接口 (Async版本)"""
import asyncio
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database.session import get_db
from ..models.terminology import (
    Term,
    TermCategory,
    TermNormalizationRule,
    TermValidation,
    TermVariant,
)
from ..schemas.base import ApiResponse, PaginatedResponse
from ..schemas.terminology import (
    BatchTermValidationRequest,
    TermCategoryCreate,
    TermCategoryOut,
    TermCategoryUpdate,
    TermCreate,
    TermNormalizationRuleCreate,
    TermNormalizationRuleOut,
    TermOut,
    TermSearchRequest,
    TermSuggestionRequest,
    TermSuggestionResponse,
    TermUpdate,
    TermValidationRequest,
    TermValidationResponse,
    TermVariantCreate,
    TermVariantOut,
)
from ..services.terminology_service import TerminologyService

router = APIRouter(prefix="/terminology", tags=["术语管理"])


# ========== 术语分类 API ==========

@router.get("/categories", response_model=ApiResponse[List[TermCategoryOut]])
async def get_categories(db: AsyncSession = Depends(get_db)):
    """获取所有术语分类"""
    result = await db.execute(select(TermCategory).order_by(TermCategory.sort_order))
    categories = result.scalars().all()
    return ApiResponse(data=[TermCategoryOut.from_orm(c) for c in categories])


@router.get("/categories/{category_id}", response_model=ApiResponse[TermCategoryOut])
async def get_category(category_id: int, db: AsyncSession = Depends(get_db)):
    """获取单个分类"""
    result = await db.execute(select(TermCategory).where(TermCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="分类不存在")
    return ApiResponse(data=TermCategoryOut.from_orm(category))


@router.post("/categories", response_model=ApiResponse[TermCategoryOut])
async def create_category(category: TermCategoryCreate, db: AsyncSession = Depends(get_db)):
    """创建分类"""
    result = await db.execute(select(TermCategory).where(TermCategory.name == category.name))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="分类名称已存在")

    db_category = TermCategory(**category.model_dump())
    db.add(db_category)
    await db.commit()
    await db.refresh(db_category)

    return ApiResponse(data=TermCategoryOut.from_orm(db_category))


@router.put("/categories/{category_id}", response_model=ApiResponse[TermCategoryOut])
async def update_category(category_id: int, category: TermCategoryUpdate, db: AsyncSession = Depends(get_db)):
    """更新分类"""
    result = await db.execute(select(TermCategory).where(TermCategory.id == category_id))
    db_category = result.scalar_one_or_none()
    if not db_category:
        raise HTTPException(status_code=404, detail="分类不存在")

    if category.name:
        result = await db.execute(select(TermCategory).where(
            TermCategory.name == category.name,
            TermCategory.id != category_id
        ))
        existing = result.scalar_one_or_none()
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

    await db.commit()
    await db.refresh(db_category)

    return ApiResponse(data=TermCategoryOut.from_orm(db_category))


@router.delete("/categories/{category_id}", response_model=ApiResponse)
async def delete_category(category_id: int, db: AsyncSession = Depends(get_db)):
    """删除分类"""
    result = await db.execute(select(TermCategory).where(TermCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="分类不存在")

    result = await db.execute(select(func.count()).where(Term.category_id == category_id))
    term_count = result.scalar()
    if term_count > 0:
        raise HTTPException(status_code=400, detail=f"该分类下有 {term_count} 个术语，无法删除")

    await db.delete(category)
    await db.commit()

    return ApiResponse(message="分类删除成功")


# ========== 术语 API ==========

@router.get("/terms", response_model=ApiResponse[PaginatedResponse[TermOut]])
async def get_terms(
    category_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    sort_by: str = "created_at",
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db)
):
    """分页获取术语列表"""
    stmt = select(Term)
    if category_id:
        stmt = stmt.where(Term.category_id == category_id)

    # 排序
    if hasattr(Term, sort_by):
        sort_column = getattr(Term, sort_by)
        if sort_order == "desc":
            stmt = stmt.order_by(sort_column.desc())
        else:
            stmt = stmt.order_by(sort_column.asc())
    else:
        stmt = stmt.order_by(Term.created_at.desc())

    # 分页
    total_stmt = select(func.count()).select_from(stmt.subquery())
    result = await db.execute(total_stmt)
    total = result.scalar()

    offset = (page - 1) * page_size
    terms_stmt = stmt.offset(offset).limit(page_size)
    result = await db.execute(terms_stmt)
    terms = result.scalars().all()

    # 转换为输出格式 - 使用 asyncio.gather 并行处理
    service = TerminologyService(db)
    term_out_list = await asyncio.gather(*[service._term_to_out(t) for t in terms])

    return ApiResponse(data=PaginatedResponse(
        items=list(term_out_list),
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    ))


@router.get("/terms/{term_id}", response_model=ApiResponse[TermOut])
async def get_term(term_id: int, db: AsyncSession = Depends(get_db)):
    """获取单个术语"""
    service = TerminologyService(db)
    term = await service.get_term(term_id)
    if not term:
        raise HTTPException(status_code=404, detail="术语不存在")
    return ApiResponse(data=term)


@router.post("/terms", response_model=ApiResponse[TermOut])
async def create_term(term: TermCreate, db: AsyncSession = Depends(get_db)):
    """创建术语"""
    result = await db.execute(select(TermCategory).where(TermCategory.id == term.category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=400, detail="分类不存在")

    result = await db.execute(select(Term).where(Term.term == term.term))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="术语已存在")

    db_term = Term(**term.model_dump())
    db.add(db_term)
    await db.commit()
    await db.refresh(db_term)

    service = TerminologyService(db)
    return ApiResponse(data=await service._term_to_out(db_term))


@router.put("/terms/{term_id}", response_model=ApiResponse[TermOut])
async def update_term(term_id: int, term: TermUpdate, db: AsyncSession = Depends(get_db)):
    """更新术语"""
    result = await db.execute(select(Term).where(Term.id == term_id))
    db_term = result.scalar_one_or_none()
    if not db_term:
        raise HTTPException(status_code=404, detail="术语不存在")

    if term.term:
        result = await db.execute(select(Term).where(
            Term.term == term.term,
            Term.id != term_id
        ))
        existing = result.scalar_one_or_none()
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
        result = await db.execute(select(TermCategory).where(TermCategory.id == term.category_id))
        category = result.scalar_one_or_none()
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

    await db.commit()
    await db.refresh(db_term)

    service = TerminologyService(db)
    return ApiResponse(data=await service._term_to_out(db_term))


@router.delete("/terms/{term_id}", response_model=ApiResponse)
async def delete_term(term_id: int, db: AsyncSession = Depends(get_db)):
    """删除术语"""
    result = await db.execute(select(Term).where(Term.id == term_id))
    term = result.scalar_one_or_none()
    if not term:
        raise HTTPException(status_code=404, detail="术语不存在")

    await db.execute(delete(TermVariant).where(TermVariant.term_id == term_id))

    await db.delete(term)
    await db.commit()

    return ApiResponse(message="术语删除成功")


# ========== 术语验证 API ==========

@router.post("/validate", response_model=ApiResponse[TermValidationResponse])
async def validate_term(request: TermValidationRequest, db: AsyncSession = Depends(get_db)):
    """验证单个术语"""
    service = TerminologyService(db)
    result = await service.validate_term(request.term, request.category_id, request.strict_mode)
    return ApiResponse(data=result)


@router.post("/validate/batch", response_model=ApiResponse[List[TermValidationResponse]])
async def batch_validate_terms(request: BatchTermValidationRequest, db: AsyncSession = Depends(get_db)):
    """批量验证术语"""
    service = TerminologyService(db)
    results = await service.batch_validate_terms(request.terms, request.category_id, request.strict_mode)
    return ApiResponse(data=results)


# ========== 术语搜索 API ==========

@router.post("/search", response_model=ApiResponse[List[TermOut]])
async def search_terms(request: TermSearchRequest, db: AsyncSession = Depends(get_db)):
    """搜索术语"""
    service = TerminologyService(db)
    results = await service.search_terms(request.query, request.category_id, request.fuzzy_search, request.max_results)
    return ApiResponse(data=results)


@router.get("/search", response_model=ApiResponse[List[TermOut]])
async def search_terms_get(
    query: str = Query(..., max_length=200),
    category_id: Optional[int] = None,
    fuzzy_search: bool = True,
    max_results: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db)
):
    """搜索术语（GET方式）"""
    service = TerminologyService(db)
    results = await service.search_terms(query, category_id, fuzzy_search, max_results)
    return ApiResponse(data=results)


# ========== 术语建议 API ==========

@router.post("/suggest", response_model=ApiResponse[TermSuggestionResponse])
async def suggest_terms(request: TermSuggestionRequest, db: AsyncSession = Depends(get_db)):
    """获取术语建议"""
    service = TerminologyService(db)
    suggestions = await service.suggest_terms(request.input, request.limit, request.include_synonyms)
    return ApiResponse(data=TermSuggestionResponse(suggestions=suggestions))


# ========== 术语变体 API ==========

@router.post("/variants", response_model=ApiResponse[TermVariantOut])
async def create_term_variant(variant: TermVariantCreate, db: AsyncSession = Depends(get_db)):
    """创建术语变体"""
    result = await db.execute(select(Term).where(Term.id == variant.term_id))
    term = result.scalar_one_or_none()
    if not term:
        raise HTTPException(status_code=400, detail="术语不存在")

    result = await db.execute(select(TermVariant).where(TermVariant.variant == variant.variant))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="变体已存在")

    db_variant = TermVariant(**variant.model_dump())
    db.add(db_variant)
    await db.commit()
    await db.refresh(db_variant)

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
async def get_term_variants(term_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    """获取术语变体列表"""
    stmt = select(TermVariant)
    if term_id:
        stmt = stmt.where(TermVariant.term_id == term_id)
    result = await db.execute(stmt)
    variants = result.scalars().all()
    result_list = []
    for v in variants:
        term_result = await db.execute(select(Term).where(Term.id == v.term_id))
        term = term_result.scalar_one_or_none()
        result_list.append(TermVariantOut(
            id=v.id,
            variant=v.variant,
            term_id=v.term_id,
            term=term.term if term else None,
            similarity=v.similarity,
            variant_type=v.variant_type,
            created_at=v.created_at
        ))

    return ApiResponse(data=result_list)


@router.delete("/variants/{variant_id}", response_model=ApiResponse)
async def delete_term_variant(variant_id: int, db: AsyncSession = Depends(get_db)):
    """删除术语变体"""
    result = await db.execute(select(TermVariant).where(TermVariant.id == variant_id))
    variant = result.scalar_one_or_none()
    if not variant:
        raise HTTPException(status_code=404, detail="变体不存在")

    await db.delete(variant)
    await db.commit()

    return ApiResponse(message="变体删除成功")


# ========== 标准化规则 API ==========

@router.get("/normalization-rules", response_model=ApiResponse[List[TermNormalizationRuleOut]])
async def get_normalization_rules(db: AsyncSession = Depends(get_db)):
    """获取所有标准化规则"""
    result = await db.execute(select(TermNormalizationRule).order_by(TermNormalizationRule.priority))
    rules = result.scalars().all()
    return ApiResponse(data=[TermNormalizationRuleOut.from_orm(r) for r in rules])


@router.post("/normalization-rules", response_model=ApiResponse[TermNormalizationRuleOut])
async def create_normalization_rule(rule: TermNormalizationRuleCreate, db: AsyncSession = Depends(get_db)):
    """创建标准化规则"""
    db_rule = TermNormalizationRule(**rule.model_dump())
    db.add(db_rule)
    await db.commit()
    await db.refresh(db_rule)

    return ApiResponse(data=TermNormalizationRuleOut.from_orm(db_rule))


@router.put("/normalization-rules/{rule_id}", response_model=ApiResponse[TermNormalizationRuleOut])
async def update_normalization_rule(rule_id: int, rule: TermNormalizationRuleCreate, db: AsyncSession = Depends(get_db)):
    """更新标准化规则"""
    result = await db.execute(select(TermNormalizationRule).where(TermNormalizationRule.id == rule_id))
    db_rule = result.scalar_one_or_none()
    if not db_rule:
        raise HTTPException(status_code=404, detail="规则不存在")

    db_rule.pattern = rule.pattern
    db_rule.replacement = rule.replacement
    db_rule.rule_type = rule.rule_type
    db_rule.priority = rule.priority
    db_rule.description = rule.description
    db_rule.enabled = rule.enabled

    await db.commit()
    await db.refresh(db_rule)

    return ApiResponse(data=TermNormalizationRuleOut.from_orm(db_rule))


@router.delete("/normalization-rules/{rule_id}", response_model=ApiResponse)
async def delete_normalization_rule(rule_id: int, db: AsyncSession = Depends(get_db)):
    """删除标准化规则"""
    result = await db.execute(select(TermNormalizationRule).where(TermNormalizationRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")

    await db.delete(rule)
    await db.commit()

    return ApiResponse(message="规则删除成功")


# ========== 术语统计 API ==========

@router.get("/statistics", response_model=ApiResponse)
async def get_statistics(db: AsyncSession = Depends(get_db)):
    """获取术语统计信息"""
    result = await db.execute(select(func.count()).select_from(Term))
    total_terms = result.scalar()

    result = await db.execute(select(func.count()).select_from(TermCategory))
    total_categories = result.scalar()

    result = await db.execute(select(func.count()).select_from(TermVariant))
    total_variants = result.scalar()

    result = await db.execute(select(func.count()).select_from(TermValidation))
    total_validations = result.scalar()

    # 按分类统计
    result = await db.execute(select(TermCategory))
    categories = result.scalars().all()
    category_stats = []
    for cat in categories:
        result = await db.execute(
            select(func.count()).where(Term.category_id == cat.id).select_from(Term)
        )
        term_count = result.scalar()
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
async def validate_term_input(
    request: TermValidationRequest,
    db: AsyncSession = Depends(get_db),
):
    """验证配方输入中的术语是否标准"""
    service = TerminologyService(db)
    result = await service.validate_term(request.term)
    return ApiResponse(data=TermValidationResponse(**result))


@router.post("/batch-validate", response_model=ApiResponse)
async def batch_validate_terms_v2(
    request: BatchTermValidationRequest,
    db: AsyncSession = Depends(get_db),
):
    """批量验证术语"""
    service = TerminologyService(db)
    results = []
    for term_text in request.terms:
        result = await service.validate_term(term_text)
        results.append({
            "term": term_text,
            **result,
        })
    return ApiResponse(data={"results": results, "total": len(results)})


@router.get("/suggest", response_model=ApiResponse)
async def suggest_terms_v2(
    query: str = Query(..., min_length=1, description="搜索关键词"),
    category: Optional[str] = Query(None, description="分类过滤"),
    limit: int = Query(10, ge=1, le=50, description="返回数量"),
    db: AsyncSession = Depends(get_db),
):
    """术语建议（用于配方输入时的自动补全）"""
    service = TerminologyService(db)
    suggestions = await service.search_terms(query, category=category, limit=limit)
    return ApiResponse(data=suggestions)

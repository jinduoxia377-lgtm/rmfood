"""
食品原料和零售产品搜索 API 路由

对标 Potion AI VFT 的 /search/raw-materials 和 /search/products 端点。
使用共享 router 实例注册到 /databases 前缀下。
"""
import logging
import time
from typing import List

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.schemas.search_new import (
    FoodMaterialSearchRequest,
    FoodMaterialSearchResponse,
    NormalizeRequest,
    NormalizeResponse,
    RetailProductSearchRequest,
    RetailProductSearchResponse,
    SearchSuggestionRequest,
    SearchSuggestionResponse,
)
from app.services.search.bm25_searcher import BM25Searcher
from app.services.search.chinese_nlp import get_nlp_pipeline
from app.services.search.compliance_engine import ComplianceEngine
from app.services.search.hybrid_search import HybridSearchService
from app.services.search.stream_search import StreamSearchService
from app.services.search.vector_searcher import VectorSearcher

# 使用共享 router 实例注册到 /databases 前缀
from . import router

logger = logging.getLogger(__name__)

# ── 食品原料搜索 ──

@router.post("/food-materials", response_model=FoodMaterialSearchResponse)
async def search_food_materials(
    request: FoodMaterialSearchRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    食品原料混合搜索 (BM25 + 向量 RRF 融合)

    对标 Potion AI VFT: POST /search/raw-materials
    """
    start_time = time.time()

    nlp = get_nlp_pipeline()
    normalized_query = nlp.normalize_query(request.query)

    filters = request.filters.model_dump(exclude_none=True) if request.filters else {}

    # 并行执行 BM25 和向量搜索
    bm25_service = BM25Searcher(db)
    vector_service = VectorSearcher(db)

    bm25_results = await bm25_service.search_food_materials(
        normalized_query, filters=filters,
        limit=request.per_page * 2, offset=(request.page - 1) * request.per_page,
    )
    vector_results = await vector_service.search_food_materials(
        normalized_query, top_k=request.per_page * 2,
    )

    # RRF 融合
    hybrid_weights = {
        "bm25_weight": request.search_modes.get("bm25", 0.4),
        "vector_weight": request.search_modes.get("vector", 0.3),
        "rule_weight": request.search_modes.get("rule", 0.3),
    }
    hybrid_service = HybridSearchService(**hybrid_weights)
    fused_results = hybrid_service.search_food_materials(
        bm25_results, vector_results, query=request.query,
    )

    elapsed_ms = (time.time() - start_time) * 1000

    return FoodMaterialSearchResponse(
        query=request.query,
        total=len(fused_results),
        page=request.page,
        per_page=request.per_page,
        results=fused_results[:request.per_page],
        search_time_ms=round(elapsed_ms, 2),
        search_modes_used=request.search_modes,
    )


@router.post("/food-materials/stream")
async def stream_search_food_materials(
    request: FoodMaterialSearchRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    食品原料流式搜索 (SSE)

    对标 Potion AI VFT: POST /search/raw-materials/stream
    """
    nlp = get_nlp_pipeline()
    bm25_service = BM25Searcher(db)
    vector_service = VectorSearcher(db)
    hybrid_weights = {
        "bm25_weight": request.search_modes.get("bm25", 0.4),
        "vector_weight": request.search_modes.get("vector", 0.3),
        "rule_weight": request.search_modes.get("rule", 0.3),
    }
    hybrid_service = HybridSearchService(**hybrid_weights)
    stream_service = StreamSearchService(bm25_service, vector_service, hybrid_service, nlp)

    return stream_service.create_streaming_response(
        query=request.query,
        search_type="food_materials",
        filters=request.filters.model_dump(exclude_none=True) if request.filters else None,
        limit=request.per_page,
    )


# ── 零售产品搜索 ──

@router.post("/retail-products", response_model=RetailProductSearchResponse)
async def search_retail_products(
    request: RetailProductSearchRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    零售产品混合搜索

    对标 Potion AI VFT: POST /search/products
    """
    start_time = time.time()

    nlp = get_nlp_pipeline()
    normalized_query = nlp.normalize_query(request.query)

    filters = request.filters.model_dump(exclude_none=True) if request.filters else {}

    bm25_service = BM25Searcher(db)
    vector_service = VectorSearcher(db)

    bm25_results = await bm25_service.search_retail_products(
        normalized_query, filters=filters,
        limit=request.per_page * 2, offset=(request.page - 1) * request.per_page,
    )
    vector_results = await vector_service.search_retail_products(
        normalized_query, top_k=request.per_page * 2,
    )

    hybrid_service = HybridSearchService(0.4, 0.3, 0.3)
    fused_results = hybrid_service.search_retail_products(
        bm25_results, vector_results, query=request.query,
    )

    elapsed_ms = (time.time() - start_time) * 1000

    return RetailProductSearchResponse(
        query=request.query,
        total=len(fused_results),
        page=request.page,
        per_page=request.per_page,
        results=fused_results[:request.per_page],
        search_time_ms=round(elapsed_ms, 2),
    )


@router.post("/retail-products/stream")
async def stream_search_retail_products(
    request: RetailProductSearchRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """零售产品流式搜索 (SSE)"""
    nlp = get_nlp_pipeline()
    bm25_service = BM25Searcher(db)
    vector_service = VectorSearcher(db)
    hybrid_service = HybridSearchService(0.4, 0.3, 0.3)
    stream_service = StreamSearchService(bm25_service, vector_service, hybrid_service, nlp)

    return stream_service.create_streaming_response(
        query=request.query,
        search_type="retail_products",
        filters=request.filters.model_dump(exclude_none=True) if request.filters else None,
        limit=request.per_page,
    )


# ── 搜索建议 ──

@router.post("/suggest", response_model=SearchSuggestionResponse)
async def get_search_suggestions(
    request: SearchSuggestionRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    搜索建议 (后端驱动)

    对标 Potion AI VFT 的 featured search queries
    """
    from sqlalchemy import select

    from app.models.food_material import FoodMaterial
    from app.models.retail_product import RetailProduct

    nlp = get_nlp_pipeline()
    normalized = nlp.normalize_query(request.query)
    keywords = nlp.extract_keywords(normalized)

    suggestions = []

    # 从食品原料表中匹配
    if "food_materials" in request.search_types:
        for kw in keywords:
            result = await db.execute(
                select(FoodMaterial).where(
                    FoodMaterial.name_cn.like(f"%{kw}%"),
                    FoodMaterial.review_status == "approved",
                ).limit(5)
            )
            for row in result.scalars().all():
                suggestions.append({
                    "text": row.name_cn,
                    "type": "food_material",
                    "score": 0.9,
                })

    # 从零售产品表中匹配
    if "retail_products" in request.search_types:
        for kw in keywords:
            result = await db.execute(
                select(RetailProduct).where(
                    RetailProduct.product_name.like(f"%{kw}%"),
                ).limit(5)
            )
            for row in result.scalars().all():
                suggestions.append({
                    "text": row.product_name,
                    "type": "retail_product",
                    "score": 0.8,
                })

    # 从现有 TCM 表匹配
    if "herbs" in request.search_types:
        from app.models.external_data import TCMHerb
        for kw in keywords:
            result = await db.execute(
                select(TCMHerb).where(
                    TCMHerb.herb_name_cn.like(f"%{kw}%"),
                ).limit(5)
            )
            for row in result.scalars().all():
                suggestions.append({
                    "text": row.herb_name_cn,
                    "type": "herb",
                    "score": 0.85,
                })

    # 去重
    seen = set()
    unique_suggestions = []
    for s in suggestions:
        key = s["text"]
        if key not in seen:
            seen.add(key)
            unique_suggestions.append(s)

    return SearchSuggestionResponse(
        suggestions=unique_suggestions[:request.limit],
    )


# ── 名称标准化 ──

@router.post("/normalize", response_model=NormalizeResponse)
async def normalize_name(
    request: NormalizeRequest,
):
    """
    名称标准化 (对标 Potion AI VFT /incis/normalize)

    将别名/俗名归一化为标准名称
    """
    get_nlp_pipeline()

    # 检查别名映射
    from app.services.search.chinese_nlp import TCM_ALIASES

    canonical = TCM_ALIASES.get(request.name, request.name)
    aliases_found = [alias for alias, canon in TCM_ALIASES.items() if canon == request.name and alias != request.name]

    confidence = 1.0 if canonical == request.name else 0.8
    if request.name in TCM_ALIASES:
        confidence = 0.9

    return NormalizeResponse(
        original=request.name,
        canonical=canonical,
        aliases_found=aliases_found[:10],
        confidence=confidence,
    )


# ── 合规检查 ──

@router.get("/compliance/check")
async def check_compliance(
    material_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """
    检查单个食品原料的合规性
    """
    from sqlalchemy import select

    from app.models.food_material import FoodMaterial

    result = await db.execute(
        select(FoodMaterial).where(FoodMaterial.id == material_id)
    )
    material = result.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="食品原料不存在")

    engine = ComplianceEngine()
    check_result = await engine.check_food_material(material.to_dict())
    return check_result.to_dict()


@router.post("/compliance/formula")
async def check_formula_compliance(
    material_ids: List[int],
    db: AsyncSession = Depends(get_db_session),
):
    """
    检查配方的整体合规性
    """
    from sqlalchemy import select

    from app.models.food_material import FoodMaterial

    result = await db.execute(
        select(FoodMaterial).where(FoodMaterial.id.in_(material_ids))
    )
    materials = result.scalars().all()

    engine = ComplianceEngine()
    formula_items = [m.to_dict() for m in materials]
    check_result = await engine.check_formula_compliance(formula_items)
    return check_result.to_dict()

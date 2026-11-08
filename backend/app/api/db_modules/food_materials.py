"""
食品原料和零售产品搜索 API 路由

对标 Potion AI VFT 的 /search/raw-materials 和 /search/products 端点。
使用共享 router 实例注册到 /databases 前缀下。
"""
import logging
import time
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.models.material_field_review import MaterialFieldReview
from app.models.user_model import User
from app.schemas.search_new import (
    REVIEWABLE_MATERIAL_FIELDS,
    FoodMaterialSearchRequest,
    FoodMaterialSearchResponse,
    MaterialFieldReviewCreate,
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

    bm25_service = BM25Searcher(db)
    vector_service = VectorSearcher(db)

    # P0-3 修复：召回阶段不传 offset，两路都取全量前 N 条，
    # offset 只在最终 fused 列表上做 Python 切片，
    # 避免向量路恒取全局 top_k 无 offset 导致的翻页重复/漏项/顺序漂移。
    # N 必须至少覆盖到本页末尾 (page*per_page)，否则深页切片会漏项。
    recall_limit = max(request.per_page * 2, request.page * request.per_page)

    # P1 修复：先探测 embedding 覆盖率，为 0 时跳过向量路，
    # 避免白跑 encode_query（本地 fastembed 模型加载/推理有真实开销）。
    has_embedding = await vector_service.embedding_coverage("food_materials") > 0

    # P1 修复：原注释写"并行"实为顺序 await。
    # 注意：bm25 / vector / count 共用同一个 AsyncSession，SQLAlchemy 禁止
    # 同一会话上真正并发执行多条查询（会抛 "concurrent operations are not
    # permitted"）。因此把向量路与 COUNT 路并发（二者在 FTS 命中后可重叠，
    # 向量路含本地 encode_query 的 CPU 开销，并发收益最大），BM25 召回单独
    # 顺序执行以保证会话安全。
    bm25_results = await bm25_service.search_food_materials(
        normalized_query, filters=filters, limit=recall_limit,
    )
    # 注意：vector 路与 COUNT 路共用同一个 AsyncSession（= 同一条 asyncpg 连接）。
    # asyncpg 禁止在同一连接上并发执行多条查询（会抛 InterfaceError
    # "cannot perform operation: another operation is in progress"）。
    # 早期版本曾用 asyncio.gather 并发这两路，一旦两路同时落入回退分支
    # （FTS 缺 search_vector 列 / pgvector 缺 vector 类型），两个回退查询会在
    # 同一连接上相撞 → 503。因此这里改为顺序执行，保证会话安全。
    if has_embedding:
        vector_results = await vector_service.search_food_materials(
            normalized_query, top_k=recall_limit, filters=filters,
        )
        total = await bm25_service.count_food_materials(
            normalized_query, filters=filters,
        )
    else:
        vector_results = []
        total = await bm25_service.count_food_materials(
            normalized_query, filters=filters,
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

    # P0-3：offset 只在最终 fused 列表上切片
    offset = (request.page - 1) * request.per_page
    page_results = fused_results[offset:offset + request.per_page]

    # total 修正：早期只用 BM25 COUNT，但 RRF 融合后向量路会额外召回 BM25 未命中的
    # 语义相关项（如"活血化瘀"BM25 仅 2 条，融合后可达 8+ 条），导致 total < 实际可返回
    # 结果数，前端分页误判"只有一页"而截断向量结果。取 BM25 COUNT 与融合后总长度的较大者：
    # - 向量额外召回超出 BM25 命中数时用 len(fused_results)，保证这些项可被翻页取到；
    # - BM25 命中数本身超过 recall_limit（如极常见词）时保留 BM25 COUNT，不丢后续页。
    total = max(total, len(fused_results))

    elapsed_ms = (time.time() - start_time) * 1000

    return FoodMaterialSearchResponse(
        query=request.query,
        total=total,  # max(BM25 COUNT, len(fused_results))：覆盖向量额外召回
        page=request.page,
        per_page=request.per_page,
        results=page_results,
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


# ── 字段级审校审计 (material_field_review) ──────────────────────────────────
#
# 专家审校工作流的 provenance 溯源：安全关键字段的「值」仍存 food_materials
# 主表（PUT 语义不变），审校动作的「谁/何时/来源/备注/值快照」追加写入
# material_field_review。一 (material_id, field_name) 唯一，重复审校 upsert
# 覆盖为最新 provenance。reviewed_by 一律由服务端从 current_user 取，绝不
# 接受客户端传入（MaterialFieldReviewCreate extra="forbid" 已在 schema 层拒绝）。


def _json_safe_field_value(material, field_name: str) -> Any:
    """从 FoodMaterial ORM 对象取字段值并转为 JSON 兼容形态（list/dict 原样，其余直接取）。"""
    value = getattr(material, field_name, None)
    if isinstance(value, (list, dict)) or value is None:
        return value
    return value


@router.post("/food-materials/{material_id}/review", summary="提交单字段审校（专家审校工作流）")
async def review_food_material_field(
    material_id: int,
    data: MaterialFieldReviewCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    记录专家对单个安全关键字段的审校动作。

    - 值写入 food_materials 主表（与 PUT 一致），同时在 material_field_review
      upsert 一条 provenance（谁/何时/来源/备注/值快照）。
    - reviewed_by 由服务端从 current_user 取，客户端无法伪造。
    - field_name 必须在 REVIEWABLE_MATERIAL_FIELDS 白名单内。
    - 需要管理员或配方师权限。
    """
    if current_user is None:
        raise HTTPException(status_code=401, detail="未认证，请先登录")
    if current_user.role not in ("admin", "formulator"):
        raise HTTPException(status_code=403, detail="权限不足，需要管理员或配方师权限")

    if data.field_name not in REVIEWABLE_MATERIAL_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=f"字段 '{data.field_name}' 不在可审校白名单内",
        )

    from app.models.food_material import FoodMaterial

    material = (
        await db.execute(select(FoodMaterial).where(FoodMaterial.id == material_id))
    ).scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="食品原料不存在")

    # 1. 更新主表字段值（值真相仍在主表）
    setattr(material, data.field_name, data.value)
    material.updated_at = datetime.now(timezone.utc)
    # 重算中文分词向量（_set_food_search_tokens 定义在 retail_products.py，
    # 本地导入避免 db_modules 子模块间的加载顺序耦合）
    from .retail_products import _set_food_search_tokens
    _set_food_search_tokens(material)

    # 2. upsert 审计 provenance（reviewed_by 服务端取，防越权）
    review = (
        await db.execute(
            select(MaterialFieldReview).where(
                MaterialFieldReview.material_id == material_id,
                MaterialFieldReview.field_name == data.field_name,
            )
        )
    ).scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if review is None:
        review = MaterialFieldReview(
            material_id=material_id,
            field_name=data.field_name,
            value=_json_safe_field_value(material, data.field_name),
            source=data.source,
            review_note=data.review_note,
            reviewed_by=current_user.id,
            reviewed_at=now,
        )
        db.add(review)
    else:
        review.value = _json_safe_field_value(material, data.field_name)
        review.source = data.source
        review.review_note = data.review_note
        review.reviewed_by = current_user.id
        review.reviewed_at = now

    await db.commit()
    await db.refresh(review)
    return review.to_dict()


@router.get("/food-materials/{material_id}/review", summary="查询字段审校 provenance")
async def get_food_material_field_reviews(
    material_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    返回某食品原料各安全关键字段的审校历史（谁/何时/来源/备注/值快照）。

    需认证；管理员/配方师/审校员可读（审校工作流相关角色）。
    """
    if current_user is None:
        raise HTTPException(status_code=401, detail="未认证，请先登录")
    if current_user.role not in ("admin", "formulator", "reviewer"):
        raise HTTPException(status_code=403, detail="权限不足")

    from app.models.food_material import FoodMaterial

    material = (
        await db.execute(select(FoodMaterial).where(FoodMaterial.id == material_id))
    ).scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="食品原料不存在")

    reviews = (
        await db.execute(
            select(MaterialFieldReview)
            .where(MaterialFieldReview.material_id == material_id)
            .order_by(MaterialFieldReview.reviewed_at.desc())
        )
    ).scalars().all()

    return {"material_id": material_id, "items": [r.to_dict() for r in reviews]}

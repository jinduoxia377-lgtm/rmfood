"""
知识库综合API路由
集成中药知识库、食源性多肽知识库、食品法规库
实现智能意图识别与路由，支持缓存机制
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

from .deps import get_db_session
from ..core.performance.cache_system import get_cache, MultiLevelCache
from ..services.data_sources.tcmsp_client import tcmsp_service
from ..services.data_sources.dfbp_client import dfbp_service
# A-39：DFBP_PEPTIDE_DATABASE 是 dfbp_client 的【模块级】常量，不是
#   DFBPSyncService 实例上的属性 —— 原先写 dfbp_service.DFBP_PEPTIDE_DATABASE
#   在无过滤条件下会抛 AttributeError（GET /knowledge-base/peptide/search → 503）。
from ..services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
from ..services.data_sources.china_food_regulations import regulation_service
from ..services.intent_recognition import (
    intent_recognition_service,
    KnowledgeBaseType,
    IntentType,
)

router = APIRouter(prefix="/knowledge-base", tags=["知识数据库"])


# ═══════════════════════════════════════════
# 智能意图识别与路由
# ═══════════════════════════════════════════

@router.post("/query", summary="智能查询接口", description="根据用户查询自动识别意图并路由到相应知识库")
async def smart_query(
    query: str,
    cache: MultiLevelCache = Depends(get_cache),
) -> Dict[str, Any]:
    """
    智能查询接口：自动识别用户意图并路由到相应知识库
    
    Args:
        query: 用户查询文本
        
    Returns:
        查询结果，包含意图识别信息和知识库响应
    """
    # 尝试从缓存获取
    cache_key = f"kb_query:{hash(query)}"
    cached_result = await cache.get(cache_key)
    if cached_result:
        return {
            **cached_result,
            "from_cache": True,
        }
    
    # 意图识别
    kb_type, intent_type, params = intent_recognition_service.recognize_intent(query)
    
    result = {
        "query": query,
        "knowledge_base": kb_type.value,
        "knowledge_base_description": intent_recognition_service.get_knowledge_base_description(kb_type),
        "intent": intent_type.value,
        "intent_description": intent_recognition_service.get_intent_description(intent_type),
        "params": params,
        "from_cache": False,
    }
    
    # 根据意图类型路由到相应知识库
    try:
        if kb_type == KnowledgeBaseType.TCM:
            result["data"] = await _route_tcm_query(intent_type, params)
        elif kb_type == KnowledgeBaseType.PEPTIDE:
            result["data"] = await _route_peptide_query(intent_type, params)
        elif kb_type == KnowledgeBaseType.REGULATION:
            result["data"] = await _route_regulation_query(intent_type, params)
        elif kb_type == KnowledgeBaseType.GENERAL:
            result["data"] = await _route_general_query(intent_type, params)
        else:
            result["data"] = {
                "message": "未识别到查询意图，请尝试使用更具体的关键词",
                "suggestions": [
                    "查询中药材：'人参的功效'、'黄芪的成分'",
                    "查询肽：'Ile-Pro-Pro'、'抗氧化肽'",
                    "查询法规：'GB 2760'、'食品添加剂'",
                ],
            }
    except Exception as e:
        logger.error("查询失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")
    
    # 缓存结果（有效期5分钟）
    await cache.set(cache_key, result, ttl=300)
    
    return result


async def _route_tcm_query(intent_type: IntentType, params: Dict[str, Any]) -> Dict[str, Any]:
    """路由中药知识库查询"""
    entities = params.get("entities", [])
    query = params.get("query", "")
    
    if intent_type == IntentType.TCM_QUERY_HERB:
        # 获取药材名称
        herb_names = [e["value"] for e in entities if e["type"] == "herb"]
        if herb_names:
            return await tcmsp_service.get_food_homology_list(None, keyword=herb_names[0], page=1, page_size=5)
        return await tcmsp_service.get_food_homology_list(None, keyword=query, page=1, page_size=5)
    
    elif intent_type == IntentType.TCM_QUERY_COMPOUND:
        herb_name = next((e["value"] for e in entities if e["type"] == "herb"), None)
        if herb_name:
            return {"compounds": await tcmsp_service.search_compounds(herb_name, None)}
        return {"message": "请指定要查询的药材名称"}
    
    elif intent_type == IntentType.TCM_QUERY_TARGET:
        compounds = [e["value"] for e in entities if e["type"] == "compound"]
        if compounds:
            return {"targets": await tcmsp_service.search_targets(compounds[0], None)}
        return {"message": "请指定要查询的化合物名称"}
    
    elif intent_type == IntentType.TCM_CHECK_HOMOLOGY:
        herb_name = next((e["value"] for e in entities if e["type"] == "herb"), query)
        return await tcmsp_service.check_food_homology(herb_name)
    
    elif intent_type == IntentType.TCM_SEARCH_EFFECTS:
        return await tcmsp_service.get_food_homology_list(None, keyword=query, page=1, page_size=10)
    
    return {"message": "未找到匹配的中药查询结果"}


async def _route_peptide_query(intent_type: IntentType, params: Dict[str, Any]) -> Dict[str, Any]:
    """路由肽知识库查询"""
    entities = params.get("entities", [])
    
    if intent_type == IntentType.PEPTIDE_QUERY_SEQUENCE:
        sequences = [e["value"] for e in entities if e["type"] == "peptide_sequence"]
        if sequences:
            return {"peptide": await dfbp_service.get_peptide_detail(sequences[0])}
        return {"message": "请提供肽序列（如 Ile-Pro-Pro）"}
    
    elif intent_type == IntentType.PEPTIDE_SEARCH_ACTIVITY:
        activities = [e["value"] for e in entities if e["type"] == "activity_type"]
        if activities:
            return {"peptides": await dfbp_service.search_by_activity(activities[0])}
        return {"peptides": await dfbp_service.search_by_activity(params.get("query", ""))}
    
    elif intent_type == IntentType.PEPTIDE_SEARCH_SOURCE:
        return {"peptides": await dfbp_service.search_by_protein(params.get("query", ""))}
    
    return {"message": "未找到匹配的肽查询结果"}


async def _route_regulation_query(intent_type: IntentType, params: Dict[str, Any]) -> Dict[str, Any]:
    """路由法规库查询"""
    entities = params.get("entities", [])
    query = params.get("query", "")
    
    if intent_type == IntentType.REG_QUERY_STANDARD:
        codes = [e["value"] for e in entities if e["type"] == "standard_code"]
        if codes:
            return {"standards": await regulation_service.search_standards(codes[0])}
        return {"standards": await regulation_service.search_standards(query)}
    
    elif intent_type == IntentType.REG_CHECK_ADDITIVE:
        additives = [e["value"] for e in entities if e["type"] == "additive"]
        if additives:
            return {"result": await regulation_service.check_additive_usage(additives[0], "糕点")}
        return {"additives": await regulation_service.search_additives(keyword=query)}
    
    elif intent_type == IntentType.REG_CHECK_HOMOLOGY:
        return {"materials": await regulation_service.get_food_homology_materials(query)}
    
    elif intent_type == IntentType.REG_VALIDATE_FORMULA:
        # 从查询中提取成分
        ingredients = []
        for herb in ["人参", "黄芪", "当归", "枸杞", "灵芝"]:
            if herb in query:
                ingredients.append(herb)
        if ingredients:
            return await regulation_service.validate_formula_ingredients(ingredients)
        return {"message": "请提供要验证的配方成分列表"}
    
    return {"message": "未找到匹配的法规查询结果"}


async def _route_general_query(intent_type: IntentType, params: Dict[str, Any]) -> Dict[str, Any]:
    """路由通用查询"""
    if intent_type == IntentType.GENERAL_HELP:
        return {
            "help": {
                "description": "RMFOOD 知识库系统帮助",
                "endpoints": [
                    {"method": "POST", "path": "/api/v1/knowledge-base/query", "description": "智能查询接口"},
                    {"method": "GET", "path": "/api/v1/knowledge-base/tcm/herbs", "description": "中药知识库"},
                    {"method": "GET", "path": "/api/v1/knowledge-base/peptide/search", "description": "肽知识库"},
                    {"method": "GET", "path": "/api/v1/knowledge-base/regulation/standards", "description": "法规库"},
                ],
                "examples": [
                    "查询中药材：'人参的功效'",
                    "查询肽：'Ile-Pro-Pro'",
                    "查询法规：'GB 2760'",
                    "检查药食同源：'人参是否药食同源'",
                ],
            }
        }
    
    elif intent_type == IntentType.GENERAL_ABOUT:
        tcm_stats = await tcmsp_service.get_sync_stats(None)
        peptide_stats = await dfbp_service.get_sync_stats(None)
        regulation_stats = await regulation_service.get_regulation_summary()
        
        return {
            "system": "RMFOOD 知识库系统",
            "version": "1.0.0",
            "knowledge_bases": [
                {
                    "name": "中药知识库",
                    "description": "TCMSP 药食同源中药材数据库",
                    "count": tcm_stats.get("total_herbs", 0),
                },
                {
                    "name": "食源性多肽知识库",
                    "description": "DFBP 生物活性肽数据库",
                    "count": peptide_stats.get("total_peptides", 0),
                },
                {
                    "name": "中国食品法规库",
                    "description": "食品安全国家标准与法规",
                    "count": regulation_stats["statistics"]["safety_standards"],
                },
            ],
        }
    
    return {"message": "未知的通用查询类型"}


# ═══════════════════════════════════════════
# 中药知识库 API
# ═══════════════════════════════════════════

@router.get("/tcm/herbs", summary="获取药食同源药材列表")
async def get_tcm_herbs(
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    cache: MultiLevelCache = Depends(get_cache),
) -> Dict[str, Any]:
    """获取药食同源药材列表"""
    cache_key = f"tcm_herbs:{keyword}:{page}:{page_size}"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    result = await tcmsp_service.get_food_homology_list(db, keyword, page, page_size)
    await cache.set(cache_key, result, ttl=300)
    return result


@router.get("/tcm/herbs/{herb_name}", summary="获取药材详情")
async def get_tcm_herb_detail(
    herb_name: str,
    cache: MultiLevelCache = Depends(get_cache),
) -> Dict[str, Any]:
    """获取药材详情信息"""
    cache_key = f"tcm_herb_detail:{herb_name}"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    # 搜索药材
    result = await tcmsp_service.get_food_homology_list(None, keyword=herb_name, page=1, page_size=1)
    if result["total"] > 0:
        herb = result["items"][0]
        # 获取化合物信息
        compounds = await tcmsp_service.search_compounds(herb_name, None)
        herb["compounds"] = compounds
        await cache.set(cache_key, herb, ttl=300)
        return herb
    
    raise HTTPException(status_code=404, detail=f"未找到药材: {herb_name}")


@router.get("/tcm/compounds/{herb_name}", summary="获取药材化合物")
async def get_tcm_compounds(
    herb_name: str,
    db: AsyncSession = Depends(get_db_session),
    cache: MultiLevelCache = Depends(get_cache),
) -> Dict[str, Any]:
    """获取药材的活性化合物列表"""
    cache_key = f"tcm_compounds:{herb_name}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    # A-39：search_compounds(herb_name, db) 会 db.execute(...) 查 TCMHerb，
    #   原先这里写死传 None → AttributeError: 'NoneType' object has no attribute
    #   'execute'（GET /knowledge-base/tcm/compounds/{herb_name} → 500）。
    #   改为注入真实会话；服务内部在「库里没有该药材 / 无化合物」时已自带
    #   回退到内置 TCMSP_HERB_DATABASE 的逻辑，所以这里不需要再兜一层。
    compounds = await tcmsp_service.search_compounds(herb_name, db)
    result = {"herb_name": herb_name, "compounds": compounds}
    await cache.set(cache_key, result, ttl=300)
    return result


@router.get("/tcm/homology/{herb_name}", summary="检查药食同源状态")
async def check_tcm_homology(
    herb_name: str,
    cache: MultiLevelCache = Depends(get_cache),
) -> Dict[str, Any]:
    """检查药材是否属于药食同源目录"""
    cache_key = f"tcm_homology:{herb_name}"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    result = await tcmsp_service.check_food_homology(herb_name)
    await cache.set(cache_key, result, ttl=300)
    return result


# ═══════════════════════════════════════════
# 肽知识库 API
# ═══════════════════════════════════════════

@router.get("/peptide/search", summary="搜索肽序列")
async def search_peptides(
    activity_type: Optional[str] = Query(None, description="活性类型"),
    source_protein: Optional[str] = Query(None, description="来源蛋白"),
    threshold: Optional[float] = Query(None, description="活性值阈值"),
    cache: MultiLevelCache = Depends(get_cache),
) -> Dict[str, Any]:
    """搜索肽序列"""
    cache_key = f"peptide_search:{activity_type}:{source_protein}:{threshold}"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    results = []
    if activity_type:
        results = await dfbp_service.search_by_activity(activity_type, threshold)
    elif source_protein:
        results = await dfbp_service.search_by_protein(source_protein)
    else:
        results = DFBP_PEPTIDE_DATABASE[:20]
    
    result = {"peptides": results, "total": len(results)}
    await cache.set(cache_key, result, ttl=300)
    return result


@router.get("/peptide/{sequence}", summary="获取肽序列详情")
async def get_peptide_detail(
    sequence: str,
    cache: MultiLevelCache = Depends(get_cache),
) -> Dict[str, Any]:
    """获取肽序列详细信息"""
    cache_key = f"peptide_detail:{sequence}"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    peptide = await dfbp_service.get_peptide_detail(sequence)
    if peptide:
        await cache.set(cache_key, peptide, ttl=300)
        return peptide
    
    raise HTTPException(status_code=404, detail=f"未找到肽序列: {sequence}")


@router.get("/peptide/activity-types", summary="获取所有活性类型")
async def get_peptide_activity_types(
    cache: MultiLevelCache = Depends(get_cache),
) -> Dict[str, Any]:
    """获取所有活性类型及数量"""
    cache_key = "peptide_activity_types"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    result = {"activity_types": await dfbp_service.get_activity_types()}
    await cache.set(cache_key, result, ttl=600)
    return result


@router.get("/peptide/similar/{sequence}", summary="查找相似肽序列")
async def get_similar_peptides(
    sequence: str,
    min_length: int = Query(2, ge=2, le=5),
    cache: MultiLevelCache = Depends(get_cache),
) -> Dict[str, Any]:
    """查找相似肽序列"""
    cache_key = f"peptide_similar:{sequence}:{min_length}"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    result = {"similar_peptides": await dfbp_service.get_similar_sequences(sequence, min_length)}
    await cache.set(cache_key, result, ttl=300)
    return result


# ═══════════════════════════════════════════
# 食品法规库 API
# ═══════════════════════════════════════════

@router.get("/regulation/standards", summary="获取食品安全标准")
async def get_regulation_standards(
    category: Optional[str] = Query(None, description="标准类别"),
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    cache: MultiLevelCache = Depends(get_cache),
) -> Dict[str, Any]:
    """获取食品安全国家标准"""
    cache_key = f"reg_standards:{category}:{keyword}"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    if keyword:
        result = {"standards": await regulation_service.search_standards(keyword)}
    elif category:
        result = {"standards": await regulation_service.get_standards_by_category(category)}
    else:
        result = {"standards": await regulation_service.get_standards_by_category()}
    
    await cache.set(cache_key, result, ttl=600)
    return result


@router.get("/regulation/homology", summary="获取药食同源物质目录")
async def get_regulation_homology(
    name: Optional[str] = Query(None, description="物质名称"),
    cache: MultiLevelCache = Depends(get_cache),
) -> Dict[str, Any]:
    """获取药食同源物质目录"""
    cache_key = f"reg_homology:{name}"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    result = {"materials": await regulation_service.get_food_homology_materials(name)}
    await cache.set(cache_key, result, ttl=600)
    return result


@router.get("/regulation/new-food-materials", summary="获取新食品原料目录")
async def get_regulation_new_food_materials(
    name: Optional[str] = Query(None, description="原料名称"),
    cache: MultiLevelCache = Depends(get_cache),
) -> Dict[str, Any]:
    """获取新食品原料目录"""
    cache_key = f"reg_new_food:{name}"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    result = {"materials": await regulation_service.get_new_food_materials(name)}
    await cache.set(cache_key, result, ttl=600)
    return result


@router.get("/regulation/additives", summary="搜索食品添加剂")
async def search_regulation_additives(
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    function: Optional[str] = Query(None, description="功能分类"),
    cache: MultiLevelCache = Depends(get_cache),
) -> Dict[str, Any]:
    """搜索食品添加剂"""
    cache_key = f"reg_additives:{keyword}:{function}"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    result = {"additives": await regulation_service.search_additives(keyword, function)}
    await cache.set(cache_key, result, ttl=600)
    return result


@router.get("/regulation/additive-check", summary="检查添加剂使用规定")
async def check_additive_usage(
    additive_name: str = Query(..., description="添加剂名称"),
    food_category: str = Query("糕点", description="食品类别"),
    cache: MultiLevelCache = Depends(get_cache),
) -> Dict[str, Any]:
    """检查添加剂在特定食品类别中的使用规定"""
    cache_key = f"reg_additive_check:{additive_name}:{food_category}"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    result = await regulation_service.check_additive_usage(additive_name, food_category)
    await cache.set(cache_key, result, ttl=600)
    return result


@router.post("/regulation/validate-formula", summary="验证配方合规性")
async def validate_formula(
    ingredients: List[str],
    cache: MultiLevelCache = Depends(get_cache),
) -> Dict[str, Any]:
    """验证配方成分的合规性"""
    cache_key = f"reg_validate:{hash(tuple(sorted(ingredients)))}"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    result = await regulation_service.validate_formula_ingredients(ingredients)
    await cache.set(cache_key, result, ttl=300)
    return result


@router.get("/regulation/summary", summary="法规库概览")
async def get_regulation_summary(
    cache: MultiLevelCache = Depends(get_cache),
) -> Dict[str, Any]:
    """获取法规库概览信息"""
    cache_key = "reg_summary"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    result = await regulation_service.get_regulation_summary()
    await cache.set(cache_key, result, ttl=600)
    return result


# ═══════════════════════════════════════════
# 系统信息与统计
# ═══════════════════════════════════════════

@router.get("/summary", summary="知识库系统概览")
async def get_knowledge_base_summary(
    cache: MultiLevelCache = Depends(get_cache),
) -> Dict[str, Any]:
    """获取知识库系统整体概览"""
    cache_key = "kb_summary"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    tcm_stats = await tcmsp_service.get_sync_stats(None)
    peptide_stats = await dfbp_service.get_sync_stats(None)
    regulation_stats = await regulation_service.get_regulation_summary()
    
    result = {
        "system": "RMFOOD 知识库系统",
        "version": "1.0.0",
        "knowledge_bases": [
            {
                "id": "tcm",
                "name": "中药知识库",
                "description": "TCMSP 药食同源中药材数据库",
                "total": tcm_stats.get("total_herbs", 0),
                "categories": tcm_stats.get("categories", {}),
            },
            {
                "id": "peptide",
                "name": "食源性多肽知识库",
                "description": "DFBP 生物活性肽数据库",
                "total": peptide_stats.get("total_peptides", 0),
                "activity_types": peptide_stats.get("activity_types", {}),
            },
            {
                "id": "regulation",
                "name": "中国食品法规库",
                "description": "食品安全国家标准与法规",
                "statistics": regulation_stats["statistics"],
            },
        ],
        "cache_stats": cache.get_stats(),
    }
    
    await cache.set(cache_key, result, ttl=600)
    return result


@router.delete("/cache/clear", summary="清除知识库缓存")
async def clear_knowledge_base_cache(
    cache: MultiLevelCache = Depends(get_cache),
) -> Dict[str, Any]:
    """清除知识库相关缓存"""
    await cache.clear_all()
    return {"status": "success", "message": "知识库缓存已清除"}


# ═══════════════════════════════════════════
# 知识图谱查询 API
# ═══════════════════════════════════════════

@router.get("/graph/nodes", summary="获取图谱节点列表")
async def get_graph_nodes(
    node_type: Optional[str] = Query(None, description="节点类型过滤: herb/compound/target/disease"),
    limit: int = Query(100, ge=1, le=1000, description="返回数量"),
    offset: int = Query(0, ge=0, description="偏移量"),
    cache: MultiLevelCache = Depends(get_cache),
):
    """获取知识图谱节点列表，支持类型过滤和分页"""
    cache_key = f"graph_nodes:{node_type}:{limit}:{offset}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    from ..services.kg.graph_engine import KnowledgeGraphEngine
    engine = KnowledgeGraphEngine()

    nodes = await engine.get_nodes(node_type=node_type, limit=limit, offset=offset)
    result = {
        "nodes": nodes,
        "total": len(nodes),
        "limit": limit,
        "offset": offset,
    }

    await cache.set(cache_key, result, ttl=300)
    return result


@router.get("/graph/search", summary="搜索图谱节点")
async def search_graph_nodes(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    node_type: Optional[str] = Query(None, description="节点类型过滤"),
    limit: int = Query(20, ge=1, le=200, description="返回数量"),
    cache: MultiLevelCache = Depends(get_cache),
):
    """搜索知识图谱中的节点（支持模糊匹配）"""
    cache_key = f"graph_search:{q}:{node_type}:{limit}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    from ..services.kg.graph_engine import KnowledgeGraphEngine
    engine = KnowledgeGraphEngine()

    nodes = await engine.search_nodes(q, node_type=node_type, limit=limit)
    result = {
        "query": q,
        "nodes": nodes,
        "total": len(nodes),
    }

    await cache.set(cache_key, result, ttl=300)
    return result


@router.get("/graph/neighbors", summary="获取节点邻居关系")
async def get_node_neighbors(
    node_id: str = Query(..., description="节点ID"),
    depth: int = Query(1, ge=1, le=3, description="搜索深度"),
    cache: MultiLevelCache = Depends(get_cache),
):
    """获取节点的邻居关系（支持多跳搜索）"""
    cache_key = f"graph_neighbors:{node_id}:{depth}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    from ..services.kg.graph_engine import KnowledgeGraphEngine
    engine = KnowledgeGraphEngine()

    neighbors = await engine.get_neighbors(node_id, depth=depth)
    result = {
        "node_id": node_id,
        "depth": depth,
        "neighbors": neighbors,
        "total_edges": sum(len(v) for v in neighbors.values()),
    }

    await cache.set(cache_key, result, ttl=300)
    return result


@router.get("/graph/subgraph", summary="提取子图")
async def get_subgraph(
    seed_nodes: str = Query(..., description="种子节点ID列表，逗号分隔"),
    max_depth: int = Query(2, ge=1, le=5, description="最大搜索深度"),
    cache: MultiLevelCache = Depends(get_cache),
):
    """从种子节点出发提取连通子图"""
    node_ids = [nid.strip() for nid in seed_nodes.split(",") if nid.strip()]
    if not node_ids:
        raise HTTPException(status_code=400, detail="至少提供一个种子节点ID")

    cache_key = f"graph_subgraph:{','.join(node_ids)}:{max_depth}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    from ..services.kg.graph_engine import KnowledgeGraphEngine
    engine = KnowledgeGraphEngine()

    subgraph = await engine.extract_subgraph(node_ids, max_depth=max_depth)
    result = {
        "seed_nodes": node_ids,
        "max_depth": max_depth,
        "subgraph": subgraph,
    }

    await cache.set(cache_key, result, ttl=300)
    return result


@router.get("/graph/pagerank", summary="PageRank 中心性排名")
async def get_page_rank(
    top_n: int = Query(50, ge=1, le=500, description="返回前N个节点"),
    cache: MultiLevelCache = Depends(get_cache),
):
    """计算知识图谱的 PageRank 中心性排名"""
    cache_key = f"graph_pagerank:{top_n}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    from ..services.kg.graph_engine import KnowledgeGraphEngine
    engine = KnowledgeGraphEngine()

    # A-27：随 graph_engine 里同名方法的改名同步（原 compute_pagerank 被后面的
    #       简化版覆盖，导致知识图谱的中心性接口 500）。
    scores = await engine.compute_herb_pagerank(top_n=top_n)
    result = {
        "algorithm": "PageRank",
        "top_n": top_n,
        "scores": scores,
    }

    await cache.set(cache_key, result, ttl=600)
    return result
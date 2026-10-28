"""药食同源疾病→中药推荐 API 路由

提供基于网络药理学知识图谱的疾病检索接口：
- GET  /api/v1/herb-food/diseases          — 疾病列表（支持搜索）
- GET  /api/v1/herb-food/herbs            — 所有药食同源中药列表
- POST /api/v1/herb-food/query            — 疾病 → 中药排名查询
- GET  /api/v1/herb-food/stats/{disease}  — 疾病图谱统计
- GET  /api/v1/herb-food/chain            — 中药-疾病分子链路（用于可视化）
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db_session
from app.models.user_model import User
from app.services.herb_food_query import (
    CN_TO_EN_DISEASE,
    HerbFoodQueryService,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/herb-food", tags=["药食同源配方推荐"])


# ── Pydantic 请求/响应模型 ──────────────────────────────────────

class DiseaseSearchResponse(BaseModel):
    id: int
    name_en: str
    name_cn: Optional[str] = None


class HerbEvidenceItem(BaseModel):
    target_name: str
    compound_name: str


class RankedHerbResponse(BaseModel):
    herb_name_cn: str
    herb_name_en: Optional[str] = None
    target_count: int
    compound_count: int
    evidence: List[HerbEvidenceItem] = []


class DiseaseStatsResponse(BaseModel):
    disease_en: str
    target_count: int
    compound_count: int
    herb_count: int


class HerbDiseaseChain(BaseModel):
    compounds: List[Dict[str, Any]] = []
    targets: List[Dict[str, Any]] = []
    compound_target_map: Dict[str, List[Dict[str, Any]]] = {}


class DiseaseQueryRequest(BaseModel):
    disease: str = Field(..., min_length=1, description="疾病中文名或英文名")
    top_k: int = Field(15, ge=1, le=50, description="返回 Top-N 中药")


class DiseaseQueryResponse(BaseModel):
    disease_en: str
    stats: DiseaseStatsResponse
    herbs: List[RankedHerbResponse]


# ── 路由端点 ────────────────────────────────────────────────────

@router.get("/diseases", response_model=List[DiseaseSearchResponse], summary="搜索可查询疾病")
async def search_diseases(
    q: Optional[str] = Query(None, description="搜索关键词（中英文模糊匹配）"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> List[DiseaseSearchResponse]:
    """搜索药食同源数据库中可查询的疾病，支持中英文模糊匹配。"""
    service = HerbFoodQueryService(db)
    results = await service.search_diseases(q or "", limit=limit)
    return [DiseaseSearchResponse(**r) for r in results]


@router.get("/diseases/all", response_model=List[DiseaseSearchResponse], summary="获取全部疾病列表")
async def list_all_diseases(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> List[DiseaseSearchResponse]:
    """返回所有药食同源关联疾病（中英文）"""
    service = HerbFoodQueryService(db)
    results = await service.get_all_diseases()
    return [DiseaseSearchResponse(**r) for r in results]


@router.get("/herbs", response_model=List[Dict[str, Any]], summary="获取所有药食同源中药")
async def list_all_herbs(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> List[Dict[str, Any]]:
    """返回全部 100 种药食同源中药"""
    service = HerbFoodQueryService(db)
    return await service.get_all_herbs()


@router.post("/query", response_model=DiseaseQueryResponse, summary="疾病→中药排名查询")
async def query_herbs_for_disease(
    req: DiseaseQueryRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> DiseaseQueryResponse:
    """
    核心查询接口：输入疾病名 → 返回按关联强度排序的中药列表。

    流程：
    1. 中文疾病名 → 英文疾病名（精确映射 + 模糊匹配）
    2. 疾病 → 靶点 → 化合物 → 中药 展开
    3. 按靶点数、化合物数降序排列
    4. 返回 Top-K 中药及证据链
    """
    service = HerbFoodQueryService(db)

    # 解析疾病名
    disease_en = await service.resolve_disease(req.disease)
    if not disease_en:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "DISEASE_NOT_FOUND",
                "message": f"知识图谱中未找到疾病: {req.disease}",
                "suggestions": list(CN_TO_EN_DISEASE.keys())[:10],
            },
        )

    # 获取统计
    stats = await service.get_disease_stats(disease_en)
    if not stats:
        raise HTTPException(status_code=404, detail="疾病数据不存在")

    # 获取中药排名
    ranked = await service.rank_herbs_for_disease(disease_en, top_k=req.top_k)

    return DiseaseQueryResponse(
        disease_en=disease_en,
        stats=DiseaseStatsResponse(
            disease_en=stats.disease_en,
            target_count=stats.target_count,
            compound_count=stats.compound_count,
            herb_count=stats.herb_count,
        ),
        herbs=[
            RankedHerbResponse(
                herb_name_cn=h.herb_name_cn,
                herb_name_en=h.herb_name_en,
                target_count=h.target_count,
                compound_count=h.compound_count,
                evidence=[
                    HerbEvidenceItem(
                        target_name=e.target_name,
                        compound_name=e.compound_name,
                    )
                    for e in h.evidence
                ],
            )
            for h in ranked
        ],
    )


@router.get("/stats/{disease}", response_model=DiseaseStatsResponse, summary="疾病图谱统计")
async def get_disease_stats(
    disease: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> DiseaseStatsResponse:
    """获取指定疾病的图谱统计（靶点数、化合物数、中药数）"""
    service = HerbFoodQueryService(db)
    disease_en = await service.resolve_disease(disease)
    if not disease_en:
        raise HTTPException(status_code=404, detail=f"未找到疾病: {disease}")

    stats = await service.get_disease_stats(disease_en)
    if not stats:
        raise HTTPException(status_code=404, detail="疾病数据不存在")

    return DiseaseStatsResponse(
        disease_en=stats.disease_en,
        target_count=stats.target_count,
        compound_count=stats.compound_count,
        herb_count=stats.herb_count,
    )


@router.get("/chain", response_model=HerbDiseaseChain, summary="中药-疾病分子链路")
async def get_herb_disease_chain(
    herb: str = Query(..., description="中药中文名"),
    disease: str = Query(..., description="疾病名（中文或英文）"),
    max_ingredients: int = Query(8, ge=1, le=20),
    max_genes: int = Query(12, ge=1, le=30),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> HerbDiseaseChain:
    """
    获取指定中药与疾病之间的分子关联链路。

    用于前端绘制环形知识图谱（化合物↔靶点双向连接）。
    """
    service = HerbFoodQueryService(db)
    disease_en = await service.resolve_disease(disease)
    if not disease_en:
        raise HTTPException(status_code=404, detail=f"未找到疾病: {disease}")

    chain = await service.get_herb_disease_chain(
        herb_name=herb,
        disease_en=disease_en,
        max_ingredients=max_ingredients,
        max_genes=max_genes,
    )

    return HerbDiseaseChain(
        compounds=[
            {"id": cid, "name": name} for cid, name in chain["compounds"]
        ],
        targets=[
            {"symbol": sym, "name": name} for sym, name in chain["targets"]
        ],
        compound_target_map={
            str(cid): [
                {"target_id": tid, "symbol": sym, "name": tname}
                for tid, sym, tname in pairs
            ]
            for cid, pairs in chain["compound_target_map"].items()
        },
    )

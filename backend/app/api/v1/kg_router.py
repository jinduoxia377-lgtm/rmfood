"""
知识图谱推理 API

提供图谱路径推理、协同效应预测、配伍冲突检测接口。
"""
import logging
from typing import List, Optional

from fastapi import APIRouter
from app.api.deps import CurrentUser
from pydantic import BaseModel, Field

from app.services.kg.reasoning_engine import (
    KnowledgeGraphReasoningEngine,
    get_reasoning_engine,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/kg", tags=["知识图谱推理"])


# ── 请求/响应模型 ─────────────────────────────────────────────────

class PathInferRequest(BaseModel):
    source_herb: str = Field(..., description="源药材")
    target_disease: str = Field(..., description="目标疾病")
    max_depth: int = Field(4, ge=1, le=10, description="最大搜索深度")


class SynergyInferRequest(BaseModel):
    herbs: List[str] = Field(..., min_length=2, description="药材列表（至少2味）")
    population: str = Field("adults", pattern="^(adults|children|pregnancy)$")


class ConflictInferRequest(BaseModel):
    herbs: List[str] = Field(..., min_length=1, description="药材列表")
    population: str = Field("adults", pattern="^(adults|children|pregnancy)$")


class InferAllRequest(BaseModel):
    herbs: List[str] = Field(..., min_length=1, description="药材列表")
    source_herb: Optional[str] = Field(None, description="path推理的源药材")
    target_disease: Optional[str] = Field(None, description="path推理的目标疾病")
    reasoning_type: str = Field("all", pattern="^(path|synergy|conflict|all)$")
    population: str = Field("adults", pattern="^(adults|children|pregnancy)$")


class PathResponse(BaseModel):
    source: str
    target: str
    path: List[str]
    length: int
    confidence: float
    description: str


class SynergyResponse(BaseModel):
    herb_a: str
    herb_b: str
    type: str
    confidence: float
    shared_compounds: List[str]
    shared_targets: List[str]
    reasoning: str


class ConflictResponse(BaseModel):
    herb_a: str
    herb_b: str
    type: str
    severity: str
    description: str
    suggestion: str


class InferAllResponse(BaseModel):
    query: str
    paths: List[PathResponse]
    synergies: List[SynergyResponse]
    conflicts: List[ConflictResponse]
    total_inferences: int


# ── 端点 ──────────────────────────────────────────────────────────


@router.post("/infer/path", summary="路径推理", response_model=dict)
async def infer_path(req: PathInferRequest, current_user: CurrentUser):
    """
    路径推理：发现从源药材到目标疾病的关联路径。

    基于知识图谱的BFS遍历，沿 herb→compound→target→disease 链路搜索。
    """
    engine: KnowledgeGraphReasoningEngine = get_reasoning_engine()
    paths = await engine.infer_path(req.source_herb, req.target_disease)

    return {
        "success": True,
        "data": {
            "source": req.source_herb,
            "target": req.target_disease,
            "paths": [
                {
                    "source": p.source,
                    "target": p.target,
                    "path": p.path,
                    "length": p.path_length,
                    "confidence": p.confidence,
                    "description": p.description,
                }
                for p in paths
            ],
            "total_paths": len(paths),
        },
    }


@router.post("/infer/synergy", summary="协同效应推理", response_model=dict)
async def infer_synergy(req: SynergyInferRequest, current_user: CurrentUser):
    """
    协同效应推理：分析多味药材的组合效应。

    基于共同化合物、共同靶点和中医配伍理论，判断协同/拮抗/独立关系。
    """
    engine: KnowledgeGraphReasoningEngine = get_reasoning_engine()
    synergies = await engine.infer_synergy(req.herbs)

    return {
        "success": True,
        "data": {
            "herbs": req.herbs,
            "synergies": [
                {
                    "herb_a": s.herb_a,
                    "herb_b": s.herb_b,
                    "type": s.synergy_type.value,
                    "confidence": s.confidence,
                    "shared_compounds": s.shared_compounds,
                    "shared_targets": s.shared_targets,
                    "reasoning": s.reasoning,
                }
                for s in synergies
            ],
            "total_synergies": len(synergies),
        },
    }


@router.post("/infer/conflict", summary="配伍冲突检测", response_model=dict)
async def infer_conflict(req: ConflictInferRequest, current_user: CurrentUser):
    """
    配伍冲突检测：检测十八反十九畏、人群禁忌等配伍问题。

    自动检测：
    - 十八反十九畏禁忌搭配
    - 儿童禁忌药材
    - 孕妇禁忌药材
    """
    engine: KnowledgeGraphReasoningEngine = get_reasoning_engine()
    conflicts = await engine.infer_conflicts(req.herbs, req.population)

    return {
        "success": True,
        "data": {
            "herbs": req.herbs,
            "population": req.population,
            "conflicts": [
                {
                    "herb_a": c.herb_a,
                    "herb_b": c.herb_b,
                    "type": c.conflict_type.value,
                    "severity": c.severity,
                    "description": c.description,
                    "suggestion": c.suggestion,
                }
                for c in conflicts
            ],
            "total_conflicts": len(conflicts),
        },
    }


@router.post("/infer/all", summary="综合推理", response_model=InferAllResponse)
async def infer_all(req: InferAllRequest, current_user: CurrentUser):
    """
    综合推理：一次性执行路径发现、协同效应分析和配伍冲突检测。

    返回完整的推理报告，适用于配方整体评估。
    """
    engine: KnowledgeGraphReasoningEngine = get_reasoning_engine()
    report = await engine.infer(
        query=f"分析{req.herbs}",
        inference_type=req.reasoning_type,
        herbs=req.herbs,
    )

    return {
        "success": True,
        "data": report.to_dict(),
    }


@router.get("/constraints", summary="前置约束规则列表")
async def list_constraints():
    """
    返回当前生效的合规前置约束规则列表。

    包括药食同源目录限量规则和十八反十九畏禁忌规则。
    """
    from app.services.compliance.preset_constraints import get_constraint_engine

    engine = get_constraint_engine()
    summary = engine.get_constraints_summary()

    return {
        "success": True,
        "data": {
            "total_constraints": len(summary),
            "constraints": summary,
        },
    }


@router.get("/stats", summary="推理统计")
async def get_inference_stats():
    """
    返回推理引擎的统计信息（缓存命中率等）。
    """
    engine: KnowledgeGraphReasoningEngine = get_reasoning_engine()
    stats = engine.get_cache_stats()

    return {
        "success": True,
        "data": stats,
    }

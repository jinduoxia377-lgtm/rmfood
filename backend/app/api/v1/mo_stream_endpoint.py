"""
NSGA-II 多目标配方优化 — 流式 SSE 端点

注意：此端点的依赖类 (MultiObjectiveRequest, _resolve_herb_name 等)
尚未在服务层实现，因此本模块采用防御性导入，避免阻塞主应用启动。
"""
import logging
from typing import Any

from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter(tags=["NSGA-II 多目标优化"])


@router.post("/generate/multi-objective/stream", summary="NSGA-II多目标配方优化(流式SSE)")
async def multi_objective_optimize_stream(**kwargs: Any):
    """暂存端点 — 依赖服务类尚未实现，返回 501"""
    logger.warning("[MOGA/Stream] 端点尚未实现，依赖服务类缺失")
    from fastapi import HTTPException
    raise HTTPException(
        status_code=501,
        detail="NSGA-II 流式优化端点尚未实现，依赖服务类 (MultiObjectiveRequest 等) 缺失",
    )

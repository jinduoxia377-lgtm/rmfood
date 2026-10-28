"""
NSGA-II 多目标配方优化 — 流式 SSE 端点（v1 兼容路径）

此端点委托给 ai_modules/genetic.py 中已实现的
`generate_multi_objective_stream`（挂载于 /api/v1/ai/generate/multi-objective/stream），
复用其 SSE 流式逻辑，避免重复实现。不再返回 501。
"""
import logging

from fastapi import APIRouter, Depends

from ..ai_modules import User, get_current_active_user
from ..ai_modules.genetic import MultiObjectiveRequest, generate_multi_objective_stream

logger = logging.getLogger(__name__)

router = APIRouter(tags=["NSGA-II 多目标优化"])


@router.post("/generate/multi-objective/stream", summary="NSGA-II多目标配方优化(流式SSE)")
async def multi_objective_optimize_stream(
    req: MultiObjectiveRequest,
    current_user: User = Depends(get_current_active_user),
):
    """委托给 ai_modules/genetic.py 的真实 SSE 实现（不再返回 501）"""
    return await generate_multi_objective_stream(req, current_user)

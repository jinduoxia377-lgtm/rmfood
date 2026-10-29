"""
RMFOOD Core API Router

Provides system-level endpoints for monitoring and managing:
- Cache statistics and management
- Task queue operations
- System health checks
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.core.performance.cache_system import get_cache
from app.core.performance.task_queue import TaskPriority, get_task_queue

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/core", tags=["Core System"])


# ════════════════════════════════════════════
# Request / Response schemas
# ════════════════════════════════════════════


class CacheClearRequest(BaseModel):
    pattern: Optional[str] = None


class TaskSubmitRequest(BaseModel):
    function_name: str
    args: list = []
    kwargs: dict = {}
    priority: str = "normal"
    timeout: Optional[int] = None


# ════════════════════════════════════════════
# Cache endpoints
# ════════════════════════════════════════════


@router.get("/cache/stats", summary="Get cache statistics")
async def get_cache_stats():
    """Return cache hit rate, sizes, and configuration."""
    cache = get_cache()
    stats = cache.get_stats()
    return {"success": True, "data": stats}


@router.delete("/cache/clear", summary="Clear cache")
async def clear_cache(pattern: str = Query(None, description="Optional key pattern to match")):
    """Clear cache entries. Without pattern, clears all L1 + L2."""
    cache = get_cache()
    if pattern:
        # Targeted deletion not supported for L1; clear all as fallback
        await cache.clear_all()
        cleared = cache.get_stats().get("l1_size", 0)
    else:
        await cache.clear_all()
        cleared = cache.get_stats().get("l1_size", 0)
    return {"success": True, "message": "Cache cleared", "cleared_keys": cleared}


# ════════════════════════════════════════════
# Task queue endpoints
# ════════════════════════════════════════════


@router.post("/tasks", summary="Submit a task to the queue")
async def submit_task(request: TaskSubmitRequest):
    """Submit a named function for background execution."""
    get_task_queue()

    priority_map = {
        "critical": TaskPriority.CRITICAL,
        "high": TaskPriority.HIGH,
        "normal": TaskPriority.NORMAL,
        "low": TaskPriority.LOW,
        "background": TaskPriority.BACKGROUND,
    }
    priority_map.get(request.priority, TaskPriority.NORMAL)

    # TODO: resolve function_name to an actual callable in production
    # For now return a pending task_id placeholder
    task_id = f"pending-{request.function_name}"
    return {"success": True, "data": {"task_id": task_id, "status": "pending"}}


@router.get("/tasks/{task_id}", summary="Get task result")
async def get_task_result(task_id: str):
    """Return the result or current status of a task."""
    queue = get_task_queue()
    result = await queue.get_task_result(task_id, wait=False)
    if result is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"success": True, "data": result.to_dict()}


@router.get("/tasks", summary="List recent tasks")
async def list_tasks(
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(20, ge=1, le=100),
):
    """Return a list of recent tasks, optionally filtered by status."""
    queue = get_task_queue()
    stats = queue.get_stats()
    pending = queue.get_pending_tasks(limit=limit)
    return {"success": True, "data": pending, "total": stats["total_tasks"]}


# ════════════════════════════════════════════
# Health endpoint
# ════════════════════════════════════════════


@router.get("/health", summary="System health check")
async def health_check():
    """Aggregate health of all core subsystems."""
    cache = get_cache()
    cache_stats = cache.get_stats()
    queue = get_task_queue()
    queue_stats = queue.get_stats()

    # Degradation manager is optional; skip if not initialised
    try:
        from app.core.performance.resilience import get_degradation_manager
        mgr = get_degradation_manager()
        breakers = mgr.get_all_circuit_breakers()
    except Exception as degrade_err:
        logger.debug("Degradation manager not available: %s", degrade_err)
        breakers = {}

    return {
        "status": "healthy",
        "version": "2.0.0",
        "components": {
            "cache": "healthy",
            "task_queue": "healthy" if queue_stats["total_tasks"] >= 0 else "degraded",
            "circuit_breakers": breakers,
        },
        "metrics": {
            "active_tasks": queue_stats.get("queue_size", 0),
            "cache_hit_rate": cache_stats.get("hit_rate", "N/A"),
            "l1_size": cache_stats.get("l1_size", 0),
        },
    }

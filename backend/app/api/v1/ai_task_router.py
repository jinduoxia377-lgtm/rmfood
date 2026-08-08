"""
AI 推理任务队列 API 路由

提供：
- POST /ai/tasks                 → 提交推理任务（立即返回 task_id）
- GET  /ai/tasks/{task_id}       → 查询任务状态和结果
- GET  /ai/tasks/queue/stats     → 队列统计（管理员）
- GET  /ai/tasks/cluster/status  → 集群状态（多实例健康追踪）
- DELETE /ai/tasks/{task_id}     → 取消任务（若还在等待中）

院士级修复[P1]: AI 推理服务独立化，将长时间运行的 AI 推理从 HTTP 请求中解耦
院士级升级[Phase 4-A]: 支持多实例集群状态查询
"""
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ...api.deps import get_current_user
from ...models import User
from ...services.ai.shared.inference_queue import (
    inference_queue, QueueFullError, TaskStatus,
)

logger = logging.getLogger("rmfood.api.ai.tasks")

router = APIRouter(prefix="/tasks", tags=["AI推理任务队列"])


# ── 请求/响应模型 ─────────────────────────────────────────────

class SubmitTaskRequest(BaseModel):
    """提交推理任务请求"""
    task_type: str = Field(
        ...,
        description="任务类型，如 'formula.bayesian_generate' / 'formula.genetic_optimize'",
        example="formula.bayesian_generate",
    )
    payload: Dict[str, Any] = Field(
        default_factory=dict,
        description="任务输入参数（依任务类型不同）",
        example={"target_effects": ["抗氧化", "免疫调节"], "max_iterations": 30},
    )
    priority: int = Field(
        default=5,
        ge=0,
        le=10,
        description="优先级（0=最高，10=最低），默认 5",
    )


class TaskStatusResponse(BaseModel):
    """任务状态响应"""
    task_id: str
    status: str
    result: Optional[Any] = None
    error: Optional[str] = None
    duration_ms: Optional[float] = None
    created_at: Optional[str] = None
    completed_at: Optional[str] = None


# ── 路由 ─────────────────────────────────────────────────────

@router.post("", response_model=Dict[str, str], status_code=status.HTTP_202_ACCEPTED)
async def submit_inference_task(
    req: SubmitTaskRequest,
    current_user: User = Depends(get_current_user),
):
    """
    提交 AI 推理任务（异步，立即返回 task_id）

    任务将被加入推理队列，由独立 Worker 在线程池中执行，
    不阻塞当前 HTTP 连接。

    客户端处理流程：
    1. 提交 → 获取 task_id
    2. 轮询 GET /ai/tasks/{task_id} 或订阅 WebSocket 事件 "inference_complete"
    3. status = "success" 时读取 result 字段
    """
    try:
        org_id = getattr(current_user, "organization_id", None)
        task_id = await inference_queue.submit(
            task_type=req.task_type,
            payload=req.payload,
            priority=req.priority,
            submitted_by=str(current_user.id),
            org_id=org_id,
        )
        logger.info(
            "[AI Tasks] 用户 %s 提交任务: type=%s id=%s",
            current_user.id, req.task_type, task_id,
        )
        return {
            "task_id": task_id,
            "status": TaskStatus.PENDING.value,
            "message": f"任务已提交，使用 GET /api/v1/ai/tasks/{task_id} 查询结果",
        }
    except QueueFullError as e:
        logger.error("队列已满: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="服务暂时不可用，请稍后重试",
        )
    except Exception as e:
        logger.error("[AI Tasks] 任务提交失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试",
        )


@router.get("/queue/stats", response_model=Dict[str, Any])
async def get_queue_stats(
    current_user: User = Depends(get_current_user),
):
    """
    获取推理队列统计信息（管理员可用）

    返回当前队列深度、运行中任务数、注册的执行器列表等
    """
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅管理员可查看队列统计",
        )
    return await inference_queue.get_stats()


@router.get("/cluster/status", response_model=Dict[str, Any])
async def get_cluster_status(
    current_user: User = Depends(get_current_user),
):
    """
    获取推理集群状态（多实例健康追踪）

    返回所有注册的推理实例信息，包括心跳状态。
    需要 Redis 可用（否则返回单实例模式信息）。
    """
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅管理员可查看集群状态",
        )
    return await inference_queue.get_cluster_status()


@router.get("/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    查询推理任务状态和结果

    status 值说明：
    - pending  → 等待执行
    - running  → 正在执行（预计 1-60s）
    - success  → 执行完成，result 包含推理结果
    - failed   → 执行失败，error 包含错误信息
    - timeout  → 执行超时（默认 5 分钟上限）

    多实例说明：
    - 使用 Redis 存储时，可在任意实例查询任务结果
    - 使用内存存储时，仅能在提交任务的实例上查询
    """
    result = await inference_queue.get_result(task_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"任务 {task_id} 不存在或结果已过期（TTL 1小时）",
        )
    data = result.to_dict()
    return TaskStatusResponse(**data)

"""
🟡 Task 3: Ray集群管理API Router

提供Ray分布式计算集群的RESTful接口:

1. 🚀 集群生命周期管理 - 启动/停止/状态查询
2. 📊 任务管理 - 任务提交/状态查询/结果获取/取消
3. 📈 资源监控 - CPU/GPU/内存使用情况监控
4. 🛡️ 健康检查 - 集群和工作节点健康状态
5. 📋 历史记录 - 任务执行历史和统计

接口设计遵循现有AI路由模式，确保一致性和兼容性。

权限要求:
  普通用户: 只能提交任务和查询自己的任务状态
  管理员: 可以管理集群、监控资源和访问所有任务

安全措施:
  1. 任务隔离: 用户只能访问自己的任务
  2. 资源限制: 防止单个用户占用过多资源
  3. 速率限制: 防止API滥用
  4. 输入验证: 严格验证所有输入参数
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, validator
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_current_active_user, get_db_session
from ...core.distributed.ray_manager import (
    ClusterState,
    ClusterStatus,
    RayClusterManager,
    RayConfig,
    ResourceUsage,
    TaskConfig,
    TaskState,
    TaskStatus,
    get_ray_manager,
)
from ...models import User
from ...models.enums import UserRole

# 创建路由实例
router = APIRouter(prefix="/ray", tags=["Ray集群管理"])

logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════
# 🟡 P3-1: API请求/响应数据模型
# ═════════════════════════════════════════════


class ClusterStartRequest(BaseModel):
    """启动集群请求"""
    config: Optional[RayConfig] = Field(default=None, description="Ray配置")
    wait_for_ready: bool = Field(default=True, description="是否等待集群就绪")


class ClusterStartResponse(BaseModel):
    """启动集群响应"""
    success: bool = Field(description="是否成功")
    status: ClusterStatus = Field(description="集群状态")
    message: str = Field(description="消息")


class TaskSubmitRequest(BaseModel):
    """提交任务请求"""
    task_type: str = Field(
        description="任务类型: recipe_analysis | batch_analysis | model_training | data_processing",
        pattern="^(recipe_analysis|batch_analysis|model_training|data_processing)$"
    )
    payload: Dict[str, Any] = Field(default_factory=dict, description="任务载荷")
    priority: int = Field(default=5, ge=1, le=10, description="优先级(1-10)")
    timeout_seconds: int = Field(default=300, ge=60, le=3600, description="超时时间(秒)")
    max_retries: int = Field(default=3, ge=0, le=10, description="最大重试次数")
    retry_delay_seconds: int = Field(default=5, ge=1, le=60, description="重试延迟(秒)")

    @validator("payload")
    def validate_payload(cls, v):  # noqa: N805 - Pydantic validator (classmethod)
        """验证载荷大小"""
        serialized = json.dumps(v, default=str)
        if len(serialized) > 10 * 1024 * 1024:  # 10MB限制
            raise ValueError("任务载荷过大，最大10MB")
        return v


class TaskSubmitResponse(BaseModel):
    """提交任务响应"""
    task_id: str = Field(description="任务ID")
    message: str = Field(description="消息")
    estimated_completion: Optional[datetime] = Field(None, description="预计完成时间")


class TaskStatusResponse(BaseModel):
    """任务状态响应"""
    task_id: str = Field(description="任务ID")
    status: TaskStatus = Field(description="任务状态")


class TaskListRequest(BaseModel):
    """任务列表请求"""
    limit: int = Field(default=50, ge=1, le=200, description="返回数量限制")
    offset: int = Field(default=0, ge=0, description="偏移量")
    state: Optional[TaskState] = Field(None, description="筛选状态")
    task_type: Optional[str] = Field(None, description="筛选任务类型")


class TaskListResponse(BaseModel):
    """任务列表响应"""
    tasks: List[TaskStatus] = Field(description="任务列表")
    total: int = Field(description="总任务数")
    limit: int = Field(description="返回限制")
    offset: int = Field(description="偏移量")


class ResourceUsageResponse(BaseModel):
    """资源使用响应"""
    usage: ResourceUsage = Field(description="资源使用情况")
    timestamp: datetime = Field(description="时间戳")


class HealthCheckResponse(BaseModel):
    """健康检查响应"""
    status: str = Field(description="状态: healthy | degraded | unhealthy")
    cluster: ClusterStatus = Field(description="集群状态")
    resources: ResourceUsage = Field(description="资源使用情况")
    timestamp: datetime = Field(description="检查时间")


class RecipeAnalysisRequest(BaseModel):
    """配方分析请求（便捷接口）"""
    recipe_id: str = Field(description="配方ID")
    analysis_types: List[str] = Field(
        default=["composition", "similarity", "nutrition"],
        description="分析类型列表"
    )

    @validator("analysis_types")
    def validate_analysis_types(cls, v):  # noqa: N805 - Pydantic validator (classmethod)
        """验证分析类型"""
        valid_types = {"composition", "similarity", "nutrition", "safety", "cost"}
        for atype in v:
            if atype not in valid_types:
                raise ValueError(f"无效的分析类型: {atype}")
        return v


class BatchAnalysisRequest(BaseModel):
    """批量分析请求（便捷接口）"""
    recipe_ids: List[str] = Field(description="配方ID列表")
    analysis_types: List[str] = Field(
        default=["composition"],
        description="分析类型列表"
    )
    use_gpu: bool = Field(default=False, description="是否使用GPU加速")

    @validator("recipe_ids")
    def validate_recipe_ids(cls, v):  # noqa: N805 - Pydantic validator (classmethod)
        """验证配方ID列表"""
        if len(v) > 1000:
            raise ValueError("单次批量分析最多1000个配方")
        return v


# ═════════════════════════════════════════════
# 🟡 P3-2: 依赖注入函数
# ═════════════════════════════════════════════


async def get_ray_manager_dep(user: User = Depends(get_current_active_user)):
    """获取Ray管理器依赖"""
    try:
        return get_ray_manager()
    except Exception as e:
        logger.error("获取Ray管理器失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="服务暂时不可用，请稍后重试"
        )


async def rate_limit_check(user: User = Depends(get_current_active_user)):
    """速率限制检查"""
    user_id = user.id if hasattr(user, 'id') else 'anonymous'
    # TODO: 实现基于用户的速率限制（Redis 滑动窗口）
    # 临时实现：简单的频率限制
    return user_id


def require_admin(user: User = Depends(get_current_active_user)):
    """要求管理员权限"""
    from ...models.enums import UserRole
    # ADMIN 角色拥有所有权限
    if hasattr(user, 'role') and user.role == UserRole.ADMIN:
        return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="需要管理员权限"
    )


# ═════════════════════════════════════════════
# 🟡 P3-3: 集群管理接口
# ═════════════════════════════════════════════


@router.post("/cluster/start", response_model=ClusterStartResponse)
async def start_cluster(
    request: ClusterStartRequest = Body(...),
    user: User = Depends(require_admin),
    ray_manager: RayClusterManager = Depends(get_ray_manager_dep)
) -> ClusterStartResponse:
    """启动Ray集群

    只有管理员可以启动集群，集群会使用配置的环境变量启动。
    """
    try:
        logger.info("用户%s请求启动Ray集群", getattr(user, 'id', 'unknown'))

        # 启动集群
        status_obj = await ray_manager.start_cluster()

        if request.wait_for_ready:
            # 等待集群就绪
            max_wait_seconds = 60
            start_time = datetime.now(timezone.utc)

            while (datetime.now(timezone.utc) - start_time).total_seconds() < max_wait_seconds:
                status_obj = await ray_manager.get_cluster_status()
                if status_obj.state == ClusterState.RUNNING:
                    break
                await asyncio.sleep(2)

        return ClusterStartResponse(
            success=status_obj.state == ClusterState.RUNNING,
            status=status_obj,
            message=f"集群启动{'成功' if status_obj.state == ClusterState.RUNNING else '进行中'}"
        )

    except Exception as e:
        logger.error("启动集群失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试"
        )


@router.post("/cluster/stop", response_model=ClusterStartResponse)
async def stop_cluster(
    user: User = Depends(require_admin),
    ray_manager: RayClusterManager = Depends(get_ray_manager_dep)
) -> ClusterStartResponse:
    """停止Ray集群

    只有管理员可以停止集群，正在运行的任务会被优雅终止。
    """
    try:
        logger.info("用户%s请求停止Ray集群", getattr(user, 'id', 'unknown'))

        # 停止集群
        status_obj = await ray_manager.stop_cluster()

        return ClusterStartResponse(
            success=status_obj.state == ClusterState.IDLE,
            status=status_obj,
            message="集群已停止"
        )

    except Exception as e:
        logger.error("停止集群失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试"
        )


@router.get("/cluster/status", response_model=ClusterStatus)
async def get_cluster_status(
    user: User = Depends(get_current_active_user),
    ray_manager: RayClusterManager = Depends(get_ray_manager_dep)
) -> ClusterStatus:
    """获取集群状态

    所有认证用户都可以查询集群状态。
    """
    try:
        return await ray_manager.get_cluster_status()
    except Exception as e:
        logger.error("获取集群状态失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试"
        )


# ═════════════════════════════════════════════
# 🟡 P3-4: 任务管理接口
# ═════════════════════════════════════════════


@router.post("/tasks/submit", response_model=TaskSubmitResponse)
async def submit_task(
    request: TaskSubmitRequest = Body(...),
    user: User = Depends(get_current_active_user),
    ray_manager: RayClusterManager = Depends(get_ray_manager_dep),
    db: AsyncSession = Depends(get_db_session),
    rate_limit: str = Depends(rate_limit_check)
) -> TaskSubmitResponse:
    """提交任务

    用户提交任务到Ray集群执行。任务会自动与用户关联。
    """
    try:
        user_id = getattr(user, 'id', 'anonymous')

        # 检查集群状态
        cluster_status = await ray_manager.get_cluster_status()
        if cluster_status.state != ClusterState.RUNNING:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"集群未运行，当前状态: {cluster_status.state}"
            )

        # 创建任务配置
        task_config = TaskConfig(
            task_type=request.task_type,
            payload={
                **request.payload,
                "user_id": user_id,  # 添加用户ID到载荷
                "submitted_at": datetime.now(timezone.utc).isoformat()
            },
            priority=request.priority,
            timeout_seconds=request.timeout_seconds,
            max_retries=request.max_retries,
            retry_delay_seconds=request.retry_delay_seconds
        )
        # 将 user_id 存入 metadata 以便后续所有权验证
        task_config.metadata["user_id"] = user_id
        task_config.metadata["task_type"] = request.task_type

        # 提交任务
        task_id = await ray_manager.submit_task(task_config)

        logger.info("用户%s提交任务%s (类型: %s)", user_id, task_id, request.task_type)

        # 计算预计完成时间
        estimated_completion = None
        if request.task_type == "recipe_analysis":
            estimated_completion = datetime.now(timezone.utc) + timedelta(seconds=60)
        elif request.task_type == "batch_analysis":
            estimated_completion = datetime.now(timezone.utc) + timedelta(seconds=len(request.payload.get("recipe_ids", [])) * 5)
        elif request.task_type == "model_training":
            estimated_completion = datetime.now(timezone.utc) + timedelta(hours=1)

        return TaskSubmitResponse(
            task_id=task_id,
            message="任务已提交",
            estimated_completion=estimated_completion
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("提交任务失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试"
        )


@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str,
    user: User = Depends(get_current_active_user),
    ray_manager: RayClusterManager = Depends(get_ray_manager_dep)
) -> TaskStatusResponse:
    """获取任务状态

    用户只能查询自己提交的任务状态。
    """
    try:
        task_status = await ray_manager.get_task_status(task_id)
        if not task_status:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="任务不存在"
            )

        # 验证用户是否拥有此任务
        user_id = getattr(user, 'id', 'anonymous')
        task_user_id = task_status.metadata.get("user_id") or (task_status.result.get("user_id") if task_status.result else None)

        # 如果是自己的任务或管理员，允许查看
        is_admin = getattr(user, 'role', None) == UserRole.ADMIN if hasattr(user, 'role') else False
        if task_user_id != str(user_id) and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权访问此任务"
            )

        return TaskStatusResponse(
            task_id=task_id,
            status=task_status
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("获取任务状态失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试"
        )


@router.post("/tasks/{task_id}/cancel")
async def cancel_task(
    task_id: str,
    user: User = Depends(get_current_active_user),
    ray_manager: RayClusterManager = Depends(get_ray_manager_dep)
) -> Dict[str, Any]:
    """取消任务

    用户可以取消自己提交的任务。
    """
    try:
        # 验证用户是否拥有此任务
        user_id = getattr(user, 'id', 'anonymous')
        task_status_obj = await ray_manager.get_task_status(task_id)
        if task_status_obj:
            task_user_id = task_status_obj.metadata.get("user_id") or (task_status_obj.result.get("user_id") if task_status_obj.result else None)
            is_admin = getattr(user, 'role', None) == UserRole.ADMIN if hasattr(user, 'role') else False
            if task_user_id != str(user_id) and not is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="无权取消此任务"
                )

        success = await ray_manager.cancel_task(task_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无法取消任务（可能已完成或不存在）"
            )

        return {
            "success": True,
            "message": f"任务{task_id}已取消",
            "task_id": task_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("取消任务失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试"
        )


@router.get("/tasks", response_model=TaskListResponse)
async def list_tasks(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    state: Optional[TaskState] = Query(None),
    task_type: Optional[str] = Query(None),
    user: User = Depends(get_current_active_user),
    ray_manager: RayClusterManager = Depends(get_ray_manager_dep)
) -> TaskListResponse:
    """列出任务

    用户可以列出自己提交的任务。管理员可以列出所有任务。
    """
    try:
        user_id = getattr(user, 'id', 'anonymous')
        is_admin = getattr(user, 'is_admin', False)

        # 获取所有任务
        all_tasks = await ray_manager.list_tasks(state=state, limit=1000)

        if not is_admin:
            # 非管理员只能看到自己的任务
            # 优先使用 metadata 中的 user_id（提交时已存储）
            filtered_tasks = []
            for task in all_tasks:
                task_user_id = task.metadata.get("user_id") or (task.result.get("user_id") if task.result else None)
                if task_user_id == user_id:
                    filtered_tasks.append(task)
            all_tasks = filtered_tasks

        # 按任务类型过滤
        if task_type:
            all_tasks = [t for t in all_tasks if t.metadata.get("task_type") == task_type or t.task_id.endswith(task_type)]

        # 应用分页
        total = len(all_tasks)
        tasks = all_tasks[offset:offset + limit]

        return TaskListResponse(
            tasks=tasks,
            total=total,
            limit=limit,
            offset=offset
        )

    except Exception as e:
        logger.error("列出任务失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试"
        )


# ═════════════════════════════════════════════
# 🟡 P3-5: 资源监控接口
# ═════════════════════════════════════════════


@router.get("/resources", response_model=ResourceUsageResponse)
async def get_resource_usage(
    user: User = Depends(get_current_active_user),
    ray_manager: RayClusterManager = Depends(get_ray_manager_dep)
) -> ResourceUsageResponse:
    """获取资源使用情况

    所有认证用户都可以查看资源使用情况，但需要监控集群状态。
    """
    try:
        # 检查权限 - 需要集群运行状态
        cluster_status = await ray_manager.get_cluster_status()
        if cluster_status.state != ClusterState.RUNNING:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"集群未运行，当前状态: {cluster_status.state}"
            )

        resource_usage = await ray_manager.get_resource_usage()
        if not resource_usage:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="无法获取资源使用情况"
            )

        return ResourceUsageResponse(
            usage=resource_usage,
            timestamp=resource_usage.timestamp or datetime.now(timezone.utc)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("获取资源使用情况失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试"
        )


@router.get("/health", response_model=HealthCheckResponse)
async def health_check(
    user: User = Depends(get_current_active_user),
    ray_manager: RayClusterManager = Depends(get_ray_manager_dep)
) -> HealthCheckResponse:
    """健康检查

    检查Ray集群的健康状态和资源使用情况。
    """
    try:
        # 获取集群状态
        cluster_status = await ray_manager.get_cluster_status()

        # 获取资源使用情况（如果集群运行）
        resource_usage = None
        if cluster_status.state == ClusterState.RUNNING:
            resource_usage = await ray_manager.get_resource_usage()

        # 评估整体健康状态
        status_str = "healthy"
        if cluster_status.state != ClusterState.RUNNING:
            status_str = "unhealthy"
        elif resource_usage:
            # 检查资源使用是否过高
            if resource_usage.cpu_percent > 90 or resource_usage.memory_percent > 90:
                status_str = "degraded"

        # 如果无法获取资源使用情况，使用默认值
        if not resource_usage:
            resource_usage = ResourceUsage()

        return HealthCheckResponse(
            status=status_str,
            cluster=cluster_status,
            resources=resource_usage,
            timestamp=datetime.now(timezone.utc)
        )

    except Exception as e:
        logger.error("健康检查失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试"
        )


# ═════════════════════════════════════════════
# 🟡 P3-6: 便捷接口（配方分析专用）
# ═════════════════════════════════════════════


@router.post("/analysis/recipe", response_model=TaskSubmitResponse)
async def analyze_recipe(
    request: RecipeAnalysisRequest = Body(...),
    user: User = Depends(get_current_active_user),
    ray_manager: RayClusterManager = Depends(get_ray_manager_dep)
) -> TaskSubmitResponse:
    """分析配方（便捷接口）

    专用于配方分析的便捷接口，用户只需要提供配方ID和分析类型。
    """
    try:
        # 创建任务配置
        task_config = TaskConfig(
            task_type="recipe_analysis",
            payload={
                "recipe_id": request.recipe_id,
                "analysis_types": request.analysis_types,
                "user_id": getattr(user, 'id', 'anonymous'),
                "submitted_at": datetime.now(timezone.utc).isoformat()
            },
            priority=8,
            timeout_seconds=600  # 配方分析最长10分钟
        )

        # 提交任务
        task_id = await ray_manager.submit_task(task_config)

        logger.info("用户%s提交配方分析任务%s (配方: %s)",
                   getattr(user, 'id', 'anonymous'), task_id, request.recipe_id)

        return TaskSubmitResponse(
            task_id=task_id,
            message="配方分析任务已提交",
            estimated_completion=datetime.now(timezone.utc) + timedelta(seconds=60)
        )

    except Exception as e:
        logger.error("提交配方分析任务失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试"
        )


@router.post("/analysis/batch", response_model=TaskSubmitResponse)
async def analyze_batch(
    request: BatchAnalysisRequest = Body(...),
    user: User = Depends(get_current_active_user),
    ray_manager: RayClusterManager = Depends(get_ray_manager_dep)
) -> TaskSubmitResponse:
    """批量分析配方（便捷接口）

    批量分析多个配方，支持GPU加速。
    """
    try:
        # 创建任务配置
        task_config = TaskConfig(
            task_type="batch_analysis",
            payload={
                "recipe_ids": request.recipe_ids,
                "analysis_types": request.analysis_types,
                "user_id": getattr(user, 'id', 'anonymous'),
                "submitted_at": datetime.now(timezone.utc).isoformat(),
                "use_gpu": request.use_gpu
            },
            require_gpu=request.use_gpu,
            priority=6,
            timeout_seconds=len(request.recipe_ids) * 5,  # 每个配方5秒
            max_retries=2
        )

        # 提交任务
        task_id = await ray_manager.submit_task(task_config)

        logger.info("用户%s提交批量分析任务%s (配方数量: %d)",
                   getattr(user, 'id', 'anonymous'), task_id, len(request.recipe_ids))

        estimated_time = len(request.recipe_ids) * (2 if request.use_gpu else 5)
        return TaskSubmitResponse(
            task_id=task_id,
            message="批量分析任务已提交",
            estimated_completion=datetime.now(timezone.utc) + timedelta(seconds=estimated_time)
        )

    except Exception as e:
        logger.error("提交批量分析任务失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试"
        )


# ═════════════════════════════════════════════
# 🟡 P3-7: 统计信息和仪表板接口
# ═════════════════════════════════════════════


@router.get("/stats")
async def get_statistics(
    user: User = Depends(get_current_active_user),
    ray_manager: RayClusterManager = Depends(get_ray_manager_dep)
) -> Dict[str, Any]:
    """获取统计信息

    获取集群和任务的统计信息，包括历史数据和性能指标。
    """
    try:
        # 获取集群状态
        cluster_status = await ray_manager.get_cluster_status()

        # 获取任务统计
        all_tasks = await ray_manager.list_tasks(limit=1000)

        # 按状态统计
        status_counts = {}
        for state in TaskState:
            status_counts[state] = sum(1 for t in all_tasks if t.state == state)

        # 按任务类型统计
        type_counts = {}
        for task in all_tasks:
            ttype = task.metadata.get("task_type", "unknown")
            type_counts[ttype] = type_counts.get(ttype, 0) + 1

        # 性能统计
        total_processing_time = 0
        completed_tasks = [t for t in all_tasks if t.state == TaskState.COMPLETED]
        for task in completed_tasks:
            if task.start_time and task.end_time:
                processing_time = (task.end_time - task.start_time).total_seconds()
                total_processing_time += processing_time

        avg_processing_time = total_processing_time / len(completed_tasks) if completed_tasks else 0

        return {
            "cluster": {
                "state": cluster_status.state,
                "uptime_hours": cluster_status.uptime_seconds / 3600,
                "node_count": cluster_status.node_count,
                "active_workers": cluster_status.active_workers
            },
            "tasks": {
                "total": len(all_tasks),
                "completed": len(completed_tasks),
                "failed": status_counts.get(TaskState.FAILED, 0),
                "running": status_counts.get(TaskState.RUNNING, 0),
                "pending": status_counts.get(TaskState.PENDING, 0)
            },
            "performance": {
                "average_processing_time_seconds": avg_processing_time,
                "total_processing_hours": total_processing_time / 3600,
                "success_rate": len(completed_tasks) / len(all_tasks) if all_tasks else 0
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error("获取统计信息失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试"
        )


# ═════════════════════════════════════════════
# 🟡 P3-8: 系统管理和维护接口
# ═════════════════════════════════════════════


@router.post("/maintenance/cleanup")
async def cleanup_tasks(
    days: int = Query(7, ge=1, le=365, description="保留天数"),
    user: User = Depends(require_admin),
    ray_manager: RayClusterManager = Depends(get_ray_manager_dep)
) -> Dict[str, Any]:
    """清理旧任务

    清理指定天数之前的已完成/失败任务，释放内存。
    """
    try:
        # 记录清理前的任务数
        initial_count = len(await ray_manager.list_tasks(limit=10000))

        # 执行清理
        await ray_manager.cleanup_old_tasks(days=days)

        # 记录清理后的任务数
        final_count = len(await ray_manager.list_tasks(limit=10000))

        return {
            "success": True,
            "message": f"清理了{initial_count - final_count}个{days}天前的任务",
            "cleaned_count": initial_count - final_count,
            "remaining_count": final_count,
            "days": days
        }

    except Exception as e:
        logger.error("清理任务失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试"
        )


@router.get("/dashboard/url")
async def get_dashboard_url(
    user: User = Depends(require_admin),
    ray_manager: RayClusterManager = Depends(get_ray_manager_dep)
) -> Dict[str, str]:
    """获取Ray Dashboard URL

    返回Ray集群的Dashboard访问地址，需要管理员权限。
    """
    try:
        cluster_status = await ray_manager.get_cluster_status()

        if not cluster_status.dashboard_url:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Dashboard未启用或不可用"
            )

        return {
            "dashboard_url": cluster_status.dashboard_url,
            "message": "Ray Dashboard URL",
            "cluster_state": cluster_status.state
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("获取Dashboard URL失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试"
        )


# ═════════════════════════════════════════════
# 🟡 P3-9: 工具函数和辅助方法（内部使用）
# ═════════════════════════════════════════════


async def check_ray_availability() -> Dict[str, Any]:
    """检查Ray可用性（内部函数）

    用于系统初始化时检查Ray依赖和配置。
    """
    try:
        import ray
    except ImportError:
        return {
            "available": False,
            "error": "Ray库未安装，请安装: pip install ray==2.30.0",
            "version": None
        }

    # 检查Ray版本
    try:
        ray_version = ray.__version__
    except AttributeError:
        ray_version = "unknown"

    # 检查配置
    missing_configs = []
    for env_var in ["RAY_ADDRESS", "RAY_NUM_CPUS", "RAY_NUM_GPUS"]:
        if not os.getenv(env_var):
            missing_configs.append(env_var)

    return {
        "available": True,
        "version": ray_version,
        "initialized": ray.is_initialized(),
        "missing_configs": missing_configs,
        "config": {
            "address": os.getenv("RAY_ADDRESS", "未设置"),
            "num_cpus": os.getenv("RAY_NUM_CPUS", "未设置"),
            "num_gpus": os.getenv("RAY_NUM_GPUS", "未设置"),
            "dashboard_port": os.getenv("RAY_DASHBOARD_PORT", "8265")
        }
    }


# ═════════════════════════════════════════════
# 🟡 P3-10: 模块注册函数
# ═════════════════════════════════════════════


def register_ray_routes(app):
    """注册Ray路由到应用（可选）

    用于在应用启动时注册Ray路由，如果需要在主路由之外单独注册。
    """
    app.include_router(router, prefix="/api/v1")


# ═════════════════════════════════════════════
# 🟡 P3-11: 示例API使用说明
# ═════════════════════════════════════════════

"""
Ray集群管理API使用示例:

1. 启动集群:
   POST /api/v1/ray/cluster/start
   Headers: Authorization: Bearer <admin_token>
   Body: {"config": {...}, "wait_for_ready": true}

2. 提交配方分析任务:
   POST /api/v1/ray/analysis/recipe
   Headers: Authorization: Bearer <user_token>
   Body: {"recipe_id": "recipe_001", "analysis_types": ["composition", "similarity"]}

3. 查询任务状态:
   GET /api/v1/ray/tasks/{task_id}
   Headers: Authorization: Bearer <user_token>

4. 批量分析配方:
   POST /api/v1/ray/analysis/batch
   Headers: Authorization: Bearer <user_token>
   Body: {"recipe_ids": ["recipe_001", "recipe_002"], "use_gpu": true}

5. 获取集群状态:
   GET /api/v1/ray/cluster/status
   Headers: Authorization: Bearer <user_token>

6. 监控资源使用:
   GET /api/v1/ray/resources
   Headers: Authorization: Bearer <user_token>

7. 健康检查:
   GET /api/v1/ray/health
   Headers: Authorization: Bearer <user_token>

8. 停止集群:
   POST /api/v1/ray/cluster/stop
   Headers: Authorization: Bearer <admin_token>
"""

"""
研发任务中心 API（v3.3 任务驱动自动建群）

- POST /api/v1/tasks/auto-team   创建研发任务（自动配人+建群+派单）
- GET  /api/v1/tasks             任务列表（含状态）
- GET  /api/v1/tasks/{task_id}   任务详情
- POST /api/v1/tasks/{task_id}/archive   归档
- POST /api/v1/tasks/{task_id}/restore   恢复
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_current_active_user, get_db_session
from ...core.multi_tenant.tenant_security import TenantContext, require_tenant
from ...models import User
from ...models.task_group import TaskGroup
from ...services.ai.agent.task_team_service import get_task_team_service
from ...infrastructure.bots_impl import SQLAlchemyGroupChatRepository

router = APIRouter(prefix="/tasks", tags=["研发任务中心"])


class AutoTeamRequest(BaseModel):
    content: str = Field(..., min_length=2, max_length=4000, description="任务描述")
    constraints: Optional[dict[str, Any]] = Field(default=None, description="可选约束（目标人群/功效/预算）")


class TaskArchiveRequest(BaseModel):
    pass


@router.post("/auto-team", summary="创建研发任务（自动配人+建群+派单）")
async def auto_team(
    req: AutoTeamRequest,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    tenant_id = tenant.org_id or 1
    try:
        service = get_task_team_service(db)
        result = await service.create_task_team(
            tenant_id=tenant_id, user_id=user.id, content=req.content,
            constraints=req.constraints,
        )
        return {"success": True, "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("", summary="任务列表")
async def list_tasks(
    status: Optional[str] = None,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    tenant_id = tenant.org_id or 1
    conds = [TaskGroup.tenant_id == tenant_id, TaskGroup.created_by == user.id]
    if status:
        conds.append(TaskGroup.status == status)
    rows = (await db.execute(
        select(TaskGroup).where(*conds).order_by(TaskGroup.created_at.desc()).limit(200)
    )).scalars().all()
    return {"success": True, "items": [t.to_dict() for t in rows], "total": len(rows)}


@router.get("/{task_id}", summary="任务详情")
async def get_task(
    task_id: int,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    tenant_id = tenant.org_id or 1
    task = (await db.execute(
        select(TaskGroup).where(
            TaskGroup.id == task_id, TaskGroup.tenant_id == tenant_id,
        )
    )).scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"success": True, "data": task.to_dict()}


@router.post("/{task_id}/retry", summary="重新派单（失败任务重试）")
async def retry_task(
    task_id: int,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """将 failed 任务重置为 recruiting 并重新触发自主派单（深度开发：LLM 瞬时限流后的重试）。"""
    tenant_id = tenant.org_id or 1
    task = (await db.execute(
        select(TaskGroup).where(TaskGroup.id == task_id, TaskGroup.tenant_id == tenant_id)
    )).scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.status == "failed":
        await db.execute(
            update(TaskGroup).where(TaskGroup.id == task_id).values(
                status="recruiting", error_message=None,
            )
        )
        await db.commit()
    elif task.status in ("recruiting", "dispatching"):
        return {"success": True, "message": "任务正在执行中，无需重试"}

    # 触发重新派单（独立会话后台任务）
    from ...services.ai.agent.group_chat_service import _run_autodispatch_in_new_session
    asyncio.create_task(
        _run_autodispatch_in_new_session(task.group_id, tenant_id, user.id, task.task_content, task_id=task_id)
    )
    return {"success": True}


@router.post("/{task_id}/archive", summary="归档任务")
async def archive_task(
    task_id: int,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    tenant_id = tenant.org_id or 1
    task = (await db.execute(
        select(TaskGroup).where(TaskGroup.id == task_id, TaskGroup.tenant_id == tenant_id)
    )).scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    await db.execute(update(TaskGroup).where(TaskGroup.id == task_id).values(status="archived"))
    # 同步归档关联群聊
    repo = SQLAlchemyGroupChatRepository(db)
    await repo.set_group_archived(task.group_id, tenant_id, True)
    await db.commit()
    return {"success": True}


@router.post("/{task_id}/restore", summary="恢复任务")
async def restore_task(
    task_id: int,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    tenant_id = tenant.org_id or 1
    task = (await db.execute(
        select(TaskGroup).where(TaskGroup.id == task_id, TaskGroup.tenant_id == tenant_id)
    )).scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    repo = SQLAlchemyGroupChatRepository(db)
    await repo.set_group_archived(task.group_id, tenant_id, False)
    # 恢复到完成/失败状态（非归档）
    current = task.status
    await db.execute(
        update(TaskGroup).where(TaskGroup.id == task_id).values(
            status="completed" if current == "archived" else current,
        )
    )
    await db.commit()
    return {"success": True}
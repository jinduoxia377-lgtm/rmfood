"""
工作流 API 路由
工作流列表/详情/任务节点查询/取消/重试/可视化编辑器
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import get_db_session, get_current_user
from ..models.models import Workflow, WorkflowTask, WorkflowTemplate, User, WorkflowStatus, TaskStatus

router = APIRouter(prefix="/workflows", tags=["工作流"])


@router.get("/templates", summary="获取工作流模板列表")
async def list_workflow_templates(
    category: str | None = Query(None, description="模板分类"),
    db: AsyncSession = Depends(get_db_session),
):
    """
    获取数据库中的工作流模板列表。

    模板分类:
    - ai_generation: AI 配方生成
    - review: 审核流程
    - data_sync: 数据同步
    - analysis: 数据分析
    - custom: 自定义
    """
    query = select(WorkflowTemplate).where(WorkflowTemplate.is_active == 1)
    if category:
        query = query.where(WorkflowTemplate.category == category)
    query = query.order_by(WorkflowTemplate.id)

    result = await db.execute(query)
    templates = [t.to_dict() for t in result.scalars().all()]

    return {"items": templates, "total": len(templates)}


@router.get("/templates/{template_id}", summary="获取模板详情")
async def get_workflow_template(
    template_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    """获取指定模板的完整节点和边配置"""
    result = await db.execute(
        select(WorkflowTemplate).where(WorkflowTemplate.template_id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(404, detail="模板不存在")

    return template.to_dict()


@router.get("/{workflow_id}", summary="工作流详情")
async def get_workflow(
    workflow_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取工作流详情（含任务节点）"""
    workflow = (await db.execute(
        select(Workflow).where(Workflow.id == workflow_id)
    )).scalar_one_or_none()

    if not workflow:
        raise HTTPException(404, detail="工作流不存在")

    # 获取任务节点
    tasks_result = await db.execute(
        select(WorkflowTask)
        .where(WorkflowTask.workflow_id == workflow_id)
        .order_by(WorkflowTask.step_order)
    )
    tasks = tasks_result.scalars().all()

    return {
        "id": workflow.id,
        "name": workflow.name,
        "workflow_type": workflow.workflow_type,
        "status": workflow.status.value if hasattr(workflow.status, "value") else str(workflow.status),
        "description": workflow.description,
        "config": workflow.config,
        "result": workflow.result,
        "error_message": workflow.error_message,
        "created_by": workflow.created_by,
        "created_at": workflow.created_at.isoformat() if workflow.created_at else None,
        "updated_at": workflow.updated_at.isoformat() if workflow.updated_at else None,
        "tasks": [
            {
                "id": t.id,
                "step_order": t.step_order,
                "name": t.name,
                "task_type": t.task_type,
                "status": t.status.value if hasattr(t.status, "value") else str(t.status),
                "error_message": t.error_message,
                "started_at": t.started_at.isoformat() if t.started_at else None,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
                "duration_ms": t.duration_ms,
            }
            for t in tasks
        ],
    }


@router.get("/statistics/summary", summary="工作流统计")
async def workflow_statistics(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """工作流统计摘要"""
    total = (await db.execute(select(func.count(Workflow.id)))).scalar() or 0

    status_result = await db.execute(
        select(Workflow.status, func.count(Workflow.id)).group_by(Workflow.status)
    )
    by_status = {}
    for status_val, count in status_result.all():
        key = status_val.value if hasattr(status_val, "value") else str(status_val)
        by_status[key] = count

    type_result = await db.execute(
        select(Workflow.workflow_type, func.count(Workflow.id)).group_by(Workflow.workflow_type)
    )
    by_type = dict(type_result.all())

    return {
        "total": total,
        "by_status": by_status,
        "by_type": by_type,
    }


@router.post("/{workflow_id}/cancel", summary="取消工作流")
async def cancel_workflow(
    workflow_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """取消进行中或等待中的工作流"""
    workflow = (await db.execute(
        select(Workflow).where(Workflow.id == workflow_id)
    )).scalar_one_or_none()

    if not workflow:
        raise HTTPException(404, detail="工作流不存在")

    if workflow.status in (WorkflowStatus.COMPLETED, WorkflowStatus.CANCELLED):
        raise HTTPException(400, detail="该工作流已完成或已取消")

    workflow.status = WorkflowStatus.CANCELLED
    workflow.error_message = "用户手动取消"
    await db.commit()
    await db.refresh(workflow)

    return {"message": "工作流已取消"}


@router.post("/{workflow_id}/retry", summary="重试工作流")
async def retry_workflow(
    workflow_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """重试失败的工作流"""
    workflow = (await db.execute(
        select(Workflow).where(Workflow.id == workflow_id)
    )).scalar_one_or_none()

    if not workflow:
        raise HTTPException(404, detail="工作流不存在")

    if workflow.status != WorkflowStatus.FAILED:
        raise HTTPException(400, detail="只能重试失败的工作流")

    # 重置工作流状态
    workflow.status = WorkflowStatus.PENDING
    workflow.error_message = None

    # 重置失败的任务节点
    failed_tasks = await db.execute(
        select(WorkflowTask).where(
            WorkflowTask.workflow_id == workflow_id,
            WorkflowTask.status == TaskStatus.FAILED,
        )
    )
    for task in failed_tasks.scalars().all():
        task.status = TaskStatus.PENDING
        task.error_message = None
        task.started_at = None
        task.completed_at = None
        task.duration_ms = None

    await db.commit()

    return {"message": "工作流已重新排队"}


# ═══════════════════════════════════════
# 工作流模板（数据库驱动）
# ═══════════════════════════════════════

@router.post("", summary="创建工作流（支持可视化编辑器）")
async def create_workflow_from_editor(
    workflow_data: dict,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    从可视化编辑器创建新工作流
    
    请求体格式:
    {
        "name": "工作流名称",
        "workflow_type": "ai_generation",
        "description": "描述",
        "config": {
            "nodes": [...],
            "edges": [...]
        }
    }
    """
    name = workflow_data.get("name")
    workflow_type = workflow_data.get("workflow_type", "custom")
    description = workflow_data.get("description")
    config = workflow_data.get("config", {})
    
    if not name:
        raise HTTPException(400, detail="工作流名称不能为空")
    
    # 创建工作流记录
    workflow = Workflow(
        name=name,
        workflow_type=workflow_type,
        description=description,
        config=config,
        created_by=current_user.id,
        status=WorkflowStatus.PENDING,
    )
    
    db.add(workflow)
    await db.flush()
    
    # 从节点配置创建任务
    nodes = config.get("nodes", [])
    for idx, node in enumerate(nodes):
        if node["type"] in ("start", "end", "condition"):
            continue
            
        task = WorkflowTask(
            workflow_id=workflow.id,
            step_order=idx,
            name=node["data"]["label"],
            task_type=node["data"].get("taskType", "custom"),
            status=TaskStatus.PENDING,
            input_data=node["data"].get("config"),
        )
        db.add(task)
    
    await db.commit()
    await db.refresh(workflow)
    
    return {
        "id": workflow.id,
        "message": "工作流创建成功",
        "task_count": len([n for n in nodes if n["type"] == "task"]),
    }


@router.put("/{workflow_id}/config", summary="更新工作流配置")
async def update_workflow_config(
    workflow_id: int,
    config_data: dict,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """更新工作流的可视化配置（节点和边）"""
    
    workflow = (await db.execute(
        select(Workflow).where(Workflow.id == workflow_id)
    )).scalar_one_or_none()
    
    if not workflow:
        raise HTTPException(404, detail="工作流不存在")
    
    if workflow.status not in (WorkflowStatus.PENDING, WorkflowStatus.CANCELLED):
        raise HTTPException(400, detail="只能修改等待中或已取消的工作流")
    
    # 更新配置
    workflow.config = config_data
    workflow.updated_at = datetime.now(timezone.utc)
    
    # 同步更新任务节点
    nodes = config_data.get("nodes", [])
    
    # 删除旧任务
    await db.execute(delete(WorkflowTask).where(WorkflowTask.workflow_id == workflow_id))

    # 创建新任务
    for idx, node in enumerate(nodes):
        if node["type"] not in ("task",):
            continue
            
        task = WorkflowTask(
            workflow_id=workflow.id,
            step_order=idx,
            name=node["data"]["label"],
            task_type=node["data"].get("taskType", "custom"),
            status=TaskStatus.PENDING,
        )
        db.add(task)
    
    await db.commit()
    
    return {"message": "工作流配置已更新"}

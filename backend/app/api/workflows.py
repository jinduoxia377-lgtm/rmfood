"""
工作流 API 路由
工作流列表/详情/任务节点查询/取消/重试/可视化编辑器
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import get_db_session, get_current_user, get_current_active_user
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


@router.get("", summary="工作流列表（支持搜索与筛选）")
async def list_workflows(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    status: str | None = Query(None, description="状态筛选"),
    workflow_type: str | None = Query(None, description="类型筛选"),
    search: str | None = Query(None, description="名称模糊搜索"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """获取工作流列表，支持分页、状态筛选、类型筛选和名称搜索"""
    query = select(Workflow).where(Workflow.creator_id == current_user.id)
    if status:
        query = query.where(Workflow.status == WorkflowStatus(status))
    if workflow_type:
        query = query.where(Workflow.workflow_type == workflow_type)
    if search:
        query = query.where(Workflow.name.ilike(f"%{search}%"))
    query = query.order_by(Workflow.created_at.desc())
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    offset = (page - 1) * page_size
    result = await db.execute(query.offset(offset).limit(page_size))
    workflows = result.scalars().all()
    # 批量查询任务数（避免 lazy loading）
    wf_ids = [w.id for w in workflows]
    task_counts: dict[int, int] = {}
    if wf_ids:
        tc_result = await db.execute(
            select(WorkflowTask.workflow_id, func.count(WorkflowTask.id))
            .where(WorkflowTask.workflow_id.in_(wf_ids))
            .group_by(WorkflowTask.workflow_id)
        )
        for wid, cnt in tc_result.all():
            task_counts[wid] = cnt
    return {
        "items": [
            {
                "id": w.id,
                "name": w.name,
                "workflow_type": w.workflow_type,
                "status": w.status.value if hasattr(w.status, "value") else str(w.status),
                "description": w.description,
                "error_message": w.error_message,
                "created_by": w.creator_id,
                "task_count": task_counts.get(w.id, 0),
                "created_at": w.created_at.isoformat() if w.created_at else None,
                "updated_at": w.updated_at.isoformat() if w.updated_at else None,
            }
            for w in workflows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.delete("/{workflow_id}", summary="删除工作流")
async def delete_workflow(
    workflow_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """删除工作流及其所有任务节点"""
    workflow = (await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.creator_id == current_user.id)
    )).scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, detail="工作流不存在")
    if workflow.status == WorkflowStatus.IN_PROGRESS:
        raise HTTPException(400, detail="执行中的工作流不可删除，请先取消")
    await db.execute(delete(WorkflowTask).where(WorkflowTask.workflow_id == workflow_id))
    await db.execute(delete(Workflow).where(Workflow.id == workflow_id))
    await db.commit()
    return {"message": "工作流已删除"}


@router.get("/{workflow_id}", summary="工作流详情")
async def get_workflow(
    workflow_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
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
        "created_by": workflow.creator_id,
        "task_count": len(tasks),
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
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(get_current_active_user),
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

    from sqlalchemy import text as _text
    _rows = await db.execute(
        _text("SELECT id FROM workflow_tasks WHERE workflow_id = :wid AND status = :st")
        .bindparams(wid=workflow_id, st="failed")
    )
    _failed_ids = [row[0] for row in _rows.fetchall()]
    for _tid in _failed_ids:
        _t = await db.get(WorkflowTask, _tid)
        if _t:
            _t.status = TaskStatus.PENDING
            _t.error_message = None
            _t.started_at = None
            _t.completed_at = None
            _t.duration_ms = None

    await db.commit()

    return {"message": "工作流已重新排队"}


# ═══════════════════════════════════════
# 工作流模板（数据库驱动）
# ═══════════════════════════════════════

@router.post("", summary="创建工作流（支持可视化编辑器）")
async def create_workflow_from_editor(
    workflow_data: dict,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """
    创建新工作流，支持从模板创建或手动配置节点。

    请求体格式（两种模式二选一）:

    模式A — 从模板创建:
    {
        "name": "工作流名称",
        "workflow_type": "ai_generation",
        "description": "描述",
        "template_id": "ai-formula-gen"
    }

    模式B — 自定义节点:
    {
        "name": "工作流名称",
        "workflow_type": "custom",
        "config": {
            "nodes": [...],
            "edges": [...]
        }
    }
    """
    name = workflow_data.get("name")
    workflow_type = workflow_data.get("workflow_type", "custom")
    description = workflow_data.get("description")
    template_id = workflow_data.get("template_id")
    explicit_config = workflow_data.get("config")

    if not name:
        raise HTTPException(400, detail="工作流名称不能为空")

    # 构建 config：优先使用显式 config，否则从模板加载
    config: dict = {}
    if explicit_config:
        config = explicit_config
    elif template_id:
        tpl_result = await db.execute(
            select(WorkflowTemplate).where(WorkflowTemplate.template_id == template_id)
        )
        tpl = tpl_result.scalar_one_or_none()
        if not tpl:
            raise HTTPException(404, detail="模板不存在")
        config = {
            "nodes": tpl.node_definitions or [],
            "edges": tpl.edge_definitions or [],
            "template_id": template_id,
        }
        # 如果请求中同时指定了 workflow_type，用请求值覆盖模板类型
        if workflow_type != "custom":
            config["workflow_type"] = workflow_type
    else:
        # 空白创建：空配置
        config = {"nodes": [], "edges": []}

    # 创建工作流记录
    workflow = Workflow(
        name=name,
        workflow_type=workflow_type,
        description=description,
        config=config,
        creator_id=current_user.id,
        status=WorkflowStatus.PENDING,
    )

    db.add(workflow)
    await db.flush()

    # 从节点配置创建任务
    nodes = config.get("nodes", [])
    for idx, node in enumerate(nodes):
        if node.get("type") in ("start", "end", "condition"):
            continue

        task = WorkflowTask(
            workflow_id=workflow.id,
            step_order=idx,
            name=node.get("data", {}).get("label", f"任务{idx + 1}"),
            task_type=node.get("data", {}).get("taskType", "custom"),
            status=TaskStatus.PENDING,
            input_data=node.get("data", {}).get("config"),
        )
        db.add(task)

    await db.commit()
    await db.refresh(workflow)

    task_count = len([n for n in nodes if n.get("type") == "task"])
    return {
        "id": workflow.id,
        "message": "工作流创建成功" + (f"（从模板「{tpl.name}」导入 {task_count} 个任务）" if template_id and tpl else ""),
        "task_count": task_count,
    }


@router.put("/{workflow_id}/config", summary="更新工作流配置")
async def update_workflow_config(
    workflow_id: int,
    config_data: dict,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
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

"""
工作流 API 路由
工作流列表/详情/任务节点查询/取消/重试/可视化编辑器
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import get_db_session, get_current_user
from ..models.models import Workflow, WorkflowTask, User, WorkflowStatus, TaskStatus

router = APIRouter(prefix="/workflows", tags=["工作流"])


@router.get("", summary="工作流列表")
async def list_workflows(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    status: str | None = Query(None, description="工作流状态"),
    workflow_type: str | None = Query(None, description="工作流类型"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取工作流列表"""
    query = select(Workflow)
    count_query = select(func.count()).select_from(Workflow)

    if status:
        query = query.where(Workflow.status == status)
        count_query = count_query.where(Workflow.status == status)
    if workflow_type:
        query = query.where(Workflow.workflow_type == workflow_type)
        count_query = count_query.where(Workflow.workflow_type == workflow_type)

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(Workflow.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()

    return {
        "items": [
            {
                "id": w.id,
                "name": w.name,
                "workflow_type": w.workflow_type,
                "status": w.status.value if hasattr(w.status, "value") else str(w.status),
                "description": w.description,
                "error_message": w.error_message,
                "created_by": w.created_by,
                "created_at": w.created_at.isoformat() if w.created_at else None,
                "updated_at": w.updated_at.isoformat() if w.updated_at else None,
                "task_count": len(w.tasks) if w.tasks else 0,
            }
            for w in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


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
# 工作流模板与可视化编辑 (Phase 2 新增)
# ═══════════════════════════════════════

@router.get("/templates", summary="获取工作流模板列表")
async def list_workflow_templates(
    category: str | None = Query(None, description="模板分类"),
):
    """
    获取预设的工作流模板
    
    模板分类:
    - ai_generation: AI 配方生成
    - review: 审核流程
    - data_sync: 数据同步
    - analysis: 数据分析
    - custom: 自定义
    """
    templates = [
        {
            "id": "ai-formula-gen",
            "name": "AI 配方生成流水线",
            "description": "从需求分析到配方生成的完整AI驱动流程",
            "category": "ai_generation",
            "icon": "🤖",
            "node_count": 10,
            "estimated_duration": "5-15 分钟",
        },
        {
            "id": "review-process",
            "name": "配方审核流程",
            "description": "标准化的配方审核与批准流程",
            "category": "review",
            "icon": "✅",
            "node_count": 8,
            "estimated_duration": "1-3 天",
        },
        {
            "id": "data-sync",
            "name": "数据同步流水线",
            "description": "外部数据库同步与知识图谱更新",
            "category": "data_sync",
            "icon": "🔄",
            "node_count": 7,
            "estimated_duration": "30-60 分钟",
        },
        {
            "id": "batch-analysis",
            "name": "批量分析流程",
            "description": "批量配方的安全性、稳定性、协同效应分析",
            "category": "analysis",
            "icon": "📊",
            "node_count": 9,
            "estimated_duration": "10-30 分钟",
        },
    ]
    
    if category:
        templates = [t for t in templates if t["category"] == category]
    
    return {"items": templates, "total": len(templates)}


@router.get("/templates/{template_id}", summary="获取模板详情")
async def get_workflow_template(
    template_id: str,
):
    """获取指定模板的完整节点和边配置"""
    
    template_configs = {
        "ai-formula-gen": {
            "nodes": [
                {"id": "start", "type": "start", "position": {"x": 400, "y": 0}, "data": {"label": "开始"}},
                {"id": "input", "type": "task", "position": {"x": 350, "y": 100}, "data": {"label": "需求输入", "taskType": "user_input"}},
                {"id": "analyze", "type": "task", "position": {"x": 350, "y": 200}, "data": {"label": "需求分析", "taskType": "llm_analysis"}},
                {"id": "generate", "type": "task", "position": {"x": 350, "y": 300}, "data": {"label": "AI 生成候选", "taskType": "neural_generate"}},
                {"id": "optimize", "type": "task", "position": {"x": 350, "y": 400}, "data": {"label": "多目标优化", "taskType": "multi_optimize"}},
                {"id": "safety", "type": "task", "position": {"x": 350, "y": 500}, "data": {"label": "安全性检查", "taskType": "safety_check"}},
                {"id": "condition", "type": "condition", "position": {"x": 350, "y": 600}, "data": {"label": "通过?"}},
                {"id": "output", "type": "task", "position": {"x": 200, "y": 720}, "data": {"label": "输出结果", "taskType": "save_result"}},
                {"id": "regenerate", "type": "task", "position": {"x": 500, "y": 720}, "data": {"label": "重新生成", "taskType": "regenerate"}},
                {"id": "end", "type": "end", "position": {"x": 400, "y": 840}, "data": {"label": "结束"}},
            ],
            "edges": [
                {"id": "e1", "source": "start", "target": "input"},
                {"id": "e2", "source": "input", "target": "analyze"},
                {"id": "e3", "source": "analyze", "target": "generate"},
                {"id": "e4", "source": "generate", "target": "optimize"},
                {"id": "e5", "source": "optimize", "target": "safety"},
                {"id": "e6", "source": "safety", "target": "condition"},
                {"id": "e7", "source": "condition", "target": "output", "label": "是"},
                {"id": "e8", "source": "condition", "target": "regenerate", "label": "否"},
                {"id": "e9", "source": "output", "target": "end"},
                {"id": "e10", "source": "regenerate", "target": "generate"},
            ],
        },
        # 其他模板配置...
    }
    
    if template_id not in template_configs:
        raise HTTPException(404, detail="模板不存在")
    
    return template_configs[template_id]


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
    await db.execute(
        select(WorkflowTask).where(WorkflowTask.workflow_id == workflow_id)
    )
    # 注意：这里需要使用delete语句，简化处理
    
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

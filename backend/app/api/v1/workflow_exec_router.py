"""
工作流执行 API

提供工作流执行、状态查询、WebSocket 进度推送等接口。
"""
import asyncio
import json
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_current_user
from app.models.models import Workflow, WorkflowTask, User, WorkflowStatus, TaskStatus

from app.core.workflow import (
    WorkflowDAG,
    WorkflowNode,
    WorkflowEdge,
    EdgeType,
    execute_workflow_dag,
)
from app.core.realtime.websocket_manager import get_ws_manager, MessageType, WSMessage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflows", tags=["工作流执行"])

# 运行中的工作流执行器
_active_executions: dict = {}


@router.post("/{workflow_id}/execute", summary="执行工作流")
async def execute_workflow(
    workflow_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    执行指定工作流。

    从数据库加载工作流定义，构建 DAG，异步执行。
    返回 execution_id 用于查询进度。
    """
    # 加载工作流
    workflow = (await db.execute(
        select(Workflow).where(Workflow.id == workflow_id)
    )).scalar_one_or_none()

    if not workflow:
        raise HTTPException(404, detail="工作流不存在")

    if workflow.status in (WorkflowStatus.COMPLETED, WorkflowStatus.CANCELLED, WorkflowStatus.IN_PROGRESS):
        raise HTTPException(400, detail="该工作流已完成、已取消或正在执行中")

    # 加载任务节点
    tasks_result = await db.execute(
        select(WorkflowTask)
        .where(WorkflowTask.workflow_id == workflow_id)
        .order_by(WorkflowTask.step_order)
    )
    tasks = tasks_result.scalars().all()

    if not tasks:
        raise HTTPException(400, detail="工作流没有配置任务节点")

    # 构建 DAG
    dag = WorkflowDAG(workflow_id=workflow_id, name=workflow.name)

    node_id_map: dict = {}  # task_id -> dag node_id
    for task in tasks:
        node_id = task.id
        node_id_map[task.id] = node_id
        node = WorkflowNode(
            id=node_id,
            name=task.name,
            task_type=task.task_type,
            input_data=task.input_data or {},
            timeout=task.input_data.get("timeout") if isinstance(task.input_data, dict) else None,
            max_retries=3,
        )
        dag.add_node(node)

    # 添加边（按 step_order 顺序连接）
    sorted_tasks = sorted(tasks, key=lambda t: t.step_order)
    for i in range(len(sorted_tasks) - 1):
        edge = WorkflowEdge(
            source_id=sorted_tasks[i].id,
            target_id=sorted_tasks[i + 1].id,
            edge_type=EdgeType.SEQUENTIAL,
        )
        dag.add_edge(edge)

    # 异步执行
    execution_id = f"wf-exec-{workflow_id}-{int(asyncio.get_event_loop().time() * 1000)}"

    async def _run():
        try:
            # 更新工作流状态
            workflow.status = WorkflowStatus.IN_PROGRESS
            await db.commit()

            # 带进度回调的执行
            async def on_progress(task_id: int, status: str, result=None):
                await _push_progress(workflow_id, task_id, status, result)
                # 同步到数据库
                if status == "running":
                    await db.execute(
                        select(WorkflowTask).where(WorkflowTask.id == task_id).update(
                            {"status": TaskStatus.IN_PROGRESS, "started_at": datetime.now(timezone.utc)}
                        )
                    )
                elif status == "success" and result:
                    await db.execute(
                        select(WorkflowTask).where(WorkflowTask.id == task_id).update(
                            {
                                "status": TaskStatus.COMPLETED,
                                "completed_at": datetime.now(timezone.utc),
                                "duration_ms": int(result.latency_ms),
                                "output_data": result.output_data,
                            }
                        )
                    )

            result = await execute_workflow_dag(dag, on_progress=on_progress)

            # 更新工作流结果
            workflow.status = WorkflowStatus.COMPLETED if result["failed"] == 0 else WorkflowStatus.FAILED
            workflow.result = result
            await db.commit()

            # 推送完成消息
            ws_manager = get_ws_manager()
            await ws_manager.broadcast_to_channel(
                f"workflow:{workflow_id}",
                WSMessage(type=MessageType.AI_TASK_COMPLETED.value, data={
                    "workflow_id": workflow_id,
                    "execution_id": execution_id,
                    "result": result,
                }),
            )

        except Exception as e:
            logger.error("Workflow execution failed: %s", e, exc_info=True)
            workflow.status = WorkflowStatus.FAILED
            workflow.error_message = str(e)
            await db.commit()

            # 推送错误消息
            ws_manager = get_ws_manager()
            await ws_manager.broadcast_to_channel(
                f"workflow:{workflow_id}",
                WSMessage(type=MessageType.AI_TASK_FAILED.value, data={
                    "workflow_id": workflow_id,
                    "error": str(e),
                }),
            )

    # 启动异步执行
    asyncio.create_task(_run())
    _active_executions[execution_id] = {"workflow_id": workflow_id, "status": "running"}

    return {
        "success": True,
        "data": {
            "execution_id": execution_id,
            "workflow_id": workflow_id,
            "status": "running",
            "node_count": len(dag.nodes),
        },
    }


@router.get("/{workflow_id}/status", summary="查询工作流执行状态")
async def get_workflow_status(
    workflow_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """查询工作流当前状态和任务执行进度"""
    workflow = (await db.execute(
        select(Workflow).where(Workflow.id == workflow_id)
    )).scalar_one_or_none()

    if not workflow:
        raise HTTPException(404, detail="工作流不存在")

    tasks_result = await db.execute(
        select(WorkflowTask)
        .where(WorkflowTask.workflow_id == workflow_id)
        .order_by(WorkflowTask.step_order)
    )
    tasks = tasks_result.scalars().all()

    return {
        "success": True,
        "data": {
            "workflow_id": workflow.id,
            "name": workflow.name,
            "status": workflow.status.value if hasattr(workflow.status, "value") else str(workflow.status),
            "error_message": workflow.error_message,
            "result": workflow.result,
            "tasks": [
                {
                    "id": t.id,
                    "step_order": t.step_order,
                    "name": t.name,
                    "task_type": t.task_type,
                    "status": t.status.value if hasattr(t.status, "value") else str(t.status),
                    "error_message": t.error_message,
                    "duration_ms": t.duration_ms,
                }
                for t in tasks
            ],
        },
    }


@router.websocket("/ws/{workflow_id}")
async def workflow_ws(
    websocket: WebSocket,
    workflow_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """
    WebSocket 端点：实时推送工作流执行进度。

    消息格式:
    - {"type": "progress", "task_id": int, "status": str, "result": dict}
    - {"type": "stage_done", "stage": str, "success": bool, "latency_ms": float}
    - {"type": "complete", "result": dict}
    - {"type": "error", "message": str}

    前端订阅方式:
    ws.send(JSON.stringify({type: "subscribe", channel: "workflow:{id}"}))
    """
    # 验证工作流存在
    workflow = (await db.execute(
        select(Workflow).where(Workflow.id == workflow_id)
    )).scalar_one_or_none()
    if not workflow:
        await websocket.close(code=4004, reason="工作流不存在")
        return

    await websocket.accept()
    ws_manager = get_ws_manager()
    connection_id = f"wf_ws_{workflow_id}_{uuid.uuid4().hex[:8]}"

    try:
        # 订阅工作流通道
        await ws_manager.subscribe(connection_id, f"workflow:{workflow_id}")
        await websocket.send_json({
            "type": "connected",
            "channel": f"workflow:{workflow_id}",
            "connection_id": connection_id,
        })

        # 持续监听
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        logger.info("Workflow WS disconnected: workflow_id=%d", workflow_id)
    finally:
        await ws_manager.unsubscribe(connection_id, f"workflow:{workflow_id}")


@router.get("/executors", summary="列出可用执行器")
async def list_executors():
    """返回当前注册的所有工作流执行器"""
    from app.core.workflow import get_executor_registry
    registry = get_executor_registry()
    return {
        "success": True,
        "executors": [
            {"task_type": t, "description": registry.get(t).description}
            for t in registry.list_types()
        ],
    }

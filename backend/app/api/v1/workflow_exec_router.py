"""
工作流执行 API

提供工作流执行、状态查询、WebSocket 进度推送等接口。
"""
import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone  # A-27: 113 行 datetime.now(timezone.utc) 用到，原漏导入

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db_session
from app.core.realtime.websocket_manager import MessageType, WSMessage, get_ws_manager
from app.core.workflow import (
    EdgeType,
    WorkflowDAG,
    WorkflowEdge,
    WorkflowNode,
    execute_workflow_dag,
)
from app.models.models import TaskStatus, User, Workflow, WorkflowStatus, WorkflowTask

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflows", tags=["工作流执行"])

# 运行中的工作流执行器
_active_executions: dict = {}


@router.post("/{workflow_id}/execute", summary="执行工作流")
async def execute_workflow(
    workflow_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """
    执行指定工作流。

    从数据库加载工作流定义，构建 DAG，异步执行。
    返回 execution_id 用于查询进度。
    """
    # 加载工作流（A-27: 强制认证 + 属主校验，防止未认证/越权执行他人工作流）
    workflow = (await db.execute(
        select(Workflow).where(Workflow.id == workflow_id)
    )).scalar_one_or_none()

    if not workflow:
        raise HTTPException(404, detail="工作流不存在")

    if workflow.creator_id != current_user.id:
        raise HTTPException(403, detail="无权操作此工作流")

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
    execution_id = f"wf-exec-{workflow_id}-{int(asyncio.get_running_loop().time() * 1000)}"

    async def _run():
        # A-27: 后台任务必须使用独立 DB 会话，不能复用请求级 `db`
        #（请求结束后 `get_db_session` 会 close 该会话，复用将抛 Session is closed）。
        from app.core.database.session import AsyncSessionLocal
        try:
            async with AsyncSessionLocal() as bg_db:
                await _execute_with_session(bg_db)
        except Exception as e:
            logger.error("Workflow execution failed: %s", e, exc_info=True)
            # 失败标记 + 推送需独立会话（会话可能已失败，兜底重试一次）
            try:
                async with AsyncSessionLocal() as fail_db:
                    fail_wf = await fail_db.get(Workflow, workflow_id)
                    if fail_wf:
                        fail_wf.status = WorkflowStatus.FAILED
                        fail_wf.error_message = str(e)
                        await fail_db.commit()
            except Exception as e2:
                logger.error("标记工作流失败时异常: %s", e2)
            try:
                ws_manager = get_ws_manager()
                await ws_manager.broadcast_to_channel(
                    f"workflow:{workflow_id}",
                    WSMessage(type=MessageType.AI_TASK_FAILED.value, data={
                        "workflow_id": workflow_id,
                        "error": str(e),
                    }),
                )
            except Exception as e3:
                logger.warning("推送失败消息异常: %s", e3)

    async def _execute_with_session(bg_db: AsyncSession):
        """在独立会话中执行 DAG 并持久化结果。"""
        try:
            # 更新工作流状态
            wf = await bg_db.get(Workflow, workflow_id)
            if not wf:
                raise HTTPException(404, detail="工作流不存在")
            wf.status = WorkflowStatus.IN_PROGRESS
            await bg_db.commit()

            # A-27：原先这里调用的 _push_progress 在本模块根本没有定义（NameError），
            #       只要 DAG 回调一次进度，整个 _run() 就会崩进 except 并把工作流标记为
            #       FAILED。这里按下方「完成 / 失败」消息同样的通道与载荷格式补上实现，
            #       并自行吞掉推送异常，避免 WS 抖动影响执行主流程。
            async def _push_progress(wf_id: int, task_id: int, status: str, result=None):
                try:
                    ws_manager = get_ws_manager()
                    await ws_manager.broadcast_to_channel(
                        f"workflow:{wf_id}",
                        WSMessage(type=MessageType.AI_TASK_PROGRESS.value, data={
                            "workflow_id": wf_id,
                            "execution_id": execution_id,
                            "task_id": task_id,
                            "status": status,
                            "output_data": getattr(result, "output_data", None) if result else None,
                        }),
                    )
                except Exception as e:
                    logger.warning("推送工作流进度失败: %s", e)

            # 带进度回调的执行
            async def on_progress(task_id: int, status: str, result=None):
                await _push_progress(workflow_id, task_id, status, result)
                # 同步到数据库
                if status == "running":
                    await bg_db.execute(
                        select(WorkflowTask).where(WorkflowTask.id == task_id).update(
                            {"status": TaskStatus.IN_PROGRESS, "started_at": datetime.now(timezone.utc)}
                        )
                    )
                    await bg_db.commit()
                elif status == "success" and result:
                    await bg_db.execute(
                        select(WorkflowTask).where(WorkflowTask.id == task_id).update(
                            {
                                "status": TaskStatus.COMPLETED,
                                "completed_at": datetime.now(timezone.utc),
                                "duration_ms": int(result.latency_ms),
                                "output_data": result.output_data,
                            }
                        )
                    )
                    await bg_db.commit()

            result = await execute_workflow_dag(dag, on_progress=on_progress)

            # 更新工作流结果
            wf = await bg_db.get(Workflow, workflow_id)
            wf.status = WorkflowStatus.COMPLETED if result["failed"] == 0 else WorkflowStatus.FAILED
            wf.result = result
            await bg_db.commit()

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

        except HTTPException:
            raise
        except Exception as e:
            logger.error("Workflow execution failed: %s", e, exc_info=True)
            raise

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
    current_user: User = Depends(get_current_active_user),
):
    """查询工作流当前状态和任务执行进度"""
    workflow = (await db.execute(
        select(Workflow).where(Workflow.id == workflow_id)
    )).scalar_one_or_none()

    if not workflow:
        raise HTTPException(404, detail="工作流不存在")

    # A-27: 属主校验，防止越权读取他人工作流状态
    if workflow.creator_id != current_user.id:
        raise HTTPException(403, detail="无权操作此工作流")

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

    A-27: 增加鉴权——WebSocket 无法携带 Authorization header，故通过
    query 参数 ``?token=...`` 传入 JWT。鉴权失败则关闭连接，防止
    任意客户端订阅 ``workflow:{id}`` 通道接收进度/结果（信息泄露）。

    消息格式:
    - {"type": "progress", "task_id": int, "status": str, "result": dict}
    - {"type": "stage_done", "stage": str, "success": bool, "latency_ms": float}
    - {"type": "complete", "result": dict}
    - {"type": "error", "message": str}

    前端订阅方式:
    ws.send(JSON.stringify({type: "subscribe", channel: "workflow:{id}"}))
    """
    # ── A-27: WebSocket 鉴权（query token）──
    try:
        from app.utils.auth import decode_token  # 与 deps.py 同一解码器
        token = websocket.query_params.get("token")
        if not token:
            await websocket.close(code=4401, reason="未提供认证令牌")
            return
        payload = decode_token(token)
        if not payload or payload.get("type") != "access":
            await websocket.close(code=4401, reason="认证令牌无效")
            return
        ws_user_id = int(payload.get("sub"))
    except Exception as _e:
        logger.warning("WebSocket 鉴权失败: %s", _e)
        await websocket.close(code=4401, reason="认证失败")
        return

    # 验证工作流存在
    workflow = (await db.execute(
        select(Workflow).where(Workflow.id == workflow_id)
    )).scalar_one_or_none()
    if not workflow:
        await websocket.close(code=4004, reason="工作流不存在")
        return

    # A-27: 属主校验，防止越权订阅
    if workflow.creator_id != ws_user_id:
        await websocket.close(code=4403, reason="无权订阅此工作流")
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

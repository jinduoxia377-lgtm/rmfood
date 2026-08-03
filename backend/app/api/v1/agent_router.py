"""
Agent API 路由

提供 Agent 对话和执行端点：
- POST /api/v1/agent/execute        — 执行 Agent（快速/智能模式）
- GET  /api/v1/agent/tools          — 列出可用工具
- GET  /api/v1/agent/executions/{id} — 查询执行结果
- POST /api/v1/agent/stream         — 流式执行（SSE）
"""
import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.ai.agent import get_orchestrator, AgentExecution

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["AI Agent"])

# 执行记录存储（生产环境应使用 Redis/DB）
_executions: dict[str, AgentExecution] = {}
_MAX_EXECUTIONS = 100


# ════════════════════════════════════════════
# Request schemas
# ════════════════════════════════════════════


class AgentExecuteRequest(BaseModel):
    """Agent 执行请求"""
    query: str = Field(..., min_length=1, max_length=2000, description="用户问题")
    mode: str = Field("smart", pattern="^(fast|smart)$", description="执行模式：fast=工具链直调, smart=LLM自主决策")
    tool_chain: Optional[list[list]] = Field(
        None,
        description="fast模式下的工具链，每项为 [tool_name, params_dict]",
    )
    max_steps: int = Field(5, ge=1, le=20, description="smart模式最大工具调用次数")


class ToolCallItem(BaseModel):
    name: str
    arguments: dict = {}


# ════════════════════════════════════════════
# Endpoints
# ════════════════════════════════════════════


@router.get("/tools", summary="列出可用工具")
async def list_tools():
    """返回当前注册的所有 Agent 工具列表"""
    orch = get_orchestrator()
    tools = orch.list_available_tools()
    return {"success": True, "tools": tools, "count": len(tools)}


@router.post("/execute", summary="执行 Agent 任务")
async def execute_agent(req: AgentExecuteRequest):
    """
    执行 Agent 任务，返回结构化结果。

    - fast 模式：按预定义工具链顺序执行，适合已知流程
    - smart 模式：LLM 自主决定工具调用，适合开放式问题
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="query 不能为空")

    orch = get_orchestrator()

    if req.mode == "fast":
        # 构建工具链
        tool_chain = req.tool_chain or [
            ["rag_retrieve", {"query": req.query, "top_k": 5}],
            ["compliance_check", {"ingredients": [], "target_population": "adults"}],
        ]
        execution = await orch.execute_fast(req.query, tool_chain)

    else:
        execution = await orch.execute_smart(req.query, max_steps=req.max_steps)

    # 存储执行记录
    _executions[execution.execution_id] = execution
    if len(_executions) > _MAX_EXECUTIONS:
        # 清理最旧的记录
        oldest = next(iter(_executions))
        del _executions[oldest]

    return {
        "success": True,
        "data": execution.to_dict(),
    }


@router.get("/executions/{execution_id}", summary="查询执行结果")
async def get_execution(execution_id: str):
    """查询指定 Agent 执行的任务结果"""
    execution = _executions.get(execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail=f"执行记录不存在: {execution_id}")
    return {"success": True, "data": execution.to_dict()}


@router.post("/execute/stream", summary="流式执行 Agent（SSE）")
async def execute_agent_stream(req: AgentExecuteRequest):
    """
    流式执行 Agent，通过 SSE 逐步推送中间结果。
    适合长时间运行的任务。
    """
    orch = get_orchestrator()

    async def event_stream():
        yield {"event": "start", "data": json.dumps({"query": req.query, "mode": req.mode}, ensure_ascii=False)}

        if req.mode == "fast":
            tool_chain = req.tool_chain or []
            for tool_name, params in tool_chain:
                yield {"event": "tool_start", "data": json.dumps({"tool": tool_name}, ensure_ascii=False)}
                # 此处简化：实际应在 orchestrator 中暴露流式接口
                yield {"event": "tool_done", "data": json.dumps({"tool": tool_name, "status": "done"}, ensure_ascii=False)}

        execution = await orch.execute_smart(req.query, max_steps=req.max_steps)

        yield {
            "event": "complete",
            "data": json.dumps(execution.to_dict(), ensure_ascii=False),
        }
        yield {"event": "done", "data": ""}

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/executions", summary="列出最近的执行记录")
async def list_executions(limit: int = Query(10, ge=1, le=50)):
    """返回最近执行的 Agent 任务列表"""
    items = list(_executions.values())[-limit:]
    return {
        "success": True,
        "data": [e.to_dict() for e in items],
        "total": len(_executions),
    }


@router.delete("/executions/{execution_id}", summary="删除执行记录")
async def delete_execution(execution_id: str):
    """删除指定的执行记录"""
    if execution_id not in _executions:
        raise HTTPException(status_code=404, detail="执行记录不存在")
    del _executions[execution_id]
    return {"success": True, "message": "已删除"}

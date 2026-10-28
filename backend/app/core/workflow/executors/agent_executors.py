"""
Agent 工作流执行器

将 Agent 编排引擎集成到 DAG 调度器中，支持两种模式：
- agent_smart: LLM 自主决策模式（适合开放式问题）
- agent_fast: 预定义工具链模式（适合结构化任务）

执行器通过 shared_state 桥接 Agent 上下文与 DAG 共享状态。
"""
from __future__ import annotations

import logging

from app.core.workflow.executor_protocol import (
    ExecutionContext,
    ExecutionResult,
    WorkflowExecutor,
    register_executor,
)

logger = logging.getLogger(__name__)


@register_executor
class AgentSmartExecutor(WorkflowExecutor):
    """
    LLM 自主决策模式执行器

    LLM 根据用户问题自主决定调用哪些工具和参数。
    适合开放式研发问题，如"帮我设计一款针对高血糖人群的枸杞饮品配方"。
    """

    @property
    def task_type(self) -> str:
        return "agent_smart"

    @property
    def description(self) -> str:
        return "LLM自主决策模式：让AI决定调用哪些工具和参数，适合开放式研发问题"

    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        from app.services.ai.agent.orchestrator import get_orchestrator

        query: str = context.input_data.get("query", "")
        max_steps: int = context.input_data.get("max_steps", 8)
        system_prompt: str = context.input_data.get("system_prompt", "")

        if not query:
            return ExecutionResult(
                task_id=context.task_id,
                success=False,
                error="query 不能为空",
            )

        try:
            orchestrator = get_orchestrator(system_prompt=system_prompt)
            execution = await orchestrator.execute_smart(
                query=query,
                max_steps=max_steps,
                context=context.shared_state,
            )

            # 将 Agent 执行结果写入 shared_state，供后续节点使用
            context.shared_state["agent_execution"] = {
                "execution_id": execution.execution_id,
                "status": execution.status,
                "steps": [
                    {
                        "tool": s.tool_name,
                        "status": s.status.value,
                        "latency_ms": round(
                            (s.completed_at - s.started_at).total_seconds() * 1000
                            if s.started_at and s.completed_at else 0, 1
                        ),
                        "error": s.error,
                    }
                    for s in execution.steps
                ],
            }
            context.shared_state["agent_final_response"] = execution.final_response

            logger.info(
                "AgentSmartExecutor done: execution_id=%s steps=%d latency=%.0fms",
                execution.execution_id, len(execution.steps),
                execution.total_latency_ms,
            )

            return ExecutionResult(
                task_id=context.task_id,
                success=execution.status != "blocked",
                output_data={
                    "execution_id": execution.execution_id,
                    "steps_count": len(execution.steps),
                    "latency_ms": round(execution.total_latency_ms, 1),
                    "response_preview": execution.final_response[:500]
                    if execution.final_response else "",
                },
                error=execution.error if execution.status == "blocked" else None,
            )
        except Exception as e:
            logger.error("AgentSmartExecutor error: %s", e, exc_info=True)
            return ExecutionResult(
                task_id=context.task_id,
                success=False,
                error=f"Agent 智能模式执行失败: {e}",
            )


@register_executor
class AgentFastExecutor(WorkflowExecutor):
    """
    预定义工具链模式执行器

    按预定义的工具链顺序执行，适合已知流程的结构化任务。
    """

    @property
    def task_type(self) -> str:
        return "agent_fast"

    @property
    def description(self) -> str:
        return "预定义工具链模式：按固定顺序调用工具，适合结构化任务"

    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        from app.services.ai.agent.orchestrator import get_orchestrator

        query: str = context.input_data.get("query", "")
        tool_chain: list = context.input_data.get("tool_chain", [])

        if not query:
            return ExecutionResult(
                task_id=context.task_id,
                success=False,
                error="query 不能为空",
            )
        if not tool_chain:
            return ExecutionResult(
                task_id=context.task_id,
                success=False,
                error="tool_chain 不能为空，请提供工具调用序列",
            )

        try:
            orchestrator = get_orchestrator()
            execution = await orchestrator.execute_fast(
                query=query,
                tool_chain=tool_chain,
                context=context.shared_state,
            )

            # 将结果写入 shared_state
            context.shared_state["agent_execution"] = {
                "execution_id": execution.execution_id,
                "status": execution.status,
                "steps": [
                    {
                        "tool": s.tool_name,
                        "status": s.status.value,
                        "latency_ms": round(
                            (s.completed_at - s.started_at).total_seconds() * 1000
                            if s.started_at and s.completed_at else 0, 1
                        ),
                        "error": s.error,
                    }
                    for s in execution.steps
                ],
            }
            context.shared_state["agent_final_response"] = execution.final_response

            logger.info(
                "AgentFastExecutor done: execution_id=%s steps=%d",
                execution.execution_id, len(execution.steps),
            )

            return ExecutionResult(
                task_id=context.task_id,
                success=True,
                output_data={
                    "execution_id": execution.execution_id,
                    "steps_count": len(execution.steps),
                    "latency_ms": round(execution.total_latency_ms, 1),
                    "response_preview": execution.final_response[:500]
                    if execution.final_response else "",
                },
            )
        except Exception as e:
            logger.error("AgentFastExecutor error: %s", e, exc_info=True)
            return ExecutionResult(
                task_id=context.task_id,
                success=False,
                error=f"Agent 快速模式执行失败: {e}",
            )

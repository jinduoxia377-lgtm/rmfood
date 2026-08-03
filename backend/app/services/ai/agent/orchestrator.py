"""
Agent 编排引擎

管理多工具协作的 Agent 执行流程，支持：
- 工具调用链（串行/并行）
- 上下文传递
- LLM 调用与结果解析
- 错误恢复和降级
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, AsyncIterator, Dict, List, Optional

from app.services.ai.providers.provider_factory import get_provider_factory, TaskType

from .tools import BaseAgentTool, ToolResult, get_tool_registry

logger = logging.getLogger(__name__)


class AgentStepStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class AgentStep:
    """Agent执行步骤"""
    step_id: str
    tool_name: str
    params: dict
    status: AgentStepStatus = AgentStepStatus.PENDING
    result: Optional[ToolResult] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None


@dataclass
class AgentExecution:
    """Agent执行记录"""
    execution_id: str
    user_query: str
    steps: List[AgentStep] = field(default_factory=list)
    final_response: str = ""
    total_latency_ms: float = 0.0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: str = "running"

    def to_dict(self) -> dict:
        return {
            "execution_id": self.execution_id,
            "user_query": self.user_query,
            "status": self.status,
            "total_latency_ms": round(self.total_latency_ms, 1),
            "steps": [
                {
                    "step_id": s.step_id,
                    "tool": s.tool_name,
                    "status": s.status.value,
                    "latency_ms": round(
                        (s.completed_at - s.started_at).total_seconds() * 1000
                        if s.started_at and s.completed_at
                        else 0, 1
                    ),
                    "error": s.error,
                }
                for s in self.steps
            ],
            "final_response_preview": (
                self.final_response[:200] + "..."
                if len(self.final_response) > 200
                else self.final_response
            ),
        }


class AgentOrchestrator:
    """
    Agent 编排引擎

    支持两种模式：
    1. 工具直调模式（Fast）：按预定义工具链顺序调用，适合结构化任务
    2. LLM 自主模式（Smart）：让 LLM 决定调用哪些工具和参数，适合开放式任务
    """

    def __init__(self, system_prompt: str = ""):
        self._registry = get_tool_registry()
        self._system_prompt = system_prompt or self._default_system_prompt
        self._provider_factory = get_provider_factory()

    @property
    def _default_system_prompt(self) -> str:
        return (
            "你是RMFOOD智能配方研发助手，专注于药食同源功能性食品研发。\n"
            "请根据用户问题，选择合适的工具完成任务。\n"
            "回答时请保持专业、准确，并引用相关依据。"
        )

    async def execute_fast(
        self,
        query: str,
        tool_chain: List[tuple],
        context: Optional[dict] = None,
    ) -> AgentExecution:
        """
        快速模式：按预定义工具链顺序执行
        """
        execution = AgentExecution(
            execution_id=f"exec-{int(time.time())}",
            user_query=query,
            started_at=datetime.now(timezone.utc),
        )
        context = context or {}
        total_start = time.time()

        for tool_name, params in tool_chain:
            step_id = f"step-{len(execution.steps) + 1}"
            step = AgentStep(
                step_id=step_id,
                tool_name=tool_name,
                params=params,
                status=AgentStepStatus.RUNNING,
                started_at=datetime.now(timezone.utc),
            )
            execution.steps.append(step)

            tool = self._registry.get(tool_name)
            if not tool:
                step.status = AgentStepStatus.FAILED
                step.error = f"工具未注册: {tool_name}"
                logger.warning("Tool not found: %s", tool_name)
                continue

            try:
                result = await tool.execute(params, context)
                step.result = result
                step.status = (
                    AgentStepStatus.SUCCESS if result.success else AgentStepStatus.FAILED
                )
                step.error = result.error
                step.completed_at = datetime.now(timezone.utc)
                context[f"__tool_{tool_name}__"] = result.data

            except Exception as e:
                step.status = AgentStepStatus.FAILED
                step.error = str(e)
                step.completed_at = datetime.now(timezone.utc)
                logger.error("Tool execution failed: %s - %s", tool_name, e, exc_info=True)

        execution.status = "completed"
        execution.completed_at = datetime.now(timezone.utc)
        execution.total_latency_ms = (time.time() - total_start) * 1000
        execution.final_response = self._build_response(query, execution.steps)

        logger.info(
            "Fast execution done: %d steps, %dms",
            len(execution.steps), execution.total_latency_ms,
        )
        return execution

    async def execute_smart(
        self,
        query: str,
        max_steps: int = 10,
        context: Optional[dict] = None,
    ) -> AgentExecution:
        """
        智能模式：让 LLM 自主决定调用哪些工具
        通过 function calling 接口，LLM 动态选择工具。
        """
        execution = AgentExecution(
            execution_id=f"exec-smart-{int(time.time())}",
            user_query=query,
            started_at=datetime.now(timezone.utc),
        )
        context = context or {}

        messages: List[Dict[str, str]] = [
            {"role": "system", "content": self._system_prompt},
            {"role": "user", "content": query},
        ]
        tools_schema = self._registry.list_tools()

        total_start = time.time()

        for step_idx in range(max_steps):
            step_id = f"step-{step_idx + 1}"
            llm_result = await self._call_llm(messages, tools_schema)

            tool_calls = llm_result.get("tool_calls", [])
            if not tool_calls:
                execution.final_response = llm_result.get("content", "")
                break

            for tool_call in tool_calls:
                tool_name = tool_call.get("name", "")
                tool_args = tool_call.get("arguments", {})

                step = AgentStep(
                    step_id=step_id,
                    tool_name=tool_name,
                    params=tool_args,
                    status=AgentStepStatus.RUNNING,
                    started_at=datetime.now(timezone.utc),
                )
                execution.steps.append(step)

                tool = self._registry.get(tool_name)
                if not tool:
                    step.status = AgentStepStatus.FAILED
                    step.error = f"未注册工具: {tool_name}"
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.get("id", ""),
                        "content": f"工具 {tool_name} 未注册",
                    })
                    continue

                try:
                    result = await tool.execute(tool_args, context)
                    step.result = result
                    step.status = (
                        AgentStepStatus.SUCCESS if result.success else AgentStepStatus.FAILED
                    )
                    step.error = result.error
                    step.completed_at = datetime.now(timezone.utc)

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.get("id", ""),
                        "content": json.dumps(
                            result.to_dict(), ensure_ascii=False, default=str
                        ),
                    })
                    context[f"__tool_{tool_name}__"] = result.data

                except Exception as e:
                    step.status = AgentStepStatus.FAILED
                    step.error = str(e)
                    step.completed_at = datetime.now(timezone.utc)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.get("id", ""),
                        "content": f"工具执行错误: {e}",
                    })

        execution.status = "completed"
        execution.completed_at = datetime.now(timezone.utc)
        execution.total_latency_ms = (time.time() - total_start) * 1000

        if not execution.final_response:
            execution.final_response = self._build_response(query, execution.steps)

        logger.info(
            "Smart execution done: %d tool calls, %dms",
            len(execution.steps), execution.total_latency_ms,
        )
        return execution

    async def _call_llm(
        self,
        messages: List[Dict[str, str]],
        tools: List[dict],
    ) -> Dict[str, Any]:
        """调用 LLM，支持 function calling"""
        try:
            factory = self._provider_factory
            result = await factory.create_task(
                task_type=TaskType.CHAT,
                messages=messages,
                tools=tools if tools else None,
                temperature=0.3,
            )
            return {
                "content": result.content if hasattr(result, "content") else str(result),
                "tool_calls": getattr(result, "tool_calls", []),
            }
        except Exception as e:
            logger.warning("LLM call failed: %s", e)
            return {"content": f"[LLM调用失败] {e}", "tool_calls": []}

    def _build_response(
        self,
        query: str,
        steps: List[AgentStep],
    ) -> str:
        """根据工具执行结果构建最终回复"""
        parts = [f"## 针对你的问题：{query}\n"]

        for step in steps:
            if step.status == AgentStepStatus.SUCCESS and step.result:
                data = step.result.data
                if isinstance(data, dict):
                    parts.append(f"### [{step.tool_name}] 执行成功\n")
                    parts.append(json.dumps(data, ensure_ascii=False, indent=2))
                    parts.append("\n")
                elif data:
                    parts.append(f"### [{step.tool_name}]\n{data}\n")

        if not any(s.status == AgentStepStatus.SUCCESS for s in steps):
            parts.append("所有工具执行失败，请检查输入后重试。")

        return "\n".join(parts)

    def list_available_tools(self) -> List[Dict[str, str]]:
        """列出当前可用的所有工具"""
        return self._registry.list_tools()


# 全局单例
_orchestrator: Optional[AgentOrchestrator] = None


def get_orchestrator(system_prompt: str = "") -> AgentOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AgentOrchestrator(system_prompt)
    return _orchestrator

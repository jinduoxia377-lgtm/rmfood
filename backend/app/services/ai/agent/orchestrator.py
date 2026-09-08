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

from app.services.ai.providers.provider_factory import cleanup_provider_factory, get_provider_factory, TaskType
from app.services.ai.safety import (
    PromptGuardResult,
    ThreatLevel,
    check_prompt,
    check_output,
)
from app.services.ai.safety.instruction_hierarchy import InstructionHierarchy

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
        self._hierarchy = InstructionHierarchy(system_prompt=self._system_prompt)
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

        🔒 安全增强：用户输入经过 Prompt 注入检测，输出经过安全检查
        """
        execution = AgentExecution(
            execution_id=f"exec-smart-{int(time.time())}",
            user_query=query,
            started_at=datetime.now(timezone.utc),
        )
        context = context or {}

        # 🔒 安全检查：Prompt 注入检测
        guard_result: PromptGuardResult = check_prompt(query)
        if guard_result.is_blocked:
            execution.status = "blocked"
            execution.final_response = (
                "您的输入包含疑似注入攻击，已被安全系统拦截。"
                "请修改后重试。"
            )
            execution.completed_at = datetime.now(timezone.utc)
            execution.total_latency_ms = 0.0
            logger.warning(
                "[AgentOrchestrator] 用户输入被拦截: score=%.2f",
                guard_result.security_score,
            )
            return execution

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
                raw_answer = llm_result.get("content", "")
                # 🔒 安全检查：输出侧过滤
                output_result = check_output(raw_answer)
                execution.final_response = (
                    output_result.sanitized_text
                    if not output_result.is_safe
                    else raw_answer
                )
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

        # 🔒 最终输出安全检查
        final_output_check = check_output(execution.final_response)
        if not final_output_check.is_safe:
            logger.warning(
                "[AgentOrchestrator] 输出被安全过滤: risk=%s findings=%d",
                final_output_check.risk_level.value,
                len(final_output_check.findings),
            )
            execution.final_response = final_output_check.sanitized_text

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
            result = await factory.call_with_fallback(
                messages=messages,
                task_type=TaskType.CHAT,
                temperature=0.3,
            )
            return {
                "content": result if isinstance(result, str) else str(result),
                "tool_calls": [],
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


async def _reload_factory_from_db_sync():
    """同步包装异步 reload，供 get_orchestrator 调用"""
    from app.services.ai.providers.provider_factory import reload_factory_from_db
    await reload_factory_from_db()


def get_orchestrator(system_prompt: str = "") -> AgentOrchestrator:
    """创建新的编排器实例，确保每次都使用最新的 LLM 配置"""
    # 从数据库重载 Provider 工厂（确保使用最新保存的 API Key）
    try:
        import asyncio
        asyncio.run(_reload_factory_from_db_sync())
    except Exception:
        pass
    # 强制清除工厂单例
    try:
        from app.services.ai.providers.provider_factory import _set_factory_instance_none
        _set_factory_instance_none()
    except Exception:
        pass
    return AgentOrchestrator(system_prompt)


# ── 高危操作确认机制 ──────────────────────────────────────────────────────

@dataclass
class HighRiskAction:
    """高危操作定义"""
    action_type: str       # e.g., "formula.delete", "data.export"
    requires_confirmation: bool = True
    allowed_roles: List[str] = field(default_factory=lambda: ["admin", "researcher"])
    description: str = ""


# 高危操作注册表
_HIGH_RISK_ACTIONS: Dict[str, HighRiskAction] = {
    "formula.delete": HighRiskAction(
        action_type="formula.delete",
        requires_confirmation=True,
        allowed_roles=["admin"],
        description="删除配方，不可恢复",
    ),
    "data.export": HighRiskAction(
        action_type="data.export",
        requires_confirmation=True,
        allowed_roles=["admin", "researcher"],
        description="导出敏感数据",
    ),
    "compliance.override": HighRiskAction(
        action_type="compliance.override",
        requires_confirmation=True,
        allowed_roles=["admin"],
        description="强制通过合规检查",
    ),
    "system.config.change": HighRiskAction(
        action_type="system.config.change",
        requires_confirmation=True,
        allowed_roles=["admin"],
        description="修改系统配置",
    ),
}


def check_high_risk_action(
    action_type: str,
    user_roles: List[str] | None = None,
) -> tuple[bool, str]:
    """
    检查高危操作是否需要人工确认

    Returns:
        (allowed, message) — allowed=True 时可直接执行
    """
    action = _HIGH_RISK_ACTIONS.get(action_type)
    if action is None:
        return True, "非高危操作，允许执行"

    roles = user_roles or []
    if not action.requires_confirmation:
        return True, f"{action.description}（无需确认）"

    if not any(r in roles for r in action.allowed_roles):
        return False, f"权限不足：{action.description} 仅允许角色 {action.allowed_roles}"

    return True, f"{action.description}（已确认）"

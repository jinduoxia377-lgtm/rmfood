"""
多 Agent 协作框架

支持多 Agent 并行执行、共享上下文、结果聚合。
每个 Agent 有独立角色和工具集，通过共享上下文传递数据。

架构：
┌──────────────────────────────────────────────────────────┐
│                   CollaborationCoordinator               │
│                  （协调器：路由、聚合、仲裁）              │
├─────────────┬─────────────┬─────────────┬───────────────┤
│ Formula     │ Safety      │ Knowledge   │ Experiment    │
│ Agent       │ Agent       │ Agent       │ Agent         │
│ 配方设计     │ 合规审查     │ 知识检索     │ 实验方案        │
└─────────────┴─────────────┴─────────────┴───────────────┘
         └─────────────┬─────────────┘
                    SharedContext
           {user_query, formula, safety, knowledge, ...}
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class AgentRole(str, Enum):
    """Agent 角色"""
    FORMULA = "formula"
    SAFETY = "safety"
    KNOWLEDGE = "knowledge"
    EXPERIMENT = "experiment"
    ORCHESTRATOR = "orchestrator"


class CollaborationStatus(str, Enum):
    """协作状态"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    CONSENSUS_REACHED = "consensus_reached"
    CONFLICT_DETECTED = "conflict_detected"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class AgentMessage:
    """Agent 间消息"""
    sender: AgentRole
    recipient: AgentRole
    content: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentResult:
    """单 Agent 执行结果"""
    role: AgentRole
    success: bool
    output: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    latency_ms: float = 0.0
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class CollaborationSession:
    """协作会话"""
    session_id: str
    user_query: str
    status: CollaborationStatus = CollaborationStatus.PENDING
    shared_context: Dict[str, Any] = field(default_factory=dict)
    agent_results: Dict[AgentRole, AgentResult] = field(default_factory=dict)
    messages: List[AgentMessage] = field(default_factory=list)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    total_latency_ms: float = 0.0
    final_response: str = ""

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "user_query": self.user_query,
            "status": self.status.value,
            "total_latency_ms": round(self.total_latency_ms, 1),
            "agent_results": {
                role.value: {
                    "success": r.success,
                    "latency_ms": round(r.latency_ms, 1),
                    "output_summary": {
                        k: str(v)[:200] for k, v in r.output.items()
                    } if r.output else {},
                    "error": r.error,
                }
                for role, r in self.agent_results.items()
            },
            "message_count": len(self.messages),
            "final_response_preview": self.final_response[:500] if self.final_response else "",
        }


class MultiAgentCollaborator:
    """
    多 Agent 协作框架

    工作流程：
    1. 接收用户请求
    2. 并行派发给各专业 Agent
    3. 结果聚合到共享上下文
    4. 冲突检测和仲裁
    5. 生成最终建议
    """

    def __init__(self):
        self._agents: Dict[AgentRole, Any] = {}
        self._executions: Dict[str, CollaborationSession] = {}

    def register_agent(self, role: AgentRole, agent: Any) -> None:
        """注册 Agent"""
        self._agents[role] = agent
        logger.info("Agent registered: %s", role.value)

    async def collaborate(
        self,
        user_query: str,
        max_rounds: int = 2,
    ) -> CollaborationSession:
        """
        执行多 Agent 协作

        Args:
            user_query: 用户请求
            max_rounds: 最大辩论轮次

        Returns:
            CollaborationSession: 协作会话结果
        """
        session_id = f"collab-{int(time.time())}-{hash(user_query) & 0xFFFF:04x}"
        session = CollaborationSession(
            session_id=session_id,
            user_query=user_query,
            started_at=datetime.now(timezone.utc),
            status=CollaborationStatus.IN_PROGRESS,
        )
        self._executions[session_id] = session

        total_start = time.time()

        # Phase 1: 并行执行各专业 Agent
        logger.info("Starting multi-agent collaboration: %s", user_query[:50])
        session.messages.append(AgentMessage(
            sender=AgentRole.ORCHESTRATOR,
            recipient=AgentRole.ORCHESTRATOR,
            content=f"开始协作: {user_query}",
        ))

        # 并行执行 Formula + Safety + Knowledge
        parallel_tasks = []

        if AgentRole.FORMULA in self._agents:
            parallel_tasks.append(self._run_agent(
                session, AgentRole.FORMULA,
                self._agents[AgentRole.FORMULA],
                user_query,
            ))

        if AgentRole.SAFETY in self._agents:
            parallel_tasks.append(self._run_agent(
                session, AgentRole.SAFETY,
                self._agents[AgentRole.SAFETY],
                user_query,
            ))

        if AgentRole.KNOWLEDGE in self._agents:
            parallel_tasks.append(self._run_agent(
                session, AgentRole.KNOWLEDGE,
                self._agents[AgentRole.KNOWLEDGE],
                user_query,
            ))

        if AgentRole.EXPERIMENT in self._agents:
            parallel_tasks.append(self._run_agent(
                session, AgentRole.EXPERIMENT,
                self._agents[AgentRole.EXPERIMENT],
                user_query,
            ))

        if parallel_tasks:
            results = await asyncio.gather(*parallel_tasks, return_exceptions=True)
            for role, result in zip(
                [r for r in self._agents.keys() if r != AgentRole.ORCHESTRATOR],
                results,
            ):
                if isinstance(result, Exception):
                    session.agent_results[role] = AgentResult(
                        role=role, success=False, error=str(result),
                    )
                else:
                    session.agent_results[role] = result

        # Phase 2: 多轮辩论
        for round_idx in range(max_rounds - 1):
            round_start = time.time()
            session.messages.append(AgentMessage(
                sender=AgentRole.ORCHESTRATOR,
                recipient=AgentRole.ORCHESTRATOR,
                content=f"第 {round_idx + 2} 轮辩论",
            ))

            # 检查是否有冲突需要仲裁
            conflicts = self._detect_conflicts(session)
            if conflicts:
                session.messages.append(AgentMessage(
                    sender=AgentRole.ORCHESTRATOR,
                    recipient=AgentRole.SAFETY,
                    content=f"检测到冲突: {conflicts}",
                ))
                # 重新执行 Safety Agent
                if AgentRole.SAFETY in self._agents:
                    safety_result = await self._run_agent(
                        session, AgentRole.SAFETY,
                        self._agents[AgentRole.SAFETY],
                        user_query,
                    )
                    session.agent_results[AgentRole.SAFETY] = safety_result

            round_latency = (time.time() - round_start) * 1000
            logger.info("Debate round %d: latency=%.0fms", round_idx + 2, round_latency)

        # Phase 3: 仲裁和聚合
        session.shared_context = self._aggregate_results(session)
        session.status = self._determine_consensus(session)
        session.final_response = self._synthesize_final_response(session)

        # Phase 4: 完成
        session.completed_at = datetime.now(timezone.utc)
        session.total_latency_ms = (time.time() - total_start) * 1000

        logger.info(
            "Collaboration complete: session=%s status=%s latency=%.0fms",
            session_id, session.status.value, session.total_latency_ms,
        )
        return session

    async def _run_agent(
        self,
        session: CollaborationSession,
        role: AgentRole,
        agent: Any,
        query: str,
    ) -> AgentResult:
        """执行单个 Agent"""
        start = time.time()
        try:
            # 尝试调用 agent 的执行方法
            if hasattr(agent, "execute"):
                result = await agent.execute(query, session.shared_context)
            elif hasattr(agent, "process"):
                result = await agent.process(query, session.shared_context)
            else:
                result = {"error": "Agent has no execute or process method"}

            latency = (time.time() - start) * 1000
            success = isinstance(result, dict) and result.get("success", True) if isinstance(result, dict) else True

            session.messages.append(AgentMessage(
                sender=role,
                recipient=AgentRole.ORCHESTRATOR,
                content=result.get("output", str(result))[:200] if isinstance(result, dict) else str(result)[:200],
                metadata={"latency_ms": latency},
            ))

            return AgentResult(
                role=role,
                success=success,
                output=result if isinstance(result, dict) else {"result": result},
                latency_ms=latency,
            )
        except Exception as e:
            latency = (time.time() - start) * 1000
            logger.error("Agent %s execution failed: %s", role.value, e, exc_info=True)
            return AgentResult(
                role=role,
                success=False,
                error=str(e),
                latency_ms=latency,
            )

    def _detect_conflicts(self, session: CollaborationSession) -> List[str]:
        """检测 Agent 结果间的冲突"""
        conflicts = []
        formula_result = session.agent_results.get(AgentRole.FORMULA)
        safety_result = session.agent_results.get(AgentRole.SAFETY)

        if formula_result and safety_result:
            if formula_result.success and not safety_result.success:
                conflicts.append("配方生成成功但安全评估失败")
            elif formula_result.success and safety_result.success:
                safety_output = safety_result.output
                if safety_output.get("is_safe") is False:
                    conflicts.append("安全评估检测到风险")

        return conflicts

    def _aggregate_results(self, session: CollaborationSession) -> Dict[str, Any]:
        """聚合所有 Agent 结果到共享上下文"""
        context: Dict[str, Any] = {
            "user_query": session.user_query,
            "agent_summaries": {},
        }

        for role, result in session.agent_results.items():
            if result.success and result.output:
                context["agent_summaries"][role.value] = {
                    "success": True,
                    "latency_ms": result.latency_ms,
                    "key_points": self._extract_key_points(result.output),
                }
            else:
                context["agent_summaries"][role.value] = {
                    "success": False,
                    "error": result.error,
                }

        return context

    def _extract_key_points(self, output: Dict[str, Any]) -> List[str]:
        """从 Agent 输出中提取关键信息"""
        points = []
        for key in ["formula", "safety_report", "knowledge_summary", "experiment_plan"]:
            if key in output:
                points.append(f"{key}: {str(output[key])[:100]}")
        return points[:3]

    def _determine_consensus(self, session: CollaborationSession) -> CollaborationStatus:
        """确定协作共识状态"""
        safety = session.agent_results.get(AgentRole.SAFETY)
        formula = session.agent_results.get(AgentRole.FORMULA)

        if not safety or not formula:
            return CollaborationStatus.FAILED

        if not safety.success or not formula.success:
            return CollaborationStatus.CONFLICT_DETECTED

        safety_output = safety.output
        if safety_output.get("is_safe") is False:
            return CollaborationStatus.CONFLICT_DETECTED

        return CollaborationStatus.CONSENSUS_REACHED

    def _synthesize_final_response(self, session: CollaborationSession) -> str:
        """综合所有 Agent 结果生成最终建议"""
        parts = ["## 多 Agent 协作结果\n\n"]
        parts.append(f"**用户请求**: {session.user_query}\n\n")

        # 各 Agent 摘要
        for role, summary in session.agent_results.items():
            if summary.success:
                parts.append(f"### {role.value.capitalize()} Agent ✓\n")
                if role == AgentRole.FORMULA:
                    formula = summary.output.get("formula", {})
                    if isinstance(formula, dict):
                        parts.append(f"- 配方: {formula.get('name', '未知')}\n")
                        parts.append(f"- 成分数: {len(formula.get('ingredients', []))}\n")
                elif role == AgentRole.SAFETY:
                    parts.append(f"- 安全性: {'安全' if summary.output.get('is_safe') else '有风险'}\n")
                    parts.append(f"- 风险数: {summary.output.get('risk_count', 0)}\n")
                elif role == AgentRole.KNOWLEDGE:
                    parts.append(f"- 文献数: {summary.output.get('total_found', 0)}\n")
                elif role == AgentRole.EXPERIMENT:
                    parts.append(f"- 实验步骤: {summary.output.get('steps_count', 0)}\n")
                parts.append("\n")

        # 最终建议
        if session.status == CollaborationStatus.CONSENSUS_REACHED:
            parts.append("**综合建议**: 配方通过安全审查，建议推进实验验证。\n")
        else:
            parts.append("**综合建议**: 检测到冲突，需要人工审核。\n")

        return "\n".join(parts)

    def get_session(self, session_id: str) -> Optional[CollaborationSession]:
        """查询协作会话"""
        return self._executions.get(session_id)

    def list_sessions(self, limit: int = 10) -> List[CollaborationSession]:
        """列出最近的协作会话"""
        items = list(self._executions.values())[-limit:]
        return sorted(items, key=lambda s: s.started_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)


# 全局单例
_collider: Optional[MultiAgentCollaborator] = None


def get_collaborator() -> MultiAgentCollaborator:
    """获取全局协作器单例"""
    global _collider
    if _collider is None:
        _collider = MultiAgentCollaborator()
    return _collider

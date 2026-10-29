"""
ReAct + ToT 高级推理引擎

融合 ReAct（推理+行动循环）和 ToT（思维树搜索）的高级推理框架。

ReAct 循环：Thought → Action → Observation → Thought → ...
ToT 扩展：在每个 Thought 步骤生成多个候选，并行探索，剪枝评估

适用场景：
- 复杂配方设计（多约束优化）
- 配伍禁忌深度分析
- 实验方案推理
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class ThoughtState(str, Enum):
    """思维状态"""
    INITIALIZING = "initializing"
    REASONING = "reasoning"
    ACTING = "acting"
    OBSERVING = "observing"
    REFLECTING = "reflecting"
    CONCLUDED = "concluded"
    FAILED = "failed"


@dataclass
class ThoughtNode:
    """思维树节点"""
    node_id: str
    thought: str
    state: ThoughtState = ThoughtState.INITIALIZING
    action: Optional[str] = None
    action_args: Dict[str, Any] = field(default_factory=dict)
    observation: Optional[str] = None
    score: float = 0.0
    children: List["ThoughtNode"] = field(default_factory=list)
    parent: Optional["ThoughtNode"] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "node_id": self.node_id,
            "thought": self.thought,
            "state": self.state.value,
            "action": self.action,
            "observation": self.observation,
            "score": self.score,
            "child_count": len(self.children),
        }


@dataclass
class ReasoningTrace:
    """推理轨迹"""
    trace_id: str
    query: str
    root_node: ThoughtNode
    explored_nodes: int = 0
    concluded_path: List[ThoughtNode] = field(default_factory=list)
    total_latency_ms: float = 0.0
    status: str = "running"

    def to_dict(self) -> dict:
        return {
            "trace_id": self.trace_id,
            "query": self.query,
            "explored_nodes": self.explored_nodes,
            "concluded_path_length": len(self.concluded_path),
            "total_latency_ms": round(self.total_latency_ms, 1),
            "status": self.status,
            "root_thought": self.root_node.thought[:200],
        }


class ReActToTEngine:
    """
    ReAct + ToT 高级推理引擎

    工作流程：
    1. 初始化思维树根节点
    2. 循环：Thought → Action → Observation
    3. 在每个 Thought 步骤生成多个候选（ToT 分支）
    4. 评估候选得分，剪枝低分节点
    5. 达到终止条件时回溯最优路径
    """

    def __init__(
        self,
        max_depth: int = 5,
        branching_factor: int = 3,
        max_nodes: int = 50,
    ):
        self._max_depth = max_depth
        self._branching_factor = branching_factor
        self._max_nodes = max_nodes
        self._traces: Dict[str, ReasoningTrace] = {}

    async def reason(
        self,
        query: str,
        tools: Dict[str, Any],
        initial_thought: Optional[str] = None,
    ) -> ReasoningTrace:
        """
        执行高级推理

        Args:
            query: 用户问题
            tools: 可用工具 {name: callable}
            initial_thought: 初始思维（可选）

        Returns:
            ReasoningTrace: 推理轨迹
        """
        trace_id = f"reason-{int(time.time())}-{hash(query) & 0xFFFF:04x}"
        start_time = time.time()

        # 初始化根节点
        root = ThoughtNode(
            node_id="root",
            thought=initial_thought or self._generate_initial_thought(query),
        )

        trace = ReasoningTrace(
            trace_id=trace_id,
            query=query,
            root_node=root,
            status="running",
        )
        self._traces[trace_id] = trace

        # 执行推理循环
        try:
            await self._reasoning_loop(trace, root, tools, depth=0)
            trace.status = "completed"
        except Exception as e:
            trace.status = "failed"
            logger.error("Reasoning failed: %s", e, exc_info=True)

        trace.total_latency_ms = (time.time() - start_time) * 1000
        logger.info(
            "Reasoning complete: trace=%s nodes=%d latency=%.0fms",
            trace_id, trace.explored_nodes, trace.total_latency_ms,
        )
        return trace

    async def _reasoning_loop(
        self,
        trace: ReasoningTrace,
        current_node: ThoughtNode,
        tools: Dict[str, Any],
        depth: int,
    ) -> None:
        """推理循环（深度优先搜索）"""
        if depth >= self._max_depth or trace.explored_nodes >= self._max_nodes:
            current_node.state = ThoughtState.CONCLUDED
            return

        trace.explored_nodes += 1
        current_node.state = ThoughtState.REASONING

        # Step 1: Thought（生成思维）
        thought = await self._generate_thought(trace, current_node)
        current_node.thought = thought

        # Step 2: 生成多个候选行动（ToT 分支）
        candidates = await self._generate_candidates(trace, current_node, tools)

        # Step 3: 评估候选得分
        scored_candidates = await self._evaluate_candidates(trace, candidates)

        # Step 4: 选择最优候选执行
        if scored_candidates:
            best = max(scored_candidates, key=lambda c: c[1])
            action, score = best

            current_node.action = action
            current_node.score = score
            current_node.state = ThoughtState.ACTING

            # 执行行动
            observation = await self._execute_action(trace, action, tools)
            current_node.observation = observation
            current_node.state = ThoughtState.OBSERVING

            # Step 5: 递归探索子节点
            for candidate, _ in scored_candidates[:self._branching_factor]:
                if trace.explored_nodes >= self._max_nodes:
                    break

                child = ThoughtNode(
                    node_id=f"node-{trace.explored_nodes}",
                    thought=f"分支: {candidate['thought']}",
                    parent=current_node,
                )
                current_node.children.append(child)
                await self._reasoning_loop(trace, child, tools, depth + 1)

        else:
            # 无候选行动，达到结论
            current_node.state = ThoughtState.CONCLUDED

    async def _generate_thought(self, trace: ReasoningTrace, node: ThoughtNode) -> str:
        """生成思维（简化版，实际可接入 LLM）"""
        return f"基于之前推理，我考虑：{node.thought}"

    async def _generate_candidates(
        self,
        trace: ReasoningTrace,
        node: ThoughtNode,
        tools: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """生成候选行动"""
        candidates = []
        for tool_name in list(tools.keys())[:self._branching_factor]:
            candidates.append({
                "thought": f"使用工具 {tool_name}",
                "action": tool_name,
                "args": {},
            })
        return candidates

    async def _evaluate_candidates(
        self,
        trace: ReasoningTrace,
        candidates: List[Dict[str, Any]],
    ) -> List[Tuple[Dict[str, Any], float]]:
        """评估候选得分"""
        scored = []
        for candidate in candidates:
            # 简化评分：基于工具名称哈希
            score = hash(candidate["action"]) % 100 / 100.0
            scored.append((candidate, score))
        return sorted(scored, key=lambda x: x[1], reverse=True)

    async def _execute_action(
        self,
        trace: ReasoningTrace,
        action: str,
        tools: Dict[str, Any],
    ) -> str:
        """执行行动"""
        # action 可能是 dict（候选对象）或 string（工具名）
        tool_name = action if isinstance(action, str) else action.get("action", "")
        tool = tools.get(tool_name)
        if not tool:
            return f"工具 {tool_name} 不存在"
        try:
            args = action.get("args", {}) if isinstance(action, dict) else {}
            result = await tool(args)
            return str(result)[:200]
        except Exception as e:
            return f"执行失败: {e}"

    def _generate_initial_thought(self, query: str) -> str:
        """生成初始思维"""
        return f"分析用户需求: {query}"

    def get_trace(self, trace_id: str) -> Optional[ReasoningTrace]:
        """查询推理轨迹"""
        return self._traces.get(trace_id)

    def list_traces(self, limit: int = 10) -> List[ReasoningTrace]:
        """列出最近推理轨迹"""
        items = list(self._traces.values())[-limit:]
        return sorted(items, key=lambda t: t.root_node.created_at, reverse=True)


# 全局单例
_engine: Optional[ReActToTEngine] = None


def get_reasoning_engine(
    max_depth: int = 5,
    branching_factor: int = 3,
    max_nodes: int = 50,
) -> ReActToTEngine:
    """获取推理引擎单例"""
    global _engine
    if _engine is None:
        _engine = ReActToTEngine(
            max_depth=max_depth,
            branching_factor=branching_factor,
            max_nodes=max_nodes,
        )
    return _engine

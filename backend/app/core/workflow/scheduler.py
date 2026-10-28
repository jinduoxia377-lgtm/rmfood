"""
工作流 DAG 调度器

支持串行/并行/条件分支的工作流执行。
基于 asyncio 实现并发调度，支持任务级超时和重试。
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set

from app.core.workflow.executor_protocol import (
    ExecutionContext,
    ExecutionResult,
    get_executor_registry,
)

logger = logging.getLogger(__name__)


class EdgeType(str, Enum):
    SEQUENTIAL = "sequential"    # 串行
    PARALLEL = "parallel"         # 并行
    CONDITIONAL = "conditional"   # 条件分支


@dataclass
class WorkflowNode:
    """工作流节点"""
    id: int
    name: str
    task_type: str
    input_data: Dict[str, Any] = field(default_factory=dict)
    timeout: Optional[int] = None        # 秒
    max_retries: int = 3
    condition: Optional[Dict[str, Any]] = None  # 条件分支配置


@dataclass
class WorkflowEdge:
    """工作流边（连接两个节点）"""
    source_id: int
    target_id: int
    edge_type: EdgeType = EdgeType.SEQUENTIAL
    condition_expr: Optional[str] = None  # 条件表达式（如 "result.success == True"）


@dataclass
class WorkflowDAG:
    """工作流有向无环图"""
    workflow_id: int
    name: str
    nodes: Dict[int, WorkflowNode] = field(default_factory=dict)
    edges: List[WorkflowEdge] = field(default_factory=list)
    shared_state: Dict[str, Any] = field(default_factory=dict)

    def add_node(self, node: WorkflowNode) -> None:
        self.nodes[node.id] = node

    def add_edge(self, edge: WorkflowEdge) -> None:
        self.edges.append(edge)

    def get_successors(self, node_id: int) -> List[int]:
        """获取节点的后继节点"""
        return [e.target_id for e in self.edges if e.source_id == node_id]

    def get_predecessors(self, node_id: int) -> List[int]:
        """获取节点的前驱节点"""
        return [e.source_id for e in self.edges if e.target_id == node_id]

    def get_start_nodes(self) -> List[int]:
        """获取起始节点（无前驱）"""
        all_targets = {e.target_id for e in self.edges}
        return [nid for nid in self.nodes if nid not in all_targets]


@dataclass
class NodeExecutionState:
    """节点执行状态"""
    node_id: int
    status: str = "pending"         # pending/running/success/failed/skipped
    result: Optional[ExecutionResult] = None
    retry_count: int = 0
    error: Optional[str] = None


class WorkflowScheduler:
    """
    工作流 DAG 调度器

    执行策略：
    1. 拓扑排序确定执行顺序
    2. 并行执行无依赖的节点
    3. 条件分支根据前驱结果动态决定执行路径
    4. 失败重试（可配置次数）
    5. 超时控制（节点级）
    """

    def __init__(self, max_concurrent: int = 4):
        self._registry = get_executor_registry()
        self.max_concurrent = max_concurrent
        self._semaphore = asyncio.Semaphore(max_concurrent)

    async def execute(
        self,
        dag: WorkflowDAG,
        on_progress: Optional[Callable[[int, str, ExecutionResult], None]] = None,
    ) -> Dict[str, Any]:
        """
        执行工作流 DAG

        Args:
            dag: 工作流图
            on_progress: 进度回调 (task_id, status, result)

        Returns:
            执行结果摘要
        """
        states: Dict[int, NodeExecutionState] = {
            nid: NodeExecutionState(node_id=nid)
            for nid in dag.nodes
        }

        completed: Set[int] = set()
        failed_nodes: Set[int] = set()
        skipped_nodes: Set[int] = set()

        while len(completed) < len(dag.nodes):
            # 找出所有可执行的节点（前驱都已完成）
            runnable = self._get_runnable(dag, states, completed, skipped_nodes)

            if not runnable:
                # 没有可运行的节点但还有未完成的任务 → 死锁或全部跳过
                for nid in dag.nodes:
                    if nid not in completed and nid not in failed_nodes and nid not in skipped_nodes:
                        states[nid].status = "skipped"
                        states[nid].error = "前置节点失败，跳过"
                        skipped_nodes.add(nid)
                break

            # 并行执行可运行节点
            tasks = []
            for nid in runnable:
                tasks.append(self._execute_node(dag, states, nid, on_progress))

            results = await asyncio.gather(*tasks, return_exceptions=True)

            for nid, result in zip(runnable, results):
                if isinstance(result, Exception):
                    states[nid].status = "failed"
                    states[nid].error = str(result)
                    failed_nodes.add(nid)
                    logger.error("Node %d failed with exception: %s", nid, result)
                elif isinstance(result, ExecutionResult):
                    if result.success:
                        states[nid].status = "success"
                        completed.add(nid)
                    else:
                        states[nid].status = "failed"
                        states[nid].error = result.error
                        failed_nodes.add(nid)
                else:
                    states[nid].status = "failed"
                    states[nid].error = f"Unexpected result type: {type(result)}"
                    failed_nodes.add(nid)

            # 处理条件分支
            self._evaluate_conditions(dag, states, completed, skipped_nodes)

        # 汇总结果
        return self._build_summary(dag, states, completed, failed_nodes, skipped_nodes)

    async def _execute_node(
        self,
        dag: WorkflowDAG,
        states: Dict[int, NodeExecutionState],
        node_id: int,
        on_progress: Optional[Callable],
    ) -> ExecutionResult:
        """执行单个节点（带重试）"""
        node = dag.nodes[node_id]
        state = states[node_id]
        executor = self._registry.get(node.task_type)

        if not executor:
            return ExecutionResult(
                task_id=node_id,
                success=False,
                error=f"未注册的执行器: {node.task_type}",
            )

        # 重试循环
        for attempt in range(node.max_retries + 1):
            state.retry_count = attempt
            context = ExecutionContext(
                task_id=node_id,
                workflow_id=dag.workflow_id,
                task_name=node.name,
                task_type=node.task_type,
                input_data=node.input_data,
                workflow_config={},
                shared_state=dag.shared_state,
            )

            if on_progress:
                # A-27: on_progress 是 async（workflow_exec_router 传入的协程），
                # 原代码未 await 导致进度推送与任务状态持久化静默失效。
                # 这里统一 await，并吞掉推送异常避免影响执行主流程。
                try:
                    await on_progress(node_id, "running", None)
                except Exception as _pe:
                    logger.warning("on_progress(running) 回调失败: %s", _pe)

            result = await executor.execute_with_timing(context, timeout=node.timeout)
            state.result = result

            if result.success:
                if on_progress:
                    try:
                        await on_progress(node_id, "success", result)
                    except Exception as _pe:
                        logger.warning("on_progress(success) 回调失败: %s", _pe)
                return result

            # 重试
            if attempt < node.max_retries:
                wait = min(2 ** attempt, 10)  # 指数退避，最多10秒
                logger.warning(
                    "Node %d (%s) attempt %d/%d failed: %s, retrying in %ds",
                    node_id, node.name, attempt + 1, node.max_retries + 1,
                    result.error, wait,
                )
                await asyncio.sleep(wait)
            else:
                logger.error(
                    "Node %d (%s) failed after %d attempts: %s",
                    node_id, node.name, node.max_retries + 1, result.error,
                )

        return result

    def _get_runnable(
        self,
        dag: WorkflowDAG,
        states: Dict[int, NodeExecutionState],
        completed: Set[int],
        skipped: Set[int],
    ) -> List[int]:
        """获取当前可运行的节点列表"""
        runnable = []
        for nid, node in dag.nodes.items():
            if nid in completed or nid in skipped:
                continue
            preds = dag.get_predecessors(nid)
            if all(p in completed or p in skipped for p in preds):
                # 检查条件分支
                if node.condition:
                    if not self._evaluate_condition(node.condition, states):
                        skipped.add(nid)
                        states[nid].status = "skipped"
                        continue
                runnable.append(nid)
        return runnable

    def _evaluate_conditions(
        self,
        dag: WorkflowDAG,
        states: Dict[int, NodeExecutionState],
        completed: Set[int],
        skipped: Set[int],
    ) -> None:
        """评估条件分支，标记应跳过的节点"""
        for nid, node in dag.nodes.items():
            if nid in completed or nid in skipped:
                continue
            if node.condition and not self._evaluate_condition(node.condition, states):
                skipped.add(nid)
                states[nid].status = "skipped"
                states[nid].error = "条件不满足，已跳过"

    def _evaluate_condition(
        self,
        condition: Dict[str, Any],
        states: Dict[int, NodeExecutionState],
    ) -> bool:
        """评估条件表达式"""
        expr = condition.get("expression", "True")
        deps = condition.get("depends_on", [])

        # 收集依赖节点的结果
        dep_results = {}
        for dep_id in deps:
            if dep_id in states and states[dep_id].result:
                dep_results[f"node_{dep_id}"] = states[dep_id].result.output_data

        # 简单条件评估（支持 "node_X.success == True" 格式）
        try:
            # 替换 node_X.success 为实际值
            eval_expr = expr
            for dep_id, result_data in dep_results.items():
                for key in ["success", "error", "output_data"]:
                    val = result_data.get(key) if isinstance(result_data, dict) else None
                    eval_expr = eval_expr.replace(f"{dep_id}.{key}", str(val))

            return bool(eval(eval_expr, {"__builtins__": {}}, {}))
        except Exception as eval_err:
            logger.debug("条件评估失败，默认通过: %s", eval_err)
            return True  # 条件评估失败时默认通过

    def _build_summary(
        self,
        dag: WorkflowDAG,
        states: Dict[int, NodeExecutionState],
        completed: Set[int],
        failed: Set[int],
        skipped: Set[int],
    ) -> Dict[str, Any]:
        """构建执行摘要"""
        total_time = 0
        for nid in completed:
            r = states[nid].result
            if r:
                total_time += r.latency_ms

        return {
            "workflow_id": dag.workflow_id,
            "workflow_name": dag.name,
            "total_nodes": len(dag.nodes),
            "completed": len(completed),
            "failed": len(failed),
            "skipped": len(skipped),
            "total_latency_ms": round(total_time, 1),
            "node_results": {
                nid: {
                    "status": states[nid].status,
                    "error": states[nid].error,
                    "retry_count": states[nid].retry_count,
                    "latency_ms": states[nid].result.latency_ms if states[nid].result else 0,
                    "output": states[nid].result.output_data if states[nid].result else None,
                }
                for nid in dag.nodes
            },
        }


# 便捷函数
async def execute_workflow_dag(
    dag: WorkflowDAG,
    max_concurrent: int = 4,
    on_progress: Optional[Callable] = None,
) -> Dict[str, Any]:
    """执行工作流 DAG（便捷入口）

    Args:
        dag: 工作流图
        max_concurrent: 最大并发节点数
        on_progress: 进度回调 (task_id, status, result)，可为 async 协程。

    Note:
        A-27: 原签名缺少 on_progress，导致调用方
        ``execute_workflow_dag(dag, on_progress=...)`` 直接抛 TypeError，
        使任何工作流执行必然崩溃。这里补齐参数并透传给 scheduler。
    """
    scheduler = WorkflowScheduler(max_concurrent=max_concurrent)
    return await scheduler.execute(dag, on_progress=on_progress)

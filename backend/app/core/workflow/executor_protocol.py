"""
工作流执行器协议

定义所有节点执行器必须实现的接口。
每个执行器处理一种 task_type，接收 input_data，返回 output_data。
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class ExecutionContext:
    """节点执行上下文"""
    task_id: int
    workflow_id: int
    task_name: str
    task_type: str
    input_data: Dict[str, Any]
    workflow_config: Dict[str, Any] = field(default_factory=dict)
    shared_state: Dict[str, Any] = field(default_factory=dict)  # 跨任务共享状态


@dataclass
class ExecutionResult:
    """节点执行结果"""
    task_id: int
    success: bool
    output_data: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    latency_ms: float = 0.0

    @property
    def duration_ms(self) -> int:
        return int(self.latency_ms)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "success": self.success,
            "output_data": self.output_data,
            "error": self.error,
            "latency_ms": round(self.latency_ms, 1),
        }


class WorkflowExecutor(ABC):
    """
    工作流节点执行器基类

    子类必须实现:
    - task_type: 支持的 task_type 字符串
    - execute(): 执行节点逻辑
    """

    @property
    @abstractmethod
    def task_type(self) -> str:
        """支持的 task_type，如 'llm', 'formula_gpt', 'safety_check'"""
        ...

    @property
    def description(self) -> str:
        """执行器描述"""
        return self.task_type

    @abstractmethod
    async def execute(
        self,
        context: ExecutionContext,
    ) -> ExecutionResult:
        """
        执行节点

        Args:
            context: 执行上下文，包含输入数据和共享状态

        Returns:
            ExecutionResult 包含输出数据和状态
        """
        ...

    async def execute_with_timing(
        self,
        context: ExecutionContext,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        """
        带超时的执行（子类可覆盖以支持异步超时）
        """
        import asyncio

        start = datetime.now(timezone.utc)
        context.started_at = start

        try:
            if timeout:
                result = await asyncio.wait_for(
                    self.execute(context),
                    timeout=timeout,
                )
            else:
                result = await self.execute(context)

            result.completed_at = datetime.now(timezone.utc)
            result.latency_ms = (
                (result.completed_at - result.started_at).total_seconds() * 1000
            )
            return result

        except asyncio.TimeoutError:
            return ExecutionResult(
                task_id=context.task_id,
                success=False,
                error=f"任务超时 ({timeout}s)",
                started_at=start,
                completed_at=datetime.now(timezone.utc),
            )
        except Exception as e:
            return ExecutionResult(
                task_id=context.task_id,
                success=False,
                error=str(e),
                started_at=start,
                completed_at=datetime.now(timezone.utc),
            )


class ExecutorRegistry:
    """执行器注册表"""

    def __init__(self):
        self._executors: Dict[str, WorkflowExecutor] = {}

    def register(self, executor: WorkflowExecutor) -> None:
        self._executors[executor.task_type] = executor
        logger.info("Workflow executor registered: %s", executor.task_type)

    def get(self, task_type: str) -> Optional[WorkflowExecutor]:
        return self._executors.get(task_type)

    def list_types(self) -> list[str]:
        return list(self._executors.keys())


# 全局注册表
_registry = ExecutorRegistry()


def get_executor_registry() -> ExecutorRegistry:
    return _registry


def register_executor(executor_cls):
    """Class decorator: instantiates executor and registers it."""
    instance = executor_cls()
    _registry.register(instance)
    return executor_cls

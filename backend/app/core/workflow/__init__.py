"""
工作流核心模块
"""
from .executor_protocol import (
    ExecutionContext,
    ExecutionResult,
    WorkflowExecutor,
    ExecutorRegistry,
    get_executor_registry,
    register_executor,
)
from .scheduler import (
    WorkflowDAG,
    WorkflowNode,
    WorkflowEdge,
    EdgeType,
    WorkflowScheduler,
    execute_workflow_dag,
)

# 延迟注册内置执行器（避免循环导入）
_ensure_executors_registered_called = False

def _ensure_registered():
    global _ensure_executors_registered_called
    if not _ensure_executors_registered_called:
        _ensure_executors_registered_called = True
        from .executors import built_in  # noqa: F401 (side-effect)
        from .executors import agent_executors  # noqa: F401 (side-effect)

# 初始化时注册
_ensure_registered()

__all__ = [
    "ExecutionContext",
    "ExecutionResult",
    "WorkflowExecutor",
    "ExecutorRegistry",
    "get_executor_registry",
    "register_executor",
    "WorkflowDAG",
    "WorkflowNode",
    "WorkflowEdge",
    "EdgeType",
    "WorkflowScheduler",
    "execute_workflow_dag",
]
"""
AI Agent 子包

包含：
- tools: 工具集（RAG检索、合规检查、配方生成、实验方案）
- orchestrator: Agent编排引擎
"""
from .orchestrator import AgentExecution, AgentOrchestrator, get_orchestrator

# 工具自动注册（导入即注册）
from .tools import (
    BaseAgentTool,
    ToolRegistry,
    ToolResult,
    compliance_tool,  # noqa: F401
    experiment_tool,  # noqa: F401
    formula_tool,  # noqa: F401
    get_tool_registry,
    rag_tool,  # noqa: F401 (side-effect: registers RAGRetrievalTool, RAGStatsTool)
    register_tool,
)

__all__ = [
    "AgentOrchestrator",
    "AgentExecution",
    "get_orchestrator",
    "BaseAgentTool",
    "ToolResult",
    "ToolRegistry",
    "get_tool_registry",
    "register_tool",
]

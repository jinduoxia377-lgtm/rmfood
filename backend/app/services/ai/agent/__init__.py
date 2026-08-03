"""
AI Agent 子包

包含：
- tools: 工具集（RAG检索、合规检查、配方生成、实验方案）
- orchestrator: Agent编排引擎
"""
from .orchestrator import AgentOrchestrator, AgentExecution, get_orchestrator
from .tools import BaseAgentTool, ToolResult, ToolRegistry, get_tool_registry, register_tool

# 工具自动注册（导入即注册）
from .tools import rag_tool  # noqa: F401 (side-effect: registers RAGRetrievalTool, RAGStatsTool)
from .tools import compliance_tool  # noqa: F401
from .tools import formula_tool  # noqa: F401
from .tools import experiment_tool  # noqa: F401

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

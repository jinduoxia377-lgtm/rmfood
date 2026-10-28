"""
Agent 工具集协议

定义 Agent 可使用的工具接口，每个工具是一个异步函数，
接收上下文参数，返回结构化结果。
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Optional

logger = logging.getLogger(__name__)


@dataclass
class ToolResult:
    """工具执行结果"""
    tool_name: str
    success: bool
    data: Any = None
    error: Optional[str] = None
    latency_ms: float = 0.0

    def to_dict(self) -> dict:
        return {
            "tool": self.tool_name,
            "success": self.success,
            "data": self.data,
            "error": self.error,
            "latency_ms": round(self.latency_ms, 1),
        }


class BaseAgentTool(ABC):
    """Agent 工具基类"""

    @property
    @abstractmethod
    def name(self) -> str:
        """工具名称，用于 LLM function calling"""
        ...

    @property
    @abstractmethod
    def description(self) -> str:
        """工具描述，供 LLM 理解何时调用"""
        ...

    @property
    def parameters(self) -> dict:
        """工具参数 schema（JSON Schema 格式）"""
        return {"type": "object", "properties": {}}

    @abstractmethod
    async def execute(self, params: dict, context: dict) -> ToolResult:
        """执行工具逻辑"""
        ...

    async def execute_stream(
        self, params: dict, context: dict
    ) -> AsyncIterator[str]:
        """流式执行（默认非流式回退）"""
        result = await self.execute(params, context)
        if result.success and result.data:
            yield str(result.data)


class ToolRegistry:
    """工具注册表，管理所有可用工具"""

    def __init__(self):
        self._tools: dict[str, BaseAgentTool] = {}

    def register(self, tool: BaseAgentTool) -> None:
        self._tools[tool.name] = tool
        logger.info("Agent tool registered: %s", tool.name)

    def unregister(self, name: str) -> None:
        if name in self._tools:
            del self._tools[name]
            logger.info("Agent tool unregistered: %s", name)

    def get(self, name: str) -> Optional[BaseAgentTool]:
        return self._tools.get(name)

    def list_tools(self) -> list[dict]:
        """返回所有工具的 OpenAI 函数调用 schema"""
        return [
            {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.parameters,
                },
            }
            for tool in self._tools.values()
        ]

    def list_names(self) -> list[str]:
        return list(self._tools.keys())


# 全局注册表
_registry = ToolRegistry()


def get_tool_registry() -> ToolRegistry:
    return _registry


def register_tool(tool_cls):
    """Class decorator that instantiates the tool and registers it."""
    instance = tool_cls()
    _registry.register(instance)
    return tool_cls


# ── 自动注册所有工具 ─────────────────────────────────────────────

from .bot_admin_tools import CreateBotTool, DeleteBotTool, ListBotsTool, UpdateBotTool  # noqa: F401
from .compare_tool import FormulaCompareTool  # noqa: F401
from .compliance_tool import ComplianceCheckTool  # noqa: F401
from .cost_tool import CostEstimateTool  # noqa: F401
from .delegate_tool import DelegateTool  # noqa: F401
from .experiment_tool import ExperimentPlanTool  # noqa: F401
from .formula_tool import FormulaGenerationTool, IngredientInfoTool  # noqa: F401
from .literature_tool import LiteratureSearchTool  # noqa: F401
from .qa_tool import QAAnswerTool  # noqa: F401
from .rag_tool import RAGRetrievalTool, RAGStatsTool  # noqa: F401
from .safety_tool import SafetyAssessTool  # noqa: F401
from .stability_tool import StabilityPredictTool  # noqa: F401
from .taste_tool import TastePredictTool  # noqa: F401

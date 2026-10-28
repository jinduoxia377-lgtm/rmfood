"""
Agent 端口接口（M2.2）

定义 Agent 的抽象契约。
"""
from abc import ABC, abstractmethod

from .agents import (
    AgentContext,
    AgentResult,
    AgentRole,
    AgentTask,
)


class BaseAgent(ABC):
    """Agent 基类接口"""

    @property
    @abstractmethod
    def role(self) -> AgentRole:
        """Agent 角色"""
        ...

    @abstractmethod
    async def execute(self, task: AgentTask, context: AgentContext) -> AgentResult:
        """执行任务"""
        ...

    @abstractmethod
    async def validate(self, result: AgentResult) -> bool:
        """验证结果有效性"""
        ...


class AgentOrchestrator(ABC):
    """Agent 编排器接口"""

    @abstractmethod
    async def register_agent(self, agent: BaseAgent) -> None:
        """注册 Agent"""
        ...

    @abstractmethod
    async def process_request(self, user_request: str, constraints: dict = None) -> AgentContext:
        """处理用户请求（完整流程编排）"""
        ...

    @abstractmethod
    async def delegate_task(self, task: AgentTask, context: AgentContext) -> AgentResult:
        """委派任务给合适的 Agent"""
        ...

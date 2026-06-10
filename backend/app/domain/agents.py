"""
多 Agent 配方研发系统领域实体（M2.2）

定义 Agent 框架核心类型：任务、结果、Agent 规格。
"""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum, auto
from datetime import datetime
from typing import Optional


class AgentRole(Enum):
    """Agent 角色"""
    FORMULA_AGENT = auto()       # 配方生成 Agent
    KNOWLEDGE_AGENT = auto()     # 知识检索 Agent
    SAFETY_AGENT = auto()        # 安全评估 Agent
    ORCHESTRATOR = auto()        # 编排 Agent


class TaskType(Enum):
    """任务类型"""
    GENERATE_FORMULA = auto()     # 生成配方
    ANALYZE_INGREDIENTS = auto()  # 分析原料
    CHECK_SAFETY = auto()         # 安全检查
    SEARCH_KNOWLEDGE = auto()     # 知识检索
    OPTIMIZE_FORMULA = auto()     # 优化配方
    REVIEW_FORMULA = auto()       # 审核配方


class TaskStatus(Enum):
    """任务状态"""
    PENDING = auto()
    IN_PROGRESS = auto()
    COMPLETED = auto()
    FAILED = auto()
    BLOCKED = auto()


@dataclass
class AgentTask:
    """Agent 任务"""
    id: str
    type: TaskType
    input: dict
    assigned_role: AgentRole
    status: TaskStatus = TaskStatus.PENDING
    priority: int = 5  # 1-10, 数字越高优先级越高
    created_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    dependencies: list[str] = field(default_factory=list)  # 依赖的任务ID


@dataclass
class AgentResult:
    """Agent 执行结果"""
    task_id: str
    success: bool
    output: dict
    confidence: float = 1.0       # 置信度 0-1
    message: str = ""
    error: Optional[str] = None
    processing_time_ms: int = 0
    sources: list[str] = field(default_factory=list)  # 引用来源


@dataclass
class FormulaProposal:
    """配方提案（Agent 产出）"""
    name: str
    description: str
    ingredients: list[dict]       # [{name, dosage, unit, purpose}]
    target_effects: list[str]
    estimated_cost: float = 0.0
    estimated_effectiveness: float = 0.0  # 0-1
    rationale: str = ""           # 配方的推理依据
    references: list[str] = field(default_factory=list)


@dataclass
class SafetyReport:
    """安全评估报告（Agent 产出）"""
    is_safe: bool
    risk_factors: list[dict]     # [{level, description, suggestion}]
    incompatibilities: list[str] = field(default_factory=list)
    dosage_warnings: list[str] = field(default_factory=list)
    allergens: list[str] = field(default_factory=list)
    overall_score: float = 0.0   # 0-1
    suggestions: list[str] = field(default_factory=list)


@dataclass
class AgentContext:
    """Agent 对话上下文"""
    session_id: str
    user_request: str
    user_constraints: dict = field(default_factory=dict)  # {budget, allergens, targets}
    history: list[dict] = field(default_factory=list)
    current_proposal: Optional[FormulaProposal] = None
    safety_report: Optional[SafetyReport] = None
    knowledge_context: list[str] = field(default_factory=list)


@dataclass
class ConversationMessage:
    """Agent 间对话消息"""
    sender: AgentRole
    recipient: AgentRole
    content: str
    task_type: Optional[TaskType] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    metadata: dict = field(default_factory=dict)

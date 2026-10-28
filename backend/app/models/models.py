"""
RMFOOD 数据模型层 (SQLAlchemy ORM) - 兼容层

此文件保留用于向后兼容，实际模型已拆分到独立模块
请使用 from app.models import ... 导入
"""
from .enums import (
    ExperimentStatus,
    FormulaStatus,
    NotificationStatus,
    NotificationType,
    TaskStatus,
    UserRole,
    WorkflowStatus,
)
from .experiment import Experiment, ExperimentData
from .external_data import BioactivePeptide, KnowledgeGraphNode, MMIDHerb, SymMapHerb, TCMHerb
from .formula import (
    Comment,
    Formula,
    FormulaVersion,
    Ingredient,
    Peptide,
    formula_ingredients,
    formula_peptides,
)
from .notification import Notification
from .peptide_structure import PeptideStructureAnalysis
from .system import Attachment, AuditLog, DataSnapshot
from .user_model import User
from .workflow import Workflow, WorkflowTask, WorkflowTemplate

__all__ = [
    "UserRole",
    "FormulaStatus",
    "ExperimentStatus",
    "WorkflowStatus",
    "TaskStatus",
    "NotificationType",
    "NotificationStatus",
    "User",
    "Formula",
    "FormulaVersion",
    "Ingredient",
    "Peptide",
    "Comment",
    "formula_ingredients",
    "formula_peptides",
    "Experiment",
    "ExperimentData",
    "Workflow",
    "WorkflowTask",
    "WorkflowTemplate",
    "Notification",
    "AuditLog",
    "Attachment",
    "DataSnapshot",
    "TCMHerb",
    "MMIDHerb",
    "SymMapHerb",
    "BioactivePeptide",
    "KnowledgeGraphNode",
    "PeptideStructureAnalysis",
]

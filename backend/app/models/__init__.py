"""RMFOOD 数据模型层

模块化拆分后的模型导出
"""
from .enums import (
    UserRole,
    FormulaStatus,
    ExperimentStatus,
    WorkflowStatus,
    TaskStatus,
    NotificationType,
    NotificationStatus,
    DeviceType,
    TeamRole,
    SyncAction,
    SyncStatus,
    SuggestionType,
    # Phase 1: 批记录与追溯
    BatchStatus,
    SampleType,
    TestResult,
    IngredientLotStatus,
    CustomFieldType,
    CustomFieldEntity,
    ProjectPhase,
)
from .user_model import User
from .formula import Formula, FormulaVersion, Ingredient, Peptide, Comment, CommentLike, formula_ingredients, formula_peptides, formula_categories, formula_tags, Category, Tag
from .formula_template import FormulaTemplate
from .experiment import Experiment, ExperimentData
from .workflow import Workflow, WorkflowTask, WorkflowTemplate
from .notification import Notification, NotificationPreference
from .system import AuditLog, Attachment, DataSnapshot, SystemConfig
from .external_data import TCMHerb, MMIDHerb, SymMapHerb, BioactivePeptide, KnowledgeGraphNode
from .peptide_design import PeptideDesign, PeptideDesignCandidate, PeptideDesignStatus

# 云端同步模块
from .user_device import UserDevice
from .sync_log import SyncLog

# 团队协作模块
from .team import Team
from .team_member import TeamMember

# AI辅助模块
from .prompt_template import PromptTemplate
from .prompt_version import PromptVersion
from .ai_suggestion import AiSuggestion

# 对话记录模块
from .chat import ChatSession, ChatMessage

# 术语模块
from .terminology import Term, TermCategory, TermVariant, TermValidation, TermNormalizationRule, TermStatistics

# 肽分析模块
from .peptide_analysis import PeptideAnalysis, PeptideAnalysisDetail

# 深度集成模块
from .formula_deep_integration import (
    SynergyRecord,
    OptimizationResultRecord,
    CompatibilityReportRecord,
    EffectPredictionRecord,
    SafetyAlertLog,
    FormulaGenerationHistory,
    LabValidationData,
    SafetyThresholdChangeLog,
)

# CDC 变更捕获模块
from .change_event import ChangeEvent, ChangeAction

# 数据源健康监控模块
from .data_source_health import DataSourceHealth, DataSourceType, DataSourceStatus

# 知识图谱模块
from .knowledge_graph import KGNode, KGEdge

# TCMSP 规范化模块
from .tcm_schema import TCMCompound, TCMTarget, TCMDisease, tcm_herb_compounds, tcm_compound_targets, tcm_target_diseases

# DFBP 规范化模块
from .dfbp_schema import PeptideActivity, PeptideSourceProtein, PeptideEnzyme, peptide_enzyme_links

# GA/NSGA-II 优化结果持久化模块
from .ga_optimization import GARunRecord, GACandidateRecord

# Phase 1: 批记录与追溯体系
from .batch_record import Batch
from .sample import Sample
from .test_report import TestReport
from .ingredient_lot import IngredientLot

# Phase 1: 自定义字段和项目（使用原始SQL，无ORM模型）
# custom_field_definitions / custom_field_values / projects 表通过 raw SQL 操作

# Potion AI VFT 融合模块：食品原料 + 零售产品搜索
from .food_material import FoodMaterial
from .retail_product import RetailProduct

# 账号申请（预注册）模块
from .pre_register import PreRegisterRequest, PreRegisterStatus

# 药材 PK/PD/稳定性 真实参数表
from .herb_pharmaco_params import TCMHerbPK, TCMHerbPD, StabilityData
# 协同系数表（已存在，补充导入）
from .seed_data import SynergyInteraction

__all__ = [
    # 枚举
    "UserRole",
    "FormulaStatus",
    "ExperimentStatus",
    "WorkflowStatus",
    "TaskStatus",
    "NotificationType",
    "NotificationStatus",
    "DeviceType",
    "TeamRole",
    "SyncAction",
    "SyncStatus",
    "SuggestionType",
    # 核心模型
    "User",
    "Formula",
    "FormulaTemplate",
    "FormulaVersion",
    "Ingredient",
    "Peptide",
    "Comment",
    "CommentLike",
    "Category",
    "Tag",
    "formula_ingredients",
    "formula_peptides",
    "formula_categories",
    "formula_tags",
    "Experiment",
    "ExperimentData",
    "Workflow",
    "WorkflowTask",
    "WorkflowTemplate",
    "Notification",
    "AuditLog",
    "Attachment",
    "DataSnapshot",
    "SystemConfig",
    "TCMHerb",
    "MMIDHerb",
    "SymMapHerb",
    "BioactivePeptide",
    "KnowledgeGraphNode",
    "PeptideDesign",
    "PeptideDesignCandidate",
    "PeptideDesignStatus",
    # 云端同步模块
    "UserDevice",
    "SyncLog",
    # 团队协作模块
    "Team",
    "TeamMember",
    # AI辅助模块
    "PromptTemplate",
    "PromptVersion",
    "AiSuggestion",
    # 对话记录模块
    "ChatSession",
    "ChatMessage",
    # 术语模块
    "Term",
    "TermCategory",
    "TermVariant",
    "TermValidation",
    "TermNormalizationRule",
    "TermStatistics",
    # 肽分析模块
    "PeptideAnalysis",
    "PeptideAnalysisDetail",
    # 深度集成模块
    "SynergyRecord",
    "OptimizationResultRecord",
    "CompatibilityReportRecord",
    "EffectPredictionRecord",
    "SafetyAlertLog",
    "FormulaGenerationHistory",
    "LabValidationData",
    "SafetyThresholdChangeLog",
    # CDC 变更捕获模块
    "ChangeEvent",
    "ChangeAction",
    # 数据源健康监控模块
    "DataSourceHealth",
    "DataSourceType",
    "DataSourceStatus",
    # 知识图谱模块
    "KGNode",
    "KGEdge",
    # TCMSP 规范化模块
    "TCMCompound",
    "TCMTarget",
    "TCMDisease",
    "tcm_herb_compounds",
    "tcm_compound_targets",
    "tcm_target_diseases",
    # DFBP 规范化模块
    "PeptideActivity",
    "PeptideSourceProtein",
    "PeptideEnzyme",
    "peptide_enzyme_links",
    # GA/NSGA-II 优化结果持久化模块
    "GARunRecord",
    "GACandidateRecord",
    # Potion AI VFT 融合模块
    "FoodMaterial",
    "RetailProduct",
    # Phase 1: 批记录与追溯体系
    "Batch",
    "Sample",
    "TestReport",
    "IngredientLot",
    "BatchStatus",
    "SampleType",
    "TestResult",
    "IngredientLotStatus",
    "CustomFieldType",
    "CustomFieldEntity",
    "ProjectPhase",
    # 账号申请（预注册）模块
    "PreRegisterRequest",
    "PreRegisterStatus",
    # 药材 PK/PD/稳定性 真实参数表
    "TCMHerbPK",
    "TCMHerbPD",
    "StabilityData",
    "SynergyInteraction",
]

"""RMFOOD 数据模型层

模块化拆分后的模型导出
"""
from .ai_model_config import AIModelConfig
from .ai_suggestion import AiSuggestion
from .api_key import ApiKey, Webhook

# Phase 1: 批记录与追溯体系
from .batch_record import Batch

# 多智能体协作平台模块（DS Bot 移植 v1.2）
from .bot import AIBot, BotGroupMember, BotGroupMessage, BotGroupSession, BotMemory

# CDC 变更捕获模块
from .change_event import ChangeAction, ChangeEvent

# 对话记录模块
from .chat import ChatMessage, ChatSession

# 数据源健康监控模块
from .data_source_health import DataSourceHealth, DataSourceStatus, DataSourceType

# 数据检索中心扩展：RMCHM 中药材库 + CFAM 官方药食同源目录
from .database_extras import CFAMHerb, RMCHMHerb

# DFBP 规范化模块
from .dfbp_schema import PeptideActivity, PeptideEnzyme, PeptideSourceProtein, peptide_enzyme_links
from .document_extraction import DocumentExtraction
from .document_version import DocumentAuditLog as RAGDocumentAuditLog

# RAG 知识库文档版本持久化
from .document_version import DocumentVersion as RAGDocumentVersion
from .enums import (
    # Phase 1: 批记录与追溯
    BatchStatus,
    CustomFieldEntity,
    CustomFieldType,
    DeviceType,
    ExperimentStatus,
    FormulaStatus,
    IngredientLotStatus,
    NotificationStatus,
    NotificationType,
    ProjectPhase,
    SampleType,
    SuggestionType,
    SyncAction,
    SyncStatus,
    TaskStatus,
    TeamRole,
    TestResult,
    UserRole,
    WorkflowStatus,
)
from .experiment import Experiment, ExperimentData
from .external_data import (
    BioactivePeptide,
    HFEHerb,
    KnowledgeGraphNode,
    MMIDHerb,
    SymMapHerb,
    TCMHerb,
)

# Phase 1: 自定义字段和项目（使用原始SQL，无ORM模型）
# custom_field_definitions / custom_field_values / projects 表通过 raw SQL 操作
# Potion AI VFT 融合模块：食品原料 + 零售产品搜索
from .food_material import FoodMaterial
from .formula import (
    Category,
    Comment,
    CommentLike,
    Formula,
    FormulaVersion,
    Ingredient,
    Peptide,
    Tag,
    formula_categories,
    formula_ingredients,
    formula_peptides,
    formula_tags,
)

# 深度集成模块
from .formula_deep_integration import (
    CompatibilityReportRecord,
    EffectPredictionRecord,
    FormulaGenerationHistory,
    LabValidationData,
    OptimizationResultRecord,
    SafetyAlertLog,
    SafetyThresholdChangeLog,
    SynergyRecord,
)

# 配方反馈闭环
from .formula_feedback import FormulaFeedback
from .formula_template import FormulaTemplate

# GA/NSGA-II 优化结果持久化模块
from .ga_optimization import GACandidateRecord, GARunRecord

# 药材 PK/PD/稳定性 真实参数表
from .herb_pharmaco_params import StabilityData, TCMHerbPD, TCMHerbPK
from .ingredient_lot import IngredientLot

# 知识图谱模块
from .knowledge_graph import KGEdge, KGNode
from .mcp_server import McpServerConfig
from .notification import Notification, NotificationPreference

# 组织/租户与 API Key（必须在此注册，否则 SQLAlchemy 配置 Organization 关系时
# 无法解析 "ApiKey" / "OrganizationMember" 字符串，导致 mapper 初始化失败）
from .organization import Organization, OrganizationInvitation, OrganizationMember, Subscription

# 肽分析模块
from .peptide_analysis import PeptideAnalysis, PeptideAnalysisDetail

# 多肽批次COA 模块（Peptide.batch_coas 关系按字符串引用 PeptideBatchCOA，
# 必须在此注册，否则 mapper 初始化时无法定位该类 → InvalidRequestError）
from .peptide_batch_coa import COATestItem, PeptideBatchCOA
from .peptide_design import PeptideDesign, PeptideDesignCandidate, PeptideDesignStatus

# 账号申请（预注册）模块
from .pre_register import PreRegisterRequest, PreRegisterStatus

# AI辅助模块
from .prompt_template import PromptTemplate
from .prompt_version import PromptVersion
from .retail_product import RetailProduct
from .sample import Sample

# 协同系数表（已存在，补充导入）
from .seed_data import SynergyInteraction
from .sync_log import SyncLog
from .system import Attachment, AuditLog, DataSnapshot, SystemConfig

# v3.3：任务驱动自动建群 + MCP 服务器注册表
from .task_group import TaskGroup

# TCMSP 规范化模块
from .tcm_schema import (
    TCMCompound,
    TCMDisease,
    TCMTarget,
    tcm_compound_targets,
    tcm_herb_compounds,
    tcm_target_diseases,
)

# 团队协作模块
from .team import Team
from .team_member import TeamMember

# 术语模块
from .terminology import (
    Term,
    TermCategory,
    TermNormalizationRule,
    TermStatistics,
    TermValidation,
    TermVariant,
)
from .test_report import TestReport

# Phase 3：AI 用量统计
from .usage import AiBotUsage

# 云端同步模块
from .user_device import UserDevice
from .user_model import User
from .workflow import Workflow, WorkflowTask, WorkflowTemplate

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
    "HFEHerb",
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
    "AIModelConfig",
    # 对话记录模块
    "ChatSession",
    "ChatMessage",
    # 多智能体协作平台模块
    "AIBot",
    "BotMemory",
    "BotGroupSession",
    "BotGroupMember",
    "BotGroupMessage",
    "TaskGroup",
    "McpServerConfig",
    "AiBotUsage",
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
    # 多肽批次COA 模块
    "PeptideBatchCOA",
    "COATestItem",
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
    # 配方反馈闭环
    "FormulaFeedback",
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
    "DocumentExtraction",
    # RAG 知识库文档版本持久化
    "RAGDocumentVersion",
    "RAGDocumentAuditLog",
]

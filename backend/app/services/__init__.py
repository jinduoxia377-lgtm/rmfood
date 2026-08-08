"""RMFOOD 服务层"""
from .auth import AuthService
from .user import UserService
from .formula import FormulaService
from .experiment import ExperimentService
from .ingredient import IngredientService
from .peptide import PeptideService
from .ai import AIService, ai_service
from .cost_calculator import (
    CostCalculator,
    CostCalculationResult,
    CostEffectivenessResult,
    OptimizationResult,
    CostBreakdownItem,
    CostUnit,
    cost_calculator,
    calculate_formula_cost,
    calculate_cost_effectiveness,
    optimize_cost_constraints,
    INGREDIENT_COSTS,
)
from .data_preprocessing import (
    DataPreprocessingPipeline,
    data_preprocessing_pipeline,
    ParameterNormalizer,
    MissingValueHandler,
    EffectEncoder,
    HerbFeatureExtractor,
    CompatibilityFeatureBuilder,
    PreprocessingConfig,
    EFFECT_ENCODINGS,
    CATEGORY_ENCODINGS,
)
from .notification import NotificationService
from .workflow import WorkflowService
from .file_generator import FileGeneratorService, file_generator_service, FileFormat, TaskStatus
from .document_templates import (
    DocumentTemplateService,
    document_template_service,
    DocumentConverter,
    MarkdownParser,
    HTMLParser,
    ChineseMedicineReportTemplate,
    ExperimentDataTemplate,
    FormulaAnalysisReportTemplate,
)
from .synthetic_data_generator import (
    SyntheticFormulaGenerator,
    SyntheticDataQualityAssessor,
    SyntheticDataStorage,
    Formula,
    generate_ingredient_perturbations,
)
from .constraint_penalty import (
    ConstraintPenaltyMechanism,
    PenaltyFunctionFactory,
    SoftConstraintScorer,
    ConstraintVisualizer,
    PenaltyForm,
    Constraint,
    create_penalty_aware_objective,
)
from .historical_learning import (
    EnhancedHistoricalLearner,
    EnhancedSimilarityCalculator,
    KnowledgeGraphEnhancer,
    FeedbackLearningSystem,
    FormulaEmbedding,
)
from .data_preprocessing_pipeline import (
    DataPreprocessingPipeline,
    AutoDataCleaner,
    OutlierDetector,
    AutoFeatureEngineer,
    DataQualityMonitor,
    PipelineManager,
    PipelineConfig,
)
from .knowledge_base import (
    HERB_KNOWLEDGE_BASE,
    search_herbs,
    get_herb,
    get_food_homology_herbs,
    get_herbs_by_effect,
)
from .intent_analyzer import IntentAnalyzer
from .knowledge_retriever import KnowledgeRetriever
from .reasoner import Reasoner
from .formula_designer import FormulaDesigner
from .answer_formatter import AnswerFormatter
from .thinking_engine import ThinkingEngine, thinking_engine

__all__ = [
    "AuthService",
    "get_current_user",
    "UserService",
    "FormulaService",
    "ExperimentService",
    "IngredientService",
    "PeptideService",
    "AIService",
    "ai_service",
    "CostCalculator",
    "CostCalculationResult",
    "CostEffectivenessResult",
    "OptimizationResult",
    "CostBreakdownItem",
    "CostUnit",
    "cost_calculator",
    "calculate_formula_cost",
    "calculate_cost_effectiveness",
    "optimize_cost_constraints",
    "INGREDIENT_COSTS",
    "DataPreprocessingPipeline",
    "data_preprocessing_pipeline",
    "ParameterNormalizer",
    "MissingValueHandler",
    "EffectEncoder",
    "HerbFeatureExtractor",
    "CompatibilityFeatureBuilder",
    "PreprocessingConfig",
    "EFFECT_ENCODINGS",
    "CATEGORY_ENCODINGS",
    "NotificationService",
    "WorkflowService",
    "FileGeneratorService",
    "file_generator_service",
    "FileFormat",
    "TaskStatus",
    "DocumentTemplateService",
    "document_template_service",
    "DocumentConverter",
    "MarkdownParser",
    "HTMLParser",
    "ChineseMedicineReportTemplate",
    "ExperimentDataTemplate",
    "FormulaAnalysisReportTemplate",
    "SyntheticFormulaGenerator",
    "SyntheticDataQualityAssessor",
    "SyntheticDataStorage",
    "Formula",
    "generate_ingredient_perturbations",
    "ConstraintPenaltyMechanism",
    "PenaltyFunctionFactory",
    "SoftConstraintScorer",
    "ConstraintVisualizer",
    "PenaltyForm",
    "Constraint",
    "create_penalty_aware_objective",
    "EnhancedHistoricalLearner",
    "EnhancedSimilarityCalculator",
    "KnowledgeGraphEnhancer",
    "FeedbackLearningSystem",
    "FormulaEmbedding",
    "AutoDataCleaner",
    "OutlierDetector",
    "AutoFeatureEngineer",
    "DataQualityMonitor",
    "PipelineManager",
    "HERB_KNOWLEDGE_BASE",
    "search_herbs",
    "get_herb",
    "get_food_homology_herbs",
    "get_herbs_by_effect",
    "IntentAnalyzer",
    "KnowledgeRetriever",
    "Reasoner",
    "FormulaDesigner",
    "AnswerFormatter",
    "ThinkingEngine",
    "thinking_engine",
]

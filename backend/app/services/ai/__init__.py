"""RMFOOD AI Services module

Submodules:
- chat_engine: Academician chat engine
- algorithms: Optimizer implementations (Bayesian, Genetic, etc.)
- llm_service: LLM provider services
- shared: Shared services like recommendation engine
- pipelines: Knowledge graph pipelines
- multimodal_engine: Multimodal processing
- super_intelligence_ensembler: Model ensembling
"""

from .providers import (
    LLMProvider,
    OpenAIProvider,
    AnthropicProvider,
    LocalLlamaProvider,
    LLMProviderFactory,
    get_provider_factory,
)
from .shared import (
    RecommendationEngine,
    get_recommendation_engine,
    TemplateService,
    get_template_service,
)
from .orchestration import (
    AIGenerationService,
    get_generation_service,
    AIOptimizationService,
    PromptSyntaxChecker,
    PromptStructureAnalyzer,
    EffectivenessPredictor,
    get_optimization_service,
    AIService,
    ai_service,
    AIFormulaResult,
)
from .orchestration.chat_engine import AcademicianChatEngine, get_chat_engine
from .algorithms import (
    BayesianFormulaOptimizer,
    get_bayesian_optimizer,
    GeneticFormulaOptimizer,
    get_genetic_optimizer,
    NeuralFormulaNetwork,
    NeuralEnsemble,
    get_neural_ensemble,
)
from .pipelines import FormulaKnowledgeGraph, DBKnowledgeGraphService, get_knowledge_graph
from .orchestration.multimodal_engine import MultimodalEngine, get_multimodal_engine
from .orchestration.super_intelligence_ensembler import SuperIntelligenceEnsembler, get_super_ensembler


async def init_ai_services():
    """Initialize AI services. Call this at application startup."""
    import logging
    logger = logging.getLogger(__name__)
    logger.info("[AI Services] Initializing...")

    # Initialize LLM service config
    try:
        from app.services.llm_service import llm_service, load_config_from_db
        db_config = await load_config_from_db()
        if db_config:
            # 直接赋值运行时配置，不调用 update_config（它会把配置重新加密写回数据库，
            # 导致启动时反复覆盖数据库中的明文/历史值）。
            llm_service.config = db_config
            logger.info("[AI Services] LLM configuration loaded from database")
        else:
            logger.info("[AI Services] LLM using default configuration")
    except Exception as e:
        logger.warning("[AI Services] LLM initialization failed: " + str(e))

    # Initialize herb knowledge via port
    try:
        from app.factories.adapters_factory import get_adapter_registry
        from app.core.database.session import async_session_factory
        registry = get_adapter_registry()
        registry.load_all()
        # 获取 DB session 并创建适配器实例
        async with async_session_factory() as db:
            herb_knowledge_port = registry.get_adapter_instance("herb_knowledge", db)
            from .algorithms.herb_knowledge_service import HerbKnowledgeService, set_global_herb_knowledge
            herb_service = HerbKnowledgeService(herb_knowledge_port)
            herbs = await herb_service.load_herbs(force_reload=True)
            if len(herbs) > 21:
                logger.info(f"[AI Services] HerbKnowledgeService initialized: {len(herbs)} herbs")
            else:
                logger.warning(f"[AI Services] HerbKnowledgeService only loaded {len(herbs)} herbs")
            set_global_herb_knowledge(herb_service)
    except ImportError as e:
        logger.debug("[AI Services] Skipping HerbKnowledgeService initialization: " + str(e))
    except Exception as e:
        logger.warning("[AI Services] HerbKnowledgeService initialization failed: " + str(e))

    logger.info("[AI Services] Initialization complete")


__all__ = [
    "LLMProvider",
    "OpenAIProvider",
    "AnthropicProvider",
    "LocalLlamaProvider",
    "LLMProviderFactory",
    "get_provider_factory",
    "RecommendationEngine",
    "get_recommendation_engine",
    "TemplateService",
    "get_template_service",
    "AIGenerationService",
    "get_generation_service",
    "AIOptimizationService",
    "PromptSyntaxChecker",
    "PromptStructureAnalyzer",
    "EffectivenessPredictor",
    "get_optimization_service",
    "AIService",
    "ai_service",
    "AIFormulaResult",
    "AcademicianChatEngine",
    "get_chat_engine",
    "BayesianFormulaOptimizer",
    "get_bayesian_optimizer",
    "GeneticFormulaOptimizer",
    "get_genetic_optimizer",
    "NeuralFormulaNetwork",
    "NeuralEnsemble",
    "get_neural_ensemble",
    "FormulaKnowledgeGraph",
    "DBKnowledgeGraphService",
    "get_knowledge_graph",
    "MultimodalEngine",
    "get_multimodal_engine",
    "SuperIntelligenceEnsembler",
    "get_super_ensembler",
]

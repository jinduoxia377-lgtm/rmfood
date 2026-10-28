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

from __future__ import annotations

import asyncio
import logging

from .algorithms import (
    BayesianFormulaOptimizer,
    GeneticFormulaOptimizer,
    NeuralEnsemble,
    NeuralFormulaNetwork,
    get_bayesian_optimizer,
    get_genetic_optimizer,
    get_neural_ensemble,
)
from .orchestration import (
    AIFormulaResult,
    AIGenerationService,
    AIOptimizationService,
    AIService,
    EffectivenessPredictor,
    PromptStructureAnalyzer,
    PromptSyntaxChecker,
    ai_service,
    get_generation_service,
    get_optimization_service,
)
from .orchestration.chat_engine import AcademicianChatEngine, get_chat_engine
from .orchestration.multimodal_engine import MultimodalEngine, get_multimodal_engine
from .orchestration.super_intelligence_ensembler import (
    SuperIntelligenceEnsembler,
    get_super_ensembler,
)
from .pipelines import DBKnowledgeGraphService, FormulaKnowledgeGraph, get_knowledge_graph
from .providers import (
    AnthropicProvider,
    LLMProvider,
    LLMProviderFactory,
    LocalLlamaProvider,
    OpenAIProvider,
    get_provider_factory,
)
from .shared import (
    RecommendationEngine,
    TemplateService,
    get_recommendation_engine,
    get_template_service,
)

# 全局标志：HerbKnowledgeService 是否初始化成功。
# 初始化失败时置 False，健康检查暴露 ai_herb_knowledge:false，禁止静默伪造配方。
_ai_herb_knowledge_initialized: bool = False

# 后台异步预热任务引用（防止被 GC 回收；仅在事件循环存活期间运行）。
_warmup_task: "asyncio.Task | None" = None


def ai_herb_knowledge_ready() -> bool:
    """返回 HerbKnowledgeService 是否初始化成功（健康检查/熔断用）。"""
    return _ai_herb_knowledge_initialized


async def _run_async_warmup() -> None:
    """后台预热 RAG 与 HerbKnowledge 索引，缩短 /generate 首次调用延迟。

    - RAG：导入 rag_service（触发 ChromaDB collection 加载 + BM25 倒排索引构建 +
      jieba 词典初始化），并执行一次真实检索 augment_query（触发本地/远程
      embedding 模型加载与缓存）。首次请求因此命中已加载模型缓存。
    - HerbKnowledge：确认功效-药材索引（get_efficacy_to_herbs）已构建。

    预热失败仅告警，绝不阻塞应用启动。
    """
    logger = logging.getLogger(__name__)

    # 1. HerbKnowledge 功效索引（load_herbs 已构建，这里仅确认；若为空则重建）
    try:
        from .algorithms.herb_knowledge_service import get_global_herb_knowledge
        hk = get_global_herb_knowledge()
        if hk is not None:
            efficacy_index = hk.get_efficacy_to_herbs()
            if not efficacy_index:
                hk._build_efficacy_index()
                efficacy_index = hk.get_efficacy_to_herbs()
            logger.info(
                "[AI Warmup] HerbKnowledge 功效索引已就绪: %d 个功效, %d 味药材",
                len(efficacy_index), len(hk.get_herbs()),
            )
        else:
            logger.warning("[AI Warmup] HerbKnowledgeService 尚未初始化，跳过功效索引预热")
    except Exception as e:
        logger.warning("[AI Warmup] HerbKnowledge 功效索引预热失败（忽略）: %s", e)

    # 2. RAG 预热：导入 rag_service 并执行一次真实检索
    try:
        from .rag.rag_service import rag_service
        await rag_service.augment_query("预热 增强免疫 药食同源 配伍禁忌", top_k=3)
        logger.info("[AI Warmup] RAG 预热完成（jieba/embedding/BM25 已加载）")
    except Exception as e:
        logger.warning("[AI Warmup] RAG 预热失败（忽略，首次请求仍可正常降级）: %s", e)


def _schedule_async_warmup() -> None:
    """调度后台异步预热任务（非阻塞，失败仅告警）。"""
    global _warmup_task
    logger = logging.getLogger(__name__)
    try:
        _warmup_task = asyncio.create_task(_run_async_warmup())
        logger.info("[AI Services] 已调度后台异步预热任务（RAG + HerbKnowledge）")
    except Exception as e:
        logger.warning("[AI Services] 调度异步预热任务失败（忽略）: %s", e)


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
    global _ai_herb_knowledge_initialized
    try:
        from app.core.database.session import async_session_factory
        from app.factories.adapters_factory import get_adapter_registry
        registry = get_adapter_registry()
        registry.load_all()
        # 获取 DB session 并创建适配器实例
        async with async_session_factory() as db:
            herb_knowledge_port = registry.get_adapter_instance("herb_knowledge", db)
            from .algorithms.herb_knowledge_service import (
                HerbKnowledgeService,
                set_global_herb_knowledge,
            )
            herb_service = HerbKnowledgeService(herb_knowledge_port)
            herbs = await herb_service.load_herbs(force_reload=True)
            if len(herbs) > 21:
                logger.info(f"[AI Services] HerbKnowledgeService initialized: {len(herbs)} herbs")
                _ai_herb_knowledge_initialized = True
            else:
                logger.warning(f"[AI Services] HerbKnowledgeService only loaded {len(herbs)} herbs")
                _ai_herb_knowledge_initialized = False
            set_global_herb_knowledge(herb_service)
    except ImportError as e:
        logger.debug("[AI Services] Skipping HerbKnowledgeService initialization: " + str(e))
        _ai_herb_knowledge_initialized = False
    except Exception as e:
        logger.error("[AI Services] HerbKnowledgeService initialization failed: " + str(e), exc_info=True)
        _ai_herb_knowledge_initialized = False

    # 调度后台异步预热（RAG jieba/embedding/BM25 + HerbKnowledge 功效索引）。
    # 预热在独立 Task 中执行，失败仅告警，不阻塞启动。
    _schedule_async_warmup()

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

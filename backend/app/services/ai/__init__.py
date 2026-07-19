"""RMFOOD AI助手服务模块
核心引擎: chat_engine | generation | optimization
算法库: bayesian | genetic | neural | kg | multimodal
"""

from .llm_provider import LLMProvider, OpenAIProvider, AnthropicProvider, LocalLlamaProvider
from .provider_factory import LLMProviderFactory, get_provider_factory
from .generation_service import AIGenerationService, get_generation_service
from .optimization_service import (
    AIOptimizationService, PromptSyntaxChecker, PromptStructureAnalyzer,
    EffectivenessPredictor, get_optimization_service,
)
from .recommendation_engine import RecommendationEngine, get_recommendation_engine
from .template_service import TemplateService, get_template_service
from .formula_service import AIService, ai_service, AIFormulaResult
from .chat_engine import AcademicianChatEngine, get_chat_engine
from .bayesian_formula_optimizer import BayesianFormulaOptimizer, get_bayesian_optimizer
from .genetic_formula_optimizer import GeneticFormulaOptimizer, get_genetic_optimizer
from .neural_formula_network import NeuralFormulaNetwork, NeuralEnsemble, get_neural_ensemble
from .knowledge_graph_service import FormulaKnowledgeGraph, DBKnowledgeGraphService, get_knowledge_graph
from .multimodal_engine import MultimodalEngine, get_multimodal_engine
from .super_intelligence_ensembler import SuperIntelligenceEnsembler, get_super_ensembler

async def init_ai_services():
    """
    初始化 AI 服务
    此函数在应用启动时被调用，用于初始化各种 AI 相关服务
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.info("[AI Services] 初始化开始...")
    
    try:
        from app.services.llm_service import llm_service, load_config_from_db
        # 尝试从数据库加载配置
        db_config = await load_config_from_db()
        if db_config:
            llm_service.update_config(db_config)
            logger.info("[AI Services] LLM 配置从数据库加载完成")
        else:
            logger.info("[AI Services] LLM 配置使用默认设置")
    except Exception as e:
        logger.warning(f"[AI Services] LLM 服务初始化警告: {e}")

    # ── 初始化 HerbKnowledgeService（全局缓存，供优化器注入）──
    try:
        from app.core.session import async_session_factory
        from .herb_knowledge_service import HerbKnowledgeService

        async with async_session_factory() as db_session:
            herb_service = HerbKnowledgeService(db_session)
            herbs = await herb_service.load_herbs(force_reload=True)
            if len(herbs) > 21:
                logger.info(
                    f"[AI Services] HerbKnowledgeService 初始化完成: "
                    f"{len(herbs)} 种药材, {len(herbs)} 种功效"
                )
            else:
                logger.warning(
                    f"[AI Services] HerbKnowledgeService 仅加载 {len(herbs)} 种药材, "
                    f"可能仍在使用内置数据"
                )
            # 保存全局引用，供优化器注入
            from .herb_knowledge_service import set_global_herb_knowledge
            set_global_herb_knowledge(herb_service)
    except ImportError:
        # 数据库模型尚未注册时跳过（开发环境）
        logger.debug("[AI Services] 跳过 HerbKnowledgeService 初始化（数据库模型未就绪）")
    except Exception as e:
        logger.warning(f"[AI Services] HerbKnowledgeService 初始化失败，将回退内置数据: {e}")
    
    logger.info("[AI Services] 初始化完成")

__all__ = [
    "LLMProvider","OpenAIProvider","AnthropicProvider","LocalLlamaProvider",
    "LLMProviderFactory","get_provider_factory",
    "AIGenerationService","get_generation_service",
    "AIOptimizationService","PromptSyntaxChecker","PromptStructureAnalyzer",
    "EffectivenessPredictor","get_optimization_service",
    "RecommendationEngine","get_recommendation_engine",
    "TemplateService","get_template_service",
    "AIService","ai_service","AIFormulaResult",
    "AcademicianChatEngine","get_chat_engine",
    "BayesianFormulaOptimizer","get_bayesian_optimizer",
    "GeneticFormulaOptimizer","get_genetic_optimizer",
    "NeuralFormulaNetwork","NeuralEnsemble","get_neural_ensemble",
    "FormulaKnowledgeGraph","DBKnowledgeGraphService","get_knowledge_graph",
    "MultimodalEngine","get_multimodal_engine",
    "SuperIntelligenceEnsembler","get_super_ensembler",
]

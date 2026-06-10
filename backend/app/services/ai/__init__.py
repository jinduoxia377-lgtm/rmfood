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

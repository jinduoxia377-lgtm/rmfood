"""AI 编排服务 -- 生成、优化、对话、多模态等用户-facing 服务"""

from .chat_engine import AcademicianChatEngine, get_chat_engine
from .formula_service import AIFormulaResult, AIService, ai_service
from .generation_service import AIGenerationService, get_generation_service
from .multimodal_engine import MultimodalEngine, get_multimodal_engine
from .optimization_service import (
    AIOptimizationService,
    EffectivenessPredictor,
    PromptStructureAnalyzer,
    PromptSyntaxChecker,
    get_optimization_service,
)
from .super_intelligence_ensembler import SuperIntelligenceEnsembler, get_super_ensembler

__all__ = [
    "AIGenerationService",
    "get_generation_service",
    "AIOptimizationService",
    "PromptSyntaxChecker",
    "PromptStructureAnalyzer",
    "EffectivenessPredictor",
    "get_optimization_service",
    "AcademicianChatEngine",
    "get_chat_engine",
    "SuperIntelligenceEnsembler",
    "get_super_ensembler",
    "MultimodalEngine",
    "get_multimodal_engine",
    "AIService",
    "ai_service",
    "AIFormulaResult",
]

"""AI 编排服务 -- 生成、优化、对话、多模态等用户-facing 服务"""

from .generation_service import AIGenerationService, get_generation_service
from .optimization_service import (
    AIOptimizationService,
    PromptSyntaxChecker,
    PromptStructureAnalyzer,
    EffectivenessPredictor,
    get_optimization_service,
)
from .chat_engine import AcademicianChatEngine, get_chat_engine
from .super_intelligence_ensembler import SuperIntelligenceEnsembler, get_super_ensembler
from .multimodal_engine import MultimodalEngine, get_multimodal_engine
from .formula_service import AIService, ai_service, AIFormulaResult

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

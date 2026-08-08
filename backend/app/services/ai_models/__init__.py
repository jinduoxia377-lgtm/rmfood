"""
AI 模型服务包

⚠️ 注意：以下部分模型为模拟实现（Mock*），并非真实 AI/ML 模型：
- MockFormulaGPTService (原 FormulaGPTService)
- MockSynergyNetService (原 SynergyNetService)
- MockPeptideScorerService (原 PeptideScorerService)
- MockStabilityModelService (原 StabilityModelService)
- MockTastePredictorService (原 TastePredictorService)
- MockNeuralFormulaEngine (原 NeuralFormulaEngine)

真实实现：
- SafetyCheckerService: 完整的药食同源/十八反/十九畏规则引擎
- MCTSOptimizer: 蒙特卡洛树搜索
- SimulatedAnnealingOptimizer: 模拟退火
- GradientDescentOptimizer: 梯度下降
"""
from .formula_gpt import MockFormulaGPTService as FormulaGPTService
from .synergy_net import MockSynergyNetService as SynergyNetService
from .peptide_scorer import MockPeptideScorerService as PeptideScorerService
from .taste_predictor import MockTastePredictorService as TastePredictorService
from .stability_model import MockStabilityModelService as StabilityModelService
from .safety_checker import SafetyCheckerService
from .encoder import EncoderNetwork, FormulaEncoder
from .decoder import DecoderNetwork, FormulaDecoder
from .scorer import MultiObjectiveScorer, DiversityScorer
from .neural_formula_engine import MockNeuralFormulaEngine as NeuralFormulaEngine, FormulaCandidate
from .simulated_annealing import (
    SimulatedAnnealingOptimizer,
    AdaptiveSimulatedAnnealing,
    CoolingStrategy,
    NeighborhoodOperation,
)
from .mcts_solver import MCTSNode, MCTSTree, MCTSOptimizer
from .gradient_descent_optimizer import (
    GradientDescentOptimizer,
    AdaptiveLearningRate,
    OptimizationMonitor,
    FormulaGradientCalculator,
    create_formula_objective_function,
    create_formula_gradient_function,
)

__all__ = [
    # Mock 实现（通过别名导出以保持向后兼容）
    "FormulaGPTService",       # → MockFormulaGPTService
    "SynergyNetService",       # → MockSynergyNetService
    "PeptideScorerService",    # → MockPeptideScorerService
    "TastePredictorService",   # → MockTastePredictorService
    "StabilityModelService",   # → MockStabilityModelService
    "NeuralFormulaEngine",     # → MockNeuralFormulaEngine
    # 真实实现
    "SafetyCheckerService",
    "EncoderNetwork",
    "FormulaEncoder",
    "DecoderNetwork",
    "FormulaDecoder",
    "MultiObjectiveScorer",
    "DiversityScorer",
    "FormulaCandidate",
    "SimulatedAnnealingOptimizer",
    "AdaptiveSimulatedAnnealing",
    "CoolingStrategy",
    "NeighborhoodOperation",
    "MCTSNode",
    "MCTSTree",
    "MCTSOptimizer",
    "GradientDescentOptimizer",
    "AdaptiveLearningRate",
    "OptimizationMonitor",
    "FormulaGradientCalculator",
    "create_formula_objective_function",
    "create_formula_gradient_function",
]

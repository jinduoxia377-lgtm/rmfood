"""
AI 模型服务包
Phase 2: FormulaGPT / SynergyNet / PeptideScorer / TastePredictor / StabilityModel / SafetyChecker
Phase 3: NeuralFormulaEngine (US 11,742,060 B2)
"""
from .formula_gpt import FormulaGPTService
from .synergy_net import SynergyNetService
from .peptide_scorer import PeptideScorerService
from .taste_predictor import TastePredictorService
from .stability_model import StabilityModelService
from .safety_checker import SafetyCheckerService
from .encoder import EncoderNetwork, FormulaEncoder
from .decoder import DecoderNetwork, FormulaDecoder
from .scorer import MultiObjectiveScorer, DiversityScorer
from .neural_formula_engine import NeuralFormulaEngine, FormulaCandidate
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
    "FormulaGPTService",
    "SynergyNetService",
    "PeptideScorerService",
    "TastePredictorService",
    "StabilityModelService",
    "SafetyCheckerService",
    "EncoderNetwork",
    "FormulaEncoder",
    "DecoderNetwork",
    "FormulaDecoder",
    "MultiObjectiveScorer",
    "DiversityScorer",
    "NeuralFormulaEngine",
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

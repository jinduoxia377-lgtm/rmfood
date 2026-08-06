"""AI Models submodule — neural generation pipeline

Submodules:
- signal_encoder: encode recipe requirements into neural signals
- autoregressive_generator: simplified LSTM-based generator (rule-based)
- pytorch_generator: PyTorch LSTM generator (neural network)
- formula_predictor: multi-attribute prediction network
- formula_discriminator: novelty discriminator (real vs generated)
- template_subsystem: classic formula templates for prior injection
- rl_tuner: reinforcement learning tuner for generator optimization
- formula_selector: multi-strategy formula selector
- unified_formula_engine: integrated generation pipeline
- device_manager: GPU/CPU device management
- herb_database_extender: herb database extension (59 -> 200+)
"""

from .signal_encoder import SignalEncoder
from .autoregressive_generator import AutoregressiveFormulaGenerator
from .pytorch_generator import PyTorchFormulaGenerator, get_pytorch_generator
from .formula_predictor import FormulaPredictor
from .formula_discriminator import FormulaDiscriminator
from .template_subsystem import TemplateSubsystem
from .rl_tuner import RLFormulaTuner
from .formula_selector import FormulaSelector, SelectionPriority
from .unified_formula_engine import UnifiedFormulaEngine
from .device_manager import get_device, is_cuda_available, detect_device
from .herb_database_extender import HerbDatabaseExtender, get_herb_extender

__all__ = [
    "SignalEncoder",
    "AutoregressiveFormulaGenerator",
    "PyTorchFormulaGenerator",
    "get_pytorch_generator",
    "FormulaPredictor",
    "FormulaDiscriminator",
    "TemplateSubsystem",
    "RLFormulaTuner",
    "FormulaSelector",
    "SelectionPriority",
    "UnifiedFormulaEngine",
    "get_device",
    "is_cuda_available",
    "detect_device",
    "HerbDatabaseExtender",
    "get_herb_extender",
]

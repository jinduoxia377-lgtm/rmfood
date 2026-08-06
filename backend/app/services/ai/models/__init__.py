"""AI Models submodule — neural generation pipeline

Submodules:
- signal_encoder: encode recipe requirements into neural signals
- autoregressive_generator: LSTM-based autoregressive formula generator
- formula_predictor: multi-attribute prediction network
- formula_discriminator: novelty discriminator (real vs generated)
- template_subsystem: classic formula templates for prior injection
- rl_tuner: reinforcement learning tuner for generator optimization
- formula_selector: multi-strategy formula selector
- unified_formula_engine: integrated generation pipeline
"""

from .signal_encoder import SignalEncoder
from .autoregressive_generator import AutoregressiveFormulaGenerator
from .formula_predictor import FormulaPredictor
from .formula_discriminator import FormulaDiscriminator
from .template_subsystem import TemplateSubsystem
from .rl_tuner import RLFormulaTuner
from .formula_selector import FormulaSelector, SelectionPriority
from .unified_formula_engine import UnifiedFormulaEngine

__all__ = [
    "SignalEncoder",
    "AutoregressiveFormulaGenerator",
    "FormulaPredictor",
    "FormulaDiscriminator",
    "TemplateSubsystem",
    "RLFormulaTuner",
    "FormulaSelector",
    "SelectionPriority",
    "UnifiedFormulaEngine",
]

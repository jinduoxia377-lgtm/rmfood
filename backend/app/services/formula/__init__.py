"""
配方服务模块

包含协同作用引擎、配方优化等核心功能
"""

# 标准导入 FormulaService（从同级的 formula_module 模块）
# 消除了动态加载反模式
from .formula_module import FormulaService  # type: ignore
from .synergy_engine import (
    MechanismType,
    SynergyEngine,
    SynergyReport,
    SynergyScore,
    SyngineConfig,
    TasteType,
)

__all__ = [
    "SynergyEngine",
    "SyngineConfig",
    "SynergyScore",
    "SynergyReport",
    "MechanismType",
    "TasteType",
    "FormulaService",
]

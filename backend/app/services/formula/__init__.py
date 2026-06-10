"""
配方服务模块

包含协同作用引擎、配方优化等核心功能
"""

from .synergy_engine import (
    SynergyEngine,
    SyngineConfig,
    SynergyScore,
    SynergyReport,
    MechanismType,
    TasteType,
)

# FormulaService 在 app/services/formula.py 中定义
# 由于存在同名包（formula/），使用延迟导入避免循环引用
_FormulaService = None

def _get_formula_service():
    global _FormulaService
    if _FormulaService is None:
        import importlib.util
        import os
        spec = importlib.util.spec_from_file_location(
            "app.services.formula_module",
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "formula.py"),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _FormulaService = mod.FormulaService
    return _FormulaService


class _FormulaServiceProxy:
    """延迟代理，使得 from app.services.formula import FormulaService 可用"""
    def __getattr__(self, name):
        return getattr(_get_formula_service(), name)
    def __call__(self, *args, **kwargs):
        return _get_formula_service()(*args, **kwargs)

FormulaService = _FormulaServiceProxy()

__all__ = [
    "SynergyEngine",
    "SyngineConfig",
    "SynergyScore",
    "SynergyReport",
    "MechanismType",
    "TasteType",
    "FormulaService",
]

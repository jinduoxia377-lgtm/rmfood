"""
NSGA-II 预设优化场景

包含：
- balanced: 均衡型
- cost_first: 成本优先
- efficacy_first: 功效优先
- safety_first: 安全优先
- synergy_focused: 协同深度优化
- comprehensive: 全面评估（7维）
"""
from __future__ import annotations

from typing import Dict

from .models import OptimizationConfig, OptimizationObjective

PRESET_SCENARIOS: Dict[str, OptimizationConfig] = {}


def _build_presets() -> Dict[str, OptimizationConfig]:
    """构建预设优化场景（延迟初始化避免循环导入）"""
    global PRESET_SCENARIOS
    if PRESET_SCENARIOS:
        return PRESET_SCENARIOS

    PRESET_SCENARIOS = {
        "balanced": OptimizationConfig(
            objectives=[
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.30),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.25),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.10),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.15),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.10),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
            ],
            mode="pareto",
            description="均衡型：各维度均衡考量",
        ),
        "cost_first": OptimizationConfig(
            objectives=[
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.20),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.15),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.05),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.40),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.10),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
            ],
            mode="weighted",
            description="成本优先：严格控制预算",
        ),
        "efficacy_first": OptimizationConfig(
            objectives=[
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.50),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.20),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.10),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.10),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.05),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.05),
            ],
            mode="weighted",
            description="功效优先：最大化功效输出",
        ),
        "safety_first": OptimizationConfig(
            objectives=[
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.15),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.45),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.10),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.10),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.10),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
            ],
            mode="weighted",
            description="安全优先：适用于敏感人群",
        ),
        "synergy_focused": OptimizationConfig(
            objectives=[
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.25),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.20),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.10),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.10),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.25),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
            ],
            mode="pareto",
            description="协同深度优化：强化配伍协同效应",
        ),
        "comprehensive": OptimizationConfig(
            objectives=[
                OptimizationObjective(name="功效最大化", key="efficacy", direction="maximize", weight=0.22),
                OptimizationObjective(name="安全性", key="safety", direction="maximize", weight=0.18),
                OptimizationObjective(name="口感品质", key="taste", direction="maximize", weight=0.12),
                OptimizationObjective(name="成本效率", key="cost_efficiency", direction="maximize", weight=0.15),
                OptimizationObjective(name="协同效应", key="synergy", direction="maximize", weight=0.13),
                OptimizationObjective(name="稳定性", key="stability", direction="maximize", weight=0.10),
                OptimizationObjective(name="ADMET综合", key="admet", direction="maximize", weight=0.10),
            ],
            mode="pareto",
            population_size=80,
            generations=70,
            description="全面评估：全7维综合优化",
        ),
    }
    return PRESET_SCENARIOS


def get_preset_scenario(name: str) -> OptimizationConfig:
    """获取预设优化场景"""
    presets = _build_presets()
    if name not in presets:
        available = ", ".join(presets.keys())
        raise ValueError(f"Unknown preset: {name!r}. Available: {available}")
    return presets[name]


# 模块导入时自动填充预设场景
_build_presets()

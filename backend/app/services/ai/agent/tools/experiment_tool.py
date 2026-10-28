"""
实验方案生成工具

根据配方生成实验验证方案，包括体外实验和体内实验设计。
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, List

from . import BaseAgentTool, ToolResult, register_tool

logger = logging.getLogger(__name__)


@dataclass
class ExperimentStep:
    """实验步骤"""
    step_number: int
    name: str
    description: str
    duration_days: int = 0
    expected_outcome: str = ""


@register_tool
class ExperimentPlanTool(BaseAgentTool):
    """生成配方实验验证方案"""

    @property
    def name(self) -> str:
        return "generate_experiment_plan"

    @property
    def description(self) -> str:
        return (
            "根据配方生成完整的实验验证方案，包括体外筛选实验和体内动物实验。"
            "返回实验设计、指标体系、样本量和预期结果。"
        )

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "formula": {
                    "type": "object",
                    "description": "配方信息",
                    "properties": {
                        "name": {"type": "string"},
                        "ingredients": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                    },
                    "required": ["name", "ingredients"],
                },
                "experiment_type": {
                    "type": "string",
                    "enum": ["in_vitro", "in_vivo", "both"],
                    "description": "实验类型",
                    "default": "both",
                },
                "target_effect": {
                    "type": "string",
                    "description": "验证的目标功效",
                },
            },
            "required": ["formula", "target_effect"],
        }

    async def execute(self, params: dict, context: dict) -> ToolResult:
        start = time.time()
        try:
            formula = params["formula"]
            exp_type = params.get("experiment_type", "both")
            target_effect = params["target_effect"]

            steps: List[Dict[str, Any]] = []
            step_num = 1

            if exp_type in ("in_vitro", "both"):
                steps.extend([
                    {
                        "step_number": step_num,
                        "name": "体外筛选实验",
                        "description": f"针对{target_effect}进行体外细胞实验筛选",
                        "duration_days": 14,
                        "expected_outcome": "确定有效浓度范围和初步功效",
                    },
                    step_num + 1,
                ])
                step_num += 2

            if exp_type in ("in_vivo", "both"):
                steps.extend([
                    {
                        "step_number": step_num,
                        "name": "体内动物实验",
                        "description": f"使用{target_effect}模型动物验证配方功效",
                        "duration_days": 28,
                        "expected_outcome": "验证体内功效和安全性",
                    },
                ])

            # 生成实验指标
            indicators = self._generate_indicators(target_effect)

            elapsed = (time.time() - start) * 1000
            logger.info(
                "Experiment plan generated: type=%s steps=%d latency=%dms",
                exp_type, len(steps), elapsed,
            )

            return ToolResult(
                tool_name=self.name,
                success=True,
                data={
                    "formula_name": formula["name"],
                    "experiment_type": exp_type,
                    "target_effect": target_effect,
                    "steps": steps,
                    "indicators": indicators,
                    "total_duration_days": sum(s.get("duration_days", 0) for s in steps),
                },
                latency_ms=elapsed,
            )
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.warning("Experiment plan error: %s", e, exc_info=True)
            return ToolResult(
                tool_name=self.name,
                success=False,
                error=str(e),
                latency_ms=elapsed,
            )

    def _generate_indicators(self, effect: str) -> List[Dict[str, str]]:
        """根据功效生成实验指标"""
        indicator_map = {
            "免疫调节": [
                {"name": "脾脏指数", "unit": "%"},
                {"name": "胸腺指数", "unit": "%"},
                {"name": "巨噬细胞吞噬率", "unit": "%"},
                {"name": "血清溶血素", "unit": "OD值"},
            ],
            "抗氧化": [
                {"name": "SOD活性", "unit": "U/mg蛋白"},
                {"name": "GSH-Px活性", "unit": "U/mg蛋白"},
                {"name": "MDA含量", "unit": "nmol/mg蛋白"},
                {"name": "ROS水平", "unit": "FLUO"},
            ],
            "降血糖": [
                {"name": "空腹血糖", "unit": "mmol/L"},
                {"name": "胰岛素", "unit": "mIU/L"},
                {"name": "糖化血红蛋白", "unit": "%"},
                {"name": "葡萄糖耐量", "unit": "AUC"},
            ],
        }
        return indicator_map.get(effect, [
            {"name": "主要功效指标", "unit": "待定"},
            {"name": "安全性指标", "unit": "待定"},
        ])

"""
内置工作流执行器

包含以下执行器：
- LLM: 调用 LLM 进行文本生成/分析
- FormulaGPT: 调用 AI 配方生成服务
- SafetyCheck: 调用合规安全检查
- SynergyAnalysis: 调用协同效应分析
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from app.core.workflow.executor_protocol import (
    ExecutionContext,
    ExecutionResult,
    WorkflowExecutor,
    register_executor,
)

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════
# 1. LLM 执行器
# ════════════════════════════════════════════


@register_executor
class LLMExecutor(WorkflowExecutor):
    """调用 LLM 进行文本生成/分析"""

    @property
    def task_type(self) -> str:
        return "llm"

    @property
    def description(self) -> str:
        return "调用 LLM 进行文本生成、分析或转换"

    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        from app.services.ai.providers.provider_factory import get_provider_factory, TaskType

        prompt = context.input_data.get("prompt", "")
        system_prompt = context.input_data.get("system_prompt", "")
        temperature = context.input_data.get("temperature", 0.7)
        max_tokens = context.input_data.get("max_tokens", 2048)

        if not prompt:
            return ExecutionResult(
                task_id=context.task_id,
                success=False,
                error="prompt 不能为空",
            )

        try:
            factory = get_provider_factory()
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            result = await factory.create_task(
                task_type=TaskType.CHAT,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )

            content = result.content if hasattr(result, "content") else str(result)

            return ExecutionResult(
                task_id=context.task_id,
                success=True,
                output_data={"content": content, "tokens_used": getattr(result, "usage", {}).get("total_tokens", 0)},
            )
        except Exception as e:
            logger.error("LLM executor error: %s", e, exc_info=True)
            return ExecutionResult(
                task_id=context.task_id,
                success=False,
                error=f"LLM 调用失败: {e}",
            )


# ════════════════════════════════════════════
# 2. FormulaGPT 执行器
# ════════════════════════════════════════════


@register_executor
class FormulaGPTExecutor(WorkflowExecutor):
    """调用 AI 配方生成服务"""

    @property
    def task_type(self) -> str:
        return "formula_gpt"

    @property
    def description(self) -> str:
        return "AI 驱动的配方生成（基于目标功效自动生成药食同源配方）"

    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        from app.services.ai.orchestration.formula_service import ai_service

        effects = context.input_data.get("target_effects", ["免疫调节"])
        product_type = context.input_data.get("product_type", "饮品")
        population = context.input_data.get("target_population", "adults")

        try:
            result = await ai_service.generate_formula(
                effects=effects,
                product_type=product_type,
                target_population=population,
            )

            return ExecutionResult(
                task_id=context.task_id,
                success=True,
                output_data={
                    "formula": result.formula if hasattr(result, "formula") else result,
                    "safety_check": result.safety_check if hasattr(result, "safety_check") else None,
                },
            )
        except Exception as e:
            logger.error("FormulaGPT executor error: %s", e, exc_info=True)
            return ExecutionResult(
                task_id=context.task_id,
                success=False,
                error=f"配方生成失败: {e}",
            )


# ════════════════════════════════════════════
# 3. SafetyCheck 执行器
# ════════════════════════════════════════════


@register_executor
class SafetyCheckExecutor(WorkflowExecutor):
    """调用合规安全检查服务"""

    @property
    def task_type(self) -> str:
        return "safety_check"

    @property
    def description(self) -> str:
        return "配方合规性检查（药食同源目录、用量限制、禁忌搭配）"

    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        from app.services.compliance import get_compliance_service

        ingredients = context.input_data.get("ingredients", [])
        population = context.input_data.get("target_population", "adults")

        if not ingredients:
            return ExecutionResult(
                task_id=context.task_id,
                success=False,
                error="ingredients 不能为空",
            )

        try:
            service = get_compliance_service()
            result = service.check_compliance(ingredients, population)

            return ExecutionResult(
                task_id=context.task_id,
                success=True,
                output_data=result.to_dict(),
            )
        except Exception as e:
            logger.error("SafetyCheck executor error: %s", e, exc_info=True)
            return ExecutionResult(
                task_id=context.task_id,
                success=False,
                error=f"合规检查失败: {e}",
            )


# ════════════════════════════════════════════
# 4. SynergyAnalysis 执行器
# ════════════════════════════════════════════


@register_executor
class SynergyAnalysisExecutor(WorkflowExecutor):
    """调用协同效应分析服务"""

    @property
    def task_type(self) -> str:
        return "synergy_analysis"

    @property
    def description(self) -> str:
        return "配方成分协同/拮抗效应分析"

    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        from app.services.formula.synergy_engine import SynergyEngine

        ingredients = context.input_data.get("ingredients", [])
        effects = context.input_data.get("target_effects", [])

        if not ingredients:
            return ExecutionResult(
                task_id=context.task_id,
                success=False,
                error="ingredients 不能为空",
            )

        try:
            engine = SynergyEngine()
            # 调用协同分析
            result = await engine.analyze(
                ingredients=ingredients,
                target_effects=effects,
            )

            return ExecutionResult(
                task_id=context.task_id,
                success=True,
                output_data=result if isinstance(result, dict) else {"result": str(result)},
            )
        except Exception as e:
            logger.error("SynergyAnalysis executor error: %s", e, exc_info=True)
            return ExecutionResult(
                task_id=context.task_id,
                success=False,
                error=f"协同分析失败: {e}",
            )


# ════════════════════════════════════════════
# 5. DataAnalysis 执行器（通用数据分析）
# ════════════════════════════════════════════


@register_executor
class DataAnalysisExecutor(WorkflowExecutor):
    """对实验数据进行统计分析"""

    @property
    def task_type(self) -> str:
        return "data_analysis"

    @property
    def description(self) -> str:
        return "对实验数据（谱图/色谱）进行统计分析"

    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        from app.services.experiment.signal_processor import PeakRecognitionEngine, SpectrumType

        x_values = context.input_data.get("x_values", [])
        y_values = context.input_data.get("y_values", [])
        x_unit = context.input_data.get("x_unit", "")
        spectrum_type = context.input_data.get("spectrum_type", "FTIR")

        if not x_values or not y_values:
            return ExecutionResult(
                task_id=context.task_id,
                success=False,
                error="x_values 和 y_values 不能为空",
            )

        try:
            type_map = {
                "FTIR": SpectrumType.FTIR,
                "NMR": SpectrumType.NMR,
                "MS": SpectrumType.MS,
                "GC-MS": SpectrumType.GC_MS,
                "HPLC": SpectrumType.HPLC,
                "UV-VIS": SpectrumType.UV_VIS,
            }
            stype = type_map.get(spectrum_type, SpectrumType.FTIR)
            engine = PeakRecognitionEngine(stype)
            analysis = engine.analyze(x_values, y_values, x_unit)

            return ExecutionResult(
                task_id=context.task_id,
                success=True,
                output_data=analysis.to_dict(),
            )
        except Exception as e:
            logger.error("DataAnalysis executor error: %s", e, exc_info=True)
            return ExecutionResult(
                task_id=context.task_id,
                success=False,
                error=f"数据分析失败: {e}",
            )


logger.info("Workflow executors initialized")

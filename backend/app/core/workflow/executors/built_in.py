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
        from app.services.ai.formula_generation_service import run_ga_generation

        effects = context.input_data.get("target_effects", ["免疫调节"])
        population = context.input_data.get("target_population", "adults")
        constraints = dict(context.input_data.get("constraints", {}) or {})
        constraints.setdefault("max_candidates", int(context.input_data.get("max_candidates", 3) or 3))
        constraints.setdefault("target_group", population)

        try:
            # 替换 MockFormulaGPTService（random.sample 假数据）：
            # 直接调用与 /generate、/generate/advanced 同源的真实 GA 引擎。
            # P0-4：优先从共享状态取 user_id 透传（int 转 str），拿不到则 None。
            ctx_user_id = context.shared_state.get("user_id") or context.input_data.get("user_id")
            result = await run_ga_generation(
                target_effects=effects,
                constraints=constraints,
                user_id=str(ctx_user_id) if ctx_user_id else None,
            )
            candidates = result.get("candidates", [])
            formula = candidates[0] if candidates else {}
            safety_passed = all(c.get("safety_passed", False) for c in candidates) if candidates else False

            return ExecutionResult(
                task_id=context.task_id,
                success=True,
                output_data={
                    "formula": formula,
                    "candidates": candidates,
                    "safety_check": {"passed": safety_passed},
                    "generator": result.get("generator", "ga_optimizer"),
                    "rag_evidence": result.get("rag_evidence"),
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


# ════════════════════════════════════════════
# 6. UserInput 执行器（需求/批量输入占位）
# ════════════════════════════════════════════


@register_executor
class UserInputExecutor(WorkflowExecutor):
    """透传用户输入节点。

    user_input 节点不执行真实逻辑，仅将 input_data 透传到 output_data，
    供后续节点（agent_smart / formula_gpt 等）消费。此前该 task_type
    未注册执行器，导致 ai-formula-gen / batch-analysis 模板首节点必然
    FAILED（scheduler 返回"未注册的执行器"）。
    """

    @property
    def task_type(self) -> str:
        return "user_input"

    @property
    def description(self) -> str:
        return "用户需求/批量输入节点：透传输入数据，不做实际处理"

    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        # 透传 input_data；若显式传入 query 亦写入输出，便于后续节点读取
        output = dict(context.input_data or {})
        if not output.get("query") and context.shared_state.get("user_query"):
            output["query"] = context.shared_state["user_query"]
        return ExecutionResult(
            task_id=context.task_id,
            success=True,
            output_data=output,
        )


logger.info("Workflow executors initialized")

"""
Agent 编排引擎

管理多工具协作的 Agent 执行流程，支持：
- 工具调用链（串行/并行）
- 上下文传递
- LLM 调用与结果解析
- 错误恢复和降级
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from app.services.ai.dialectics_service import analyze_dialectics
from app.services.ai.providers.provider_factory import (
    TaskType,
    get_provider_factory,
)
from app.services.ai.safety import (
    PromptGuardResult,
    check_output,
    check_prompt,
)
from app.services.ai.safety.instruction_hierarchy import InstructionHierarchy

from .tools import ToolResult, get_tool_registry

logger = logging.getLogger(__name__)


class AgentStepStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class AgentStep:
    """Agent执行步骤"""
    step_id: str
    tool_name: str
    params: dict
    status: AgentStepStatus = AgentStepStatus.PENDING
    result: Optional[ToolResult] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None


# 模块级常量与辅助函数
_TOOL_MARKER = "__TOOL_CALLS__:"


def _estimate_tokens(texts: list[str]) -> int:
    """Phase 3：粗略估算 token 数（CJK ~1.5 字符/token，ASCII ~3.5 字符/token）。"""
    total = 0
    for t in texts:
        cjk = sum(1 for ch in t if "\u4e00" <= ch <= "\u9fff")
        ascii_count = len(t) - cjk
        total += int(cjk / 1.5 + ascii_count / 3.5)
    return total


@dataclass
class AgentExecution:
    """Agent执行记录"""
    execution_id: str
    user_query: str
    steps: List[AgentStep] = field(default_factory=list)
    final_response: str = ""
    total_latency_ms: float = 0.0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: str = "running"
    # Phase 3：LLM token 用量（估算）
    prompt_tokens: int = 0
    completion_tokens: int = 0

    def to_dict(self) -> dict:
        return {
            "execution_id": self.execution_id,
            "user_query": self.user_query,
            "status": self.status,
            "total_latency_ms": round(self.total_latency_ms, 1),
            "steps": [
                {
                    "step_id": s.step_id,
                    "tool": s.tool_name,
                    "status": s.status.value,
                    "latency_ms": round(
                        (s.completed_at - s.started_at).total_seconds() * 1000
                        if s.started_at and s.completed_at
                        else 0, 1
                    ),
                    "error": s.error,
                }
                for s in self.steps
            ],
            "final_response_preview": (
                self.final_response[:200] + "..."
                if len(self.final_response) > 200
                else self.final_response
            ),
        }


class AgentOrchestrator:
    """
    Agent 编排引擎

    支持两种模式：
    1. 工具直调模式（Fast）：按预定义工具链顺序调用，适合结构化任务
    2. LLM 自主模式（Smart）：让 LLM 决定调用哪些工具和参数，适合开放式任务
    """

    def __init__(self, system_prompt: str = ""):
        self._registry = get_tool_registry()
        self._system_prompt = system_prompt or self._default_system_prompt
        self._provider_factory = get_provider_factory()
        self._hierarchy = InstructionHierarchy(system_prompt=self._system_prompt)
    @property
    def _default_system_prompt(self) -> str:
        return (
            "你是RMFOOD智能配方研发助手，专注于药食同源功能性食品研发。\n"
            "请根据用户问题，选择合适的工具完成任务。\n"
            "回答时请保持专业、准确，并引用相关依据。"
        )

    async def execute_fast(
        self,
        query: str,
        tool_chain: List[tuple],
        context: Optional[dict] = None,
    ) -> AgentExecution:
        """
        快速模式：按预定义工具链顺序执行
        """
        execution = AgentExecution(
            execution_id=f"exec-{int(time.time())}",
            user_query=query,
            started_at=datetime.now(timezone.utc),
        )
        context = context or {}
        total_start = time.time()

        for tool_name, params in tool_chain:
            step_id = f"step-{len(execution.steps) + 1}"
            step = AgentStep(
                step_id=step_id,
                tool_name=tool_name,
                params=params,
                status=AgentStepStatus.RUNNING,
                started_at=datetime.now(timezone.utc),
            )
            execution.steps.append(step)

            tool = self._registry.get(tool_name)
            if not tool:
                step.status = AgentStepStatus.FAILED
                step.error = f"工具未注册: {tool_name}"
                logger.warning("Tool not found: %s", tool_name)
                continue

            try:
                result = await tool.execute(params, context)
                step.result = result
                step.status = (
                    AgentStepStatus.SUCCESS if result.success else AgentStepStatus.FAILED
                )
                step.error = result.error
                step.completed_at = datetime.now(timezone.utc)
                context[f"__tool_{tool_name}__"] = result.data

            except Exception as e:
                step.status = AgentStepStatus.FAILED
                step.error = str(e)
                step.completed_at = datetime.now(timezone.utc)
                logger.error("Tool execution failed: %s - %s", tool_name, e, exc_info=True)

        execution.status = "completed"
        execution.completed_at = datetime.now(timezone.utc)
        # P2-B5 修复：原在 _build_response 之前设 total_latency_ms，导致
        # 辨证 LLM / 报告生成耗时未计入（fast 实测 wall 49s 只上报 2331ms）。
        # 现将计时移到 _build_response 之后，计入全部真实工作耗时。
        # P3-B-usage：捕获辨证 LLM token 用量并回写 execution。
        _token_usage: dict = {}
        execution.final_response = await self._build_response(
            query, execution.steps, token_usage=_token_usage,
        )
        execution.prompt_tokens += int(_token_usage.get("prompt_tokens", 0) or 0)
        execution.completion_tokens += int(_token_usage.get("completion_tokens", 0) or 0)
        execution.total_latency_ms = (time.time() - total_start) * 1000

        logger.info(
            "Fast execution done: %d steps, %dms",
            len(execution.steps), execution.total_latency_ms,
        )
        # P3-B-usage 修复：记录执行 LLM 用量（非致命）
        await self._record_usage(execution, context)
        return execution

    async def execute_smart(
        self,
        query: str,
        max_steps: int = 10,
        context: Optional[dict] = None,
        allowed_tools: Optional[List[str]] = None,
        model_override: Optional[str] = None,
        temperature_override: Optional[float] = None,
    ) -> AgentExecution:
        """
        智能模式：让 LLM 自主决定调用哪些工具
        通过 function calling 接口，LLM 动态选择工具。

        🔒 安全增强：用户输入经过 Prompt 注入检测，输出经过安全检查

        Args:
            query: 用户问题
            max_steps: 最大工具调用步数
            context: 执行上下文
            allowed_tools: 工具白名单（DS Bot 移植：按 bot.capabilities 过滤工具 schema）
            model_override: 按调用覆盖模型 ID（DS Bot 移植）
            temperature_override: 按调用覆盖温度（可选）
        """
        execution = AgentExecution(
            execution_id=f"exec-smart-{int(time.time())}",
            user_query=query,
            started_at=datetime.now(timezone.utc),
        )
        context = context or {}

        # 🔒 安全检查：Prompt 注入检测（仅对最外层用户输入执行；
        #    内部子任务（delegate 派发）已受控，通过 skip_prompt_guard 跳过，避免误报）
        if not (context and context.get("skip_prompt_guard")):
            guard_result: PromptGuardResult = check_prompt(query)
            if guard_result.is_blocked:
                execution.status = "blocked"
                execution.final_response = (
                    "您的输入包含疑似注入攻击，已被安全系统拦截。"
                    "请修改后重试。"
                )
                execution.completed_at = datetime.now(timezone.utc)
                execution.total_latency_ms = 0.0
                logger.warning(
                    "[AgentOrchestrator] 用户输入被拦截: score=%.2f",
                    guard_result.security_score,
                )
                return execution

        messages: List[Dict[str, str]] = [
            {"role": "system", "content": self._system_prompt},
            {"role": "user", "content": query},
        ]
        # v3.3：若允许的工具包含 mcp:<server>，先注册外部 MCP 工具，
        # 确保本次执行的工具 schema 包含外部能力（M2）。
        if allowed_tools and any(t.startswith("mcp:") for t in allowed_tools) and context:
            try:
                from .mcp_bridge import get_mcp_bridge
                await get_mcp_bridge().ensure_registered(
                    context.get("db"), int(context.get("tenant_id") or 1), allowed_tools,
                )
            except Exception as e:
                logger.warning(f"[Orchestrator] MCP 工具注册失败（忽略）: {e}")
        tools_schema = self._registry.list_tools()
        # DS Bot 移植：能力白名单过滤工具 schema
        if allowed_tools:
            allowed = set(allowed_tools)
            tools_schema = [t for t in tools_schema if t.get("function", {}).get("name") in allowed]

        total_start = time.time()
        last_tool_sig: Optional[str] = None

        for step_idx in range(max_steps):
            step_id = f"step-{step_idx + 1}"
            llm_result = await self._call_llm(
                messages, tools_schema,
                model_override=model_override,
                temperature_override=temperature_override,
            )

            # Phase 3：估算 token 用量（近似，供统计与成本分析）
            raw_answer = llm_result.get("content") or ""
            execution.prompt_tokens += _estimate_tokens(
                [m.get("content") or "" for m in messages]
            )
            execution.completion_tokens += _estimate_tokens([raw_answer])

            tool_calls = llm_result.get("tool_calls", []) or []
            if not tool_calls:
                raw_answer = llm_result.get("content") or ""
                # 🔒 安全检查：输出侧过滤
                output_result = check_output(raw_answer)
                execution.final_response = (
                    output_result.sanitized_text
                    if not output_result.is_safe
                    else raw_answer
                )
                break

            # 先把 assistant 的 tool_calls 回写进消息序列。
            # 部分 provider 要求 role=tool 的消息必须紧跟带 tool_calls 的
            # assistant 消息，否则会返回 400。
            # 重复 tool_calls 检测：LLM 故障时可能反复返回相同的工具调用，
            # 导致同一子任务被重复派单（成本/内容重复）。检测到则终止循环。
            sig = json.dumps(tool_calls, ensure_ascii=False, sort_keys=True)
            if sig == last_tool_sig:
                logger.warning("[Orchestrator] 检测到重复 tool_calls，终止循环避免重复派单")
                if not execution.final_response:
                    execution.final_response = await self._build_response(
                query, execution.steps,
                user_id=str(context.get("user_id")) if context.get("user_id") else None,
            )
                execution.status = "completed"
                break
            last_tool_sig = sig

            messages.append({
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": tc.get("id", ""),
                        "type": "function",
                        "function": {
                            "name": tc.get("name", ""),
                            "arguments": json.dumps(
                                tc.get("arguments", {}), ensure_ascii=False
                            ),
                        },
                    }
                    for tc in tool_calls
                ],
            })

            for tool_call in tool_calls:
                tool_name = tool_call.get("name", "")
                tool_args = tool_call.get("arguments", {})

                step = AgentStep(
                    step_id=step_id,
                    tool_name=tool_name,
                    params=tool_args,
                    status=AgentStepStatus.RUNNING,
                    started_at=datetime.now(timezone.utc),
                )
                execution.steps.append(step)

                tool = self._registry.get(tool_name)
                if not tool:
                    step.status = AgentStepStatus.FAILED
                    step.error = f"未注册工具: {tool_name}"
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.get("id", ""),
                        "content": f"工具 {tool_name} 未注册",
                    })
                    continue

                try:
                    result = await tool.execute(tool_args, context)
                    step.result = result
                    step.status = (
                        AgentStepStatus.SUCCESS if result.success else AgentStepStatus.FAILED
                    )
                    step.error = result.error
                    step.completed_at = datetime.now(timezone.utc)

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.get("id", ""),
                        "content": json.dumps(
                            result.to_dict(), ensure_ascii=False, default=str
                        ),
                    })
                    context[f"__tool_{tool_name}__"] = result.data

                except Exception as e:
                    step.status = AgentStepStatus.FAILED
                    step.error = str(e)
                    step.completed_at = datetime.now(timezone.utc)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.get("id", ""),
                        "content": f"工具执行错误: {e}",
                    })

        execution.status = "completed"
        execution.completed_at = datetime.now(timezone.utc)
        execution.total_latency_ms = (time.time() - total_start) * 1000

        if not execution.final_response:
            execution.final_response = await self._build_response(
                query, execution.steps,
                user_id=str(context.get("user_id")) if context.get("user_id") else None,
            )

        # 🔒 最终输出安全检查
        final_output_check = check_output(execution.final_response)
        if not final_output_check.is_safe:
            logger.warning(
                "[AgentOrchestrator] 输出被安全过滤: risk=%s findings=%d",
                final_output_check.risk_level.value,
                len(final_output_check.findings),
            )
            execution.final_response = final_output_check.sanitized_text

        logger.info(
            "Smart execution done: %d tool calls, %dms",
            len(execution.steps), execution.total_latency_ms,
        )
        # P3-B-usage 修复：将执行产生的 LLM token 用量写入 ai_bot_usage（非致命）
        await self._record_usage(execution, context)
        return execution

    async def _record_usage(self, execution: AgentExecution, context: Optional[dict]) -> None:
        """将执行产生的 LLM token 用量写入 ai_bot_usage（Phase 3，非致命）。

        P3-B-usage 修复：此前仅 bot_manager（Bot 对话）写入用量，
        agent/execute（orchestrator 快速/智能模式）不写 → /usage/stats 恒为 0。
        """
        try:
            db = (context or {}).get("db")
            if db is None:
                return
            from ....models.usage import AiBotUsage
            tenant_id = int((context or {}).get("tenant_id") or 1)
            user_id = int((context or {}).get("user_id") or 0)
            model = (context or {}).get("model") or "agent"
            db.add(AiBotUsage(
                tenant_id=tenant_id,
                bot_id=None,  # orchestrator/Chief 级执行，无单 Bot
                user_id=user_id,
                model=model,
                prompt_tokens=execution.prompt_tokens,
                completion_tokens=execution.completion_tokens,
                endpoint="agent",
                task_execution_id=execution.execution_id,
            ))
            await db.commit()
        except Exception as e:
            logger.warning(f"[Usage] 用量记录失败（非致命）: {e}")

    async def _call_llm(
        self,
        messages: List[Dict[str, str]],
        tools: List[dict],
        model_override: Optional[str] = None,
        temperature_override: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        调用 LLM，支持 function calling。

        约定：provider 层检测到 tool_calls 时会以
        ``__TOOL_CALLS__:<json>`` 形式返回字符串（见 llm_provider.generate），
        此处负责解析回结构化的 tool_calls。

        model_override / temperature_override: DS Bot 移植，按调用覆盖模型与温度。
        """
        _tool_marker = "__TOOL_CALLS__:"

        try:
            factory = self._provider_factory
            kwargs: Dict[str, Any] = {
                "temperature": 0.3 if temperature_override is None else temperature_override,
            }
            if model_override:
                kwargs["model"] = model_override
            # 仅在确有工具时下发 schema，避免个别 provider 报错
            if tools:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = "auto"

            # 对瞬时故障（429/5xx/网络）重试，最多 4 次（指数退避），缓解限流导致任务失败
            result = None
            last_err: Optional[Exception] = None
            for attempt in range(4):
                try:
                    result = await factory.call_with_fallback(
                        messages=messages, task_type=TaskType.CHAT, **kwargs
                    )
                    break
                except Exception as e:
                    last_err = e
                    err_text = str(e)
                    retryable = (
                        "429" in err_text or "rate limit" in err_text.lower()
                        or "502" in err_text or "503" in err_text
                        or "timeout" in err_text.lower() or "Connection" in err_text
                    )
                    if attempt < 3 and retryable:
                        logger.warning(f"LLM 调用瞬时失败（第{attempt+1}次），{2 ** attempt}s 后重试: {err_text[:150]}")
                        await asyncio.sleep(2 ** attempt)
                        continue
                    break
            if result is None:
                if last_err is not None:
                    raise last_err
                raise RuntimeError("LLM 调用返回空结果")

            text = result if isinstance(result, str) else str(result)

            if text.startswith(_tool_marker):
                raw = text[len(_tool_marker):]
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError as exc:
                    logger.warning("tool_calls 解析失败: %s", exc)
                    return {"content": "", "tool_calls": []}

                tool_calls: List[Dict[str, Any]] = []
                for idx, call in enumerate(parsed or []):
                    if not isinstance(call, dict):
                        continue
                    func = call.get("function") or {}
                    args = func.get("arguments", {})
                    if isinstance(args, str):
                        try:
                            args = json.loads(args)
                        except json.JSONDecodeError:
                            args = {"__raw__": args}
                    tool_calls.append({
                        "id": call.get("id") or f"call_{idx}",
                        "name": func.get("name", ""),
                        "arguments": args if isinstance(args, dict) else {},
                    })
                return {"content": "", "tool_calls": tool_calls}

            return {"content": text, "tool_calls": []}

        except Exception as e:
            logger.warning("LLM call failed: %s", e)
            return {"content": f"[LLM调用失败] {e}", "tool_calls": []}

    async def _build_response(
        self,
        query: str,
        steps: List[AgentStep],
        user_id: Optional[str] = None,
        token_usage: Optional[dict] = None,
    ) -> str:
        """根据工具执行结果构建五段式配方报告

        Args:
            query: 用户问题
            steps: Agent 执行步骤
            user_id: 租户过滤（P0-4），从执行上下文取当前认证用户 id。
            token_usage: P3-B-usage 可选可变 dict，用于回传辨证 LLM 的 token 用量
                （写入 ai_bot_usage 统计）。
        """
        tool_outputs: dict = {}
        herbs: list = []

        for step in steps:
            if step.status == AgentStepStatus.SUCCESS and step.result:
                data = step.result.data
                if isinstance(data, dict):
                    tool_outputs[step.tool_name] = data
                    if step.tool_name == "generate_formula":
                        fdata = data
                        herbs_list = fdata.get("data", [])
                        if isinstance(herbs_list, list):
                            herbs = herbs_list
                        elif isinstance(herbs_list, dict):
                            herbs = herbs_list.get("data", [])
                elif data:
                    tool_outputs[step.tool_name] = {"raw": data}

        product_type = (tool_outputs.get("generate_formula") or {}).get("product_type", "饮品")

        # ── 辨证与目标（真实辨证引擎：LLM+RAG，规则降级） ──
        parts = ["### 一、辨证与目标\n"]
        try:
            dialectics = await analyze_dialectics(query, user_id=user_id)
            # P3-B-usage：捕获辨证 LLM token 用量，回传给调用方写入 ai_bot_usage
            if token_usage is not None:
                token_usage.update(dialectics.get("_token_usage") or {})
            if dialectics.get("urgent"):
                parts.append(f"**⚠️ 就医提醒**：{dialectics.get('referral_message', '')}\n")
            else:
                constitution = dialectics.get("constitution_tendency", "")
                syndrome = dialectics.get("syndrome_points", "")
                goals = dialectics.get("regulation_goals", [])
                evidence = dialectics.get("evidence", [])
                cautions = dialectics.get("cautions", [])
                if constitution:
                    parts.append(f"**体质倾向**：{constitution}\n")
                if syndrome:
                    parts.append(f"**辨证要点**：{syndrome}\n")
                if goals:
                    parts.append("**调理方向**：\n")
                    for i, g in enumerate(goals, 1):
                        parts.append(f"{i}. {g}\n")
                if evidence:
                    parts.append("**证据参考**：\n")
                    for e in evidence[:4]:
                        parts.append(
                            f"- {e.get('claim', '')}（证据等级：{e.get('level', '')}；"
                            f"来源：{e.get('source', '')}）\n"
                        )
                if cautions:
                    parts.append("**注意事项**：\n")
                    for c in cautions[:4]:
                        parts.append(f"- {c}\n")
                if dialectics.get("engine") == "rule_engine_fallback":
                    parts.append("\n> 说明：当前为规则引擎降级输出（LLM 不可用）。\n")
        except Exception as e:
            logger.warning(f"[AgentOrchestrator] 辨证引擎失败，使用通用输出: {e}")
            parts.append(f"**分析方向**：基于用户描述「{query}」进行体质分析与调理方案设计。\n")
        parts.append("\n")

        # ── 推荐配方 ────────────────────────────────────────
        parts.append("### 二、推荐配方\n")
        if herbs:
            parts.append("| 角色 | 药材/食材 | 用量(g) | 功效 |\n")
            parts.append("|------|----------|--------|------|\n")
            for h in herbs[:10]:
                if isinstance(h, dict):
                    role = h.get("role", "")
                    name = h.get("name", "")
                    dosage = h.get("dosage", "")
                    efficacy = h.get("purpose", "") or h.get("功效", "") or h.get("efficacy", "")
                    parts.append(f"| {role} | {name} | {dosage} | {efficacy} |\n")
            total = len(herbs)
            fdata = tool_outputs.get("generate_formula", {})
            scores = fdata.get("scores", {}) if isinstance(fdata, dict) else {}
            score = scores.get("overall_score", scores.get("overall", "?"))
            parts.append(f"\n**设计说明**：已通过贝叶斯优化生成 {total} 味药材配方方案（综合评分 {score}）\n")
            parts.append(f"**综合评分**：{score}   \n")
        else:
            parts.append("暂无配方数据。\n")
        parts.append("\n")

        # ── 方解与机理 ──────────────────────────────────────────────────
        parts.append("### 三、方解与机理\n")
        # kg_reason 是实际注册的知识图谱推理工具（见 services/kg/inference_agent.py
        # KGReasonTool）。此处读取其 synergy 推理结果渲染协同效应；
        # 历史版本误读不存在的 kg_infer 工具，导致 KG 推理永远为空、永远走降级。
        kg_data = tool_outputs.get("kg_reason", {})
        if isinstance(kg_data, dict) and kg_data.get("synergies"):
            for syn in kg_data["synergies"][:3]:
                if isinstance(syn, dict):
                    parts.append(
                        f"- **{syn.get('herb_a', '')} \u2194 {syn.get('herb_b', '')}**："
                        f"{syn.get('reasoning', syn.get('type', ''))}（置信度：{syn.get('confidence', '?')}）\n"
                    )
        else:
            # 图谱无可用协同数据时降级为规则/文献机理说明，绝不因图谱异常让整份报告失败
            try:
                parts.append(_generate_mechanism_explanation(herbs, query, product_type))
            except Exception as mech_err:
                logger.warning(
                    "[AgentOrchestrator] 机理说明生成失败，使用通用说明: %s", mech_err
                )
                parts.append("基于现代药理学研究，本方各成分具有多靶点协同调节作用。\n")
        parts.append("\n> \u26a0\ufe0f 本建议为辅助调理，不能替代医师诊断与治疗。\n")
        parts.append("\n")

        # ── 适配与禁忌 ──────────────────────────────────────
        parts.append("### 四、适配与禁忌\n")
        comp_data = tool_outputs.get("compliance_check", {})
        if isinstance(comp_data, dict):
            violations = comp_data.get("violations", [])
            for v in violations[:5]:
                if isinstance(v, dict):
                    parts.append(f"- \u26a0\ufe0f {v.get('ingredient', '')}：{v.get('message', '')}\n")
        for h in herbs[:6]:
            if isinstance(h, dict):
                name = h.get("name", "")
                if name == "黄芪":
                    parts.append("- \u26a0\ufe0f 黄芪：实证、热证者慎用，感冒发热期间暂停使用\n")
                elif name == "桑叶":
                    parts.append("- \u26a0\ufe0f 桑叶：脾胃虚寒、大便溏泄者减量\n")
                elif name == "葛根":
                    parts.append("- \u26a0\ufe0f 葛根：胃寒呕吐者慎用\n")
                elif name == "马齿苋":
                    parts.append("- \u26a0\ufe0f 马齿苋：脾胃虚寒、孕妇慎用\n")
                elif name == "蒲公英":
                    parts.append("- \u26a0\ufe0f 蒲公英：脾胃虚寒者减量，不宜长期大量服用\n")
                elif name == "决明子":
                    parts.append("- \u26a0\ufe0f 决明子：便溏泄泻者慎用\n")
                elif name == "荷叶":
                    parts.append("- \u26a0\ufe0f 荷叶：孕妇慎用，低血压者注意监测\n")
                elif name == "泽泻":
                    parts.append("- \u26a0\ufe0f 泽泻：肾虚滑精者慎用\n")
                elif name == "罗布麻":
                    parts.append("- \u26a0\ufe0f 罗布麻：血压偏低者慎用，孕妇禁用\n")
                elif name == "白术":
                    parts.append("- \u26a0\ufe0f 白术：阴虚燥渴者慎用\n")
        parts.append("- 脾胃虚寒者减量\n")
        parts.append("- 孕妇及哺乳期妇女请在医师指导下使用\n")
        parts.append("- 服药期间忌食辛辣、油腻食物\n")
        parts.append("- 如出现不适请立即停用并就医\n")
        parts.append("\n")

        # ── 监测与迭代 ──────────────────────────────────────
        parts.append("### 五、监测与迭代\n")
        parts.append("建议关注以下指标评估效果：\n")
        q_lower = (query or "").lower()
        if any(k in q_lower for k in ("血糖", "降糖", "高血糖")):
            parts.append("- 空腹/餐后血糖变化\n")
            parts.append("- 糖化血红蛋白（HbA1c）\n")
        elif any(k in q_lower for k in ("血压", "降压")):
            parts.append("- 血压监测（早晚各一次）\n")
            parts.append("- 心率、头晕症状变化\n")
        elif any(k in q_lower for k in ("睡眠", "失眠", "助眠")):
            parts.append("- 入睡时间、睡眠时长\n")
            parts.append("- 夜间觉醒次数\n")
            parts.append("- 日间精力评分\n")
        elif any(k in q_lower for k in ("尿酸", "痛风")):
            parts.append("- 血尿酸水平\n")
            parts.append("- 关节疼痛频率\n")
        elif any(k in q_lower for k in ("血脂", "降脂")):
            parts.append("- 血脂四项（TC、TG、LDL、HDL）\n")
        else:
            parts.append("- 主要症状改善情况\n")
            parts.append("- 体感精力与睡眠质量\n")
        parts.append("\n请记录使用体验，以便后续优化方案。\n")

        return "\n".join(parts)

    def list_available_tools(self) -> List[Dict[str, str]]:
        """列出当前可用的所有工具"""
        return self._registry.list_tools()


def get_orchestrator(system_prompt: str = "") -> AgentOrchestrator:
    """创建新的编排器实例，确保每次都使用最新的 LLM 配置。

    P2-B3 修复：原实现在此调用 asyncio.run(_reload_factory_from_db_sync())，
    但 get_orchestrator 是同步函数且常被 async 路由调用 —— asyncio.run 在已运行
    事件循环内必然抛 RuntimeError，被 except 静默吞掉，DB 重载从未生效，仅产生
    "coroutine was never awaited" 警告。此处移除该死代码。
    最新配置通过下方 _set_factory_instance_none() 清空工厂单例 + 下次懒加载
    （get_provider_factory 重新读取 _get_runtime_config()）实现。
    """
    # 强制清除工厂单例（下次使用时懒重建并重新读取最新配置）
    try:
        from app.services.ai.providers.provider_factory import _set_factory_instance_none
        _set_factory_instance_none()
    except Exception:
        pass
    return AgentOrchestrator(system_prompt)




# ════════════════════════════════════════════════════════
# 机理说明生成（无图谱时的降级方案）
# ════════════════════════════════════════════════════════

# 药材功效→现代机理映射库（基于 TCMSP / PubMed 文献）
_HERB_MECHANISM_DB: dict[str, str] = {
    "山药": "山药多糖可激活肠道GLP-1分泌，延缓胃排空；薯蓣皂苷改善胰岛素抵抗。",
    "黄芪": "黄芪多糖通过AMPK通路增强葡萄糖摄取，黄芪皂苷抑制α-葡萄糖苷酶活性。",
    "黄芪根": "含黄芪皂苷IV，可调节肠道菌群组成，改善糖脂代谢。",
    "葛根": "葛根素（Puerarin）激活PPAR-γ通路，改善胰岛素敏感性；异黄酮类抑制糖异生。",
    "桑叶": "桑叶DNJ（1-脱氧野尻霉素）抑制肠道α-葡萄糖苷酶，延缓碳水吸收。",
    "马齿苋": "富含ω-3脂肪酸及去甲肾上腺素，可调节血糖代谢相关酶活性。",
    "茯苓": "茯苓多糖通过调节Th1/Th2免疫平衡改善慢性低度炎症，间接改善胰岛素抵抗。",
    "菊花": "菊芋黄素具有抗氧化作用，可减轻高血糖诱导的氧化应激损伤。",
    "枸杞子": "枸杞多糖通过调节AMPK/SIRT1通路改善糖代谢，玉米黄质保护胰岛β细胞。",
    "党参": "党参多糖增强肠道屏障功能，改善营养吸收效率，辅助血糖稳定。",
    "人参": "人参皂苷Rg1/Rb1激活AMPK通路，促进葡萄糖转运蛋白GLUT4转位。",
    "甘草": "甘草酸抑制11β-HSD1酶，调节皮质醇代谢，间接影响糖代谢。",
    "山楂": "山楂黄酮抑制脂肪合成关键酶，改善脂质代谢紊乱。",
    "丹参": "丹参酮ⅡA改善微循环，减轻糖尿病并发症血管损伤。",
    "薏苡仁": "薏苡仁酯调节肠道菌群，改善代谢性炎症。",
    "泽泻": "泽泻醇通过PPAR-α通路调节脂质代谢。",
    "荷叶": "荷叶碱抑制脂肪合成，促进脂肪酸氧化。",
    "决明子": "大黄素衍生物激活PPAR-γ，改善胰岛素敏感性。",
    "绞股蓝": "绞股蓝皂苷通过AMPK通路调节糖脂代谢。",
    "罗布麻": "罗布麻黄酮具有降压、降脂双重作用。",
    "蒲公英": "蒲公英多糖具有抗炎、调节免疫作用。",
    "白术": "白术多糖调节肠道菌群结构，改善肠屏障功能，降低炎症因子TNF-α。",
    "陈皮": "陈皮flavonoids激活PPAR-γ，改善脂质代谢，促进胆固醇排泄。",
    "莲子": "莲子多糖具有抗氧化活性，保护胰岛β细胞免受氧化应激损伤。",
    "芡实": "芡实多糖延缓碳水化合物消化吸收，平稳餐后血糖曲线。",
    "莲子心": "莲子心生物碱具有镇静安神作用，调节中枢神经系统。",
    "酸枣仁": "酸枣仁皂苷调节GABA能神经传递，改善睡眠质量。",
    "百合": "百合多糖具有神经保护作用，改善失眠相关认知功能下降。",
    "首乌藤": "首乌藤（夜交藤）具有安神助眠作用，调节睡眠-觉醒周期。",
    "柏子仁": "柏子仁油脂富含不饱和脂肪酸，养心安神，改善心悸失眠。",
    "合欢皮": "合欢皮提取物调节5-HT能神经传递，改善情绪相关失眠。",
    "天麻": "天麻素（Gastrodin）调节神经系统兴奋性，改善头晕头痛。",
    "杜仲叶": "杜仲叶黄酮激活AMPK通路，改善糖脂代谢紊乱。",
    "玉竹": "玉竹多糖改善胰岛素抵抗，保护胰岛β细胞功能。",
    "黄精": "黄精多糖通过AMPK/PGC-1α通路改善能量代谢，增强抗疲劳能力。",
    "阿胶": "阿胶富含胶原蛋白水解物，补血滋阴，改善气血两虚证。",
    "龙眼肉": "龙眼肉多糖具有抗氧化和神经保护作用，改善心脾两虚。",
    "红枣": "红枣多糖增强免疫功能，补气养血，改善气血不足。",
    "薄荷": "薄荷脑具有清凉解暑作用，疏肝理气，缓解胃肠胀气。",
    "淡竹叶": "淡竹叶黄酮具有清热除烦作用，改善心烦失眠。",
    "火麻仁": "火麻仁油脂润滑肠道，润肠通便，改善便秘。",
    "鸡内金": "鸡内金含胃激素，促进胃液分泌，增强消化功能。",
    "麦芽": "麦芽淀粉酶促进碳水化合物消化，健脾开胃。",
}

# 煎煮/制备方法与服用周期
_HERB_SOP_DB: dict[str, dict] = {
    "山药": {"method": "打碎后煎煮", "time_min": 20, "temp": "大火煮沸后小火"},
    "黄芪": {"method": "切片煎煮", "time_min": 25, "temp": "大火煮沸后小火"},
    "葛根": {"method": "打粉或切片", "time_min": 20, "temp": "大火煮沸后小火"},
    "桑叶": {"method": "整叶或切碎", "time_min": 15, "temp": "大火煮沸后小火"},
    "马齿苋": {"method": "鲜品洗净或干品煎煮", "time_min": 10, "temp": "大火煮沸即可"},
    "茯苓": {"method": "打碎煎煮", "time_min": 25, "temp": "大火煮沸后小火"},
    "菊花": {"method": "开水冲泡或短时煎煮", "time_min": 5, "temp": "沸水冲泡焖5分钟"},
    "枸杞子": {"method": "最后5分钟加入", "time_min": 5, "temp": "沸水冲泡或煎煮"},
    "党参": {"method": "切片煎煮", "time_min": 25, "temp": "大火煮沸后小火"},
    "甘草": {"method": "切片煎煮", "time_min": 20, "temp": "大火煮沸后小火"},
    "蒲公英": {"method": "洗净煎煮", "time_min": 15, "temp": "大火煮沸后小火"},
    "白术": {"method": "麸炒后切片煎煮", "time_min": 20, "temp": "大火煮沸后小火"},
    "罗布麻": {"method": "开水冲泡", "time_min": 10, "temp": "沸水冲泡焖10分钟"},
    "决明子": {"method": "炒后捣碎煎煮", "time_min": 20, "temp": "大火煮沸后小火"},
    "荷叶": {"method": "切碎煎煮", "time_min": 15, "temp": "大火煮沸后小火"},
    "泽泻": {"method": "切片煎煮", "time_min": 20, "temp": "大火煮沸后小火"},
    "山楂": {"method": "打碎煎煮", "time_min": 20, "temp": "大火煮沸后小火"},
    "薏苡仁": {"method": "先浸泡2小时，再煎煮", "time_min": 40, "temp": "大火煮沸后小火慢煎"},
    "莲子": {"method": "去心打碎煎煮", "time_min": 30, "temp": "大火煮沸后小火"},
    "陈皮": {"method": "撕碎煎煮", "time_min": 15, "temp": "大火煮沸后小火"},
}

_PRODUCT_SOP: dict[str, str] = {
    "饮品": "代茶饮：将药材洗净，加水500ml，大火煮沸后转小火煎煮20分钟，滤渣取汁，分2-3次温服。",
    "代用茶": "茶具冲泡：将药材放入茶包，沸水300ml冲泡10-15分钟，可反复冲泡2-3次。",
    "汤剂": "传统煎煮：药材加水600ml，浸泡30分钟后大火煮沸，转小火煎40分钟，滤渣取汁，分2次温服。",
    "膏方": "浓缩收膏：药材煎煮2次，合并滤液，浓缩至稠膏状，加入适量蜂蜜或冰糖收膏。",
    "口服液": "提取浓缩：药材水提浓缩后加入矫味剂，灌装灭菌，每支10ml。",
}

# 病症→协同效应描述
_CONDITION_SYNERGY: dict[str, str] = {
    "血糖": "多靶点协同调节糖代谢通路：{} 通过 AMPK 通路增强外周组织葡萄糖摄取，{} 抑制肠道α-葡萄糖苷酶延缓碳水吸收，{} 保护胰岛β细胞改善胰岛素分泌功能。三者联合可显著改善胰岛素抵抗状态。",
    "高血糖": "多靶点协同调节糖代谢通路：{} 通过 AMPK 通路增强外周组织葡萄糖摄取，{} 抑制肠道α-葡萄糖苷酶延缓碳水吸收，{} 保护胰岛β细胞改善胰岛素分泌功能。三者联合可显著改善胰岛素抵抗状态。",
    "消渴": "多靶点协同调节糖代谢通路：{} 通过 AMPK 通路增强外周组织葡萄糖摄取，{} 抑制肠道α-葡萄糖苷酶延缓碳水吸收，{} 保护胰岛β细胞改善胰岛素分泌功能。三者联合可显著改善胰岛素抵抗状态。",
    "降糖": "多靶点协同调节糖代谢通路：{} 通过 AMPK 通路增强外周组织葡萄糖摄取，{} 抑制肠道α-葡萄糖苷酶延缓碳水吸收，{} 保护胰岛β细胞改善胰岛素分泌功能。三者联合可显著改善胰岛素抵抗状态。",
    "睡眠": "协同调节中枢神经系统：{} 通过 GABA 能通路发挥镇静安神作用，{} 调节 5-HT 能神经传递改善情绪相关睡眠障碍，{} 具有神经保护作用改善睡眠质量。联合应用可延长深睡眠时长。",
    "失眠": "协同调节中枢神经系统：{} 通过 GABA 能通路发挥镇静安神作用，{} 调节 5-HT 能神经传递改善情绪相关睡眠障碍，{} 具有神经保护作用改善睡眠质量。联合应用可延长深睡眠时长。",
    "助眠": "协同调节中枢神经系统：{} 通过 GABA 能通路发挥镇静安神作用，{} 调节 5-HT 能神经传递改善情绪相关睡眠障碍，{} 具有神经保护作用改善睡眠质量。联合应用可延长深睡眠时长。",
    "血压": "多途径协同调节血压：{} 通过 ACE 抑制和钙通道调节降低外周阻力，{} 改善血管内皮功能增强一氧化氮释放，{} 具有利尿作用减少血容量。联合应用可温和降低血压水平。",
    "降压": "多途径协同调节血压：{} 通过 ACE 抑制和钙通道调节降低外周阻力，{} 改善血管内皮功能增强一氧化氮释放，{} 具有利尿作用减少血容量。联合应用可温和降低血压水平。",
    "尿酸": "协同促进尿酸排泄：{} 抑制 xanthine oxidase 减少尿酸生成，{} 促进肾小管尿酸分泌，{} 减轻炎症反应保护关节。联合应用可逐步降低血尿酸水平。",
    "痛风": "协同促进尿酸排泄：{} 抑制 xanthine oxidase 减少尿酸生成，{} 促进肾小管尿酸分泌，{} 减轻炎症反应保护关节。联合应用可逐步降低血尿酸水平。",
    "血脂": "协同调节脂质代谢：{} 抑制 HMG-CoA 还原酶减少胆固醇合成，{} 促进胆汁酸排泄加速脂质清除，{} 改善脂蛋白代谢降低 LDL 氧化。联合应用可改善血脂谱。",
    "减肥": "多靶点协同减重：{} 抑制脂肪合成关键酶减少脂肪堆积，{} 促进脂肪酸β-氧化增加能量消耗，{} 改善肠道屏障减少内毒素血症。联合应用可安全减重。",
    "代谢": "多靶点协同调节代谢：{} 激活 AMPK 通路改善胰岛素敏感性，{} 调节肠道菌群改善代谢性炎症，{} 增强线粒体功能改善能量代谢。联合应用可全面改善代谢状态。",
}


def _get_condition_key(query: str) -> str:
    """根据 query 提取病症关键词"""
    keywords = [
        ("血糖", "血糖"), ("高血糖", "高血糖"), ("消渴", "血糖"),
        ("降糖", "血糖"), ("失眠", "失眠"), ("睡眠", "睡眠"), ("助眠", "睡眠"),
        ("血压", "血压"), ("高血压", "血压"), ("降压", "血压"),
        ("尿酸", "尿酸"), ("痛风", "痛风"),
        ("血脂", "血脂"), ("降脂", "血脂"),
        ("减肥", "减肥"), ("肥胖", "减肥"),
        ("代谢", "代谢"),
    ]
    q = (query or "").lower()
    for kw, key in keywords:
        if kw in q:
            return key
    return "代谢"


def _estimate_active_compound(herb_name: str, dosage_g: float) -> str:
    """估算理论功效成分含量（基于文献均值）"""
    compound_ranges: dict[str, tuple[float, float]] = {
        "山药": (0.5, 2.0), "黄芪": (2.0, 5.0), "黄芪根": (1.5, 4.0),
        "葛根": (8.0, 16.0), "桑叶": (0.5, 2.0), "马齿苋": (0.3, 1.0),
        "茯苓": (5.0, 10.0), "菊花": (1.0, 3.0), "枸杞子": (3.0, 8.0),
        "党参": (5.0, 12.0), "人参": (2.0, 5.0), "甘草": (1.0, 3.0),
        "山楂": (2.0, 5.0), "丹参": (0.5, 2.0), "薏苡仁": (0.3, 0.8),
        "泽泻": (0.5, 1.5), "荷叶": (0.5, 1.5), "决明子": (0.3, 0.8),
        "绞股蓝": (3.0, 8.0), "罗布麻": (1.0, 3.0), "蒲公英": (2.0, 5.0),
        "白术": (3.0, 8.0), "陈皮": (1.0, 3.0), "莲子": (2.0, 5.0),
        "酸枣仁": (0.5, 1.5), "百合": (1.0, 3.0), "天麻": (0.2, 0.5),
        "杜仲叶": (1.0, 3.0), "玉竹": (2.0, 5.0), "黄精": (3.0, 8.0),
        "红枣": (1.0, 3.0), "薄荷": (0.5, 1.5), "火麻仁": (20.0, 30.0),
        "鸡内金": (5.0, 10.0), "麦芽": (3.0, 6.0),
    }
    rng = compound_ranges.get(herb_name)
    if rng:
        avg = (rng[0] + rng[1]) / 2
        amount_mg = avg * dosage_g * 10
        return f"理论功效成分约 {amount_mg:.0f}mg"
    return ""


def _generate_sop_section(product_type: str, herbs: list[dict]) -> str:
    """生成煎煮/制备方法和服用周期"""
    lines = []
    lines.append("**制备方法（SOP）**：\n")
    sop_text = _PRODUCT_SOP.get(product_type, _PRODUCT_SOP["饮品"])
    lines.append(f"- {sop_text}\n")
    special_herbs = []
    for h in herbs:
        name = h.get("name", "")
        if name in _HERB_SOP_DB:
            info = _HERB_SOP_DB[name]
            if info.get("time_min", 0) > 20:
                special_herbs.append(f"{name}（久煎{info['time_min']}分钟）")
            elif info.get("temp", "") == "沸水冲泡焖5分钟":
                special_herbs.append(f"{name}（冲泡即可，不宜久煮）")
    if special_herbs:
        lines.append(f"- 注意：{'；'.join(special_herbs[:3])}，请按要求处理。\n")
    lines.append("\n**建议服用周期**：\n")
    lines.append("- 每日1剂，分2-3次温服，建议在餐后30分钟服用。\n")
    lines.append("- 连续服用4周后评估效果，根据个体反应调整用量。\n")
    lines.append("- 建议记录每日症状变化和体征指标，便于后续优化。\n")
    return "\n".join(lines)


def _generate_compound_section(herbs: list[dict]) -> str:
    """生成理论功效成分含量估算"""
    lines = []
    lines.append("**理论功效成分含量估算**：\n")
    total_est = []
    for h in herbs:
        name = h.get("name", "")
        dosage_str = h.get("dosage", "")
        try:
            dose_g = float(dosage_str.replace("g", "").strip())
        except (ValueError, AttributeError):
            continue
        estimate = _estimate_active_compound(name, dose_g)
        if estimate:
            total_est.append(f"- **{name}**（{dosage_str}）：{estimate}\n")
    if total_est:
        lines.extend(total_est)
    else:
        lines.append("- 活性成分含量待进一步实验验证。\n")
    return "\n".join(lines)


def _generate_mechanism_explanation(herbs: list[dict], query: str,
                                     product_type: str = "饮品") -> str:
    """根据配方药材和query自动生成完整的方解与机理说明（含SOP）"""
    lines = []
    condition_key = _get_condition_key(query)

    lines.append("**君臣配伍机理**：\n")
    key_herbs = [h for h in herbs if h.get("role") in ("君", "臣")]
    if not key_herbs:
        key_herbs = herbs[:3]

    for h in key_herbs[:3]:
        name = h.get("name", "")
        dosage = h.get("dosage", "")
        mechanism = _HERB_MECHANISM_DB.get(name, "")
        if mechanism:
            lines.append(f"- **{name}（{dosage}）**：{mechanism}\n")
        else:
            lines.append(f"- **{name}（{dosage}）**：具有综合调理作用，具体机理待进一步研究确认。\n")

    assistant_herbs = [h for h in herbs if h.get("role") in ("佐", "使")]
    if assistant_herbs:
        lines.append("\n**佐使调和**：\n")
        for h in assistant_herbs[:2]:
            name = h.get("name", "")
            dosage = h.get("dosage", "")
            mechanism = _HERB_MECHANISM_DB.get(name, "")
            if mechanism:
                lines.append(f"- **{name}（{dosage}）**：{mechanism}\n")
            else:
                lines.append(f"- **{name}（{dosage}）**：调和诸药，增强整体配伍效果。\n")

    if len(key_herbs) >= 2:
        h1 = key_herbs[0].get("name", "")
        h2 = key_herbs[1].get("name", "")
        h3 = key_herbs[2].get("name", "") if len(key_herbs) >= 3 else key_herbs[-1].get("name", "")
        template = _CONDITION_SYNERGY.get(condition_key,
            "多靶点协同调节{}相关通路：{} 与 {} 配伍，通过不同机制增强疗效。".format(
                condition_key, h1, h2))
        if "{}" in template:
            synergy_text = template.format(h1, h2, h3)
        else:
            synergy_text = template
        lines.append(f"\n**协同效应**：{synergy_text}\n")

    lines.append("\n" + _generate_compound_section(herbs))
    lines.append("\n" + _generate_sop_section(product_type, herbs))
    return "\n".join(lines)

# ── 高危操作确认机制 ──────────────────────────────────────────────────────

@dataclass
class HighRiskAction:
    """高危操作定义"""
    action_type: str       # e.g., "formula.delete", "data.export"
    requires_confirmation: bool = True
    allowed_roles: List[str] = field(default_factory=lambda: ["admin", "researcher"])
    description: str = ""


# 高危操作注册表
_HIGH_RISK_ACTIONS: Dict[str, HighRiskAction] = {
    "formula.delete": HighRiskAction(
        action_type="formula.delete",
        requires_confirmation=True,
        allowed_roles=["admin"],
        description="删除配方，不可恢复",
    ),
    "data.export": HighRiskAction(
        action_type="data.export",
        requires_confirmation=True,
        allowed_roles=["admin", "researcher"],
        description="导出敏感数据",
    ),
    "compliance.override": HighRiskAction(
        action_type="compliance.override",
        requires_confirmation=True,
        allowed_roles=["admin"],
        description="强制通过合规检查",
    ),
    "system.config.change": HighRiskAction(
        action_type="system.config.change",
        requires_confirmation=True,
        allowed_roles=["admin"],
        description="修改系统配置",
    ),
}


def check_high_risk_action(
    action_type: str,
    user_roles: List[str] | None = None,
) -> tuple[bool, str]:
    """
    检查高危操作是否需要人工确认

    Returns:
        (allowed, message) — allowed=True 时可直接执行
    """
    action = _HIGH_RISK_ACTIONS.get(action_type)
    if action is None:
        return True, "非高危操作，允许执行"

    roles = user_roles or []
    if not action.requires_confirmation:
        return True, f"{action.description}（无需确认）"

    if not any(r in roles for r in action.allowed_roles):
        return False, f"权限不足：{action.description} 仅允许角色 {action.allowed_roles}"

    return True, f"{action.description}（已确认）"

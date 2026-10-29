"""
Agent 工作流编排引擎 (v1.0)

支持预定义工作流模板的自动执行：
- formula_design: 配方设计全流程（RAG→配方→合规→报告）
- compliance_check: 合规检查流程
- experiment_plan: 实验方案生成
- ingredient_lookup: 原料查询
- full_pipeline: 全流程自动化

每个工作流由多个 Stage 组成，Stage 之间通过共享上下文传递数据。
支持 SSE 流式推送中间结果。
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, AsyncIterator, Dict, List, Optional

from app.services.ai.agent.orchestrator import get_orchestrator
from app.services.ai.agent.tools import get_tool_registry
from app.services.ai.rag.rag_service import rag_service
from app.services.ai.safety import check_output, check_prompt
from app.services.ai.shared.event_bus import Event, EventType, get_event_bus
from app.services.compliance.preset_constraints import get_constraint_engine

logger = logging.getLogger(__name__)

# P2-B4：工作流执行记录内存上限（镜像 agent_router._MAX_EXECUTIONS），
# 防止无上限 in-memory dict 导致进程内存无界增长。
_MAX_WORKFLOW_EXECUTIONS = 100


class WorkflowStage(str, Enum):
    """工作流阶段"""
    RAG_RETRIEVE = "rag_retrieve"
    FORMULA_DESIGN = "formula_design"
    COMPLIANCE_CHECK = "compliance_check"
    EXPERIMENT_PLAN = "experiment_plan"
    REPORT_GENERATION = "report_generation"
    FINAL_ANSWER = "final_answer"


class WorkflowStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class WorkflowStageResult:
    """单个工作流阶段的执行结果"""
    stage: WorkflowStage
    success: bool
    output: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    latency_ms: float = 0.0
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class WorkflowExecution:
    """工作流执行记录"""
    execution_id: str
    workflow_type: str
    user_query: str
    stages: List[WorkflowStageResult] = field(default_factory=list)
    shared_context: Dict[str, Any] = field(default_factory=dict)
    final_response: str = ""
    status: WorkflowStatus = WorkflowStatus.PENDING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    total_latency_ms: float = 0.0
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "execution_id": self.execution_id,
            "workflow_type": self.workflow_type,
            "user_query": self.user_query,
            "status": self.status.value,
            "total_latency_ms": round(self.total_latency_ms, 1),
            "stages": [
                {
                    "stage": s.stage.value,
                    "success": s.success,
                    "latency_ms": round(s.latency_ms, 1),
                    "error": s.error,
                }
                for s in self.stages
            ],
            "final_response": self.final_response,
            "final_response_preview": (
                self.final_response[:300] + "..."
                if len(self.final_response) > 300
                else self.final_response
            ),
        }


# ── 工作流模板定义 ─────────────────────────────────────────────────────

WORKFLOW_TEMPLATES: Dict[str, List[WorkflowStage]] = {
    "formula_design": [
        WorkflowStage.RAG_RETRIEVE,
        WorkflowStage.FORMULA_DESIGN,
        WorkflowStage.COMPLIANCE_CHECK,
        WorkflowStage.REPORT_GENERATION,
        WorkflowStage.FINAL_ANSWER,
    ],
    "compliance_check": [
        WorkflowStage.COMPLIANCE_CHECK,
        WorkflowStage.FINAL_ANSWER,
    ],
    "experiment_plan": [
        WorkflowStage.RAG_RETRIEVE,
        WorkflowStage.FORMULA_DESIGN,
        WorkflowStage.EXPERIMENT_PLAN,
        WorkflowStage.FINAL_ANSWER,
    ],
    "ingredient_lookup": [
        WorkflowStage.RAG_RETRIEVE,
        WorkflowStage.FINAL_ANSWER,
    ],
    "full_pipeline": [
        WorkflowStage.RAG_RETRIEVE,
        WorkflowStage.FORMULA_DESIGN,
        WorkflowStage.COMPLIANCE_CHECK,
        WorkflowStage.EXPERIMENT_PLAN,
        WorkflowStage.REPORT_GENERATION,
        WorkflowStage.FINAL_ANSWER,
    ],
}


# ── 工作流引擎 ─────────────────────────────────────────────────────────

class WorkflowEngine:
    """
    Agent 工作流编排引擎

    用法：
        engine = WorkflowEngine()
        execution = await engine.execute(
            workflow_type="formula_design",
            user_query="帮我设计一款针对高血糖人群的枸杞饮品配方",
        )
    """

    def __init__(self):
        self._registry = get_tool_registry()
        self._orchestrator = get_orchestrator()
        self._event_bus = get_event_bus()
        self._executions: Dict[str, WorkflowExecution] = {}

    async def execute(
        self,
        workflow_type: str,
        user_query: str,
        max_steps: int = 10,
        context: Optional[Dict[str, Any]] = None,
    ) -> WorkflowExecution:
        """
        执行工作流

        Args:
            workflow_type: 工作流模板名称
            user_query: 用户问题
            max_steps: 最大工具调用次数（smart模式）
            context: 附加执行上下文（R3：注入 user_id/tenant_id/db，供工具读取身份）

        Returns:
            WorkflowExecution: 执行记录
        """
        if workflow_type not in WORKFLOW_TEMPLATES:
            raise ValueError(f"未知工作流类型: {workflow_type}")

        execution_id = f"wf-{int(time.time())}-{hash(user_query) & 0xFFFF:04x}"
        execution = WorkflowExecution(
            execution_id=execution_id,
            workflow_type=workflow_type,
            user_query=user_query,
            started_at=datetime.now(timezone.utc),
            status=WorkflowStatus.RUNNING,
        )
        if context:
            execution.shared_context.update(context)
        self._executions[execution_id] = execution
        # P2-B4：限制执行记录内存占用，超出时淘汰最旧记录
        if len(self._executions) > _MAX_WORKFLOW_EXECUTIONS:
            oldest = next(iter(self._executions))
            del self._executions[oldest]

        # 安全检查：Prompt 注入检测
        guard_result = check_prompt(user_query)
        if guard_result.is_blocked:
            execution.status = WorkflowStatus.FAILED
            execution.error = f"输入被安全系统拦截: {guard_result.action}"
            execution.completed_at = datetime.now(timezone.utc)
            execution.total_latency_ms = 0.0
            return execution

        # 发布开始事件
        await self._event_bus.publish(Event(
            event_type=EventType.AGENT_EXECUTION_DONE,
            payload={"execution_id": execution_id, "status": "started"},
        ))

        total_start = time.time()
        stages = WORKFLOW_TEMPLATES[workflow_type]

        try:
            for stage in stages:
                stage_result = await self._execute_stage(stage, execution, max_steps)
                execution.stages.append(stage_result)

                # 发布阶段完成事件
                await self._event_bus.publish(Event(
                    event_type=EventType.AGENT_STEP_COMPLETED,
                    payload={
                        "execution_id": execution_id,
                        "stage": stage.value,
                        "success": stage_result.success,
                    },
                ))

                if not stage_result.success:
                    execution.status = WorkflowStatus.FAILED
                    execution.error = f"阶段 {stage.value} 执行失败: {stage_result.error}"
                    break

            if execution.status == WorkflowStatus.RUNNING:
                execution.status = WorkflowStatus.COMPLETED
                execution.final_response = self._build_final_response(execution)

        except Exception as e:
            execution.status = WorkflowStatus.FAILED
            execution.error = str(e)
            logger.error(f"工作流执行异常: {e}", exc_info=True)

        execution.completed_at = datetime.now(timezone.utc)
        execution.total_latency_ms = (time.time() - total_start) * 1000

        # P3-B-usage：记录工作流执行产生的 LLM token 用量（非致命）
        await self._record_usage(execution, context)

        # 发布完成事件
        await self._event_bus.publish(Event(
            event_type=EventType.AGENT_EXECUTION_DONE,
            payload={
                "execution_id": execution_id,
                "status": execution.status.value,
                "latency_ms": execution.total_latency_ms,
            },
        ))

        logger.info(
            "工作流执行完成: %s id=%s stages=%d latency=%.0fms",
            workflow_type, execution_id, len(execution.stages),
            execution.total_latency_ms,
        )
        return execution

    async def _record_usage(self, execution: WorkflowExecution, context: Optional[dict]) -> None:
        """将工作流执行产生的 LLM token 用量写入 ai_bot_usage（Phase 3，非致命）。

        P3-B-usage 修复：此前仅 bot_manager（Bot 对话）写入用量，
        workflow/agent 路径不写 → /usage/stats 恒为 0。此方法覆盖工作流路径，
        token 用量来自 _stage_report_generation 捕获的辨证 LLM。
        """
        try:
            db = (context or {}).get("db")
            if db is None:
                return
            from ....models.usage import AiBotUsage
            tenant_id = int((context or {}).get("tenant_id") or 1)
            user_id = int((context or {}).get("user_id") or 0)
            tu = execution.shared_context.get("_token_usage") or {}
            db.add(AiBotUsage(
                tenant_id=tenant_id,
                bot_id=None,  # 工作流级执行，无单 Bot
                user_id=user_id,
                model="workflow",
                prompt_tokens=int(tu.get("prompt_tokens", 0) or 0),
                completion_tokens=int(tu.get("completion_tokens", 0) or 0),
                endpoint="workflow",
                task_execution_id=execution.execution_id,
            ))
            await db.commit()
        except Exception as e:
            logger.warning(f"[Usage] 工作流用量记录失败（非致命）: {e}")

    async def execute_stream(
        self,
        workflow_type: str,
        user_query: str,
        max_steps: int = 10,
        context: Optional[Dict[str, Any]] = None,
    ) -> AsyncIterator[dict]:
        """
        流式执行工作流，逐步推送中间结果

        推送事件格式：
        - {"type": "start", "execution_id": str}
        - {"type": "stage_start", "stage": str}
        - {"type": "stage_done", "stage": str, "success": bool, "latency_ms": float}
        - {"type": "content", "content": str}
        - {"type": "done", "execution_id": str, "final_response": str}
        - {"type": "error", "message": str}
        """
        try:
            execution = await self.execute(workflow_type, user_query, max_steps, context=context)

            yield {"type": "start", "execution_id": execution.execution_id}

            for stage_result in execution.stages:
                yield {
                    "type": "stage_start",
                    "stage": stage_result.stage.value,
                }
                yield {
                    "type": "stage_done",
                    "stage": stage_result.stage.value,
                    "success": stage_result.success,
                    "latency_ms": stage_result.latency_ms,
                }

            if execution.status == WorkflowStatus.COMPLETED:
                yield {"type": "content", "content": execution.final_response}
                yield {
                    "type": "done",
                    "execution_id": execution.execution_id,
                    "final_response": execution.final_response,
                }
            else:
                yield {
                    "type": "error",
                    "message": execution.error or "未知错误",
                }

        except Exception as e:
            yield {"type": "error", "message": str(e)}

    async def _execute_stage(
        self,
        stage: WorkflowStage,
        execution: WorkflowExecution,
        max_steps: int,
    ) -> WorkflowStageResult:
        """执行单个工作流阶段"""
        start_time = time.time()

        try:
            # 确保查询上下文可用
            execution.shared_context["_last_query"] = execution.user_query

            if stage == WorkflowStage.RAG_RETRIEVE:
                result = await self._stage_rag_retrieve(
                    execution.user_query, execution.shared_context
                )
            elif stage == WorkflowStage.FORMULA_DESIGN:
                result = await self._stage_formula_design(
                    execution.shared_context, max_steps
                )
            elif stage == WorkflowStage.COMPLIANCE_CHECK:
                result = await self._stage_compliance_check(execution.shared_context)
            elif stage == WorkflowStage.EXPERIMENT_PLAN:
                result = await self._stage_experiment_plan(execution.shared_context)
            elif stage == WorkflowStage.REPORT_GENERATION:
                result = await self._stage_report_generation(execution.shared_context)
            elif stage == WorkflowStage.FINAL_ANSWER:
                result = await self._stage_final_answer(execution)
            else:
                result = {"success": False, "error": f"未知阶段: {stage}"}

            latency = (time.time() - start_time) * 1000
            return WorkflowStageResult(
                stage=stage,
                success=result.get("success", False),
                output=result.get("output", {}),
                error=result.get("error"),
                latency_ms=latency,
            )

        except Exception as e:
            latency = (time.time() - start_time) * 1000
            logger.error(f"阶段 {stage.value} 执行异常: {e}", exc_info=True)
            return WorkflowStageResult(
                stage=stage,
                success=False,
                error=str(e),
                latency_ms=latency,
            )

    # ── 阶段实现 ──────────────────────────────────────────────────────

    async def _stage_rag_retrieve(
        self, query: str, context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """RAG 检索阶段"""
        try:
            # P0-4：从执行上下文取 user_id 传给 augment_query。
            # 执行上下文由 agent_router._execution_context 注入（user_id/tenant_id/db）。
            # user.id 为 int，需转 str 以匹配向量库 metadata["user_id"]（存储为 str）。
            ctx_user_id = context.get("user_id")
            if ctx_user_id:
                user_id = str(ctx_user_id)
            else:
                # 无用户上下文时兜底为 system（只检索公共种子库），绝不泄露跨租户数据
                user_id = "system"
                logger.warning(
                    "[WorkflowEngine] 执行上下文缺少 user_id，RAG 检索兜底为 system（仅公共种子库）"
                )
            result = await rag_service.augment_query(query, top_k=5, user_id=user_id)
            context["rag_results"] = [
                {
                    "content": c.chunk.content,
                    "source": c.chunk.metadata.get("source", "unknown"),
                    "score": round(c.score, 4),
                }
                for c in result.chunks
            ]
            context["augmented_prompt"] = result.augmented_prompt
            logger.info("RAG 检索完成: %d 条结果", len(result.chunks))
            return {"success": True, "output": {"chunks_count": len(result.chunks)}}
        except Exception as e:
            logger.warning(f"RAG 检索失败，降级到直接回答: {e}")
            context["rag_results"] = []
            return {"success": True, "output": {"chunks_count": 0}}

    async def _stage_formula_design(
        self, context: Dict[str, Any], max_steps: int
    ) -> Dict[str, Any]:
        """配方设计阶段 — 确定性工具链（不依赖 LLM function calling）"""
        try:
            query = context.get("_last_query", "")

            # ── 1. 从查询中提取参数（规则 + LLM 辅助）──────────────────
            # 默认值
            target_effects = ["辅助降血糖", "调节代谢"]
            product_type = "饮品"
            target_population = "高血糖人群"

            # 从 query 中提取功效关键词
            effect_map = {
                "助眠": ["改善睡眠", "安神"],
                "失眠": ["改善睡眠", "安神"],
                "睡眠": ["改善睡眠", "安神"],
                "护肝": ["护肝解酒", "保肝"],
                "健脾": ["健脾养胃", "促进消化"],
                "免疫": ["增强免疫", "提高抵抗力"],
                "润肠": ["润肠通便", "改善肠道"],
                "美容": ["美容养颜", "抗氧化"],
                "降糖": ["辅助降血糖", "调节血糖"],
                "血糖": ["辅助降血糖", "调节血糖"],
                "降脂": ["辅助降血脂", "调节血脂"],
                "降尿酸": ["辅助降尿酸", "调节尿酸"],
                "尿酸": ["辅助降尿酸", "调节尿酸"],
                "降压": ["辅助降血压", "平稳血压"],
                "血压": ["辅助降血压", "平稳血压"],
                "减肥": ["减脂瘦身", "调节代谢"],
                "肥胖": ["减脂瘦身", "调节代谢"],
            }
            for keyword, effects in effect_map.items():
                if keyword in query:
                    target_effects = effects
                    break

            # 从 query 中提取产品类型
            type_keywords = {"茶饮": "代用茶", "口服液": "口服液", "软糖": "软糖",
                             "固体饮料": "固体饮料", "膏方": "膏方", "代餐": "代餐粉"}
            for kw, ptype in type_keywords.items():
                if kw in query:
                    product_type = ptype
                    break

            # 从 query 中提取目标人群
            pop_keywords = {"中老年": "中老年", "女性": "女性群体", "上班族": "上班族",
                            "熬夜": "熬夜人群", "运动": "运动人群", "儿童": "儿童"}
            for kw, pop in pop_keywords.items():
                if kw in query and kw not in query.replace(target_population, ""):
                    target_population = pop
                    break

            # ── 2. 直接调用工具生成配方 ────────────────────────────────
            formula_tool = self._registry.get("generate_formula")
            if formula_tool:
                formula_result = await formula_tool.execute({
                    "target_effects": target_effects,
                    "product_type": product_type,
                    "target_population": target_population,
                }, context)
                context["formula_data"] = formula_result.data if formula_result.success else {}
                logger.info("配方生成: success=%s keys=%s", formula_result.success,
                            list(formula_result.data.keys()) if formula_result.data else "None")
            else:
                logger.warning("generate_formula 工具未注册")

            # ── 3. 合规检查由独立阶段 _stage_compliance_check 处理 ─────────
            # （此处不重复调用，避免数据格式不匹配导致误判）

            # ── 4. 配方数据已就绪，报告生成由 _stage_report_generation 完成 ──
            logger.info("配方设计阶段完成，药材数=%d", len(context.get("formula_data", {}).get("data", [])))
            return {
                "success": True,
                "output": {"response_preview": context["formula_data"]["summary"][:100] if context.get("formula_data") else "N/A"},
            }
        except Exception as e:
            logger.error(f"配方设计阶段失败: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    async def _stage_compliance_check(
        self, context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """合规检查阶段（前置约束）"""
        try:
            from app.services.compliance.formula_compliance import get_compliance_service
            compliance_service = get_compliance_service()
            constraint_engine = get_constraint_engine()

            # 从 formula_data 提取药材名称列表
            formula_data = context.get("formula_data", {})
            herbs_list = formula_data.get("data", [])
            if not herbs_list or not isinstance(herbs_list, list):
                return {
                    "success": True,
                    "output": {
                        "status": "skipped",
                        "message": "配方信息未找到，跳过合规检查",
                    },
                }

            # 构建合规检查需要的 ingredients 格式
            ingredients = []
            for herb in herbs_list:
                if isinstance(herb, dict):
                    name = herb.get("name", "")
                    dosage = herb.get("dosage", "")
                    if name:
                        # 解析剂量（如 "15g" → 15000mg）
                        try:
                            mg = int(float(dosage.replace("g", "").replace("mg", "")) * 1000) if "g" in dosage.lower() else int(dosage.replace("mg", ""))
                        except (ValueError, AttributeError):
                            mg = 0
                        ingredients.append({"name": name, "dosage_mg": mg})

            if not ingredients:
                return {
                    "success": True,
                    "output": {
                        "status": "skipped",
                        "message": "无法解析配方成分，跳过合规检查",
                    },
                }

            # 应用前置约束
            constrained = constraint_engine.apply_constraints(
                {"ingredients": ingredients}
            )
            context["constrained_ingredients"] = constrained.get("ingredients", ingredients)

            # 执行合规检查
            result = compliance_service.check_compliance(
                context["constrained_ingredients"]
            )
            context["compliance_result"] = result.to_dict()

            # 不合规时自动修复
            if result.score < 70:
                fixed = compliance_service.auto_fix_compliance(
                    context["constrained_ingredients"]
                )
                context["fixed_ingredients"] = fixed["fixed_ingredients"]
                context["compliance_fixes"] = fixed["fixes"]

            return {
                "success": True,
                "output": {
                    "score": result.score,
                    "status": result.status,
                    "violations_count": len(result.violations),
                },
            }
        except Exception as e:
            logger.warning(f"合规检查失败: {e}")
            return {
                "success": True,
                "output": {"status": "error", "message": str(e)},
            }

    async def _stage_experiment_plan(
        self, context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """实验方案生成阶段"""
        try:
            from app.services.ai.agent.tools.experiment_tool import ExperimentPlanTool
            tool = ExperimentPlanTool()
            result = await tool.execute({
                "formula": {"name": "AI设计配方", "ingredients": []},
                "experiment_type": "both",
                "target_effect": "综合功效验证",
            }, context)
            context["experiment_plan"] = result.data
            return {
                "success": True,
                "output": {"steps_count": len(result.data.get("steps", []))},
            }
        except Exception as e:
            logger.warning(f"实验方案生成失败: {e}")
            return {"success": True, "output": {"steps_count": 0}}

    async def _stage_report_generation(
        self, context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """报告生成阶段 — 整合配方+合规数据，生成完整五段式报告"""
        try:
            from app.services.ai.agent.orchestrator import (
                AgentStep,
                AgentStepStatus,
            )
            from app.services.ai.agent.tools import ToolResult

            orch = get_orchestrator()
            query = context.get("_last_query", "")

            # 构建 mock_steps（包含配方 + 合规两个工具结果）
            mock_steps = []
            formula_data = context.get("formula_data", {})
            if formula_data:
                tr = ToolResult(tool_name="generate_formula", success=True,
                                data=formula_data)
                mock_steps.append(AgentStep(
                    step_id="step-formula", tool_name="generate_formula",
                    params={}, status=AgentStepStatus.SUCCESS, result=tr,
                ))

            comp_result = context.get("compliance_result")
            if comp_result:
                tr2 = ToolResult(tool_name="compliance_check", success=True,
                                 data=comp_result)
                mock_steps.append(AgentStep(
                    step_id="step-comp", tool_name="compliance_check",
                    params={}, status=AgentStepStatus.SUCCESS, result=tr2,
                ))

            # ── 知识图谱协同效应推理（kg_reason 工具）───────────────────
            # 历史缺陷：orchestrator 误读不存在的 kg_infer 工具，KG 推理永远为空。
            # 此处显式调用已注册的 kg_reason 工具并注入 mock_steps，
            # 使 _build_response 渲染真实的图谱协同效应（无图谱数据时优雅降级）。
            try:
                herb_names = []
                for h in (formula_data or {}).get("data", []) or []:
                    if isinstance(h, dict) and h.get("name"):
                        herb_names.append(h["name"])
                if len(herb_names) >= 2:
                    kg_tool = self._registry.get("kg_reason")
                    if kg_tool is not None:
                        kg_res = await kg_tool.execute(
                            {"reasoning_type": "synergy", "herbs": herb_names},
                            context,
                        )
                        if kg_res.success and kg_res.data:
                            mock_steps.append(AgentStep(
                                step_id="step-kg", tool_name="kg_reason",
                                params={"reasoning_type": "synergy"},
                                status=AgentStepStatus.SUCCESS,
                                result=kg_res,
                            ))
                            logger.info(
                                "KG 协同推理注入报告: herbs=%d synergies=%d",
                                len(herb_names),
                                len((kg_res.data or {}).get("synergies", [])),
                            )
            except Exception as kg_err:
                logger.warning(f"[WorkflowEngine] KG 协同推理失败（忽略）: {kg_err}")

            # 生成完整五段式报告（含方解机理、合规建议）
            # P1-B1 修复：_build_response 是 async def，必须 await。
            # 历史缺陷：缺失 await 使此处存入 coroutine，下游 len() 抛
            # TypeError 被 except 静默吞掉，5 段式报告恒降级为占位。
            # P3-B-usage：捕获辨证 LLM token 用量，供 execute 记录 ai_bot_usage。
            _wf_token_usage: dict = {}
            context["formula_result"] = await orch._build_response(
                query, mock_steps, token_usage=_wf_token_usage,
            )
            context["_token_usage"] = _wf_token_usage

            # 报告生成阶段直接使用 orchestrator 输出的完整五段式报告
            report = context["formula_result"]
            context["report"] = report

            return {"success": True, "output": {"report_length": len(report)}}
        except Exception as e:
            logger.warning(f"报告生成失败: {e}", exc_info=True)
            # 降级：手动构建最小报告
            parts = ["## 配方设计方案\n\n"]
            if "formula_data" in context:
                fdata = context["formula_data"]
                herbs = fdata.get("data", [])
                if herbs:
                    parts.append("### 推荐配方\n")
                    for h in herbs[:10]:
                        if isinstance(h, dict):
                            parts.append(
                                f"- {h.get('name','')} "
                                f"{h.get('dosage','')} "
                                f"({h.get('role','')})\n"
                            )
            context["report"] = "\n".join(parts)
            # P1-B1：保持 success=True（不中止整个工作流，降级报告仍可交付），
            # 但将 error/degraded 写入 output 透明暴露，不再掩盖故障。
            return {
                "success": True,
                "output": {
                    "report_length": len(context["report"]),
                    "degraded": True,
                    "error": str(e),
                },
            }

    async def _stage_final_answer(
        self, execution: WorkflowExecution
    ) -> Dict[str, Any]:
        """最终答案阶段（输出安全检查）"""
        response = execution.shared_context.get("report", "")
        if not response:
            response = execution.shared_context.get("formula_result", "任务完成")

        output_result = check_output(response)
        execution.final_response = (
            output_result.sanitized_text if not output_result.is_safe else response
        )
        return {"success": True, "output": {"length": len(execution.final_response)}}

    def _build_final_response(self, execution: WorkflowExecution) -> str:
        """构建最终响应"""
        ctx = execution.shared_context
        parts = [f"## 针对你的需求：{execution.user_query}\n"]

        # 优先使用 report（已包含完整五段式输出）
        if "report" in ctx and ctx["report"]:
            return ctx["report"]

        if "formula_result" in ctx:
            parts.append("### 推荐配方\n")
            parts.append(ctx["formula_result"])
            parts.append("\n")

        if "compliance_result" in ctx:
            cr = ctx["compliance_result"]
            parts.append("### 合规检查结果\n")
            parts.append(f"评分: {cr['score']} | 状态: {cr['status']}\n")

        return "\n".join(parts)

    def get_execution(self, execution_id: str) -> Optional[WorkflowExecution]:
        """查询执行记录"""
        return self._executions.get(execution_id)

    def list_executions(self, limit: int = 10) -> List[WorkflowExecution]:
        """列出最近的执行记录"""
        items = list(self._executions.values())[-limit:]
        return sorted(
            items,
            key=lambda e: e.started_at or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )


# ── 全局单例 ───────────────────────────────────────────────────────────

_engine: Optional[WorkflowEngine] = None


def get_workflow_engine() -> WorkflowEngine:
    """获取全局 WorkflowEngine 单例"""
    global _engine
    if _engine is None:
        _engine = WorkflowEngine()
    return _engine

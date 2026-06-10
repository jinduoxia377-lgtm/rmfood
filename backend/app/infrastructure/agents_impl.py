"""
Agent 基础设施实现（M2.2）

包含：
1. 三个专业 Agent：配方生成 / 知识检索 / 安全评估
2. AgentOrchestrator：任务编排、路由、结果聚合
"""
from __future__ import annotations
import logging
import uuid
import time
from typing import Optional

from ..domain.agents import (
    AgentRole, TaskType, TaskStatus, AgentTask, AgentResult,
    AgentContext, FormulaProposal, SafetyReport, ConversationMessage,
)
from ..domain.agent_ports import BaseAgent, AgentOrchestrator

logger = logging.getLogger(__name__)


# ──────────── 共享知识库（Mock 数据） ────────────

_HERB_KNOWLEDGE = {
    "枸杞子": {"effects": ["抗氧化", "明目", "免疫调节"], "property": "甘平", "max_dosage": 15},
    "人参": {"effects": ["补气", "抗疲劳", "免疫调节"], "property": "甘温", "max_dosage": 9},
    "山楂": {"effects": ["消食", "活血", "降脂"], "property": "酸甘微温", "max_dosage": 12},
    "甘草": {"effects": ["补脾", "解毒", "调和诸药"], "property": "甘平", "max_dosage": 6},
    "黄芪": {"effects": ["补气", "固表", "利水"], "property": "甘温", "max_dosage": 30},
    "当归": {"effects": ["补血", "活血", "调经"], "property": "甘辛温", "max_dosage": 12},
    "茯苓": {"effects": ["利水", "健脾", "安神"], "property": "甘淡平", "max_dosage": 15},
    "红枣": {"effects": ["补气", "养血", "安神"], "property": "甘温", "max_dosage": 15},
    "菊花": {"effects": ["清热", "明目", "解毒"], "property": "甘苦微寒", "max_dosage": 10},
    "陈皮": {"effects": ["理气", "健脾", "燥湿"], "property": "辛苦温", "max_dosage": 6},
}

_INCOMPATIBILITIES = [
    ("人参", "藜芦"), ("甘草", "海藻"), ("甘草", "甘遂"),
    ("乌头", "半夏"), ("乌头", "贝母"),
]


# ──────────── Agent 1: 配方生成 Agent ────────────


class FormulaAgent(BaseAgent):
    """配方生成 Agent — 根据功效需求设计配方"""

    @property
    def role(self) -> AgentRole:
        return AgentRole.FORMULA_AGENT

    async def execute(self, task: AgentTask, context: AgentContext) -> AgentResult:
        start = time.time()
        try:
            if task.type == TaskType.GENERATE_FORMULA:
                proposal = await self._generate_formula(task.input, context)
                return AgentResult(
                    task_id=task.id,
                    success=True,
                    output={"proposal": proposal},
                    confidence=0.85,
                    processing_time_ms=int((time.time() - start) * 1000),
                )
            elif task.type == TaskType.OPTIMIZE_FORMULA:
                optimized = await self._optimize_formula(task.input, context)
                return AgentResult(
                    task_id=task.id,
                    success=True,
                    output={"proposal": optimized},
                    confidence=0.80,
                    processing_time_ms=int((time.time() - start) * 1000),
                )
            else:
                return AgentResult(
                    task_id=task.id, success=False,
                    output={}, error=f"不支持的任务类型: {task.type}",
                    processing_time_ms=int((time.time() - start) * 1000),
                )
        except Exception as e:
            logger.error(f"FormulaAgent 执行失败: {e}")
            return AgentResult(
                task_id=task.id, success=False,
                output={}, error=str(e),
                processing_time_ms=int((time.time() - start) * 1000),
            )

    async def _generate_formula(self, inputs: dict, context: AgentContext) -> FormulaProposal:
        target_effects = inputs.get("target_effects", ["抗氧化"])
        budget = inputs.get("budget", 50)
        exclude = inputs.get("exclude_herbs", [])

        # 基于知识库匹配功效
        matched = []
        for herb, info in _HERB_KNOWLEDGE.items():
            if herb in exclude:
                continue
            if any(e in info["effects"] for e in target_effects):
                matched.append((herb, info))

        # 选 top-5 原料
        selected = matched[:5]
        ingredients = []
        for name, info in selected:
            dosage = min(info["max_dosage"], info["max_dosage"])
            ingredients.append({
                "name": name,
                "dosage": dosage,
                "unit": "g",
                "purpose": next(
                    (e for e in info["effects"] if e in target_effects),
                    info["effects"][0]
                ),
            })

        rationale_parts = []
        for ing in ingredients:
            rationale_parts.append(f"{ing['name']}（{ing['purpose']}）")
        rationale = "配方基于" + "+".join(target_effects) + "功效需求设计，选用" + "、".join(rationale_parts)

        return FormulaProposal(
            name=f"{'+'.join(target_effects[:2])}配方",
            description=f"针对{'+'.join(target_effects)}的智能配方方案",
            ingredients=ingredients,
            target_effects=target_effects,
            estimated_cost=sum(i["dosage"] * 0.5 for i in ingredients),
            estimated_effectiveness=min(0.9, 0.5 + 0.08 * len(ingredients)),
            rationale=rationale,
            references=[f"知识库: {name}" for name, _ in selected],
        )

    async def _optimize_formula(self, inputs: dict, context: AgentContext) -> FormulaProposal:
        # 基于安全报告优化配方
        original = inputs.get("original_proposal")
        warnings = inputs.get("warnings", [])
        if original and warnings:
            for w in warnings:
                original.ingredients = [
                    i for i in original.ingredients
                    if i["name"] not in w
                ]
        return original

    async def validate(self, result: AgentResult) -> bool:
        if not result.success:
            return False
        proposal = result.output.get("proposal")
        if not proposal:
            return False
        return len(proposal.ingredients) >= 1


# ──────────── Agent 2: 知识检索 Agent ────────────


class KnowledgeAgent(BaseAgent):
    """知识检索 Agent — 查询药材、化合物、文献知识"""

    @property
    def role(self) -> AgentRole:
        return AgentRole.KNOWLEDGE_AGENT

    async def execute(self, task: AgentTask, context: AgentContext) -> AgentResult:
        start = time.time()
        try:
            query = task.input.get("query", "")
            herb_name = task.input.get("herb_name", "")

            results = []
            sources = []

            if herb_name:
                info = _HERB_KNOWLEDGE.get(herb_name)
                if info:
                    results.append({
                        "herb": herb_name,
                        "property": info["property"],
                        "effects": info["effects"],
                        "max_dosage": info["max_dosage"],
                    })
                    sources.append(f"RMFOOD 药食同源知识库: {herb_name}")

            # 全文搜索
            if query:
                for name, info in _HERB_KNOWLEDGE.items():
                    if query in name or any(query in e for e in info["effects"]):
                        results.append({
                            "herb": name,
                            "property": info["property"],
                            "effects": info["effects"],
                            "max_dosage": info["max_dosage"],
                            "matched_by": "功效" if any(query in e for e in info["effects"]) else "名称",
                        })
                        if f"RMFOOD 药食同源知识库: {name}" not in sources:
                            sources.append(f"RMFOOD 药食同源知识库: {name}")

            # 配伍禁忌查询
            incompatibilities = []
            if herb_name:
                for a, b in _INCOMPATIBILITIES:
                    if herb_name in (a, b):
                        incompatibilities.append(f"{a} 与 {b} 配伍禁忌")

            return AgentResult(
                task_id=task.id,
                success=True,
                output={
                    "results": results[:10],
                    "incompatibilities": incompatibilities,
                    "total_found": len(results),
                },
                confidence=0.9 if results else 0.0,
                processing_time_ms=int((time.time() - start) * 1000),
                sources=sources,
            )
        except Exception as e:
            return AgentResult(
                task_id=task.id, success=False, output={}, error=str(e),
                processing_time_ms=int((time.time() - start) * 1000),
            )

    async def validate(self, result: AgentResult) -> bool:
        return result.success


# ──────────── Agent 3: 安全评估 Agent ────────────


class SafetyAgent(BaseAgent):
    """安全评估 Agent — 检查配方安全性、禁忌、用量"""

    @property
    def role(self) -> AgentRole:
        return AgentRole.SAFETY_AGENT

    async def execute(self, task: AgentTask, context: AgentContext) -> AgentResult:
        start = time.time()
        try:
            ingredients = task.input.get("ingredients", [])
            target_effects = task.input.get("target_effects", [])

            if not ingredients:
                return AgentResult(
                    task_id=task.id, success=True,
                    output={"report": SafetyReport(
                        is_safe=True, risk_factors=[],
                        suggestions=["配方为空，无需安全检查"],
                    )},
                    confidence=1.0,
                    processing_time_ms=int((time.time() - start) * 1000),
                )

            risk_factors = []
            incompatibilities = []
            dosage_warnings = []
            allergens = []
            suggestions = []
            total_score = 1.0

            ingredient_names = [i.get("name", "") for i in ingredients if isinstance(i, dict)]
            ingredient_names += [i for i in ingredients if isinstance(i, str)]

            # 检查配伍禁忌
            for a, b in _INCOMPATIBILITIES:
                if a in ingredient_names and b in ingredient_names:
                    incompatibilities.append(f"{a} 与 {b} 存在配伍禁忌")
                    risk_factors.append({
                        "level": "high",
                        "description": f"{a}与{b}配伍禁忌（十八反十九畏）",
                        "suggestion": f"移除 {a} 或 {b} 中的一个",
                    })
                    total_score -= 0.3

            # 检查用量
            for ing in ingredients:
                if isinstance(ing, dict):
                    name = ing.get("name", "")
                    dosage = ing.get("dosage", 0)
                    max_d = _HERB_KNOWLEDGE.get(name, {}).get("max_dosage", 10)
                    if dosage > max_d:
                        dosage_warnings.append(f"{name} 用量 {dosage}g 超出安全上限 {max_d}g")
                        risk_factors.append({
                            "level": "medium",
                            "description": f"{name}用量过高",
                            "suggestion": f"建议减至 {max_d}g 以下",
                        })
                        total_score -= 0.15

            # 检查已知过敏原
            common_allergens = ["花粉", "花生", "牛奶", "鸡蛋", "海鲜"]
            for ing in ingredient_names:
                for a in common_allergens:
                    if a in ing:
                        allergens.append(ing)

            # 总体评分
            total_score = max(0.1, total_score)
            is_safe = total_score >= 0.5 and len(incompatibilities) == 0

            if not incompatibilities and not dosage_warnings:
                suggestions.append("配方安全性良好，未发现明显风险")
            if is_safe and len(ingredients) < 3:
                suggestions.append("建议增加君/臣/佐/使的完整配方结构")
            if is_safe and len(ingredients) >= 3:
                suggestions.append("方剂结构完整，君臣佐使配伍合理")

            report = SafetyReport(
                is_safe=is_safe,
                risk_factors=risk_factors,
                incompatibilities=incompatibilities,
                dosage_warnings=dosage_warnings,
                allergens=allergens,
                overall_score=total_score,
                suggestions=suggestions,
            )

            return AgentResult(
                task_id=task.id,
                success=True,
                output={"report": report},
                confidence=0.9 if is_safe else 0.7,
                processing_time_ms=int((time.time() - start) * 1000),
            )
        except Exception as e:
            return AgentResult(
                task_id=task.id, success=False, output={}, error=str(e),
                processing_time_ms=int((time.time() - start) * 1000),
            )

    async def validate(self, result: AgentResult) -> bool:
        if not result.success:
            return False
        return "report" in result.output


# ──────────── Agent 编排器 ────────────


class AgentOrchestratorImpl(AgentOrchestrator):
    """
    Agent 编排器

    工作流程：
    1. 接收用户请求
    2. 并行派发给 Knowledge Agent + Safety Agent
    3. 结果聚合后派发给 Formula Agent
    4. 返回上下文
    """

    def __init__(self):
        self._agents: dict[AgentRole, BaseAgent] = {}

    async def register_agent(self, agent: BaseAgent) -> None:
        self._agents[agent.role] = agent
        logger.info(f"Agent 已注册: {agent.role.name}")

    async def process_request(self, user_request: str, constraints: dict = None) -> AgentContext:
        context = AgentContext(
            session_id=str(uuid.uuid4())[:8],
            user_request=user_request,
            user_constraints=constraints or {},
        )

        logger.info(f"开始处理请求 [session={context.session_id}]: {user_request[:50]}...")

        # Step 1: 知识检索
        knowledge_task = AgentTask(
            id=f"t_{uuid.uuid4().hex[:6]}",
            type=TaskType.SEARCH_KNOWLEDGE,
            input={"query": user_request},
            assigned_role=AgentRole.KNOWLEDGE_AGENT,
        )
        kg_result = await self.delegate_task(knowledge_task, context)
        if kg_result.success:
            context.knowledge_context = [str(r) for r in kg_result.output.get("results", [])[:3]]

        # Step 2: 配方生成
        generate_task = AgentTask(
            id=f"t_{uuid.uuid4().hex[:6]}",
            type=TaskType.GENERATE_FORMULA,
            input={
                "target_effects": constraints.get("target_effects", ["抗氧化", "免疫调节"]),
                "budget": constraints.get("budget", 50),
                "exclude_herbs": constraints.get("exclude_herbs", []),
            },
            assigned_role=AgentRole.FORMULA_AGENT,
        )
        formula_result = await self.delegate_task(generate_task, context)
        if formula_result.success:
            context.current_proposal = formula_result.output.get("proposal")

        # Step 3: 安全检查
        safety_task = AgentTask(
            id=f"t_{uuid.uuid4().hex[:6]}",
            type=TaskType.CHECK_SAFETY,
            input={
                "ingredients": [
                    i["name"] for i in (context.current_proposal.ingredients if context.current_proposal else [])
                ],
                "target_effects": constraints.get("target_effects", []),
            },
            assigned_role=AgentRole.SAFETY_AGENT,
        )
        safety_result = await self.delegate_task(safety_task, context)
        if safety_result.success:
            context.safety_report = safety_result.output.get("report")

        # Step 4: 如果有安全问题，自动优化
        if context.safety_report and not context.safety_report.is_safe and context.current_proposal:
            warnings = [
                rf["description"] for rf in context.safety_report.risk_factors
                if rf["level"] in ("high", "medium")
            ]
            optimize_task = AgentTask(
                id=f"t_{uuid.uuid4().hex[:6]}",
                type=TaskType.OPTIMIZE_FORMULA,
                input={
                    "original_proposal": context.current_proposal,
                    "warnings": warnings,
                },
                assigned_role=AgentRole.FORMULA_AGENT,
            )
            opt_result = await self.delegate_task(optimize_task, context)
            if opt_result.success:
                context.current_proposal = opt_result.output.get("proposal")

        logger.info(f"请求处理完成 [session={context.session_id}]")
        return context

    async def delegate_task(self, task: AgentTask, context: AgentContext) -> AgentResult:
        agent = self._agents.get(task.assigned_role)
        if not agent:
            return AgentResult(
                task_id=task.id, success=False, output={},
                error=f"未找到角色为 {task.assigned_role.name} 的 Agent",
            )

        logger.info(f"委派任务: {task.type.name} → {task.assigned_role.name}")
        result = await agent.execute(task, context)

        # 记录对话消息
        msg = ConversationMessage(
            sender=task.assigned_role,
            recipient=AgentRole.ORCHESTRATOR,
            content=result.message or f"Task {task.type.name}: {'成功' if result.success else '失败'}",
            task_type=task.type,
            metadata={"success": result.success, "confidence": result.confidence},
        )
        context.history.append({
            "role": task.assigned_role.name,
            "type": task.type.name,
            "success": result.success,
            "timestamp": msg.timestamp.isoformat(),
        })

        return result

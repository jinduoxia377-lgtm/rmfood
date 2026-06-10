"""
多 Agent 配方研发系统测试（M2.2）

覆盖：三个 Agent 独立功能、编排器工作流、异常处理
"""
import pytest
from app.domain.agents import (
    AgentRole, TaskType, AgentTask, AgentContext, TaskStatus,
)
from app.infrastructure.agents_impl import (
    FormulaAgent, KnowledgeAgent, SafetyAgent, AgentOrchestratorImpl,
)


@pytest.fixture
def context():
    return AgentContext(
        session_id="test-001",
        user_request="设计一款抗氧化的保健食品配方",
        user_constraints={"target_effects": ["抗氧化", "免疫调节"], "budget": 50},
    )


@pytest.fixture
async def orchestrator():
    o = AgentOrchestratorImpl()
    await o.register_agent(FormulaAgent())
    await o.register_agent(KnowledgeAgent())
    await o.register_agent(SafetyAgent())
    return o


class TestFormulaAgent:
    """配方生成 Agent 测试"""

    @pytest.mark.asyncio
    async def test_generate_formula(self, context):
        agent = FormulaAgent()
        task = AgentTask(
            id="t1", type=TaskType.GENERATE_FORMULA,
            input={"target_effects": ["抗氧化"], "budget": 50},
            assigned_role=AgentRole.FORMULA_AGENT,
        )
        result = await agent.execute(task, context)

        assert result.success
        assert "proposal" in result.output
        proposal = result.output["proposal"]
        assert len(proposal.ingredients) >= 1
        assert "抗氧化" in proposal.target_effects
        assert proposal.estimated_effectiveness > 0
        assert len(proposal.references) >= 1

    @pytest.mark.asyncio
    async def test_generate_with_exclusions(self, context):
        agent = FormulaAgent()
        task = AgentTask(
            id="t2", type=TaskType.GENERATE_FORMULA,
            input={"target_effects": ["抗氧化"], "exclude_herbs": ["枸杞子"]},
            assigned_role=AgentRole.FORMULA_AGENT,
        )
        result = await agent.execute(task, context)
        proposal = result.output["proposal"]
        names = [i["name"] for i in proposal.ingredients]
        assert "枸杞子" not in names

    @pytest.mark.asyncio
    async def test_validate_result(self):
        agent = FormulaAgent()
        from app.domain.agents import AgentResult, FormulaProposal
        valid_result = AgentResult(
            task_id="t1", success=True,
            output={"proposal": FormulaProposal(
                name="test", description="", ingredients=[
                    {"name": "枸杞子", "dosage": 10, "unit": "g", "purpose": "抗氧化"}
                ],
                target_effects=["抗氧化"],
            )},
        )
        assert await agent.validate(valid_result) is True

        invalid_result = AgentResult(
            task_id="t2", success=False, output={},
        )
        assert await agent.validate(invalid_result) is False


class TestKnowledgeAgent:
    """知识检索 Agent 测试"""

    @pytest.mark.asyncio
    async def test_search_by_herb_name(self, context):
        agent = KnowledgeAgent()
        task = AgentTask(
            id="k1", type=TaskType.SEARCH_KNOWLEDGE,
            input={"herb_name": "枸杞子"},
            assigned_role=AgentRole.KNOWLEDGE_AGENT,
        )
        result = await agent.execute(task, context)

        assert result.success
        assert len(result.output["results"]) >= 1
        r = result.output["results"][0]
        assert r["herb"] == "枸杞子"
        assert "抗氧化" in r["effects"]

    @pytest.mark.asyncio
    async def test_search_by_effect(self, context):
        agent = KnowledgeAgent()
        task = AgentTask(
            id="k2", type=TaskType.SEARCH_KNOWLEDGE,
            input={"query": "抗氧化"},
            assigned_role=AgentRole.KNOWLEDGE_AGENT,
        )
        result = await agent.execute(task, context)

        assert result.success
        assert result.output["total_found"] >= 1

    @pytest.mark.asyncio
    async def test_search_not_found(self, context):
        agent = KnowledgeAgent()
        task = AgentTask(
            id="k3", type=TaskType.SEARCH_KNOWLEDGE,
            input={"herb_name": "不存在的药材"},
            assigned_role=AgentRole.KNOWLEDGE_AGENT,
        )
        result = await agent.execute(task, context)
        assert result.success
        assert result.output["total_found"] == 0
        assert result.confidence == 0.0

    @pytest.mark.asyncio
    async def test_incompatibility_query(self, context):
        agent = KnowledgeAgent()
        task = AgentTask(
            id="k4", type=TaskType.SEARCH_KNOWLEDGE,
            input={"herb_name": "甘草"},
            assigned_role=AgentRole.KNOWLEDGE_AGENT,
        )
        result = await agent.execute(task, context)
        assert len(result.output["incompatibilities"]) >= 1


class TestSafetyAgent:
    """安全评估 Agent 测试"""

    @pytest.mark.asyncio
    async def test_safe_formula(self, context):
        agent = SafetyAgent()
        task = AgentTask(
            id="s1", type=TaskType.CHECK_SAFETY,
            input={"ingredients": ["枸杞子", "茯苓", "红枣"], "target_effects": ["抗氧化"]},
            assigned_role=AgentRole.SAFETY_AGENT,
        )
        result = await agent.execute(task, context)
        report = result.output["report"]

        assert result.success
        assert report.is_safe is True
        assert report.overall_score >= 0.5

    @pytest.mark.asyncio
    async def test_incompatible_formula(self, context):
        agent = SafetyAgent()
        task = AgentTask(
            id="s2", type=TaskType.CHECK_SAFETY,
            input={"ingredients": ["人参", "藜芦"], "target_effects": ["补气"]},
            assigned_role=AgentRole.SAFETY_AGENT,
        )
        result = await agent.execute(task, context)
        report = result.output["report"]

        assert len(report.incompatibilities) >= 1
        assert len(report.risk_factors) >= 1

    @pytest.mark.asyncio
    async def test_overdose_detection(self, context):
        agent = SafetyAgent()
        task = AgentTask(
            id="s3", type=TaskType.CHECK_SAFETY,
            input={
                "ingredients": [
                    {"name": "人参", "dosage": 50, "unit": "g"},
                ]
            },
            assigned_role=AgentRole.SAFETY_AGENT,
        )
        result = await agent.execute(task, context)
        report = result.output["report"]

        assert len(report.dosage_warnings) >= 1

    @pytest.mark.asyncio
    async def test_empty_formula_safe(self, context):
        agent = SafetyAgent()
        task = AgentTask(
            id="s4", type=TaskType.CHECK_SAFETY,
            input={"ingredients": [], "target_effects": []},
            assigned_role=AgentRole.SAFETY_AGENT,
        )
        result = await agent.execute(task, context)
        report = result.output["report"]
        assert report.is_safe is True


class TestOrchestrator:
    """Agent 编排器测试"""

    @pytest.mark.asyncio
    async def test_full_pipeline(self, orchestrator):
        context = await orchestrator.process_request(
            user_request="设计抗氧化保健食品配方",
            constraints={"target_effects": ["抗氧化", "免疫调节"], "budget": 30},
        )

        assert context.current_proposal is not None
        assert len(context.current_proposal.ingredients) >= 1
        assert context.safety_report is not None
        assert len(context.history) >= 3  # 至少3个任务

    @pytest.mark.asyncio
    async def test_agent_registration(self):
        o = AgentOrchestratorImpl()
        assert len(o._agents) == 0
        await o.register_agent(FormulaAgent())
        assert AgentRole.FORMULA_AGENT in o._agents

    @pytest.mark.asyncio
    async def test_delegate_to_unregistered_agent(self, orchestrator):
        task = AgentTask(
            id="u1", type=TaskType.GENERATE_FORMULA,
            input={}, assigned_role=AgentRole.ORCHESTRATOR,
        )
        ctx = AgentContext(session_id="test", user_request="test")
        result = await orchestrator.delegate_task(task, ctx)
        assert result.success is False
        assert "未找到" in result.error

    @pytest.mark.asyncio
    async def test_context_tracks_history(self, orchestrator):
        ctx = await orchestrator.process_request(
            user_request="设计一款补气配方",
            constraints={"target_effects": ["补气", "抗疲劳"], "budget": 40},
        )
        assert len(ctx.history) >= 3
        for entry in ctx.history:
            assert "role" in entry
            assert "success" in entry
            assert "type" in entry

    @pytest.mark.asyncio
    async def test_safety_feedback_in_context(self, orchestrator):
        # 请求一个有安全风险的配方（包含妊娠禁忌）
        ctx = await orchestrator.process_request(
            user_request="设计配方",
            constraints={"target_effects": ["补血"], "budget": 50},
        )
        if ctx.safety_report:
            assert hasattr(ctx.safety_report, "is_safe")
            assert hasattr(ctx.safety_report, "overall_score")

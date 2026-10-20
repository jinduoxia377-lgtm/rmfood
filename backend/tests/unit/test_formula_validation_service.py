"""app/services/formula_validation_workflow.py 服务层单元测试

使用真实数据库会话验证查询路径。
"""
import pytest

from app.services.formula_validation_workflow import FormulaValidationService, get_validation_service


@pytest.mark.asyncio
async def test_get_validation_result_not_found(db_session):
    svc = get_validation_service(db_session)
    result = await svc.get_validation_result("VAL-999999")
    assert result is None


@pytest.mark.asyncio
async def test_service_constructor(db_session):
    svc = FormulaValidationService(db_session)
    assert svc.db is db_session


@pytest.mark.asyncio
async def test_create_validation_workflow_mock():
    """用 AsyncMock db 覆盖工作流创建逻辑。"""
    from unittest.mock import AsyncMock

    db = AsyncMock()
    svc = FormulaValidationService(db)
    workflow, result = await svc.create_validation_workflow(
        formula_id=1,
        user_id=1,
        config={"formula_name": "测试配方", "daily_dosage_g": 10},
    )
    assert result.formula_id == 1
    assert result.validation_id.startswith("val-")
    assert workflow is not None
    # 创建了 Workflow 与多个 WorkflowTask
    assert db.add.call_count >= 2
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_create_validation_workflow_parallel_custom_order():
    """parallel=True + 自定义 validation_order 分支。"""
    from unittest.mock import AsyncMock
    from app.services.formula_validation_workflow import (
        FormulaValidationService as FVS,
        ValidationStage,
    )

    db = AsyncMock()
    svc = FVS(db)
    workflow, result = await svc.create_validation_workflow(
        formula_id=2,
        user_id=1,
        experiment_id=10,
        validation_order=["safety_check", "taste_prediction"],
        parallel=True,
        config={"formula_name": "并行测试", "storage_temp_c": 5},
    )
    assert result.formula_id == 2
    assert result.validation_id.startswith("val-")
    assert workflow is not None
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_compute_overall_result():
    from app.services.formula_validation_workflow import (
        FormulaValidationResult,
        StageResult,
        ValidationStage,
        ValidationOutcome,
    )

    svc = FormulaValidationService(db=None)  # 该方法不使用 db
    result = FormulaValidationResult(formula_id=1, formula_name="F", validation_id="V1")
    result.stages = [
        StageResult(stage=ValidationStage.SAFETY_CHECK, success=True, score=80, passed=True),
        StageResult(stage=ValidationStage.TASTE_PREDICTION, success=True, score=60, passed=True),
    ]
    await svc._compute_overall_result(result, {}, None)
    assert result.overall_score > 0
    assert result.outcome in (
        ValidationOutcome.PASSED,
        ValidationOutcome.CONDITIONAL,
        ValidationOutcome.FAILED,
    )
    assert "weighted_score" in result.summary


@pytest.mark.asyncio
async def test_compute_overall_result_no_scores():
    from app.services.formula_validation_workflow import (
        FormulaValidationResult,
        ValidationOutcome,
    )

    svc = FormulaValidationService(db=None)
    result = FormulaValidationResult(formula_id=1, formula_name="F", validation_id="V1")
    await svc._compute_overall_result(result, {}, None)
    assert result.overall_score == 0
    assert result.outcome == ValidationOutcome.FAILED


def test_generate_recommendations():
    from app.services.formula_validation_workflow import FormulaValidationResult

    svc = FormulaValidationService(db=None)
    result = FormulaValidationResult(formula_id=1, formula_name="F", validation_id="V1")
    recs = svc._generate_recommendations(result)
    assert isinstance(recs, list)


@pytest.mark.asyncio
async def test_run_validation_pipeline_mock():
    """用 AsyncMock db 覆盖核心验证管线（执行器对 mock db 失败会被捕获并继续）。"""
    from unittest.mock import AsyncMock, MagicMock
    from app.services.formula_validation_workflow import (
        FormulaValidationService as FVS,
        ValidationStage,
    )

    db = AsyncMock()
    db.execute.return_value.scalar_one_or_none.return_value = MagicMock(id=1)
    svc = FVS(db)
    await svc._run_validation_pipeline(
        workflow_id=1,
        validation_id="val-1-123",
        stages=[ValidationStage.SAFETY_CHECK],
        experiment_id=None,
        config={"formula_id": 1, "formula_name": "测试配方", "daily_dosage_g": 10},
    )
    # 管线内会多次 commit（任务状态/工作流状态）
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_run_validation_pipeline_mock_with_experiment():
    """带 experiment_id 的管线路径（覆盖数据对比与实验更新分支）。"""
    from unittest.mock import AsyncMock, MagicMock
    from app.services.formula_validation_workflow import (
        FormulaValidationService as FVS,
        ValidationStage,
    )

    db = AsyncMock()
    db.execute.return_value.scalar_one_or_none.return_value = MagicMock(id=1)
    svc = FVS(db)
    await svc._run_validation_pipeline(
        workflow_id=2,
        validation_id="val-2-456",
        stages=[ValidationStage.COMPATIBILITY_CHECK],
        experiment_id=10,
        config={"formula_id": 1, "formula_name": "测试", "storage_temp_c": 25},
    )
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_compare_predictions_with_experiment_empty():
    """实验数据为空时，对比结果为 []。"""
    from unittest.mock import AsyncMock, Mock
    from app.services.formula_validation_workflow import (
        FormulaValidationService as FVS,
        FormulaValidationResult,
        StageResult,
        ValidationStage,
    )

    db = AsyncMock()
    db.execute.return_value = Mock()
    db.execute.return_value.scalars.return_value.all.return_value = []
    svc = FVS(db)
    result = FormulaValidationResult(formula_id=1, formula_name="F", validation_id="V1")
    result.stages = [
        StageResult(
            stage=ValidationStage.SAFETY_CHECK,
            success=True,
            score=80,
            passed=True,
            details={"risk_score": 0.2},
        )
    ]
    comparisons = await svc._compare_predictions_with_experiment(result, 1, {})
    assert comparisons == []


@pytest.mark.asyncio
async def test_compare_predictions_with_experiment_matched():
    """实验数据含匹配参数时，生成 ComparisonPoint。"""
    from unittest.mock import AsyncMock, MagicMock, Mock
    from app.services.formula_validation_workflow import (
        FormulaValidationService as FVS,
        FormulaValidationResult,
        StageResult,
        ValidationStage,
    )

    dp = MagicMock()
    dp.parameter = "risk_score"
    dp.value = 0.3

    db = AsyncMock()
    db.execute.return_value = Mock()
    db.execute.return_value.scalars.return_value.all.return_value = [dp]
    svc = FVS(db)
    result = FormulaValidationResult(formula_id=1, formula_name="F", validation_id="V1")
    result.stages = [
        StageResult(
            stage=ValidationStage.SAFETY_CHECK,
            success=True,
            score=80,
            passed=True,
            details={"risk_score": 0.2},
        )
    ]
    comparisons = await svc._compare_predictions_with_experiment(result, 1, {})
    assert len(comparisons) >= 1
    assert comparisons[0].parameter == "risk_score"
    assert comparisons[0].predicted_value == 0.2


@pytest.mark.asyncio
async def test_run_validation_pipeline_all_stages_mock():
    """全阶段管线（7 个 ValidationStage）覆盖完整循环。"""
    from unittest.mock import AsyncMock, MagicMock
    from app.services.formula_validation_workflow import (
        FormulaValidationService as FVS,
        ValidationStage,
        DEFAULT_VALIDATION_ORDER,
    )

    db = AsyncMock()
    db.execute.return_value.scalar_one_or_none.return_value = MagicMock(id=1)
    svc = FVS(db)
    stages = [ValidationStage(s) for s in DEFAULT_VALIDATION_ORDER]
    await svc._run_validation_pipeline(
        workflow_id=1,
        validation_id="val-1-789",
        stages=stages,
        experiment_id=None,
        config={"formula_id": 1, "formula_name": "全阶段测试", "daily_dosage_g": 10},
    )
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_update_experiment_validation_result_no_exp():
    """实验不存在时，不写库、不 commit。"""
    from unittest.mock import AsyncMock, Mock
    from app.services.formula_validation_workflow import (
        FormulaValidationService as FVS,
        FormulaValidationResult,
    )

    db = AsyncMock()
    db.execute.return_value = Mock()
    db.execute.return_value.scalar_one_or_none.return_value = None
    svc = FVS(db)
    result = FormulaValidationResult(formula_id=1, formula_name="F", validation_id="V1")
    await svc._update_experiment_validation_result(1, result)
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_update_experiment_validation_result_with_exp():
    """实验存在时，写入验证结果并 commit。"""
    from unittest.mock import AsyncMock, MagicMock, Mock
    from app.services.formula_validation_workflow import (
        FormulaValidationService as FVS,
        FormulaValidationResult,
    )

    exp = MagicMock()
    exp.results = {}
    db = AsyncMock()
    db.execute.return_value = Mock()
    db.execute.return_value.scalar_one_or_none.return_value = exp
    svc = FVS(db)
    result = FormulaValidationResult(formula_id=1, formula_name="F", validation_id="V1")
    await svc._update_experiment_validation_result(1, result)
    assert exp.results["validation_id"] == "V1"
    db.commit.assert_awaited()
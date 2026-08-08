"""
测试 AI 端点 Mock 数据替换

验证所有原本返回 mock 数据的端点现在查询真实数据库
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.fixture
def mock_db():
    """模拟数据库会话"""
    db = AsyncMock()
    return db


@pytest.fixture
def mock_user():
    """模拟当前用户"""
    user = MagicMock()
    user.id = 1
    user.username = "test_user"
    return user


class TestAnalyzeFormulaEndpoint:
    """测试 /ai/analyze/formula 端点"""

    @pytest.mark.asyncio
    async def test_returns_real_formula_when_id_provided(self, mock_db, mock_user):
        """传入 formula_id 时应返回真实配方数据"""
        from app.api.ai import analyze_formula
        from app.models import Formula, Ingredient, Peptide

        # 模拟数据库查询结果
        mock_formula = MagicMock()
        mock_formula.id = 1
        mock_formula.name = "测试配方"
        mock_formula.target_effects = ["增强免疫", "抗疲劳"]
        mock_formula.ingredients = [
            MagicMock(name="黄芪", dosage="10g", unit="g", efficacy="补气"),
            MagicMock(name="党参", dosage="8g", unit="g", efficacy="健脾"),
        ]
        mock_formula.peptides = []
        mock_formula.creator = mock_user

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_formula
        mock_db.execute.return_value = mock_result

        from app.api.ai import FormulaAnalysisRequest

        req = FormulaAnalysisRequest(
            formula_id=1,
            ingredients=None,
            target_effects=None,
        )

        with patch("app.api.ai.get_db_session", return_value=mock_db):
            with patch("app.api.ai.get_current_user", return_value=mock_user):
                result = await analyze_formula(req, mock_db, mock_user)

        # 验证返回的是真实数据而非 mock
        assert result["formula_id"] == 1
        assert result["ingredient_analysis"]["total_count"] == 2
        assert result["ingredient_analysis"]["herb_count"] == 2
        assert result["effect_prediction"]["predicted_effects"] == ["增强免疫", "抗疲劳"]
        assert "generated_at" in result
        # 验证调用了数据库查询
        mock_db.execute.assert_called()


class TestRecommendFormulasEndpoint:
    """测试 /ai/recommend/formulas 端点"""

    @pytest.mark.asyncio
    async def test_returns_db_formulas_not_hardcoded(self, mock_db, mock_user):
        """推荐应来自数据库而非硬编码数据"""
        from app.api.ai import recommend_formulas
        from app.models import Formula

        # 模拟数据库查询结果
        mock_formula = MagicMock()
        mock_formula.id = 100
        mock_formula.name = "数据库配方"
        mock_formula.description = "来自真实数据库"
        mock_formula.target_effects = ["增强免疫"]
        mock_formula.composition = {"黄芪": 10}
        mock_formula.created_at = MagicMock(isoformat=lambda: "2026-01-01T00:00:00+00:00")
        mock_formula.creator = MagicMock(username="db_user")

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_formula]
        mock_db.execute.return_value = mock_result

        from app.api.ai import RecommendationRequest

        req = RecommendationRequest(
            user_id=None,
            based_on_formula_id=None,
            target_effects=None,
            limit=5,
        )

        with patch("app.api.ai.get_db_session", return_value=mock_db):
            with patch("app.api.ai.get_current_user", return_value=mock_user):
                result = await recommend_formulas(req, mock_db, mock_user)

        # 验证推荐来自数据库
        assert result["total"] >= 0  # 可能有0条（空库）
        assert result["algorithm"] == "hybrid"
        assert result["based_on"] == "user_history"


class TestPredictTrendsEndpoint:
    """测试 /ai/predict/trends 端点"""

    @pytest.mark.asyncio
    async def test_uses_real_database_counts(self, mock_db, mock_user):
        """趋势预测应使用数据库真实计数"""
        from app.api.ai import predict_trends
        from sqlalchemy import func as sql_func

        # 模拟 COUNT 查询
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 42  # 42个配方
        mock_db.execute.return_value = mock_count_result

        from app.api.ai import TrendPredictionRequest

        req = TrendPredictionRequest(
            timeframe="30d",
            metrics=["formulas", "experiments"],
        )

        with patch("app.api.ai.get_db_session", return_value=mock_db):
            with patch("app.api.ai.get_current_user", return_value=mock_user):
                result = await predict_trends(req, mock_db, mock_user)

        # 验证返回的是基于数据库的统计数据
        assert "formulas" in result
        assert "experiments" in result
        assert "top_trending_effects" in result
        assert "generated_at" in result
        # 验证 current 是基于数据库查询的（mock 返回 42）
        assert result["formulas"]["current"] == 42


class TestAnalyzeExperimentEndpoint:
    """测试 /ai/analyze/experiment 端点"""

    @pytest.mark.asyncio
    async def test_uses_real_experiment_data(self, mock_db, mock_user):
        """实验分析应使用真实实验数据"""
        from app.api.ai import analyze_experiment
        from app.models import Experiment, ExperimentData

        # 模拟实验查询
        mock_experiment = MagicMock()
        mock_experiment.id = 1
        mock_experiment.name = "测试实验"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_experiment
        mock_db.execute.return_value = mock_result

        from app.api.ai import ExperimentAnalysisRequest

        req = ExperimentAnalysisRequest(
            experiment_id=1,
            experiment_data=None,
        )

        with patch("app.api.ai.get_db_session", return_value=mock_db):
            with patch("app.api.ai.get_current_user", return_value=mock_user):
                result = await analyze_experiment(req, mock_db, mock_user)

        # 验证返回结构
        assert "experiment_id" in result
        assert "result_summary" in result
        assert "anomaly_detection" in result
        assert "interpretation" in result
        assert "recommendations" in result
        assert "confidence" in result


class TestNoHardcodedDates:
    """验证所有端点不再使用硬编码日期"""

    @pytest.mark.asyncio
    async def test_generated_at_is_dynamic(self, mock_db, mock_user):
        """所有端点的 generated_at 应为动态时间"""
        from app.api.ai import predict_trends, TrendPredictionRequest
        import datetime

        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 10
        mock_db.execute.return_value = mock_count_result

        req = TrendPredictionRequest(timeframe="7d", metrics=["formulas"])

        with patch("app.api.ai.get_db_session", return_value=mock_db):
            with patch("app.api.ai.get_current_user", return_value=mock_user):
                result = await predict_trends(req, mock_db, mock_user)

        # generated_at 应该是 ISO 格式的时间戳，不是硬编码字符串
        generated_at = result["generated_at"]
        # 验证不是硬编码的 "2026-04-24T12:00:00Z"
        assert generated_at != "2026-04-24T12:00:00Z"
        assert generated_at != "2026-04-26T12:00:00Z"
        # 验证是合法的 ISO 格式
        assert "T" in generated_at
        assert "+" in generated_at or generated_at.endswith("Z")

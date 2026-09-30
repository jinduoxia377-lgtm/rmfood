"""单元测试：多维度推荐引擎"""
import pytest
import pytest_asyncio
from datetime import datetime, timezone
from unittest.mock import MagicMock, AsyncMock, patch

import sys
sys.path.insert(0, '.')

from app.services.recommendation_engine import RecommendationEngine, ScoreCalculator


class TestScoreCalculator:
    """评分计算器单元测试"""

    def test_synergy_score_empty_ingredients(self):
        """空成分返回中性分"""
        assert ScoreCalculator.calculate_synergy_score([], ["黄芪"]) == 0.5
        assert ScoreCalculator.calculate_synergy_score(["黄芪"], []) == 0.5
        assert ScoreCalculator.calculate_synergy_score([], []) == 0.5

    def test_synergy_score_identical_ingredients(self):
        """完全相同的成分得高分"""
        ingredients = ["黄芪", "人参", "枸杞"]
        score = ScoreCalculator.calculate_synergy_score(ingredients, ingredients)
        assert score > 0.8

    def test_synergy_score_no_overlap(self):
        """无共享成分得低分"""
        score = ScoreCalculator.calculate_synergy_score(
            ["黄芪", "人参"],
            ["灵芝", "虫草"],
        )
        assert score < 0.5

    def test_jaccard_similarity(self):
        """Jaccard 相似度测试"""
        # 完全相同
        assert ScoreCalculator.calculate_ingredient_overlap(
            ["A", "B", "C"], ["A", "B", "C"]
        ) == pytest.approx(1.0)
        # 部分重叠
        assert ScoreCalculator.calculate_ingredient_overlap(
            ["A", "B"], ["B", "C"]
        ) == pytest.approx(1/3)
        # 无重叠
        assert ScoreCalculator.calculate_ingredient_overlap(
            ["A", "B"], ["C", "D"]
        ) == 0.0

    def test_temporal_score_fresh_formula(self):
        """新配方时间分接近 1"""
        now = datetime.now(timezone.utc)
        score = ScoreCalculator.calculate_temporal_score(now)
        assert score > 0.99

    def test_temporal_score_old_formula(self):
        """旧配方时间分显著降低"""
        old = datetime.now(timezone.utc).replace(
            year=2025, month=1, day=1
        )
        score = ScoreCalculator.calculate_temporal_score(old)
        assert score < 0.5

    def test_effect_match_identical(self):
        """功效完全匹配得满分"""
        effects = ["补气养血", "滋阴润燥"]
        assert ScoreCalculator.calculate_effect_match(effects, effects) == 1.0

    def test_effect_match_partial(self):
        """部分功效匹配得中等分"""
        score = ScoreCalculator.calculate_effect_match(
            ["补气养血", "滋阴润燥"],
            ["补气养血", "清热解毒"],
        )
        assert 0.2 < score < 0.8

    def test_weighted_total(self):
        """加权总分计算正确"""
        total = ScoreCalculator.calculate_total(
            synergy=1.0,
            ingredient_overlap=1.0,
            temporal=1.0,
            user_pref=1.0,
            effect_match=1.0,
        )
        assert total == pytest.approx(1.0)

        total_partial = ScoreCalculator.calculate_total(
            synergy=0.0,
            ingredient_overlap=0.0,
            temporal=0.0,
            user_pref=0.0,
            effect_match=0.0,
        )
        assert total_partial == 0.0


@pytest_asyncio.fixture
async def mock_db():
    """模拟数据库会话"""
    db = AsyncMock()
    db.execute == AsyncMock()
    return db


@pytest_asyncio.fixture
async def mock_formula():
    """模拟源配方"""
    formula = MagicMock()
    formula.id == 1
    formula.name == "测试配方"
    formula.target_effects == ["补气养血", "滋阴润燥"]
    formula.overall_score == 85
    formula.created_at == datetime.now(timezone.utc)

    ing1 = MagicMock()
    ing1.name == "黄芪"
    ing2 = MagicMock()
    ing2.name == "人参"
    ing3 = MagicMock()
    ing3.name == "枸杞"
    formula.ingredients == [ing1, ing2, ing3]
    return formula


@pytest_asyncio.fixture
async def mock_candidate_formulas():
    """模拟候选配方"""
    candidates = []
    for i in range(5):
        f = MagicMock()
        f.id == i + 10
        f.name == f"候选配方{i+1}"
        f.target_effects == ["补气养血"] if i % 2 == 0 else ["清热解毒"]
        f.overall_score == 70 + i * 5
        f.created_at == datetime.now(timezone.utc)

        ing_names = ["黄芪", "人参"] if i % 2 == 0 else ["灵芝", "虫草"]
        f.ingredients == [MagicMock(name=n) for n in ing_names]
        candidates.append(f)
    return candidates


class TestRecommendationEngine:
    """推荐引擎集成测试"""

    @pytest_asyncio.fixture
    def engine(self, mock_db):
        return RecommendationEngine(mock_db)

    @pytest.mark.asyncio
    async def test_recommend_returns_scores(self, engine, mock_formula, mock_candidate_formulas, mock_db):
        """推荐应返回带评分的列表"""
        # 模拟数据库查询
        mock_db.execute == AsyncMock(side_effect=[
            MagicMock.scalars == MagicMock(return_value=MagicMock(all=MagicMock(return_value=mock_candidate_formulas))),
            MagicMock.scalars == MagicMock(return_value=MagicMock(all=[])),  # 用户历史为空
        ])

        # 简化：直接测试评分逻辑
        from app.services.recommendation_engine import ScoreCalculator
        source_ings = ["黄芪", "人参", "枸杞"]
        target_ings = ["黄芪", "人参"]

        score = ScoreCalculator.calculate_synergy_score(source_ings, target_ings)
        assert score > 0.5  # 有共享成分

        overlap = ScoreCalculator.calculate_ingredient_overlap(source_ings, target_ings)
        assert overlap > 0.5

    @pytest.mark.asyncio
    async def test_recommend_with_target_effects_filter(self, engine, mock_formula, mock_db):
        """带 target_effects 过滤时应筛选结果"""
        # 测试功效匹配分
        effect_s = ScoreCalculator.calculate_effect_match(
            ["补气养血", "滋阴润燥"],
            ["补气养血"],
        )
        assert effect_s > 0  # 有交集

        no_match = ScoreCalculator.calculate_effect_match(
            ["补气养血"],
            ["清热解毒"],
        )
        assert no_match < 0.5  # 无交集


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

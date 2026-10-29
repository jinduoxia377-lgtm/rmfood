"""
感官智能评价系统测试（M2.3）

覆盖：味觉预测、雷达图生成、优化建议、原料检索
"""
import pytest
from app.domain.sensory import TasteProfile, SensoryScore
from app.infrastructure.sensory_engine import SensoryEvaluationEngine


@pytest.fixture
def engine():
    return SensoryEvaluationEngine()


class TestTasteProfile:
    """味觉轮廓测试"""

    def test_radar_format(self):
        profile = TasteProfile(sweetness=5.0, sourness=3.0, bitterness=1.0)
        radar = profile.to_radar()
        assert len(radar) == 7
        assert radar[0]["axis"] == "甜"
        assert radar[0]["value"] == 5.0
        assert radar[1]["axis"] == "酸"

    def test_dominant_notes(self):
        profile = TasteProfile(sweetness=8.0, sourness=2.0, bitterness=1.0)
        notes = profile.dominant_notes()
        assert "甜" in notes

    def test_dominant_notes_empty(self):
        profile = TasteProfile()
        assert profile.dominant_notes() == []

    def test_score_to_dict(self):
        score = SensoryScore(overall=85.5, taste=80.0, flavor=75.0, mouthfeel=70.0, appearance=90.0)
        d = score.to_dict()
        assert d["overall"] == 85.5
        assert isinstance(d["overall"], float)


class TestSensoryEvaluation:
    """感官评价引擎测试"""

    @pytest.mark.asyncio
    async def test_evaluate_single_herb(self, engine):
        report = engine.evaluate(["枸杞子"])
        assert report.taste_profile.sweetness > 0
        assert report.scores.overall > 0
        assert len(report.flavor_notes) >= 1

    @pytest.mark.asyncio
    async def test_evaluate_multiple_herbs(self, engine):
        report = engine.evaluate(["枸杞子", "红枣", "茯苓"])
        assert len(report.pros) >= 1
        assert len(report.optimization_suggestions) >= 1

    @pytest.mark.asyncio
    async def test_evaluate_with_dict_input(self, engine):
        report = engine.evaluate([
            {"name": "枸杞子", "dosage": 10},
            {"name": "红枣", "dosage": 15},
        ])
        assert report.scores.overall > 0

    @pytest.mark.asyncio
    async def test_empty_formula(self, engine):
        report = engine.evaluate([])
        assert "请添加原料" in report.optimization_suggestions[0]

    @pytest.mark.asyncio
    async def test_unknown_herb(self, engine):
        """未知原料应不影响评价"""
        report = engine.evaluate(["枸杞子", "未知原料"])
        assert report.scores.overall > 0


class TestTastePrediction:
    """味觉预测准确性测试"""

    @pytest.mark.asyncio
    async def test_sweet_herbs(self, engine):
        report = engine.evaluate(["甘草"])
        assert report.taste_profile.sweetness > 6  # 甘草甜度高

    @pytest.mark.asyncio
    async def test_sour_herbs(self, engine):
        report = engine.evaluate(["山楂"])
        assert report.taste_profile.sourness > 6  # 山楂酸度高

    @pytest.mark.asyncio
    async def test_bitter_herbs(self, engine):
        report = engine.evaluate(["人参"])
        assert report.taste_profile.bitterness > 3  # 人參微苦

    @pytest.mark.asyncio
    async def test_balanced_formula(self, engine):
        """君臣佐使配伍的口感平衡"""
        report = engine.evaluate([
            {"name": "枸杞子", "dosage": 15},  # 君
            {"name": "红枣", "dosage": 10},    # 臣
            {"name": "茯苓", "dosage": 8},     # 佐
        ])
        t = report.taste_profile
        # 整体应偏甜不苦
        assert t.sweetness > t.bitterness
        assert t.sourness < 4  # 不酸


class TestFlavorNotes:
    """风味描述测试"""

    @pytest.mark.asyncio
    async def test_flavor_collection(self, engine):
        report = engine.evaluate(["菊花", "陈皮"])
        flavors = [f.name for f in report.flavor_notes]
        assert "花香" in flavors or "橘香" in flavors

    @pytest.mark.asyncio
    async def test_flavor_intensity_ordered(self, engine):
        report = engine.evaluate(["陈皮", "菊花"])
        intensities = [f.intensity for f in report.flavor_notes]
        assert intensities == sorted(intensities, reverse=True)  # 降序


class TestOptimization:
    """优化建议测试"""

    @pytest.mark.asyncio
    async def test_bitter_optimization(self, engine):
        report, suggestions = engine.evaluate_with_optimization(["人参"])
        bitter_suggestions = [s for s in suggestions if s.target_dimension == "bitterness"]
        if report.taste_profile.bitterness > 4:
            assert len(bitter_suggestions) >= 1

    def test_sensory_weakness_detection(self, engine):
        """配方评价应产生有意义的建议"""
        report = engine.evaluate(["人参", "菊花"])
        # 应有优点和优化建议
        assert len(report.pros) >= 1 or len(report.optimization_suggestions) >= 1


class TestSearch:
    """原料检索测试"""

    @pytest.mark.asyncio
    async def test_search_by_sweetness(self, engine):
        results = engine.search_by_taste("甜", min_value=7.0)
        assert "甘草" in results
        assert "红枣" in results

    @pytest.mark.asyncio
    async def test_search_by_sourness(self, engine):
        results = engine.search_by_taste("酸", min_value=5.0)
        assert "山楂" in results

    @pytest.mark.asyncio
    async def test_search_by_unknown_dimension(self, engine):
        results = engine.search_by_taste("未知味觉")
        assert results == []


class TestMouthfeel:
    """口感质地测试"""

    @pytest.mark.asyncio
    async def test_thick_herbs(self, engine):
        report = engine.evaluate(["当归"])
        assert report.mouthfeel.richness > 4  # 当归醇厚

    @pytest.mark.asyncio
    async def test_refreshing_herbs(self, engine):
        report = engine.evaluate(["菊花"])
        assert report.mouthfeel.freshness > 6  # 菊花清爽

    @pytest.mark.asyncio
    async def test_smooth_herbs(self, engine):
        report = engine.evaluate(["茯苓"])
        assert report.mouthfeel.smoothness > 5  # 茯苓顺滑

    @pytest.mark.asyncio
    async def test_combined_mouthfeel(self, engine):
        report = engine.evaluate(["茯苓", "菊花"])
        # 两者搭配应清爽顺滑
        assert report.mouthfeel.freshness > 4
        assert report.mouthfeel.smoothness > 4

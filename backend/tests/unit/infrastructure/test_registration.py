"""
智能注册申报模块测试（M2.5）
"""
import pytest
from app.domain.registration import (
    ComplianceCheckResult, ComplianceReport, ReviewPrediction, RegistrationSubmission,
)
from app.infrastructure.registration_engine import (
    RegistrationEngine, RegistrationCategory,
)


@pytest.fixture
def engine():
    return RegistrationEngine()


class TestRequirements:
    """注册要求测试"""

    def test_get_health_food_requirements(self, engine):
        req = engine.get_requirements(RegistrationCategory.HEALTH_FOOD)
        assert req is not None
        assert len(req.required_docs) >= 5
        assert req.review_cycle_days > 0

    def test_get_new_food_requirements(self, engine):
        req = engine.get_requirements(RegistrationCategory.NEW_FOOD)
        assert req is not None
        assert req.review_cycle_days == 240

    def test_list_categories(self, engine):
        cats = engine.list_categories()
        assert len(cats) >= 3


class TestCompliance:
    """合规检查测试"""

    def test_compliance_all_legal(self, engine):
        report = engine.check_compliance(
            "枸杞红枣口服液",
            ["枸杞子", "红枣", "茯苓"],
            RegistrationCategory.HEALTH_FOOD,
        )
        assert isinstance(report, ComplianceReport)
        assert report.total_checks > 0
        assert report.passed_checks > 0

    def test_compliance_with_banned_substance(self, engine):
        report = engine.check_compliance(
            "问题配方",
            ["枸杞子", "西布曲明"],
            RegistrationCategory.HEALTH_FOOD,
        )
        illegal = [r for r in report.results if r.item == "非法添加"]
        assert len(illegal) >= 1
        assert not illegal[0].passed

    def test_compliance_report_counts(self, engine):
        report = engine.check_compliance(
            "测试配方",
            ["枸杞子", "红枣"],
            RegistrationCategory.HEALTH_FOOD,
        )
        assert report.total_checks == report.passed_checks + report.failed_critical + (
            report.total_checks - report.passed_checks - report.failed_critical
        )

    def test_compliance_unknown_ingredient(self, engine):
        """药食同源目录外原料应标记"""
        report = engine.check_compliance(
            "创新配方",
            ["某种未知原料"],
            RegistrationCategory.HEALTH_FOOD,
        )
        directory_check = [r for r in report.results if r.item == "药食同源目录"]
        if directory_check:
            assert not directory_check[0].passed  # 不在目录内


class TestReviewPrediction:
    """审评预测测试"""

    def test_predict_simple_formula(self, engine):
        report = engine.check_compliance(
            "简单配方", ["枸杞子", "红枣"], RegistrationCategory.HEALTH_FOOD
        )
        prediction = engine.predict_review(
            ["枸杞子", "红枣"], report, RegistrationCategory.HEALTH_FOOD
        )
        assert 0 < prediction.probability_pass < 1
        assert len(prediction.likely_questions) >= 1
        assert prediction.estimated_cycles > 0

    def test_predict_complex_formula(self, engine):
        ingredients = [f"原料{i}" for i in range(10)]
        report = engine.check_compliance("复杂配方", ingredients, RegistrationCategory.HEALTH_FOOD)
        prediction = engine.predict_review(ingredients, report, RegistrationCategory.HEALTH_FOOD)
        assert len(prediction.risk_factors) >= 1

    def test_prediction_has_questions(self, engine):
        report = engine.check_compliance("测试", ["枸杞子"], RegistrationCategory.HEALTH_FOOD)
        prediction = engine.predict_review(["枸杞子"], report, RegistrationCategory.HEALTH_FOOD)
        assert len(prediction.likely_questions) >= 1


class TestDocumentGeneration:
    """材料生成测试"""

    def test_generate_all_documents(self, engine):
        docs = engine.generate_documents(
            "枸杞红枣口服液",
            ["枸杞子", "红枣", "茯苓"],
            RegistrationCategory.HEALTH_FOOD,
            "RMFOOD",
            ["抗氧化", "免疫调节"],
        )
        assert len(docs) >= 5
        for doc in docs:
            assert doc.content
            assert doc.is_required

    def test_document_has_content(self, engine):
        docs = engine.generate_documents(
            "测试配方", ["枸杞子"], RegistrationCategory.HEALTH_FOOD, "测试", ["抗氧化"]
        )
        for doc in docs:
            assert len(doc.content) > 50  # 内容有足够长度

    def test_registration_application_content(self, engine):
        docs = engine.generate_documents(
            "枸杞红枣口服液", ["枸杞子", "红枣"],
            RegistrationCategory.HEALTH_FOOD, "RMFOOD", ["抗氧化"],
        )
        app_doc = next((d for d in docs if "注册申请" in d.doc_type), None)
        assert app_doc is not None
        assert "枸杞红枣口服液" in app_doc.content
        assert "RMFOOD" in app_doc.content


class TestFullSubmission:
    """完整申报流程测试"""

    @pytest.mark.asyncio
    async def test_create_submission(self, engine):
        submission = await engine.create_submission(
            "枸杞红枣口服液",
            ["枸杞子", "红枣", "茯苓"],
            RegistrationCategory.HEALTH_FOOD,
            "RMFOOD生物科技有限公司",
            ["抗氧化", "免疫调节"],
        )
        assert isinstance(submission, RegistrationSubmission)
        assert submission.id.startswith("REG-")
        assert len(submission.documents) >= 5
        assert submission.compliance is not None
        assert submission.prediction is not None
        assert submission.status == "draft"

    @pytest.mark.asyncio
    async def test_submission_expected_completion(self, engine):
        submission = await engine.create_submission(
            "测试", ["枸杞子"], RegistrationCategory.HEALTH_FOOD, "测试", ["抗氧化"]
        )
        assert submission.expected_completion is not None
        assert submission.expected_completion > submission.created_at

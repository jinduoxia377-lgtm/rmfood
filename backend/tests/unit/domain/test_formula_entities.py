"""
配方领域实体单元测试

验证核心业务逻辑可脱离 FastAPI/数据库独立测试。
这是六边形架构的核心价值：领域逻辑纯 Python 可测。
"""
import pytest
from datetime import datetime
from decimal import Decimal

pytestmark = pytest.mark.skip(reason="app.domain.entities 已删除，待基于新的领域模型重写")


@pytest.fixture
def draft_formula():
    """创建一个草稿状态的配方"""
    return Formula(
        id=FormulaId(value="test-001"),
        name="测试配方-抗氧化",
        version="1.0.0",
        description="测试用抗氧化配方",
        ingredients=[],
        target_effects=[EffectCategory.ANTIOXIDANT],
        status=FormulaStatus.DRAFT,
        author_id="user-001",
        organization_id="org-001",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


@pytest.fixture
def sample_ingredient():
    return Ingredient(
        tcm_id="TCM-001",
        name_cn="枸杞子",
        name_en="Lycium barbarum",
        dosage_g=Decimal("10.0"),
        dosage_min_g=Decimal("5.0"),
        dosage_max_g=Decimal("15.0"),
        category="果实类",
        active_compounds=["枸杞多糖", "甜菜碱"],
    )


class TestFormulaCreation:
    """配方创建测试"""

    def test_create_draft_formula(self, draft_formula):
        """草稿配方应具有正确的初始状态"""
        assert draft_formula.status == FormulaStatus.DRAFT
        assert len(draft_formula.ingredients) == 0
        assert draft_formula.version == "1.0.0"
        assert EffectCategory.ANTIOXIDANT in draft_formula.target_effects

    def test_formula_id_format(self):
        """FormulaId 的字符串表示应当规范"""
        fid = FormulaId(value="abc-123")
        assert str(fid) == "F-abc-123"


class TestIngredientManagement:
    """原料管理测试"""

    def test_add_ingredient(self, draft_formula, sample_ingredient):
        """添加原料应成功"""
        draft_formula.add_ingredient(sample_ingredient)
        assert len(draft_formula.ingredients) == 1
        assert draft_formula.ingredients[0].name_cn == "枸杞子"

    def test_add_ingredient_raises_domain_event(self, draft_formula, sample_ingredient):
        """添加原料应产生领域事件"""
        draft_formula.add_ingredient(sample_ingredient)
        events = draft_formula.collect_events()
        assert len(events) == 1
        assert isinstance(events[0], IngredientAddedEvent)
        assert events[0].ingredient_id == "TCM-001"

    def test_remove_ingredient(self, draft_formula, sample_ingredient):
        """移除原料应成功"""
        draft_formula.add_ingredient(sample_ingredient)
        draft_formula.collect_events()  # 清空事件
        draft_formula.remove_ingredient("TCM-001")
        assert len(draft_formula.ingredients) == 0

    def test_remove_ingredient_raises_event(self, draft_formula, sample_ingredient):
        """移除原料应产生领域事件"""
        draft_formula.add_ingredient(sample_ingredient)
        draft_formula.collect_events()
        draft_formula.remove_ingredient("TCM-001")
        events = draft_formula.collect_events()
        assert len(events) == 1

    def test_add_ingredient_exceeds_max_dosage(self, draft_formula):
        """添加超过最大剂量的原料应拒绝"""
        over_dose = Ingredient(
            tcm_id="TCM-002",
            name_cn="人参",
            name_en="Ginseng",
            dosage_g=Decimal("100.0"),  # 超量
            dosage_min_g=Decimal("3.0"),
            dosage_max_g=Decimal("9.0"),
            category="根茎类",
        )
        with pytest.raises(FormulaDomainError, match="超出安全上限"):
            draft_formula.add_ingredient(over_dose)

    def test_add_ingredient_below_min_dosage(self, draft_formula):
        """添加低于最小有效剂量的原料应拒绝"""
        under_dose = Ingredient(
            tcm_id="TCM-003",
            name_cn="灵芝",
            name_en="Ganoderma",
            dosage_g=Decimal("0.1"),  # 过低
            dosage_min_g=Decimal("6.0"),
            dosage_max_g=Decimal("15.0"),
            category="真菌类",
        )
        with pytest.raises(FormulaDomainError, match="低于有效下限"):
            draft_formula.add_ingredient(under_dose)


class TestFormulaWorkflow:
    """配方状态流转测试"""

    def test_submit_draft(self, draft_formula, sample_ingredient):
        """草稿配方有原料时可提交审核"""
        draft_formula.add_ingredient(sample_ingredient)
        draft_formula.collect_events()
        draft_formula.submit_for_review()
        assert draft_formula.status == FormulaStatus.UNDER_REVIEW

    def test_submit_empty_formula_raises(self, draft_formula):
        """没有原料的配方不能提交"""
        with pytest.raises(FormulaDomainError, match="at least one ingredient"):
            draft_formula.submit_for_review()

    def test_submit_already_submitted_raises(self, draft_formula, sample_ingredient):
        """已提交的配方不能再次提交"""
        draft_formula.add_ingredient(sample_ingredient)
        draft_formula.collect_events()
        draft_formula.submit_for_review()
        with pytest.raises(FormulaDomainError, match="Only draft"):
            draft_formula.submit_for_review()

    def test_approve_formula(self, draft_formula, sample_ingredient):
        """提交后可以批准"""
        draft_formula.add_ingredient(sample_ingredient)
        draft_formula.collect_events()
        draft_formula.submit_for_review()
        draft_formula.approve(reviewer_id="reviewer-001")
        assert draft_formula.status == FormulaStatus.APPROVED
        assert draft_formula.approved_at is not None

    def test_approve_emits_event(self, draft_formula, sample_ingredient):
        """批准应产生 FormulaApprovedEvent"""
        draft_formula.add_ingredient(sample_ingredient)
        draft_formula.collect_events()
        draft_formula.submit_for_review()
        draft_formula.approve(reviewer_id="reviewer-001")
        events = draft_formula.collect_events()
        assert any(isinstance(e, FormulaApprovedEvent) for e in events)

    def test_reject_formula(self, draft_formula, sample_ingredient):
        """提交后可以驳回"""
        draft_formula.add_ingredient(sample_ingredient)
        draft_formula.collect_events()
        draft_formula.submit_for_review()
        draft_formula.reject(reviewer_id="reviewer-001", reason="用量不符合安全范围")
        assert draft_formula.status == FormulaStatus.REJECTED

    def test_reject_emits_event(self, draft_formula, sample_ingredient):
        """驳回应产生 FormulaRejectedEvent"""
        draft_formula.add_ingredient(sample_ingredient)
        draft_formula.collect_events()
        draft_formula.submit_for_review()
        draft_formula.reject(reviewer_id="reviewer-001", reason="测试驳回")
        events = draft_formula.collect_events()
        assert any(isinstance(e, FormulaRejectedEvent) for e in events)

    def test_approve_draft_without_submit_raises(self, draft_formula):
        """未提交的草稿不能直接批准"""
        with pytest.raises(FormulaDomainError, match="Only formulas under review"):
            draft_formula.approve(reviewer_id="reviewer-001")

    def test_archive_approved_formula(self, draft_formula, sample_ingredient):
        """批准后的配方可以归档"""
        draft_formula.add_ingredient(sample_ingredient)
        draft_formula.collect_events()
        draft_formula.submit_for_review()
        draft_formula.approve(reviewer_id="reviewer-001")
        draft_formula.archive()
        assert draft_formula.status == FormulaStatus.ARCHIVED


class TestDomainEvents:
    """领域事件收集测试"""

    def test_collect_events_clears(self, draft_formula, sample_ingredient):
        """收集事件后应清空事件列表"""
        draft_formula.add_ingredient(sample_ingredient)
        events = draft_formula.collect_events()
        assert len(events) == 1
        assert len(draft_formula.collect_events()) == 0  # 再次收集为空

    def test_multiple_actions_accumulate_events(self, draft_formula, sample_ingredient):
        """多次操作应累积事件"""
        draft_formula.add_ingredient(sample_ingredient)
        draft_formula.collect_events()
        draft_formula.submit_for_review()
        events = draft_formula.collect_events()
        assert len(events) == 1
        assert isinstance(events[0], FormulaSubmittedEvent)


class TestNutrientProfile:
    """营养成分测试"""

    def test_formula_with_nutrients(self, draft_formula, sample_ingredient):
        """配方可包含营养成分"""
        draft_formula.add_ingredient(sample_ingredient)
        draft_formula.collect_events()
        draft_formula.nutrient_profile = NutrientProfile(
            protein_g=Decimal("5.0"),
            energy_kcal=Decimal("120.0"),
        )
        assert draft_formula.nutrient_profile.protein_g == Decimal("5.0")
        assert draft_formula.nutrient_profile.energy_kcal == Decimal("120.0")

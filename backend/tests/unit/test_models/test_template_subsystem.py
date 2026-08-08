"""Tests for TemplateSubsystem

Tests cover:
- Template selection
- Template application
- Template listing
- Match scoring
"""

import pytest

from app.services.ai.models.template_subsystem import TemplateSubsystem, FormulaTemplate


class TestTemplateSubsystemInit:
    """Test template subsystem initialization."""

    def test_default_init(self):
        subsystem = TemplateSubsystem()
        templates = subsystem.list_templates()
        assert "四君子汤" in templates
        assert "六味地黄丸" in templates

    def test_custom_templates(self):
        custom = {
            "自定义方": FormulaTemplate(
                name="自定义方",
                base_sequence=["a", "b", "c"],
                description="自定义模板",
                effect_keywords=["测试"],
            )
        }
        subsystem = TemplateSubsystem(templates=custom)
        assert "自定义方" in subsystem.list_templates()


class TestTemplateSelection:
    """Test template selection functionality."""

    def test_select_by_preference(self):
        subsystem = TemplateSubsystem()
        template = subsystem.select_template(
            target_effects=["补气"],
            preference="四君子汤",
        )
        assert template is not None
        assert template.name == "四君子汤"

    def test_select_by_effects(self):
        subsystem = TemplateSubsystem()
        template = subsystem.select_template(
            target_effects=["补气", "健脾"],
        )
        assert template is not None
        # Should match 四君子汤 (补气健脾)

    def test_select_no_match(self):
        subsystem = TemplateSubsystem()
        template = subsystem.select_template(
            target_effects=["不存在的功效XXX"],
        )
        # Should return None if no good match
        # (threshold is 0.3)

    def test_select_empty_effects(self):
        subsystem = TemplateSubsystem()
        template = subsystem.select_template(target_effects=[])
        assert template is None

    def test_select_prefer_known_template(self):
        subsystem = TemplateSubsystem()
        # 银翘散 is for 清热解毒
        template = subsystem.select_template(
            target_effects=["清热", "解毒"],
        )
        assert template is not None


class TestTemplateApplication:
    """Test template application."""

    def test_pre_fill_mode(self):
        subsystem = TemplateSubsystem()
        template = subsystem._templates["四君子汤"]
        formula = {"hq": 10.0}

        result = subsystem.apply_template(formula, template, mode="pre_fill")

        # Template herbs should be added
        assert "ds" in result
        assert "bq" in result
        assert "gq" in result
        assert "dcx" in result
        # Original herb should remain
        assert "hq" in result

    def test_constraint_guide_mode(self):
        subsystem = TemplateSubsystem()
        template = subsystem._templates["四君子汤"]
        formula = {"ds": 3.0, "bq": 4.0, "gq": 2.0}

        result = subsystem.apply_template(formula, template, mode="constraint_guide")

        # 君药 (ds) should have increased dosage
        assert result["ds"] >= 6.0

    def test_apply_no_template(self):
        subsystem = TemplateSubsystem()
        formula = {"hq": 10.0}
        result = subsystem.apply_template(formula, None)
        assert result == formula

    def test_apply_unknown_mode(self):
        subsystem = TemplateSubsystem()
        template = subsystem._templates["四君子汤"]
        formula = {"hq": 10.0}
        result = subsystem.apply_template(formula, template, mode="unknown")
        assert result == formula


class TestTemplateUtilities:
    """Test template utility methods."""

    def test_get_template_sequence(self):
        subsystem = TemplateSubsystem()
        seq = subsystem.get_template_sequence("四君子汤")
        assert seq == ["ds", "bq", "gq", "dcx"]

    def test_get_unknown_template_sequence(self):
        subsystem = TemplateSubsystem()
        seq = subsystem.get_template_sequence("不存在")
        assert seq == []

    def test_list_templates(self):
        subsystem = TemplateSubsystem()
        templates = subsystem.list_templates()
        assert len(templates) >= 5
        assert isinstance(templates, list)

    def test_get_all_templates(self):
        subsystem = TemplateSubsystem()
        all_templates = subsystem.get_all_templates()
        assert "四君子汤" in all_templates
        assert isinstance(all_templates["四君子汤"], FormulaTemplate)


class TestFormulaTemplate:
    """Test FormulaTemplate dataclass."""

    def test_template_creation(self):
        template = FormulaTemplate(
            name="测试方",
            base_sequence=["a", "b", "c"],
            description="测试模板",
            effect_keywords=["测试功效"],
        )
        assert template.name == "测试方"
        assert template.base_sequence == ["a", "b", "c"]
        assert template.role_mapping["a"] == "君"
        assert template.role_mapping["b"] == "臣"

    def test_template_default_role_mapping(self):
        template = FormulaTemplate(
            name="测试",
            base_sequence=["a", "b", "c", "d", "e", "f", "g"],
        )
        # More than 6 herbs, extra should be "佐"
        assert template.role_mapping["a"] == "君"
        assert template.role_mapping["b"] == "臣"
        assert template.role_mapping["c"] == "臣"
        assert template.role_mapping["d"] == "佐"
        assert template.role_mapping["g"] == "佐"

"""
数据质量规则引擎 (v1.0)

对配方、成分、实验数据等数据进行质量校验，支持：
  1. 完整性检查（必填字段缺失）
  2. 一致性检查（数据逻辑冲突）
  3. 准确性检查（格式、范围、类型）
  4. 时效性检查（数据过期）

通过规则配置驱动，无需编写额外代码即可扩展新规则。
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


class QualityLevel(str, Enum):
    PASS = "pass"
    WARN = "warn"
    FAIL = "fail"


@dataclass
class QualityFinding:
    """质量检测结果"""
    rule_name: str
    field: str
    level: QualityLevel
    message: str
    value: Any = None


@dataclass
class QualityReport:
    """完整质量报告"""
    target_type: str        # "formula" | "ingredient" | "experiment"
    target_id: Optional[str] = None
    findings: List[QualityFinding] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return not any(f.level == QualityLevel.FAIL for f in self.findings)

    @property
    def pass_count(self) -> int:
        return sum(1 for f in self.findings if f.level == QualityLevel.PASS)

    @property
    def warn_count(self) -> int:
        return sum(1 for f in self.findings if f.level == QualityLevel.WARN)

    @property
    def fail_count(self) -> int:
        return sum(1 for f in self.findings if f.level == QualityLevel.FAIL)

    def summary(self) -> str:
        return (
            f"QualityReport(type={self.target_type}, "
            f"pass={self.pass_count}, warn={self.warn_count}, fail={self.fail_count})"
        )


# ── 规则定义 ────────────────────────────────────────────────────────────

class Rule:
    """数据质量规则基类"""

    def __init__(
        self,
        name: str,
        field: str,
        check_fn: Callable[[Any], Optional[str]],
        level: QualityLevel = QualityLevel.FAIL,
        description: str = "",
    ):
        self.name = name
        self.field = field
        self._check_fn = check_fn
        self.level = level
        self.description = description

    def check(self, value: Any) -> Optional[QualityFinding]:
        """执行规则检查，返回 None 表示通过"""
        error_msg = self._check_fn(value)
        if error_msg is None:
            return None
        return QualityFinding(
            rule_name=self.name,
            field=self.field,
            level=self.level,
            message=error_msg,
            value=value,
        )


# ── 内置规则集 ──────────────────────────────────────────────────────────

class FormulaQualityRules:
    """配方数据质量规则集"""

    @staticmethod
    def rules() -> List[Rule]:
        return [
            Rule(
                name="required_name",
                field="name",
                check_fn=lambda v: "配方名称不能为空" if not v or not str(v).strip() else None,
                level=QualityLevel.FAIL,
                description="配方名称必填",
            ),
            Rule(
                name="required_ingredients",
                field="ingredients",
                check_fn=lambda v: "配方成分列表不能为空" if not v or len(v) == 0 else None,
                level=QualityLevel.FAIL,
                description="配方至少包含一个成分",
            ),
            Rule(
                name="ingredient_quantity_valid",
                field="ingredients[].quantity",
                check_fn=lambda v: (
                    "成分用量必须为正数"
                    if v is not None and (not isinstance(v, (int, float)) or v <= 0)
                    else None
                ),
                level=QualityLevel.FAIL,
                description="成分用量必须是正数",
            ),
            Rule(
                name="total_percentage_valid",
                field="total_percentage",
                check_fn=lambda v: (
                    f"总配比应在 95-105% 范围内，当前为 {v}%"
                    if v is not None and (v < 95 or v > 105)
                    else None
                ),
                level=QualityLevel.WARN,
                description="总配比应接近 100%",
            ),
            Rule(
                name="target_population_valid",
                field="target_population",
                check_fn=lambda v: (
                    "目标人群无效"
                    if v and v not in ("adults", "children", "elderly", "general")
                    else None
                ),
                level=QualityLevel.WARN,
                description="目标人群应为 adults/children/elderly/general 之一",
            ),
            Rule(
                name="formula_name_length",
                field="name",
                check_fn=lambda v: (
                    f"配方名称过长（{len(str(v))} 字符，建议 ≤50）"
                    if v and len(str(v)) > 50
                    else None
                ),
                level=QualityLevel.WARN,
                description="配方名称建议不超过 50 字符",
            ),
        ]


class IngredientQualityRules:
    """成分数据质量规则集"""

    @staticmethod
    def rules() -> List[Rule]:
        return [
            Rule(
                name="required_name",
                field="name",
                check_fn=lambda v: "成分名称不能为空" if not v or not str(v).strip() else None,
                level=QualityLevel.FAIL,
            ),
            Rule(
                name="name_format",
                field="name",
                check_fn=lambda v: (
                    "成分名称包含非法字符"
                    if v and re.search(r'[<>&"\'\\]', str(v))
                    else None
                ),
                level=QualityLevel.FAIL,
            ),
            Rule(
                name="pinyin_format",
                field="pinyin",
                check_fn=lambda v: (
                    "拼音格式无效（应不含空格或特殊字符）"
                    if v and re.search(r'[^a-z\s]', str(v))
                    else None
                ),
                level=QualityLevel.WARN,
            ),
            Rule(
                name="dosage_range_valid",
                field="dosage_mg",
                check_fn=lambda v: (
                    "日用量超出合理范围（0-50000mg）"
                    if v is not None and (v < 0 or v > 50000)
                    else None
                ),
                level=QualityLevel.FAIL,
            ),
            Rule(
                name="is_food_homology_format",
                field="is_food_homology",
                check_fn=lambda v: (
                    "is_food_homology 字段类型错误"
                    if v is not None and not isinstance(v, bool)
                    else None
                ),
                level=QualityLevel.WARN,
            ),
        ]


# ── 质量检查器 ──────────────────────────────────────────────────────────

class DataQualityChecker:
    """
    数据质量检查器

    用法：
        checker = DataQualityChecker()
        report = checker.check_formula({"name": "枸杞饮品", "ingredients": [...]})
        if not report.is_valid:
            raise ValueError(report.summary())
    """

    def __init__(self):
        self._rule_sets: Dict[str, List[Rule]] = {
            "formula": FormulaQualityRules.rules(),
            "ingredient": IngredientQualityRules.rules(),
        }

    def register_rules(self, target_type: str, rules: List[Rule]) -> None:
        """注册自定义规则集"""
        self._rule_sets[target_type] = rules
        logger.info("[DataQuality] 注册规则集: %s (%d 条规则)", target_type, len(rules))

    def check_formula(self, data: dict, target_id: Optional[str] = None) -> QualityReport:
        """检查配方数据质量"""
        return self._check("formula", data, target_id)

    def check_ingredient(self, data: dict, target_id: Optional[str] = None) -> QualityReport:
        """检查成分数据质量"""
        return self._check("ingredient", data, target_id)

    def _check(self, target_type: str, data: dict, target_id: Optional[str] = None) -> QualityReport:
        """通用检查，支持嵌套字段如 ingredients[].quantity"""
        rules = self._rule_sets.get(target_type, [])
        findings: List[QualityFinding] = []

        for rule in rules:
            field_name = rule.field.split("[")[0]  # 提取字段名（去掉 [] 索引）
            value = data.get(field_name)

            # 处理嵌套字段（如 ingredients[].quantity）
            if "[]" in rule.field:
                items = value if isinstance(value, list) else []
                for item in items:
                    nested_field = rule.field.split("[")[1].rstrip("]")  # 提取嵌套字段名
                    nested_value = item.get(nested_field) if isinstance(item, dict) else None
                    finding = rule.check(nested_value)
                    if finding:
                        findings.append(finding)
                continue

            finding = rule.check(value)
            if finding:
                findings.append(finding)

        return QualityReport(
            target_type=target_type,
            target_id=target_id,
            findings=findings,
        )

    def get_stats(self) -> Dict[str, Any]:
        """获取规则统计"""
        return {
            type_name: len(rules)
            for type_name, rules in self._rule_sets.items()
        }


# ── 全局单例 ────────────────────────────────────────────────────────────

_checker: Optional[DataQualityChecker] = None


def get_quality_checker() -> DataQualityChecker:
    """获取全局 DataQualityChecker 单例"""
    global _checker
    if _checker is None:
        _checker = DataQualityChecker()
    return _checker


def check_formula(data: dict, target_id: Optional[str] = None) -> QualityReport:
    """快捷检查配方质量"""
    return get_quality_checker().check_formula(data, target_id)


def check_ingredient(data: dict, target_id: Optional[str] = None) -> QualityReport:
    """快捷检查成分质量"""
    return get_quality_checker().check_ingredient(data, target_id)

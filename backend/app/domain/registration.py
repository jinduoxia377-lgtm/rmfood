"""
智能注册申报领域实体（M2.5）

保健食品/特医食品注册申报的核心实体。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


class RegistrationCategory:
    """注册分类"""
    HEALTH_FOOD = "health_food"           # 保健食品注册
    HEALTH_FOOD_FILING = "health_filing"  # 保健食品备案
    FSMP = "fsmp"                         # 特医食品注册
    NEW_FOOD = "new_food"                 # 新食品原料


@dataclass
class RegistrationRequirement:
    """注册要求"""
    category: str
    required_docs: list[str]
    review_cycle_days: int
    validity_years: int
    fee_range: tuple[int, int]           # (min, max) 元
    regulatory_basis: list[str]
    notes: list[str] = field(default_factory=list)


@dataclass
class RegistrationDocument:
    """申报材料"""
    doc_type: str                        # 材料类型
    title: str                           # 材料名称
    content: str                         # 生成内容
    is_required: bool = True
    template: str = ""
    auto_generated: bool = False
    status: str = "draft"                # draft/complete/reviewed/approved


@dataclass
class ComplianceCheckResult:
    """合规检查结果"""
    item: str                            # 检查项
    passed: bool
    severity: str = "info"               # critical/warning/info
    detail: str = ""
    reference: str = ""                  # 引用标准条文
    suggestion: str = ""

    @property
    def is_critical(self) -> bool:
        return self.severity == "critical" and not self.passed


@dataclass
class ComplianceReport:
    """合规检查报告"""
    formula_name: str
    results: list[ComplianceCheckResult]
    overall_passed: bool
    total_checks: int = 0
    passed_checks: int = 0
    failed_critical: int = 0

    def __post_init__(self):
        self.total_checks = len(self.results)
        self.passed_checks = sum(1 for r in self.results if r.passed)
        self.failed_critical = sum(1 for r in self.results if r.is_critical)
        self.overall_passed = self.failed_critical == 0


@dataclass
class ReviewPrediction:
    """审评预测"""
    probability_pass: float              # 通过概率 0-1
    risk_factors: list[str]              # 风险因素
    likely_questions: list[str]          # 可能的审评问题
    suggested_reply: str                 # 建议答复
    estimated_cycles: int                # 预计审评周期（工作日）
    similar_cases: list[str] = field(default_factory=list)


@dataclass
class RegistrationSubmission:
    """注册申报单"""
    id: str
    formula_name: str
    category: str
    applicant: str
    status: str = "draft"                # draft/submitted/reviewing/approved/rejected
    documents: list[RegistrationDocument] = field(default_factory=list)
    compliance: Optional[ComplianceReport] = None
    prediction: Optional[ReviewPrediction] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    submitted_at: Optional[datetime] = None
    expected_completion: Optional[datetime] = None
    notes: list[str] = field(default_factory=list)

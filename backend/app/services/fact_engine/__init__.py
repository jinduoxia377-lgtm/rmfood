"""
FactEngine 模块 — 确定性计算引擎 + AI 叙述生成
对标 FormLab: "Numbers computed by software, AI writes prose"
"""
from .engine import (
    AllergenFact,
    AnomalyFact,
    ComplianceFact,
    CostFact,
    FactEngine,
    TheoreticalFact,
    get_fact_engine,
)
from .report_writer import (
    AIReportWriter,
    ReportBundle,
    SectionBlock,
    get_report_writer,
)

__all__ = [
    "FactEngine",
    "CostFact",
    "ComplianceFact",
    "AllergenFact",
    "AnomalyFact",
    "TheoreticalFact",
    "get_fact_engine",
    "AIReportWriter",
    "ReportBundle",
    "SectionBlock",
    "get_report_writer",
]

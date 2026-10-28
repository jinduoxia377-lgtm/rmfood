"""AI 安全模块"""

from .batch_safety_check import BatchCheckResult
from .instruction_hierarchy import (
    RETRIEVED_CONTENT_CLOSE,
    RETRIEVED_CONTENT_TAG,
    ContextLayer,
    InstructionHierarchy,
    build_safety_context,
)
from .output_filter import OutputCheckResult, OutputRiskLevel, OutputSafetyChecker, check_output
from .prompt_guard import (
    PromptGuard,
    PromptGuardResult,
    ThreatLevel,
    check_prompt,
    get_prompt_guard,
)
from .safety_report_generator import SafetyReportData, SafetyReportGenerator

__all__ = [
    # 原有模块
    "BatchCheckResult",
    "SafetyReportData",
    "SafetyReportGenerator",
    # Prompt 注入防护
    "PromptGuard",
    "PromptGuardResult",
    "ThreatLevel",
    "check_prompt",
    "get_prompt_guard",
    # 输出侧安全检查
    "OutputSafetyChecker",
    "OutputCheckResult",
    "OutputRiskLevel",
    "check_output",
    # 指令层级隔离
    "InstructionHierarchy",
    "ContextLayer",
    "build_safety_context",
    "RETRIEVED_CONTENT_TAG",
    "RETRIEVED_CONTENT_CLOSE",
]

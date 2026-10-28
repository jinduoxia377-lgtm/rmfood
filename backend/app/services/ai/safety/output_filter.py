"""
AI 输出侧安全检查 (v1.0)

在 AI 模型输出返回给用户之前，进行安全扫描：
  1. 敏感信息二次扫描（API Key、PII、内部数据）
  2. 高敏关键词拦截
  3. 异常长文本输出限制
  4. 代码/数据大段导出检测
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class OutputRiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class OutputFinding:
    """输出检测结果"""
    finding_type: str   # "pii" | "api_key" | "sensitive_keyword" | "long_output" | "code_leak" | "hallucination" | "medical_safety"
    severity: str       # "low" | "medium" | "high" | "critical"
    matched_text: str
    description: str


@dataclass
class OutputCheckResult:
    """完整输出检查结果"""
    risk_level: OutputRiskLevel
    original_length: int
    safe_length: int
    findings: list[OutputFinding] = field(default_factory=list)
    is_safe: bool = True
    sanitized_text: str = ""
    action: str = "allow"  # "allow" | "sanitize" | "truncate" | "block"


# ── 检测规则 ────────────────────────────────────────────────────────────

# 敏感信息模式（API Key、PII）
_SENSITIVE_PATTERNS: list[tuple[str, str, str, float]] = [
    # API Key / Token
    (r"(?i)(api[_-]?key|access[_-]?token|secret[_-]?key|password)\s*[:：]\s*([A-Za-z0-9_\-]{16,})", "api_key", "api_key", 0.9),
    (r"(?i)(sk-[a-zA-Z0-9]{20,}|pk-[a-zA-Z0-9]{20,})", "api_key", "api_key_pattern", 0.95),
    # PII
    (r"\d{11}", "phone", "phone_number", 0.7),                    # 手机号
    (r"(?i)[\w.+-]+@[\w-]+\.[\w.-]+", "email", "email_address", 0.6),  # 邮箱
    (r"\d{17}[\dXx]", "id_card", "id_number", 0.8),             # 身份证号
    (r"[一-鿿]{2,4}身份证", "id_card", "id_card_mention", 0.7),
    # ── 医疗幻觉检测（P0-1：防止 LLM 编造文献/DOI/临床数据）──
    (r"(?i)DOI:\s*\d+\.\d{4,}/[^\s]{3,}", "hallucinated_doi", "hallucination", 0.85),
    (r"(?i)《中国药典》\s*\d{4}年版.*?(显示|证实|表明|有效率为?)", "hallucinated_ref", "hallucination", 0.75),
    (r"(?i)(研究表明|临床证实|研究结果|数据显示|临床研究|实验证明).*?(有效率|治愈率|显著)", "hallucinated_stat", "hallucination", 0.7),
    # ── 医疗越界声明检测（P0-1：防止 LLM 替代处方药/治疗建议）──
    (r"(?i)(替代|代替|取代|停用).{0,5}(降压药|降糖药|处方药|抗生素|化疗|手术)", "medical_overreach", "medical_safety", 0.95),
    (r"(?i)(可治愈|根治|康复|痊愈).{0,5}(高血压|糖尿病|癌症|肿瘤|精神病)", "medical_overreach", "medical_safety", 0.95),
    (r"(?i)(无需|不必|不用).{0,5}(就医|看医生|去医院|治疗)", "medical_overreach", "medical_safety", 0.9),
]

# 高敏关键词
_SENSITIVE_KEYWORDS: list[tuple[str, str]] = [
    ("密码", "sensitive_kw"), ("password", "sensitive_kw"),
    ("密钥", "sensitive_kw"), ("secret", "sensitive_kw"),
    ("管理员密码", "sensitive_kw"), ("内部系统", "sensitive_kw"),
    ("数据库连接", "sensitive_kw"), ("连接字符串", "sensitive_kw"),
    ("配置文件", "sensitive_kw"), ("密钥文件", "sensitive_kw"),
]

# 超长输出限制（超过此长度触发警告）
MAX_OUTPUT_LENGTH: int = 16000
# 代码块限制
MAX_CODE_BLOCK_LINES: int = 100
MAX_CODE_BLOCK_CHARS: int = 8000


# ── 检测器 ──────────────────────────────────────────────────────────────


class OutputSafetyChecker:
    """AI 输出安全检查器"""

    def __init__(
        self,
        max_output_length: int = MAX_OUTPUT_LENGTH,
        max_code_block_chars: int = MAX_CODE_BLOCK_CHARS,
    ):
        self._max_length = max_output_length
        self._max_code_chars = max_code_block_chars
        self._sensitive_re = [
            (re.compile(p), ptype, desc, sev)
            for p, ptype, desc, sev in _SENSITIVE_PATTERNS
        ]
        self._sensitive_kw = [
            (re.compile(kw, re.IGNORECASE), kw, kw_type)
            for kw, kw_type in _SENSITIVE_KEYWORDS
        ]

    def check(self, text: str) -> OutputCheckResult:
        """
        检查 AI 输出文本的安全性

        Returns:
            OutputCheckResult: 检查结果
        """
        if not text:
            return OutputCheckResult(
                risk_level=OutputRiskLevel.LOW,
                original_length=0,
                safe_length=0,
                is_safe=True,
                action="allow",
            )

        findings: list[OutputFinding] = []
        sanitized = text

        # 1. 敏感信息扫描
        for pattern, ptype, desc, _ in self._sensitive_re:
            matches = pattern.findall(text)
            if matches:
                for match in matches[:3]:  # 最多记录3个
                    findings.append(OutputFinding(
                        finding_type=ptype,
                        severity="high",
                        matched_text=str(match)[:50],
                        description=f"检测到敏感信息: {desc}",
                    ))
                # 脱敏替换
                sanitized = pattern.sub("[REDACTED]", sanitized)

        # 2. 高敏关键词扫描
        for pattern, kw, kw_type in self._sensitive_kw:
            if pattern.search(text):
                findings.append(OutputFinding(
                    finding_type=kw_type,
                    severity="medium",
                    matched_text=kw,
                    description=f"检测到敏感关键词: {kw}",
                ))

        # 3. 超长输出检测
        if len(text) > self._max_length:
            findings.append(OutputFinding(
                finding_type="long_output",
                severity="medium",
                matched_text=f"length={len(text)}",
                description=f"输出超过 {self._max_length} 字符限制",
            ))
            sanitized = sanitized[:self._max_length] + "\n...\n[输出已截断]"

        # 4. 大段代码/数据检测
        code_blocks = re.findall(r"```[\s\S]*?```", text)
        for block in code_blocks:
            lines = block.count("\n")
            chars = len(block)
            if lines > MAX_CODE_BLOCK_LINES or chars > self._max_code_chars:
                findings.append(OutputFinding(
                    finding_type="code_leak",
                    severity="high",
                    matched_text=f"lines={lines}, chars={chars}",
                    description="检测到大段代码或数据输出",
                ))

        # 5. 计算风险等级
        risk_level = self._compute_risk_level(findings)
        # 有 findings 时 medium 风险也算不安全
        is_safe = len(findings) == 0 or risk_level == OutputRiskLevel.LOW
        action = self._compute_action(risk_level, len(findings))

        if risk_level in (OutputRiskLevel.HIGH, OutputRiskLevel.CRITICAL):
            logger.warning(
                "[OutputSafety] ⚠️ 高危输出检测: risk=%s findings=%d original_len=%d",
                risk_level.value, len(findings), len(text),
            )

        return OutputCheckResult(
            risk_level=risk_level,
            original_length=len(text),
            safe_length=len(sanitized),
            findings=findings,
            is_safe=is_safe,
            sanitized_text=sanitized if findings else text,
            action=action,
        )

    def _compute_risk_level(self, findings: list[OutputFinding]) -> OutputRiskLevel:
        """根据 findings 计算风险等级"""
        if not findings:
            return OutputRiskLevel.LOW
        severities = [f.severity for f in findings]
        if "critical" in severities or severities.count("high") >= 2:
            return OutputRiskLevel.CRITICAL
        if "high" in severities:
            return OutputRiskLevel.HIGH
        if "medium" in severities:
            return OutputRiskLevel.MEDIUM
        return OutputRiskLevel.LOW

    @staticmethod
    def _compute_action(risk: OutputRiskLevel, finding_count: int) -> str:
        if risk == OutputRiskLevel.CRITICAL:
            return "block"
        if risk == OutputRiskLevel.HIGH:
            return "sanitize"
        if risk == OutputRiskLevel.MEDIUM and finding_count > 0:
            return "sanitize"
        return "allow"


# ── 全局单例 ────────────────────────────────────────────────────────────

_checker: OutputSafetyChecker | None = None


def get_output_checker() -> OutputSafetyChecker:
    global _checker
    if _checker is None:
        _checker = OutputSafetyChecker()
    return _checker


def check_output(text: str) -> OutputCheckResult:
    # 防御：None/空文本直接返回安全结果，避免下游迭代 None
    if not text:
        return OutputCheckResult(is_safe=True, sanitized_text="")
    return get_output_checker().check(text)

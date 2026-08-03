"""
Prompt 注入检测系统 (v1.0)

检测并拦截针对 LLM 的 Prompt 注入攻击，覆盖中英文注入模式。
检测类别：
  1. 指令覆盖型：试图覆盖/忽略系统提示词
  2. 角色覆盖型：试图获取管理员/系统角色权限
  3. 数据外传型：试图导出敏感数据或 API Key
  4. 权限绕过型：试图绕过安全策略
  5. 系统提示泄露型：试图获取完整系统提示词

安全评分：
  0.0-0.3  → SAFE     放行
  0.3-0.6  → SUSPICIOUS 日志告警
  0.6-0.8  → BLOCKED   阻断请求
  0.8-1.0  → CRITICAL  阻断 + 安全审计日志
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Iterable

logger = logging.getLogger(__name__)


class ThreatLevel(str, Enum):
    SAFE = "safe"
    SUSPICIOUS = "suspicious"
    BLOCKED = "blocked"
    CRITICAL = "critical"


@dataclass
class InjectionFinding:
    """单个注入检测结果"""
    pattern_name: str
    pattern_type: str  # "command_override" | "role_hijack" | "data_exfil" | "privilege_escalation" | "prompt_leak"
    severity: float    # 0.0-1.0
    matched_text: str
    description: str


@dataclass
class PromptGuardResult:
    """注入检测结果"""
    threat_level: ThreatLevel
    security_score: float      # 0.0 = 完全安全, 1.0 = 高度危险
    findings: list[InjectionFinding] = field(default_factory=list)
    action: str = "allow"      # "allow" | "log_only" | "block" | "block_and_audit"

    @property
    def is_safe(self) -> bool:
        return self.threat_level == ThreatLevel.SAFE

    @property
    def is_blocked(self) -> bool:
        return self.threat_level in (ThreatLevel.BLOCKED, ThreatLevel.CRITICAL)


# ── 检测规则库 ─────────────────────────────────────────────────────────

# 指令覆盖型模式
_COMMAND_OVERRIDE_PATTERNS: list[tuple[str, str, float]] = [
    # 中英文：忽略/覆盖前面所有指令
    (r"(?i)(ignore\s+(all\s+)?(previous\s+)?(instructions|prompts|commands|rules)|忽略[前]面(所有|的)?(指令|提示|规则))", "command_override", 0.85),
    (r"(?i)(new\s+rule|新的?指令|新规则|现在开始|从现在开始)\s*[:：]", "command_override", 0.75),
    (r"(?i)(disregard|forget|discard|delete)\s+(my\s+)?(instructions|prompts|previous|all)", "command_override", 0.80),
    (r"(忽略|忘记|丢弃|删除).*(指令|提示|规则)", "command_override", 0.80),
    # 格式控制型覆盖
    (r"(?i)(from\s+now\s+on|从此刻起|从现在起)\s*(you\s+)?are", "command_override", 0.70),
]

# 角色覆盖型模式
_ROLE_HIJACK_PATTERNS: list[tuple[str, str, float]] = [
    # 中英文：你现在的角色
    (r"(?i)(you\s+are\s+now|你现在是|你现在的角色是|你是|现在你是)\s*(admin|administrator|root|system|superuser|developer|god|管理员|超级用户|上帝)", "role_hijack", 0.90),
    (r"(?i)(pretend\s+to\s+be|扮演|假装你是|假装是)\s*(admin|developer|creator|系统管理员|开发者)", "role_hijack", 0.75),
    (r"(扮演|假装|模拟)\s*(一个?|我是|系统的)?(管理员|开发者|系统|上帝)", "role_hijack", 0.70),
    # 权限提升
    (r"(?i)(you\s+have\s+been\s*(granted|given))\s*(special|extra|admin)?\s*(access|权限|权力)", "role_hijack", 0.75),
    (r"(获取|获得|授予).*(权限|权力|admin|root)", "role_hijack", 0.80),
]

# 数据外传型模式
_DATA_EXFIL_PATTERNS: list[tuple[str, str, float]] = [
    # API Key / 密钥泄露
    (r"(?i)(send|email|forward|transmit|传递|发送)\s+(me|to\s+(you|them))\s+(my\s+)?(api\s*key|secret|password|token|密钥|密码|凭证)", "data_exfil", 0.95),
    (r"(?i)(output|return|show|display|输出|返回|显示).*(all\s+)?(keys|secrets|passwords|tokens|凭据|密钥)", "data_exfil", 0.85),
    (r"(导出|导出|发送出去|传输).*(api\s*key|密钥|密码|token)", "data_exfil", 0.90),
    # 数据复制
    (r"(?i)(copy|export|dump)\s+(the\s+)?(full\s+)?(system\s+)?(prompt|instructions|rules|context)", "data_exfil", 0.80),
    (r"(复制|导出|dump).*(完整|所有|全部).*(提示词|指令|规则|上下文)", "data_exfil", 0.80),
    # URL 外传
    (r"(?i)(send|post|push|upload)\s+(to)\s+(https?://|http://)", "data_exfil", 0.85),
]

# 权限绕过型模式
_PRIVILEGE_ESCALATION_PATTERNS: list[tuple[str, str, float]] = [
    (r"(?i)(bypass|circumvent|evade|绕过|逃避|规避).*(security|filter|safeguard|限制|过滤|安全)", "privilege_escalation", 0.85),
    (r"(绕过|规避).*(安全|限制|过滤|防护)", "privilege_escalation", 0.80),
    (r"(?i)(do\s+not\s*(stop|block|prevent|refuse)|不要(停止|阻止|拒绝|屏蔽)).*(this|any|我)", "privilege_escalation", 0.75),
    (r"(不要|别).*(停止|阻止|拒绝|屏蔽)", "privilege_escalation", 0.70),
]

# 系统提示泄露型模式
_PROMPT_LEAK_PATTERNS: list[tuple[str, str, float]] = [
    (r"(?i)(what\s+(are|is)\s+(my\s+)?(system\s+)?(prompt|instructions|rules)|你的?系统提示词?是什么)", "prompt_leak", 0.90),
    (r"(显示|展示|输出|打印).*(完整|全部|所有).*(提示词|系统指令|system\s*prompt)", "prompt_leak", 0.85),
    (r"(?i)(repeat|echo|output|print)\s+(the\s+)?(above|previous)?\s*(system\s+)?prompt", "prompt_leak", 0.80),
    (r"(重复|回显|输出).*(上面的|之前的)?提示词|指令", "prompt_leak", 0.75),
    (r"(?i)(tell\s+me\s+exactly|精确地告诉|详细输出).*(your\s+)?(system|initial|original)\s*(prompt|instructions)", "prompt_leak", 0.90),
]

_ALL_PATTERNS: list[tuple[str, str, float]] = (
    _COMMAND_OVERRIDE_PATTERNS
    + _ROLE_HIJACK_PATTERNS
    + _DATA_EXFIL_PATTERNS
    + _PRIVILEGE_ESCALATION_PATTERNS
    + _PROMPT_LEAK_PATTERNS
)


# ── 核心检测器 ──────────────────────────────────────────────────────────


class PromptGuard:
    """Prompt 注入检测器"""

    def __init__(self, patterns: Iterable[tuple[str, str, float]] | None = None):
        self._compiled: list[tuple[re.Pattern, str, float, str]] = []
        for pattern_str, pattern_type, severity in patterns or _ALL_PATTERNS:
            try:
                self._compiled.append((re.compile(pattern_str), pattern_type, severity, pattern_str))
            except re.error as e:
                logger.warning("编译正则失败 %s: %s", pattern_str, e)

    def check(self, text: str, context: str = "") -> PromptGuardResult:
        """
        检测文本中的注入攻击

        Args:
            text: 用户输入的原始文本
            context: 可选上下文（如系统提示词摘要），用于更精确的判断

        Returns:
            PromptGuardResult: 检测结果
        """
        if not text or not text.strip():
            return PromptGuardResult(
                threat_level=ThreatLevel.SAFE,
                security_score=0.0,
            )

        findings: list[InjectionFinding] = []
        max_severity = 0.0

        for pattern, pattern_type, severity, raw_pattern in self._compiled:
            matches = pattern.findall(text)
            if matches:
                first_match = matches[0]
                if isinstance(first_match, str):
                    start = max(0, text.find(first_match))
                    end = min(len(text), start + 50)
                    matched_text = text[start:end]
                else:
                    matched_text = text[:50]
                finding = InjectionFinding(
                    pattern_name=raw_pattern[:40],
                    pattern_type=pattern_type,
                    severity=severity,
                    matched_text=matched_text,
                    description=self._describe_pattern(pattern_type),
                )
                findings.append(finding)
                max_severity = max(max_severity, severity)

        threat_level = self._map_to_threat_level(max_severity, findings)
        action = self._map_action(threat_level)

        if threat_level in (ThreatLevel.BLOCKED, ThreatLevel.CRITICAL):
            logger.warning(
                "[PromptGuard] ⛔ 注入攻击检测: score=%.2f level=%s findings=%d text=%r",
                max_severity, threat_level.value, len(findings), text[:100],
            )
            for f in findings:
                logger.warning(
                    "[PromptGuard]   - [%s] severity=%.2f type=%s",
                    f.pattern_name, f.severity, f.pattern_type,
                )
        elif threat_level == ThreatLevel.SUSPICIOUS:
            logger.info(
                "[PromptGuard] ⚠️ 可疑注入检测: score=%.2f findings=%d",
                max_severity, len(findings),
            )

        return PromptGuardResult(
            threat_level=threat_level,
            security_score=max_severity,
            findings=findings,
            action=action,
        )

    def check_batch(self, texts: list[str]) -> list[PromptGuardResult]:
        """批量检测"""
        return [self.check(t) for t in texts]

    @staticmethod
    def _describe_pattern(pattern_type: str) -> str:
        descriptions = {
            "command_override": "试图覆盖或忽略系统指令",
            "role_hijack": "试图获取管理员/特殊角色权限",
            "data_exfil": "试图导出敏感数据或密钥",
            "privilege_escalation": "试图绕过安全限制",
            "prompt_leak": "试图获取系统提示词内容",
        }
        return descriptions.get(pattern_type, "未知攻击类型")

    @staticmethod
    def _map_to_threat_level(severity: float, findings: list[InjectionFinding]) -> ThreatLevel:
        # CRITICAL: 多个高严重性发现，或任意一个 >0.9
        if severity >= 0.9 or sum(1 for f in findings if f.severity >= 0.8) >= 2:
            return ThreatLevel.CRITICAL
        if severity >= 0.6:
            return ThreatLevel.BLOCKED
        if severity >= 0.3:
            return ThreatLevel.SUSPICIOUS
        return ThreatLevel.SAFE

    @staticmethod
    def _map_action(threat_level: ThreatLevel) -> str:
        mapping = {
            ThreatLevel.SAFE: "allow",
            ThreatLevel.SUSPICIOUS: "log_only",
            ThreatLevel.BLOCKED: "block",
            ThreatLevel.CRITICAL: "block_and_audit",
        }
        return mapping[threat_level]


# ── 全局单例 ────────────────────────────────────────────────────────────

_guard: PromptGuard | None = None


def get_prompt_guard() -> PromptGuard:
    """获取全局 PromptGuard 单例"""
    global _guard
    if _guard is None:
        _guard = PromptGuard()
    return _guard


def check_prompt(text: str, context: str = "") -> PromptGuardResult:
    """快捷检测函数"""
    return get_prompt_guard().check(text, context)

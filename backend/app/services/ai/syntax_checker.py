"""RMFOOD 提示词语法检查器

基于规则和正则表达式的静态分析工具，
用于检测提示词中的常见语法问题和潜在错误。
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple


class SeverityLevel(str, Enum):
    """严重级别"""
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass
class SyntaxIssue:
    """语法问题"""
    severity: SeverityLevel
    rule_id: str
    message: str
    line_number: int = 0
    column: int = 0
    snippet: str = ""
    suggestion: str = ""


class PromptSyntaxChecker:
    """
    提示词语法检查器
    
    检测规则库（可扩展）：
    - 变量引用格式错误
    - 特殊字符转义问题
    - 引号和括号匹配
    - 常见反模式检测
    """

    # 规则定义：(pattern, severity, message, suggestion)
    RULES = [
        {
            "id": "DOUBLE_BRACES",
            "pattern": r"\{\{[^}]+\}\}",
            "severity": SeverityLevel.ERROR,
            "message": "使用双花括号{{}}而非单花括号{}",
            "suggestion": "将 {{variable}} 改为 {variable}",
        },
        {
            "id": "UNESCAPED_QUOTES",
            "pattern": r"(?<!\\)\"(?:[^\"\\]*(?:\\.[^\"\\]*)*)*?\"",
            "severity": SeverityLevel.WARNING,
            "message": "建议使用中文引号以提升可读性",
            "suggestion": "将 \"文本\" 改为 \"文本\" 或 '文本'",
        },
        {
            "id": "MIXED_VARIABLE_SYNTAX",
            "pattern": r"\$\{[\w]+\}",
            "severity": SeverityLevel.WARNING,
            "message": "混合使用了${}变量语法",
            "suggestion": "统一使用 {variable} 格式",
        },
        {
            "id": "UNCLOSED_BRACE",
            "pattern": r"[^\\]\{(?![{])",
            "severity": SeverityLevel.ERROR,
            "message": "可能存在未闭合的花括号",
            "suggestion": "检查所有花括号是否成对出现",
        },
        {
            "id": "EXCESSIVE_LINE_LENGTH",
            "pattern": r".{200,}",
            "severity": SeverityLevel.INFO,
            "message": "行长度超过200字符，建议拆分",
            "suggestion": "将长行拆分为多个短行以提高可读性",
        },
        {
            "id": "MISSING_PUNCTUATION",
            "pattern": r"[。！？]$",
            "severity": SeverityLevel.INFO,
            "message": "句子末尾缺少标点符号",
            "suggestion": "在句末添加适当的标点符号",
        },
        {
            "id": "POTENTIAL_INJECTION",
            "pattern": r"(?:eval|exec|__import__|os\.system)\s*\(",
            "severity": SeverityLevel.ERROR,
            "message": "检测到可能的代码注入风险",
            "suggestion": "移除或替换危险的函数调用",
        },
        {
            "id": "HARDCODED_SECRET",
            "pattern": r"(?:api[_-]?key|password|secret|token)\s*[=:]\s*[\"'][^\"']+[\"']",
            "severity": SeverityLevel.ERROR,
            "message": "检测到硬编码的敏感信息",
            "suggestion": "使用环境变量或配置管理工具存储密钥",
        },
        {
            "id": "AMBIGUOUS_LANGUAGE",
            "pattern": r"(?:一些|某些|适当|合理|足够|很多|少量)",
            "severity": SeverityLevel.WARNING,
            "message": "使用了模糊的量词",
            "suggestion": "使用具体的数值或明确的范围替代模糊表述",
        },
        {
            "id": "NEGATIVE_INSTRUCTION",
            "pattern": r"不要|避免|禁止|不能|不可",
            "severity": SeverityLevel.INFO,
            "message": "包含否定性指令",
            "suggestion": "考虑改用正面表述，如'建议...'而非'不要...'",
        },
    ]

    def __init__(self):
        self._compiled_rules = []
        for rule in self.RULES:
            try:
                compiled_pattern = re.compile(rule["pattern"], re.MULTILINE | re.IGNORECASE)
                self._compiled_rules.append({
                    **rule,
                    "compiled_pattern": compiled_pattern,
                })
            except re.error as e:
                print(f"⚠️ 正则表达式编译失败 [{rule['id']}]: {e}")

    def check(self, prompt_text: str) -> List[SyntaxIssue]:
        """
        执行语法检查
        
        Args:
            prompt_text: 待检查的提示词文本
            
        Returns:
            发现的问题列表
        """
        issues = []
        lines = prompt_text.split('\n')
        
        for rule in self._compiled_rules:
            pattern = rule["compiled_pattern"]
            
            for match in pattern.finditer(prompt_text):
                # 计算行列号
                line_num = prompt_text[:match.start()].count('\n') + 1
                col_num = match.start() - prompt_text.rfind('\n', 0, match.start())
                
                # 获取匹配片段（最多50字符）
                start = max(0, match.start() - 20)
                end = min(len(prompt_text), match.end() + 20)
                snippet = prompt_text[start:end]
                
                issue = SyntaxIssue(
                    severity=rule["severity"],
                    rule_id=rule["id"],
                    message=rule["message"],
                    line_number=line_num,
                    column=col_num,
                    snippet=snippet.replace('\n', ' '),
                    suggestion=rule["suggestion"],
                )
                
                issues.append(issue)
        
        # 额外检查：括号配对
        brace_issues = self._check_brace_balance(prompt_text)
        issues.extend(brace_issues)
        
        return issues

    def _check_brace_balance(self, text: str) -> List[SyntaxIssue]:
        """检查括号配对"""
        issues = []
        
        stack = []
        for i, char in enumerate(text):
            if char == '{':
                stack.append(('brace', i))
            elif char == '}':
                if stack and stack[-1][0] == 'brace':
                    stack.pop()
                else:
                    line_num = text[:i].count('\n') + 1
                    issues.append(SyntaxIssue(
                        severity=SeverityLevel.ERROR,
                        rule_id="UNBALANCED_BRACE",
                        message="多余的反花括号",
                        line_number=line_num,
                        column=i,
                        snippet=text[max(0,i-10):i+10],
                        suggestion="删除多余的反花括号或添加对应的开括号",
                    ))
        
        if stack:
            for _, pos in stack:
                line_num = text[:pos].count('\n') + 1
                issues.append(SyntaxIssue(
                    severity=SeverityLevel.ERROR,
                    rule_id="UNBALANCED_BRACE",
                    message="未闭合的花括号",
                    line_number=line_num,
                    column=pos,
                    snippet=text[max(0,pos-10):pos+10],
                    suggestion="添加对应的闭合花括号",
                ))
        
        return issues

    def get_statistics(self, issues: List[SyntaxIssue]) -> Dict[str, int]:
        """获取问题统计"""
        stats = {
            "total": len(issues),
            "errors": sum(1 for i in issues if i.severity == SeverityLevel.ERROR),
            "warnings": sum(1 for i in issues if i.severity == SeverityLevel.WARNING),
            "infos": sum(1 for i in issues if i.severity == SeverityLevel.INFO),
        }
        return stats

    def get_quick_fixes(self, issues: List[SyntaxIssue], original_text: str) -> str:
        """应用自动修复（仅对简单规则有效）"""
        fixed_text = original_text
        
        for issue in issues:
            if issue.rule_id == "DOUBLE_BRACES":
                fixed_text = re.sub(r'\{\{([^}]+)\}\}', r'{\1}', fixed_text)
        
        return fixed_text

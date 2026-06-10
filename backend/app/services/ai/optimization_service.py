"""RMFOOD 质量优化器

整合语法检查、结构分析和效果预测，
提供完整的提示词质量优化服务。
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from .provider_factory import get_provider_factory, TaskType
from .syntax_checker import PromptSyntaxChecker, SyntaxIssue, SeverityLevel
from .structure_analyzer import PromptStructureAnalyzer, StructureReport
from .effectiveness_predictor import EffectivenessPredictor, EffectivenessPrediction
from ...schemas.ai_schemas import OptimizationLevel

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent / "prompts"


class IssueSeverity(str, Enum):
    """问题严重级别"""
    CRITICAL = "critical"
    MAJOR = "major"
    MINOR = "minor"
    SUGGESTION = "suggestion"


@dataclass
class OptimizationSuggestion:
    """优化建议"""
    id: str
    severity: IssueSeverity
    category: str  # syntax / structure / effectiveness / llm_suggestion
    title: str
    description: str
    location: str = ""
    before: str = ""
    after: str = ""
    impact_estimate: str = ""  # 预期提升
    is_auto_fixable: bool = False


@dataclass
class AIOptimizationResult:
    """优化结果"""
    original_content: str
    optimized_content: Optional[str] = None
    
    # 分析报告
    syntax_issues: List[SyntaxIssue] = field(default_factory=list)
    structure_report: Optional[StructureReport] = None
    effectiveness_prediction: Optional[EffectivenessPrediction] = None
    
    # 优化建议
    suggestions: List[OptimizationSuggestion] = field(default_factory=list)
    
    # 统计信息
    overall_score_before: float = 0.0
    overall_score_after: float = 0.0
    score_improvement: float = 0.0
    
    # 元数据
    optimization_level: OptimizationLevel = OptimizationLevel.ADVANCED
    processing_time_ms: float = 0.0
    tokens_used: int = 0


class AIOptimizationService:
    """
    AI质量优化器
    
    完整的优化流程：
    Step 1: 语法检查 (SyntaxChecker)
    Step 2: 结构分析 (StructureAnalyzer)
    Step 3: 效果预测 (EffectivenessPredictor)
    Step 4: LLM智能优化（可选）
    Step 5: 结果整合与排序
    """

    def __init__(self):
        self.provider_factory = get_provider_factory()
        
        # 初始化子模块
        self.syntax_checker = PromptSyntaxChecker()
        self.structure_analyzer = PromptStructureAnalyzer()
        self.effectiveness_predictor = EffectivenessPredictor()
        
        self._system_prompt_cache: Dict[str, str] = {}

    async def optimize_prompt(
        self,
        draft_prompt: str,
        level: OptimizationLevel = OptimizationLevel.ADVANCED,
        goals: Optional[List[str]] = None,
    ) -> AIOptimizationResult:
        """
        执行完整的提示词优化
        
        Args:
            draft_prompt: 待优化的原始提示词
            level: 优化级别 (basic/advanced/expert)
            goals: 可选，指定优化目标
            
        Returns:
            AIOptimizationResult 完整的优化报告
        """
        start_time = time.time()
        
        logger.info(f"🔧 开始优化 - 级别: {level.value}, 长度: {len(draft_prompt)}字符")
        
        result = AIOptimizationResult(
            original_content=draft_prompt,
            optimization_level=level,
        )
        
        # Step 1: 语法检查
        logger.info("   [1/5] 执行语法检查...")
        result.syntax_issues = self.syntax_checker.check(draft_prompt)
        syntax_stats = self.syntax_checker.get_statistics(result.syntax_issues)
        logger.info(f"       发现 {syntax_stats['total']} 个问题 "
                   f"({syntax_stats['errors']}错误, {syntax_stats['warnings']}警告)")
        
        # Step 2: 结构分析
        logger.info("   [2/5] 执行结构分析...")
        result.structure_report = self.structure_analyzer.analyze(draft_prompt)
        logger.info(f"       结构得分: {result.structure_report.overall_score:.1f}")
        
        # Step 3: 效果预测
        logger.info("   [3/5] 执行效果预测...")
        result.effectiveness_prediction = self.effectiveness_predictor.predict(draft_prompt)
        result.overall_score_before = result.effectiveness_prediction.score
        logger.info(f"       效果得分: {result.overall_score_before:.1f}")
        
        # Step 4: 根据级别决定是否调用LLM
        if level in [OptimizationLevel.ADVANCED, OptimizationLevel.EXPERT]:
            logger.info("   [4/5] LLM智能分析...")
            llm_suggestions = await self._get_llm_optimization_suggestions(
                draft_prompt, result, goals
            )
            result.suggestions.extend(llm_suggestions)
            
            # Expert级别：生成完整优化版本
            if level == OptimizationLevel.EXPERT:
                logger.info("   [5/5] 生成优化版本...")
                result.optimized_content = await self._generate_optimized_version(
                    draft_prompt, result.suggestions
                )
        else:
            # Basic级别：仅基于规则
            logger.info("   [4-5/5] 基于规则生成建议...")
        
        # 整合所有建议
        if not result.suggestions:
            result.suggestions = self._generate_rule_based_suggestions(result)
        
        # 按严重程度排序
        result.suggestions.sort(
            key=lambda s: list(IssueSeverity).index(s.severity) 
                            if isinstance(s.severity, IssueSeverity) else 0
        )
        
        # 计算预期提升
        result.score_improvement = self._estimate_improvement(result)
        result.overall_score_after = min(
            100, result.overall_score_before + result.score_improvement
        )
        
        result.processing_time_ms = (time.time() - start_time) * 1000
        
        logger.info(
            f"✅ 优化完成 - 原始分: {result.overall_score_before:.1f}, "
            f"优化后预估: {result.overall_score_after:.1f} "
            f"(+{result.score_improvement:.1f}), "
            f"耗时: {result.processing_time_ms:.0f}ms"
        )
        
        return result

    async def apply_fixes(
        self,
        prompt: str,
        suggestions: List[OptimizationSuggestion],
    ) -> str:
        """
        一键应用所有修复
        
        Args:
            prompt: 原始提示词
            suggestions: 要应用的修复建议列表
            
        Returns:
            修复后的最终版本
        """
        fixed_text = prompt
        
        # 按位置排序（从后往前修改避免偏移）
        sorted_suggestions = sorted(
            [s for s in suggestions if s.is_auto_fixable],
            key=lambda s: len(s.before),
            reverse=True,
        )
        
        applied_count = 0
        for suggestion in sorted_suggestions:
            if suggestion.before and suggestion.after:
                if suggestion.before in fixed_text:
                    fixed_text = fixed_text.replace(
                        suggestion.before, 
                        suggestion.after, 
                        1
                    )
                    applied_count += 1
                    logger.info(f"   ✓ 应用了修复: {suggestion.title}")
        
        logger.info(f"共应用了 {applied_count}/{len(sorted_suggestions)} 个自动修复")
        
        return fixed_text

    async def _get_llm_optimization_suggestions(
        self,
        draft_prompt: str,
        current_result: AIOptimizationResult,
        goals: Optional[List[str]],
    ) -> List[OptimizationSuggestion]:
        """调用LLM获取智能优化建议"""
        system_prompt = self._load_system_prompt("optimize_prompt.txt")
        
        # 构建上下文信息
        context_info = f"""## 当前提示词
{draft_prompt}

## 已检测到的问题
### 语法问题 ({len(current_result.syntax_issues)}个)
{chr(10).join(f'- [{i.severity.value}] {i.message}' for i in current_result.syntax_issues[:5])}

### 结构分析 (得分: {current_result.structure_report.overall_score if current_result.structure_report else 'N/A'})
{'; '.join(current_result.structure_report.weaknesses[:3]) if current_result.structure_report else ''}

### 效果预测 (得分: {current_result.effectiveness_prediction.score if current_result.effectiveness_prediction else 'N/A'})
劣势: {', '.join(current_result.effectiveness_prediction.weaknesses[:3]) if current_result.effectiveness_prediction else 'N/A'}

## 用户指定的优化目标
{', '.join(goals) if goals else '无特定目标'}

---

请分析以上提示词并给出具体的优化建议。"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": context_info},
        ]
        
        try:
            response = await self.provider_factory.call_with_fallback(
                messages,
                task_type=TaskType.OPTIMIZE,
                temperature=0.4,  # 低温度以获得稳定输出
            )
            
            # 解析LLM响应
            suggestions = self._parse_llm_optimization_response(response)
            
            return suggestions
            
        except Exception as e:
            logger.warning(f"⚠️ LLM优化建议获取失败，回退到规则: {e}")
            return []

    async def _generate_optimized_version(
        self,
        original_prompt: str,
        suggestions: List[OptimizationSuggestion],
    ) -> str:
        """生成完整优化版本"""
        system_prompt = self._load_system_prompt("optimize_prompt.txt")
        
        summary = "\n".join(
            f"- [{s.severity.value}] {s.title}: {s.description}"
            for s in suggestions[:10]
        )
        
        instruction = f"""基于以下优化建议，生成完整的优化后版本。

## 原始提示词
{original_prompt}

## 优化建议汇总
{summary}

## 要求
1. 保持原意和核心意图不变
2. 融合所有合理的改进建议
3. 输出完整、可直接使用的优化后提示词
4. 如果某些建议冲突，选择最合理的方案"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": instruction},
        ]
        
        try:
            optimized = await self.provider_factory.call_with_fallback(
                messages,
                task_type=TaskType.OPTIMIZE,
                temperature=0.5,
            )
            
            return optimized
            
        except Exception as e:
            logger.error(f"❌ 生成优化版本失败: {e}")
            return None

    def _generate_rule_based_suggestions(
        self,
        result: AIOptimizationResult,
    ) -> List[OptimizationSuggestion]:
        """基于规则生成优化建议（当LLM不可用时）"""
        suggestions = []
        
        # 从语法问题转换
        for issue in result.syntax_issues[:10]:
            severity_map = {
                SeverityLevel.ERROR: IssueSeverity.MAJOR,
                SeverityLevel.WARNING: IssueSeverity.MINOR,
                SeverityLevel.INFO: IssueSeverity.SUGGESTION,
            }
            
            suggestions.append(OptimizationSuggestion(
                id=f"syntax_{issue.rule_id}",
                severity=severity_map.get(issue.severity, IssueSeverity.MINOR),
                category="syntax",
                title=issue.message,
                description=issue.suggestion,
                location=f"第{issue.line_number}行",
                before=issue.snippet,
                after="",
                is_auto_fixable=(issue.rule_id == "DOUBLE_BRACES"),
            ))
        
        # 从结构分析转换
        if result.structure_report:
            for weakness in result.structure_report.weaknesses[:5]:
                suggestions.append(OptimizationSuggestion(
                    id=f"struct_{len(suggestions)}",
                    severity=IssueSeverity.MAJOR,
                    category="structure",
                    title="结构不完整",
                    description=weakness,
                    is_auto_fixable=False,
                ))
        
        return suggestions

    def _parse_llm_optimization_response(
        self, 
        response: str
    ) -> List[OptimizationSuggestion]:
        """解析LLM返回的优化建议"""
        suggestions = []
        
        try:
            data = json.loads(response)
            issues = data.get("issues", [])
            
            for i, issue in enumerate(issues):
                severity_map = {
                    "high": IssueSeverity.CRITICAL,
                    "medium": IssueSeverity.MAJOR,
                    "low": IssueSeverity.MINOR,
                }
                
                suggestions.append(OptimizationSuggestion(
                    id=f"llm_{i}",
                    severity=severity_map.get(
                        issue.get("severity", "low"), 
                        IssueSeverity.SUGGESTION
                    ),
                    category="llm_suggestion",
                    title=issue.get("description", "")[:50],
                    description=issue.get("suggestion", ""),
                    location=issue.get("location", ""),
                    before=issue.get("before", ""),
                    after=issue.get("after", ""),
                    impact_estimate=issue.get("impact_estimate", ""),
                    is_auto_fixable=bool(issue.get("after")),
                ))
                
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning(f"解析LLM响应失败: {e}")
            
        return suggestions

    def _estimate_improvement(self, result: AIOptimizationResult) -> float:
        """估算优化后的提升幅度"""
        improvement = 0.0
        
        # 语法问题修复带来的提升
        error_count = sum(
            1 for i in result.syntax_issues 
            if i.severity == SeverityLevel.ERROR
        )
        improvement += min(error_count * 3, 15)
        
        # 结构完善带来的提升
        if result.structure_report:
            missing_sections = sum(
                1 for s in ["role", "task", "constraints", "examples"]
                if not result.structure_report.sections.get(s, 
                       type('obj', (object,), {'is_present': False})()).is_present
            )
            improvement += missing_sections * 5
        
        # 建议数量带来的潜在提升
        major_suggestions = sum(
            1 for s in result.suggestions
            if s.severity in [IssueSeverity.CRITICAL, IssueSeverity.MAJOR]
        )
        improvement += major_suggestions * 2
        
        return min(improvement, 40)  # 最大提升40分

    def _load_system_prompt(self, filename: str) -> str:
        """加载System Prompt模板（带缓存）"""
        if filename in self._system_prompt_cache:
            return self._system_prompt_cache[filename]
            
        file_path = PROMPTS_DIR / filename
        if not file_path.exists():
            return "你是一个有帮助的AI助手。"
            
        content = file_path.read_text(encoding="utf-8")
        self._system_prompt_cache[filename] = content
        
        return content


# 全局单例
_optimization_service_instance: Optional[AIOptimizationService] = None


def get_optimization_service() -> AIOptimizationService:
    """获取全局优化服务实例"""
    global _optimization_service_instance
    
    if _optimization_service_instance is None:
        _optimization_service_instance = AIOptimizationService()
        logger.info("🔧 全局AIOptimizationService已初始化")
        
    return _optimization_service_instance

"""RMFOOD 提示词结构分析器

评估提示词的结构合理性：
- 四要素完整性检查
- 段落组织逻辑评估
- 信息密度分析
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class StructureScore(Enum):
    """结构评分等级"""
    EXCELLENT = "excellent"
    GOOD = "good"
    AVERAGE = "average"
    POOR = "poor"
    MISSING = "missing"


@dataclass
class SectionInfo:
    """段落信息"""
    name: str
    is_present: bool
    position: int = -1  # 出现位置（段落数）
    length: int = 0
    quality_score: float = 0.0  # 该段落的质量分 (0-1)


@dataclass
class StructureReport:
    """结构分析报告"""
    overall_score: float  # 0-100
    sections: Dict[str, SectionInfo] = field(default_factory=dict)
    strengths: List[str] = field(default_factory=list)
    weaknesses: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    structure_type: str = "unknown"  # structured / semi_structured / freeform


class PromptStructureAnalyzer:
    """
    结构分析器
    
    基于启发式规则评估提示词结构：
    - 必需章节检测
    - 信息流逻辑分析
    - 密度和复杂度评估
    """

    REQUIRED_SECTIONS = ["role", "task", "constraints", "examples"]
    
    SECTION_PATTERNS = {
        "role": [
            r'(?:角色|你是一个|你是|作为|扮演)[：:\s]',
            r'(?:role|you are|act as|persona)',
            r'(?:专家|顾问|工程师|分析师|设计师)',
        ],
        "task": [
            r'(?:任务|目标|目的|需要|请)[：:\s]',
            r'(?:task|goal|objective|your job)',
            r'(?:生成|创建|分析|设计|优化|撰写)',
        ],
        "constraints": [
            r'(?:约束|限制|要求|必须|不得|注意)[：:\s]',
            r'(?:constraint|requirement|must|should not)',
            r'(?:遵守|符合|遵循|确保)',
        ],
        "examples": [
            r'(?:示例|例子|例如|比如|案例)[：:\s]',
            r'(?:example|for instance|sample)',
            r'(?:input.*?output|输入.*?输出)',
        ],
        "output_format": [
            r'(?:输出格式|格式要求|返回)[：:\s]',
            r'(?:output format|format|return)',
            r'(?:json|markdown|table|列表)',
        ],
    }

    def analyze(self, prompt_text: str) -> StructureReport:
        """
        执行结构分析
        
        Args:
            prompt_text: 待分析的提示词
            
        Returns:
            StructureReport 完整的分析报告
        """
        sections = {}
        
        # 检测各章节
        for section_name, patterns in self.SECTION_PATTERNS.items():
            section_info = self._detect_section(prompt_text, section_name, patterns)
            sections[section_name] = section_info
        
        # 计算总体得分
        overall_score = self._calculate_overall_score(sections)
        
        # 识别优缺点
        strengths, weaknesses = self._identify_strengths_weaknesses(sections)
        
        # 生成建议
        suggestions = self._generate_suggestions(sections)
        
        # 判断结构类型
        structure_type = self._classify_structure_type(sections)
        
        return StructureReport(
            overall_score=overall_score,
            sections=sections,
            strengths=strengths,
            weaknesses=weaknesses,
            suggestions=suggestions,
            structure_type=structure_type,
        )

    def _detect_section(
        self,
        text: str,
        section_name: str,
        patterns: List[str],
    ) -> SectionInfo:
        """检测特定章节是否存在及位置"""
        is_present = False
        position = -1
        best_match_length = 0
        
        paragraphs = text.split('\n\n')
        
        for i, para in enumerate(paragraphs):
            for pattern in patterns:
                match = re.search(pattern, para, re.IGNORECASE | re.MULTILINE)
                if match:
                    is_present = True
                    if position == -1:
                        position = i
                    if len(para) > best_match_length:
                        best_match_length = len(para)
        
        quality = min(best_match_length / 100.0, 1.0) if is_present else 0.0
        
        return SectionInfo(
            name=section_name,
            is_present=is_present,
            position=position,
            length=best_match_length,
            quality_score=quality,
        )

    def _calculate_overall_score(self, sections: Dict[str, SectionInfo]) -> float:
        """计算总体结构分数"""
        base_score = 40.0  # 基础分
        
        # 必需章节权重
        required_weights = {
            "role": 15,
            "task": 20,
            "constraints": 15,
            "examples": 10,
        }
        
        for section_name, weight in required_weights.items():
            section = sections.get(section_name)
            if section and section.is_present:
                base_score += weight * section.quality_score
        
        # 可选章节加分
        optional_section = sections.get("output_format")
        if optional_section and optional_section.is_present:
            base_score += 10 * optional_section.quality_score
        
        return min(base_score, 100.0)

    def _identify_strengths_weaknesses(
        self,
        sections: Dict[str, SectionInfo],
    ) -> tuple:
        """识别优点和不足"""
        strengths = []
        weaknesses = []
        
        # 检查必需章节
        required_present = sum(
            1 for s in self.REQUIRED_SECTIONS 
            if sections.get(s, SectionInfo(s)).is_present
        )
        
        if required_present == len(self.REQUIRED_SECTIONS):
            strengths.append("✅ 所有必需章节齐全")
        elif required_present >= 3:
            strengths.append(f"✅ 大部分必需章节已包含 ({required_present}/{len(self.REQUIRED_SECTIONS)})")
        else:
            weaknesses.append(f"❌ 缺少关键章节（仅有{required_present}/{len(self.REQUIRED_SECTIONS)}）")
        
        # 具体章节评价
        for section_name in self.REQUIRED_SECTIONS:
            section = sections.get(section_name)
            if not section:
                continue
                
            if section.is_present:
                if section.quality_score > 0.8:
                    strengths.append(
                        f"✅ {section_name}章节内容丰富详细"
                    )
                elif section.quality_score < 0.3:
                    weaknesses.append(
                        f"⚠️ {section_name}章节内容过于简略"
                    )
            else:
                weaknesses.append(
                    f"❌ 缺少{section_name}章节"
                )
        
        return strengths, weaknesses

    def _generate_suggestions(self, sections: Dict[str, SectionInfo]) -> List[str]:
        """生成改进建议"""
        suggestions = []
        
        for section_name in self.REQUIRED_SECTIONS:
            section = sections.get(section_name)
            
            if not section or not section.is_present:
                if section_name == "role":
                    suggestions.append(
                        "添加清晰的角色定义，如'你是拥有X年经验的Y领域专家'"
                    )
                elif section_name == "task":
                    suggestions.append(
                        "明确描述具体任务，包括输入、处理步骤和期望输出"
                    )
                elif section_name == "constraints":
                    suggestions.append(
                        "添加约束条件，如字数限制、格式要求、安全边界等"
                    )
                elif section_name == "examples":
                    suggestions.append(
                        "提供2-3个Few-shot示例以提升输出一致性"
                    )
            elif section and section.quality_score < 0.5:
                suggestions.append(
                    f"扩充{section_name}章节的内容，增加更多细节和说明"
                )
        
        return suggestions

    def _classify_structure_type(
        self,
        sections: Dict[str, SectionInfo],
    ) -> str:
        """分类结构类型"""
        present_count = sum(
            1 for s in sections.values() if s.is_present
        )
        
        total_sections = len(sections)
        ratio = present_count / total_sections if total_sections > 0 else 0
        
        if ratio >= 0.8:
            return "structured"
        elif ratio >= 0.5:
            return "semi_structured"
        else:
            return "freeform"

    def get_structure_template(self, structure_type: str) -> str:
        """获取推荐的结构模板"""
        templates = {
            "structured": """# [角色定义]
你是[具体职位]，拥有[X年经验]，专精于[专业领域]。

# [核心任务]
你的任务是[具体描述]。
## 步骤
1. [步骤1]
2. [步骤2]

# [约束条件]
- [约束1]
- [约束2]

# [输出格式]
[JSON/Markdown/Table格式示例]

# [示例]
**输入**: [示例输入]
**输出**: [示例输出]""",
            
            "semi_structured": """[角色定义]

[任务描述]

主要要求：
- [要求1]
- [要求2]

示例：
[1-2个简短示例]""",
            
            "freeform": """[自由形式提示词，建议至少包含：角色、任务、期望输出]""",
        }
        
        return templates.get(structure_type, templates["structured"])

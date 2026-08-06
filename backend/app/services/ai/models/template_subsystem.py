"""模板子系统 — 经典方剂作为生成先验

功能：
1. PRE_FILL: 用模板基序列预填充生成器的部分输出
2. CONDITIONAL_INSERT: 根据生成过程中的条件，动态插入模板成分
3. CONSTRAINT_GUIDE: 将模板的君臣佐使结构作为软约束引导生成
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class FormulaTemplate:
    """经典方剂模板"""
    name: str                           # 模板名称
    base_sequence: List[str]            # 基序列（成分 ID 列表）
    role_mapping: Dict[str, str] = None # 成分→角色映射
    description: str = ""               # 描述
    effect_keywords: List[str] = None   # 功效关键词（用于匹配）

    def __post_init__(self):
        if self.role_mapping is None:
            self.role_mapping = self._default_role_mapping()
        if self.effect_keywords is None:
            self.effect_keywords = []

    def _default_role_mapping(self) -> Dict[str, str]:
        """默认角色映射：前1位君，接下来2位臣，其余佐使"""
        roles = ["君", "臣", "臣", "佐", "佐", "使"]
        return {
            herb: roles[i] if i < len(roles) else "佐"
            for i, herb in enumerate(self.base_sequence)
        }


class TemplateSubsystem:
    """
    经典方剂模板子系统

    工作模式：
    1. PRE_FILL: 用模板基序列预填充生成器的部分输出
    2. CONDITIONAL_INSERT: 根据生成过程中的条件，动态插入模板成分
    3. CONSTRAINT_GUIDE: 将模板的君臣佐使结构作为软约束引导生成
    """

    # 经典方剂模板库
    _TEMPLATES: Dict[str, FormulaTemplate] = {
        "四君子汤": FormulaTemplate(
            name="四君子汤",
            base_sequence=["ds", "bq", "gq", "dcx"],
            description="益气健脾基础方，用于脾胃气虚证",
            effect_keywords=["补气", "健脾", "消化系统"],
        ),
        "六味地黄丸": FormulaTemplate(
            name="六味地黄丸",
            base_sequence=["shd", "sfz", "swd", "ms", "zgy", "fu_ling"],
            description="滋阴补肾基础方",
            effect_keywords=["补肾", "养血"],
        ),
        "桂枝汤": FormulaTemplate(
            name="桂枝汤",
            base_sequence=["gz", "shd", "gq", "dcx", "sj"],
            description="解表调营卫",
            effect_keywords=["解表", "补气"],
        ),
        "逍遥散": FormulaTemplate(
            name="逍遥散",
            base_sequence=["chaihu", "dg", "bz", "fp", "gq", "mj", "sj", "mg"],
            description="疏肝健脾调经",
            effect_keywords=["理气", "养血", "安神"],
        ),
        "银翘散": FormulaTemplate(
            name="银翘散",
            base_sequence=["jinhua", "niubang", "jgh", "bohe", "dandufan", "lvgan", "yangjin", "tangsu"],
            description="清热解毒解表",
            effect_keywords=["清热", "解毒", "解表"],
        ),
        "补中益气汤": FormulaTemplate(
            name="补中益气汤",
            base_sequence=["hq", "ds", "gz", "chenpi", "shengma", "chaihu", "gq"],
            description="补中益气，升阳举陷",
            effect_keywords=["补气", "免疫调节"],
        ),
        "桃红四物汤": FormulaTemplate(
            name="桃红四物汤",
            base_sequence=["dg", "cx", "ts", "th", "gq"],
            description="养血活血",
            effect_keywords=["养血", "活血化瘀"],
        ),
        "当归补血汤": FormulaTemplate(
            name="当归补血汤",
            base_sequence=["hqg", "dg"],
            description="补气生血",
            effect_keywords=["补气", "养血"],
        ),
    }

    def __init__(
        self,
        templates: Optional[Dict[str, FormulaTemplate]] = None,
    ):
        self._templates = templates or dict(self._TEMPLATES)

    def select_template(
        self,
        target_effects: List[str],
        preference: Optional[str] = None,
    ) -> Optional[FormulaTemplate]:
        """
        根据目标功效选择最合适的经典方剂模板

        Returns:
            匹配的模板，未匹配时返回 None
        """
        if preference and preference in self._templates:
            return self._templates[preference]

        best_match = None
        best_score = 0.0

        for name, template in self._templates.items():
            score = self._match_score(template, target_effects)
            if score > best_score:
                best_score = score
                best_match = template

        return best_match if best_score > 0.3 else None

    def apply_template(
        self,
        formula: Dict[str, float],
        template: Optional[FormulaTemplate],
        mode: str = "pre_fill",
    ) -> Dict[str, float]:
        """
        将模板应用于配方

        Args:
            formula: 原始配方 {herb_id: dosage}
            template: 模板
            mode: "pre_fill" | "constraint_guide"

        Returns:
            应用模板后的配方
        """
        if template is None:
            return formula

        if mode == "pre_fill":
            return self._pre_fill(formula, template)
        elif mode == "constraint_guide":
            return self._constraint_guide(formula, template)
        return formula

    def _pre_fill(
        self, formula: Dict[str, float], template: FormulaTemplate
    ) -> Dict[str, float]:
        """预填充：确保模板成分在配方中"""
        filled = dict(formula)
        for herb_id in template.base_sequence:
            if herb_id not in filled:
                filled[herb_id] = 6.0
        return filled

    def _constraint_guide(
        self, formula: Dict[str, float], template: FormulaTemplate
    ) -> Dict[str, float]:
        """结构引导：调整用量以匹配模板的君臣佐使结构"""
        role_mapping = template.role_mapping
        guided = dict(formula)

        # 君药用量最高
        jun_herbs = [h for h, r in role_mapping.items() if r == "君"]
        if jun_herbs:
            for h in jun_herbs:
                if h in guided:
                    guided[h] = max(guided[h], 10.0)

        # 臣药次之
        chen_herbs = [h for h, r in role_mapping.items() if r == "臣"]
        for h in chen_herbs:
            if h in guided:
                guided[h] = max(guided[h], 6.0)

        return guided

    def _match_score(
        self, template: FormulaTemplate, target_effects: List[str]
    ) -> float:
        """计算模板与目标功效的匹配度"""
        if not target_effects:
            return 0.0

        score = 0.0
        for effect in target_effects:
            for keyword in template.effect_keywords:
                if effect in keyword or keyword in effect:
                    score += 1.0
                    break
            if any(e in effect for e in template.effect_keywords):
                score += 0.5

        return min(1.0, score / max(len(target_effects), 1))

    def get_template_sequence(self, template_name: str) -> List[str]:
        """获取模板的基序列"""
        template = self._templates.get(template_name)
        return template.base_sequence if template else []

    def list_templates(self) -> List[str]:
        """列出所有可用模板"""
        return list(self._templates.keys())

    def get_all_templates(self) -> Dict[str, FormulaTemplate]:
        return dict(self._templates)


# 全局单例
_template_subsystem: Optional[TemplateSubsystem] = None


def get_template_subsystem() -> TemplateSubsystem:
    global _template_subsystem
    if _template_subsystem is None:
        _template_subsystem = TemplateSubsystem()
    return _template_subsystem

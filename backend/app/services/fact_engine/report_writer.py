"""
AIReportWriter — AI 叙述生成层
对标 FormLab 的 "4 tone" 报告风格

设计理念：
  - FactEngine 产出确定性事实（数字、状态、结论）
  - AIReportWriter 将事实转化为人类可读的叙述文本
  - 支持 4 种语调：Technical（技术报告）、Marketing（营销文案）、
    Clinical（临床可信）、Consumer（通俗易懂）

调用方式：
    facts = fact_engine.generate_fact_bundle(...)
    writer = AIReportWriter(model="deepseek-chat")
    report = writer.write(facts, tone="technical")
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════
# 数据类
# ═══════════════════════════════════════════

@dataclass
class SectionBlock:
    """报告章节块"""
    title: str
    content: str
    subsections: List["SectionBlock"] = None

    def __post_init__(self):
        if self.subsections is None:
            self.subsections = []


@dataclass
class ReportBundle:
    """报告包"""
    tone: str
    formula_name: str
    sections: List[SectionBlock]
    generated_at: datetime
    facts_summary: Dict[str, Any]
    raw_facts: Dict[str, Any]

    def to_markdown(self) -> str:
        lines = [
            f"# {self.formula_name} — {self._tone_label()}",
            f"\n**生成时间**: {self.generated_at.strftime('%Y-%m-%d %H:%M:%S')}\n",
            "---\n",
        ]
        for section in self.sections:
            lines.append(self._render_section(section, depth=1))
        return "\n".join(lines)

    def to_dict(self) -> dict:
        return {
            "tone": self.tone,
            "formula_name": self.formula_name,
            "sections": [
                {"title": s.title, "content": s.content, "subsections": [
                    {"title": sub.title, "content": sub.content}
                    for sub in s.subsections
                ]}
                for s in self.sections
            ],
            "generated_at": self.generated_at.isoformat(),
            "facts_summary": self.facts_summary,
        }

    def _tone_label(self) -> str:
        labels = {
            "technical": "技术报告",
            "marketing": "市场文案",
            "clinical": "临床可信报告",
            "consumer": "消费者指南",
        }
        return labels.get(self.tone, self.tone)

    def _render_section(self, section: SectionBlock, depth: int = 1) -> str:
        indent = "#" * depth
        lines = [f"{indent} {section.title}", f"\n{section.content}", ""]
        for sub in section.subsections:
            lines.append(self._render_section(sub, depth + 1))
        return "\n".join(lines)


# ═══════════════════════════════════════════
# Tone 模板系统（确定性部分）
# ═══════════════════════════════════════════

TONE_TEMPLATES: Dict[str, Dict[str, str]] = {
    "technical": {
        "header": "【技术报告】",
        "cost_intro": "成本分析基于实际原料价格与目标批次产量计算。",
        "compliance_intro": "合规性依据 GB 16740-2014《食品安全国家标准 保健食品》及药食同源目录（2025版）判定。",
        "allergen_intro": "过敏原检测基于中国食品安全国家标准规定的致敏物质清单。",
        "summary_template": (
            "### 执行摘要\n\n"
            "- **配方名称**: {formula_name}\n"
            "- **批次产量**: {batch_size_kg} kg\n"
            "- **单位成本**: ¥{cost_per_kg}/kg\n"
            "- **合规状态**: {compliance_status}\n"
            "- **过敏原**: {allergen_status}\n"
            "- **异常项**: {anomaly_count} 项\n"
        ),
    },
    "marketing": {
        "header": "【产品价值说明】",
        "cost_intro": "我们精心筛选每一味原料，确保品质与性价比兼备。",
        "compliance_intro": "本产品严格遵循国家食品安全标准，让您安心享用。",
        "allergen_intro": "过敏体质人群请注意查看成分表。",
        "summary_template": (
            "### 产品亮点\n\n"
            "✨ **精选配方** — {formula_name}\n"
            "💰 **品质保证** — 每kg成本仅¥{cost_per_kg}\n"
            "✅ **合规认证** — {compliance_status}\n"
            "🛡️ **安全无忧** — {allergen_status}\n"
        ),
    },
    "clinical": {
        "header": "【临床研究参考】",
        "cost_intro": "成本数据供卫生经济学评估参考。",
        "compliance_intro": "本评估参照《保健食品原料目录》及相关法律法规进行。",
        "allergen_intro": "特殊人群（孕妇、儿童、过敏体质者）使用前请咨询专业医师。",
        "summary_template": (
            "### 临床适用性评估\n\n"
            "**受试配方**: {formula_name}\n"
            "**单次剂量范围**: 依据配方设计\n"
            "**经济性评估**: ¥{cost_per_kg}/kg\n"
            "**安全性评级**: {safety_rating}\n"
            "**异常检测**: {anomaly_status}\n"
        ),
    },
    "consumer": {
        "header": "【消费者须知】",
        "cost_intro": "我们坚持透明定价，让您了解每一分钱的去向。",
        "compliance_intro": "我们的产品符合国家食品安全标准，请放心使用。",
        "allergen_intro": "如果您对以下食物过敏，请仔细阅读成分表。",
        "summary_template": (
            "### 您需要了解的信息\n\n"
            "🍵 **产品名称**: {formula_name}\n"
            "💵 **参考价格**: 约¥{cost_per_kg}/份\n"
            "✅ **安全合规**: {compliance_status}\n"
            "⚠️ **注意事项**: {allergen_status}\n"
        ),
    },
}


# ═══════════════════════════════════════════
# AIReportWriter 主类
# ═══════════════════════════════════════════

class AIReportWriter:
    """
    AI 报告叙述生成器

    接收 FactEngine 产出的确定性事实，
    转换为 4 种不同语调的可读报告。
    """

    def __init__(
        self,
        llm_client: Optional[Any] = None,
        custom_templates: Optional[Dict[str, Dict[str, str]]] = None,
    ):
        self.llm_client = llm_client
        self.templates = {**TONE_TEMPLATES, **(custom_templates or {})}

    def write(
        self,
        facts: Dict[str, Any],
        tone: str = "technical",
        extra_context: Optional[Dict[str, Any]] = None,
    ) -> ReportBundle:
        """
        生成报告

        Args:
            facts: FactEngine.generate_fact_bundle() 的输出
            tone: "technical" | "marketing" | "clinical" | "consumer"
            extra_context: 额外上下文（如目标人群、用途等）
        """
        if tone not in self.templates:
            raise ValueError(f"不支持的报告语调: {tone}，可选: {list(self.templates.keys())}")

        template = self.templates[tone]
        cost = facts.get("cost", {})
        compliance = facts.get("compliance", {})
        allergens = facts.get("allergens", {})
        summary = facts.get("summary", {})
        anomalies = facts.get("anomalies", [])

        # ── 构建各章节 ────────────────────────────────
        sections = []

        # 执行摘要
        formula_name = facts.get("cost", {}).get("formula_name", "未知配方")
        cost_per_kg = summary.get("cost_per_kg", 0)
        is_compliant = summary.get("is_compliant", False)
        has_allergens = summary.get("has_allergens", False)
        allergen_types = allergens.get("at_risk_populations", [])
        anomaly_count = summary.get("anomaly_count", 0)

        # Pre-compute derived values for templates
        compliance_status = "完全符合国家标准" if is_compliant else "建议调整配方"
        allergen_status = "无致敏风险" if not has_allergens else f"含常见致敏物: {', '.join(allergen_types)}"
        safety_rating = "A级（合规且无过敏原）" if is_compliant and not has_allergens else "需进一步评估"
        anomaly_status = "未发现异常" if anomaly_count == 0 else f"{anomaly_count}项需关注"

        summary_content = template["summary_template"].format(
            formula_name=formula_name,
            batch_size_kg=cost.get("batch_size_kg", 0),
            cost_per_kg=cost_per_kg,
            compliance_status=compliance_status,
            allergen_status=allergen_status,
            safety_rating=safety_rating,
            anomaly_count=anomaly_count,
            anomaly_status=anomaly_status,
        )
        sections.append(SectionBlock(title="执行摘要", content=summary_content))

        # 成本分析
        cost_content = self._format_cost_section(cost, template)
        sections.append(SectionBlock(title="成本分析", content=cost_content))

        # 合规分析
        compliance_content = self._format_compliance_section(compliance, template)
        sections.append(SectionBlock(title="合规性评估", content=compliance_content))

        # 过敏原
        allergen_content = self._format_allergen_section(allergens, template)
        sections.append(SectionBlock(title="过敏原提示", content=allergen_content))

        # 异常值
        if anomalies:
            anomaly_content = self._format_anomaly_section(anomalies, tone)
            sections.append(SectionBlock(title="异常值说明", content=anomaly_content))

        # AI 扩展叙述（如有 LLM）
        if self.llm_client:
            ai_narrative = self._generate_ai_narrative(
                facts=facts,
                tone=tone,
                extra_context=extra_context,
            )
            if ai_narrative:
                sections.append(
                    SectionBlock(title="AI 解读", content=ai_narrative)
                )

        return ReportBundle(
            tone=tone,
            formula_name=cost.get("formula_name", "未知配方"),
            sections=sections,
            generated_at=datetime.now(timezone.utc),
            facts_summary=summary,
            raw_facts=facts,
        )

    def write_batch_report(
        self,
        facts: Dict[str, Any],
        batch_code: str,
        tone: str = "technical",
    ) -> ReportBundle:
        """为批次生成专项报告"""
        base_report = self.write(facts, tone=tone)

        # 在摘要前插入批次信息
        batch_intro = (
            f"**批号**: {batch_code}\n\n"
            "本报告基于批次生产记录自动生成，"
            "所有数据来自确定性计算，未经 AI 修饰。\n"
        )

        # 修改执行摘要
        for section in base_report.sections:
            if section.title == "执行摘要":
                section.content = batch_intro + section.content
                break

        return base_report

    # ── 辅助格式化方法 ────────────────────────────────

    def _format_cost_section(self, cost: dict, template: dict) -> str:
        return (
            f"{template['cost_intro']}\n\n"
            f"- **原料成本**: ¥{cost.get('ingredient_cost', 0):.2f}\n"
            f"- **加工成本**: ¥{cost.get('processing_cost', 0):.2f}\n"
            f"- **总成本**: ¥{cost.get('total_cost', 0):.2f}\n"
            f"- **单位成本**: ¥{cost.get('cost_per_kg', 0):.2f}/kg\n"
            f"- **价格来源**: {cost.get('price_source', 'food_materials')}\n"
        )

    def _format_compliance_section(self, compliance: dict, template: dict) -> str:
        intro = template.get("compliance_intro", "")
        parts = [intro]

        if compliance.get("violations"):
            parts.append("\n**⚠️ 违规项**:")
            for v in compliance["violations"]:
                parts.append(f"- {v.get('message', str(v))}")
        elif compliance.get("warnings"):
            parts.append("\n**ℹ️ 警告项**:")
            for w in compliance["warnings"]:
                parts.append(f"- {w.get('message', str(w))}")
        else:
            parts.append("\n✅ 未发现违规或警告项。")

        parts.append(f"\n*依据: {compliance.get('reference', 'GB 16740-2014')}")
        return "\n".join(parts)

    def _format_allergen_section(self, allergens: dict, template: dict) -> str:
        intro = template.get("allergen_intro", "")
        parts = [intro]

        if allergens.get("allergens_detected"):
            parts.append("\n**检测到以下过敏原**:")
            for a in allergens["allergens_detected"]:
                parts.append(f"- **{a['type']}**: {', '.join(a['matched_ingredients'])}")
        else:
            parts.append("\n✅ 未检测到常见过敏原。")

        return "\n".join(parts)

    def _format_anomaly_section(self, anomalies: List[dict], tone: str) -> str:
        critical = [a for a in anomalies if a.get("severity") == "critical"]
        warnings = [a for a in anomalies if a.get("severity") == "warning"]

        parts = []
        if critical:
            parts.append("**🔴 关键异常**:")
            for a in critical:
                parts.append(
                    f"- {a['parameter']}: 实测 {a['measured_value']}, "
                    f"规格 [{a.get('spec_min', 'N/A')}, {a.get('spec_max', 'N/A')}], "
                    f"偏差 {a.get('deviation_pct', 'N/A')}%"
                )
        if warnings:
            parts.append("\n**🟡 一般警告**:")
            for a in warnings:
                parts.append(
                    f"- {a['parameter']}: 实测 {a['measured_value']}, "
                    f"偏差 {a.get('deviation_pct', 'N/A')}%"
                )

        return "\n".join(parts) if parts else "无异常值。"

    def _generate_ai_narrative(
        self,
        facts: Dict[str, Any],
        tone: str,
        extra_context: Optional[Dict[str, Any]],
    ) -> str:
        """调用 LLM 生成扩展叙述"""
        if not self.llm_client:
            return ""

        prompt = self._build_llm_prompt(facts, tone, extra_context)
        try:
            response = self.llm_client.chat(prompt)
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"AI 叙述生成失败: {e}")
            return "（AI 叙述生成暂时不可用）"

    def _build_llm_prompt(
        self,
        facts: Dict[str, Any],
        tone: str,
        extra_context: Optional[Dict[str, Any]],
    ) -> str:
        """构建 LLM 提示词"""
        context = extra_context or {}
        return f"""
你是一个专业的配方报告撰写助手。请根据以下确定性事实数据，
以"{tone}"语调撰写一段扩展叙述。

## 事实数据
{json.dumps(facts, ensure_ascii=False, indent=2)}

## 补充背景
{json.dumps(context, ensure_ascii=False, indent=2)}

## 要求
- 基于事实数据，不编造信息
- 语言流畅、专业
- 长度控制在 200-400 字
- 如果是 technical 语调，侧重数据和逻辑
- 如果是 marketing 语调，侧重价值和卖点
- 如果是 clinical 语调，侧重安全性和证据
- 如果是 consumer 语调，侧重易懂和实用
"""


# ═══════════════════════════════════════════
# 单例工厂
# ═══════════════════════════════════════════

_instance: Optional[AIReportWriter] = None

def get_report_writer(llm_client: Optional[Any] = None) -> AIReportWriter:
    global _instance
    if _instance is None:
        _instance = AIReportWriter(llm_client=llm_client)
    return _instance

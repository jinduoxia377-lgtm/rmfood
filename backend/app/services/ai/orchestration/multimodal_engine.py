"""
多模态输出引擎 (Multimodal Output Engine)

将 AI 推理结果转换为多种输出模态:
1. 文本: 自然语言回复
2. 结构化数据: 配方成分表、评分雷达图数据
3. 图表: 功效雷达图、配方对比图
4. 配方卡片: 结构化配方展示
5. 报告: Markdown 格式完整报告

@version 1.0.0
"""
import json
import logging
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ═══════════════════════════════
# 输出模态定义
# ═══════════════════════════════

@dataclass
class TextBlock:
    """文本模态"""
    content: str
    style: str = "normal"  # normal, heading, highlight, code


@dataclass
class StructuredDataBlock:
    """结构化数据模态"""
    title: str
    type: str  # table, key_value, list
    headers: List[str] = field(default_factory=list)
    rows: List[List[str]] = field(default_factory=list)
    data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ChartBlock:
    """图表模态"""
    chart_type: str  # radar, bar, line, pie
    title: str
    labels: List[str] = field(default_factory=list)
    datasets: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class FormulaCard:
    """配方卡片模态"""
    name: str
    ingredients: List[Dict[str, Any]] = field(default_factory=list)
    scores: Dict[str, float] = field(default_factory=dict)
    description: str = ""
    algorithm: str = ""


@dataclass
class ReportBlock:
    """报告模态"""
    title: str
    sections: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class MultimodalOutput:
    """多模态输出"""
    blocks: List[Dict[str, Any]] = field(default_factory=list)

    def add_text(self, content: str, style: str = "normal"):
        self.blocks.append({"type": "text", "content": content, "style": style})

    def add_table(self, title: str, headers: List[str], rows: List[List[str]]):
        self.blocks.append({
            "type": "structured", "subtype": "table",
            "title": title, "headers": headers, "rows": rows,
        })

    def add_radar_chart(self, title: str, labels: List[str], scores: List[float]):
        self.blocks.append({
            "type": "chart", "chart_type": "radar",
            "title": title, "labels": labels,
            "datasets": [{"label": "评分", "data": scores}],
        })

    def add_bar_chart(self, title: str, labels: List[str], values: List[float]):
        self.blocks.append({
            "type": "chart", "chart_type": "bar",
            "title": title, "labels": labels,
            "datasets": [{"label": "评分", "data": values}],
        })

    def add_formula_card(self, name: str, ingredients: List[Dict],
                         scores: Dict[str, float], algorithm: str = "",
                         description: str = ""):
        self.blocks.append({
            "type": "formula_card", "name": name,
            "ingredients": ingredients, "scores": scores,
            "algorithm": algorithm, "description": description,
        })

    def to_text(self) -> str:
        """转纯文本"""
        parts = []
        for block in self.blocks:
            t = block.get("type", "")
            if t == "text":
                parts.append(block.get("content", ""))
            elif t == "formula_card":
                ing = ", ".join(f"{i.get('name','')}({i.get('dosage','')}g)" for i in block.get("ingredients", []))
                parts.append(f"📋 {block.get('name')}: {ing}")
            elif t == "structured" and block.get("subtype") == "table":
                rows = [" | ".join(row) for row in block.get("rows", [])]
                parts.append(f"\n{block.get('title')}\n" + "\n".join(rows))
        return "\n".join(parts)

    def to_json(self) -> Dict[str, Any]:
        return {"blocks": self.blocks}

    def to_markdown(self) -> str:
        """转 Markdown 报告"""
        md = []
        for block in self.blocks:
            t = block.get("type", "")
            if t == "text":
                s = block.get("style", "normal")
                content = block.get("content", "")
                if s == "heading": md.append(f"## {content}")
                elif s == "highlight": md.append(f"> **{content}**")
                else: md.append(content)
            elif t == "formula_card":
                md.append(f"\n### 📋 {block.get('name')}\n")
                md.append(f"**算法**: {block.get('algorithm', 'N/A')}\n")
                md.append("| 药材 | 用量 |\n|------|------|\n")
                for ing in block.get("ingredients", []):
                    md.append(f"| {ing.get('name','')} | {ing.get('dosage','')}g |\n")
                scores = block.get("scores", {})
                md.append("\n**评分**: " + ", ".join(f"{k}: {v}" for k, v in scores.items()))
            elif t == "chart":
                md.append(f"\n![{block.get('title')}](chart:{block.get('chart_type')})\n")
        return "\n".join(md)


# ═══════════════════════════════
# 多模态引擎
# ═══════════════════════════════

class MultimodalEngine:
    """多模态输出引擎"""

    def generate_formula_output(self, candidates: List[Any],
                                 target_effects: List[str],
                                 algorithm_name: str) -> MultimodalOutput:
        """从配方候选生成多模态输出"""
        output = MultimodalOutput()

        output.add_text(f"## 🎯 目标功效: {' + '.join(target_effects)}", "heading")
        output.add_text(f"**生成算法**: {algorithm_name}")

        if not candidates:
            output.add_text("暂未生成可用配方方案，请调整目标功效后重试。", "highlight")
            return output

        output.add_text(f"共生成 {len(candidates)} 个候选配方方案:", "normal")

        for i, c in enumerate(candidates[:5]):
            # 提取数据
            if hasattr(c, 'ingredients'):
                ing = c.ingredients
                score_map = {
                    "综合": c.overall_score if hasattr(c, 'overall_score') else 0,
                    "功效": c.efficacy_score if hasattr(c, 'efficacy_score') else 0,
                    "安全": c.safety_score if hasattr(c, 'safety_score') else 0,
                }
                cfg = getattr(c, 'confidence', 0.5)
                alg = algorithm_name
                desc = getattr(c, 'explanation', "")
            elif isinstance(c, dict):
                ing = c.get("ingredients", {})
                score_map = {k: v for k, v in c.items() if k.endswith("_score")}
                cfg = c.get("confidence", 0.5)
                alg = c.get("algorithm", algorithm_name)
                desc = c.get("explanation", "")
            else:
                continue

            # 配方卡片
            ing_list = []
            from .bayesian_formula_optimizer import _BUILTIN_HERBS
            for hid, dosage in (ing.items() if isinstance(ing, dict) else []):
                name = _BUILTIN_HERBS[hid].name_cn if hid in _BUILTIN_HERBS else hid
                ing_list.append({"name": name, "dosage": dosage})

            output.add_formula_card(
                name=f"候选方案 #{i+1}",
                ingredients=ing_list,
                scores=score_map,
                algorithm=alg,
                description=desc,
            )

        # 评分雷达图
        if candidates:
            from .bayesian_formula_optimizer import _BUILTIN_HERBS
            best = candidates[0]
            labels = ["综合", "功效", "安全", "口感"]
            if hasattr(best, 'cost_score'):
                labels.append("成本")
            scores = []
            for label in labels:
                key_map = {"综合": "overall", "功效": "efficacy", "安全": "safety",
                          "口感": "taste", "成本": "cost"}
                attr = key_map.get(label, "")
                val = getattr(best, f"{attr}_score", 0) if hasattr(best, f"{attr}_score") else 0
                scores.append(round(val * 100, 1))
            output.add_radar_chart("方案评分雷达图", labels, scores)

            # 方案对比柱状图
            if len(candidates) >= 2:
                bar_labels = [f"方案#{i+1}" for i in range(min(5, len(candidates)))]
                bar_values = []
                for c in candidates[:5]:
                    v = getattr(c, 'overall_score', 0)
                    if callable(v):
                        v = v()
                    bar_values.append(round(v * 100, 1) if isinstance(v, (int, float)) else 0)
                output.add_bar_chart("方案综合评分对比", bar_labels, bar_values)

        # 配方对比表
        if candidates:
            headers = ["方案", "功效评分", "安全评分", "综合评分"]
            rows = []
            for i, c in enumerate(candidates[:5]):
                eff = round(getattr(c, 'efficacy_score', 0) * 100, 1) if hasattr(c, 'efficacy_score') else 0
                saf = round(getattr(c, 'safety_score', 0) * 100, 1) if hasattr(c, 'safety_score') else 0
                overall = round(getattr(c, 'overall_score', 0) * 100, 1) if hasattr(c, 'overall_score') else 0
                rows.append([f"方案#{i+1}", f"{eff}分", f"{saf}分", f"{overall}分"])
            output.add_table("配方方案对比", headers, rows)

        return output


_multimodal_engine: Optional[MultimodalEngine] = None

def get_multimodal_engine() -> MultimodalEngine:
    global _multimodal_engine
    if _multimodal_engine is None:
        _multimodal_engine = MultimodalEngine()
    return _multimodal_engine

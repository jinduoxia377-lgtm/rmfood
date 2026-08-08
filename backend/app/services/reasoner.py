"""
推理器 — 基于知识库进行配伍分析

分析：
- 药材之间的配伍关系
- 归经关联
- 功效互补
"""
from __future__ import annotations


class Reasoner:
    """基于知识库进行配伍推理分析"""

    def __init__(self, knowledge_base: dict):
        self._kb = knowledge_base

    def reason(self, intent: dict) -> dict:
        """对提及的药材进行综合分析"""
        herbs = intent.get("mentioned_herbs", [])
        lines = []

        # 分析配伍
        for i, h1 in enumerate(herbs):
            for h2 in herbs[i + 1:]:
                info1 = self._kb.get(h1)
                info2 = self._kb.get(h2)
                if not info1 or not info2:
                    continue

                # 检查是否有关联
                pairs_1 = dict(info1.get("pairing", []))
                if h2 in pairs_1:
                    lines.append(f"- **{h1} + {h2}**：{pairs_1[h2]}")

                # 检查归经关联
                common_meridians = set(info1.get("meridian", [])) & set(info2.get("meridian", []))
                if common_meridians:
                    lines.append(
                        f"- **归经关联**：{h1}与{h2}均入{'/'.join(common_meridians)}经"
                    )

                # 检查功效互补
                common_effects = set(info1.get("effects", [])) & set(info2.get("effects", []))
                if common_effects:
                    lines.append(
                        f"- **功效协同**：两者均有{'、'.join(list(common_effects)[:2])}功效"
                    )

        if not lines:
            lines.append("请提供更多具体信息以进行深度推理分析")

        return {
            "summary": f"完成 {len(herbs)} 种药材的综合分析",
            "details": "\n".join(lines[:5]),
        }

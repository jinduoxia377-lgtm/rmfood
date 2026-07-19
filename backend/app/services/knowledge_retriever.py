"""
知识检索器 — 从知识库中检索相关信息

根据意图检索：
- 具体药材的详细信息
- 按功效匹配的药材列表
- 知识库总体概览
"""
from __future__ import annotations


class KnowledgeRetriever:
    """从知识库中检索相关信息"""

    def __init__(self, knowledge_base: dict):
        self._kb = knowledge_base

    def retrieve(self, intent: dict) -> dict:
        """根据意图检索知识"""
        herbs = intent.get("mentioned_herbs", [])
        effects = intent.get("target_effects", [])

        details = []

        # 检索具体药材
        for herb_name in herbs:
            info = self._kb.get(herb_name)
            if info:
                details.append(
                    f"**{herb_name}**（{info['pinyin']}）\n"
                    f"  性味：{info['property']} | 归经：{'/'.join(info['meridian'])}\n"
                    f"  功效：{'、'.join(info['effects'])}\n"
                    f"  主要成分：{'、'.join(info['chemicals'][:3])}\n"
                    f"  用量范围：{info['dosage']}"
                )

        # 按功效检索
        if effects:
            for effect in effects:
                matched = []
                for name, info in self._kb.items():
                    if any(effect in e for e in info.get("effects", [])):
                        matched.append(f"{name}（{'、'.join(info['effects'][:2])}）")
                if matched:
                    details.append(
                        f"与「{effect}」相关的药材：\n  "
                        + "\n  ".join(matched[:5])
                    )

        if not details:
            # 汇总概览
            food_herbs = [
                n for n, i in self._kb.items() if i.get("is_food_homology")
            ]
            details.append(
                f"药食同源知识库已加载 {len(self._kb)} 种药材\n"
                f"  药食同源食材：{'、'.join(food_herbs[:8])}等"
            )

        return {
            "summary": (
                f"已检索到 {len(herbs)} 种药材信息、{len(effects)} 项功效关联"
            ),
            "details": "\n\n".join(details[:5]),
        }

"""
⚠️ MOCK IMPLEMENTATION - 模拟实现，非真实 AI 模型

当前使用硬编码 SYNERGY_PAIRS/ANTAGONISM_PAIRS 模拟协同作用分析。
接入真实 GNN + Transformer 模型后替换为真实推理实现。
"""
import logging
from typing import Any

logger = logging.getLogger(__name__)


class MockSynergyNetService:
    """协同作用分析服务（模拟实现）"""

    async def analyze(
        self,
        herbs: list[dict[str, Any]],
        peptides: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        分析成分间的协同/拮抗关系

        Returns:
            {
                "score": 0.85,          # 综合协同评分 (0-1)
                "synergy_pairs": [...],  # 协同配对
                "antagonism_warnings": [...], # 拮抗预警
                "shared_pathways": [...],  # 共有通路
                "heat_map": {...},       # 协同热力图数据
            }
        """
        herbs_names = [h.get("name", "") for h in herbs]
        peptides_seqs = [p.get("sequence", "") for p in (peptides or [])]

        # 已知的协同/拮抗配对（简化知识库）
        SYNERGY_PAIRS = {
            ("黄芪", "党参"), ("人参", "黄芪"), ("枸杞", "菊花"),
            ("红枣", "枸杞"), ("山楂", "决明子"), ("山药", "茯苓"),
            ("酸枣仁", "百合"), ("桑叶", "菊花"), ("玉竹", "麦冬"),
        }
        ANTAGONISM_PAIRS = {
            ("人参", "藜芦"), ("甘草", "甘遂"), ("丁香", "郁金"),
        }

        synergy_pairs = []
        antagonism_warnings = []

        for i, h1 in enumerate(herbs_names):
            for h2 in herbs_names[i + 1:]:
                pair = tuple(sorted([h1, h2]))
                if pair in SYNERGY_PAIRS:
                    synergy_pairs.append({"a": h1, "b": h2, "score": round(0.8 + 0.15 * (len(herbs_names) % 3) / 3, 2)})
                if pair in ANTAGONISM_PAIRS:
                    antagonism_warnings.append({"a": h1, "b": h2, "level": "high", "reason": "十九畏/十八反配伍禁忌"})

        # 模拟通路分析
        shared_pathways = ["PI3K-Akt", "NF-κB", "MAPK", "Nrf2"][:min(3, len(herbs_names))]

        # 生成热力图
        heat_map = {}
        for h1 in herbs_names:
            heat_map[h1] = {}
            for h2 in herbs_names:
                if h1 == h2:
                    heat_map[h1][h2] = 1.0
                else:
                    pair = tuple(sorted([h1, h2]))
                    heat_map[h1][h2] = 0.8 if pair in SYNERGY_PAIRS else (-0.5 if pair in ANTAGONISM_PAIRS else round(0.3 + 0.4 * hash(pair) % 10 / 10, 2))

        # 综合评分
        base_score = 0.6 + 0.1 * len(synergy_pairs)
        penalty = 0.3 * len(antagonism_warnings)
        score = round(max(0, min(1, base_score - penalty)), 2)

        return {
            "score": score,
            "synergy_pairs": synergy_pairs,
            "antagonism_warnings": antagonism_warnings,
            "shared_pathways": shared_pathways,
            "heat_map": heat_map,
            "summary": f"发现 {len(synergy_pairs)} 对协同关系" + (f"，{len(antagonism_warnings)} 对拮抗预警" if antagonism_warnings else ""),
        }

"""
调香设计引擎 — Step 3

参考《中国普通配方设计思路》第三节"调香设计"

功能：
1. 香气轮廓建模（Top/Mid/Base note 三层模型）
2. 挥发动力学模拟
3. 矫味剂匹配器（掩盖苦味/涩味/腥膻/药味）
4. 香气-风味协调检查
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)


@dataclass
class AromaComponent:
    """香气成分"""
    name: str
    note_level: int          # 0=Top, 1=Mid, 2=Base
    volatility: float        # 挥发性 (0~1)
    intensity: float         # 强度 (0~1)
    type_: str               # "草本" | "花香" | "果香" | "辛香" | "甜香"


@dataclass
class MaskingAgent:
    """矫味剂"""
    name: str
    target_bad_taste: str    # "苦味" | "涩味" | "腥膻" | "药味"
    efficacy: float          # 矫味效率 (0~1)
    max_dosage_g: float      # 最大用量
    taste_impact: Dict[str, float]  # 对五味的影响


# ═══════════════════════════════════════════════════════════════
# 常见矫味剂库
# ═══════════════════════════════════════════════════════════════
MASKING_AGENTS: Dict[str, MaskingAgent] = {
    "甘草": MaskingAgent(
        name="甘草", target_bad_taste="苦味",
        efficacy=0.85, max_dosage_g=6.0,
        taste_impact={"sweet": 0.9, "bitter": -0.5, "pungent": 0.1},
    ),
    "大枣": MaskingAgent(
        name="大枣", target_bad_taste="苦味",
        efficacy=0.75, max_dosage_g=15.0,
        taste_impact={"sweet": 0.8, "bitter": -0.4},
    ),
    "蜂蜜": MaskingAgent(
        name="蜂蜜", target_bad_taste="涩味",
        efficacy=0.90, max_dosage_g=20.0,
        taste_impact={"sweet": 1.0, "bitter": -0.6, "astringent": -0.5},
    ),
    "陈皮": MaskingAgent(
        name="陈皮", target_bad_taste="腥膻",
        efficacy=0.70, max_dosage_g=10.0,
        taste_impact={"pungent": 0.6, "bitter": 0.2},
    ),
    "砂仁": MaskingAgent(
        name="砂仁", target_bad_taste="药味",
        efficacy=0.75, max_dosage_g=3.0,
        taste_impact={"pungent": 0.8, "sweet": 0.2},
    ),
}

# 药材香气类型映射（简化版）
HERB_AROMA_MAP: Dict[str, Tuple[int, float, str]] = {
    # (note_level, intensity, type_)
    "hq": (1, 0.5, "草本"),       # 黄芪 - 中调
    "ds": (1, 0.4, "草本"),       # 党参
    "gz": (0, 0.7, "甜香"),       # 枸杞子 - 前调
    "rs": (1, 0.6, "草本"),       # 人参
    "dg": (1, 0.5, "辛香"),       # 当归
    "cyh": (0, 0.8, "草本"),      # 金银花 - 前调
    "jgh": (0, 0.7, "花香"),      # 菊花
    "gq": (1, 0.6, "甜香"),       # 甘草
    "dcx": (0, 0.5, "甜香"),      # 大枣
    "cx": (0, 0.7, "辛香"),       # 陈皮
    "sj": (0, 0.8, "辛香"),       # 生姜
    "fp": (1, 0.3, "中性"),       # 茯苓
    "bq": (1, 0.5, "苦香"),       # 白术
    "sz": (1, 0.4, "辛香"),       # 山楂
}

# 不良气味药材映射
BITTER_HERBS = {"cyh", "lk", "cs", "jgh", "fz", "bq", "mld"}
FISHY_HERBS = {"dg", "cs", "ys"}
MEDICINAL_HERBS = {"rs", "ylh", "bxr", "dj", "sq"}


class FragranceEngine:
    """调香设计引擎"""

    def design(
        self,
        framework_result: Dict,
        product_form: str,
    ) -> Dict:
        """
        调香设计主入口

        Returns:
            {
                "aroma_profile": {...},
                "bad_tastes_detected": [...],
                "masking_agents": [...],
                "coordination_advice": [...]
            }
        """
        # 1. 基于药材确定基础香气轮廓
        aroma_profile = self._build_aroma_profile(framework_result)

        # 2. 检测不良气味
        bad_tastes = self._detect_bad_tastes(framework_result)

        # 3. 匹配矫味剂
        masking_suggestions = self._match_masking_agents(bad_tastes, framework_result)

        # 4. 香气-风味协调检查
        coordination_advice = self._check_coordination(aroma_profile, framework_result)

        return {
            "aroma_profile": aroma_profile,
            "bad_tastes_detected": bad_tastes,
            "masking_agents": masking_suggestions,
            "coordination_advice": coordination_advice,
        }

    def _build_aroma_profile(self, framework: Dict) -> Dict:
        """构建香气轮廓（Top/Mid/Base note）"""
        herbs = framework.get("herbs", [])

        top_note = []    # 前调（挥发性强，先感知）
        mid_note = []    # 中调（主体香气）
        base_note = []   # 后调（持久留香）

        for herb in herbs:
            # 兼容 dict 和 str 格式
            if isinstance(herb, str):
                hid = herb
                herb_name = herb
            else:
                hid = herb.get("id", "")
                herb_name = herb.get("name", hid)

            aroma_info = HERB_AROMA_MAP.get(hid)
            if not aroma_info:
                mid_note.append(herb_name)
                continue

            note_level, intensity, type_ = aroma_info
            entry = {
                "name": herb_name,
                "intensity": intensity,
                "type": type_,
            }

            if note_level == 0:
                top_note.append(entry)
            elif note_level == 1:
                mid_note.append(entry)
            else:
                base_note.append(entry)

        # 如果没有明确映射，将所有药材归入中调
        if not top_note and not mid_note and not base_note:
            mid_note = [{"name": h.get("name", h.get("id", "")), "intensity": 0.5, "type": "草本"}
                        for h in herbs[:3]]
        elif isinstance(mid_note[0], str) if mid_note else False:
            # 兼容旧格式：将字符串列表转为字典格式
            mid_note = [{"name": n, "intensity": 0.5, "type": "草本"} for n in mid_note]

        return {
            "top_note": [n["name"] if isinstance(n, dict) else n for n in top_note],
            "mid_note": [n["name"] if isinstance(n, dict) else n for n in mid_note],
            "base_note": [n["name"] if isinstance(n, dict) else n for n in base_note],
            "intensity_score": round(
                sum(n.get("intensity", 0.5) for n in top_note + mid_note + base_note)
                / max(len(top_note) + len(mid_note) + len(base_note), 1), 3
            ),
        }

    def _detect_bad_tastes(self, framework: Dict) -> List[str]:
        """检测不良气味来源"""
        bad_tastes = set()
        herbs = framework.get("herbs", [])

        for herb in herbs:
            hid = herb.get("id", "")
            if hid in BITTER_HERBS:
                bad_tastes.add("苦味")
            if hid in FISHY_HERBS:
                bad_tastes.add("腥膻")
            if hid in MEDICINAL_HERBS:
                bad_tastes.add("药味")

        return sorted(bad_tastes)

    def _match_masking_agents(
        self, bad_tastes: List[str], framework: Dict
    ) -> List[Dict]:
        """为不良气味匹配矫味剂"""
        suggestions = []
        seen = set()

        for taste in bad_tastes:
            for agent in MASKING_AGENTS.values():
                if agent.target_bad_taste == taste or taste in agent.target_bad_taste:
                    key = agent.name
                    if key not in seen:
                        seen.add(key)
                        # 检查是否在框架中已存在
                        existing = any(h.get("name") == agent.name for h in framework.get("herbs", []))
                        suggestions.append({
                            "name": agent.name,
                            "target": taste,
                            "efficacy": agent.efficacy,
                            "max_dosage_g": agent.max_dosage_g,
                            "already_present": existing,
                            "suggestion": "建议添加" if not existing else "已存在，可调整用量",
                        })

        return suggestions

    def _check_coordination(
        self, aroma_profile: Dict, framework: Dict
    ) -> List[str]:
        """香气-风味协调检查"""
        advice = []

        # 检查香气强度与产品形态的匹配
        intensity = aroma_profile.get("intensity_score", 0.5)
        if intensity > 0.7:
            advice.append("香气较浓，建议控制添加量避免掩盖本味")
        elif intensity < 0.3:
            advice.append("香气较淡，可考虑添加适量矫味剂增强风味")

        # 检查前调是否过强
        top_notes = aroma_profile.get("top_note", [])
        if len(top_notes) > 2:
            advice.append(f"前调成分较多({len(top_notes)}种)，可能香气层次过杂，建议精简")

        # 香气-五味协调
        bad_tastes = framework.get("bad_tastes_detected", [])
        if bad_tastes:
            advice.append(f"检测到{len(bad_tastes)}种不良气味，建议优先选择对应矫味剂")

        if not advice:
            advice.append("香气-风味协调良好")

        return advice

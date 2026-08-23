"""
调味设计引擎 — Step 4（增强版）

参考《中国普通配方设计思路》第四节"调味设计"

设计原理：
1. 味的增效：两种以上不同味道的呈味物质按比例混合，量大者突出
2. 味的相乘：同种味觉的两种以上呈味物质混合，味觉猛增
3. 味的掩盖：明显不同的主味混合，彼此风味减弱
4. 味的转化：多种味道混合，导致风味发生转变
5. 主体香味轮廓确定
6. 香辛料组合平衡
"""

from __future__ import annotations

import logging
import math
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class FlavorEngine:
    """
    调味设计引擎 — 增强版

    在现有 TastePredictor 基础上，增加：
    - 味的增效/相乘/掩蔽/转化数学模型
    - 主体香味轮廓确定算法
    - 香辛料组合平衡计算器
    """

    # 五味强度映射（每味药材对各味道的贡献系数）
    TASTE_CONTRIBUTION: Dict[str, Dict[str, float]] = {
        # 甜味主导
        "hq": {"sweet": 0.8, "bitter": 0.05, "umami": 0.1, "pungent": 0.05},
        "ds": {"sweet": 0.9, "bitter": 0.03, "umami": 0.07},
        "gz": {"sweet": 0.85, "bitter": 0.05, "umami": 0.1},
        "rs": {"sweet": 0.7, "bitter": 0.15, "umami": 0.1, "pungent": 0.05},
        "gq": {"sweet": 0.95, "bitter": 0.02, "umami": 0.03},
        "dcx": {"sweet": 0.9, "umami": 0.1},
        # 苦味主导
        "cyh": {"bitter": 0.9, "pungent": 0.05, "sweet": 0.05},
        "jgh": {"bitter": 0.7, "pungent": 0.2, "sweet": 0.1},
        "fz": {"bitter": 0.8, "pungent": 0.15, "sweet": 0.05},
        "bq": {"bitter": 0.6, "pungent": 0.3, "sweet": 0.1},
        "lk": {"bitter": 0.95, "pungent": 0.05},
        "cs": {"bitter": 0.5, "pungent": 0.35, "sweet": 0.15},
        # 辛香主导
        "cx": {"pungent": 0.8, "bitter": 0.1, "sweet": 0.1},
        "sj": {"pungent": 0.9, "sweet": 0.1},
        "mf": {"pungent": 0.85, "sweet": 0.1, "bitter": 0.05},
        # 中性/鲜味
        "fp": {"sweet": 0.3, "umami": 0.5, "neutral": 0.2},
        "yq": {"sweet": 0.4, "neutral": 0.5, "umami": 0.1},
        "sz": {"sour": 0.5, "sweet": 0.3, "umami": 0.2},
        "dg": {"sweet": 0.3, "pungent": 0.4, "bitter": 0.1, "umami": 0.2},
        # 默认
        "default": {"sweet": 0.3, "umami": 0.2, "bitter": 0.1, "pungent": 0.1, "sour": 0.1, "salty": 0.1, "neutral": 0.1},
    }

    # 理想五味比例（中式食品基准）
    IDEAL_TASTE_RATIO = {
        "sweet": 0.40,
        "umami": 0.20,
        "bitter": 0.10,
        "pungent": 0.10,
        "sour": 0.10,
        "salty": 0.10,
    }

    def design(
        self,
        framework_result: Dict,
        target_taste: Optional[str] = None,
    ) -> Dict:
        """
        调味设计主入口

        Args:
            framework_result: Step 1 输出（含 herbs 列表）
            target_taste: 目标口味偏好（可选）

        Returns:
            {
                "taste_profile": {...},
                "enhancement_suggestions": [...],
                "masking_suggestions": [...],
                "balance_score": float,
                "aroma_balance": {...},
                "主体香味轮廓": str
            }
        """
        herbs = framework_result.get("herbs", [])

        # 1. 计算当前五味分布
        taste_profile = self._calculate_taste_profile(herbs)

        # 2. 味的增效分析
        enhancements = self._analyze_synergistic_tastes(taste_profile, herbs)

        # 3. 味的掩蔽分析
        maskings = self._analyze_masking_tastes(taste_profile, herbs)

        # 4. 平衡度评分
        balance_score = self._calculate_balance_score(taste_profile)

        # 5. 香气-味道协调检查
        aroma_balance = self._check_aroma_taste_coordination(taste_profile, herbs)

        # 6. 确定主体香味轮廓
        main_profile = self._determine_main_profile(taste_profile, herbs)

        return {
            "taste_profile": taste_profile,
            "enhancement_suggestions": enhancements,
            "masking_suggestions": maskings,
            "balance_score": balance_score,
            "aroma_balance": aroma_balance,
            "主体香味轮廓": main_profile,
        }

    def _calculate_taste_profile(
        self, herbs: List[Dict]
    ) -> Dict[str, float]:
        """计算五味分布（加权平均模型）"""
        if not herbs:
            return dict(self.IDEAL_TASTE_RATIO)

        totals = {k: 0.0 for k in self.IDEAL_TASTE_RATIO}
        total_dosage = sum(h.get("dosage", 1.0) for h in herbs)

        for herb in herbs:
            hid = herb.get("id", "")
            dosage = herb.get("dosage", 1.0)
            ratio = dosage / max(total_dosage, 1)

            contrib = self.TASTE_CONTRIBUTION.get(hid, self.TASTE_CONTRIBUTION["default"])
            for taste, value in contrib.items():
                if taste in totals:
                    totals[taste] += value * ratio

        # 归一化
        total = sum(totals.values()) or 1.0
        return {k: round(v / total, 3) for k, v in totals.items()}

    def _calculate_balance_score(self, taste_profile: Dict[str, float]) -> float:
        """计算五味平衡度（MSE 逆函数）"""
        mse = sum(
            (taste_profile.get(k, 0) - v) ** 2
            for k, v in self.IDEAL_TASTE_RATIO.items()
        ) / len(self.IDEAL_TASTE_RATIO)
        return max(0.0, min(1.0, 1.0 - mse * 10))

    def _analyze_synergistic_tastes(
        self, taste_profile: Dict[str, float], herbs: List[Dict]
    ) -> List[Dict]:
        """
        味的增效分析

        原理：两种以上不同味道的呈味物质按比例混合，
        使量大的那种呈味物质味道突出（味的增效）
        """
        suggestions = []

        # 甜味增效：甘草+大枣协同增甜
        sweet_ratio = taste_profile.get("sweet", 0)
        if sweet_ratio < 0.3:
            has_gq = any(h.get("id") == "gq" for h in herbs)
            has_dcx = any(h.get("id") == "dcx" for h in herbs)
            if not (has_gq and has_dcx):
                suggestions.append({
                    "type": "增效",
                    "target": "甜味不足",
                    "current": f"甜味占比 {sweet_ratio:.2f}",
                    "suggestion": "添加甘草(3-6g) + 大枣(6-15g) 协同增甜",
                    "mechanism": "甘草甜素 + 大枣果糖 → 甜味相乘效应",
                    "priority": "高" if sweet_ratio < 0.2 else "中",
                })

        # 鲜味增效：氨基酸类药材协同
        umami_ratio = taste_profile.get("umami", 0)
        if umami_ratio < 0.15:
            suggestions.append({
                "type": "增效",
                "target": "鲜味不足",
                "current": f"鲜味占比 {umami_ratio:.2f}",
                "suggestion": "添加山药(15-30g)、薏苡仁(6-30g) 等富含氨基酸的药材",
                "mechanism": "谷氨酸 + 核苷酸 → 鲜味相乘效应",
                "priority": "中",
            })

        # 苦味掩盖：苦味过高时建议
        bitter_ratio = taste_profile.get("bitter", 0)
        if bitter_ratio > 0.25:
            suggestions.append({
                "type": "掩蔽→增效转换",
                "target": "苦味过高",
                "current": f"苦味占比 {bitter_ratio:.2f}",
                "suggestion": "添加甘草(3-6g) 或 大枣(6-15g) 掩盖苦味，同时增效甜味",
                "mechanism": "甘草酸掩盖苦味 + 甜味增效 → 整体风味改善",
                "priority": "高",
            })

        return suggestions

    def _analyze_masking_tastes(
        self, taste_profile: Dict[str, float], herbs: List[Dict]
    ) -> List[Dict]:
        """
        味的掩蔽分析

        原理：一种呈味物质与另外几种呈味物质共存时，
        由于彼此之间的抑制作用而使各自所呈现的风味都有减弱
        """
        suggestions = []

        # 苦味掩蔽
        bitter_ratio = taste_profile.get("bitter", 0)
        if bitter_ratio > 0.2:
            masking_herbs = []
            for h in herbs:
                hid = h.get("id", "")
                if hid in {"gq", "dcx", "gz"}:  # 甘草、大枣、枸杞子
                    masking_herbs.append(h.get("name", hid))

            if not masking_herbs:
                suggestions.append({
                    "type": "掩蔽",
                    "target": "苦味",
                    "suggestion": "添加甜味药材（甘草、大枣）掩蔽苦味",
                    "mechanism": "甜味物质抑制苦味受体感知",
                })

        # 辛辣掩蔽
        pungent_ratio = taste_profile.get("pungent", 0)
        if pungent_ratio > 0.3:
            suggestions.append({
                "type": "掩蔽",
                "target": "辛辣过重",
                "suggestion": "添加甜味或鲜味药材平衡辛辣感",
                "mechanism": "甜味/鲜味可中和辛辣刺激",
            })

        return suggestions

    def _check_aroma_taste_coordination(
        self, taste_profile: Dict[str, float], herbs: List[Dict]
    ) -> Dict:
        """香气-味道协调检查"""
        # 香气强度与味道的匹配度
        bitter_ratio = taste_profile.get("bitter", 0)
        pungent_ratio = taste_profile.get("pungent", 0)

        coordination_score = 1.0
        issues = []

        # 苦味高时，应有对应香气协调
        if bitter_ratio > 0.25:
            has_aromatic = any(h.get("id") in {"cx", "sj", "bq", "mf"} for h in herbs)
            if not has_aromatic:
                coordination_score -= 0.2
                issues.append("苦味较高但缺乏芳香类药材协调")

        # 辛辣高时，应有甜味平衡
        if pungent_ratio > 0.3:
            sweet_ratio = taste_profile.get("sweet", 0)
            if sweet_ratio < 0.2:
                coordination_score -= 0.15
                issues.append("辛辣较重但甜味不足，建议添加甘味药材")

        return {
            "coordination_score": round(coordination_score, 3),
            "issues": issues,
            "status": "协调良好" if coordination_score >= 0.8 else "需调整",
        }

    def _determine_main_profile(
        self, taste_profile: Dict[str, float], herbs: List[Dict]
    ) -> str:
        """确定主体香味轮廓"""
        # 找出主导味道
        dominant = max(taste_profile, key=taste_profile.get)
        dominant_ratio = taste_profile[dominant]

        profiles = {
            "sweet": "甘甜型",
            "umami": "鲜醇型",
            "bitter": "苦甘型",
            "pungent": "辛香型",
            "sour": "酸甘型",
            "salty": "咸鲜型",
        }

        base_profile = profiles.get(dominant, "综合型")

        # 根据第二味道微调
        sorted_tastes = sorted(taste_profile.items(), key=lambda x: -x[1])
        if len(sorted_tastes) >= 2:
            second = sorted_tastes[1][0]
            second_name = profiles.get(second, "")
            if second_name and second_name != base_profile:
                return f"{second_name}-{base_profile}"

        return base_profile

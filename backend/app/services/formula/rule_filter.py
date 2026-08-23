"""
前置规则过滤器 — 在生成前就排除非法组合

当前问题：禁忌检查仅在 Fitness 评分中作为惩罚项
目标：在生成前就硬过滤非法组合，提升生成效率和质量

过滤规则：
1. 十八反配伍禁忌
2. 十九畏配伍禁忌
3. 特殊人群禁忌（孕妇/儿童/老人）
4. 单味药剂量超上限
5. 总成本超限
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Set

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# 十八反配伍禁忌（经典中医药配伍禁忌）
# ═══════════════════════════════════════════════════════════════
# 来源：《神农本草经》+《黄帝内经》
# 格式：frozenset({herb_id_1, herb_id_2})

EIGHTEEN_INCOMPATIBLES: Set[frozenset] = {
    frozenset({"gz", "xv"}),           # 甘草反犀角
    frozenset({"gz", "wan_hua"}),      # 甘草反万花
    frozenset({"gz", "gan_sui"}),      # 甘草反甘遂
    frozenset({"gz", "yuan_hua"}),     # 甘草反远志
    frozenset({"gz", "bei_mu"}),       # 甘草反贝母
    frozenset({"gz", "lv_gu"}),        # 甘草反龙骨
    frozenset({"gz", "fei_lu"}),       # 甘草反飞卢
    frozenset({"hq", "fz"}),           # 黄芪反附子
    frozenset({"ds", "lk"}),           # 党参反藜芦
    frozenset({"rs", "lk"}),           # 人参反藜芦
    frozenset({"dg", "lv_huang"}),     # 当归反绿花
    frozenset({"rs", "hq"}),           # 人参反藜芦（重复，保留）
}


# ═══════════════════════════════════════════════════════════════
# 十九畏配伍禁忌
# ═══════════════════════════════════════════════════════════════
# 来源：《本草纲目》

NINETEEN_MUTUAL_FEARS: Set[frozenset] = {
    frozenset({"sz", "wu_yue"}),        # 山楂畏吴茱萸
    frozenset({"dsz", "mi_mang"}),      # 丹参畏芒硝
    frozenset({"yg", "dan_nan"}),       # 牙硝畏大黄
    frozenset({"bq", "shi_jian"}),      # 白牵牛畏蓖麻
    frozenset({"sz", "shui_fu"}),       # 硫黄畏朴硝
    frozenset({"yl", "yu_jin"}),        # 郁金畏石遗
    frozenset({"rs", "mld"}),           # 人参畏五灵脂
    frozenset({"dsz", "pi_zhu"}),       # 丹参畏鼠李
}


# ═══════════════════════════════════════════════════════════════
# 特殊人群禁忌药材
# ═══════════════════════════════════════════════════════════════

PREGNANCY_CONTRA: Set[str] = {
    "cs", "dg", "fz", "mld", "lk", "hs", "es", "ys",  # 活血破血类
    "ylh", "bxr",  # 补阳峻剂
}

CHILDREN_CAUTION: Set[str] = {
    "fz", "lk", "mld", "rs", "ylh",  # 毒性较强或药性峻烈
}

ELDERLY_CAUTION: Set[str] = {
    "rs", "ylh", "bxr",  # 大补峻剂
}


@dataclass
class FilterViolation:
    """过滤违规记录"""
    rule_type: str           # "十八反" | "十九畏" | "人群禁忌" | "剂量超限"
    description: str
    affected_herbs: List[str]
    severity: str            # "error" | "warning"


class RuleFilter:
    """
    前置规则过滤器

    在配方生成前执行硬过滤，排除所有非法组合。
    与后验评估（Fitness 评分中的禁忌惩罚）互补，
    形成"前置过滤 + 后验评分"的双重保障机制。
    """

    def __init__(self):
        self._antagonistic_pairs: Set[frozenset] = set()
        self._loaded = False

    def _load_antagonistic_pairs(self) -> None:
        """加载配伍禁忌对（合并十八反 + 十九畏 + 数据库）"""
        if self._loaded:
            return

        # 合并十八反和十九畏
        self._antagonistic_pairs = set(EIGHTEEN_INCOMPATIBLES)
        self._antagonistic_pairs.update(NINETEEN_MUTUAL_FEARS)

        self._loaded = True
        logger.info(f"[RuleFilter] 已加载 {len(self._antagonistic_pairs)} 对配伍禁忌")

    def filter(
        self,
        candidate_herbs: List[Dict],
        target_population: str = "adult",
        max_cost: Optional[float] = None,
        max_total_dosage_g: Optional[float] = None,
    ) -> Dict:
        """
        前置过滤候选药材列表

        Args:
            candidate_herbs: 候选药材列表 [{id, name, dosage_max, cost_per_gram, ...}]
            target_population: 目标人群 (adult/pregnant/children/elderly)
            max_cost: 成本上限（元）
            max_total_dosage_g: 总剂量上限（g）

        Returns:
            {
                "filtered_herbs": [...],
                "violations": [...],
                "violation_count": int
            }
        """
        self._load_antagonistic_pairs()

        violations: List[FilterViolation] = []
        filtered = list(candidate_herbs)

        # ── 过滤 1: 人群禁忌 ──
        contra_set = {
            "pregnant": PREGNANCY_CONTRA,
            "children": CHILDREN_CAUTION,
            "elderly": ELDERLY_CAUTION,
        }.get(target_population, set())

        if contra_set:
            removed = []
            for herb in filtered[:]:
                if herb.get("id") in contra_set:
                    removed.append(herb.get("name_cn", herb.get("id", "")))
                    filtered.remove(herb)
            if removed:
                violations.append(FilterViolation(
                    rule_type="人群禁忌",
                    description=f"{target_population} 不宜使用: {', '.join(removed)}",
                    affected_herbs=removed,
                    severity="error",
                ))

        # ── 过滤 2: 配伍禁忌（十八反/十九畏）──
        removed_ids = {h.get("id") for h in filtered}
        for i, herb_a in enumerate(filtered):
            for herb_b in filtered[i + 1:]:
                pair = frozenset({herb_a.get("id"), herb_b.get("id")})
                if pair in self._antagonistic_pairs:
                    violations.append(FilterViolation(
                        rule_type="配伍禁忌",
                        description=f"{herb_a.get('name_cn', '')} 与 {herb_b.get('name_cn', '')} 相畏/相反",
                        affected_herbs=[
                            herb_a.get("name_cn", herb_a.get("id", "")),
                            herb_b.get("name_cn", herb_b.get("id", "")),
                        ],
                        severity="error",
                    ))
                    # 移除毒性更大的一味（默认移除后者）
                    filtered.pop(i + 1)
                    removed_ids.add(herb_b.get("id"))

        # ── 过滤 3: 单味药剂量超限 ──
        for herb in filtered[:]:
            dosage_max = herb.get("dosage_max", 30.0)
            if max_total_dosage_g and dosage_max > max_total_dosage_g:
                violations.append(FilterViolation(
                    rule_type="剂量超限",
                    description=f"{herb.get('name_cn', '')} 最大剂量 {dosage_max}g > 总剂量 {max_total_dosage_g}g",
                    affected_herbs=[herb.get("name_cn", herb.get("id", ""))],
                    severity="warning",
                ))
                filtered.remove(herb)

        # ── 过滤 4: 成本超限 ──
        if max_cost is not None:
            total_cost = sum(
                h.get("cost_per_gram", 0.1) * h.get("dosage_max", 10.0)
                for h in filtered
            )
            if total_cost > max_cost:
                violations.append(FilterViolation(
                    rule_type="成本超限",
                    description=f"预估总成本 {total_cost:.2f}元 > 预算 {max_cost}元",
                    affected_herbs=[],
                    severity="warning",
                ))

        return {
            "filtered_herbs": filtered,
            "violations": [
                {
                    "rule_type": v.rule_type,
                    "description": v.description,
                    "affected_herbs": v.affected_herbs,
                    "severity": v.severity,
                }
                for v in violations
            ],
            "violation_count": len(violations),
        }

    def check_pair(self, herb_a_id: str, herb_b_id: str) -> bool:
        """
        检查两味药材是否禁忌

        Returns:
            True = 禁忌，False = 安全
        """
        self._load_antagonistic_pairs()
        pair = frozenset({herb_a_id, herb_b_id})
        return pair in self._antagonistic_pairs

    def get_violation_summary(self, result: Dict) -> str:
        """生成违规摘要"""
        if not result["violations"]:
            return "✅ 所有候选药材通过前置规则检查"

        error_count = sum(
            1 for v in result["violations"] if v["severity"] == "error"
        )
        warning_count = sum(
            1 for v in result["violations"] if v["severity"] == "warning"
        )

        parts = []
        if error_count:
            parts.append(f"🔴 {error_count} 条严重违规（已过滤）")
        if warning_count:
            parts.append(f"🟡 {warning_count} 条警告")
        parts.append(f"剩余候选: {len(result['filtered_herbs'])} 味")

        return " | ".join(parts)

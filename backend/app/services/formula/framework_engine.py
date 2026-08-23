"""
主体骨架设计引擎 — Step 1

职责：
1. 产品形态决策 → 确定产品类型和配比规则
2. 原料选择 → 从 HerbKnowledgeService 检索功效匹配的药材
3. 前置规则过滤 → 排除禁忌组合
4. 剂量规划 → MILP 精确求解各药材用量
5. 君臣佐使结构构建 → 按功效权重排序分配角色
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class FrameworkResult:
    """主体骨架设计结果"""
    product_form: str
    total_dosage_g: float
    herbs: List[Dict]  # [{id, name, dosage, role, efficacy_score, safety_index}]
    jun_herbs: List[str]
    chen_herbs: List[str]
    zuo_herbs: List[str]
    shi_herb: str
    structure_score: float  # 君臣佐使结构合规度 0~1
    rule_violations: List[Dict]
    target_effects: List[str]
    target_group: str


class FrameworkEngine:
    """
    主体骨架设计引擎

    设计流程：
    1. 根据产品形态匹配规则库
    2. 从 HerbKnowledgeService 检索功效匹配的候选药材
    3. 前置规则过滤（十八反/十九畏/人群禁忌）
    4. 按功效权重 + 安全性排序分配君臣佐使
    5. 使用 MILPSolver 精确求解剂量
    """

    def __init__(self):
        from .product_form_rules import PRODUCT_FORM_RULES
        self._rules = PRODUCT_FORM_RULES

    async def design(
        self,
        effects: List[str],
        product_form: str,
        target_group: str = "adult",
        max_cost: Optional[float] = None,
        n_candidates: int = 10,
    ) -> FrameworkResult:
        """
        主体骨架设计主入口

        Args:
            effects: 目标功效列表
            product_form: 产品形态
            target_group: 目标人群
            max_cost: 成本上限
            n_candidates: 候选配方数

        Returns:
            FrameworkResult
        """
        # Step 1: 获取产品形态规则
        rule = self._rules.get(product_form)
        if not rule:
            raise ValueError(f"不支持的产品形态: {product_form}")

        logger.info(
            f"[FrameworkEngine] 产品形态: {product_form}, "
            f"总剂量: {rule.total_dosage_g}g, "
            f"功效: {effects}"
        )

        # Step 2: 从 HerbKnowledgeService 检索候选药材
        candidate_herbs = await self._select_candidate_herbs(effects, n_candidates * 3)

        if not candidate_herbs:
            logger.warning("[FrameworkEngine] 未找到候选药材，使用内置知识库兜底")
            candidate_herbs = await self._fallback_select_herbs(effects, n_candidates * 3)

        # Step 3: 前置规则过滤
        from .rule_filter import RuleFilter
        rule_filter = RuleFilter()
        filter_result = rule_filter.filter(
            candidate_herbs=candidate_herbs,
            target_population=target_group,
            max_cost=max_cost,
            max_total_dosage_g=rule.total_dosage_g,
        )

        filtered_herbs = filter_result["filtered_herbs"]
        violations = filter_result["violations"]

        logger.info(
            f"[FrameworkEngine] 过滤后候选: {len(filtered_herbs)} 味, "
            f"违规: {len(violations)} 条"
        )

        # Step 4: 按功效权重排序，分配君臣佐使
        sorted_herbs = self._assign_roles(filtered_herbs, effects)

        # 确保至少有 min_herbs 味
        if len(sorted_herbs) < rule.min_herbs:
            logger.warning(
                f"[FrameworkEngine] 候选不足 {rule.min_herbs} 味，使用全部 {len(sorted_herbs)} 味"
            )

        # Step 5: 精确剂量求解（MILP）
        dosages = self._calculate_dosages(sorted_herbs, rule)

        # Step 6: 构建结果
        n = len(sorted_herbs)
        jun = sorted_herbs[:1]
        chen = sorted_herbs[1:3]
        zuo = sorted_herbs[3:5]
        shi = sorted_herbs[5:6] if n > 5 else []

        herbs_output = []
        for i, herb in enumerate(sorted_herbs):
            if i == 0:
                role = "君"
            elif i < 3:
                role = "臣"
            elif i < 5:
                role = "佐"
            else:
                role = "使"

            herbs_output.append({
                "id": herb.get("id", ""),
                "name": herb.get("name_cn", herb.get("id", "")),
                "dosage": dosages.get(herb.get("id", ""), 0.0),
                "role": role,
                "efficacy_score": herb.get("efficacy_score", 0.0),
                "safety_index": herb.get("safety_index", 0.9),
            })

        # 结构合规度评分
        structure_score = self._evaluate_structure_compliance(
            sorted_herbs, rule, dosages
        )

        return FrameworkResult(
            product_form=product_form,
            total_dosage_g=rule.total_dosage_g,
            herbs=herbs_output,
            jun_herbs=[h.get("name", "") for h in jun],
            chen_herbs=[h.get("name", "") for h in chen],
            zuo_herbs=[h.get("name", "") for h in zuo],
            shi_herb=shi[0].get("name", "") if shi else "",
            structure_score=structure_score,
            rule_violations=violations,
            target_effects=effects,
            target_group=target_group,
        )

    async def _select_candidate_herbs(
        self, effects: List[str], limit: int
    ) -> List[Dict]:
        """从 HerbKnowledgeService 检索候选药材"""
        try:
            from ..ai.algorithms.herb_knowledge_service import get_global_herb_knowledge
            hk = get_global_herb_knowledge()
            if hk is None:
                return []

            all_herbs = await hk.get_all_herbs()
            if not all_herbs:
                return []

            # 按功效评分排序
            scored = []
            for herb in all_herbs:
                total_score = sum(
                    herb.efficacy_scores.get(e, 0) for e in effects
                )
                if total_score > 0:
                    scored.append({
                        "id": herb.herb_id,
                        "name_cn": herb.name_cn,
                        "efficacy_score": total_score / len(effects),
                        "safety_index": herb.safety_index,
                        "cost_per_gram": herb.cost_per_gram,
                        "dosage_min": herb.dosage_min,
                        "dosage_max": herb.dosage_max,
                        "dosage_step": herb.dosage_step,
                        "synergy_partners": herb.synergy_partners,
                        "antagonistic_pairs": herb.antagonistic_pairs,
                    })

            scored.sort(key=lambda x: x["efficacy_score"], reverse=True)
            return scored[:limit]

        except Exception as e:
            logger.warning(f"[FrameworkEngine] HerbKnowledgeService 加载失败: {e}")
            return []

    async def _fallback_select_herbs(
        self, effects: List[str], limit: int
    ) -> List[Dict]:
        """降级：使用内置知识库"""
        try:
            from ..ai.algorithms.bayesian_formula_optimizer import _BUILTIN_HERBS, _EFFICACY_TO_HERBS
            candidate_set = {}
            for effect in effects:
                if effect in _EFFICACY_TO_HERBS:
                    for hid in _EFFICACY_TO_HERBS[effect]:
                        if hid in _BUILTIN_HERBS:
                            score = _BUILTIN_HERBS[hid].efficacy_scores.get(effect, 0)
                            candidate_set[hid] = max(candidate_set.get(hid, 0), score)

            herbs = []
            for hid, score in sorted(candidate_set.items(), key=lambda x: -x[1])[:limit]:
                herb = _BUILTIN_HERBS[hid]
                herbs.append({
                    "id": herb.herb_id,
                    "name_cn": herb.name_cn,
                    "efficacy_score": score,
                    "safety_index": herb.safety_index,
                    "cost_per_gram": herb.cost_per_gram,
                    "dosage_min": herb.dosage_min,
                    "dosage_max": herb.dosage_max,
                    "dosage_step": herb.dosage_step,
                    "synergy_partners": herb.synergy_partners,
                    "antagonistic_pairs": herb.antagonistic_pairs,
                })
            return herbs
        except Exception as e:
            logger.error(f"[FrameworkEngine] 内置知识库加载失败: {e}")
            return []

    def _assign_roles(
        self, herbs: List[Dict], effects: List[str]
    ) -> List[Dict]:
        """按功效权重 + 安全性分配君臣佐使角色"""
        # 排序：功效分高 + 安全性高优先
        scored = sorted(herbs, key=lambda h: (
            h.get("efficacy_score", 0) * 0.6 +
            h.get("safety_index", 0) * 0.4
        ), reverse=True)
        return scored[:6]  # 最多6味

    def _calculate_dosages(
        self, herbs: List[Dict], rule: Any
    ) -> Dict[str, float]:
        """
        计算精确剂量

        优先使用 MILPSolver，不可行时回退到按比例分配
        """
        if len(herbs) < 1:
            return {}

        try:
            from .lp_solver import MILPSolver, HerbNutritionData

            herb_data = {}
            for herb in herbs:
                herb_data[herb["id"]] = HerbNutritionData(
                    herb_id=herb["id"],
                    name_cn=herb["name_cn"],
                    cost_per_gram=herb.get("cost_per_gram", 0.1),
                    nutrition_per_100g={},  # 暂无营养数据时为空
                    dosage_min=herb.get("dosage_min", 1.0),
                    dosage_max=herb.get("dosage_max", 30.0),
                    dosage_step=herb.get("dosage_step", 1.0),
                )

            solver = MILPSolver(herb_data)
            result = solver.solve(
                selected_herbs=[h["id"] for h in herbs],
                total_dosage=rule.total_dosage_g,
            )

            if result.feasible:
                logger.info(
                    f"[FrameworkEngine] MILP求解成功: {len(result.ratios)} 味, "
                    f"成本={result.min_cost:.2f}元"
                )
                return result.ratios

        except Exception as e:
            logger.warning(f"[FrameworkEngine] MILP求解失败，使用比例分配: {e}")

        # 回退：等比例分配
        n = len(herbs)
        dosage_per_herb = rule.total_dosage_g / n
        return {h["id"]: round(dosage_per_herb, 1) for h in herbs}

    def _evaluate_structure_compliance(
        self, herbs: List[Dict], rule: Any, dosages: Dict[str, float]
    ) -> float:
        """
        评估君臣佐使结构合规度 (0~1)

        评分规则：
        1. 剂量递减检查: 君药中位剂量 >= 臣药中位剂量 >= 佐药中位剂量
        2. 数量合理性: 君药1-2, 臣药2-3, 佐药1-2, 使药0-1
        3. 剂量跨度: 君药最高剂量不应超过使药的10倍
        """
        n = len(herbs)
        if n < 3:
            return 0.0

        # 按剂量降序排序
        sorted_herbs = sorted(
            herbs,
            key=lambda h: dosages.get(h.get("id", ""), 0),
            reverse=True,
        )

        # 分组
        jun_end = min(2, n)
        chen_end = min(jun_end + 3, n)
        zuo_end = min(chen_end + 2, n)

        groups = [
            ("君药", sorted_herbs[:jun_end]),
            ("臣药", sorted_herbs[jun_end:chen_end]),
            ("佐药", sorted_herbs[chen_end:zuo_end]),
            ("使药", sorted_herbs[zuo_end:]),
        ]

        score = 0.0
        parts = 0

        # 1. 剂量递减检查
        group_medians = []
        for name, group in groups:
            if group:
                dosages_list = [
                    dosages.get(h.get("id", ""), 0) for h in group
                ]
                if dosages_list:
                    group_medians.append((name, sorted(dosages_list)[len(dosages_list) // 2]))

        for i in range(len(group_medians) - 1):
            if group_medians[i][1] >= group_medians[i + 1][1]:
                score += 0.25
            parts += 0.25

        # 2. 数量合理性
        group_sizes = [(name, len(group)) for name, group in groups]
        ideal_sizes = [
            ("君药", (1, 2)),
            ("臣药", (2, 3)),
            ("佐药", (1, 2)),
            ("使药", (0, 1)),
        ]
        for (name, size), (ideal_name, (lo, hi)) in zip(group_sizes, ideal_sizes):
            if lo <= size <= hi:
                score += 0.15
            elif abs(size - ((lo + hi) // 2)) <= 1:
                score += 0.08
            parts += 0.15

        # 3. 剂量跨度
        if sorted_herbs:
            max_dose = dosages.get(sorted_herbs[0].get("id", ""), 0)
            min_dose = dosages.get(sorted_herbs[-1].get("id", ""), 0)
            if min_dose > 0 and max_dose / min_dose <= 10:
                score += 0.15
            parts += 0.15

        return round(score / max(parts, 1), 3) if parts > 0 else 0.0

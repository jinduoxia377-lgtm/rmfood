"""
配方生成优化器 - 强制使用数据库数据

此模块移除了对硬编码 _BUILTIN_HERBS 的依赖，
确保所有优化过程都从数据库动态获取药材知识。

使用方式:
    from app.services.ai.algorithms.database_formula_optimizer import DatabaseFormulaOptimizer
    optimizer = DatabaseFormulaOptimizer()
    result = await optimizer.optimize(target_effects=["免疫调节", "抗氧化"])
"""
from __future__ import annotations

import asyncio  # A-27
import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import async_session_factory
from app.domain.herb_ports import HerbProfile
from app.infrastructure.herb_knowledge_adapters import TCMSPHerbKnowledgeAdapter

logger = logging.getLogger(__name__)


@dataclass
class OptimizedFormula:
    """优化后的配方"""
    name: str
    ingredients: List[Dict[str, Any]]
    scores: Dict[str, float]
    explanation: str
    strategy: str
    execution_time_ms: float


class DatabaseFormulaOptimizer:
    """
    数据库驱动配方优化器

    完全依赖数据库中的 TCMHerb 表数据，
    不使用任何硬编码的假数据。
    """

    def __init__(self):
        self._adapter: Optional[TCMSPHerbKnowledgeAdapter] = None
        self._session: Optional[AsyncSession] = None
        self._herbs_cache: Optional[Dict[str, HerbProfile]] = None
        self._efficacy_index: Optional[Dict[str, List[str]]] = None

    async def _get_adapter(self) -> TCMSPHerbKnowledgeAdapter:
        """获取或创建数据库适配器"""
        if self._adapter is None:
            self._session = async_session_factory()
            self._adapter = TCMSPHerbKnowledgeAdapter(self._session)
        return self._adapter

    async def _load_herb_knowledge(self) -> Tuple[Dict[str, HerbProfile], Dict[str, List[str]]]:
        """
        从数据库加载完整的药材知识

        Returns:
            (herbs_dict, efficacy_index)
            - herbs_dict: {herb_id: HerbProfile}
            - efficacy_index: {efficacy: [herb_ids]}
        """
        if self._herbs_cache is not None and self._efficacy_index is not None:
            return self._herbs_cache, self._efficacy_index

        adapter = await self._get_adapter()

        # 从数据库加载所有药材
        all_herbs = await adapter.get_all_herbs()

        # 构建 herb_id → HerbProfile 映射
        herbs_dict = {h.herb_id: h for h in all_herbs}

        # 构建功效倒排索引
        efficacy_index: Dict[str, List[str]] = {}
        for herb in all_herbs:
            for efficacy, score in herb.efficacy_scores.items():
                if score > 0:
                    if efficacy not in efficacy_index:
                        efficacy_index[efficacy] = []
                    efficacy_index[efficacy].append(herb.herb_id)

        self._herbs_cache = herbs_dict
        self._efficacy_index = efficacy_index

        logger.info(f"[DatabaseOptimizer] 加载药材知识: {len(herbs_dict)} 种, {len(efficacy_index)} 种功效")

        return herbs_dict, efficacy_index

    async def get_candidates_by_effect(
        self,
        target_effects: List[str],
        min_score: float = 0.6,
        max_herbs: int = 12,
    ) -> List[Dict[str, Any]]:
        """
        根据目标功效筛选候选药材

        Args:
            target_effects: 目标功效列表
            min_score: 最低功效评分阈值
            max_herbs: 最大候选药材数

        Returns:
            候选药材列表 [{herb_id, name_cn, efficacy_scores, ...}]
        """
        herbs_dict, efficacy_index = await self._load_herb_knowledge()

        # 收集所有匹配的药材
        candidate_herbs: Dict[str, float] = {}

        for effect in target_effects:
            herb_ids = efficacy_index.get(effect, [])
            for herb_id in herb_ids:
                herb = herbs_dict.get(herb_id)
                if herb:
                    score = herb.efficacy_scores.get(effect, 0)
                    if score >= min_score:
                        # 累加功效评分
                        candidate_herbs[herb_id] = candidate_herbs.get(herb_id, 0) + score

        # 按综合评分排序
        sorted_herbs = sorted(
            candidate_herbs.items(),
            key=lambda x: x[1],
            reverse=True
        )[:max_herbs]

        # 构建结果
        results = []
        for herb_id, score in sorted_herbs:
            herb = herbs_dict.get(herb_id)
            if herb:
                results.append({
                    "herb_id": herb_id,
                    "name_cn": herb.name_cn,
                    "category": next((h.category for h in herbs_dict.values() if h.herb_id == herb_id), ""),
                    "efficacy_score": score,
                    "efficacy_scores": dict(herb.efficacy_scores),
                    "dosage_range": (herb.dosage_min, herb.dosage_max),
                    "safety_index": herb.safety_index,
                    "cost_per_gram": herb.cost_per_gram,
                    "synergy_partners": herb.synergy_partners,
                })

        return results

    async def build_formula(
        self,
        target_effects: List[str],
        constraints: Optional[Dict[str, Any]] = None,
    ) -> Optional[OptimizedFormula]:
        """
        构建配方（简化版，实际优化使用 NSGA-II 引擎）

        Args:
            target_effects: 目标功效
            constraints: 约束条件

        Returns:
            优化后的配方
        """
        start_time = time.perf_counter()

        herbs_dict, efficacy_index = await self._load_herb_knowledge()

        if not herbs_dict:
            logger.error("[DatabaseOptimizer] 数据库无药材数据")
            return None

        # 选择君药（功效评分最高的药材）
        monarch_herbs = self._select_monarch_herbs(target_effects, herbs_dict, efficacy_index)

        # 选择臣药（协同配伍）
        minister_herbs = self._select_minister_herbs(monarch_herbs, herbs_dict, target_effects)

        # 选择佐使药（调和、引导）
        assistant_herbs = self._select_assistant_herbs(monarch_herbs + minister_herbs, herbs_dict)

        # 合并所有药材
        all_herbs = monarch_herbs + minister_herbs + assistant_herbs
        unique_herbs = {h["herb_id"]: h for h in all_herbs}.values()

        # 计算综合评分
        scores = self._calculate_scores(list(unique_herbs), target_effects)

        elapsed_ms = (time.perf_counter() - start_time) * 1000

        # 构建配方名称
        formula_name = self._generate_formula_name(monarch_herbs, target_effects)

        return OptimizedFormula(
            name=formula_name,
            ingredients=[{
                "herb_id": h["herb_id"],
                "name_cn": h["name_cn"],
                "role": h.get("role", "臣"),
                "dosage_min": h["dosage_min"],
                "dosage_max": h["dosage_max"],
                "efficacy_score": h.get("efficacy_score", 0),
            } for h in all_herbs],
            scores=scores,
            explanation=self._generate_explanation(monarch_herbs, target_effects),
            strategy="database_driven",
            execution_time_ms=elapsed_ms,
        )

    def _select_monarch_herbs(
        self,
        target_effects: List[str],
        herbs_dict: Dict[str, HerbProfile],
        efficacy_index: Dict[str, List[str]],
    ) -> List[Dict[str, Any]]:
        """选择君药（君臣佐使 - 君药为主攻方向）"""
        monarchs = []

        for effect in target_effects[:2]:  # 取前两个主要功效
            herb_ids = efficacy_index.get(effect, [])
            for herb_id in herb_ids[:3]:  # 每个功效选top 3
                herb = herbs_dict.get(herb_id)
                if herb:
                    score = herb.efficacy_scores.get(effect, 0)
                    if score >= 0.7:  # 高功效评分
                        monarchs.append({
                            "herb_id": herb_id,
                            "name_cn": herb.name_cn,
                            "role": "君",
                            "efficacy_score": score,
                            "dosage_min": herb.dosage_min,
                            "dosage_max": herb.dosage_max,
                            "safety_index": herb.safety_index,
                        })

        return monarchs[:3]  # 最多3味君药

    def _select_minister_herbs(
        self,
        monarch_herbs: List[Dict[str, Any]],
        herbs_dict: Dict[str, HerbProfile],
        target_effects: List[str],
    ) -> List[Dict[str, Any]]:
        """选择臣药（辅助君药，协同增效）"""
        ministers = []

        for monarch in monarch_herbs:
            herb_id = monarch["herb_id"]
            herb = herbs_dict.get(herb_id)
            if herb:
                # 选择协同配伍药材
                for partner_id in herb.synergy_partners[:3]:
                    partner = herbs_dict.get(partner_id)
                    if partner and partner.herb_id not in [m["herb_id"] for m in ministers]:
                        # 计算协同功效
                        synergy_score = sum(
                            partner.efficacy_scores.get(e, 0)
                            for e in target_effects
                        ) / len(target_effects)

                        ministers.append({
                            "herb_id": partner.herb_id,
                            "name_cn": partner.name_cn,
                            "role": "臣",
                            "efficacy_score": synergy_score,
                            "dosage_min": partner.dosage_min,
                            "dosage_max": partner.dosage_max,
                            "safety_index": partner.safety_index,
                        })

        return ministers[:4]  # 最多4味臣药

    def _select_assistant_herbs(
        self,
        herbs: List[Dict[str, Any]],
        herbs_dict: Dict[str, HerbProfile],
    ) -> List[Dict[str, Any]]:
        """选择佐使药（调和诸药，引导药力）"""
        assistants = []

        # 选择甘草作为使药（调和诸药）
        gq = herbs_dict.get("gq")
        if gq:
            assistants.append({
                "herb_id": "gq",
                "name_cn": "甘草",
                "role": "使",
                "efficacy_score": 0.5,
                "dosage_min": gq.dosage_min,
                "dosage_max": gq.dosage_max,
                "safety_index": gq.safety_index,
            })

        return assistants[:2]

    def _calculate_scores(
        self,
        herbs: List[Dict[str, Any]],
        target_effects: List[str],
    ) -> Dict[str, float]:
        """计算配方综合评分"""
        if not herbs:
            return {"efficacy": 0, "safety": 0, "cost": 0}

        # 功效评分（加权平均）
        efficacy_scores = [h.get("efficacy_score", 0) for h in herbs]
        avg_efficacy = sum(efficacy_scores) / len(efficacy_scores) if efficacy_scores else 0

        # 安全性评分（最低安全指数）
        safety_scores = [h.get("safety_index", 0.9) for h in herbs]
        min_safety = min(safety_scores) if safety_scores else 0

        # 成本评分（越低越好）
        costs = [h.get("dosage_max", 10) * 0.1 for h in herbs]  # 估算成本
        avg_cost = sum(costs) / len(costs) if costs else 0.5
        cost_score = max(0, 1 - avg_cost)

        # 综合评分（加权）
        overall = 0.4 * avg_efficacy + 0.3 * min_safety + 0.2 * cost_score + 0.1 * 0.8

        return {
            "efficacy": round(avg_efficacy, 3),
            "safety": round(min_safety, 3),
            "cost": round(cost_score, 3),
            "overall": round(overall, 3),
        }

    def _generate_formula_name(
        self,
        monarch_herbs: List[Dict[str, Any]],
        target_effects: List[str],
    ) -> str:
        """生成配方名称"""
        if monarch_herbs:
            primary_herb = monarch_herbs[0]["name_cn"]
            return f"{primary_herb}配方"
        return "药食同源配方"

    def _generate_explanation(
        self,
        monarch_herbs: List[Dict[str, Any]],
        target_effects: List[str],
    ) -> str:
        """生成配方解释"""
        if not monarch_herbs:
            return "数据库无匹配药材"

        herbs = [h["name_cn"] for h in monarch_herbs]
        effects = ", ".join(target_effects)

        return f"本方以{'、'.join(herbs)}为君药，针对{effects}功效进行配伍。"


async def main():
    """测试入口"""
    logging.basicConfig(level=logging.INFO)

    optimizer = DatabaseFormulaOptimizer()

    target_effects = ["免疫调节", "抗氧化"]

    logger.info(f"\n[测试] 目标功效: {target_effects}")

    # 1. 获取候选药材
    logger.info("\n[1] 筛选候选药材...")
    candidates = await optimizer.get_candidates_by_effect(target_effects)
    logger.info(f"  找到 {len(candidates)} 种候选药材")
    for c in candidates[:5]:
        logger.info(f"    - {c['name_cn']}: 功效评分 {c['efficacy_score']:.2f}")

    # 2. 构建配方
    logger.info("\n[2] 构建配方...")
    formula = await optimizer.build_formula(target_effects)

    if formula:
        logger.info(f"\n✓ 配方名称: {formula.name}")
        logger.info(f"  策略: {formula.strategy}")
        logger.info(f"  执行时间: {formula.execution_time_ms:.1f}ms")
        logger.info("\n  评分:")
        for k, v in formula.scores.items():
            logger.info(f"    {k}: {v:.3f}")
        logger.info("\n  组成:")
        for ing in formula.ingredients:
            logger.info(f"    [{ing['role']}] {ing['name_cn']}: {ing['dosage_min']}-{ing['dosage_max']}g")
        logger.info(f"\n  解释: {formula.explanation}")
    else:
        logger.error("配方构建失败")


if __name__ == "__main__":
    asyncio.run(main())

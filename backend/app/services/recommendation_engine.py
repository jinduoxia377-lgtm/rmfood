# -*- coding: utf-8 -*-
"""
多维度配方推荐引擎 v3.0

评分维度：
- 协同效应匹配 (30%)
- 成分重叠度 Jaccard (25%)
- 时间衰减 (20%)
- 用户偏好 (15%)
- 功效交集 (10%)
"""
import logging
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class RecommendationScore:
    """单个配方的多维评分"""
    formula_id: int
    name: str
    total_score: float
    synergy_score: float
    ingredient_overlap: float
    temporal_score: float
    user_pref_score: float
    effect_match: float
    match_reasons: List[str] = field(default_factory=list)
    target_effects: List[str] = field(default_factory=list)
    ingredient_count: int = 0
    overall_score: float = 0.0
    created_at: str = ""


class ScoreCalculator:
    """各维度评分计算器"""

    WEIGHTS = {
        "synergy": 0.30,
        "ingredient_overlap": 0.25,
        "temporal": 0.20,
        "user_pref": 0.15,
        "effect_match": 0.10,
    }
    HALF_LIFE_DAYS = 180

    @classmethod
    def calculate_synergy_score(
        cls,
        source_ingredients: List[str],
        target_ingredients: List[str],
    ) -> float:
        """协同效应匹配分（共享成分基础分）"""
        if not source_ingredients or not target_ingredients:
            return 0.5
        set_a = set(source_ingredients)
        set_b = set(target_ingredients)
        shared = len(set_a & set_b)
        union = len(set_a | set_b)
        base = shared / union if union > 0 else 0
        # 共享成分越多，协同分越高
        return min(1.0, base * 1.2)

    @classmethod
    def calculate_ingredient_overlap(cls, ing_a: List[str], ing_b: List[str]) -> float:
        """Jaccard 相似度"""
        if not ing_a or not ing_b:
            return 0.0
        set_a = set(ing_a)
        set_b = set(ing_b)
        return len(set_a & set_b) / len(set_a | set_b) if (set_a | set_b) else 0.0

    @classmethod
    def calculate_temporal_score(cls, created_at: datetime) -> float:
        """时间衰减：越新越高"""
        now = datetime.now(timezone.utc)
        days_old = max(0, (now - created_at.replace(tzinfo=timezone.utc)).days)
        return max(0.0, min(1.0, math.pow(0.5, days_old / cls.HALF_LIFE_DAYS)))

    @classmethod
    def calculate_effect_match(
        cls,
        source_effects: List[str],
        target_effects: List[str],
    ) -> float:
        """功效交集/并集"""
        if not source_effects or not target_effects:
            return 0.3
        set_a = set(source_effects)
        set_b = set(target_effects)
        return len(set_a & set_b) / len(set_a | set_b) if (set_a | set_b) else 0.0

    @classmethod
    def calculate_total(cls, **scores: float) -> float:
        """加权总分"""
        total = sum(scores.get(k, 0.0) * w for k, w in cls.WEIGHTS.items())
        return round(total, 4)


class RecommendationEngine:
    """多维度配方推荐引擎"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def recommend(
        self,
        source_formula: Any,
        user_id: int,
        target_effects: Optional[List[str]] = None,
        exclude_id: Optional[int] = None,
        limit: int = 6,
    ) -> List[RecommendationScore]:
        """生成推荐列表"""
        from ...core.multi_tenant.tenant_security import current_tenant_id
        from ...models.formula import Formula

        org_id = current_tenant_id()

        # 提取源配方信息
        source_ingredients = [
            ing.name for ing in (source_formula.ingredients or [])
            if hasattr(ing, "name") and ing.name
        ]
        source_effects = source_formula.target_effects or []

        # 查询候选配方
        query = select(Formula).where(
            Formula.organization_id == org_id,
            Formula.status == "published",
        )
        if exclude_id:
            query = query.where(Formula.id != exclude_id)
        if target_effects:
            effect_conds = [Formula.target_effects.contains([e]) for e in target_effects]
            query = query.where(*effect_conds)
        query = query.order_by(Formula.created_at.desc()).limit(limit * 3)

        result = await self.db.execute(query)
        candidates = result.scalars().all()

        # 用户历史配方
        history_q = select(Formula.id).where(
            Formula.creator_id == user_id, Formula.status == "published"
        )
        history_ids = {(await self.db.execute(history_q)).scalars().all()}

        # 评分
        scored: List[Tuple[float, RecommendationScore]] = []
        for f in candidates:
            cand_ingredients = [
                ing.name for ing in (f.ingredients or [])
                if hasattr(ing, "name") and ing.name
            ]
            cand_effects = f.target_effects or []

            synergy_s = ScoreCalculator.calculate_synergy_score(source_ingredients, cand_ingredients)
            overlap_s = ScoreCalculator.calculate_ingredient_overlap(source_ingredients, cand_ingredients)
            temporal_s = ScoreCalculator.calculate_temporal_score(
                f.created_at or datetime.now(timezone.utc)
            )
            pref_s = 0.85 if f.id in history_ids else 0.5
            effect_s = ScoreCalculator.calculate_effect_match(source_effects, cand_effects)

            total = ScoreCalculator.calculate_total(
                synergy=synergy_s,
                ingredient_overlap=overlap_s,
                temporal=temporal_s,
                user_pref=pref_s,
                effect_match=effect_s,
            )

            reasons = self._generate_reasons(source_effects, cand_effects, cand_ingredients)

            rec = RecommendationScore(
                formula_id=f.id,
                name=f.name or "未命名配方",
                total_score=total,
                synergy_score=round(synergy_s, 3),
                ingredient_overlap=round(overlap_s, 3),
                temporal_score=round(temporal_s, 3),
                user_pref_score=round(pref_s, 3),
                effect_match=round(effect_s, 3),
                match_reasons=reasons,
                target_effects=cand_effects,
                ingredient_count=len(cand_ingredients),
                overall_score=f.overall_score or 0,
                created_at=f.created_at.isoformat() if f.created_at else "",
            )
            scored.append((total, rec))

        # 按总分降序，取 top limit
        scored.sort(key=lambda x: x[0], reverse=True)
        return [r for _, r in scored[:limit]]

    def _generate_reasons(
        self,
        src_effects: List[str],
        tgt_effects: List[str],
        tgt_ingredients: List[str],
    ) -> List[str]:
        """生成自然语言推荐理由"""
        reasons = []
        common_effects = set(src_effects) & set(tgt_effects)
        if common_effects:
            reasons.append(f"共同功效：{', '.join(list(common_effects)[:3])}")
        if len(tgt_ingredients) >= 3:
            reasons.append(f"成分丰富（{len(tgt_ingredients)}种原料）")
        return reasons or ["与您近期的配方风格相似"]

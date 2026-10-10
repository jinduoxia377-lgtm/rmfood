"""
Business Metrics Service — 药食同源业务专属分析

提供以下业务指标：
- 配方生命周期转化漏斗（草稿 → 审核 → 发布 → 归档）
- 食材关联分析（频繁共现项对）
- AI 生成质量评估（采纳率 / 平均成分数）
- 药食同源占比统计

用法:
    from app.core.analytics_reports.business_metrics import BusinessMetricsService

    service = BusinessMetricsService(db)
    funnel = await service.get_formula_lifecycle_funnel()
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import text

logger = logging.getLogger(__name__)


class BusinessMetricsService:
    """药食同源业务专属指标分析服务。"""

    def __init__(self, db):
        self.db = db

    # ── 1. 配方生命周期转化漏斗 ──────────────────────────────

    async def get_formula_lifecycle_funnel(
        self,
        days: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        配方从草稿 → 审核中 → 已发布 → 已归档的转化漏斗。

        Args:
            days: 仅统计最近 N 天创建的配方；None 则统计全部。
        """
        stage_order = [
            ("draft", "草稿"),
            ("pending_review", "审核中"),
            ("approved", "已发布"),
            ("archived", "已归档"),
        ]

        try:
            if days is not None:
                # formulas.created_at 为 naive timestamp，绑定 naive UTC
                cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
                result = await self.db.execute(text("""
                    SELECT status, COUNT(*) as cnt
                    FROM formulas
                    WHERE created_at >= :cutoff
                    GROUP BY status
                """), {"cutoff": cutoff})
            else:
                result = await self.db.execute(text("""
                    SELECT status, COUNT(*) as cnt
                    FROM formulas
                    GROUP BY status
                """))
            count_map = {row.status: row.cnt for row in result.fetchall()}
        except Exception as e:
            logger.warning("配方漏斗查询失败: %s", e)
            count_map = {}

        total = sum(count_map.values())
        funnel: List[Dict[str, Any]] = []
        prev_count = None

        for status, label in stage_order:
            count = count_map.get(status, 0)
            if prev_count is not None and prev_count > 0:
                rate = round(count / prev_count * 100, 1)
            else:
                rate = None
            funnel.append({
                "stage": status,
                "label": label,
                "count": count,
                "conversion_rate": rate,
            })
            if count > 0:
                prev_count = count

        return {
            "funnel": funnel,
            "total_conversion": round(funnel[-1]["count"] / total * 100, 1) if total > 0 else 0,
            "total_formulas": total,
        }

    # ── 2. 食材关联分析（频繁共现） ─────────────────────────

    async def get_ingredient_associations(
        self,
        min_support: int = 3,
        limit: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        找出经常一起使用的食材对（简化版 Apriori）。

        返回格式:
        [
            {"ingredient_a": "茯苓", "ingredient_b": "山药", "co_occurrence": 156},
            ...
        ]
        """
        try:
            result = await self.db.execute(text("""
                SELECT
                    i1.name as ingredient_a,
                    i2.name as ingredient_b,
                    COUNT(DISTINCT f.id) as co_occurrence
                FROM formulas f
                JOIN formula_ingredients fi1 ON f.id = fi1.formula_id
                JOIN ingredients i1 ON fi1.ingredient_id = i1.id
                JOIN formula_ingredients fi2 ON f.id = fi2.formula_id
                JOIN ingredients i2 ON fi2.ingredient_id = i2.id
                WHERE i1.id < i2.id
                GROUP BY i1.name, i2.name
                HAVING COUNT(DISTINCT f.id) >= :min_support
                ORDER BY co_occurrence DESC
                LIMIT :limit
            """), {"min_support": min_support, "limit": limit})
            return [dict(row._mapping) for row in result.fetchall()]
        except Exception as e:
            logger.warning("食材关联分析失败: %s", e)
            return []

    # ── 3. AI 生成质量评估 ──────────────────────────────────

    async def get_ai_generation_quality(self, days: int = 30) -> Dict[str, Any]:
        """
        AI 生成质量指标：采纳率、平均成分数。

        返回格式:
        {
            "total_generations": 156,
            "adopted_count": 42,
            "adoption_rate": 26.9,
            "avg_components_per_generation": 8.1,
        }
        """
        try:
            # ai_generations.created_at 为 naive timestamp，绑定 naive UTC
            cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
            result = await self.db.execute(text("""
                SELECT
                    COUNT(*)                                              as total_generations,
                    SUM(CASE WHEN f.status = 'approved' THEN 1 ELSE 0 END) as adopted_count,
                    AVG(
                        (SELECT COUNT(*) FROM formula_ingredients fi
                         WHERE fi.formula_id = ag.formula_id)
                    )                                                    as avg_components
                FROM ai_generations ag
                LEFT JOIN formulas f ON ag.formula_id = f.id
                WHERE ag.created_at >= :cutoff
            """), {"cutoff": cutoff})
            row = result.fetchone()
            if row is None:
                return {
                    "total_generations": 0,
                    "adopted_count": 0,
                    "adoption_rate": 0.0,
                    "avg_experiments_per_generation": 0.0,
                    "avg_components_per_generation": 0.0,
                }
            total = int(row.total_generations or 0)
            adopted = int(row.adopted_count or 0)
            return {
                "total_generations": total,
                "adopted_count": adopted,
                "adoption_rate": round(adopted / total * 100, 1) if total > 0 else 0.0,
                "avg_experiments_per_generation": 0.0,
                "avg_components_per_generation": round(float(row.avg_components or 0), 1),
            }
        except Exception as e:
            logger.warning("AI 生成质量评估失败: %s", e)
            return {
                "total_generations": 0,
                "adopted_count": 0,
                "adoption_rate": 0.0,
                "avg_experiments_per_generation": 0.0,
                "avg_components_per_generation": 0.0,
            }

    # ── 4. 药食同源占比 ─────────────────────────────────────

    async def get_food_homology_ratio(
        self,
        categories: Optional[List[str]] = None,
        statuses: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        统计含药食同源食材的配方占比。

        返回格式:
        {
            "total_formulas": 1234,
            "food_homology_formulas": 567,
            "ratio_percent": 46.0,
        }
        """
        try:
            # 构建动态过滤条件（参数化，防 SQL 注入）
            conditions = ["i.is_food_homology = true"]
            params: Dict[str, Any] = {}

            if categories:
                conditions.append("f.category IN :cats")
                params["cats"] = tuple(categories)

            if statuses:
                conditions.append("f.status IN :st")
                params["st"] = tuple(statuses)

            where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

            result = await self.db.execute(text(f"""
                SELECT
                    (SELECT COUNT(*) FROM formulas)
                                                     as total,
                    (SELECT COUNT(DISTINCT f.id)
                     FROM formulas f
                     JOIN formula_ingredients fi ON f.id = fi.formula_id
                     JOIN ingredients i ON fi.ingredient_id = i.id
                     {where_clause})
                                                     as fh_count
            """), params)
            row = result.fetchone()
            total = int(row.total or 0)
            fh_count = int(row.fh_count or 0)
            return {
                "total_formulas": total,
                "food_homology_formulas": fh_count,
                "ratio_percent": round(fh_count / total * 100, 1) if total > 0 else 0.0,
            }
        except Exception as e:
            logger.warning("药食同源占比查询失败: %s", e)
            return {"total_formulas": 0, "food_homology_formulas": 0, "ratio_percent": 0.0}

    # ── 5. 综合业务概览 ─────────────────────────────────────

    async def get_business_overview(
        self,
        days: int = 30,
        categories: Optional[List[str]] = None,
        statuses: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """聚合所有业务指标，供 BusinessInsightsTab 一次性拉取。"""
        funnel, assoc, quality, homology = await asyncio.gather(
            self.get_formula_lifecycle_funnel(days=days),
            self.get_ingredient_associations(limit=20),
            self.get_ai_generation_quality(days=days),
            self.get_food_homology_ratio(categories=categories, statuses=statuses),
        )
        return {
            "lifecycle_funnel": funnel,
            "ingredient_associations": assoc,
            "ai_quality": quality,
            "food_homology_ratio": homology,
        }

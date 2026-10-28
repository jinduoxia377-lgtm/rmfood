"""
搜索分析服务

用于 Potion AI VFT x RMFOOD 深度融合方案。
提供搜索热词、趋势分析、搜索行为分析、转化率追踪。
"""
import logging
from typing import Any, Dict, List

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class SearchAnalyticsService:
    """搜索分析服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_hot_searches(
        self,
        limit: int = 20,
        time_window_days: int = 7,
    ) -> List[Dict[str, Any]]:
        """
        获取热门搜索词

        基于 search_history 表统计最近 N 天的搜索词频率
        """
        result = await self.db.execute(
            text("""
                SELECT query, COUNT(*) as search_count, MAX(created_at) as last_searched
                FROM search_history
                WHERE created_at >= NOW() - make_interval(days => :days)
                GROUP BY query
                ORDER BY search_count DESC
                LIMIT :limit
            """),
            {"days": time_window_days, "limit": limit},
        )
        rows = result.fetchall()

        hot_searches = []
        for row in rows:
            hot_searches.append({
                "keyword": row[0],
                "search_count": row[1],
                "last_searched": row[2].isoformat() if row[2] else None,
                "trend": "rising" if row[1] > 5 else "stable",
            })

        return hot_searches

    async def get_search_trends(
        self,
        keyword: str,
        days: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        获取搜索词趋势

        返回每日搜索量时间序列
        """
        result = await self.db.execute(
            text("""
                SELECT DATE(created_at) as search_date, COUNT(*) as search_count
                FROM search_history
                WHERE query = :keyword
                  AND created_at >= NOW() - make_interval(days => :days)
                GROUP BY DATE(created_at)
                ORDER BY search_date
            """),
            {"keyword": keyword, "days": days},
        )
        rows = result.fetchall()

        return [
            {"date": row[0].isoformat() if hasattr(row[0], 'isoformat') else str(row[0]),
             "count": row[1]}
            for row in rows
        ]

    async def get_search_behavior_stats(
        self,
        days: int = 30,
    ) -> Dict[str, Any]:
        """
        获取搜索行为统计

        包括: 总搜索次数、独立用户数、平均结果数、零结果率等
        """
        stats = {}

        # 总搜索次数
        result = await self.db.execute(
            text(f"""
                SELECT COUNT(*) FROM search_history
                WHERE created_at >= NOW() - INTERVAL '{days} days'
            """)
        )
        stats["total_searches"] = result.scalar() or 0

        # 独立用户数
        result = await self.db.execute(
            text(f"""
                SELECT COUNT(DISTINCT user_id) FROM search_history
                WHERE created_at >= NOW() - INTERVAL '{days} days'
            """)
        )
        stats["unique_users"] = result.scalar() or 0

        # 平均结果数
        result = await self.db.execute(
            text(f"""
                SELECT AVG(result_count) FROM search_history
                WHERE created_at >= NOW() - INTERVAL '{days} days'
            """)
        )
        stats["avg_result_count"] = round(float(result.scalar() or 0), 2)

        # 零结果率
        result = await self.db.execute(
            text(f"""
                SELECT COUNT(*) FROM search_history
                WHERE created_at >= NOW() - INTERVAL '{days} days'
                  AND result_count = 0
            """)
        )
        zero_result_count = result.scalar() or 0
        total = stats["total_searches"] or 1
        stats["zero_result_rate"] = round(zero_result_count / total * 100, 2)

        # 搜索类型分布 (使用 search_type 列)
        result = await self.db.execute(
            text(f"""
                SELECT search_type, COUNT(*) as cnt
                FROM search_history
                WHERE created_at >= NOW() - INTERVAL '{days} days'
                GROUP BY search_type
                ORDER BY cnt DESC
            """)
        )
        rows = result.fetchall()
        stats["search_type_distribution"] = {row[0]: row[1] for row in rows}

        return stats

    async def get_search_conversion_rate(
        self,
        days: int = 30,
    ) -> Dict[str, Any]:
        """
        获取搜索转化率

        定义: 搜索后查看详情 / 总搜索次数
        """
        # 总搜索次数
        total_searches = await self.db.execute(
            text(f"""
                SELECT COUNT(*) FROM search_history
                WHERE created_at >= NOW() - INTERVAL '{days} days'
            """)
        )
        total = total_searches.scalar() or 1

        # 有详细查看的记录数 (通过 recent_views 表)
        result = await self.db.execute(
            text(f"""
                SELECT COUNT(DISTINCT sh.id)
                FROM search_history sh
                INNER JOIN search_recent_views srv ON sh.user_id = srv.user_id
                WHERE sh.created_at >= NOW() - INTERVAL '{days} days'
                  AND srv.created_at >= NOW() - INTERVAL '{days} days'
            """)
        )
        converted = result.scalar() or 0

        return {
            "total_searches": total,
            "converted": converted,
            "conversion_rate": round(converted / total * 100, 2),
        }

    async def get_popular_categories(
        self,
        days: int = 30,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        获取热门分类

        基于搜索词关联的分类统计
        """
        # 从 food_materials 和 retail_products 表统计
        result = await self.db.execute(
            text(f"""
                SELECT category, COUNT(*) as cnt
                FROM food_materials
                WHERE created_at >= NOW() - INTERVAL '{days} days'
                  AND review_status = 'approved'
                GROUP BY category
                ORDER BY cnt DESC
                LIMIT {limit}
            """)
        )
        rows = result.fetchall()

        return [
            {"category": row[0], "count": row[1]}
            for row in rows
        ]

    async def get_search_suggestion_stats(self) -> Dict[str, Any]:
        """
        获取搜索建议统计

        包括: 建议点击率、热门建议词等
        """
        # 简化版: 返回统计摘要
        return {
            "total_suggestions_shown": 0,  # 需要从前端埋点数据获取
            "top_suggested_keywords": [],
            "avg_click_through_rate": 0.0,
        }

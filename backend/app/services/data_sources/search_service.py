"""
统一搜索服务
整合 TCMSP + DFBP + 知识图谱的跨数据源搜索
"""
import logging
from typing import Any

logger = logging.getLogger(__name__)


class SearchService:
    """跨数据源统一搜索服务"""

    def __init__(self):
        from .dfbp_client import dfbp_service
        from .graph_service import graph_service
        from .tcmsp_client import tcmsp_service
        self.tcmsp = tcmsp_service
        self.dfbp = dfbp_service
        self.graph = graph_service

    async def unified_search(
        self,
        keyword: str,
        sources: list[str] | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        """
        跨数据源统一搜索。
        sources: ["herbs", "peptides", "graph"]，默认全部
        """
        if not keyword.strip():
            return {"herbs": [], "peptides": [], "graph_nodes": [], "total": 0}

        search_sources = sources or ["herbs", "peptides", "graph"]
        results: dict[str, Any] = {
            "herbs": [],
            "peptides": [],
            "graph_nodes": [],
        }

        if "herbs" in search_sources:
            try:
                results["herbs"] = await self._search_herbs(keyword, limit)
            except Exception as e:
                logger.warning(f"搜索药材失败: {e}")

        if "peptides" in search_sources:
            try:
                results["peptides"] = await self._search_peptides(keyword, limit)
            except Exception as e:
                logger.warning(f"搜索肽失败: {e}")

        if "graph" in search_sources:
            try:
                results["graph_nodes"] = await self.graph.search_nodes(keyword, limit=limit)
            except Exception as e:
                logger.warning(f"搜索图谱失败: {e}")

        results["total"] = (
            len(results["herbs"]) + len(results["peptides"]) + len(results["graph_nodes"])
        )
        return results

    async def _search_herbs(self, keyword: str, limit: int) -> list[dict]:
        """从本地数据库搜索药材（供 unified_search 调用）"""
        from sqlalchemy import or_, select

        from app.core.database.session import async_session_factory
        from app.models.models import TCMHerb

        async with async_session_factory() as session:
            like_pattern = f"%{keyword}%"
            query = (
                select(TCMHerb)
                .where(
                    or_(
                        TCMHerb.name_cn.ilike(like_pattern),
                        TCMHerb.name_pinyin.ilike(like_pattern),
                        TCMHerb.name_latin.ilike(like_pattern),
                        TCMHerb.effects.ilike(like_pattern),
                    )
                )
                .limit(limit)
            )
            result = await session.execute(query)
            herbs = result.scalars().all()
            return [
                {
                    "id": h.id,
                    "name_cn": h.name_cn,
                    "name_latin": h.name_latin,
                    "category": h.category,
                    "is_food_homology": h.is_food_homology,
                    "source": "tcm_herbs",
                }
                for h in herbs
            ]

    async def _search_peptides(self, keyword: str, limit: int) -> list[dict]:
        """从本地数据库搜索肽序列"""
        from sqlalchemy import or_, select

        from app.core.database.session import async_session_factory
        from app.models.models import BioactivePeptide

        async with async_session_factory() as session:
            like_pattern = f"%{keyword}%"
            query = (
                select(BioactivePeptide)
                .where(
                    or_(
                        BioactivePeptide.sequence.ilike(like_pattern),
                        BioactivePeptide.source_protein.ilike(like_pattern),
                        BioactivePeptide.activity_type.ilike(like_pattern),
                    )
                )
                .limit(limit)
            )
            result = await session.execute(query)
            peptides = result.scalars().all()
            return [
                {
                    "id": p.id,
                    "sequence": p.sequence,
                    "source_protein": p.source_protein,
                    "activity_type": p.activity_type,
                    "source": "bioactive_peptides",
                }
                for p in peptides
            ]


# 全局实例
search_service = SearchService()

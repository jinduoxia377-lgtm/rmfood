"""
BM25 全文检索搜索器

基于 PostgreSQL 内置 FTS (Full-Text Search) 实现 BM25 排序。
替代原有的 LIKE 模糊匹配，提供更高质量的相关性排序。
"""
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class BM25Searcher:
    """PostgreSQL FTS BM25 搜索器"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def search_food_materials(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        食品原料 BM25 搜索

        字段权重: name_cn^4.0, aliases^3.0, effects^2.5, category^2.0,
                  description^1.0, sub_category^1.5
        """
        # 由于没有 search_vector 列，使用 ILIKE 模糊匹配 + 字段拼接权重
        # 构建搜索词：用空格分割，每个词都要匹配
        search_terms = [t for t in query.split() if t]
        if not search_terms:
            return []

        # 构建 WHERE 条件：至少匹配一个搜索词
        term_conditions = []
        for term in search_terms:
            term_conditions.append(f"""
                (
                    fm.name_cn ILIKE :term_{term} OR
                    fm.name_en ILIKE :term_{term} OR
                    fm.name_latin ILIKE :term_{term} OR
                    fm.category ILIKE :term_{term} OR
                    fm.sub_category ILIKE :term_{term} OR
                    fm.description ILIKE :term_{term} OR
                    fm.indications ILIKE :term_{term}
                )
            """)
            params[f"term_{term}"] = f"%{term}%"

        where_clause = " AND ".join(term_conditions)

        sql = text(f"""
            SELECT fm.id, fm.name_cn, fm.name_latin, fm.name_en,
                   fm.aliases, fm.category, fm.sub_category,
                   fm.food_homology, fm.toxicity_class,
                   fm.active_ingredients, fm.effects, fm.indications,
                   fm.ob_percent, fm.dl_value, fm.bioavailability_score,
                   fm.safe_dose_min, fm.safe_dose_max,
                   fm.contraindications, fm.interactions,
                   fm.regulatory_status, fm.approved_regions,
                   fm.max_daily_intake, fm.suppliers, fm.origin_countries,
                   fm.description, fm.image_url, fm.msds_url, fm.coa_url,
                   fm.source_db, fm.data_quality, fm.review_status,
                   fm.created_at, fm.updated_at
            FROM food_materials fm
            WHERE ({where_clause})
              AND fm.review_status = 'approved'
              AND fm.data_quality >= 0.3
        """)

        # 添加筛选条件
        conditions = []

        if filters:
            if filters.get("category"):
                conditions.append("fm.category = :category")
                params["category"] = filters["category"]
            if filters.get("food_homology") is not None:
                conditions.append("fm.food_homology = :food_homology")
                params["food_homology"] = filters["food_homology"]
            if filters.get("toxicity_class"):
                conditions.append("fm.toxicity_class = :toxicity_class")
                params["toxicity_class"] = filters["toxicity_class"]
            if filters.get("regulatory_status"):
                conditions.append("fm.regulatory_status = :regulatory_status")
                params["regulatory_status"] = filters["regulatory_status"]
            if filters.get("min_ob") is not None:
                conditions.append("fm.ob_percent >= :min_ob")
                params["min_ob"] = filters["min_ob"]
            if filters.get("min_data_quality") is not None:
                conditions.append("fm.data_quality >= :min_dq")
                params["min_dq"] = filters["min_data_quality"]

        if conditions:
            sql = text(str(sql)[:-1] + " AND " + " AND ".join(conditions) + "\n            ORDER BY fm.created_at DESC\n            LIMIT :limit OFFSET :offset")

        result = await self.db.execute(sql, {**params, "limit": limit, "offset": offset})
        rows = result.fetchall()

        return [self._row_to_dict(row) for row in rows]

    async def search_retail_products(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """零售产品 BM25 搜索"""
        # 由于没有 search_vector 列，使用 ILIKE 模糊匹配
        search_terms = [t for t in query.split() if t]
        if not search_terms:
            return []

        term_conditions = []
        for term in search_terms:
            term_conditions.append(f"""
                (
                    rp.product_name ILIKE :term_{term} OR
                    rp.brand ILIKE :term_{term} OR
                    rp.category ILIKE :term_{term} OR
                    rp.sub_category ILIKE :term_{term} OR
                    rp.full_ingredients ILIKE :term_{term} OR
                    rp.description ILIKE :term_{term}
                )
            """)
            params[f"term_{term}"] = f"%{term}%"

        where_clause = " AND ".join(term_conditions)

        sql = text(f"""
            SELECT rp.id, rp.brand, rp.product_name, rp.product_line,
                   rp.category, rp.sub_category, rp.formulation_type,
                   rp.effects, rp.target_population,
                   rp.full_ingredients, rp.key_ingredients,
                   rp.price, rp.currency, rp.package_size,
                   rp.volume_ml, rp.weight_g,
                   rp.sales_channels, rp.avg_rating, rp.review_count,
                   rp.monthly_sales, rp.image_urls,
                   rp.reg_number, rp.reg_type, rp.approved_region,
                   rp.source, rp.crawl_timestamp, rp.data_quality,
                   rp.created_at, rp.updated_at
            FROM retail_products rp
            WHERE ({where_clause})
              AND rp.data_quality >= 0.3
        """)

        conditions = []
        params = {}

        if filters:
            if filters.get("category"):
                conditions.append("rp.category = :category")
                params["category"] = filters["category"]
            if filters.get("formulation_type"):
                conditions.append("rp.formulation_type = :formulation_type")
                params["formulation_type"] = filters["formulation_type"]
            if filters.get("brand"):
                conditions.append("rp.brand = :brand")
                params["brand"] = filters["brand"]
            if filters.get("price_range"):
                pr = filters["price_range"]
                if pr.get("min") is not None:
                    conditions.append("rp.price >= :price_min")
                    params["price_min"] = pr["min"]
                if pr.get("max") is not None:
                    conditions.append("rp.price <= :price_max")
                    params["price_max"] = pr["max"]
            if filters.get("min_rating") is not None:
                conditions.append("rp.avg_rating >= :min_rating")
                params["min_rating"] = filters["min_rating"]

        if conditions:
            sql = text(str(sql)[:-1] + " AND " + " AND ".join(conditions) + "\n            ORDER BY rp.created_at DESC\n            LIMIT :limit OFFSET :offset")

        result = await self.db.execute(sql, {**params, "limit": limit, "offset": offset})
        rows = result.fetchall()

        return [self._row_to_dict(row) for row in rows]

    def _row_to_dict(self, row) -> Dict[str, Any]:
        """将数据库行转换为字典"""
        if row is None:
            return {}
        return dict(row._mapping)

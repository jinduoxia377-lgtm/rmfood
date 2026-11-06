"""
BM25 全文检索搜索器

基于 PostgreSQL 内置 FTS (Full-Text Search) 实现 BM25 排序。
替代原有的 LIKE 模糊匹配，提供更高质量的相关性排序。
"""
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..openfoodfacts.config import OFFConfig

logger = logging.getLogger(__name__)


def build_tsquery_or_groups(keywords: List[str]) -> List[List[str]]:
    """
    把关键词列表折叠成 tsquery 的 OR 组。

    P1 修复：原实现对所有同义词扩展词一律用 & (AND) 连接，
    导致查询被过度约束、频繁空手。现在改为「核心词 AND、
    同义词组内 OR」——同义词之间任一命中即可，不同概念之间仍取交集。

    例如关键词 = ["补气", "健脾"]，TCM_SYNONYMS 中
        补气 -> [益气, 补中益气, 培元]
        健脾 -> [益气健脾, 和中]
    折叠后得到:
        [["补气","益气","补中益气","培元"], ["健脾","益气健脾","和中"]]
    再由 to_tsquery 拼成 (补气|益气|补中益气|培元)&(健脾|益气健脾|和中)。

    已被某个组吸收的词 (含同义词) 不会再独立成组，
    避免概念重复计数。
    """
    from app.services.search.chinese_nlp import TCM_SYNONYMS

    groups: List[List[str]] = []
    seen: set[str] = set()
    for kw in keywords:
        if kw in seen:
            continue
        group = [kw]
        for syn in TCM_SYNONYMS.get(kw, []):
            if syn not in group:
                group.append(syn)
        # 该组的全部成员都标记为已用，防止同一概念被反复成组
        for term in group:
            seen.add(term)
        groups.append(group)
    return groups


def build_tsquery_str(keywords: List[str]) -> str:
    """
    由关键词生成 to_tsquery 字符串。

    优先按同义词组折叠 (核心词 AND、组内 OR)；无同义词展开时
    退化为全部关键词 AND 连接。
    """
    or_groups = build_tsquery_or_groups(keywords)
    flat = [k.replace("'", "''") for k in keywords if len(k) >= 2]
    if not flat:
        return ""
    if not or_groups:
        return " & ".join(flat)
    parts = [
        "(" + "|".join(g.replace("'", "''") for g in group) + ")"
        for group in or_groups
        if any(len(g) >= 2 for g in group)
    ]
    return " & ".join(parts)


def build_where_clause(conditions: List[str]) -> str:
    """把过滤条件拼成 WHERE 后缀 (P0-3: 与 count 共用，保证语义一致)"""
    if not conditions:
        return ""
    return " AND " + " AND ".join(conditions)


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

        使用 PostgreSQL tsvector + GIN 索引进行全文检索。
        字段权重: name_cn^4.0, aliases^3.0, effects^2.5, category^2.0,
                  description^1.0, sub_category^1.5, indications^2.0
        """
        # 尝试使用 tsvector 列 (真实 BM25)
        try:
            results = await self._search_with_fts(query, filters, limit, offset)
            if results:
                return results
        except Exception as e:
            logger.warning("[BM25] tsvector 搜索失败，回退到 ILIKE: %s", e)
            # FTS 失败(如 search_vector 列缺失)会中止 PostgreSQL 事务，毒化共享会话；
            # 必须先 rollback 释放中止事务，否则紧随的 ILIKE 回退会抛
            # InFailedSQLTransactionError("当前事务被终止") → 上层 503。
            await self._safe_rollback()

        # 回退: ILIKE 模糊匹配
        return await self._search_with_ilike(query, filters, limit, offset)

    async def _safe_rollback(self) -> None:
        """安全回滚当前会话，吞掉回滚本身的异常(会话已不可用时避免二次抛错)。"""
        try:
            await self.db.rollback()
        except Exception as e:  # pragma: no cover - 防御性
            logger.warning("[BM25] rollback 失败: %s", e)

    async def _search_with_fts(
        self, query: str, filters, limit: int, offset: int
    ) -> List[Dict[str, Any]]:
        """使用 tsvector 列进行真正的 BM25 搜索"""
        # 将查询转为 tsquery
        from app.services.search.chinese_nlp import get_nlp_pipeline
        nlp = get_nlp_pipeline()
        keywords = nlp.extract_keywords(query)

        if not keywords:
            return []

        # 构建 tsquery: 核心词 AND，同义词组内 OR (P1)
        tsquery_str = build_tsquery_str(keywords)
        if not tsquery_str:
            return []
        regconfig = OFFConfig.FTS_REGCONFIG

        params: dict[str, Any] = {"tsquery": tsquery_str, "rc": regconfig}

        conditions: list[str] = []
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

        where_clause = build_where_clause(conditions)

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
                   ts_rank(fm.search_vector, to_tsquery(:rc, :tsquery)) AS rank
            FROM food_materials fm
            WHERE fm.search_vector @@ to_tsquery(:rc, :tsquery)
              AND fm.review_status = 'approved'
              AND fm.data_quality >= 0.3{where_clause}
            ORDER BY rank DESC
            LIMIT :limit OFFSET :offset
        """)

        result = await self.db.execute(sql, {**params, "limit": limit, "offset": offset})
        rows = result.fetchall()

        return [self._row_to_dict(row) for row in rows]

    async def count_food_materials(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
    ) -> int:
        """
        返回与 search_food_materials 完全一致的匹配总数 (P0-3)。

        复用同一 WHERE (tsquery + review_status + data_quality + filters)，
        仅把 SELECT 换成 COUNT(*)。召回上限封顶不会影响该值。
        优先走 FTS，失败回退 ILIKE，保证与 search 返回的 total 语义一致。
        """
        try:
            return await self._count_food_materials_fts(query, filters)
        except Exception as e:
            logger.warning("[BM25] count FTS 失败，回退到 ILIKE: %s", e)
            # 同 search：FTS 失败会中止事务毒化会话，先 rollback 再走 ILIKE 回退，
            # 否则 ILIKE count 抛 InFailedSQLTransactionError → 上层 503。
            await self._safe_rollback()
            return await self._count_food_materials_ilike(query, filters)

    async def _count_food_materials_fts(
        self, query: str, filters
    ) -> int:
        from app.services.search.chinese_nlp import get_nlp_pipeline
        nlp = get_nlp_pipeline()
        keywords = nlp.extract_keywords(query)
        if not keywords:
            return 0

        tsquery_str = build_tsquery_str(keywords)
        if not tsquery_str:
            return 0

        regconfig = OFFConfig.FTS_REGCONFIG
        params: dict[str, Any] = {"tsquery": tsquery_str, "rc": regconfig}
        conditions: list[str] = []
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

        where_clause = build_where_clause(conditions)

        sql = text(f"""
            SELECT COUNT(*) AS total
            FROM food_materials fm
            WHERE fm.search_vector @@ to_tsquery(:rc, :tsquery)
              AND fm.review_status = 'approved'
              AND fm.data_quality >= 0.3{where_clause}
        """)
        result = await self.db.execute(sql, params)
        return int(result.scalar() or 0)

    async def _count_food_materials_ilike(
        self, query: str, filters
    ) -> int:
        search_terms = [t for t in query.split() if t]
        if not search_terms:
            return 0

        params: dict[str, Any] = {}
        term_conditions = []
        for idx, term in enumerate(search_terms):
            term_conditions.append(f"""
                (
                    fm.name_cn ILIKE :term_{idx} OR
                    fm.name_en ILIKE :term_{idx} OR
                    fm.name_latin ILIKE :term_{idx} OR
                    fm.category ILIKE :term_{idx} OR
                    fm.sub_category ILIKE :term_{idx} OR
                    fm.description ILIKE :term_{idx} OR
                    fm.indications ILIKE :term_{idx}
                )
            """)
            params[f"term_{idx}"] = f"%{term}%"
        where_clause = " AND ".join(term_conditions)

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

        filter_clause = build_where_clause(conditions)

        sql = text(f"""
            SELECT COUNT(*) AS total
            FROM food_materials fm
            WHERE ({where_clause})
              AND fm.review_status = 'approved'
              AND fm.data_quality >= 0.3{filter_clause}
        """)
        result = await self.db.execute(sql, params)
        return int(result.scalar() or 0)

    async def _search_with_ilike(
        self, query: str, filters, limit: int, offset: int
    ) -> List[Dict[str, Any]]:
        """ILIKE 模糊匹配回退方案"""
        search_terms = [t for t in query.split() if t]
        if not search_terms:
            return []

        params = {}
        term_conditions = []
        for idx, term in enumerate(search_terms):
            term_conditions.append(f"""
                (
                    fm.name_cn ILIKE :term_{idx} OR
                    fm.name_en ILIKE :term_{idx} OR
                    fm.name_latin ILIKE :term_{idx} OR
                    fm.category ILIKE :term_{idx} OR
                    fm.sub_category ILIKE :term_{idx} OR
                    fm.description ILIKE :term_{idx} OR
                    fm.indications ILIKE :term_{idx}
                )
            """)
            params[f"term_{idx}"] = f"%{term}%"

        where_clause = " AND ".join(term_conditions)

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

        filter_clause = build_where_clause(conditions)

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
                   fm.created_at
            FROM food_materials fm
            WHERE ({where_clause})
              AND fm.review_status = 'approved'
              AND fm.data_quality >= 0.3{filter_clause}
            ORDER BY fm.created_at DESC
            LIMIT :limit OFFSET :offset
        """)

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
        try:
            results = await self._search_retail_fts(query, filters, limit, offset)
            if results:
                return results
        except Exception as e:
            logger.warning("[BM25] retail tsvector 搜索失败，回退到 ILIKE: %s", e)

        return await self._search_retail_ilike(query, filters, limit, offset)

    async def _search_retail_fts(
        self, query: str, filters, limit: int, offset: int
    ) -> List[Dict[str, Any]]:
        """零售产品 FTS 搜索"""
        from app.services.search.chinese_nlp import get_nlp_pipeline
        nlp = get_nlp_pipeline()
        keywords = nlp.extract_keywords(query)

        if not keywords:
            return []

        tsquery_parts = [k.replace("'", "''") for k in keywords if len(k) >= 2]
        if not tsquery_parts:
            tsquery_str = ""
        elif len(tsquery_parts) == 1:
            tsquery_str = tsquery_parts[0]
        else:
            tsquery_str = " & ".join(tsquery_parts)

        if not tsquery_str:
            return []

        regconfig = OFFConfig.FTS_REGCONFIG

        sql = text("""
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
                   ts_rank(rp.search_vector, to_tsquery(:rc, :tsquery)) AS rank
            FROM retail_products rp
            WHERE rp.search_vector @@ to_tsquery(:rc, :tsquery)
              AND rp.data_quality >= 0.3
        """)
        params: dict[str, Any] = {"tsquery": tsquery_str, "rc": regconfig}

        conditions = []
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
            sql = text(str(sql) + " AND " + " AND ".join(conditions) +
                       "\n            ORDER BY rank DESC\n            LIMIT :limit OFFSET :offset")
        else:
            sql = text(str(sql) +
                       "\n            ORDER BY rank DESC\n            LIMIT :limit OFFSET :offset")

        result = await self.db.execute(sql, {**params, "limit": limit, "offset": offset})
        rows = result.fetchall()

        return [self._row_to_dict(row) for row in rows]

    async def _search_retail_ilike(
        self, query: str, filters, limit: int, offset: int
    ) -> List[Dict[str, Any]]:
        """零售产品 ILIKE 回退"""
        params = {}
        search_terms = [t for t in query.split() if t]
        if not search_terms:
            return []

        term_conditions = []
        for idx, term in enumerate(search_terms):
            term_conditions.append(f"""
                (
                    rp.product_name ILIKE :term_{idx} OR
                    rp.brand ILIKE :term_{idx} OR
                    rp.category ILIKE :term_{idx} OR
                    rp.sub_category ILIKE :term_{idx} OR
                    rp.full_ingredients ILIKE :term_{idx} OR
                    rp.description ILIKE :term_{idx}
                )
            """)
            params[f"term_{idx}"] = f"%{term}%"

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
                   rp.created_at
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
            sql = text(str(sql)[:-1] + " AND " + " AND ".join(conditions) +
                       "\n            ORDER BY rp.created_at DESC\n            LIMIT :limit OFFSET :offset")
        else:
            sql = text(str(sql) +
                       "\n            ORDER BY rp.created_at DESC\n            LIMIT :limit OFFSET :offset")

        result = await self.db.execute(sql, {**params, "limit": limit, "offset": offset})
        rows = result.fetchall()

        return [self._row_to_dict(row) for row in rows]

    def _row_to_dict(self, row) -> Dict[str, Any]:
        """将数据库行转换为字典"""
        if row is None:
            return {}
        return dict(row._mapping)

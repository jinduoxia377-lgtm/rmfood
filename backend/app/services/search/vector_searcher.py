"""
向量语义搜索器

基于 pgvector + fastembed (BAAI/bge-small-zh-v1.5) 实现语义搜索。
用于 Potion AI VFT x RMFOOD 深度融合方案。
"""
import asyncio
import logging
import math
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.search.bm25_searcher import RETAIL_PLACEHOLDER_FILTER

logger = logging.getLogger(__name__)


class VectorSearcher:
    """向量语义搜索器 (pgvector + fastembed)"""

    DIMENSIONS = 512  # BAAI/bge-small-zh-v1.5 输出维度

    def __init__(self, db: AsyncSession, embedding_service=None):
        self.db = db
        self._embedding_service = embedding_service

    def _get_embedding_service(self):
        """懒加载 EmbeddingService"""
        if self._embedding_service is None:
            from app.services.ai.rag.embedding_service import EmbeddingService
            self._embedding_service = EmbeddingService(provider="local")
        return self._embedding_service

    def encode_query(self, query: str) -> List[float]:
        """
        将查询文本编码为向量

        使用 fastembed 本地模型 BAAI/bge-small-zh-v1.5 (512维)
        首次调用会自动下载模型文件并缓存。
        """
        try:
            svc = self._get_embedding_service()
            vectors = svc._embed_local_sync([query])
            if vectors:
                return vectors[0]
        except Exception as e:
            logger.warning("[VectorSearcher] encode_query 失败, 使用零向量占位: %s", e)

        logger.warning("[VectorSearcher] encode_query 回退到零向量")
        return [0.0] * self.DIMENSIONS

    def _cosine_similarity(self, vec_a: List[float], vec_b: List[float]) -> float:
        """计算余弦相似度"""
        dot = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = math.sqrt(sum(a * a for a in vec_a))
        norm_b = math.sqrt(sum(b * b for b in vec_b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    def _build_filter_conditions(
        self, filters: Optional[Dict[str, Any]], params: Dict[str, Any], alias: str = "fm",
    ) -> List[str]:
        """
        把 filters 翻译成 SQL WHERE 片段 (P1 修复)。

        原实现在方法体中从未引用 filters 形参，导致向量路忽略所有筛选，
        与 BM25 侧 (bm25_searcher.py) 的 WHERE 构造不对称。
        这里与 BM25Searcher._search_with_fts 的字段保持同构，
        仅覆盖两路共用、且向量表上也存在的字段：
            category / food_homology / toxicity_class / regulatory_status
            min_ob / min_data_quality
        """
        conditions: List[str] = []
        if not filters:
            return conditions
        if filters.get("category"):
            conditions.append(f"{alias}.category = :category")
            params["category"] = filters["category"]
        if filters.get("food_homology") is not None:
            conditions.append(f"{alias}.food_homology = :food_homology")
            params["food_homology"] = filters["food_homology"]
        if filters.get("toxicity_class"):
            conditions.append(f"{alias}.toxicity_class = :toxicity_class")
            params["toxicity_class"] = filters["toxicity_class"]
        if filters.get("regulatory_status"):
            conditions.append(f"{alias}.regulatory_status = :regulatory_status")
            params["regulatory_status"] = filters["regulatory_status"]
        if filters.get("min_ob") is not None:
            conditions.append(f"{alias}.ob_percent >= :min_ob")
            params["min_ob"] = filters["min_ob"]
        if filters.get("min_data_quality") is not None:
            # data_quality 基线已在主 WHERE 里写死 0.3；这里允许外部覆盖为更严的阈值
            conditions.append(f"{alias}.data_quality >= :min_dq")
            params["min_dq"] = filters["min_data_quality"]
        return conditions

    async def embedding_coverage(self, table: str = "food_materials") -> int:
        """
        统计指定表里已生成 embedding 的已批准记录数 (P1 修复)。

        调用方 (food_materials.py) 可在进入向量路之前先探测量，
        若为 0 直接跳过向量搜索，避免白跑一次 encode_query
        (本地 fastembed 模型加载/推理开销不小)。
        """
        if table not in ("food_materials", "retail_products"):
            return 0
        alias = "fm" if table == "food_materials" else "rp"
        sql = text(f"""
            SELECT COUNT(*) AS total
            FROM {table} {alias}
            WHERE {alias}.embedding IS NOT NULL
              AND {alias}.review_status = 'approved'
              AND {alias}.data_quality >= 0.3
        """)
        try:
            result = await self.db.execute(sql)
            return int(result.scalar() or 0)
        except Exception as e:
            logger.warning("[VectorSearcher] embedding_coverage 探测失败: %s", e)
            return 0

    async def search_food_materials(
        self,
        query: str,
        top_k: int = 50,
        min_similarity: float = 0.3,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        食品原料向量语义搜索

        优先使用 pgvector 操作符，回退到 JSON 列 + 客户端余弦相似度。
        filters 会真正应用到两路 SQL 的 WHERE 上 (P1 修复)。
        """
        # encode_query 是同步 CPU 重活（fastembed 本地推理），用 to_thread 卸到线程池，
        # 避免阻塞 event loop（并发下会把整个 worker 的其它请求卡住）。
        query_vec = await asyncio.to_thread(self.encode_query, query)
        vec_str = "[" + ",".join(f"{v:.6f}" for v in query_vec) + "]"

        # 尝试使用 pgvector 操作符
        try:
            params: Dict[str, Any] = {
                "query_vec": vec_str,
                "min_sim": min_similarity,
                "top_k": top_k,
            }
            conditions = self._build_filter_conditions(filters, params, alias="fm")
            where_extra = (" AND " + " AND ".join(conditions)) if conditions else ""
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
                       fm.embedding,
                       1 - (fm.embedding::vector <=> :query_vec::vector) AS similarity
                FROM food_materials fm
                WHERE fm.embedding IS NOT NULL
                  AND fm.embedding::vector <=> :query_vec::vector < 1 - :min_sim
                  AND fm.review_status = 'approved'
                  AND fm.data_quality >= 0.3{where_extra}
                ORDER BY fm.embedding::vector <=> :query_vec::vector
                LIMIT :top_k
            """)

            result = await self.db.execute(sql, params)
            rows = result.fetchall()
            if rows:
                return [self._row_to_dict(row) for row in rows]
        except Exception as e:
            logger.warning("[VectorSearcher] pgvector food_materials fallback: %s", e)
            # pgvector 失败(如 vector 类型未安装)会中止 PostgreSQL 事务并毒化共享会话，
            # 必须先 rollback，否则紧随的 JSON 回退查询会抛 InFailedSQLTransactionError
            # ("当前事务被终止") → 上层 503。
            try:
                await self.db.rollback()
            except Exception as rb_err:  # pragma: no cover - 防御性
                logger.warning("[VectorSearcher] rollback 失败: %s", rb_err)

        # 回退: embedding 存储为 JSON 数组，用客户端计算余弦相似度。
        # 注意：必须拉取全部有 embedding 的候选行再在客户端算余弦、排序、取 top_k。
        # 早期版本误写成 ORDER BY created_at DESC LIMIT :top_k——只在"最近创建的 top_k 行"
        # 这个任意子集上算余弦，语义相关的原料通常不在其中，导致向量路几乎恒返回空。
        # 128 行量级全量拉取+客户端余弦开销可忽略。
        fallback_params: Dict[str, Any] = {"top_k": top_k}
        fallback_conditions = self._build_filter_conditions(
            filters, fallback_params, alias="fm"
        )
        fallback_extra = (
            " AND " + " AND ".join(fallback_conditions)
        ) if fallback_conditions else ""
        fallback_sql = text(f"""
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
                   fm.embedding
            FROM food_materials fm
            WHERE fm.embedding IS NOT NULL
              AND fm.review_status = 'approved'
              AND fm.data_quality >= 0.3{fallback_extra}
        """)

        # 必须传入 fallback_params（_build_filter_conditions 可能注入 :min_dq 等占位符）。
        # 既不能丢 params（占位符无值→asyncpg 报错），也不能不传（空 SQL 无占位符时
        # SQLAlchemy 会给 asyncpg 传 [{}] 触发 ProgrammingError）；传 dict 兼容两种情况。
        result = await self.db.execute(fallback_sql, fallback_params)
        rows = result.fetchall()

        filtered = []
        for row in rows:
            d = dict(row._mapping)
            emb = d.get("embedding")
            if not emb or not isinstance(emb, list):
                continue
            sim = self._cosine_similarity(query_vec, emb)
            if sim >= min_similarity:
                d["similarity"] = round(sim, 4)
                filtered.append(d)

        filtered.sort(key=lambda x: x["similarity"], reverse=True)
        return filtered[:top_k]

    async def search_retail_products(
        self,
        query: str,
        top_k: int = 50,
        min_similarity: float = 0.3,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """零售产品向量语义搜索"""
        # 同 search_food_materials：encode_query 卸到线程池，不阻塞 event loop
        query_vec = await asyncio.to_thread(self.encode_query, query)
        vec_str = "[" + ",".join(f"{v:.6f}" for v in query_vec) + "]"

        try:
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
                       rp.embedding,
                       1 - (rp.embedding::vector <=> :query_vec::vector) AS similarity
                FROM retail_products rp
                WHERE rp.embedding IS NOT NULL
                  AND rp.embedding::vector <=> :query_vec::vector < 1 - :min_sim
                  AND rp.data_quality >= 0.3
                  {placeholder_filter}
                ORDER BY rp.embedding::vector <=> :query_vec::vector
                LIMIT :top_k
            """.format(placeholder_filter=RETAIL_PLACEHOLDER_FILTER))

            result = await self.db.execute(sql, {
                "query_vec": vec_str,
                "min_sim": min_similarity,
                "top_k": top_k,
            })
            rows = result.fetchall()
            if rows:
                return [self._row_to_dict(row) for row in rows]
        except Exception as e:
            logger.warning("[VectorSearcher] pgvector retail fallback: %s", e)
            # pgvector 失败(缺 vector 类型)会中止 PG 事务毒化共享会话，回退 JSON 查询前
            # 必须 rollback，否则回退抛 InFailedSQLTransactionError → 503。与 food_materials
            # 向量路同一根因。
            try:
                await self.db.rollback()
            except Exception as rb_err:  # pragma: no cover - 防御性
                logger.warning("[VectorSearcher] rollback 失败: %s", rb_err)

        fallback_sql = text("""
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
                   rp.embedding
            FROM retail_products rp
            WHERE rp.embedding IS NOT NULL
              AND rp.data_quality >= 0.3
              {placeholder_filter}
        """.format(placeholder_filter=RETAIL_PLACEHOLDER_FILTER))

        # 同 food_materials 回退：全量拉取候选行，客户端算余弦后取 top_k，
        # 不再 ORDER BY created_at LIMIT top_k（那只覆盖最近创建的任意子集）。
        # 显式传空 dict 避免 asyncpg 收到 [{}] 触发 ProgrammingError。
        result = await self.db.execute(fallback_sql, {})
        rows = result.fetchall()

        filtered = []
        for row in rows:
            d = dict(row._mapping)
            emb = d.get("embedding")
            if not emb or not isinstance(emb, list):
                continue
            sim = self._cosine_similarity(query_vec, emb)
            if sim >= min_similarity:
                d["similarity"] = round(sim, 4)
                filtered.append(d)

        filtered.sort(key=lambda x: x["similarity"], reverse=True)
        return filtered[:top_k]

    def _row_to_dict(self, row) -> Dict[str, Any]:
        if row is None:
            return {}
        return dict(row._mapping)

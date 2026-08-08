"""
向量语义搜索器

基于 pgvector + fastembed (BAAI/bge-small-zh-v1.5) 实现语义搜索。
用于 Potion AI VFT x RMFOOD 深度融合方案。
"""
import logging
import math
from typing import List, Dict, Any, Optional
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

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
        """
        query_vec = self.encode_query(query)
        vec_str = "[" + ",".join(f"{v:.6f}" for v in query_vec) + "]"

        # 尝试使用 pgvector 操作符
        try:
            sql = text("""
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
                  AND fm.data_quality >= 0.3
                ORDER BY fm.embedding::vector <=> :query_vec::vector
                LIMIT :top_k
            """)

            result = await self.db.execute(sql, {
                "query_vec": vec_str,
                "min_sim": min_similarity,
                "top_k": top_k,
            })
            rows = result.fetchall()
            if rows:
                return [self._row_to_dict(row) for row in rows]
        except Exception as e:
            logger.warning("[VectorSearcher] pgvector food_materials fallback: %s", e)

        # 回退: embedding 存储为 JSON 数组，用客户端计算余弦相似度
        fallback_sql = text("""
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
              AND fm.data_quality >= 0.3
            ORDER BY fm.created_at DESC
            LIMIT :top_k
        """)

        result = await self.db.execute(fallback_sql, {"top_k": top_k})
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

        return sorted(filtered, key=lambda x: x["similarity"], reverse=True)[:top_k]

    async def search_retail_products(
        self,
        query: str,
        top_k: int = 50,
        min_similarity: float = 0.3,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """零售产品向量语义搜索"""
        query_vec = self.encode_query(query)
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
                ORDER BY rp.embedding::vector <=> :query_vec::vector
                LIMIT :top_k
            """)

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
            ORDER BY rp.created_at DESC
            LIMIT :top_k
        """)

        result = await self.db.execute(fallback_sql, {"top_k": top_k})
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

        return sorted(filtered, key=lambda x: x["similarity"], reverse=True)[:top_k]

    def _row_to_dict(self, row) -> Dict[str, Any]:
        if row is None:
            return {}
        return dict(row._mapping)

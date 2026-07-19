"""
向量语义搜索器

基于 pgvector + Sentence-BERT 中文模型实现语义搜索。
用于 Potion AI VFT x RMFOOD 深度融合方案。
"""
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class VectorSearcher:
    """向量语义搜索器 (pgvector)"""

    DIMENSIONS = 768  # text2vec-base-chinese 输出维度

    def __init__(self, db: AsyncSession):
        self.db = db

    def encode_query(self, query: str) -> List[float]:
        """
        将查询文本编码为向量

        注意: 实际使用时应调用嵌入模型 (Sentence-BERT)。
        这里提供接口框架，向量生成由外部服务或异步任务完成。

        Args:
            query: 查询文本

        Returns:
            768 维向量
        """
        # TODO: 集成 sentence-transformers 或调用外部嵌入服务
        # 临时返回零向量占位
        logger.warning("[VectorSearcher] encode_query 未实现，返回零向量")
        return [0.0] * self.DIMENSIONS

    async def search_food_materials(
        self,
        query: str,
        top_k: int = 50,
        min_similarity: float = 0.3,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        食品原料向量语义搜索

        使用 pgvector 的 <=> (欧氏距离) 或 <#> (负余弦相似度) 操作符。
        """
        query_vec = self.encode_query(query)
        vec_str = "[" + ",".join(f"{v:.6f}" for v in query_vec) + "]"

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
                   1 - (fm.embedding <=> :query_vec::vector) AS similarity
            FROM food_materials fm
            WHERE fm.embedding IS NOT NULL
              AND fm.embedding <-> :query_vec::vector < 1 - :min_sim
              AND fm.review_status = 'approved'
              AND fm.data_quality >= 0.3
            ORDER BY fm.embedding <=> :query_vec::vector
            LIMIT :top_k
        """)

        result = await self.db.execute(sql, {
            "query_vec": vec_str,
            "min_sim": min_similarity,
            "top_k": top_k,
        })
        rows = result.fetchall()

        return [self._row_to_dict(row) for row in rows]

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
                   rp.embedding,
                   1 - (rp.embedding <=> :query_vec::vector) AS similarity
            FROM retail_products rp
            WHERE rp.embedding IS NOT NULL
              AND rp.embedding <-> :query_vec::vector < 1 - :min_sim
              AND rp.data_quality >= 0.3
            ORDER BY rp.embedding <=> :query_vec::vector
            LIMIT :top_k
        """)

        result = await self.db.execute(sql, {
            "query_vec": vec_str,
            "min_sim": min_similarity,
            "top_k": top_k,
        })
        rows = result.fetchall()

        return [self._row_to_dict(row) for row in rows]

    def _row_to_dict(self, row) -> Dict[str, Any]:
        if row is None:
            return {}
        return dict(row._mapping)

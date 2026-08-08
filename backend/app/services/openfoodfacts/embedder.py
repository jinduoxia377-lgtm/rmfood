"""
OFF 数据批量嵌入生成

复用现有的 EmbeddingService (fastembed + BAAI/bge-small-zh-v1.5)。
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class OFFEmbedder:
    """批量嵌入生成器"""

    def __init__(self, db: AsyncSession, batch_size: int = 100):
        self.db = db
        self.batch_size = batch_size

    def build_search_text(self, product: Dict[str, Any]) -> str:
        """
        构建用于嵌入的搜索文本

        Args:
            product: 映射后的产品数据

        Returns:
            拼接的搜索文本
        """
        parts = [
            product.get("product_name", ""),
            product.get("brand", ""),
            product.get("category", ""),
            product.get("sub_category", ""),
        ]

        # 配料前 200 字符
        ingredients = product.get("full_ingredients", "")
        if ingredients:
            parts.append(ingredients[:200])

        # 功效标签
        effects = product.get("effects", [])
        if effects:
            parts.extend(effects)

        return " ".join(parts).strip()

    async def generate_embeddings(
        self,
        product_ids: List[int],
        products_data: List[Dict[str, Any]],
    ) -> int:
        """
        批量生成嵌入向量

        Args:
            product_ids: 产品 ID 列表
            products_data: 对应的产品数据列表

        Returns:
            成功生成的数量
        """
        if not product_ids:
            return 0

        from app.services.ai.rag.embedding_service import EmbeddingService

        svc = EmbeddingService(provider="local")
        success_count = 0

        for i in range(0, len(product_ids), self.batch_size):
            batch_ids = product_ids[i:i + self.batch_size]
            batch_data = products_data[i:i + self.batch_size]

            # 构建搜索文本
            texts = []
            for p in batch_data:
                text = self.build_search_text(p)
                if text:
                    texts.append(text)
                else:
                    texts.append("unknown")

            if not texts:
                continue

            try:
                # 使用 fastembed 本地模型生成嵌入
                vectors = svc._embed_local_sync(texts)

                # 批量更新数据库
                for j, pid in enumerate(batch_ids):
                    if j < len(vectors) and vectors[j]:
                        await self.db.execute(text("""
                            UPDATE retail_products
                            SET embedding = :vec, updated_at = NOW()
                            WHERE id = :id
                        """), {"vec": vectors[j], "id": pid})
                        success_count += 1

            except Exception as e:
                logger.error(f"[Embedder] 嵌入生成失败 (batch {i}): {e}")

        if success_count > 0:
            await self.db.commit()
            logger.info(f"[Embedder] 嵌入生成完成: {success_count} 条")

        return success_count

    async def generate_for_missing(self, limit: int = 1000) -> int:
        """
        为所有 embedding 为 NULL 的产品生成嵌入

        Args:
            limit: 最大处理数量

        Returns:
            成功生成的数量
        """
        result = await self.db.execute(text("""
            SELECT id, product_name, brand, category, sub_category,
                   full_ingredients, effects
            FROM retail_products
            WHERE embedding IS NULL
              AND source = 'openfoodfacts'
            ORDER BY data_quality DESC
            LIMIT :limit
        """), {"limit": limit})

        rows = result.fetchall()
        if not rows:
            logger.info("[Embedder] 无待嵌入的产品")
            return 0

        product_ids = [row[0] for row in rows]
        products_data = [
            {
                "product_name": row[1],
                "brand": row[2],
                "category": row[3],
                "sub_category": row[4],
                "full_ingredients": row[5],
                "effects": row[6] if isinstance(row[6], list) else [],
            }
            for row in rows
        ]

        return await self.generate_embeddings(product_ids, products_data)

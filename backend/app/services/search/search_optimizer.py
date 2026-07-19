"""
搜索性能优化服务

用于 Potion AI VFT x RMFOOD 深度融合方案。
提供搜索缓存、索引优化、预计算等功能。
"""
import json
import logging
import time
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from redis.asyncio import Redis

logger = logging.getLogger(__name__)


class SearchCacheService:
    """搜索缓存服务 (Redis)"""

    def __init__(self, redis: Redis):
        self.redis = redis
        self.DEFAULT_TTL = 3600  # 1小时
        self.HOT_TTL = 600  # 10分钟 (热门搜索)

    async def get_cached_result(self, cache_key: str) -> Optional[Any]:
        """获取缓存结果"""
        try:
            data = await self.redis.get(cache_key)
            if data:
                return json.loads(data)
        except Exception as e:
            logger.warning(f"Redis GET 失败: {e}")
        return None

    async def set_cached_result(self, cache_key: str, data: Any, ttl: int = None):
        """设置缓存结果"""
        try:
            await self.redis.setex(
                cache_key,
                ttl or self.DEFAULT_TTL,
                json.dumps(data, ensure_ascii=False),
            )
        except Exception as e:
            logger.warning(f"Redis SET 失败: {e}")

    async def invalidate_cache(self, pattern: str):
        """清除缓存"""
        try:
            keys = await self.redis.keys(pattern)
            if keys:
                await self.redis.delete(*keys)
                logger.info(f"清除缓存: {len(keys)} 个键")
        except Exception as e:
            logger.warning(f"Redis DELETE 失败: {e}")

    async def increment_counter(self, key: str, ttl: int = None):
        """递增计数器"""
        try:
            pipe = self.redis.pipeline()
            pipe.incr(key)
            if ttl:
                pipe.expire(key, ttl)
            await pipe.execute()
        except Exception as e:
            logger.warning(f"Redis INCR 失败: {e}")


class SearchIndexOptimizer:
    """搜索索引优化器"""

    @staticmethod
    async def create_fts_index(db, table_name: str, columns: List[str]):
        """
        创建全文搜索索引

        Args:
            db: SQLAlchemy async session
            table_name: 表名
            columns: 要创建索引的列名列表
        """
        from sqlalchemy import text

        # 创建 tsvector 列 (用于中文 FTS)
        col_expr = " || ' ' || ".join(f"COALESCE({col}, '')" for col in columns)
        index_name = f"idx_{table_name}_fts"

        await db.execute(text(f"""
            ALTER TABLE {table_name}
            ADD COLUMN search_vector tsvector
            GENERATED ALWAYS AS (to_tsvector('simple', {col_expr})) STORED
        """))

        await db.execute(text(f"""
            CREATE INDEX {index_name}
            ON {table_name} USING GIN (search_vector)
        """))

        logger.info(f"创建全文搜索索引: {index_name} on {table_name}({', '.join(columns)})")

    @staticmethod
    async def create_vector_index(db, table_name: str, column_name: str):
        """
        创建向量索引 (HNSW)

        Args:
            db: SQLAlchemy async session
            table_name: 表名
            column_name: 向量列名
        """
        from sqlalchemy import text

        index_name = f"idx_{table_name}_{column_name}_hnsw"

        await db.execute(text(f"""
            CREATE INDEX {index_name}
            ON {table_name} USING hnsw ({column_name} vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
        """))

        logger.info(f"创建向量索引: {index_name} on {table_name}.{column_name}")

    @staticmethod
    async def create_bm25_index(db, table_name: str, column_name: str):
        """
        创建 BM25 搜索索引 (GIN)

        Args:
            db: SQLAlchemy async session
            table_name: 表名
            column_name: 要索引的文本列
        """
        from sqlalchemy import text

        index_name = f"idx_{table_name}_{column_name}_gin"

        await db.execute(text(f"""
            CREATE INDEX {index_name}
            ON {table_name} USING gin(to_tsvector('simple', {column_name}))
        """))

        logger.info(f"创建 BM25 索引: {index_name} on {table_name}.{column_name}")

    @staticmethod
    async def optimize_all_indexes(db, tables_config: Dict[str, Dict[str, List[str]]]):
        """
        批量优化所有索引

        Args:
            db: SQLAlchemy async session
            tables_config: {表名: {"text_columns": [...], "vector_columns": [...]}}
        """
        for table_name, config in tables_config.items():
            if "text_columns" in config:
                await SearchIndexOptimizer.create_fts_index(
                    db, table_name, config["text_columns"]
                )
            if "vector_columns" in config:
                for col in config["vector_columns"]:
                    await SearchIndexOptimizer.create_vector_index(db, table_name, col)

        # VACUUM ANALYZE
        await db.execute(text("VACUUM ANALYZE"))
        logger.info("所有索引优化完成")


class SearchPrecomputeService:
    """搜索预计算服务"""

    @staticmethod
    async def precompute_hot_searches(db, redis: SearchCacheService, days: int = 7):
        """
        预计算热门搜索词

        定期执行，缓存到 Redis
        """
        from sqlalchemy import text

        cache_key = "search:hot_searches"
        cached = await redis.get_cached_result(cache_key)
        if cached:
            return cached

        result = await db.execute(text(f"""
            SELECT keyword, COUNT(*) as search_count, MAX(created_at) as last_searched
            FROM search_history
            WHERE created_at >= NOW() - INTERVAL '{days} days'
            GROUP BY keyword
            ORDER BY search_count DESC
            LIMIT 20
        """))
        rows = result.fetchall()

        hot_searches = [
            {
                "keyword": row[0],
                "search_count": row[1],
                "last_searched": row[2].isoformat() if row[2] else None,
                "trend": "rising" if row[1] > 5 else "stable",
            }
            for row in rows
        ]

        await redis.set_cached_result(cache_key, hot_searches, ttl=redis.HOT_TTL)
        return hot_searches

    @staticmethod
    async def precompute_search_suggestions(db, redis: SearchCacheService):
        """
        预计算搜索建议

        基于热门搜索词和常见别名生成
        """
        cache_key = "search:suggestions"
        cached = await redis.get_cached_result(cache_key)
        if cached:
            return cached

        # 简化: 返回固定建议
        suggestions = [
            {"text": "黄芪", "type": "food_material", "score": 0.95},
            {"text": "枸杞子", "type": "food_material", "score": 0.90},
            {"text": "当归", "type": "food_material", "score": 0.88},
            {"text": "人参", "type": "food_material", "score": 0.85},
            {"text": "胶原蛋白肽", "type": "retail_product", "score": 0.80},
            {"text": "益生菌", "type": "retail_product", "score": 0.75},
        ]

        await redis.set_cached_result(cache_key, suggestions, ttl=redis.DEFAULT_TTL)
        return suggestions

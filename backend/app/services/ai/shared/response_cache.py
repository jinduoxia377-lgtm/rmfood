"""
AI 响应缓存服务 (v1.1)

使用 Redis 缓存 LLM 响应，避免重复请求：
- 相同问题 24h 内复用
- 缓存键：SHA256(question_hash)
- 缓存 TTL：86400s（可配置）
- 降级：Redis 不可用时直接使用内存缓存

v1.1 (2026-10-30)：
- 改用 redis.asyncio，避免同步 Redis 调用阻塞事件循环
- 初始化不再同步 ping（redis.asyncio 连接为惰性建立）
- 所有 Redis 操作包裹 try/except + 短超时，失败快速降级到内存缓存
"""

import asyncio
import hashlib
import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)

_REDIS_OP_TIMEOUT = 1.0  # Redis 单次操作超时（秒），超时快速降级


class AIResponseCache:
    """AI 响应缓存"""

    def __init__(self, ttl: int = 86400):
        self.ttl = ttl
        self._memory_cache: dict[str, dict] = {}  # 降级用
        self._redis_client = None
        self._init_redis()

    def _init_redis(self):
        """初始化 Redis 异步客户端（惰性连接，不阻塞事件循环）"""
        try:
            import redis.asyncio as aioredis
            self._redis_client = aioredis.Redis(
                host="localhost",
                port=6379,
                db=0,
                decode_responses=True,
            )
            logger.info("Redis 异步缓存客户端已创建（连接按需惰性建立）")
        except Exception as e:
            logger.debug("Redis 不可用，使用内存缓存: %s", e)
            self._redis_client = None

    def _make_key(self, question: str) -> str:
        """生成缓存键"""
        return f"ai:cache:{hashlib.sha256(question.strip().encode()).hexdigest()[:16]}"

    async def get(self, question: str) -> Optional[str]:
        """获取缓存；Redis 失败时快速降级到内存缓存，不阻塞主流程"""
        key = self._make_key(question)
        if self._redis_client is not None:
            try:
                value = await asyncio.wait_for(
                    self._redis_client.get(key), timeout=_REDIS_OP_TIMEOUT
                )
                if value:
                    logger.debug("缓存命中 (Redis): %s", key[:8])
                    return value
            except Exception as e:
                # Redis 故障快速降级：关闭客户端，后续走内存缓存
                logger.warning("Redis 缓存读取失败，降级内存缓存: %s", e)
                self._redis_client = None
        try:
            cached = self._memory_cache.get(key)
            if cached and time.time() - cached["time"] < self.ttl:
                logger.debug("缓存命中 (内存): %s", key[:8])
                return cached["value"]
        except Exception as e:
            logger.warning("内存缓存读取失败: %s", e)
        return None

    async def set(self, question: str, answer: str):
        """设置缓存；Redis 写入失败时仅保留内存缓存，不抛错阻断主流程"""
        key = self._make_key(question)
        if self._redis_client is not None:
            try:
                await asyncio.wait_for(
                    self._redis_client.setex(key, self.ttl, answer),
                    timeout=_REDIS_OP_TIMEOUT,
                )
            except Exception as e:
                logger.warning("Redis 缓存写入失败，降级内存缓存: %s", e)
                self._redis_client = None
        try:
            # 内存缓存
            self._memory_cache[key] = {
                "value": answer,
                "time": time.time(),
            }
            # 限制内存缓存大小
            if len(self._memory_cache) > 1000:
                oldest = min(self._memory_cache, key=lambda k: self._memory_cache[k]["time"])
                del self._memory_cache[oldest]
        except Exception as e:
            logger.warning("内存缓存写入失败: %s", e)

    async def invalidate(self, question: str):
        """使指定问题的缓存失效"""
        key = self._make_key(question)
        if self._redis_client is not None:
            try:
                await asyncio.wait_for(
                    self._redis_client.delete(key), timeout=_REDIS_OP_TIMEOUT
                )
            except Exception as e:
                logger.warning("Redis 缓存失效失败，降级内存缓存: %s", e)
                self._redis_client = None
        try:
            self._memory_cache.pop(key, None)
        except Exception as e:
            logger.warning("内存缓存失效失败: %s", e)

    async def clear(self):
        """清除所有缓存"""
        try:
            if self._redis_client is not None:
                pattern = "ai:cache:*"
                keys = await asyncio.wait_for(
                    self._redis_client.keys(pattern), timeout=_REDIS_OP_TIMEOUT
                )
                if keys:
                    await asyncio.wait_for(
                        self._redis_client.delete(*keys), timeout=_REDIS_OP_TIMEOUT
                    )
            self._memory_cache.clear()
            logger.info("缓存已清除")
        except Exception as e:
            logger.warning("缓存清除失败: %s", e)

    def get_stats(self) -> dict:
        """获取缓存统计"""
        return {
            "redis_available": self._redis_client is not None,
            "memory_cache_size": len(self._memory_cache),
            "ttl_seconds": self.ttl,
        }


# 全局单例
ai_cache = AIResponseCache(ttl=86400)
"""
AI 响应缓存服务 (v1.0)

使用 Redis 缓存 LLM 响应，避免重复请求：
- 相同问题 24h 内复用
- 缓存键：SHA256(question_hash)
- 缓存 TTL：86400s（可配置）
- 降级：Redis 不可用时直接使用内存缓存
"""

import hashlib
import logging
import time
from typing import Any, Optional

logger = logging.getLogger(__name__)


class AIResponseCache:
    """AI 响应缓存"""

    def __init__(self, ttl: int = 86400):
        self.ttl = ttl
        self._memory_cache: dict[str, dict] = {}  # 降级用
        self._redis_client = None
        self._init_redis()

    def _init_redis(self):
        """初始化 Redis 连接"""
        try:
            import redis
            self._redis_client = redis.Redis(
                host="localhost",
                port=6379,
                db=0,
                decode_responses=True,
            )
            self._redis_client.ping()
            logger.info("Redis 缓存连接成功")
        except Exception as e:
            logger.debug("Redis 不可用，使用内存缓存: %s", e)
            self._redis_client = None

    def _make_key(self, question: str) -> str:
        """生成缓存键"""
        return f"ai:cache:{hashlib.sha256(question.strip().encode()).hexdigest()[:16]}"

    def get(self, question: str) -> Optional[str]:
        """获取缓存"""
        key = self._make_key(question)
        try:
            if self._redis_client:
                value = self._redis_client.get(key)
                if value:
                    logger.debug("缓存命中 (Redis): %s", key[:8])
                    return value
            # 内存缓存降级
            cached = self._memory_cache.get(key)
            if cached and time.time() - cached["time"] < self.ttl:
                logger.debug("缓存命中 (内存): %s", key[:8])
                return cached["value"]
        except Exception as e:
            logger.warning("缓存读取失败: %s", e)
        return None

    def set(self, question: str, answer: str):
        """设置缓存"""
        key = self._make_key(question)
        try:
            if self._redis_client:
                self._redis_client.setex(key, self.ttl, answer)
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
            logger.warning("缓存写入失败: %s", e)

    def invalidate(self, question: str):
        """使指定问题的缓存失效"""
        key = self._make_key(question)
        try:
            if self._redis_client:
                self._redis_client.delete(key)
            self._memory_cache.pop(key, None)
        except Exception as e:
            logger.warning("缓存失效失败: %s", e)

    def clear(self):
        """清除所有缓存"""
        try:
            if self._redis_client:
                pattern = "ai:cache:*"
                keys = self._redis_client.keys(pattern)
                if keys:
                    self._redis_client.delete(*keys)
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

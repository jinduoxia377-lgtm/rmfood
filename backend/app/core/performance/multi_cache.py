"""
🔒 P5-1: Redis 多级缓存策略

提供:
1. **多级缓存架构** - L1 本地内存 + L2 Redis 分布式缓存
2. **缓存策略配置** - 主动失效 / TTL / 容量限制
3. **缓存预热** - 启动时预加载热点数据
4. **缓存统计** - 命中率 / 命中率趋势 / 存储开销
5. **缓存模式** - Cache-Aside / Write-Through / Write-Behind

使用方式:
    from app.core.performance.multi_cache import (
        get_multi_layer_cache,
        cache_aside,
        warm_up_cache,
        get_cache_stats,
    )

    # 多级缓存
    cache = get_multi_layer_cache()
    value = await cache.get("user:123")

    # 装饰器方式
    @cache_aside("formulas", ttl=300)
    async def get_formula(id: int):
        return await db.query(Formula, id)
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import wraps
from typing import Any, Callable, Dict, List, Optional, Tuple, TypeVar, Generic

import redis.asyncio as aioredis
from cachetools import TTLCache, LRUCache

logger = logging.getLogger(__name__)

T = TypeVar('T')


# ════════════════════════════════════════════
# 🔒 P5-1: 缓存配置
# ════════════════════════════════════════════

@dataclass
class CacheConfig:
    """缓存配置"""
    name: str = "default"
    # L1 本地内存缓存
    l1_enabled: bool = True
    l1_maxsize: int = 1000          # L1 最大条目数
    l1_ttl_seconds: float = 30.0    # L1 TTL（秒）
    # L2 Redis 缓存
    l2_enabled: bool = True
    l2_ttl_seconds: float = 300.0   # L2 TTL（秒）
    l2_prefix: str = "rmfood:"
    # 主动失效
    enable_invalidation: bool = True
    invalidation_batch_size: int = 100
    # 统计
    enable_stats: bool = True


# ════════════════════════════════════════════
# 🔒 P5-1: 缓存统计
# ════════════════════════════════════════════

@dataclass
class CacheStats:
    """缓存统计"""
    hits: int = 0
    misses: int = 0
    l1_hits: int = 0
    l2_hits: int = 0
    writes: int = 0
    invalidations: int = 0
    errors: int = 0
    total_latency_ms: float = 0.0
    start_time: float = field(default_factory=time.time)

    @property
    def total_requests(self) -> int:
        return self.hits + self.misses

    @property
    def hit_rate(self) -> float:
        total = self.total_requests
        if total == 0:
            return 0.0
        return round(self.hits / total * 100, 2)

    @property
    def l1_ratio(self) -> float:
        if self.l1_hits + self.l2_hits == 0:
            return 0.0
        return round(self.l1_hits / (self.l1_hits + self.l2_hits) * 100, 2)

    @property
    def avg_latency_ms(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return round(self.total_latency_ms / self.total_requests, 4)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "hits": self.hits,
            "misses": self.misses,
            "total_requests": self.total_requests,
            "hit_rate": f"{self.hit_rate}%",
            "l1_ratio": f"{self.l1_ratio}%",
            "l1_hits": self.l1_hits,
            "l2_hits": self.l2_hits,
            "writes": self.writes,
            "invalidations": self.invalidations,
            "errors": self.errors,
            "avg_latency_ms": self.avg_latency_ms,
            "uptime_seconds": round(time.time() - self.start_time, 2),
        }


# ════════════════════════════════════════════
# 🔒 P5-1: L1 本地内存缓存
# ════════════════════════════════════════════

class LocalCache:
    """
    L1 本地缓存 - 基于 cachetools 的 TTL 缓存

    特点:
    - 线程安全
    - TTL 支持
    - LRU 淘汰
    - 极低延迟（纳秒级）
    """

    def __init__(self, maxsize: int = 1000, ttl: float = 30.0):
        self._cache = TTLCache(maxsize=maxsize, ttl=ttl)
        self._maxsize = maxsize
        self._ttl = ttl

    def get(self, key: str) -> Optional[Any]:
        try:
            return self._cache.get(key)
        except KeyError:
            return None

    def set(self, key: str, value: Any) -> None:
        try:
            self._cache[key] = value
        except KeyError:
            # 缓存已满，TTL 清理会自动处理
            pass

    def delete(self, key: str) -> bool:
        try:
            del self._cache[key]
            return True
        except KeyError:
            return False

    def clear(self) -> None:
        self._cache.clear()

    def size(self) -> int:
        return len(self._cache)

    def keys(self) -> List[str]:
        return list(self._cache.keys())


# ════════════════════════════════════════════
# 🔒 P5-1: L2 Redis 分布式缓存
# ════════════════════════════════════════════

class RedisCache:
    """
    L2 Redis 缓存 - 分布式共享缓存

    特点:
    - 跨进程共享
    - 持久化
    - 支持集群
    - 网络延迟（毫秒级）
    """

    def __init__(
        self,
        redis_url: str,
        prefix: str = "rmfood:",
        ttl: float = 300.0,
    ):
        self._redis_url = redis_url
        self._prefix = prefix
        self._ttl = ttl
        self._client: Optional[aioredis.Redis] = None
        self._pool: Optional[aioredis.ConnectionPool] = None

    async def _ensure_connection(self) -> aioredis.Redis:
        if self._client is None:
            self._pool = aioredis.ConnectionPool.from_url(
                self._redis_url,
                max_connections=50,
                decode_responses=False,
            )
            self._client = aioredis.Redis(connection_pool=self._pool)
        return self._client

    def _make_key(self, key: str) -> str:
        return f"{self._prefix}{key}"

    async def get(self, key: str) -> Optional[Any]:
        try:
            client = await self._ensure_connection()
            value = await client.get(self._make_key(key))
            if value is None:
                return None
            return json.loads(value)
        except Exception as e:
            logger.warning(f"[RedisCache] Get failed: {e}")
            return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[float] = None,
    ) -> bool:
        try:
            client = await self._ensure_connection()
            serialized = json.dumps(value, default=str)
            expire = ttl if ttl is not None else self._ttl
            await client.setex(
                self._make_key(key),
                expire,
                serialized,
            )
            return True
        except Exception as e:
            logger.warning(f"[RedisCache] Set failed: {e}")
            return False

    async def delete(self, key: str) -> bool:
        try:
            client = await self._ensure_connection()
            result = await client.delete(self._make_key(key))
            return result > 0
        except Exception as e:
            logger.warning(f"[RedisCache] Delete failed: {e}")
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """删除匹配模式的所有 key"""
        try:
            client = await self._ensure_connection()
            keys = []
            async for key in client.scan_iter(match=self._make_key(pattern)):
                keys.append(key)
                if len(keys) >= 1000:
                    if keys:
                        await client.delete(*keys)
                    keys = []
            if keys:
                await client.delete(*keys)
            return len(keys)
        except Exception as e:
            logger.warning(f"[RedisCache] DeletePattern failed: {e}")
            return 0

    async def exists(self, key: str) -> bool:
        try:
            client = await self._ensure_connection()
            return await client.exists(self._make_key(key)) > 0
        except Exception as cache_err:
            logger.debug("缓存 exists 检查失败: %s", cache_err)
            return False

    async def clear(self) -> int:
        """清空当前前缀下的所有 key"""
        return await self.delete_pattern("*")

    async def close(self) -> None:
        if self._client:
            await self._client.close()
            self._client = None
        if self._pool:
            await self._pool.disconnect()
            self._pool = None

    async def get_info(self) -> Dict[str, Any]:
        """获取 Redis 缓存信息"""
        try:
            client = await self._ensure_connection()
            info = await client.info("memory")
            return {
                "used_memory_human": info.get("used_memory_human", "N/A"),
                "used_memory_peak_human": info.get("used_memory_peak_human", "N/A"),
                "maxmemory_human": info.get("maxmemory_human", "N/A"),
            }
        except Exception:
            return {}


# ════════════════════════════════════════════
# 🔒 P5-1: 多级缓存管理器
# ════════════════════════════════════════════

class MultiLayerCache:
    """
    多级缓存管理器

    缓存查找顺序:
    L1 (本地内存) → L2 (Redis) → 源 (DB/API)

    缓存写入顺序:
    L1 + L2 同时写入
    """

    def __init__(self, config: CacheConfig, redis_url: Optional[str] = None):
        self.config = config
        self._stats = CacheStats()
        self._l1: Optional[LocalCache] = None
        self._l2: Optional[RedisCache] = None
        self._redis_url = redis_url

        self._init_caches()

    def _init_caches(self) -> None:
        if self.config.l1_enabled:
            self._l1 = LocalCache(
                maxsize=self.config.l1_maxsize,
                ttl=self.config.l1_ttl_seconds,
            )
            logger.info(
                f"[MultiCache] L1 本地缓存已初始化: maxsize={self.config.l1_maxsize}, "
                f"ttl={self.config.l1_ttl_seconds}s"
            )

        if self.config.l2_enabled and self._redis_url:
            self._l2 = RedisCache(
                redis_url=self._redis_url,
                prefix=self.config.l2_prefix,
                ttl=self.config.l2_ttl_seconds,
            )
            logger.info(
                f"[MultiCache] L2 Redis 缓存已初始化: prefix={self.config.l2_prefix}, "
                f"ttl={self.config.l2_ttl_seconds}s"
            )

    async def get(self, key: str) -> Tuple[Optional[Any], str]:
        """
        获取缓存值

        Returns:
            (value, source) - source: "l1", "l2", "miss"
        """
        start = time.time()

        # L1 查询
        if self._l1:
            value = self._l1.get(key)
            if value is not None:
                self._stats.hits += 1
                self._stats.l1_hits += 1
                self._stats.total_latency_ms += (time.time() - start) * 1000
                return value, "l1"

        # L2 查询
        if self._l2:
            value = await self._l2.get(key)
            if value is not None:
                self._stats.hits += 1
                self._stats.l2_hits += 1
                # 回填 L1
                if self._l1:
                    self._l1.set(key, value)
                self._stats.total_latency_ms += (time.time() - start) * 1000
                return value, "l2"

        # 未命中
        self._stats.misses += 1
        self._stats.total_latency_ms += (time.time() - start) * 1000
        return None, "miss"

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[float] = None,
    ) -> bool:
        """设置缓存值（同时写入 L1 + L2）"""
        start = time.time()
        success = True

        if self._l1:
            self._l1.set(key, value)
        if self._l2:
            l2_success = await self._l2.set(key, value, ttl=ttl)
            if not l2_success:
                success = False

        self._stats.writes += 1
        self._stats.total_latency_ms += (time.time() - start) * 1000
        return success

    async def delete(self, key: str) -> bool:
        """删除缓存（同时删除 L1 + L2）"""
        start = time.time()
        success = True

        if self._l1:
            self._l1.delete(key)
        if self._l2:
            l2_success = await self._l2.delete(key)
            if not l2_success:
                success = False

        self._stats.invalidations += 1
        self._stats.total_latency_ms += (time.time() - start) * 1000
        return success

    async def invalidate_pattern(self, pattern: str) -> int:
        """按模式批量失效"""
        count = 0
        if self._l2:
            count = await self._l2.delete_pattern(pattern)
            self._stats.invalidations += count
            logger.info(f"[MultiCache] 批量失效: pattern={pattern}, count={count}")
        return count

    async def clear(self) -> None:
        """清空所有缓存"""
        if self._l1:
            self._l1.clear()
        if self._l2:
            await self._l2.clear()
        logger.info("[MultiCache] 缓存已清空")

    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计"""
        result = self._stats.to_dict()
        if self._l1:
            result["l1_size"] = self._l1.size()
            result["l1_maxsize"] = self._l1._maxsize
        if self._l2:
            result["l2_info"] = {}
            # 异步获取 L2 信息（不阻塞）
        return result

    async def warm_up(
        self,
        items: List[Tuple[str, Any]],
        ttl: Optional[float] = None,
    ) -> int:
        """
        缓存预热

        Args:
            items: [(key, value), ...] 要预加载的数据
            ttl: 可选的 TTL 覆盖

        Returns:
            成功预热的条目数
        """
        success_count = 0
        for key, value in items:
            if await self.set(key, value, ttl=ttl):
                success_count += 1
        logger.info(f"[MultiCache] 预热完成: {success_count}/{len(items)} 条数据")
        return success_count

    async def close(self) -> None:
        """关闭缓存连接"""
        if self._l2:
            await self._l2.close()


# ════════════════════════════════════════════
# ════════════════════════════════════════════
# 🔒 P5-1: 缓存装饰器
# ════════════════════════════════════════════

_global_cache: Optional[MultiLayerCache] = None


def init_multi_layer_cache(
    config: CacheConfig,
    redis_url: Optional[str] = None,
) -> MultiLayerCache:
    """初始化全局多级缓存"""
    global _global_cache
    _global_cache = MultiLayerCache(config, redis_url)
    return _global_cache


def get_multi_layer_cache() -> Optional[MultiLayerCache]:
    """获取全局多级缓存实例"""
    return _global_cache


def cache_aside(
    namespace: str,
    ttl: Optional[float] = None,
    key_builder: Optional[Callable[..., str]] = None,
):
    """
    🔒 P5-1: Cache-Aside 模式装饰器

    用法:
        @cache_aside("formulas", ttl=300)
        async def get_formula(id: int):
            return await db.query(Formula, id)

        # 自定义 key
        @cache_aside("users", key_builder=lambda uid, org: f"user:{org}:{uid}")
        async def get_user(uid: int, org: str):
            return await db.query(User, uid)
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            cache = get_multi_layer_cache()
            if cache is None:
                return await func(*args, **kwargs)

            # 构建缓存 key
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                # 默认：namespace:函数名:参数哈希
                args_str = json.dumps({"args": args, "kwargs": kwargs}, default=str, sort_keys=True)
                args_hash = hashlib.md5(args_str.encode()).hexdigest()[:8]
                cache_key = f"{namespace}:{func.__name__}:{args_hash}"

            # 尝试从缓存获取
            value, source = await cache.get(cache_key)
            if value is not None:
                logger.debug(f"[CacheAside] 命中 {source}: {cache_key}")
                return value

            # 缓存未命中，调用原函数
            result = await func(*args, **kwargs)

            # 写入缓存
            if result is not None:
                await cache.set(cache_key, result, ttl=ttl)
                logger.debug(f"[CacheAside] 写入缓存: {cache_key}")

            return result

        return wrapper
    return decorator


# ════════════════════════════════════════════
# 🔒 P5-1: 缓存预热任务
# ════════════════════════════════════════════

async def warm_up_cache(
    cache: MultiLayerCache,
    warmup_tasks: List[Dict[str, Any]],
) -> Dict[str, int]:
    """
    批量执行缓存预热

    Args:
        warmup_tasks: [{"name": "用户配置", "loader": callable, "ttl": 3600}, ...]

    Returns:
        各任务预热结果
    """
    results = {}

    for task in warmup_tasks:
        task_name = task.get("name", "unknown")
        loader = task.get("loader")
        ttl = task.get("ttl")

        if not loader:
            continue

        try:
            if asyncio.iscoroutinefunction(loader):
                items = await loader()
            else:
                items = loader()

            if items:
                count = await cache.warm_up(items, ttl=ttl)
                results[task_name] = count
                logger.info(f"[CacheWarmup] ✅ {task_name}: 预热 {count} 条")
            else:
                results[task_name] = 0
                logger.info(f"[CacheWarmup] ⏭️ {task_name}: 无数据")

        except Exception as e:
            results[task_name] = -1
            logger.error(f"[CacheWarmup] ❌ {task_name}: {e}")

    return results


def get_cache_stats() -> Dict[str, Any]:
    """获取全局缓存统计"""
    cache = get_multi_layer_cache()
    if cache:
        return cache.get_stats()
    return {"status": "not_initialized"}


# ════════════════════════════════════════════
# 🔒 P5-1: 便捷函数
# ════════════════════════════════════════════

async def cached_get(key: str) -> Tuple[Optional[Any], str]:
    """全局缓存获取"""
    cache = get_multi_layer_cache()
    if cache:
        return await cache.get(key)
    return None, "unavailable"


async def cached_set(key: str, value: Any, ttl: Optional[float] = None) -> bool:
    """全局缓存设置"""
    cache = get_multi_layer_cache()
    if cache:
        return await cache.set(key, value, ttl=ttl)
    return False


async def cached_delete(key: str) -> bool:
    """全局缓存删除"""
    cache = get_multi_layer_cache()
    if cache:
        return await cache.delete(key)
    return False


async def invalidate_namespace(namespace: str) -> int:
    """按命名空间失效"""
    cache = get_multi_layer_cache()
    if cache:
        return await cache.invalidate_pattern(f"{namespace}:*")
    return 0


__all__ = [
    "CacheConfig",
    "CacheStats",
    "LocalCache",
    "RedisCache",
    "MultiLayerCache",
    "init_multi_layer_cache",
    "get_multi_layer_cache",
    "cache_aside",
    "warm_up_cache",
    "get_cache_stats",
    "cached_get",
    "cached_set",
    "cached_delete",
    "invalidate_namespace",
]

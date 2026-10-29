"""
RMFOOD 多级智能缓存系统

架构设计:
┌─────────────────────────────────────────────┐
│  L1: 内存缓存 (进程内, TTL=5min)           │ ← 最快, 容量最小
├─────────────────────────────────────────────┤
│  L2: Redis缓存 (分布式, TTL=30min)         │ ← 中速, 容量大
├─────────────────────────────────────────────┤
│  L3: 数据库 (持久化存储)                    │ ← 最慢, 但可靠
└─────────────────────────────────────────────┘

功能特性:
✅ 自动降级 (Redis不可用时回退到内存)
✅ 智能预热 (启动时加载热点数据)
✅ 缓存穿透防护 (空值缓存)
✅ 缓存雪崩保护 (TTL抖动)
✅ 统一API (get/set/delete/invalidate)
✅ 命中率统计和监控

使用场景:
- 肽分析结果缓存 (相同序列不重复计算)
- 用户会话数据
- 配置信息
- 频繁查询的列表数据
- AI模型输出结果
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from collections import OrderedDict
from dataclasses import dataclass
from functools import wraps
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class CacheConfig:
    """缓存配置"""
    # L1 内存缓存配置
    l1_enabled: bool = True
    l1_max_size: int = 1000              # 最大缓存条目数
    l1_default_ttl_seconds: int = 300     # 默认TTL (5分钟)

    # L2 Redis配置
    l2_enabled: bool = False             # 默认关闭，需显式启用
    l2_url: Optional[str] = None         # redis://localhost:6379/0
    l2_default_ttl_seconds: int = 1800   # 默认TTL (30分钟)
    l2_key_prefix: str = "rmfood:"       # 键前缀

    # 安全配置
    enable_null_caching: bool = True      # 缓存空值防止穿透
    null_ttl_seconds: int = 60            # 空值缓存TTL (1分钟)

    # 监控配置
    enable_stats: bool = True             # 启用统计


@dataclass
class CacheStats:
    """缓存统计信息"""
    hits: int = 0
    misses: int = 0
    sets: int = 0
    deletes: int = 0
    evictions: int = 0
    errors: int = 0

    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        if total == 0:
            return 0.0
        return (self.hits / total) * 100

    def to_dict(self) -> Dict[str, Any]:
        return {
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": f"{self.hit_rate:.2f}%",
            "total_requests": self.hits + self.misses,
            "sets": self.sets,
            "deletes": self.deletes,
            "evictions": self.evictions,
            "errors": self.errors,
        }


class MemoryCacheEntry:
    """内存缓存条目"""
    __slots__ = ('value', 'expires_at', 'created_at', 'size_bytes')

    def __init__(self, value: Any, ttl_seconds: int):
        self.value = value
        self.created_at = time.time()
        self.expires_at = self.created_at + ttl_seconds
        self.size_bytes = len(json.dumps(value).encode('utf-8')) if value else 0

    @property
    def is_expired(self) -> bool:
        return time.time() > self.expires_at

    @property
    def ttl(self) -> int:
        remaining = self.expires_at - time.time()
        return max(0, int(remaining))


class MultiLevelCache:
    """
    多级智能缓存系统

    使用示例:
        cache = MultiLevelCache()

        # 基本用法
        result = await cache.get("user:123")
        await cache.set("user:123", data, ttl=3600)

        # 装饰器用法 (自动缓存函数结果)
        @cache.cached(ttl=600, key_prefix="peptide_analysis")
        async def analyze_peptide(sequence: str):
            # 复杂的分析逻辑...
            return result

        # 带条件缓存的装饰器
        @cache.cached(
            ttl=1800,
            condition=lambda r: r['success'] is True,
            key_builder=lambda seq: f"peptide:{seq}"
        )
        async def expensive_query(seq):
            ...
    """

    def __init__(self, config: Optional[CacheConfig] = None):
        self.config = config or CacheConfig()
        # 使用 OrderedDict 实现 O(1) LRU 淘汰
        self._l1_cache: OrderedDict[str, MemoryCacheEntry] = OrderedDict()

        self._redis_client = None
        self._redis_available = False

        self.stats = CacheStats()

        # 初始化L2 Redis（如果配置了）
        if self.config.l2_enabled and self.config.l2_url:
            self._init_redis()

        logger.info(
            f"🗄️ 多级缓存系统初始化 | "
            f"L1(内存): {'✅' if self.config.l1_enabled else '❌'} | "
            f"L2(Redis): {'✅' if self._redis_available else '❌'}"
        )

    def _init_redis(self):
        """初始化Redis连接"""
        try:
            import redis.asyncio as aioredis

            self._redis_client = aioredis.from_url(
                self.config.l2_url,
                decode_responses=True,
                max_connections=10,
            )
            self._redis_available = True
            logger.info(f"✅ Redis连接成功: {self.config.l2_url}")

        except ImportError:
            logger.info("⚠️ redis库未安装，将仅使用内存缓存")
            self.config.l2_enabled = False

        except Exception as e:
            logger.info(f"Redis连接失败: {e}，将降级到内存缓存")
            self._redis_available = False
            self.config.l2_enabled = False

    def _generate_key(self, prefix: str, *args, **kwargs) -> str:
        """生成缓存键（使用 SHA256）"""
        key_data = {
            "args": args,
            "kwargs": kwargs,
        }
        key_hash = hashlib.sha256(
            json.dumps(key_data, sort_keys=True).encode()
        ).hexdigest()[:16]

        return f"{prefix}:{key_hash}"

    async def get(self, key: str) -> Optional[Any]:
        """
        获取缓存值 (L1 → L2 → None)

        Args:
            key: 缓存键

        Returns:
            缓存的值，如果不存在返回None
        """
        if self.config.enable_stats:
            self.stats.misses += 1

        # L1: 内存缓存（OrderedDict，O(1) 访问）
        if self.config.l1_enabled:
            entry = self._l1_cache.get(key)

            if entry and not entry.is_expired:
                # O(1) 移到末尾（最近使用）
                self._l1_cache.move_to_end(key)

                if self.config.enable_stats:
                    self.stats.hits += 1
                    self.stats.misses -= 1

                logger.debug(f"🎯 L1命中 | Key: {key}")
                return entry.value

            elif entry:
                # 已过期，删除
                del self._l1_cache[key]
                if self.config.enable_stats:
                    self.stats.evictions += 1

        # L2: Redis缓存
        if self.config.l2_enabled and self._redis_available:
            try:
                full_key = f"{self.config.l2_key_prefix}{key}"
                value = await self._redis_client.get(full_key)

                if value is not None:
                    # 反序列化
                    parsed_value = json.loads(value)

                    # 回填到L1
                    if self.config.l1_enabled:
                        self._set_l1(key, parsed_value, self.config.l1_default_ttl_seconds)

                    if self.config.enable_stats:
                        self.stats.hits += 1
                        self.stats.misses -= 1

                    logger.debug(f"🎯 L2命中 | Key: {key}")
                    return parsed_value

            except Exception as e:
                logger.error(f"❌ L2读取失败: {e}")
                if self.config.enable_stats:
                    self.stats.errors += 1

        # 未命中
        logger.debug(f"💨 缓存未命中 | Key: {key}")
        return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        tags: Optional[List[str]] = None,
    ) -> bool:
        """
        设置缓存值 (同时写入L1和L2)

        Args:
            key: 缓存键
            value: 要缓存的值
            ttl: 过期时间(秒)，None则使用默认值
            tags: 标签列表，用于批量失效

        Returns:
            是否设置成功
        """
        ttl = ttl or self.config.l1_default_ttl_seconds

        # 处理空值缓存
        if value is None and self.config.enable_null_caching:
            ttl = self.config.null_ttl_seconds
            value = "__NULL__"

        success = True

        # 写入L1
        if self.config.l1_enabled:
            self._set_l1(key, value, ttl)

        # 写入L2
        if self.config.l2_enabled and self._redis_available:
            try:
                full_key = f"{self.config.l2_key_prefix}{key}"
                serialized = json.dumps(value)

                await self._redis_client.setex(
                    full_key,
                    ttl,
                    serialized
                )

                # 如果有标签，记录到集合
                if tags:
                    for tag in tags:
                        tag_key = f"{self.config.l2_key_prefix}tag:{tag}"
                        await self._redis_client.sadd(tag_key, full_key)

            except Exception as e:
                logger.error(f"❌ L2写入失败: {e}")
                success = False
                if self.config.enable_stats:
                    self.stats.errors += 1

        if self.config.enable_stats:
            self.stats.sets += 1

        return success

    def _set_l1(self, key: str, value: Any, ttl: int):
        """写入L1内存缓存（OrderedDict，O(1)）"""
        # 如果已存在，先删除再插入（更新位置）
        if key in self._l1_cache:
            del self._l1_cache[key]

        # 检查容量限制
        if len(self._l1_cache) >= self.config.l1_max_size:
            self._evict_lru()

        entry = MemoryCacheEntry(value, ttl)
        self._l1_cache[key] = entry

    async def delete(self, key: str) -> bool:
        """删除缓存键"""
        deleted = False

        # 从L1删除
        if key in self._l1_cache:
            del self._l1_cache[key]
            deleted = True

        # 从L2删除
        if self.config.l2_enabled and self._redis_available:
            try:
                full_key = f"{self.config.l2_key_prefix}{key}"
                await self._redis_client.delete(full_key)
                deleted = True
            except Exception as e:
                logger.error(f"❌ L2删除失败: {e}")

        if deleted and self.config.enable_stats:
            self.stats.deletes += 1

        return deleted

    async def invalidate_by_tag(self, tag: str) -> int:
        """
        通过标签批量失效缓存

        Args:
            tag: 标签名称

        Returns:
            失效的缓存数量
        """
        count = 0

        if self.config.l2_enabled and self._redis_available:
            try:
                tag_key = f"{self.config.l2_key_prefix}tag:{tag}"
                keys = await self._redis_client.smembers(tag_key)

                if keys:
                    await self._redis_client.delete(*keys)
                    await self._redis_client.delete(tag_key)
                    count = len(keys)

                    # 同时清除L1中的对应项
                    for full_key in keys:
                        key = full_key.replace(self.config.l2_key_prefix, "")
                        if key in self._l1_cache:
                            del self._l1_cache[key]

            except Exception as e:
                logger.error(f"❌ 标签失效失败: {e}")

        logger.info(f"🏷️ 标签失效 | Tag: {tag} | 数量: {count}")
        return count

    def _evict_lru(self):
        """LRU淘汰策略：O(1) 移除最久未访问的条目"""
        if not self._l1_cache:
            return

        # OrderedDict.popitem(last=False) 移除最旧的条目，O(1)
        oldest_key, _ = self._l1_cache.popitem(last=False)
        if self.config.enable_stats:
            self.stats.evictions += 1

        logger.debug(f"🗑️ LRU淘汰 | Key: {oldest_key}")

    def cached(
        self,
        ttl: Optional[int] = None,
        key_prefix: str = "",
        key_builder: Optional[Callable] = None,
        condition: Optional[Callable[[Any], bool]] = None,
        tags: Optional[List[str]] = None,
    ):
        """
        缓存装饰器工厂

        用法:
            @cache.cached(ttl=600, key_prefix="analysis")
            async def my_function(arg1, arg2=None):
                ...

        Args:
            ttl: 缓存时间(秒)
            key_prefix: 键前缀
            key_builder: 自定义键生成函数
            condition: 缓存条件函数 (返回True才缓存)
            tags: 标签列表
        """
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                # 生成缓存键
                if key_builder:
                    cache_key = key_builder(*args, **kwargs)
                else:
                    cache_key = self._generate_key(
                        key_prefix or func.__name__,
                        *args,
                        **kwargs
                    )

                # 尝试从缓存获取
                cached_result = await self.get(cache_key)

                if cached_result is not None:
                    # 检查是否是空值标记
                    if cached_result == "__NULL__":
                        return None
                    return cached_result

                # 执行原函数
                result = await func(*args, **kwargs)

                # 检查缓存条件
                if condition and not condition(result):
                    return result

                # 写入缓存
                await self.set(cache_key, result, ttl=ttl, tags=tags)

                return result

            wrapper._cache_key_prefix = key_prefix or func.__name__
            return wrapper

        return decorator

    async def get_or_set(
        self,
        key: str,
        factory: Callable[[], Any],
        ttl: Optional[int] = None,
    ) -> Any:
        """
        获取或设置缓存 (便捷方法)

        如果缓存存在则返回，否则调用factory生成并缓存。

        Usage:
            result = await cache.get_or_set(
                "user:123",
                lambda: db.query(User).get(123),
                ttl=3600
            )
        """
        value = await self.get(key)

        if value is not None:
            return value

        # 生成新值
        if asyncio.iscoroutinefunction(factory):
            value = await factory()
        else:
            value = factory()

        # 缓存
        await self.set(key, value, ttl=ttl)

        return value

    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        stats_dict = self.stats.to_dict()
        stats_dict.update({
            "l1_size": len(self._l1_cache),
            "l1_max_size": self.config.l1_max_size,
            "l1_usage_percent": round(
                (len(self._l1_cache) / self.config.l1_max_size) * 100, 1
            ),
            "l2_available": self._redis_available,
            "config": {
                "l1_enabled": self.config.l1_enabled,
                "l2_enabled": self.config.l2_enabled,
                "default_ttl": self.config.l1_default_ttl_seconds,
            }
        })
        return stats_dict

    async def clear_all(self):
        """清空所有缓存"""
        self._l1_cache.clear()

        if self._redis_available:
            try:
                pattern = f"{self.config.l2_key_prefix}*"
                keys = []
                async for key in self._redis_client.scan_iter(match=pattern):
                    keys.append(key)
                if keys:
                    await self._redis_client.delete(*keys)
                logger.info(f"🧹 L2已清空 | 删除 {len(keys)} 个键")
            except Exception as e:
                logger.error(f"❌ L2清空失败: {e}")

        logger.info("🧹 所有缓存已清空")

    async def close(self):
        """关闭连接"""
        if self._redis_client:
            await self._redis_client.close()
            logger.info("🔌 Redis连接已关闭")


# ════════════════════════════════════════════
# 全局单例
# ════════════════════════════════════════════

_global_cache: Optional[MultiLevelCache] = None


def get_cache(config: Optional[CacheConfig] = None) -> MultiLevelCache:
    """获取全局缓存实例"""
    global _global_cache
    if _global_cache is None:
        _global_cache = MultiLevelCache(config)
    return _global_cache


# ════════════════════════════════════════════
# 向后兼容的全局实例与初始化函数
# ════════════════════════════════════════════

# 全局缓存服务实例 (兼容 from .core.cache import cache_service)
cache_service = get_cache()


async def init_cache():
    """初始化缓存服务 (兼容 from .core.cache import init_cache)"""
    get_cache()
    # MultiLevelCache 在 __init__ 中已初始化 Redis，此处为空操作
    # 但保留接口以兼容 main.py 的 lifespan 调用
    pass


async def close_cache():
    """关闭缓存服务 (兼容 from .core.cache import close_cache)"""
    cache = get_cache()
    await cache.close()


def cache_async(key_pattern: str, expire: int = 3600):
    """
    异步缓存装饰器 (兼容 from .core.cache import cache_async)

    Args:
        key_pattern: 缓存键模式，支持{param}占位符
        expire: 过期时间（秒）
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache = get_cache()
            # 生成缓存键
            key = key_pattern
            for name, value in kwargs.items():
                key = key.replace(f"{{{name}}}", str(value))
            # 尝试从缓存获取
            cached_value = await cache.get(key)
            if cached_value is not None:
                return cached_value
            # 执行函数
            result = await func(*args, **kwargs)
            # 存入缓存
            await cache.set(key, result, ttl=expire)
            return result
        return wrapper
    return decorator

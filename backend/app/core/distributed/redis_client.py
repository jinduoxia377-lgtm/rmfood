"""
Redis 分布式支持（P2 演进项：多 worker 部署）

- 通过环境变量 USE_REDIS=true 启用（默认关闭，单实例回退内存实现）。
- 提供：
  - is_redis_enabled(): 是否启用 Redis
  - get_redis(): 返回 redis.asyncio.Redis 客户端或 None
  - RedisLock: 分布式锁（SET NX EX + Lua 释放），可替代进程内 asyncio.Lock
  - redis_set_nx(key, ex): 分布式频率限制（首次设置成功=允许）

部署要求：外部 Redis 服务可用；配置 REDIS_URL（默认 redis://localhost:6379/0）。
"""
from __future__ import annotations

import asyncio
import logging
import os
import uuid
from typing import Optional

logger = logging.getLogger(__name__)

_redis_enabled: Optional[bool] = None
_redis_client = None


def is_redis_enabled() -> bool:
    global _redis_enabled
    if _redis_enabled is None:
        _redis_enabled = os.getenv("USE_REDIS", "false").lower() in ("1", "true", "yes")
    return _redis_enabled


def get_redis_url() -> str:
    return os.getenv("REDIS_URL", "redis://localhost:6379/0")


async def get_redis():
    """返回 redis.asyncio.Redis 客户端；未启用 Redis 时返回 None。"""
    global _redis_client
    if not is_redis_enabled():
        return None
    if _redis_client is None:
        import redis.asyncio as aioredis
        _redis_client = aioredis.from_url(
            get_redis_url(),
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
        )
        # 启动时探测连接
        try:
            await _redis_client.ping()
            logger.info("[Redis] 已连接 Redis 服务")
        except Exception as e:
            logger.warning(f"[Redis] 连接失败，回退内存实现: {e}")
            _redis_client = None
            return None
    return _redis_client


async def redis_set_nx(key: str, ex: int) -> bool:
    """SET NX EX：首次设置成功返回 True（用于频率限制）。"""
    redis = await get_redis()
    if redis is None:
        return False
    try:
        return bool(await redis.set(key, "1", nx=True, ex=ex))
    except Exception as e:
        logger.warning(f"[Redis] set_nx 失败: {e}")
        return False


class RedisLock:
    """分布式锁（可 async with）。"""

    def __init__(self, key: str, timeout: int = 300):
        self._key = key
        self._timeout = timeout
        self._token: Optional[str] = None

    async def __aenter__(self) -> "RedisLock":
        redis = await get_redis()
        self._token = uuid.uuid4().hex
        while redis is not None:
            try:
                ok = await redis.set(self._key, self._token, nx=True, ex=self._timeout)
                if ok:
                    return self
            except Exception as e:
                logger.warning(f"[Redis] 获取锁失败: {e}")
                break
            await asyncio.sleep(0.2)
        # Redis 不可用时退化为无锁（单实例内存锁由上层负责）
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        redis = await get_redis()
        if redis is None or not self._token:
            return
        try:
            # Lua：仅当持有者匹配时删除
            await redis.eval(
                "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
                1, self._key, self._token,
            )
        except Exception as e:
            logger.warning(f"[Redis] 释放锁失败: {e}")


def make_group_lock_key(group_id: int) -> str:
    return f"rmfood:group_lock:{group_id}"


def make_rate_limit_key(prefix: str, user_id: int) -> str:
    return f"rmfood:{prefix}:{user_id}"
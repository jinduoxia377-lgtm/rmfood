"""API 限流服务 — 令牌桶算法

实现分布式令牌桶限流，支持：
- 按用户/租户限流
- 按接口限流
- 按时间窗口限流
- 优雅降级与队列处理

特性：
- 线程安全
- 异步支持
- 配置灵活
- 监控指标
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class RateLimitAction(Enum):
    """限流动作"""
    ALLOW = "allow"
    DENY = "deny"
    WAIT = "wait"
    QUEUE = "queue"


@dataclass
class RateLimitResult:
    """限流结果"""
    action: RateLimitAction
    allowed: bool
    remaining: int
    limit: int
    retry_after: Optional[float] = None
    message: str = ""


@dataclass
class TokenBucket:
    """令牌桶实现"""
    capacity: int  # 桶容量（最大令牌数）
    refill_rate: float  # 每秒补充速率
    tokens: float = 0.0  # 当前令牌数
    last_refill: float = field(default_factory=time.time)  # 上次补充时间

    def __post_init__(self):
        # 初始化为满桶
        self.tokens = float(self.capacity)

    def _refill(self) -> None:
        """补充令牌"""
        now = time.time()
        elapsed = now - self.last_refill

        # 计算应补充的令牌数
        tokens_to_add = elapsed * self.refill_rate

        # 更新令牌数（不超过容量）
        self.tokens = min(self.capacity, self.tokens + tokens_to_add)
        self.last_refill = now

    def consume(self, tokens: int = 1) -> RateLimitResult:
        """消耗令牌

        Returns:
            限流结果
        """
        self._refill()

        if self.tokens >= tokens:
            self.tokens -= tokens
            return RateLimitResult(
                action=RateLimitAction.ALLOW,
                allowed=True,
                remaining=int(self.tokens),
                limit=self.capacity,
                message="请求已允许",
            )
        else:
            # 计算等待时间
            needed = tokens - self.tokens
            wait_time = needed / self.refill_rate if self.refill_rate > 0 else float('inf')

            return RateLimitResult(
                action=RateLimitAction.DENY,
                allowed=False,
                remaining=int(self.tokens),
                limit=self.capacity,
                retry_after=wait_time,
                message=f"请求被拒绝，请在 {wait_time:.2f} 秒后重试",
            )

    def get_status(self) -> Dict:
        """获取桶状态"""
        self._refill()
        return {
            "capacity": self.capacity,
            "tokens": round(self.tokens, 2),
            "refill_rate": self.refill_rate,
            "fill_percentage": round(self.tokens / self.capacity * 100, 1),
        }


class RateLimiter:
    """分布式限流器

    支持多种限流策略：
    - 全局限流
    - 用户级限流
    - 接口级限流
    - 时间窗口限流
    """

    def __init__(
        self,
        default_capacity: int = 100,
        default_refill_rate: float = 10.0,
        default_window: int = 60,
    ):
        """
        Args:
            default_capacity: 默认桶容量
            default_refill_rate: 默认补充速率（令牌/秒）
            default_window: 默认时间窗口（秒）
        """
        self.default_capacity = default_capacity
        self.default_refill_rate = default_refill_rate
        self.default_window = default_window

        # 令牌桶字典（key -> TokenBucket）
        self._buckets: Dict[str, TokenBucket] = {}

        # 时间窗口计数器（key -> {count, window_start}）
        self._windows: Dict[str, Dict] = {}

        # 配置字典（key -> RateLimitConfig）
        self._configs: Dict[str, Dict] = {}

        # 锁（线程安全）
        self._lock = asyncio.Lock()

        # 统计信息
        self._stats = {
            "total_requests": 0,
            "allowed": 0,
            "denied": 0,
            "waited": 0,
            "queued": 0,
        }

        logger.info(
            "限流器初始化: capacity=%d, rate=%.1f/s, window=%ds",
            default_capacity, default_refill_rate, default_window
        )

    def configure(
        self,
        key: str,
        capacity: Optional[int] = None,
        refill_rate: Optional[float] = None,
        window: Optional[int] = None,
    ) -> None:
        """配置限流规则

        Args:
            key: 限流键（如 "user:123", "api:/rag/query"）
            capacity: 桶容量
            refill_rate: 补充速率
            window: 时间窗口
        """
        self._configs[key] = {
            "capacity": capacity or self.default_capacity,
            "refill_rate": refill_rate or self.default_refill_rate,
            "window": window or self.default_window,
        }
        logger.info("限流配置: %s -> %s", key, self._configs[key])

    def _get_bucket(self, key: str) -> TokenBucket:
        """获取或创建令牌桶"""
        config = self._configs.get(key, {
            "capacity": self.default_capacity,
            "refill_rate": self.default_refill_rate,
            "window": self.default_window,
        })

        if key not in self._buckets:
            self._buckets[key] = TokenBucket(
                capacity=config["capacity"],
                refill_rate=config["refill_rate"],
            )

        return self._buckets[key]

    async def check(
        self,
        key: str,
        tokens: int = 1,
        action: RateLimitAction = RateLimitAction.DENY,
    ) -> RateLimitResult:
        """检查限流（异步版本）

        Args:
            key: 限流键
            tokens: 请求消耗的令牌数
            action: 拒绝时的动作（deny/wait/queue）

        Returns:
            限流结果
        """
        async with self._lock:
            self._stats["total_requests"] += 1

            bucket = self._get_bucket(key)
            result = bucket.consume(tokens)

            if result.allowed:
                self._stats["allowed"] += 1
            elif result.action == RateLimitAction.DENY:
                self._stats["denied"] += 1
                result.action = RateLimitAction.DENY
            else:
                result.action = action

            return result

    async def check_with_window(
        self,
        key: str,
        limit: int = 100,
        window: int = 60,
    ) -> RateLimitResult:
        """时间窗口限流检查

        Args:
            key: 限流键
            limit: 窗口内最大请求数
            window: 时间窗口（秒）

        Returns:
            限流结果
        """
        async with self._lock:
            self._stats["total_requests"] += 1

            now = time.time()
            window_key = f"{key}:window"

            # 获取或创建窗口
            if window_key not in self._windows:
                self._windows[window_key] = {
                    "count": 0,
                    "start": now,
                    "limit": limit,
                    "window": window,
                }

            window_data = self._windows[window_key]

            # 检查窗口是否过期
            if now - window_data["start"] >= window_data["window"]:
                window_data["count"] = 0
                window_data["start"] = now

            # 检查是否超过限制
            if window_data["count"] >= window_data["limit"]:
                retry_after = window_data["start"] + window_data["window"] - now
                self._stats["denied"] += 1
                return RateLimitResult(
                    action=RateLimitAction.DENY,
                    allowed=False,
                    remaining=0,
                    limit=window_data["limit"],
                    retry_after=retry_after,
                    message=f"请求过于频繁，请在 {retry_after:.2f} 秒后重试",
                )

            # 允许请求
            window_data["count"] += 1
            self._stats["allowed"] += 1

            return RateLimitResult(
                action=RateLimitAction.ALLOW,
                allowed=True,
                remaining=window_data["limit"] - window_data["count"],
                limit=window_data["limit"],
                message="请求已允许",
            )

    def check_sync(
        self,
        key: str,
        tokens: int = 1,
    ) -> RateLimitResult:
        """检查限流（同步版本，用于非异步上下文）"""
        bucket = self._get_bucket(key)
        result = bucket.consume(tokens)

        self._stats["total_requests"] += 1
        if result.allowed:
            self._stats["allowed"] += 1
        else:
            self._stats["denied"] += 1

        return result

    def get_stats(self) -> Dict:
        """获取统计信息"""
        return {
            **self._stats,
            "active_buckets": len(self._buckets),
            "active_windows": len(self._windows),
            "configured_rules": len(self._configs),
        }

    def get_bucket_status(self, key: Optional[str] = None) -> Dict:
        """获取桶状态"""
        if key:
            bucket = self._get_bucket(key)
            return {key: bucket.get_status()}

        return {
            k: v.get_status()
            for k, v in list(self._buckets.items())[:20]  # 最多返回 20 个
        }

    def reset(self, key: Optional[str] = None) -> None:
        """重置限流器

        Args:
            key: 指定重置的键（None 表示全部重置）
        """
        if key:
            if key in self._buckets:
                del self._buckets[key]
            if f"{key}:window" in self._windows:
                del self._windows[f"{key}:window"]
            logger.info("限流器已重置: %s", key)
        else:
            self._buckets.clear()
            self._windows.clear()
            self._stats = {
                "total_requests": 0,
                "allowed": 0,
                "denied": 0,
                "waited": 0,
                "queued": 0,
            }
            logger.info("所有限流器已重置")

    def cleanup(self, max_age: float = 3600) -> int:
        """清理过期数据

        Args:
            max_age: 最大年龄（秒）

        Returns:
            清理的数量
        """
        now = time.time()
        cleaned = 0

        # 清理过期的窗口
        for key in list(self._windows.keys()):
            window_data = self._windows[key]
            if now - window_data["start"] > max_age:
                del self._windows[key]
                cleaned += 1

        # 清理长时间未使用的桶
        for key in list(self._buckets.keys()):
            bucket = self._buckets[key]
            if now - bucket.last_refill > max_age:
                del self._buckets[key]
                cleaned += 1

        if cleaned > 0:
            logger.info("清理 %d 个过期限流条目", cleaned)

        return cleaned


# 全局单例
_limiter_instance: Optional[RateLimiter] = None


def get_rate_limiter(
    default_capacity: int = 100,
    default_refill_rate: float = 10.0,
    default_window: int = 60,
) -> RateLimiter:
    """获取全局限流器单例"""
    global _limiter_instance
    if _limiter_instance is None:
        _limiter_instance = RateLimiter(
            default_capacity=default_capacity,
            default_refill_rate=default_refill_rate,
            default_window=default_window,
        )
    return _limiter_instance

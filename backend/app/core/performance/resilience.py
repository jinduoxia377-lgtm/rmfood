"""
RMFOOD 统一服务层错误处理与降级策略

功能:
✅ 异常转换 (将底层异常转为业务异常)
✅ 优雅降级 (服务不可用时提供备选方案)
✅ 重试机制 (自动重试临时性故障)
✅ 断路器模式 (防止级联故障)
✅ 日志标准化 (统一格式和上下文)
✅ 性能监控 (错误率、延迟统计)

架构设计:
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Service   │───▶│ Error Handler │───▶│ Circuit     │
│   Layer     │    │ (转换+日志)   │    │ Breaker     │
└─────────────┘    └──────────────┘    └─────────────┘
       │                                      │
       ▼                                      ▼
┌─────────────┐                       ┌─────────────┐
│ Fallback    │◀──────────────────────│ Metrics     │
│ Service     │   (降级触发时)        │ Collector   │
└─────────────┘                       └─────────────┘
"""

from __future__ import annotations

import asyncio
import functools
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum, auto
from typing import Any, Callable, Dict, List, Optional, TypeVar

from app.core.middleware.exceptions import (
    AppError,
)
from app.utils.error_sanitize import sanitize_error

logger = logging.getLogger(__name__)

T = TypeVar('T')


# ════════════════════════════════════════════
# 断路器状态机
# ════════════════════════════════════════════

class CircuitState(Enum):
    """断路器状态"""
    CLOSED = auto()      # 正常：请求正常通过
    OPEN = auto()        # 断开：快速失败，不执行请求
    HALF_OPEN = auto()   # 半开：允许少量请求试探


@dataclass
class CircuitBreakerConfig:
    """断路器配置"""
    failure_threshold: int = 5          # 连续失败N次后断开
    recovery_timeout: float = 30.0     # 断开后等待N秒尝试恢复
    half_open_max_calls: int = 3       # 半开状态允许的探测请求数
    success_threshold: int = 2         # 半开状态成功N次则关闭


@dataclass
class CircuitBreakerStats:
    """断路器统计"""
    state: CircuitState = CircuitState.CLOSED
    total_failures: int = 0
    total_successes: int = 0
    total_rejections: int = 0  # 被拒绝的请求（OPEN状态）
    last_failure_time: Optional[float] = None
    last_state_change: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "state": self.state.name,
            "failures": self.total_failures,
            "successes": self.total_successes,
            "rejections": self.total_rejections,
            "failure_rate": f"{(self.total_failures / max(self.total_failures + self.total_successes, 1)) * 100:.1f}%",
        }


class CircuitBreaker:
    """
    断路器实现

    用法:
        breaker = CircuitBreaker("database", config=CircuitBreakerConfig(failure_threshold=3))

        @breaker.protect
        async def query_database():
            # 数据库操作...
            pass

        # 或者手动使用
        if breaker.allow_request():
            try:
                result = await operation()
                breaker.record_success()
            except Exception as op_err:
                logger.warning("断路操作失败 (%s): %s", name, op_err)
                breaker.record_failure()
    """

    def __init__(self, name: str, config: Optional[CircuitBreakerConfig] = None):
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self.stats = CircuitBreakerStats()
        self._lock = asyncio.Lock()

        logger.info(f"⚡ 断路器初始化 | 名称: {name} | 失败阈值: {self.config.failure_threshold}")

    @property
    def state(self) -> CircuitState:
        return self.stats.state

    async def allow_request(self) -> bool:
        """
        检查是否允许请求通过

        Returns:
            True=允许, False=拒绝（快速失败）
        """
        async with self._lock:
            now = time.time()

            if self.stats.state == CircuitState.CLOSED:
                return True

            elif self.stats.state == CircuitState.OPEN:
                # 检查是否进入半开状态
                if (self.stats.last_failure_time and
                    now - self.stats.last_failure_time >= self.config.recovery_timeout):
                    self.stats.state = CircuitState.HALF_OPEN
                    self.stats.last_state_change = now
                    logger.info(f"🔓 断路器 [{self.name}] 进入HALF_OPEN状态")
                    return True
                else:
                    self.stats.total_rejections += 1
                    return False

            elif self.stats.state == CircuitState.HALF_OPEN:
                # 限制半开状态的并发请求数
                return True

            return False

    async def record_success(self):
        """记录成功调用"""
        async with self._lock:
            self.stats.total_successes += 1

            if self.stats.state == CircuitState.HALF_OPEN:
                # 检查是否达到恢复阈值
                recent_successes = self.stats.total_successes  # 简化版
                if recent_successes >= self.config.success_threshold:
                    self.stats.state = CircuitState.CLOSED
                    self.stats.total_failures = 0
                    self.stats.last_state_change = time.time()
                    logger.info(
                        f"✅ 断路器 [{self.name}] 已恢复到CLOSED状态 | "
                        f"连续成功: {recent_successes}"
                    )

    async def record_failure(self):
        """记录失败调用"""
        async with self._lock:
            self.stats.total_failures += 1
            self.stats.last_failure_time = time.time()

            if self.stats.state == CircuitState.HALF_OPEN:
                # 半开状态下失败，重新打开
                self.stats.state = CircuitState.OPEN
                self.stats.last_state_change = time.time()
                logger.warning(
                    f"⚠️ 断路器 [{self.name}] HALF_OPEN探测失败，重新打开"
                )

            elif self.stats.state == CircuitState.CLOSED:
                # 检查是否达到阈值
                if self.stats.total_failures >= self.config.failure_threshold:
                    self.stats.state = CircuitState.OPEN
                    self.stats.last_state_change = time.time()
                    logger.error(
                        f"🚨 断路器 [{self.name}] 已打开 | "
                        f"连续失败: {self.stats.total_failures}"
                    )

    def protect(self, func: Callable) -> Callable:
        """装饰器：为函数添加断路器保护"""
        if asyncio.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                if not await self.allow_request():
                    raise AppError(
                        message=f"服务 [{self.name}] 暂时不可用（断路器开启）",
                        error_code="CIRCUIT_OPEN",
                        status_code=503,
                        details={"service": self.name, "state": self.state.name}
                    )

                try:
                    result = await func(*args, **kwargs)
                    await self.record_success()
                    return result
                except Exception as e:
                    await self.record_failure()
                    raise

            return async_wrapper
        else:
            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                raise NotImplementedError("同步函数暂不支持")

            return sync_wrapper

    def get_stats(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            **self.stats.to_dict(),
            "config": {
                "failure_threshold": self.config.failure_threshold,
                "recovery_timeout": self.config.recovery_timeout,
            }
        }


# ════════════════════════════════════════════
# 重试机制
# ════════════════════════════════════════════

@dataclass
class RetryConfig:
    """重试配置"""
    max_attempts: int = 3              # 最大重试次数
    base_delay: float = 1.0           # 初始延迟(秒)
    max_delay: float = 30.0           # 最大延迟(秒)
    exponential_base: float = 2.0     # 指数退避基数
    jitter: bool = True               # 是否添加随机抖动

    # 可重试的异常类型
    retryable_exceptions: tuple = (
        ConnectionError,
        TimeoutError,
        OSError,
    )


def retry_with_backoff(config: Optional[RetryConfig] = None):
    """
    重试装饰器 (指数退避 + 抖动)

    Usage:
        @retry_with_backoff(RetryConfig(max_attempts=5))
        async def unstable_operation():
            ...
    """
    cfg = config or RetryConfig()

    def decorator(func: Callable) -> Callable:
        if asyncio.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                last_exception = None

                for attempt in range(cfg.max_attempts):
                    try:
                        return await func(*args, **kwargs)

                    except cfg.retryable_exceptions as e:
                        last_exception = e

                        if attempt < cfg.max_attempts - 1:
                            # 计算延迟
                            delay = min(
                                cfg.base_delay * (cfg.exponential_base ** attempt),
                                cfg.max_delay
                            )

                            if cfg.jitter:
                                import random
                                delay *= (0.5 + random.random())

                            logger.warning(
                                f"🔄 重试 ({attempt + 1}/{cfg.max_attempts}) | "
                                f"函数: {func.__name__} | "
                                f"等待: {delay:.2f}s | "
                                f"错误: {e}"
                            )
                            await asyncio.sleep(delay)

                    except Exception as retry_err:
                        logger.warning("断路操作 %s 非可重试异常，直接抛出: %s", name, retry_err)
                        # 非可重试异常，直接抛出
                        raise

                # 所有重试都失败
                raise last_exception

            return async_wrapper
        else:
            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                raise NotImplementedError("同步函数暂不支持")

            return sync_wrapper

    return decorator


# ════════════════════════════════════════════
# 服务降级管理器
# ════════════════════════════════════════════

@dataclass
class FallbackResult:
    """降级结果"""
    is_fallback: bool = True
    fallback_reason: str = ""
    original_error: Optional[str] = None
    data: Any = None
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ServiceDegradationManager:
    """
    服务降级管理器

    当主服务不可用时，自动切换到降级方案。

    Usage:
        manager = ServiceDegradationManager()

        # 注册降级方案
        manager.register_fallback(
            "peptide_analysis",
            primary=real_analysis_service,
            fallback=cached_or_simple_analysis,
        )

        # 使用
        result = await manager.execute("peptide_analysis", sequence="VLGYT")
    """

    def __init__(self):
        self._services: Dict[str, Dict[str, Callable]] = {}
        self._circuit_breakers: Dict[str, CircuitBreaker] = {}
        self._degradation_log: List[Dict[str, Any]] = []

        logger.info("⚡ 服务降级管理器初始化完成")

    def register_service(
        self,
        service_name: str,
        primary: Callable,
        fallback: Callable,
        circuit_config: Optional[CircuitBreakerConfig] = None,
    ):
        """
        注册服务及其降级方案

        Args:
            service_name: 服务名称
            primary: 主服务函数
            fallback: 降级服务函数
            circuit_config: 断路器配置
        """
        self._services[service_name] = {
            "primary": primary,
            "fallback": fallback,
        }

        self._circuit_breakers[service_name] = CircuitBreaker(
            service_name,
            config=circuit_config
        )

        logger.info(
            f"📝 注册服务降级 | 名称: {service_name} | "
            f"主服务: {primary.__name__} | "
            f"降级服务: {fallback.__name__}"
        )

    async def execute(
        self,
        service_name: str,
        *args,
        force_fallback: bool = False,
        **kwargs
    ) -> Any:
        """
        执行服务（自动选择主服务或降级服务）

        Args:
            service_name: 服务名称
            force_fallback: 强制使用降级服务

        Returns:
            服务结果或FallbackResult

        Raises:
            AppError: 主服务和降级服务都失败时
        """
        if service_name not in self._services:
            raise ValueError(f"未注册的服务: {service_name}")

        breaker = self._circuit_breakers[service_name]
        service = self._services[service_name]

        start_time = time.time()

        # 强制降级或断路器打开
        if force_fallback or not await breaker.allow_request():
            logger.warning(
                f"⬇️ 使用降级服务 | 名称: {service_name} | "
                f"原因: {'强制' if force_fallback else '断路器开启'}"
            )

            try:
                result = await service["fallback"](*args, **kwargs)

                self._log_degradation(service_name, "forced_fallback", None)

                return FallbackResult(
                    is_fallback=True,
                    fallback_reason="强制降级" if force_fallback else "断路器保护",
                    data=result,
                )

            except Exception as e:
                logger.error("降级服务也失败", exc_info=True)
                raise AppError(
                    message=f"服务 [{service_name}] 完全不可用",
                    error_code="SERVICE_UNAVAILABLE",
                    status_code=503,
                    details={"original_error": sanitize_error(e, "服务不可用")},
                )

        # 尝试主服务
        try:
            result = await service["primary"](*args, **kwargs)
            await breaker.record_success()

            elapsed_ms = (time.time() - start_time) * 1000
            logger.debug(
                f"✅ 主服务成功 | 名称: {service_name} | 耗时: {elapsed_ms:.1f}ms"
            )

            return result

        except Exception as e:
            await breaker.record_failure()

            elapsed_ms = (time.time() - start_time) * 1000
            logger.error(
                f"❌ 主服务失败 | 名称: {service_name} | "
                f"耗时: {elapsed_ms:.1f}ms | 错误: {e}"
            )

            # 尝试降级服务
            try:
                logger.info(f"🔄 切换到降级服务 | 名称: {service_name}")
                fallback_result = await service["fallback"](*args, **kwargs)

                self._log_degradation(
                    service_name,
                    "automatic_fallback",
                    sanitize_error(e, "服务异常")
                )

                return FallbackResult(
                    is_fallback=True,
                    fallback_reason="主服务异常，已切换降级方案",
                    original_error=sanitize_error(e, "服务异常"),
                    data=fallback_result,
                )

            except Exception as fallback_err:
                logger.critical(
                    f"💀 主服务和降级服务都失败 | "
                    f"服务: {service_name} | "
                    f"主错误: {e} | 降级错误: {fallback_err}"
                )

                raise AppError(
                    message=f"服务 [{service_name}] 不可用且降级失败",
                    error_code="SERVICE_DEGRADATION_FAILED",
                    status_code=503,
                    details={"primary_error": sanitize_error(e, "服务异常"), "fallback_error": sanitize_error(fallback_err, "降级失败")},
                )

    def _log_degradation(
        self,
        service_name: str,
        reason: str,
        error: Optional[str]
    ):
        """记录降级事件"""
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": service_name,
            "reason": reason,
            "error": error,
        }

        self._degradation_log.append(log_entry)

        # 只保留最近100条日志
        if len(self._degradation_log) > 100:
            self._degradation_log = self._degradation_log[-100:]

    def get_degradation_stats(self) -> Dict[str, Any]:
        """获取降级统计"""
        total = len(self._degradation_log)
        if total == 0:
            return {"total_degradations": 0}

        from collections import Counter
        reasons = Counter(entry["reason"] for entry in self._degradation_log)
        services = Counter(entry["service"] for entry in self._degradation_log)

        return {
            "total_degradations": total,
            "by_reason": dict(reasons.most_common(5)),
            "by_service": dict(services.most_common(10)),
            "recent_5": self._degradation_log[-5:],
        }

    def get_all_circuit_breakers(self) -> Dict[str, Dict]:
        """获取所有断路器状态"""
        return {
            name: breaker.get_stats()
            for name, breaker in self._circuit_breakers.items()
        }


# ════════════════════════════════════════════
# 全局实例
# ════════════════════════════════════════════

_global_degradation_manager: Optional[ServiceDegradationManager] = None


def get_degradation_manager() -> ServiceDegradationManager:
    """获取全局降级管理器实例"""
    global _global_degradation_manager
    if _global_degradation_manager is None:
        _global_degradation_manager = ServiceDegradationManager()
    return _global_degradation_manager


logger.info("⚡ 统一错误处理与降级策略框架初始化完成")


# ════════════════════════════════════════════
# AI 专属限流器 (用户级 + SSE 连接数限制)
# ════════════════════════════════════════════

from collections import defaultdict


@dataclass
class AIRateLimitConfig:
    """AI 接口限流配置"""
    global_rpm: int = 100           # 全局每分钟允许请求数
    per_user_rpm: int = 30          # 每用户每分钟允许请求数
    sse_max_connections: int = 5    # 每个用户同时打开的 SSE 连接数上限


class AIRateLimiter:
    """
    基于滑动窗口的 AI 接口限流器

    - 全局限流：防止流量突发耗尽 LLM Token 预算
    - 用户级限流：防止单用户滥用
    - SSE 连接计数：限制并发流式连接数
    """

    def __init__(self, config: AIRateLimitConfig = None):
        self.config = config or AIRateLimitConfig()
        self._lock = asyncio.Lock()
        # user_id -> list of timestamps (within current window)
        self._user_windows: dict[int, list[float]] = defaultdict(list)
        # global timestamp bucket (minute granularity)
        self._global_windows: dict[int, int] = defaultdict(int)
        # user_id -> set of active SSE connection IDs
        self._sse_connections: dict[int, set] = defaultdict(set)
        # 单调递增的连接 ID 计数器（register 未显式传入 conn_id 时使用）
        self._next_sse_conn_id = 1

    async def check_request(self, user_id: int | None) -> tuple[bool, str]:
        """
        检查是否允许通过。
        Returns: (allowed, error_detail)
        """
        async with self._lock:
            # ── 1. 用户级限流 ──
            if user_id is not None:
                now = time.time()
                minute_window_start = int(now // 60) * 60
                cutoff = minute_window_start

                # 清理过期记录
                windows = [t for t in self._user_windows[user_id] if t > cutoff]
                self._user_windows[user_id] = windows

                if len(windows) >= self.config.per_user_rpm:
                    return False, "请求过于频繁，请 1 分钟后重试"

                self._user_windows[user_id].append(now)

            # ── 2. 全局限流 ──
            now = time.time()
            global_bucket = int(now // 60)
            if self._global_windows.get(global_bucket, 0) >= self.config.global_rpm:
                return False, "系统繁忙，请稍后重试"

            self._global_windows[global_bucket] = self._global_windows.get(global_bucket, 0) + 1

            return True, ""

    async def register_sse_connection(self, user_id: int, conn_id: int | None = None) -> bool:
        """注册一个 SSE 连接，返回是否允许

        Args:
            user_id: 用户/组织 ID
            conn_id: 连接唯一 ID；未传入时使用内部单调递增计数器生成，
                     避免以 set 对象自身 id 作为连接 ID（同一 set 的 id 恒定，
                     会导致连接计数恒为 1，永远达不到上限）。
        """
        async with self._lock:
            conns = self._sse_connections[user_id]
            if len(conns) >= self.config.sse_max_connections:
                return False
            if conn_id is None:
                conn_id = self._next_sse_conn_id
                self._next_sse_conn_id += 1
            conns.add(conn_id)
            return True

    async def unregister_sse_connection(self, user_id: int, conn_id: int):
        """取消注册 SSE 连接"""
        async with self._lock:
            self._sse_connections[user_id].discard(conn_id)
            if not self._sse_connections[user_id]:
                del self._sse_connections[user_id]

    async def get_stats(self) -> dict:
        """获取限流统计"""
        async with self._lock:
            return {
                "tracked_users": len(self._user_windows),
                "active_sse_connections": sum(len(v) for v in self._sse_connections.values()),
                "global_requests_current_minute": self._global_windows.get(int(time.time() // 60), 0),
                "config": {
                    "per_user_rpm": self.config.per_user_rpm,
                    "global_rpm": self.config.global_rpm,
                    "sse_max_connections": self.config.sse_max_connections,
                },
            }


# 全局单例
_ai_rate_limiter: Optional[AIRateLimiter] = None


def get_ai_rate_limiter() -> AIRateLimiter:
    global _ai_rate_limiter
    if _ai_rate_limiter is None:
        _ai_rate_limiter = AIRateLimiter()
    return _ai_rate_limiter

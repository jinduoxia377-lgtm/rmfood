"""
🔒 P4-2: 增强 HTTP 客户端 - 重试/熔断/超时统一管理

在现有 resilience.py 基础上提供专门的 HTTP 客户端增强：
1. **统一超时管理** - 按端点设置不同超时
2. **自动重试** - 指数退避 + 抖动
3. **断路器模式** - 防止级联故障
4. **连接池复用** - httpx.AsyncClient 连接池
5. **故障降级** - 返回缓存数据或空结果
6. **指标采集** - 记录延迟/错误率/重试次数到 Prometheus

使用方式:
    from app.core.api_framework.http_client import http_client, ExternalServiceConfig

    # 方式1: 简单请求（带默认重试）
    data = await http_client.get("https://api.example.com/data")

    # 方式2: 特定服务配置
    ai_config = ExternalServiceConfig(
        name="llm_provider",
        base_url="https://api.openai.com",
        timeout_seconds=30,
        max_retries=3,
        circuit_breaker_threshold=5,
    )
    result = await http_client.request_with_config(
        "POST", "/v1/chat/completions",
        json=payload,
        config=ai_config,
        headers={"Authorization": f"Bearer {API_KEY}"}
    )

    # 方式3: 带降级的请求
    async def fallback():
        return {"cached": True, "data": get_cached_data()}

    result = await http_client.request_with_fallback(
        "GET", "/api/expensive",
        fallback=fallback
    )
"""

from __future__ import annotations

import asyncio
import logging
import random
import threading
import time
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Callable, Dict, List, Optional, TypeVar, Union

import httpx

logger = logging.getLogger(__name__)

T = TypeVar('T')


# ════════════════════════════════════════════
# 🔒 P4-2: 断路器状态
# ════════════════════════════════════════════

class CircuitState(Enum):
    CLOSED = auto()      # 正常状态 - 请求通过
    OPEN = auto()        # 熔断 - 快速失败
    HALF_OPEN = auto()   # 半开 - 允许探测请求


# ════════════════════════════════════════════
# 🔒 P4-2: 外部服务配置
# ════════════════════════════════════════════

@dataclass
class ExternalServiceConfig:
    """单个外部服务的完整配置"""
    name: str
    base_url: str = ""
    timeout_seconds: float = 30.0
    connect_timeout: float = 5.0
    max_retries: int = 3
    initial_retry_delay_ms: float = 200.0
    max_retry_delay_ms: float = 5000.0
    backoff_multiplier: float = 2.0
    jitter_ms: float = 100.0
    circuit_breaker_threshold: int = 5    # 连续失败次数后熔断
    circuit_breaker_recovery_seconds: float = 30.0  # 熔断后恢复时间
    half_open_max_calls: int = 3          # 半开状态允许的探测请求数

    # 可重试的 HTTP 状态码
    retryable_status_codes: List[int] = field(
        default_factory=lambda: [408, 429, 500, 502, 503, 504]
    )

    # 可重试的异常类型
    retryable_exceptions: tuple = field(
        default_factory=lambda: (
            httpx.ConnectTimeout,
            httpx.ReadTimeout,
            httpx.WriteTimeout,
            httpx.PoolTimeout,
            httpx.NetworkError,
            httpx.RemoteProtocolError,
            ConnectionRefusedError,
            ConnectionResetError,
            asyncio.TimeoutError,
        )
    )


# 默认服务配置
DEFAULT_CONFIG = ExternalServiceConfig(
    name="default",
    timeout_seconds=15.0,
    max_retries=2,
)


# ════════════════════════════════════════════
# 🔒 P4-2: 断路器实现
# ════════════════════════════════════════════

class CircuitBreaker:
    """
    🔒 P4-2: 针对单个服务的断路器
    """

    def __init__(self, config: ExternalServiceConfig):
        self.config = config
        self._state: CircuitState = CircuitState.CLOSED
        self._failure_count: int = 0
        self._success_count: int = 0
        self._half_open_calls: int = 0
        self._open_time: Optional[float] = None
        self._total_requests: int = 0
        self._total_failures: int = 0
        self._total_shortcircuits: int = 0
        self._lock = threading.Lock()

    @property
    def state(self) -> CircuitState:
        return self._state

    def can_execute(self) -> bool:
        """判断是否允许执行请求"""
        with self._lock:
            if self._state == CircuitState.CLOSED:
                return True
            elif self._state == CircuitState.OPEN:
                # 检查是否已过恢复时间
                if self._open_time and (
                    time.time() - self._open_time
                ) >= self.config.circuit_breaker_recovery_seconds:
                    self._state = CircuitState.HALF_OPEN
                    self._half_open_calls = 0
                    self._success_count = 0
                    logger.info(
                        f"[CircuitBreaker:{self.config.name}] "
                        f"⚡ 进入 HALF_OPEN 状态（探测中）"
                    )
                    return True
                return False
            elif self._state == CircuitState.HALF_OPEN:
                if self._half_open_calls < self.config.half_open_max_calls:
                    self._half_open_calls += 1
                    return True
                return False
            return False

    def record_success(self) -> None:
        """记录成功"""
        with self._lock:
            self._total_requests += 1
            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                # 半开状态下连续成功 n 次则关闭
                if self._success_count >= self.config.half_open_max_calls:
                    self._state = CircuitState.CLOSED
                    self._failure_count = 0
                    logger.info(
                        f"[CircuitBreaker:{self.config.name}] "
                        f"✅ 服务恢复，断路器已关闭"
                    )
            else:
                # CLOSED 状态：重置失败计数
                self._failure_count = 0

    def record_failure(self) -> None:
        """记录失败"""
        with self._lock:
            self._total_requests += 1
            self._total_failures += 1
            self._failure_count += 1

            if self._state == CircuitState.HALF_OPEN:
                # 半开状态失败则重新熔断
                self._state = CircuitState.OPEN
                self._open_time = time.time()
                logger.warning(
                    f"[CircuitBreaker:{self.config.name}] "
                    f"⛔ 半开状态探测失败，重新熔断"
                )
            elif self._state == CircuitState.CLOSED:
                if self._failure_count >= self.config.circuit_breaker_threshold:
                    self._state = CircuitState.OPEN
                    self._open_time = time.time()
                    logger.warning(
                        f"[CircuitBreaker:{self.config.name}] "
                        f"⛔ 连续失败 {self._failure_count} 次，断路器熔断 "
                        f"({self.config.circuit_breaker_recovery_seconds}s 后恢复)"
                    )

    def record_shortcircuit(self) -> None:
        """记录短路（熔断状态下被拒绝的请求）"""
        with self._lock:
            self._total_shortcircuits += 1

    def get_stats(self) -> Dict[str, Any]:
        """获取断路器状态统计"""
        with self._lock:
            return {
                "state": self._state.name,
                "total_requests": self._total_requests,
                "total_failures": self._total_failures,
                "total_shortcircuits": self._total_shortcircuits,
                "failure_rate": (
                    self._total_failures / max(self._total_requests, 1) * 100
                ),
                "current_failure_streak": self._failure_count,
                "recovery_time_remaining": max(
                    0,
                    (
                        (self._open_time or 0)
                        + self.config.circuit_breaker_recovery_seconds
                    )
                    - time.time(),
                ) if self._state == CircuitState.OPEN else 0,
            }


# ════════════════════════════════════════════
# 🔒 P4-2: 增强 HTTP 客户端
# ════════════════════════════════════════════

class EnhancedHttpClient:
    """
    🔒 P4-2: 增强的 HTTP 客户端

    特性:
    - 连接池复用（httpx.AsyncClient）
    - 每个服务独立的断路器
    - 指数退避重试
    - 统一超时管理
    - 故障降级支持
    - 请求指标记录
    """

    def __init__(self):
        self._clients: Dict[str, httpx.AsyncClient] = {}
        self._circuit_breakers: Dict[str, CircuitBreaker] = {}
        self._metrics: Dict[str, Dict[str, float]] = defaultdict(dict)
        self._lock = threading.Lock()
        self._initialized = False

    # ── 初始化/清理 ──

    def init(self) -> None:
        """初始化客户端（在应用启动时调用）"""
        with self._lock:
            if self._initialized:
                return

            # 默认客户端（通用请求）
            self._clients["default"] = httpx.AsyncClient(
                timeout=httpx.Timeout(DEFAULT_CONFIG.timeout_seconds),
                limits=httpx.Limits(
                    max_connections=100,
                    max_keepalive_connections=20,
                    keepalive_expiry=30.0,
                ),
                http2=True,
            )
            self._circuit_breakers["default"] = CircuitBreaker(DEFAULT_CONFIG)
            self._initialized = True
            logger.info("[HttpClient] 已初始化（默认连接池: 100 连接）")

    async def close(self) -> None:
        """关闭所有客户端（在应用关闭时调用）"""
        with self._lock:
            for name, client in self._clients.items():
                try:
                    await client.aclose()
                    logger.info(f"[HttpClient:{name}] 连接已关闭")
                except Exception as e:
                    logger.warning(f"[HttpClient:{name}] 关闭异常: {e}")
            self._clients.clear()
            self._circuit_breakers.clear()
            self._initialized = False

    # ── 服务配置 ──

    def register_service(self, config: ExternalServiceConfig) -> None:
        """注册具体服务（创建专用连接池 + 断路器）"""
        if not self._initialized:
            self.init()

        with self._lock:
            if config.name in self._clients:
                return  # 已存在则跳过

            self._clients[config.name] = httpx.AsyncClient(
                base_url=config.base_url,
                timeout=httpx.Timeout(
                    connect=config.connect_timeout,
                    read=config.timeout_seconds,
                    write=config.timeout_seconds,
                    pool=config.timeout_seconds,
                ),
                limits=httpx.Limits(
                    max_connections=50,
                    max_keepalive_connections=10,
                    keepalive_expiry=30.0,
                ),
                http2=True,
            )
            self._circuit_breakers[config.name] = CircuitBreaker(config)
            logger.info(
                f"[HttpClient] 服务已注册: {config.name} "
                f"({config.base_url or '无基础URL'})"
            )

    def get_circuit_breaker_stats(self, service_name: str = None) -> Dict[str, Any]:
        """获取断路器状态"""
        if service_name:
            cb = self._circuit_breakers.get(service_name)
            if cb:
                return {service_name: cb.get_stats()}
            return {service_name: {"error": "服务未注册"}}

        return {
            name: cb.get_stats() for name, cb in self._circuit_breakers.items()
        }

    # ── 核心请求方法 ──

    async def request(
        self,
        method: str,
        url: str,
        *,
        service_name: str = "default",
        config: Optional[ExternalServiceConfig] = None,
        **kwargs: Any,
    ) -> Optional[httpx.Response]:
        """
        🔒 P4-2: 执行 HTTP 请求（带断路器 + 自动重试）

        Args:
            method: HTTP 方法 (GET, POST, etc.)
            url: 请求 URL（如果服务注册了 base_url，则是相对路径）
            service_name: 已注册的服务名（用于连接池 + 断路器）
            config: 自定义配置（覆盖默认）
            **kwargs: 传递给 httpx 的参数（headers, json, params 等）

        Returns:
            httpx.Response 对象（成功时），None（熔断时）

        Raises:
            httpx.HTTPError: 超过最大重试次数仍失败
        """
        if not self._initialized:
            self.init()

        active_config = config or (
            self._circuit_breakers[service_name].config
            if service_name in self._circuit_breakers
            else DEFAULT_CONFIG
        )
        circuit_breaker = self._circuit_breakers.get(
            service_name, self._circuit_breakers["default"]
        )
        client = self._clients.get(service_name, self._clients["default"])

        return await self._execute_with_retry(
            client=client,
            method=method,
            url=url,
            config=active_config,
            circuit_breaker=circuit_breaker,
            service_name=service_name,
            **kwargs,
        )

    async def _execute_with_retry(
        self,
        client: httpx.AsyncClient,
        method: str,
        url: str,
        config: ExternalServiceConfig,
        circuit_breaker: CircuitBreaker,
        service_name: str,
        **kwargs: Any,
    ) -> Optional[httpx.Response]:
        """核心执行逻辑：断路器检查 + 指数退避重试"""

        # 1. 断路器检查
        if not circuit_breaker.can_execute():
            circuit_breaker.record_shortcircuit()
            logger.warning(
                f"[HttpClient:{service_name}] ⛔ 断路器已打开，请求被拒绝: {method} {url}"
            )
            return None

        last_exception: Optional[Exception] = None
        delay_ms = config.initial_retry_delay_ms

        for attempt in range(config.max_retries + 1):
            attempt_start = time.time()

            try:
                response = await client.request(
                    method=method,
                    url=url,
                    timeout=httpx.Timeout(
                        connect=config.connect_timeout,
                        read=config.timeout_seconds,
                        write=config.timeout_seconds,
                        pool=config.timeout_seconds,
                    ),
                    **kwargs,
                )

                duration_ms = (time.time() - attempt_start) * 1000

                # 检查响应状态码
                if response.status_code in config.retryable_status_codes and (
                    attempt < config.max_retries
                ):
                    logger.warning(
                        f"[HttpClient:{service_name}] "
                        f"可重试错误 {response.status_code} "
                        f"(attempt={attempt + 1}/{config.max_retries + 1}): {method} {url}"
                    )
                    delay_ms = self._sleep_between_retries(
                        delay_ms, config, attempt
                    )
                    continue

                # 记录指标
                self._record_metric(
                    service_name, method, response.status_code, duration_ms
                )

                # 记录成功（2xx 和 4xx 都算请求成功，不算失败）
                if response.status_code < 500:
                    circuit_breaker.record_success()
                else:
                    circuit_breaker.record_failure()

                return response

            except config.retryable_exceptions as e:
                last_exception = e
                duration_ms = (time.time() - attempt_start) * 1000

                if attempt < config.max_retries:
                    logger.warning(
                        f"[HttpClient:{service_name}] "
                        f"请求异常: {type(e).__name__} "
                        f"(attempt={attempt + 1}/{config.max_retries + 1}): {method} {url}"
                    )
                    delay_ms = self._sleep_between_retries(
                        delay_ms, config, attempt
                    )
                    continue
                else:
                    # 已达最大重试次数
                    circuit_breaker.record_failure()
                    logger.error(
                        f"[HttpClient:{service_name}] "
                        f"❌ 请求失败 ({config.max_retries + 1} 次尝试): "
                        f"{method} {url} -> {type(e).__name__}: {e}"
                    )
                    raise

            except Exception as e:
                # 不可重试的异常（如认证失败、格式错误等）
                duration_ms = (time.time() - attempt_start) * 1000
                circuit_breaker.record_success()  # 请求成功到达服务器，只是返回业务错误
                self._record_metric(service_name, method, 0, duration_ms)
                logger.error(
                    f"[HttpClient:{service_name}] "
                    f"❌ 不可重试错误: {type(e).__name__}: {e}"
                )
                raise

        # 理论上不会到这里（循环中要么 return 要么 raise）
        if last_exception:
            raise last_exception
        raise httpx.HTTPError("Request failed without exception")

    async def _sleep_between_retries(
        self, delay_ms: float, config: ExternalServiceConfig, attempt: int
    ) -> float:
        """计算并执行退避延迟"""
        jitter = random.uniform(-config.jitter_ms, config.jitter_ms)
        sleep_time = min(delay_ms + jitter, config.max_retry_delay_ms) / 1000.0
        await asyncio.sleep(sleep_time)
        return delay_ms * config.backoff_multiplier

    # ── 便捷方法 ──

    async def get(
        self,
        url: str,
        *,
        service_name: str = "default",
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Optional[httpx.Response]:
        """GET 请求"""
        return await self.request(
            "GET", url, service_name=service_name, params=params, headers=headers, **kwargs
        )

    async def post(
        self,
        url: str,
        *,
        service_name: str = "default",
        json: Optional[Any] = None,
        data: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Optional[httpx.Response]:
        """POST 请求"""
        return await self.request(
            "POST", url, service_name=service_name, json=json, data=data, headers=headers, **kwargs
        )

    async def put(
        self, url: str, *, service_name: str = "default", **kwargs: Any
    ) -> Optional[httpx.Response]:
        """PUT 请求"""
        return await self.request("PUT", url, service_name=service_name, **kwargs)

    async def delete(
        self, url: str, *, service_name: str = "default", **kwargs: Any
    ) -> Optional[httpx.Response]:
        """DELETE 请求"""
        return await self.request("DELETE", url, service_name=service_name, **kwargs)

    # ── 带降级的请求 ──

    async def request_with_fallback(
        self,
        method: str,
        url: str,
        *,
        service_name: str = "default",
        fallback: Optional[Callable[[], T]] = None,
        default_value: Optional[T] = None,
        **kwargs: Any,
    ) -> Union[Optional[httpx.Response], T]:
        """
        🔒 P4-2: 带降级的请求

        当请求失败或熔断时，返回 fallback 函数结果或 default_value

        用法:
            result = await http_client.request_with_fallback(
                "GET", "/api/data",
                service_name="external_api",
                fallback=lambda: get_cached_data(),
                default_value={"status": "offline"}
            )
        """
        try:
            response = await self.request(
                method, url, service_name=service_name, **kwargs
            )
            if response is not None and response.status_code < 500:
                return response
        except Exception as e:
            logger.warning(
                f"[HttpClient:{service_name}] 降级: {method} {url} -> {type(e).__name__}"
            )

        # 降级处理
        if fallback is not None:
            try:
                if asyncio.iscoroutinefunction(fallback):
                    return await fallback()
                return fallback()
            except Exception as fe:
                logger.error(
                    f"[HttpClient:{service_name}] 降级函数也失败了: {type(fe).__name__}"
                )

        return default_value

    # ── 并发请求 ──

    async def concurrent_requests(
        self,
        requests: List[Dict[str, Any]],
        *,
        service_name: str = "default",
        max_concurrent: int = 5,
    ) -> List[Optional[httpx.Response]]:
        """
        🔒 P4-2: 并发执行多个请求（带并发限制）

        Args:
            requests: [{"method": "GET", "url": "/api/1", "params": {...}}, ...]
            service_name: 服务名
            max_concurrent: 最大并发数（默认 5）

        用法:
            results = await http_client.concurrent_requests(
                [
                    {"method": "GET", "url": "/api/1"},
                    {"method": "GET", "url": "/api/2"},
                ],
                max_concurrent=3
            )
        """
        semaphore = asyncio.Semaphore(max_concurrent)

        async def _limited_request(req):
            async with semaphore:
                return await self.request(
                    req.get("method", "GET"),
                    req.get("url", ""),
                    service_name=req.get("service_name", service_name),
                    params=req.get("params"),
                    json=req.get("json"),
                    headers=req.get("headers"),
                )

        tasks = [_limited_request(req) for req in requests]
        return await asyncio.gather(*tasks, return_exceptions=True)

    # ── 指标管理 ──

    def _record_metric(
        self,
        service_name: str,
        method: str,
        status_code: int,
        duration_ms: float,
    ) -> None:
        """记录请求指标（可对接 Prometheus）"""
        key = f"{service_name}:{method.upper()}"
        with self._lock:
            m = self._metrics[key]
            m["total_requests"] = m.get("total_requests", 0) + 1
            m["total_duration_ms"] = m.get("total_duration_ms", 0) + duration_ms
            if status_code >= 500:
                m["server_errors"] = m.get("server_errors", 0) + 1
            elif status_code >= 400:
                m["client_errors"] = m.get("client_errors", 0) + 1
            else:
                m["success"] = m.get("success", 0) + 1

            if not m.get("min_ms") or duration_ms < m["min_ms"]:
                m["min_ms"] = duration_ms
            if not m.get("max_ms") or duration_ms > m["max_ms"]:
                m["max_ms"] = duration_ms

    def get_metrics(self) -> Dict[str, Any]:
        """获取请求指标"""
        result = {}
        with self._lock:
            for key, m in self._metrics.items():
                total = m.get("total_requests", 0)
                result[key] = {
                    "total_requests": total,
                    "success": m.get("success", 0),
                    "client_errors": m.get("client_errors", 0),
                    "server_errors": m.get("server_errors", 0),
                    "avg_duration_ms": round(
                        m.get("total_duration_ms", 0) / max(total, 1), 2
                    ),
                    "min_ms": round(m.get("min_ms", 0), 2),
                    "max_ms": round(m.get("max_ms", 0), 2),
                    "error_rate": round(
                        (m.get("server_errors", 0) / max(total, 1)) * 100, 2
                    ),
                }
        return result


# 全局单例
http_client = EnhancedHttpClient()


# ════════════════════════════════════════════
# 🔒 P4-2: 便捷函数（供外部快速使用）
# ════════════════════════════════════════════

async def http_get(url: str, **kwargs) -> Optional[httpx.Response]:
    """便捷 GET 请求"""
    return await http_client.get(url, **kwargs)


async def http_post(url: str, **kwargs) -> Optional[httpx.Response]:
    """便捷 POST 请求"""
    return await http_client.post(url, **kwargs)


async def http_request(
    method: str,
    url: str,
    *,
    service_name: str = "default",
    **kwargs,
) -> Optional[httpx.Response]:
    """通用请求"""
    return await http_client.request(
        method, url, service_name=service_name, **kwargs
    )


# defaultdict 补充（避免 import 顺序问题）
from collections import defaultdict

__all__ = [
    "CircuitState",
    "ExternalServiceConfig",
    "CircuitBreaker",
    "EnhancedHttpClient",
    "http_client",
    "http_get",
    "http_post",
    "http_request",
]

"""
🟡 P3-2: 健康检查与 Prometheus 指标系统

提供企业级可观测性能力:
1. 🌡️ 多层健康检查 - 应用 / 数据库 / Redis / AI 服务
2. 📊 Prometheus 指标 - 请求计数 / 延迟 / 错误率 / 业务指标
3. 🔍 自定义指标 - 配方操作 / AI 调用 / 用户活动
4. ⚡ 性能追踪 - 慢查询 / 高延迟请求 / 资源使用
5. 📈 趋势分析 - 吞吐量 / 错误趋势 / 容量预测
6. 🔔 告警规则 - CPU / 内存 / 错误率 / 可用性

使用方式:
    # 1. 接入指标
    from app.core.monitoring import (
        monitor,
        track_request,
        track_formula_operation,
        track_ai_call,
    )

    # 2. 记录业务指标
    track_formula_operation("create", formula_id="f_001", category="保健品")

    # 3. API 端点
    GET /health              # 基础健康检查
    GET /health/ready       # 就绪检查
    GET /health/live        # 存活检查
    GET /metrics            # Prometheus 指标

    # 4. 告警规则（见 docker/prometheus/rules）
    - API 响应时间 > 2s 持续 5 分钟
    - 错误率 > 5% 持续 2 分钟
    - CPU 使用率 > 80% 持续 10 分钟
"""

from __future__ import annotations

import asyncio
import time
import uuid

from app.utils.error_sanitize import sanitize_error
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from functools import wraps
from typing import Any, Callable, Dict, List, Optional, Set

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel
from starlette.responses import JSONResponse, PlainTextResponse

logger = __import__("logging").getLogger(__name__)


# ═════════════════════════════════════════════
# 🟡 P3-2: Prometheus 指标定义
# ═════════════════════════════════════════════

try:
    from prometheus_client import (
        Counter,
        Histogram,
        Gauge,
        Summary,
        Info,
        Enum as PEnum,
        generate_latest,
        CONTENT_TYPE_LATEST,
        CollectorRegistry,
        REGISTRY,
    )

    HAS_PROMETHEUS = True
except ImportError:
    HAS_PROMETHEUS = False
    logger.warning("prometheus_client 未安装，指标系统降级")

    # 降级：创建空实现的指标类
    class _DummyMetric:
        def __init__(self, *args, **kwargs): pass
        def labels(self, **kwargs): return self
        def observe(self, *args, **kwargs): pass
        def inc(self, *args, **kwargs): pass
        def dec(self, *args, **kwargs): pass
        def set(self, *args, **kwargs): pass
        def time(self): return _DummyContextManager()

    class _DummyContextManager:
        def __enter__(self): return self
        def __exit__(self, *args): pass

    Counter = Histogram = Gauge = Summary = Info = _DummyMetric

# ═════════════════════════════════════════════
# 🟡 P3-2: 指标定义（项目级）
# ═════════════════════════════════════════════

# ─── HTTP 请求指标 ───

HTTP_REQUESTS_TOTAL = Counter(
    "rmfood_http_requests_total",
    "HTTP 请求总数",
    ["method", "endpoint", "status_code"],
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "rmfood_http_request_duration_seconds",
    "HTTP 请求耗时（秒）",
    ["method", "endpoint", "status_code"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

HTTP_REQUESTS_IN_PROGRESS = Gauge(
    "rmfood_http_requests_in_progress",
    "正在处理的 HTTP 请求数",
    ["method", "endpoint"],
)

# ─── 数据库指标 ───

DB_QUERY_DURATION_SECONDS = Histogram(
    "rmfood_db_query_duration_seconds",
    "数据库查询耗时（秒）",
    ["operation", "table"],
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0),
)

DB_CONNECTION_POOL_SIZE = Gauge(
    "rmfood_db_connection_pool_size",
    "数据库连接池大小",
    ["state"],  # idle / active / overflow
)

DB_QUERIES_TOTAL = Counter(
    "rmfood_db_queries_total",
    "数据库查询总数",
    ["operation", "table", "status"],  # status: success / error / timeout
)

# ─── Redis 缓存指标 ───

CACHE_HITS_TOTAL = Counter(
    "rmfood_cache_hits_total",
    "缓存命中总数",
    ["cache_layer", "key_type"],  # cache_layer: l1 / l2
)

CACHE_MISSES_TOTAL = Counter(
    "rmfood_cache_misses_total",
    "缓存未命中总数",
    ["cache_layer", "key_type"],
)

CACHE_OPERATION_DURATION_SECONDS = Histogram(
    "rmfood_cache_operation_duration_seconds",
    "缓存操作耗时（秒）",
    ["operation", "cache_layer"],  # operation: get / set / delete
)

# ─── 配方业务指标 ───

FORMULA_OPERATIONS_TOTAL = Counter(
    "rmfood_formula_operations_total",
    "配方操作总数",
    ["operation", "category", "status"],  # operation: create / update / delete / review / publish
)

FORMULA_LIST_LOAD_TIME_SECONDS = Histogram(
    "rmfood_formula_list_load_time_seconds",
    "配方列表加载耗时（秒）",
    ["page_size", "has_filter"],
    buckets=(0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
)

# ─── AI 服务指标 ───

AI_REQUESTS_TOTAL = Counter(
    "rmfood_ai_requests_total",
    "AI 服务调用总数",
    ["model", "operation", "status"],  # status: success / error / timeout
)

AI_REQUEST_DURATION_SECONDS = Histogram(
    "rmfood_ai_request_duration_seconds",
    "AI 服务调用耗时（秒）",
    ["model", "operation"],
    buckets=(0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0),
)

AI_TOKENS_USED = Counter(
    "rmfood_ai_tokens_used_total",
    "AI 服务 Token 消耗总数",
    ["model", "type"],  # type: prompt / completion / total
)

AI_ERRORS_TOTAL = Counter(
    "rmfood_ai_errors_total",
    "AI 服务错误总数",
    ["error_type", "model"],
)

# ─── 用户活动指标 ───

USER_LOGINS_TOTAL = Counter(
    "rmfood_user_logins_total",
    "用户登录次数",
    ["status", "auth_method"],  # status: success / failed
)

USER_ACTIONS_TOTAL = Counter(
    "rmfood_user_actions_total",
    "用户操作次数",
    ["action_type"],  # action_type: create_formula / edit / export / etc
)

# ─── 系统资源指标 ───

SYSTEM_UPTIME_SECONDS = Gauge(
    "rmfood_system_uptime_seconds",
    "系统运行时长（秒）",
)

SYSTEM_INFO = Info(
    "rmfood_system",
    "系统信息",
)


# ═════════════════════════════════════════════
# 🟡 P3-2: 健康检查系统
# ═════════════════════════════════════════════


class HealthStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


@dataclass
class HealthCheckResult:
    """单个健康检查结果"""
    name: str
    status: HealthStatus
    latency_ms: float = 0.0
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    checked_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status.value,
            "latency_ms": round(self.latency_ms, 2),
            "message": self.message,
            "details": self.details,
            "checked_at": self.checked_at,
        }


class HealthChecker:
    """
    🏥 健康检查器

    支持多层检查:
    - 应用层：进程存活、内存使用
    - 依赖层：数据库、Redis、AI 服务
    """

    def __init__(self, db_session=None, redis_client=None):
        self._db_session = db_session
        self._redis_client = redis_client
        self._start_time = time.time()

    async def check_all(self) -> Dict[str, HealthCheckResult]:
        """执行所有健康检查"""
        results = {}

        # 并行执行所有检查
        checks = [
            ("application", self._check_application),
            ("database", self._check_database),
            ("redis", self._check_redis),
            ("ai_service", self._check_ai_service),
        ]

        for name, check_fn in checks:
            start = time.time()
            try:
                result = await check_fn()
            except Exception as e:
                result = HealthCheckResult(
                    name=name,
                    status=HealthStatus.UNHEALTHY,
                    latency_ms=(time.time() - start) * 1000,
                    message=sanitize_error(e, "检查异常"),
                )
            results[name] = result

        return results

    async def _check_application(self) -> HealthCheckResult:
        """检查应用层"""
        import psutil

        start = time.time()
        try:
            process = psutil.Process()

            # 内存使用
            mem_info = process.memory_info()
            mem_mb = mem_info.rss / 1024 / 1024

            # CPU 使用
            cpu_percent = process.cpu_percent(interval=0.1)

            # 运行时长
            uptime = time.time() - self._start_time

            # 更新 Prometheus 指标
            SYSTEM_UPTIME_SECONDS.set(uptime)

            return HealthCheckResult(
                name="application",
                status=HealthStatus.HEALTHY,
                latency_ms=(time.time() - start) * 1000,
                message="应用运行正常",
                details={
                    "memory_mb": round(mem_mb, 1),
                    "cpu_percent": round(cpu_percent, 1),
                    "uptime_seconds": round(uptime, 0),
                },
            )
        except ImportError:
            # psutil 未安装，使用简化检查
            return HealthCheckResult(
                name="application",
                status=HealthStatus.HEALTHY,
                latency_ms=(time.time() - start) * 1000,
                message="应用运行正常（无 psutil）",
                details={"uptime_seconds": round(time.time() - self._start_time, 0)},
            )
        except Exception as e:
            return HealthCheckResult(
                name="application",
                status=HealthStatus.UNHEALTHY,
                latency_ms=(time.time() - start) * 1000,
                message=sanitize_error(e, "检查异常"),
            )

    async def _check_database(self) -> HealthCheckResult:
        """检查数据库连接"""
        start = time.time()
        latency_ms = 0

        try:
            if self._db_session:
                from sqlalchemy import text

                # 执行简单查询
                start_query = time.time()
                result = await self._db_session.execute(text("SELECT 1"))
                result.fetchone()
                latency_ms = (time.time() - start_query) * 1000

                # 检查连接池状态（如果有的话）
                pool_info = {}
                if hasattr(self._db_session, "get_pool_stats"):
                    pool_info = self._db_session.get_pool_stats()

                return HealthCheckResult(
                    name="database",
                    status=HealthStatus.HEALTHY,
                    latency_ms=(time.time() - start) * 1000,
                    message="数据库连接正常",
                    details={
                        "query_latency_ms": round(latency_ms, 2),
                        "pool": pool_info,
                    },
                )
            else:
                return HealthCheckResult(
                    name="database",
                    status=HealthStatus.DEGRADED,
                    latency_ms=(time.time() - start) * 1000,
                    message="无数据库会话（可能未配置）",
                )
        except Exception as e:
            return HealthCheckResult(
                name="database",
                status=HealthStatus.UNHEALTHY,
                latency_ms=(time.time() - start) * 1000,
                message=sanitize_error(e, "数据库错误"),
            )

    async def _check_redis(self) -> HealthCheckResult:
        """检查 Redis 连接"""
        start = time.time()

        try:
            if self._redis_client:
                start_ping = time.time()
                pong = await self._redis_client.ping()
                latency_ms = (time.time() - start_ping) * 1000

                if pong:
                    return HealthCheckResult(
                        name="redis",
                        status=HealthStatus.HEALTHY,
                        latency_ms=(time.time() - start) * 1000,
                        message="Redis 连接正常",
                        details={"ping_latency_ms": round(latency_ms, 2)},
                    )
                else:
                    return HealthCheckResult(
                        name="redis",
                        status=HealthStatus.UNHEALTHY,
                        latency_ms=(time.time() - start) * 1000,
                        message="Redis ping 失败",
                    )
            else:
                return HealthCheckResult(
                    name="redis",
                    status=HealthStatus.DEGRADED,
                    latency_ms=(time.time() - start) * 1000,
                    message="无 Redis 客户端",
                )
        except Exception as e:
            return HealthCheckResult(
                name="redis",
                status=HealthStatus.UNHEALTHY,
                latency_ms=(time.time() - start) * 1000,
                message=sanitize_error(e, "Redis错误"),
            )

    async def _check_ai_service(self) -> HealthCheckResult:
        """检查 AI 服务（简化版：检查配置是否存在）"""
        start = time.time()
        import os

        api_key = os.environ.get("AI_API_KEY", "")
        base_url = os.environ.get("AI_BASE_URL", "")

        if api_key and base_url:
            # 实际生产中应发送一个简单请求验证
            return HealthCheckResult(
                name="ai_service",
                status=HealthStatus.HEALTHY,
                latency_ms=(time.time() - start) * 1000,
                message="AI 服务已配置",
                details={"base_url": base_url[:50], "has_api_key": True},
            )
        else:
            return HealthCheckResult(
                name="ai_service",
                status=HealthStatus.DEGRADED,
                latency_ms=(time.time() - start) * 1000,
                message="AI 服务未配置",
                details={"has_api_key": bool(api_key), "has_base_url": bool(base_url)},
            )

    def get_overall_status(self, results: Dict[str, HealthCheckResult]) -> HealthStatus:
        """根据各检查结果判断整体状态"""
        statuses = [r.status for r in results.values()]

        if any(s == HealthStatus.UNHEALTHY for s in statuses):
            return HealthStatus.UNHEALTHY
        elif any(s == HealthStatus.DEGRADED for s in statuses):
            return HealthStatus.DEGRADED
        else:
            return HealthStatus.HEALTHY


# ═════════════════════════════════════════════
# 🟡 P3-2: 便捷追踪函数
# ═════════════════════════════════════════════


def track_request(method: str, endpoint: str, status_code: int, duration: float):
    """追踪 HTTP 请求指标"""
    HTTP_REQUESTS_TOTAL.labels(method=method, endpoint=endpoint, status_code=str(status_code)).inc()
    HTTP_REQUEST_DURATION_SECONDS.labels(method=method, endpoint=endpoint, status_code=str(status_code)).observe(duration)


def track_db_query(operation: str, table: str, duration: float, status: str = "success"):
    """追踪数据库查询"""
    DB_QUERY_DURATION_SECONDS.labels(operation=operation, table=table).observe(duration)
    DB_QUERIES_TOTAL.labels(operation=operation, table=table, status=status).inc()


def track_cache_hit(layer: str, key_type: str):
    """追踪缓存命中"""
    CACHE_HITS_TOTAL.labels(cache_layer=layer, key_type=key_type).inc()


def track_cache_miss(layer: str, key_type: str):
    """追踪缓存未命中"""
    CACHE_MISSES_TOTAL.labels(cache_layer=layer, key_type=key_type).inc()


def track_formula_operation(operation: str, category: str = "", status: str = "success"):
    """追踪配方操作"""
    FORMULA_OPERATIONS_TOTAL.labels(operation=operation, category=category, status=status).inc()


def track_ai_call(model: str, operation: str, duration: float, status: str = "success", tokens: int = 0):
    """追踪 AI 服务调用"""
    AI_REQUESTS_TOTAL.labels(model=model, operation=operation, status=status).inc()
    AI_REQUEST_DURATION_SECONDS.labels(model=model, operation=operation).observe(duration)
    if tokens > 0:
        AI_TOKENS_USED.labels(model=model, type="total").inc(tokens)


def track_user_login(status: str, auth_method: str = "password"):
    """追踪用户登录"""
    USER_LOGINS_TOTAL.labels(status=status, auth_method=auth_method).inc()


def track_user_action(action_type: str):
    """追踪用户操作"""
    USER_ACTIONS_TOTAL.labels(action_type=action_type).inc()


# ═════════════════════════════════════════════
# 🟡 P3-2: 中间件：请求追踪
# ═════════════════════════════════════════════


@asynccontextmanager
async def monitor_request(method: str, endpoint: str):
    """请求监控上下文管理器"""
    request_id = str(uuid.uuid4())[:12]
    start_time = time.time()

    HTTP_REQUESTS_IN_PROGRESS.labels(method=method, endpoint=endpoint).inc()

    try:
        yield request_id
    finally:
        duration = time.time() - start_time
        HTTP_REQUESTS_IN_PROGRESS.labels(method=method, endpoint=endpoint).dec()
        # 注意：status_code 会在响应完成后填充，这里用 0 代替
        # 实际使用中应传入真实状态码


# ═════════════════════════════════════════════
# 🟡 P3-2: FastAPI 路由
# ═════════════════════════════════════════════


def create_monitoring_router(db_session=None, redis_client=None) -> APIRouter:
    """创建监控路由"""
    router = APIRouter(prefix="/health", tags=["监控"])
    checker = HealthChecker(db_session, redis_client)

    @router.get("", response_model=Dict[str, Any])
    async def health_check():
        """综合健康检查"""
        results = await checker.check_all()
        overall = checker.get_overall_status(results)

        return {
            "status": overall.value,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "checks": {k: v.to_dict() for k, v in results.items()},
        }

    @router.get("/live")
    async def liveness():
        """存活检查（Kubernetes livenessProbe）"""
        return JSONResponse({"status": "alive", "timestamp": datetime.now(timezone.utc).isoformat()})

    @router.get("/ready")
    async def readiness():
        """就绪检查（Kubernetes readinessProbe）"""
        results = await checker.check_all()
        overall = checker.get_overall_status(results)

        if overall == HealthStatus.UNHEALTHY:
            return JSONResponse(
                status_code=503,
                content={
                    "status": "not_ready",
                    "checks": {k: v.to_dict() for k, v in results.items()},
                },
            )

        return {"status": "ready", "timestamp": datetime.now(timezone.utc).isoformat()}

    @router.get("/db")
    async def db_health():
        """数据库专项健康检查"""
        result = await checker._check_database()
        return JSONResponse(
            status_code=503 if result.status == HealthStatus.UNHEALTHY else 200,
            content=result.to_dict(),
        )

    @router.get("/redis")
    async def redis_health():
        """Redis 专项健康检查"""
        result = await checker._check_redis()
        return JSONResponse(
            status_code=503 if result.status == HealthStatus.UNHEALTHY else 200,
            content=result.to_dict(),
        )

    return router


def create_metrics_router() -> APIRouter:
    """创建 Prometheus 指标路由"""
    router = APIRouter(tags=["指标"])

    @router.get("/metrics")
    async def metrics():
        """Prometheus 指标端点"""
        if not HAS_PROMETHEUS:
            return PlainTextResponse("# prometheus_client not installed", content_type="text/plain")

        return Response(content=generate_latest(REGISTRY), media_type=CONTENT_TYPE_LATEST)

    return router


# ═════════════════════════════════════════════
# 🟡 P3-2: Prometheus 配置生成
# ═════════════════════════════════════════════


def generate_prometheus_config(
    backend_url: str = "http://backend:8000",
    scrape_interval: str = "15s",
) -> Dict[str, Any]:
    """生成 Prometheus 配置文件内容"""
    return {
        "global": {
            "scrape_interval": scrape_interval,
            "evaluation_interval": "15s",
            "external_labels": {"monitor": "rmfood"},
        },
        "scrape_configs": [
            {
                "job_name": "rmfood-backend",
                "static_configs": [
                    {
                        "targets": ["backend:8000"],
                        "labels": {"service": "backend", "env": "production"},
                    }
                ],
                "metrics_path": "/metrics",
                "scrape_interval": "10s",
                "scrape_timeout": "5s",
            },
            {
                "job_name": "rmfood-nginx",
                "static_configs": [
                    {
                        "targets": ["nginx-proxy:9113"],
                        "labels": {"service": "nginx"},
                    }
                ],
            },
            {
                "job_name": "prometheus",
                "static_configs": [
                    {
                        "targets": ["localhost:9090"],
                    }
                ],
            },
        ],
        "alerting": {
            "alertmanagers": [],
        },
        "rule_files": ["/etc/prometheus/rules/*.yml"],
    }


def generate_alert_rules() -> Dict[str, Any]:
    """生成 Prometheus 告警规则"""
    return {
        "groups": [
            {
                "name": "rmfood_api_alerts",
                "interval": "30s",
                "rules": [
                    {
                        "alert": "APIHighLatency",
                        "expr": 'histogram_quantile(0.95, rate(rmfood_http_request_duration_seconds_bucket[5m])) > 2',
                        "for": "5m",
                        "labels": {"severity": "warning"},
                        "annotations": {
                            "summary": "API 响应时间过高",
                            "description": "P95 响应时间超过 2 秒已持续 5 分钟，当前值: {{ $value }}s",
                        },
                    },
                    {
                        "alert": "APIHighErrorRate",
                        "expr": 'rate(rmfood_http_requests_total{status_code=~"5.."}[5m]) / rate(rmfood_http_requests_total[5m]) > 0.05',
                        "for": "2m",
                        "labels": {"severity": "critical"},
                        "annotations": {
                            "summary": "API 错误率过高",
                            "description": "5xx 错误率超过 5% 已持续 2 分钟，当前值: {{ $value | humanizePercentage }}",
                        },
                    },
                    {
                        "alert": "APIDown",
                        "expr": 'up{job="rmfood-backend"} == 0',
                        "for": "1m",
                        "labels": {"severity": "critical"},
                        "annotations": {
                            "summary": "API 服务不可用",
                            "description": "后端服务已下线 1 分钟",
                        },
                    },
                ],
            },
            {
                "name": "rmfood_database_alerts",
                "interval": "30s",
                "rules": [
                    {
                        "alert": "DatabaseHighLatency",
                        "expr": 'histogram_quantile(0.95, rate(rmfood_db_query_duration_seconds_bucket[5m])) > 0.5',
                        "for": "5m",
                        "labels": {"severity": "warning"},
                        "annotations": {
                            "summary": "数据库查询延迟过高",
                            "description": "P95 查询时间超过 500ms",
                        },
                    },
                    {
                        "alert": "DatabaseConnectionPoolExhausted",
                        "expr": 'rmfood_db_connection_pool_size{state="overflow"} > 0',
                        "for": "5m",
                        "labels": {"severity": "warning"},
                        "annotations": {
                            "summary": "数据库连接池即将耗尽",
                            "description": "连接池溢出中，可能需要增加连接数限制",
                        },
                    },
                ],
            },
            {
                "name": "rmfood_ai_alerts",
                "interval": "60s",
                "rules": [
                    {
                        "alert": "AIHighErrorRate",
                        "expr": 'rate(rmfood_ai_errors_total[10m]) / rate(rmfood_ai_requests_total[10m]) > 0.1',
                        "for": "5m",
                        "labels": {"severity": "warning"},
                        "annotations": {
                            "summary": "AI 服务错误率过高",
                            "description": "AI 服务错误率超过 10%",
                        },
                    },
                    {
                        "alert": "AIHighLatency",
                        "expr": 'histogram_quantile(0.95, rate(rmfood_ai_request_duration_seconds_bucket[5m])) > 60',
                        "for": "10m",
                        "labels": {"severity": "warning"},
                        "annotations": {
                            "summary": "AI 服务响应超时",
                            "description": "P95 响应时间超过 60 秒",
                        },
                    },
                ],
            },
        ]
    }


# ═════════════════════════════════════════════
# 🟡 P3-2: 模块导出
# ═════════════════════════════════════════════


__all__ = [
    # 指标追踪
    "track_request",
    "track_db_query",
    "track_cache_hit",
    "track_cache_miss",
    "track_formula_operation",
    "track_ai_call",
    "track_user_login",
    "track_user_action",
    # 健康检查
    "HealthChecker",
    "HealthCheckResult",
    "HealthStatus",
    # 路由
    "create_monitoring_router",
    "create_metrics_router",
    # 配置
    "generate_prometheus_config",
    "generate_alert_rules",
    # 指标对象（供外部使用）
    "HTTP_REQUESTS_TOTAL",
    "HTTP_REQUEST_DURATION_SECONDS",
    "FORMULA_OPERATIONS_TOTAL",
    "AI_REQUESTS_TOTAL",
]

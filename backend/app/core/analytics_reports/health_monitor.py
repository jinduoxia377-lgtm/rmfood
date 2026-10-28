"""
System Health Monitor — 真实系统健康指标采集

替代 analytics_engine.py 中的硬编码占位值，
通过 psutil + SQL 查询获取实时 CPU / 内存 / 磁盘 / 数据库连接状态。

用法:
    from app.core.analytics_reports.health_monitor import SystemHealthMonitor

    monitor = SystemHealthMonitor()
    health = await monitor.get_health(db)
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict

logger = logging.getLogger(__name__)


@dataclass
class SystemHealth:
    database_status: str = "unknown"
    avg_response_time_ms: float = 0.0
    active_connections: int = 0
    error_rate_percent: float = 0.0
    cpu_usage_percent: float = 0.0
    memory_usage_percent: float = 0.0
    disk_usage_percent: float = 0.0
    cache_hit_rate_percent: float = 0.0
    uptime_seconds: float = 0.0
    last_check: str = ""


class SystemHealthMonitor:
    """实时系统健康监控，所有指标均来源于操作系统或数据库查询。"""

    def __init__(self):
        self._start_time = time.time()
        self._response_times: list[float] = []
        self._error_count = 0
        self._total_requests = 0

    # ── 公共接口 ──────────────────────────────────────────────

    async def get_health(self, db) -> Dict[str, Any]:
        """返回完整的健康状态字典，格式与前端 SystemHealth 接口兼容。"""
        result = SystemHealth(last_check=datetime.now(timezone.utc).isoformat())

        # 操作系统级指标
        try:
            import psutil  # type: ignore
            result.cpu_usage_percent = round(psutil.cpu_percent(interval=0.5), 1)
            mem = psutil.virtual_memory()
            result.memory_usage_percent = round(mem.percent, 1)
            # 跨平台兼容：Windows 用 C:\，Unix 用 /
            import os  # noqa: PLC0415
            disk_root = "C:\\" if os.name == "nt" else "/"
            disk = psutil.disk_usage(disk_root)
            result.disk_usage_percent = round(disk.percent, 1)
            result.uptime_seconds = round(time.time() - self._start_time, 0)
        except ImportError:
            logger.debug("psutil 未安装，OS 指标使用默认值")
        except Exception as e:
            logger.warning("读取系统指标失败: %s", e)

        # 数据库连接健康
        try:
            from sqlalchemy import text
            await db.execute(text("SELECT 1"))
            result.database_status = "healthy"
        except Exception as e:
            logger.warning("数据库健康检查失败: %s", e)
            result.database_status = "unhealthy"

        # 活跃连接数（PostgreSQL）
        try:
            from sqlalchemy import text
            r = await db.execute(
                text("SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active'")
            )
            result.active_connections = int(r.scalar() or 0)
        except Exception:
            pass

        # 缓存命中率（Redis，可选）
        try:
            # 优先从环境变量读取 Redis URL，避免硬编码
            import os as _os  # noqa: PLC0415

            import redis  # type: ignore
            redis_url = _os.environ.get(
                "REDIS_URL",
                "redis://localhost:6379/0",
            )
            client = redis.Redis.from_url(redis_url, decode_responses=True)
            stats = client.info("stats")
            hits = int(stats.get("keyspace_hits") or 0)
            misses = int(stats.get("keyspace_misses") or 0)
            total = hits + misses
            result.cache_hit_rate_percent = round(hits / total * 100, 1) if total else 0.0
        except ImportError:
            pass
        except Exception:
            pass

        # 错误率（从请求日志估算）
        if self._total_requests > 0:
            result.error_rate_percent = round(
                self._error_count / self._total_requests * 100, 2
            )
        else:
            result.error_rate_percent = 0.0

        # 平均响应时间
        if self._response_times:
            window = self._response_times[-100:]
            result.avg_response_time_ms = round(sum(window) / len(window), 1)

        return {
            "database_status": result.database_status,
            "avg_response_time_ms": result.avg_response_time_ms,
            "active_connections": result.active_connections,
            "error_rate_percent": result.error_rate_percent,
            "cpu_usage_percent": result.cpu_usage_percent,
            "memory_usage_percent": result.memory_usage_percent,
            "disk_usage_percent": result.disk_usage_percent,
            "cache_hit_rate_percent": result.cache_hit_rate_percent,
            "uptime_seconds": result.uptime_seconds,
            "last_check": result.last_check,
        }

    def record_request(self, duration_ms: float, success: bool = True):
        """中间件回调：记录每次请求的耗时和成功状态。"""
        self._response_times.append(duration_ms)
        if len(self._response_times) > 500:
            self._response_times = self._response_times[-500:]
        self._total_requests += 1
        if not success:
            self._error_count += 1

    def reset_counters(self):
        """重置统计计数器（用于测试）。"""
        self._response_times.clear()
        self._error_count = 0
        self._total_requests = 0


# 模块级单例
_monitor = SystemHealthMonitor()


def get_health_monitor() -> SystemHealthMonitor:
    return _monitor

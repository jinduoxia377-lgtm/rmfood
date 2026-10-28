"""
🔒 P3-2: 健康检查与就绪探测器
提供应用级健康检查功能:

1. **存活检查（Liveness）** — `/health` — 检测服务是否运行
2. **就绪检查（Readiness）** — `/ready` — 检测所有依赖是否可用
3. **依赖检查（Dependency）** — `/health/detailed` — 详细依赖健康报告
4. **深度健康（Deep Health）** — `/health/metrics` — 系统资源指标

健康检查策略:
- 数据库连接池（SQLAlchemy）
- Redis 连接（缓存/会话）
- 外部服务（AI 推理 API、文档服务）
- 磁盘空间 / 内存使用 / CPU 负载
- 队列深度 / 任务数

使用方式:
- Kubernetes livenessProbe: HTTP GET /health
- Kubernetes readinessProbe: HTTP GET /ready
- 健康面板: /health/detailed
"""
import logging
import platform
import sys
import time
from datetime import datetime, timezone
from typing import Annotated, Any, Dict, List

import psutil
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import User, get_current_active_user
from app.services.ai.shared.inference_queue import inference_queue
from app.utils.error_sanitize import sanitize_error

from ..config import settings
from ..database.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["系统健康检查"])

# 健康状态枚举
STATUS_HEALTHY = "healthy"
STATUS_DEGRADED = "degraded"
STATUS_UNHEALTHY = "unhealthy"
STATUS_UNKNOWN = "unknown"


# ─────────────────────────────────────────────
# 依赖检查函数
# ─────────────────────────────────────────────

async def check_database(db: AsyncSession) -> Dict[str, Any]:
    """
    检查数据库连接状态（通过简单 SQL 查询）
    """
    try:
        start_time = time.time()
        await db.execute(text("SELECT 1"))
        await db.commit()
        response_time = (time.time() - start_time) * 1000

        # 检查连接池状态
        pool = db.bind.pool if hasattr(db.bind, 'pool') else None
        pool_info = {}
        if pool is not None:
            try:
                pool_info = {
                    "checked_out": getattr(pool, 'checkedout', 0),
                    "checked_in": getattr(pool, 'checkedin', 0),
                    "pool_size": getattr(pool, 'size', 'unknown'),
                    "max_overflow": getattr(pool, 'max_overflow', 'unknown'),
                }
            except Exception as e:
                logger.debug("数据库连接池信息获取失败: %s", e)
                pool_info = {"status": "not_available"}

        return {
            "status": STATUS_HEALTHY,
            "component": "database",
            "response_time_ms": round(response_time, 2),
            "pool": pool_info,
            "database_type": settings.database.url.split(':')[0].split('+')[0],
        }
    except SQLAlchemyError as e:
        logger.error("[Health] 数据库检查失败", exc_info=True)
        return {
            "status": STATUS_UNHEALTHY,
            "component": "database",
            "error": sanitize_error(e, "数据库连接异常"),
            "response_time_ms": 0,
        }
    except Exception as e:
        logger.error("[Health] 数据库检查异常", exc_info=True)
        return {
            "status": STATUS_UNHEALTHY,
            "component": "database",
            "error": sanitize_error(e, "数据库检查异常"),
            "response_time_ms": 0,
        }


async def check_redis() -> Dict[str, Any]:
    """
    检查 Redis 连接状态
    """
    if not settings.redis_url:
        return {
            "status": STATUS_UNKNOWN,
            "component": "redis",
            "note": "未配置 Redis（使用内存模式）",
        }

    try:
        import redis.asyncio as redis_asyncio
        start_time = time.time()

        async with redis_asyncio.from_url(settings.redis_url, socket_timeout=2.0) as client:
            await client.ping()
            info = await client.info()

            response_time = (time.time() - start_time) * 1000

            return {
                "status": STATUS_HEALTHY,
                "component": "redis",
                "response_time_ms": round(response_time, 2),
                "version": info.get("redis_version", "unknown"),
                "connected_clients": info.get("connected_clients", 0),
                "used_memory_mb": round(
                    float(info.get("used_memory", 0)) / (1024 * 1024), 2
                ),
                "uptime_seconds": info.get("uptime_in_seconds", 0),
            }
    except Exception as e:
        logger.error("[Health] Redis 检查失败", exc_info=True)
        return {
            "status": STATUS_UNHEALTHY,
            "component": "redis",
            "error": sanitize_error(e, "Redis 连接异常"),
            "response_time_ms": 0,
        }


async def check_ai_service() -> Dict[str, Any]:
    """
    检查 AI 推理服务可用性
    """
    try:
        import httpx

        if not settings.ai_inference_api_url:
            return {
                "status": STATUS_UNKNOWN,
                "component": "ai_service",
                "note": "未配置 AI 推理服务（使用内置推理）",
            }

        start_time = time.time()

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.ai_inference_api_url}/health",
                headers={"Authorization": f"Bearer {settings.ai_api_key or ''}"},
            )

            response_time = (time.time() - start_time) * 1000

            if response.status_code == 200:
                return {
                    "status": STATUS_HEALTHY,
                    "component": "ai_service",
                    "response_time_ms": round(response_time, 2),
                    "endpoint": settings.ai_inference_api_url,
                }
            else:
                return {
                    "status": STATUS_DEGRADED,
                    "component": "ai_service",
                    "response_time_ms": round(response_time, 2),
                    "error": f"HTTP {response.status_code}",
                }

    except Exception as e:
        logger.error(f"[Health] AI 服务检查失败: {e}")
        return {
            "status": STATUS_UNHEALTHY,
            "component": "ai_service",
            "error": sanitize_error(e, "服务异常"),
            "response_time_ms": 0,
        }


def check_system_resources() -> Dict[str, Any]:
    """
    检查系统资源状态（CPU/内存/磁盘）
    """
    try:
        # CPU 使用率
        cpu_percent = psutil.cpu_percent(interval=0.5)
        cpu_cores = psutil.cpu_count(logical=True)

        # 内存使用率
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        memory_total_gb = round(memory.total / (1024 * 1024 * 1024), 2)
        memory_used_gb = round(memory.used / (1024 * 1024 * 1024), 2)
        memory_available_gb = round(memory.available / (1024 * 1024 * 1024), 2)

        # 磁盘使用率
        disks = []
        for partition in psutil.disk_partitions():
            try:
                usage = psutil.disk_usage(partition.mountpoint)
                disks.append({
                    "device": partition.device,
                    "mount_point": partition.mountpoint,
                    "filesystem": partition.fstype,
                    "total_gb": round(usage.total / (1024 * 1024 * 1024), 2),
                    "used_gb": round(usage.used / (1024 * 1024 * 1024), 2),
                    "free_gb": round(usage.free / (1024 * 1024 * 1024), 2),
                    "percent": round(usage.percent, 1),
                })
            except PermissionError:
                continue

        # 🔒 P3-2: 判断是否降级
        is_degraded = (
            cpu_percent > 90 or
            memory_percent > 90 or
            any(d["percent"] > 90 for d in disks)
        )
        is_unhealthy = (
            cpu_percent > 95 or
            memory_percent > 95 or
            any(d["percent"] > 95 for d in disks)
        )

        if is_unhealthy:
            overall_status = STATUS_UNHEALTHY
        elif is_degraded:
            overall_status = STATUS_DEGRADED
        else:
            overall_status = STATUS_HEALTHY

        return {
            "status": overall_status,
            "component": "system",
            "cpu": {
                "usage_percent": cpu_percent,
                "cores": cpu_cores,
                "load_average": list(psutil.getloadavg()) if hasattr(psutil, 'getloadavg') else [],
            },
            "memory": {
                "usage_percent": memory_percent,
                "total_gb": memory_total_gb,
                "used_gb": memory_used_gb,
                "available_gb": memory_available_gb,
            },
            "disks": disks,
            "os": platform.platform(),
            "python_version": sys.version,
        }
    except Exception as e:
        logger.error(f"[Health] 系统资源检查失败: {e}")
        return {
            "status": STATUS_UNKNOWN,
            "component": "system",
            "error": sanitize_error(e, "服务异常"),
        }


async def check_inference_queue() -> Dict[str, Any]:
    """
    检查推理队列状态（任务数 / 活跃 worker / 队列深度）
    """
    try:
        queue_info = await inference_queue.get_stats()

        if not queue_info or queue_info.get("max_workers", 0) == 0:
            status_val = STATUS_UNHEALTHY
        elif queue_info.get("queue_size", 0) > queue_info.get("queue_limit", 100) * 0.5:
            status_val = STATUS_DEGRADED
        else:
            status_val = STATUS_HEALTHY

        return {
            "status": status_val,
            "component": "inference_queue",
            **queue_info,
        }
    except Exception as e:
        logger.error(f"[Health] 推理队列检查失败: {e}")
        return {
            "status": STATUS_UNKNOWN,
            "component": "inference_queue",
            "error": sanitize_error(e, "服务异常"),
        }


async def check_external_dependencies() -> List[Dict[str, Any]]:
    """
    检查外部依赖（邮件、文档生成服务等）
    """
    results = []

    # SMTP 服务检查
    if settings.smtp_host:
        try:
            import smtplib
            start_time = time.time()
            with smtplib.SMTP(
                settings.smtp_host,
                settings.smtp_port or 587,
                timeout=5.0,
            ) as server:
                try:
                    server.starttls()
                    server.quit()
                except Exception as e:
                    logger.debug("SMTP 健康检查失败: %s", e)

            response_time = (time.time() - start_time) * 1000
            results.append({
                "status": STATUS_HEALTHY,
                "component": "smtp",
                "host": settings.smtp_host,
                "port": settings.smtp_port,
                "response_time_ms": round(response_time, 2),
            })
        except Exception as e:
            logger.error("[Health] SMTP 检查失败", exc_info=True)
            results.append({
                "status": STATUS_DEGRADED,
                "component": "smtp",
                "host": settings.smtp_host,
                "error": sanitize_error(e, "SMTP 连接异常"),
                "note": "邮件服务可能不可用，但不影响核心功能",
            })

    return results


# ─────────────────────────────────────────────
# 健康检查路由
# ─────────────────────────────────────────────

@router.get("/health", summary="存活检查（Liveness Probe）")
async def health_check(request: Request):
    """
    🔒 P3-2: 基础健康检查 - 用于 Kubernetes livenessProbe

    仅检查:
    - 服务是否运行（FastAPI 可以响应请求）
    - 不做任何外部依赖检查（避免级联故障）

    返回: HTTP 200 表示健康
    """
    return {
        "status": STATUS_HEALTHY,
        "service": settings.app_name,
        "version": settings.app_version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/ready", summary="就绪检查（需要认证）")
async def readiness_check(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    🔒 P3-2: 就绪检查 - 用于 Kubernetes readinessProbe

    检查:
    - 数据库连接是否可用
    - 系统资源是否充足

    返回:
    - HTTP 200: 就绪，可以接收流量
    - HTTP 503: 未就绪，不应接收流量
    """
    checks = [
        await check_database(db),
        check_system_resources(),
    ]

    # 判断是否 ready
    all_healthy = all(c.get("status") == STATUS_HEALTHY for c in checks)
    overall_status = STATUS_HEALTHY if all_healthy else STATUS_UNHEALTHY

    response = {
        "status": overall_status,
        "service": settings.app_name,
        "version": settings.app_version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
    }

    if overall_status != STATUS_HEALTHY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=response,
        )

    return response


@router.get("/health/detailed", summary="详细健康报告（需要认证）")
async def detailed_health_check(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    🔒 P3-2: 详细健康检查报告 - 包含所有依赖

    包含以下检查:
    1. 数据库连接状态
    2. Redis 缓存状态
    3. AI 推理服务状态
    4. 推理队列状态
    5. 系统资源状态
    6. 外部依赖状态

    返回: 完整的健康状态报告（用于运维面板）
    """
    # 并行执行多个检查
    import asyncio

    tasks = [
        check_database(db),
        check_redis(),
        check_ai_service(),
        check_inference_queue(),
    ]

    # 系统资源检查是同步的，直接运行
    system_check = check_system_resources()

    # 并发执行异步检查
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # 处理结果
    checks = []
    for result in results:
        if isinstance(result, Exception):
            checks.append({
                "status": STATUS_UNHEALTHY,
                "component": "unknown",
                "error": str(result),
            })
        else:
            checks.append(result)
    checks.append(system_check)

    # 添加外部依赖
    external_results = await check_external_dependencies()
    checks.extend(external_results)

    # 计算整体状态
    statuses = [c.get("status") for c in checks]
    if STATUS_UNHEALTHY in statuses:
        overall_status = STATUS_UNHEALTHY
    elif STATUS_DEGRADED in statuses:
        overall_status = STATUS_DEGRADED
    else:
        overall_status = STATUS_HEALTHY

    return {
        "status": overall_status,
        "service": settings.app_name,
        "version": settings.app_version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
        "check_count": len(checks),
        "healthy_count": sum(1 for s in statuses if s == STATUS_HEALTHY),
        "degraded_count": sum(1 for s in statuses if s == STATUS_DEGRADED),
        "unhealthy_count": sum(1 for s in statuses if s == STATUS_UNHEALTHY),
        "unknown_count": sum(1 for s in statuses if s == STATUS_UNKNOWN),
    }


@router.get("/health/metrics", summary="系统资源指标（需要认证）")
async def health_metrics(
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    🔒 P3-2: 系统资源指标

    返回:
    - CPU / 内存 / 磁盘使用率
    - 进程数 / 线程数
    - 活跃连接数
    - 用于 Grafana/Prometheus 采集或自定义监控
    """
    try:
        memory = psutil.virtual_memory()
        disks = []
        for partition in psutil.disk_partitions():
            try:
                usage = psutil.disk_usage(partition.mountpoint)
                disks.append({
                    "mount_point": partition.mountpoint,
                    "usage_percent": round(usage.percent, 1),
                    "total_gb": round(usage.total / (1024**3), 2),
                    "free_gb": round(usage.free / (1024**3), 2),
                })
            except PermissionError:
                continue

        network = psutil.net_io_counters()

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": settings.app_name,
            "version": settings.app_version,
            "cpu": {
                "usage_percent": psutil.cpu_percent(interval=0.1),
                "cores": psutil.cpu_count(logical=True),
                "physical_cores": psutil.cpu_count(logical=False),
            },
            "memory": {
                "total_mb": round(memory.total / (1024 * 1024), 2),
                "available_mb": round(memory.available / (1024 * 1024), 2),
                "used_mb": round(memory.used / (1024 * 1024), 2),
                "free_mb": round(memory.free / (1024 * 1024), 2),
                "percent": memory.percent,
            },
            "disks": disks,
            "network": {
                "bytes_sent_mb": round(network.bytes_sent / (1024 * 1024), 2) if network else 0,
                "bytes_received_mb": round(network.bytes_recv / (1024 * 1024), 2) if network else 0,
                "packets_sent": network.packets_sent if network else 0,
                "packets_received": network.packets_recv if network else 0,
            },
            "process": {
                "pid": psutil.Process().pid,
                "memory_mb": round(psutil.Process().memory_info().rss / (1024 * 1024), 2),
                "cpu_percent": psutil.Process().cpu_percent(),
                "threads": psutil.Process().num_threads(),
            },
            "system": {
                "platform": platform.platform(),
                "architecture": platform.machine(),
                "uptime_seconds": int(time.time() - psutil.boot_time()),
            },
        }
    except Exception as e:
        logger.error("[Health] 指标采集失败: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="系统指标采集失败",
        )


# ─────────────────────────────────────────────
# 路由注册
# ─────────────────────────────────────────────

def register_health_routes(app):
    """
    🔒 P3-2: 注册健康检查路由到 FastAPI 应用
    """
    # 将路由挂载到根路径（便于 Kubernetes 探针访问）
    app.include_router(router, prefix="")
    logger.info("[Health] 健康检查路由已注册: /health, /ready, /health/detailed, /health/metrics")

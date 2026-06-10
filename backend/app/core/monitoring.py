"""
RMFOOD 监控系统
包含健康检查、错误监控和性能监控功能
"""
import time
from datetime import datetime
from typing import Dict, List, Optional, Any

from fastapi import Request, Depends
from fastapi.responses import JSONResponse

from .config import settings
from .logging_config import logger


class HealthMonitor:
    """健康监控类"""
    
    def __init__(self):
        self.start_time = datetime.now()
        self.request_count = 0
        self.error_count = 0
        self.total_response_time = 0
        self.max_response_time = 0
        self.system_metrics = {}
    
    def record_request(self, response_time: float):
        """记录请求信息"""
        self.request_count += 1
        self.total_response_time += response_time
        if response_time > self.max_response_time:
            self.max_response_time = response_time
    
    def record_error(self):
        """记录错误"""
        self.error_count += 1
    
    def get_health_status(self) -> Dict[str, Any]:
        """获取健康状态"""
        uptime = (datetime.now() - self.start_time).total_seconds()
        avg_response_time = self.total_response_time / self.request_count if self.request_count > 0 else 0
        
        return {
            "status": "healthy" if self.error_count < 10 else "degraded",
            "uptime_seconds": uptime,
            "request_count": self.request_count,
            "error_count": self.error_count,
            "avg_response_time_ms": avg_response_time * 1000,
            "max_response_time_ms": self.max_response_time * 1000,
            "timestamp": datetime.now().isoformat(),
            "app_version": settings.app_version,
            "debug": settings.debug
        }
    
    def get_system_metrics(self) -> Dict[str, Any]:
        """获取系统指标"""
        try:
            # 尝试导入 psutil，如果不可用则返回基本信息
            import psutil
            
            cpu_percent = psutil.cpu_percent(interval=0.1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            self.system_metrics = {
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "memory_used_mb": memory.used / (1024 * 1024),
                "memory_total_mb": memory.total / (1024 * 1024),
                "disk_percent": disk.percent,
                "disk_used_gb": disk.used / (1024 * 1024 * 1024),
                "disk_total_gb": disk.total / (1024 * 1024 * 1024),
                "process_count": len(psutil.pids())
            }
        except ImportError:
            # psutil 不可用时返回基本信息
            self.system_metrics = {
                "status": "psutil not available",
                "message": "系统指标需要安装 psutil 包"
            }
        except Exception as e:
            logger.error(f"获取系统指标失败: {e}")
            self.system_metrics = {
                "status": "error",
                "message": str(e)
            }
        
        return self.system_metrics


# 创建监控实例
health_monitor = HealthMonitor()


async def request_middleware(request: Request, call_next):
    """请求中间件，用于监控请求性能"""
    start_time = time.time()
    
    try:
        response = await call_next(request)
    except Exception as e:
        health_monitor.record_error()
        logger.error(f"请求处理失败: {e}")
        raise
    
    response_time = time.time() - start_time
    health_monitor.record_request(response_time)
    
    # 添加响应时间头
    response.headers["X-Response-Time"] = str(response_time)
    
    return response


async def health_check(request: Request):
    """增强的健康检查端点（含连接池、缓存、数据源状态）"""
    health_status = health_monitor.get_health_status()
    system_metrics = health_monitor.get_system_metrics()

    # 获取连接池状态
    pool_status = {}
    try:
        from .session import get_pool_status
        pool_status = await get_pool_status()
    except Exception:
        pool_status = {"error": "unavailable"}

    # 获取缓存状态
    cache_status = {}
    try:
        from .cache_system import get_cache
        cache = get_cache()
        cache_status = cache.get_stats()
    except Exception:
        cache_status = {"error": "unavailable"}

    # 获取 CDC 状态
    cdc_status = {}
    try:
        from .cdc_listener import cdc_listener
        cdc_status = {
            "enabled": cdc_listener._enabled,
            "pending_events": len(cdc_listener._pending_events),
        }
    except Exception:
        cdc_status = {"error": "unavailable"}

        # 获取 AI 服务实际运行时状态
        _ai_available = False
        try:
            from .logging_config import logger as _mon_logger
            from app.services.llm_service import llm_service
            _ai_available = llm_service.is_available
        except Exception:
            _ai_available = getattr(settings, 'ai_available', False)

        return JSONResponse({
            **health_status,
            "system": system_metrics,
            "database_pool": pool_status,
            "cache": cache_status,
            "cdc": cdc_status,
            "services": {
                "database": "available",
                "redis": "available" if settings.redis_available else "unavailable",
                "ai": "available" if _ai_available else "unavailable",
                "elasticsearch": "available" if settings.elasticsearch_available else "unavailable",
                "neo4j": "available" if settings.neo4j_available else "unavailable"
            }
        })


async def metrics_endpoint(request: Request):
    """指标端点，用于监控系统状态"""
    return JSONResponse({
        "health": health_monitor.get_health_status(),
        "system": health_monitor.get_system_metrics()
    })


def setup_monitoring(app):
    """设置监控系统"""
    # 添加中间件
    app.middleware("http")(request_middleware)
    
    # 添加监控端点
    app.get("/health", tags=["监控"])(health_check)
    app.get("/metrics", tags=["监控"])(metrics_endpoint)
    
    logger.info("监控系统已初始化")
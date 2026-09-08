"""
AnalyticsResponseTimeMiddleware — 分析接口响应时间记录中间件

将 analytics 相关请求的耗时和成功/失败状态记录到 SystemHealthMonitor，
供 /analytics/system-health 端点实时展示。

使用方式（在 main.py 中添加）：
    from app.core.analytics_reports.health_monitor import get_health_monitor
    from .core.middleware.analytics_response_time import AnalyticsResponseTimeMiddleware
    app.add_middleware(AnalyticsResponseTimeMiddleware)
"""

from __future__ import annotations

import logging
import time
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)


PATH_PREFIXES = ("/analytics", "/api/v1/analytics")


class AnalyticsResponseTimeMiddleware(BaseHTTPMiddleware):
    """记录 analytics 接口响应时间，供健康监控使用。"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not any(request.url.path.startswith(prefix) for prefix in PATH_PREFIXES):
            return await call_next(request)

        start = time.monotonic()
        success = True
        try:
            response = await call_next(request)
            return response
        except Exception:
            success = False
            raise
        finally:
            duration_ms = (time.monotonic() - start) * 1000
            try:
                from app.core.analytics_reports.health_monitor import get_health_monitor
                get_health_monitor().record_request(duration_ms, success)
            except Exception as e:
                logger.debug("记录响应时间失败（非致命）: %s", e)


__all__ = ["AnalyticsResponseTimeMiddleware"]

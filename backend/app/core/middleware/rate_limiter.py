"""
公开搜索端点的 Rate Limiting 中间件

使用 app.core.security.security_middleware.SlidingWindowRateLimiter
为公共搜索接口添加请求频率限制，防止滥用。
"""
import time

from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    轻量级限流中间件。

    仅对匹配的端点生效，未匹配的端点直接放行。
    所有限流信息通过 X-RateLimit-* 响应头返回。
    """

    # 端点 -> 限流规则 (requests_per_minute)
    RULES = {
        "/databases/suggestions": {"rpm": 100, "label": "search_suggestions"},
        "/databases/suggest": {"rpm": 100, "label": "suggest"},
        "/knowledge-graph/search": {"rpm": 50, "label": "kg_search"},
        "/cross-search": {"rpm": 30, "label": "cross_search"},
        "/openfoodfacts/search": {"rpm": 60, "label": "off_search"},
        "/unified-search": {"rpm": 30, "label": "unified_search"},
    }

    def __init__(self, app, *args, **kwargs):
        super().__init__(app, *args, **kwargs)
        # Simple in-memory sliding window per endpoint+IP
        self._windows: dict = {}  # key="endpoint:ip" -> list[float]
        self._cleanup_age = 60  # seconds before cleanup

    def _get_key(self, path: str, client_ip: str) -> str:
        return f"{path}:{client_ip}"

    def _check(self, key: str, rpm: int) -> tuple[bool, int, int]:
        """Returns (allowed, remaining, reset_seconds)"""
        now = time.time()
        window_start = now - 60

        if key not in self._windows:
            self._windows[key] = []

        timestamps = [t for t in self._windows[key] if t > window_start]
        current_count = len(timestamps)

        if current_count >= rpm:
            return False, 0, int(60 - (now - timestamps[0]))

        timestamps.append(now)
        self._windows[key] = timestamps
        remaining = rpm - current_count - 1

        # Cleanup old entries periodically
        if now % self._cleanup_age < 1:
            for k in list(self._windows.keys()):
                ts_list = [t for t in self._windows[k] if t > window_start]
                if ts_list:
                    self._windows[k] = ts_list
                else:
                    del self._windows[k]

        return True, remaining, 60

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        rule = None
        for pattern, limits in self.RULES.items():
            if path.startswith(pattern):
                rule = limits
                break

        if not rule:
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        key = self._get_key(path, client_ip)

        allowed, remaining, reset_sec = self._check(key, rule["rpm"])

        if not allowed:
            response = Response(
                content='{"detail":"请求过于频繁，请稍后重试"}',
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                media_type="application/json",
            )
            response.headers["X-RateLimit-Limit"] = str(rule["rpm"])
            response.headers["X-RateLimit-Remaining"] = "0"
            response.headers["X-RateLimit-Reset"] = str(reset_sec)
            response.headers["Retry-After"] = str(reset_sec)
            return response

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(rule["rpm"])
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_sec)
        return response

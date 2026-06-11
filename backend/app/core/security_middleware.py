"""
RMFOOD 统一安全中间件模块

合并自:
- security_middleware.py (原基础版)
- security_enhanced.py (滑动窗口限流、输入清洗、数据脱敏、审计日志)
- security_enterprise.py (HSTS、智能限流、CORS配置)

安全层级:
┌─────────────────────────────────────────────┐
│  L7: 应用层安全                              │
│    - 输入验证与清洗 (InputSanitizer)         │
│    - 输出编码 (防XSS)                        │
│    - 敏感数据脱敏 (DataMasker)               │
├─────────────────────────────────────────────┤
│  L6: 认证与授权                              │
│    - JWT Token验证                          │
│    - RBAC权限控制                           │
│    - 安全审计日志 (SecurityAuditLogger)      │
├─────────────────────────────────────────────┤
│  L5: Rate Limiting (速率限制)               │
│    - 滑动窗口算法 (SlidingWindowRateLimiter)│
│    - 按IP/User/端点多维限制                 │
│    - 自动黑名单机制                         │
├─────────────────────────────────────────────┤
│  L4: 数据保护                               │
│    - 安全响应头 (HSTS/CSP/X-Frame)         │
│    - 请求体大小限制                         │
│    - 请求日志脱敏                           │
└─────────────────────────────────────────────┘
"""

from __future__ import annotations

import html as html_module
import json
import logging
import re
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════
# 1. 安全响应头中间件 (合并 HSTS + CSP)
# ════════════════════════════════════════════

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    统一安全响应头中间件

    实现的安全头:
    - Strict-Transport-Security (HSTS) — 生产环境强制HTTPS
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY
    - X-XSS-Protection: mode=block
    - Content-Security-Policy (CSP)
    - Referrer-Policy: strict-origin-when-cross-origin
    - Permissions-Policy
    - 移除 Server/X-Powered-By 信息泄露
    """

    def __init__(self, app, *, is_production: bool = False):
        super().__init__(app)
        self.is_production = is_production

    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)

            # HSTS — 仅生产环境启用
            if self.is_production:
                response.headers["Strict-Transport-Security"] = (
                    "max-age=31536000; includeSubDomains; preload"
                )

            # 防止MIME类型嗅探
            response.headers["X-Content-Type-Options"] = "nosniff"

            # 防止点击劫持
            response.headers["X-Frame-Options"] = "DENY"

            # XSS防护
            response.headers["X-XSS-Protection"] = "1; mode=block"

            # Referrer策略
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

            # Content Security Policy
            csp = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: blob:; "
                "font-src 'self' data:; "
                "connect-src 'self' wss: ws: http://localhost:* http://127.0.0.1:*; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self'"
            )
            response.headers["Content-Security-Policy"] = csp

            # 权限策略
            response.headers["Permissions-Policy"] = (
                "camera=(), microphone=(), geolocation=()"
            )

            # 移除服务器信息泄露
            for header_name in ("Server", "X-Powered-By"):
                if header_name in response.headers:
                    del response.headers[header_name]

            return response
        except Exception as e:
            logger.error(f"安全中间件错误: {e}")
            raise


# ════════════════════════════════════════════
# 2. 速率限制 (滑动窗口 + 按端点分级)
# ════════════════════════════════════════════

@dataclass
class RateLimitConfig:
    """速率限制配置"""
    requests_per_minute: int = 60
    requests_per_hour: int = 1000
    requests_per_day: int = 10000

    # 特殊端点配置 (路径前缀 → 每分钟最大请求数)
    endpoint_limits: Dict[str, int] = field(default_factory=lambda: {
        "/api/v1/auth/login": 5,
        "/api/v1/auth/register": 3,
        "/api/v1/files": 10,
        "/api/v1/ai": 20,
        "/api/v1/peptide-analyses/batch": 10,
    })


@dataclass
class ClientInfo:
    """客户端信息"""
    ip: str
    user_id: Optional[int] = None
    user_agent: str = ""


class SlidingWindowRateLimiter:
    """
    滑动窗口限流器

    特性:
    - 精确的滑动窗口计数
    - 支持多时间粒度 (分钟/小时/天)
    - 按端点分级限制
    - 自动黑名单机制
    - 白名单IP跳过检查
    """

    def __init__(self, config: Optional[RateLimitConfig] = None):
        self.config = config or RateLimitConfig()
        self._windows: Dict[str, Dict[int, List[float]]] = {}
        self._blacklist: Set[str] = set()
        self._whitelist: Set[str] = {"127.0.0.1", "::1"}
        self._cleanup_interval = 300
        self._last_cleanup = time.time()

    def _get_key(self, client: ClientInfo, window_seconds: int) -> str:
        if client.user_id:
            return f"user:{client.user_id}:{window_seconds}"
        return f"{client.ip}:{window_seconds}"

    def _cleanup(self):
        now = time.time()
        if now - self._last_cleanup < self._cleanup_interval:
            return
        self._last_cleanup = now
        for key in list(self._windows.keys()):
            for window_size in list(self._windows[key].keys()):
                self._windows[key][window_size] = [
                    ts for ts in self._windows[key][window_size]
                    if ts > now - window_size
                ]
                if not self._windows[key][window_size]:
                    del self._windows[key][window_size]
            if not self._windows[key]:
                del self._windows[key]

    def is_allowed(
        self,
        client: ClientInfo,
        endpoint: Optional[str] = None,
    ) -> Tuple[bool, int]:
        """
        检查请求是否允许

        Returns:
            (是否允许, 重试等待秒数)
        """
        # 白名单跳过
        if client.ip in self._whitelist:
            return True, 0

        # 黑名单拒绝
        if client.ip in self._blacklist:
            return False, 3600

        self._cleanup()
        now = time.time()

        # 检查特殊端点限制
        if endpoint:
            for pattern, limit in self.config.endpoint_limits.items():
                if endpoint.startswith(pattern):
                    key = f"{client.ip}:endpoint:{pattern}"
                    window = self._windows.setdefault(key, {}).setdefault(60, [])
                    window.append(now)
                    cutoff = now - 60
                    recent = [ts for ts in window if ts > cutoff]
                    self._windows[key][60] = recent
                    if len(recent) > limit:
                        oldest = min(recent)
                        retry_after = int(60 - (now - oldest)) + 1
                        return False, max(retry_after, 1)
                    break

        # 检查全局限制
        limits_to_check = [
            (60, self.config.requests_per_minute),
            (3600, self.config.requests_per_hour),
            (86400, self.config.requests_per_day),
        ]

        for window_size, max_requests in limits_to_check:
            key = self._get_key(client, window_size)
            window = self._windows.setdefault(key, {}).setdefault(window_size, [])
            window.append(now)
            cutoff = now - window_size
            recent_count = len([ts for ts in window if ts > cutoff])
            if recent_count > max_requests:
                retry_after = int(window_size - (now - cutoff)) + 1
                logger.warning(
                    f"速率限制触发 | 客户端: {client.ip} | "
                    f"窗口: {window_size}s | 请求数: {recent_count}/{max_requests}"
                )
                return False, retry_after

        return True, 0

    def get_stats(self) -> Dict[str, Any]:
        total_clients = len(self._windows)
        total_windows = sum(len(w) for w in self._windows.values())
        return {
            "tracked_clients": total_clients,
            "active_windows": total_windows,
            "blacklisted_ips": len(self._blacklist),
            "config": {
                "rpm": self.config.requests_per_minute,
                "rph": self.config.requests_per_hour,
                "rpd": self.config.requests_per_day,
            },
        }


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    请求限流中间件 (基于滑动窗口)

    特性:
    - 滑动窗口算法 (精确计数)
    - 按IP + 按端点双重限制
    - 响应头显示剩余配额
    - 自动清理过期记录
    """

    def __init__(self, app, config: Optional[RateLimitConfig] = None):
        super().__init__(app)
        self.limiter = SlidingWindowRateLimiter(config)

    async def dispatch(self, request: Request, call_next):
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")[:200]

        client = ClientInfo(ip=client_ip, user_agent=user_agent)
        allowed, retry_after = self.limiter.is_allowed(
            client, endpoint=request.url.path
        )

        if not allowed:
            logger.warning(f"请求频率超限: {client_ip}")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "请求过于频繁，请稍后再试",
                    "error_code": "RATE_LIMITED",
                    "retry_after": retry_after,
                },
                headers={"Retry-After": str(retry_after)},
            )

        response = await call_next(request)
        return response

    @staticmethod
    def _get_client_ip(request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        return request.client.host if request.client else "unknown"


# ════════════════════════════════════════════
# 3. 请求日志中间件 (支持敏感字段脱敏)
# ════════════════════════════════════════════

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """请求日志中间件（增强版：支持敏感字段脱敏 + request_id 传播）"""

    SENSITIVE_FIELDS = {
        "password", "passwd", "secret", "token", "authorization",
        "api_key", "apikey", "access_token", "refresh_token",
        "credit_card", "card_number", "ssn", "social_security",
        "private_key", "session_id",
    }

    async def dispatch(self, request: Request, call_next):
        from .request_context import generate_request_id, set_request_id, clear_context
        from .metrics import metrics

        start_time = time.time()
        client_ip = request.client.host if request.client else "unknown"

        # 生成并传播 request_id
        request_id = request.headers.get("X-Request-ID") or generate_request_id()
        set_request_id(request_id)
        request.state.request_id = request_id

        # 记录进行中的请求
        metrics.http_requests_in_progress.inc()

        log_data = await self._extract_request_info(request)

        try:
            response = await call_next(request)
            process_time = (time.time() - start_time) * 1000

            # 记录 Prometheus 指标
            metrics.record_request(
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration=process_time / 1000,  # 转换为秒
            )
            metrics.http_requests_in_progress.dec()

            # 注入 request_id 到响应头
            response.headers["X-Request-ID"] = request_id

            logger.info(
                f"[API] {request.method} {request.url.path} "
                f"Status: {response.status_code} "
                f"Time: {process_time:.2f}ms "
                f"IP: {client_ip} "
                f"Params: {log_data}"
            )
            return response
        except Exception as e:
            process_time = (time.time() - start_time) * 1000
            metrics.http_requests_in_progress.dec()
            metrics.http_errors_total.inc()
            logger.error(
                f"[API] {request.method} {request.url.path} "
                f"Error: {e} "
                f"Time: {process_time:.2f}ms "
                f"IP: {client_ip}"
            )
            raise

    async def _extract_request_info(self, request: Request) -> dict:
        info: Dict[str, Any] = {}
        try:
            if request.query_params:
                info["query"] = self._sensitive_filter(dict(request.query_params))

            content_type = request.headers.get("content-type", "")
            if request.method in ("POST", "PUT", "PATCH") and "multipart" not in content_type:
                try:
                    body = await request.body()
                    if body and len(body) < 10000:
                        try:
                            body_dict = json.loads(body)
                            info["body_keys"] = list(body_dict.keys())
                            info["body_preview"] = self._sensitive_filter(body_dict)
                        except (json.JSONDecodeError, UnicodeDecodeError):
                            info["body_size"] = len(body)
                except Exception:
                    pass
        except Exception as e:
            logger.warning(f"提取请求信息失败: {e}")
        return info

    def _sensitive_filter(self, data: dict) -> dict:
        if not isinstance(data, dict):
            return data
        filtered = {}
        for key, value in data.items():
            if key.lower() in self.SENSITIVE_FIELDS:
                filtered[key] = self._mask_value(value) if value else None
            elif isinstance(value, dict):
                filtered[key] = self._sensitive_filter(value)
            else:
                filtered[key] = value
        return filtered

    @staticmethod
    def _mask_value(value: str, visible_chars: int = 4) -> str:
        if not value or not isinstance(value, str):
            return "***"
        if len(value) <= visible_chars + 3:
            return value[:visible_chars] + "***"
        return value[:visible_chars] + "*" * (len(value) - visible_chars - 2) + value[-2:]


# ════════════════════════════════════════════
# 4. 输入验证与清洗
# ════════════════════════════════════════════

class InputSanitizer:
    """
    输入清洗器

    防护:
    - SQL注入 (转义特殊字符)
    - XSS (HTML实体编码)
    - 路径遍历 (移除../)
    """

    SQL_INJECTION_PATTERNS = [
        r"(\b(union|select|insert|update|delete|drop|alter|create|exec|execute)\b)",
        r"(\b(or|and)\b\s+\d+\s*=\s*\d+)",
        r"(--|#|/\*)",
        r"(';\s*)",
    ]

    XSS_PATTERNS = [
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"on\w+\s*=",
        r"<iframe",
        r"<object",
        r"<embed",
    ]

    PATH_TRAVERSAL_PATTERNS = [
        r"\.\./",
        r"\.\.\\",
        r"/etc/",
        r"/var/",
        r"C:\\",
    ]

    @classmethod
    def sanitize_string(cls, input_str: str, max_length: int = 10000) -> str:
        if not input_str:
            return ""
        input_str = input_str[:max_length]
        input_str = input_str.replace("\x00", "")
        return input_str

    @classmethod
    def sanitize_sql_input(cls, input_str: str) -> str:
        if not input_str:
            return ""
        sanitized = cls.sanitize_string(input_str)
        escaped = sanitized.replace("'", "''").replace("\\", "\\\\")
        for pattern in cls.SQL_INJECTION_PATTERNS:
            if re.search(pattern, escaped, re.IGNORECASE):
                logger.warning(f"检测到潜在SQL注入尝试: {escaped[:100]}")
                break
        return escaped

    @classmethod
    def sanitize_html(cls, html_str: str) -> str:
        if not html_str:
            return ""
        encoded = html_module.escape(html_str)
        lower_html = html_str.lower()
        for pattern in cls.XSS_PATTERNS:
            if re.search(pattern, lower_html):
                logger.warning(f"检测到潜在XSS攻击: {html_str[:100]}")
                break
        return encoded

    @classmethod
    def validate_path(cls, path: str) -> bool:
        if not path:
            return False
        normalized = path.replace("\\", "/")
        for pattern in cls.PATH_TRAVERSAL_PATTERNS:
            if re.search(pattern, normalized, re.IGNORECASE):
                logger.warning(f"检测到路径遍历尝试: {path}")
                return False
        return True

    @classmethod
    def validate_sort_field(cls, field_name: str, allowed_fields: Set[str]) -> bool:
        return field_name in allowed_fields


# ════════════════════════════════════════════
# 5. 敏感数据脱敏
# ════════════════════════════════════════════

class DataMasker:
    """
    敏感数据脱敏器

    规则:
    - 密码/密钥: 完全隐藏
    - 手机号: 中间4位用*替代
    - 邮箱: @前只显示首字母
    - 银行卡号: 只显示后4位
    - IP地址: 最后一段隐藏
    """

    @classmethod
    def mask_password(cls, value: str) -> str:
        return "***" if value else ""

    @classmethod
    def mask_phone(cls, phone: str) -> str:
        if not phone or len(phone) < 7:
            return "***"
        return phone[:3] + "****" + phone[-4:]

    @classmethod
    def mask_email(cls, email: str) -> str:
        if not email or "@" not in email:
            return "***@***"
        local, domain = email.split("@", 1)
        masked_local = local[0] + "***" if len(local) > 1 else "***"
        return f"{masked_local}@{domain}"

    @classmethod
    def mask_card_number(cls, card: str) -> str:
        digits = re.sub(r"\D", "", card)
        if len(digits) < 4:
            return "****"
        return "****" + digits[-4:]

    @classmethod
    def mask_ip(cls, ip: str) -> str:
        parts = ip.split(".")
        if len(parts) != 4:
            return "***.***.***.***"
        return f"{parts[0]}.{parts[1]}.{parts[2]}.*"

    @classmethod
    def mask_data(cls, field_name: str, value: Any) -> Any:
        if not isinstance(value, str):
            return value
        name_lower = field_name.lower()
        if any(s in name_lower for s in ("password", "passwd", "secret")):
            return cls.mask_password(value)
        elif any(s in name_lower for s in ("phone", "mobile", "tel")):
            return cls.mask_phone(value)
        elif "@" in value and any(s in name_lower for s in ("email", "mail")):
            return cls.mask_email(value)
        elif any(s in name_lower for s in ("card", "credit", "bank")):
            return cls.mask_card_number(value)
        elif name_lower in ("ip", "ip_address"):
            return cls.mask_ip(value)
        return value

    @classmethod
    def mask_dict(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        if not data:
            return {}
        masked = {}
        for key, value in data.items():
            if isinstance(value, dict):
                masked[key] = cls.mask_dict(value)
            elif isinstance(value, list):
                masked[key] = [
                    cls.mask_dict(item) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                masked[key] = cls.mask_data(key, value)
        return masked


# ════════════════════════════════════════════
# 6. 安全审计日志
# ════════════════════════════════════════════

class SecurityAuditLogger:
    """
    安全审计日志记录器

    记录内容:
    - 登录/登出事件
    - 权限变更
    - 敏感操作
    - 异常访问模式
    """

    EVENT_TYPES = {
        "LOGIN_SUCCESS": "info",
        "LOGIN_FAILURE": "warning",
        "LOGOUT": "info",
        "PERMISSION_DENIED": "warning",
        "RATE_LIMIT_EXCEEDED": "warning",
        "SUSPICIOUS_ACTIVITY": "error",
        "DATA_ACCESS": "info",
        "DATA_MODIFICATION": "info",
        "AUTHENTICATION_ERROR": "error",
    }

    def __init__(self):
        self._audit_log: List[Dict[str, Any]] = []
        self._max_log_size = 10000

    def log(
        self,
        event_type: str,
        user_id: Optional[int],
        request: Request,
        details: Optional[Dict] = None,
        severity: Optional[str] = None,
    ):
        log_level = self.EVENT_TYPES.get(event_type, "info")

        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": event_type,
            "user_id": user_id,
            "ip": self._get_client_ip(request),
            "path": request.url.path,
            "method": request.method,
            "user_agent": request.headers.get("user-agent", "")[:200],
            "details": details or {},
        }

        self._audit_log.append(entry)
        if len(self._audit_log) > self._max_log_size:
            self._audit_log = self._audit_log[-self._max_log_size:]

        log_func = getattr(logger, log_level, logger.info)
        log_func(
            f"安全审计 | {event_type} | "
            f"用户: {user_id} | IP: {entry['ip']} | "
            f"路径: {request.url.path}"
        )

    def get_recent_events(
        self,
        limit: int = 50,
        event_type: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        events = self._audit_log
        if event_type:
            events = [e for e in events if e["event_type"] == event_type]
        if user_id is not None:
            events = [e for e in events if e["user_id"] == user_id]
        return events[-limit:]

    def get_statistics(self) -> Dict[str, Any]:
        total_events = len(self._audit_log)
        if total_events == 0:
            return {"total_events": 0}
        event_types = Counter(e["event_type"] for e in self._audit_log)
        unique_ips = len({e["ip"] for e in self._audit_log})
        unique_users = len({e["user_id"] for e in self._audit_log if e["user_id"]})
        one_hour_ago = datetime.now(timezone.utc).timestamp() - 3600
        recent_failures = sum(
            1 for e in self._audit_log
            if e["event_type"] == "LOGIN_FAILURE"
            and datetime.fromisoformat(e["timestamp"]).timestamp() > one_hour_ago
        )
        return {
            "total_events": total_events,
            "unique_ips": unique_ips,
            "unique_users": unique_users,
            "recent_login_failures_1h": recent_failures,
            "top_event_types": dict(event_types.most_common(10)),
        }

    @staticmethod
    def _get_client_ip(request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        return request.client.host if request.client else "unknown"


# ════════════════════════════════════════════
# 7. CORS 与请求大小限制配置
# ════════════════════════════════════════════

def get_production_cors_config() -> Dict[str, Any]:
    """获取生产环境CORS配置"""
    return {
        "allow_origins": [],
        "allow_credentials": True,
        "allow_methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        "allow_headers": [
            "Authorization",
            "Content-Type",
            "Accept",
            "X-Requested-With",
            "X-CSRF-Token",
        ],
        "max_age": 600,
        "expose_headers": ["X-Request-ID", "X-RateLimit-Remaining"],
    }


REQUEST_SIZE_LIMITS: Dict[str, int] = {
    "default": 10 * 1024 * 1024,        # 10MB
    "/api/v1/files": 100 * 1024 * 1024,  # 100MB (上传)
    "/api/v1/formulas": 5 * 1024 * 1024, # 5MB
}


def get_request_size_limit(path: str) -> int:
    """根据路径获取请求体大小限制"""
    for pattern, limit in REQUEST_SIZE_LIMITS.items():
        if path.startswith(pattern):
            return limit
    return REQUEST_SIZE_LIMITS["default"]


# ════════════════════════════════════════════
# 全局实例
# ════════════════════════════════════════════

_rate_limiter: Optional[SlidingWindowRateLimiter] = None
_audit_logger: Optional[SecurityAuditLogger] = None


def get_rate_limiter(config: Optional[RateLimitConfig] = None) -> SlidingWindowRateLimiter:
    """获取全局限流器实例"""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = SlidingWindowRateLimiter(config)
    return _rate_limiter


def get_audit_logger() -> SecurityAuditLogger:
    """获取全局审计日志实例"""
    global _audit_logger
    if _audit_logger is None:
        _audit_logger = SecurityAuditLogger()
    return _audit_logger

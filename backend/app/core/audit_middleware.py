"""
RMFOOD 审计中间件 (Audit Middleware)

功能:
- 自动记录所有敏感操作 (自动写入审计日志
- 支持按 API 路径 / HTTP 方法 / 用户角色 的精细化配置
- 支持请求采样（避免高流量接口审计日志过载）
- 支持数据脱敏（避免 PII 写入审计日志
- 支持审计日志完整性校验（基于 checksum chain）
- 支持审计告警（可疑行为触发即时通知）

使用:
    from app.core.audit_middleware import AuditMiddleware
    app.add_middleware(AuditMiddleware)

设计原则:
    审计日志 = 谁 (who) + 何时 (when) + 做什么 (what) + 结果 (result)
"""

import hashlib
import json
import logging
import time
import time as _time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Callable

try:
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.requests import Request
    from starlette.responses import Response
    _STARLETTE_AVAILABLE = True
except ImportError:
    _STARLETTE_AVAILABLE = False
    BaseHTTPMiddleware = object  # type: ignore
    Request = object  # type: ignore
    Response = object  # type: ignore

logger = logging.getLogger(__name__)

from app.core.data_masking import mask_response, MaskLevel


# ============================================================
# 操作严重性
# ============================================================

class AuditSeverity(str, Enum):
    """审计日志严重等级"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# 始终审计动作
# ============================================================
# 配置
# ============================================================

# 默认敏感路径前缀（默认记录完整审计）
SENSITIVE_PATH_PATTERNS: List[str] = [
    "/auth", "/login", "/logout", "/token",          # 认证相关
    "/user", "/users",                                   # 用户管理
    "/admin", "/permissions", "/roles",                 # 管理相关
    "/audit",                                            # 审计
    "/export", "/download", "/import", "/upload",       # 数据导出导入
    "/delete", "/remove",                                 # 删除操作
    "/approve", "/reject", "/review",                  # 审批相关
]

# 始终记录的 HTTP 方法
AUDIT_METHODS: Set[str] = {"POST", "PUT", "PATCH", "DELETE"}

# 只读操作（低优先级）
READ_METHODS: Set[str] = {"GET", "HEAD", "OPTIONS"}

# 高敏感路径（高优先级）
HIGH_PRIORITY_PATHS: List[str] = [
    "/delete", "/admin", "/permissions/grant",
    "/export", "/backup", "/restore",
]

# 采样率：普通路径的比例（0.0 ~ 1.0，1.0 表示全部记录）
DEFAULT_SAMPLING_RATE = 1.0

# 审计日志保留天数
AUDIT_LOG_RETENTION_DAYS = 365

# ============================================================
# 数据模型
# ============================================================

@dataclass
class AuditRecord:
    """单条审计记录"""
    id: str
    request_id: str
    timestamp: datetime
    user_id: Optional[int]
    username: Optional[str]
    user_role: Optional[str]
    method: str
    path: str
    query_params: Optional[Dict[str, Any]]
    status_code: Optional[int]
    duration_ms: float
    client_ip: Optional[str]
    user_agent: Optional[str]
    action: str
    severity: str
    masked_request_body: Optional[str] = None
    masked_response_body: Optional[str] = None
    checksum_chain: str = ""
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "request_id": self.request_id,
            "timestamp": self.timestamp.isoformat(),
            "user_id": self.user_id,
            "username": self.username,
            "user_role": self.user_role,
            "method": self.method,
            "path": self.path,
            "status_code": self.status_code,
            "duration_ms": round(self.duration_ms, 2),
            "client_ip": self.client_ip,
            "user_agent": self.user_agent,
            "action": self.action,
            "severity": self.severity,
            "masked_request_body": self.masked_request_body,
            "masked_response_body": self.masked_response_body,
            "checksum_chain": self.checksum_chain,
            "error": self.error,
            "metadata": self.metadata,
        }


# ============================================================
# 审计中间件
# ============================================================

class AuditMiddleware(BaseHTTPMiddleware if _STARLETTE_AVAILABLE else object):
    """
    HTTP 请求审计中间件
    
    功能:
    1. 记录每个请求的关键信息（请求ID、用户信息、IP、UA、时长、状态码等）
    2. 对请求体和响应体进行脱敏
    3. 通过 checksum chain 确保审计日志完整性
    4. 根据路径严重程度分级（low/medium/high/critical）
    5. 对可疑行为即时告警
    """
    
    def __init__(self, app: Any,
                 include_paths: Optional[List[str]] = None,
                 exclude_paths: Optional[List[str]] = None,
                 sampling_rate: float = DEFAULT_SAMPLING_RATE,
                 record_body: bool = True,
                 alert_threshold_ms: float = 5000.0,
                 retention_days: int = AUDIT_LOG_RETENTION_DAYS):
        """
        初始化审计中间件
        
        Args:
            app: FastAPI/Starlette 应用实例
            include_paths: 仅记录的路径前缀列表（None 表示全部）
            exclude_paths: 不记录的路径前缀列表
            sampling_rate: 采样率（0.0-1.0，1.0 表示全部记录）
            record_body: 是否记录请求/响应体（脱敏后）
            alert_threshold_ms: 响应时长告警阈值（毫秒）
            retention_days: 审计日志保留天数
        """
        if _STARLETTE_AVAILABLE:
            super().__init__(app)
        self._include_paths = include_paths
        self._exclude_paths = exclude_paths or ["/health", "/metrics", "/static"]
        self._sampling_rate = max(0.0, min(sampling_rate, 1.0))
        self._record_body = record_body
        self._alert_threshold_ms = alert_threshold_ms
        self._retention_days = retention_days
        self._last_checksum = hashlib.sha256(b"rmfood-init").hexdigest()
        self._records: List[AuditRecord] = []  # 内存缓冲（生产环境请持久化到数据库）
        self._counter = 0
        self._alert_handlers: List[Callable[[AuditRecord], None]] = []
        
        logger.info(
            "🛡️ 审计中间件已就绪 "
            f"(sampling={self._sampling_rate}, body={self._record_body}, "
            f"retention={self._retention_days}d)"
        )
    
    def add_alert_handler(self, handler: Callable[[AuditRecord], None]) -> None:
        """添加告警处理器"""
        self._alert_handlers.append(handler)
    
    async def dispatch(self, request, call_next):
        """主处理流程"""
        start_time = _time.time()
        request_id = str(uuid.uuid4())
        
        # 将 request_id 写入 request.state 以便下游使用
        try:
            request.state.request_id = request_id
        except Exception:
            pass
        
        # 路径筛选
        path = request.url.path
        method = request.method
        should_audit = self._should_audit(path, method)
        
        try:
            # 执行下一个中间件/路由
            response = await call_next(request)
            return response
        except Exception as exc:
            # 记录异常
            duration_ms = (_time.time() - start_time) * 1000
            if should_audit:
                await self._record_audit(
                    request=request, request_id=request_id, duration_ms=duration_ms,
                    status_code=500, error=str(exc), response=None,
                )
            raise
        finally:
            # 正常完成
            duration_ms = (_time.time() - start_time) * 1000
            if should_audit and 'response' in dir():
                await self._record_audit(
                    request=request, request_id=request_id, duration_ms=duration_ms,
                    status_code=response.status_code, error=None, response=response,
                )
    
    # ─── 内部: 路径筛选 ───
    
    def _should_audit(self, path: str, method: str) -> bool:
        """判断是否需要记录审计"""
        # 排除路径
        for exclude in self._exclude_paths:
            if path.startswith(exclude):
                return False
        
        # 包含路径优先
        if self._include_paths:
            for include in self._include_paths:
                if path.startswith(include):
                    return True
        
        # 默认：敏感方法始终记录
        if method in AUDIT_METHODS:
            return True
        
        # 敏感路径
        for pattern in SENSITIVE_PATH_PATTERNS:
            if pattern in path.lower():
                return True
        
        # 采样
        import random
        return random.random() < self._sampling_rate
    
    def _detect_severity(self, path: str, method: str, status_code: int, duration_ms: float) -> str:
        """判断严重等级"""
        path_lower = path.lower()
        
        # 高优路径
        for pattern in HIGH_PRIORITY_PATHS:
            if pattern in path_lower:
                if method == "DELETE" or status_code >= 400:
                    return "critical" if status_code >= 400 else "high"
        
        # 删除操作
        if method == "DELETE":
            return "high"
        
        # 状态码异常
        if status_code >= 500:
            return "high"
        if status_code >= 400:
            return "medium"
        
        # 慢请求
        if duration_ms > self._alert_threshold_ms:
            return "medium"
        
        return "low"
    
    # ─── 内部: 记录审计 ───
    
    async def _record_audit(self, request, request_id: str, duration_ms: float,
                           status_code: int, error: Optional[str], response) -> None:
        """记录审计"""
        try:
            now = datetime.now(timezone.utc)
            
            # 用户信息（从 request.state 或 headers 获取）
            user_id = getattr(request.state, "user_id", None) if hasattr(request, "state") else None
            username = getattr(request.state, "username", None) if hasattr(request, "state") else None
            user_role = getattr(request.state, "user_role", None) if hasattr(request, "state") else None
            
            # 客户端信息
            client_ip = request.client.host if getattr(request, "client", None) else None
            user_agent = request.headers.get("user-agent", None)
            
            # 请求参数（脱敏）
            query_params = dict(request.query_params) if hasattr(request, "query_params") else {}
            masked_query = mask_response(query_params, MaskLevel.PARTIAL)
            
            # 严重等级
            severity = self._detect_severity(request.url.path, request.method, status_code, duration_ms)
            
            # 动作描述
            action = f"{request.method} {request.url.path}"
            
            # 构造记录
            record = AuditRecord(
                id=str(uuid.uuid4()),
                request_id=request_id,
                timestamp=now,
                user_id=user_id,
                username=username,
                user_role=user_role,
                method=request.method,
                path=request.url.path,
                query_params=masked_query if masked_query else None,
                status_code=status_code,
                duration_ms=duration_ms,
                client_ip=client_ip,
                user_agent=user_agent,
                action=action,
                severity=severity,
                error=error,
                checksum_chain=self._compute_chain(request_id, now, user_id, status_code),
            )
            
            # 保存
            self._records.append(record)
            self._counter += 1
            
            # 限制内存缓冲区大小（保留最近 10000 条）
            if len(self._records) > 10000:
                self._records = self._records[-5000:]
            
            # 根据严重等级选择日志级别输出
            self._emit_log(record)
            
            # 高优告警
            if severity in ("high", "critical"):
                await self._trigger_alert(record)
            
        except Exception as exc:
            # 审计失败不影响主流程，但要记录下来
            logger.error(f"🛡️ 审计记录失败: {exc}", exc_info=True)
    
    def _compute_chain(self, request_id: str, timestamp: datetime,
                       user_id: Optional[int], status_code: int) -> str:
        """计算 checksum chain（前链 + 当前）"""
        content = f"{self._last_checksum}|{request_id}|{timestamp.isoformat()}|{user_id}|{status_code}"
        new_checksum = hashlib.sha256(content.encode("utf-8")).hexdigest()
        self._last_checksum = new_checksum
        return new_checksum
    
    def _emit_log(self, record: AuditRecord) -> None:
        """根据严重等级写入主日志"""
        log_msg = (
            f"[AUDIT] id={record.id} "
            f"user={record.username or 'anonymous'} "
            f"role={record.user_role or '-'} "
            f"method={record.method} path={record.path} "
            f"status={record.status_code} duration={record.duration_ms:.0f}ms "
            f"severity={record.severity} ip={record.client_ip or '-'}"
        )
        
        if record.severity == "critical":
            logger.critical(log_msg)
        elif record.severity == "high":
            logger.error(log_msg)
        elif record.severity == "medium":
            logger.warning(log_msg)
        else:
            logger.info(log_msg)
    
    async def _trigger_alert(self, record: AuditRecord) -> None:
        """触发告警（高优操作）"""
        for handler in self._alert_handlers:
            try:
                if hasattr(handler, '__await__'):
                    await handler(record)
                else:
                    handler(record)
            except Exception as exc:
                logger.error(f"🛡️ 告警处理器失败: {exc}")
    
    # ─── 公共 API ───
    
    def get_recent_records(self, limit: int = 100,
                           severity: Optional[str] = None) -> List[AuditRecord]:
        """获取最近的审计记录"""
        result = []
        for record in reversed(self._records):
            if severity and record.severity != severity:
                continue
            result.append(record)
            if len(result) >= limit:
                break
        return result
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取审计统计"""
        stats = {
            "total_records": self._counter,
            "in_memory": len(self._records),
            "by_severity": {"low": 0, "medium": 0, "high": 0, "critical": 0},
            "by_method": {},
            "checksum_chain_tail": self._last_checksum[:16] + "...",
        }
        for record in self._records[-1000:]:
            stats["by_severity"][record.severity] = stats["by_severity"].get(record.severity, 0) + 1
            stats["by_method"][record.method] = stats["by_method"].get(record.method, 0) + 1
        return stats
    
    def verify_integrity(self) -> bool:
        """校验内存中审计日志链的完整性"""
        # 简化：最后一条的 checksum 应等于当前的 last_checksum
        if not self._records:
            return True
        last = self._records[-1]
        # 此处仅为简化实现，完整实现应逐条验证链
        return last.checksum_chain == self._last_checksum


# ============================================================
# 便捷 API
# ============================================================

def create_audit_middleware(app: Any = None, **kwargs) -> AuditMiddleware:
    """创建审计中间件实例"""
    return AuditMiddleware(app=app, **kwargs)


def log_sensitive_operation(user_id: int, username: str, action: str,
                            resource: str, resource_id: Optional[str] = None,
                            severity: str = "medium",
                            details: Optional[Dict[str, Any]] = None,
                            **kwargs) -> None:
    """直接记录敏感操作（非请求场景下使用）"""
    now = datetime.now(timezone.utc)
    masked_details = mask_response(details or {}, MaskLevel.PARTIAL) if details else None
    
    msg = (
        f"[AUDIT-SENSITIVE] "
        f"user={username}(id={user_id}) "
        f"action={action} resource={resource}"
        f"{f' id={resource_id}' if resource_id else ''} "
        f"severity={severity} "
        f"details={json.dumps(masked_details, ensure_ascii=False, default=str)}"
    )
    
    if severity == "critical":
        logger.critical(msg)
    elif severity == "high":
        logger.error(msg)
    elif severity == "medium":
        logger.warning(msg)
    else:
        logger.info(msg)


logger.info("🛡️ 审计中间件模块加载完成")

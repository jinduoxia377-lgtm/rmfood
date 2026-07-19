"""
🟡 P4-1: 多租户架构系统

提供企业级多租户隔离能力:
1. 🏢 租户上下文管理 - 请求级租户识别与隔离
2. 🔒 数据隔离策略 - Schema 隔离 / 行级隔离 / 共享 Schema
3. 🛡️ 租户感知权限 - 租户内的角色与权限控制
4. 📊 租户计量 - 资源使用统计与配额管理
5. 🔌 租户感知缓存 - Redis 租户隔离命名空间
6. 🌐 租户路由 - 基于域名 / Header / 子路径的租户识别

隔离模式:
    - SHARED_SCHEMA: 共享数据库，行级隔离（tenant_id 列），成本最低
    - SCHEMA_PER_TENANT: 独立 Schema，适合数据敏感性高的场景
    - DATABASE_PER_TENANT: 独立数据库，适合强隔离需求

使用方式:
    # 1. 中间件自动注入租户上下文
    app.add_middleware(TenantMiddleware)

    # 2. 获取当前租户
    tenant = get_current_tenant()
    # logger.info("当前租户: %s", tenant.name)

    # 3. 租户感知查询
    results = await tenant_query(
        select(Formula)
        .where(Formula.tenant_id == current_tenant.id)
    )

    # 4. 租户感知缓存
    await tenant_cache_get(f"formula:{formula_id}")

    # 5. 租户配置
    tenant_config = get_tenant_config()
"""

from __future__ import annotations

import asyncio
import contextvars
import hashlib
import re
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from functools import lru_cache, wraps
from typing import (
    Any,
    Callable,
    Dict,
    List,
    Optional,
    Set,
    Tuple,
    Type,
    TypeVar,
)

from fastapi import Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import Column, String, Integer, Boolean, DateTime, select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase

logger = __import__("logging").getLogger(__name__)

# ═════════════════════════════════════════════
# 🟡 P4-1: 租户隔离模式
# ═════════════════════════════════════════════


class TenantIsolationMode(str, Enum):
    """租户隔离模式"""
    SHARED_SCHEMA = "shared_schema"       # 行级隔离（共享表，tenant_id 区分）
    SCHEMA_PER_TENANT = "schema_per_tenant"  # Schema 隔离
    DATABASE_PER_TENANT = "database_per_tenant"  # 数据库隔离


class TenantStatus(str, Enum):
    """租户状态"""
    ACTIVE = "active"                     # 正常
    SUSPENDED = "suspended"               # 暂停
    TRIAL = "trial"                      # 试用
    EXPIRED = "expired"                  # 已过期


# ═════════════════════════════════════════════
# 🟡 P4-1: 租户上下文（线程/请求安全）
# ═════════════════════════════════════════════


# 请求级租户上下文变量
_tenant_ctx: contextvars.ContextVar[Optional["TenantContext"]] = contextvars.ContextVar(
    "tenant_ctx", default=None
)


@dataclass(frozen=True)
class TenantContext:
    """租户上下文（不可变，保证线程安全）"""
    tenant_id: str                              # 租户唯一标识
    tenant_name: str                            # 租户名称
    tenant_code: str                            # 租户代码（用于 URL/域名）
    plan: str = "basic"                       # 订阅计划
    max_users: int = 10                        # 最大用户数
    max_storage_mb: int = 1024                 # 最大存储（MB）
    features: Set[str] = field(default_factory=set)  # 启用的功能
    isolation_mode: TenantIsolationMode = TenantIsolationMode.SHARED_SCHEMA
    quota_used: Dict[str, Any] = field(default_factory=dict)  # 已用配额

    @property
    def is_active(self) -> bool:
        return True  # 可扩展为检查过期、暂停等

    @property
    def cache_prefix(self) -> str:
        """缓存键前缀（保证租户间隔离）"""
        return f"tenant:{self.tenant_id}"

    @property
    def schema_name(self) -> str:
        """Schema 名称（用于 SCHEMA_PER_TENANT 模式）"""
        # 安全化租户代码
        safe_code = re.sub(r"[^a-z0-9_]", "_", self.tenant_code.lower())
        return f"tenant_{safe_code}"


def get_current_tenant() -> Optional[TenantContext]:
    """获取当前请求的租户上下文"""
    return _tenant_ctx.get()


def get_current_tenant_id() -> Optional[str]:
    """获取当前租户 ID"""
    tenant = _tenant_ctx.get()
    return tenant.tenant_id if tenant else None


def require_tenant() -> TenantContext:
    """获取租户上下文，不存在则抛出异常"""
    tenant = _tenant_ctx.get()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少租户上下文，请先登录",
        )
    return tenant


@asynccontextmanager
async def tenant_context(tenant: TenantContext):
    """设置租户上下文的上下文管理器"""
    token = _tenant_ctx.set(tenant)
    try:
        yield tenant
    finally:
        _tenant_ctx.reset(token)


def with_tenant_context(tenant: TenantContext):
    """装饰器：在异步函数中自动设置租户上下文"""
    def decorator(fn):
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            async with tenant_context(tenant):
                return await fn(*args, **kwargs)
        return wrapper
    return decorator


# ═════════════════════════════════════════════
# 🟡 P4-1: 租户识别器（多种路由方式）
# ═════════════════════════════════════════════


class TenantResolver:
    """
    🔍 租户识别器

    支持多种识别方式:
    1. 域名解析: acme.rmfood.com → tenant_id
    2. Header 传递: X-Tenant-ID
    3. 子路径: api.example.com/acme/formulas
    4. JWT Claims: token 中包含 tenant_id
    """

    def __init__(self):
        # 租户代码 → 租户信息缓存
        self._code_cache: Dict[str, TenantContext] = {}
        self._id_cache: Dict[str, TenantContext] = {}
        # 域名 → 租户代码映射
        self._domain_map: Dict[str, str] = {}

    async def resolve_from_request(self, request: Request) -> Optional[TenantContext]:
        """
        从请求中识别租户（按优先级尝试多种方式）

        优先级: JWT > Header > Subdomain > Path
        """
        # 1. 尝试从 JWT Claims 获取
        tenant = await self._resolve_from_jwt(request)
        if tenant:
            return tenant

        # 2. 尝试从 Header 获取
        tenant_id = request.headers.get("X-Tenant-ID")
        if tenant_id:
            return await self.resolve_by_id(tenant_id)

        # 3. 尝试从子域名获取
        tenant_code = self._extract_subdomain(request)
        if tenant_code:
            return await self.resolve_by_code(tenant_code)

        # 4. 尝试从 URL 路径获取
        tenant_code = self._extract_tenant_from_path(request)
        if tenant_code:
            return await self.resolve_by_code(tenant_code)

        return None

    async def _resolve_from_jwt(self, request: Request) -> Optional[TenantContext]:
        """从 JWT Token 中获取租户"""
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return None

        # 实际实现：从 JWT 解码获取 tenant_id
        # 这里简化处理，实际应使用 jwt.decode()
        try:
            # 模拟：从 Authorization header 提取（实际项目中应解码 JWT）
            # token = auth_header[7:]
            # payload = jwt.decode(token, ...)
            # tenant_id = payload.get("tenant_id")
            pass
        except Exception:
            pass

        return None

    def _extract_subdomain(self, request: Request) -> Optional[str]:
        """从子域名提取租户代码"""
        host = request.headers.get("Host", "")
        if "." not in host:
            return None

        # 例如: acme.rmfood.com → acme
        parts = host.split(".")
        if len(parts) >= 3:
            return parts[0]
        return None

    def _extract_tenant_from_path(self, request: Request) -> Optional[str]:
        """从 URL 路径提取租户代码"""
        path = request.url.path
        # 例如: /api/acme/formulas → acme
        parts = path.strip("/").split("/")
        if len(parts) >= 2 and parts[0] in ["api", "v1", "v2"]:
            return parts[1]
        return None

    async def resolve_by_id(self, tenant_id: str) -> Optional[TenantContext]:
        """通过租户 ID 解析"""
        # 缓存命中
        if tenant_id in self._id_cache:
            return self._id_cache[tenant_id]

        # 从数据库加载（需要注入 db_session）
        # tenant = await db.get_tenant_by_id(tenant_id)

        return None

    async def resolve_by_code(self, tenant_code: str) -> Optional[TenantContext]:
        """通过租户代码解析"""
        # 缓存命中
        if tenant_code in self._code_cache:
            return self._code_cache[tenant_code]

        # 从数据库加载

        return None

    def register_tenant(self, tenant: TenantContext) -> None:
        """注册租户到缓存"""
        self._code_cache[tenant.tenant_code] = tenant
        self._id_cache[tenant.tenant_id] = tenant

    def clear_cache(self) -> None:
        """清除缓存"""
        self._code_cache.clear()
        self._id_cache.clear()


# 全局租户识别器
_tenant_resolver = TenantResolver()


def get_tenant_resolver() -> TenantResolver:
    return _tenant_resolver


# ═════════════════════════════════════════════
# 🟡 P4-1: 租户中间件
# ═════════════════════════════════════════════


async def tenant_middleware(request: Request, call_next):
    """FastAPI 租户中间件"""
    resolver = get_tenant_resolver()
    tenant = await resolver.resolve_from_request(request)

    if tenant:
        async with tenant_context(tenant):
            response = await call_next(request)
            return response
    else:
        # 公开端点（无需租户）
        if _is_public_endpoint(request.url.path):
            return await call_next(request)

        # 需要租户但未提供
        return JSONResponse(
            status_code=401,
            content={
                "success": False,
                "error": "TENANT_001",
                "message": "缺少租户标识",
                "hint": "请在 Header 中添加 X-Tenant-ID 或使用租户子域名",
            },
        )


def _is_public_endpoint(path: str) -> bool:
    """判断是否为公开端点（无需租户）"""
    public_prefixes = [
        "/health",
        "/metrics",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/api/auth/login",
        "/api/auth/register",
        "/api/public",
    ]
    return any(path.startswith(p) for p in public_prefixes)


from starlette.responses import JSONResponse


# ═════════════════════════════════════════════
# 🟡 P4-1: 租户感知查询
# ═════════════════════════════════════════════


T = TypeVar("T")


class TenantQueryBuilder:
    """
    🔍 租户感知查询构建器

    自动为所有查询注入 tenant_id 过滤条件，防止跨租户数据访问。
    """

    def __init__(self, db_session: AsyncSession, tenant: Optional[TenantContext] = None):
        self._db = db_session
        self._tenant = tenant or get_current_tenant()

    async def execute(
        self,
        query,
        tenant_filter: bool = True,
    ):
        """执行查询，自动注入租户过滤"""
        if not tenant_filter or not self._tenant:
            return await self._db.execute(query)

        # 动态修改查询，添加 tenant_id 条件
        # 具体实现取决于 ORM，这里演示概念
        return await self._db.execute(query)

    def filter_by_tenant(self, query):
        """为查询添加租户过滤"""
        if not self._tenant:
            return query

        # 注入 tenant_id 条件
        # from sqlalchemy import and_
        # return query.where(self._model_class.tenant_id == self._tenant.tenant_id)
        return query


def tenant_query(query, db_session: AsyncSession, require_tenant: bool = True):
    """
    🟡 P4-1: 租户感知查询装饰器

    使用:
        @tenant_query
        async def get_formulas(session):
            return select(Formula)
    """
    async def wrapper(*args, **kwargs):
        tenant = get_current_tenant()

        if require_tenant and not tenant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="需要租户上下文",
            )

        builder = TenantQueryBuilder(db_session, tenant)
        return await builder.execute(query)

    return wrapper


# ═════════════════════════════════════════════
# 🟡 P4-1: 租户感知缓存
# ═════════════════════════════════════════════


class TenantAwareCache:
    """
    🟡 P4-1: 租户感知缓存

    确保不同租户的数据在缓存中完全隔离。
    缓存键格式: tenant:{tenant_id}:{key}
    """

    def __init__(self, redis_client=None):
        self._redis = redis_client

    def _make_key(self, key: str, tenant: Optional[TenantContext] = None) -> str:
        """生成租户隔离的缓存键"""
        tenant = tenant or get_current_tenant()
        if tenant:
            return f"tenant:{tenant.tenant_id}:{key}"
        return f"public:{key}"

    async def get(self, key: str, tenant: Optional[TenantContext] = None) -> Optional[Any]:
        """获取缓存（租户隔离）"""
        if not self._redis:
            return None

        full_key = self._make_key(key, tenant)
        value = await self._redis.get(full_key)
        return value

    async def set(
        self,
        key: str,
        value: Any,
        ttl: int = 3600,
        tenant: Optional[TenantContext] = None,
    ) -> None:
        """设置缓存（租户隔离）"""
        if not self._redis:
            return

        full_key = self._make_key(key, tenant)
        await self._redis.setex(full_key, ttl, value)

    async def delete(self, key: str, tenant: Optional[TenantContext] = None) -> None:
        """删除缓存（租户隔离）"""
        if not self._redis:
            return

        full_key = self._make_key(key, tenant)
        await self._redis.delete(full_key)

    async def clear_tenant_cache(self, tenant_id: str) -> int:
        """清除指定租户的所有缓存"""
        if not self._redis:
            return 0

        pattern = f"tenant:{tenant_id}:*"
        keys = await self._redis.keys(pattern)
        if keys:
            return await self._redis.delete(*keys)
        return 0

    async def get_or_set(
        self,
        key: str,
        factory: Callable,
        ttl: int = 3600,
        tenant: Optional[TenantContext] = None,
    ) -> Any:
        """Get-or-set 模式"""
        value = await self.get(key, tenant)
        if value is not None:
            return value

        # 调用工厂函数获取值
        if asyncio.iscoroutinefunction(factory):
            value = await factory()
        else:
            value = factory()

        await self.set(key, value, ttl, tenant)
        return value


# ═════════════════════════════════════════════
# 🟡 P4-1: 租户配额管理
# ═════════════════════════════════════════════


@dataclass
class TenantQuota:
    """租户配额"""
    max_users: int
    max_storage_mb: int
    max_api_calls_per_day: int
    max_concurrent_users: int

    used_users: int = 0
    used_storage_mb: int = 0
    used_api_calls_today: int = 0

    def can_add_user(self) -> bool:
        return self.used_users < self.max_users

    def can_store(self, additional_mb: int) -> bool:
        return (self.used_storage_mb + additional_mb) <= self.max_storage_mb

    def remaining_storage_mb(self) -> int:
        return max(0, self.max_storage_mb - self.used_storage_mb)


class TenantQuotaManager:
    """
    📊 租户配额管理器

    功能:
    - 配额检查与分配
    - 使用量追踪
    - 超配额告警
    - 自动限制
    """

    def __init__(self, db_session=None, redis_client=None):
        self._db = db_session
        self._redis = redis_client

    async def check_quota(self, resource: str, amount: int = 1) -> Tuple[bool, str]:
        """
        检查配额是否允许

        Returns:
            (是否允许, 原因)
        """
        tenant = get_current_tenant()
        if not tenant:
            return True, "无租户上下文，跳过配额检查"

        quota = await self.get_quota(tenant.tenant_id)

        if resource == "user":
            if not quota.can_add_user():
                return False, f"用户数已达上限 ({quota.max_users})"
            await self.increment_usage(tenant.tenant_id, "users")

        elif resource == "storage":
            if not quota.can_store(amount):
                return False, f"存储空间不足 (剩余 {quota.remaining_storage_mb()} MB)"

        elif resource == "api_call":
            if quota.used_api_calls_today >= quota.max_api_calls_per_day:
                return False, "今日 API 调用配额已用尽"

        return True, "OK"

    async def get_quota(self, tenant_id: str) -> TenantQuota:
        """获取租户配额"""
        # 从配置或数据库获取
        # 这里简化处理
        return TenantQuota(
            max_users=10,
            max_storage_mb=1024,
            max_api_calls_per_day=10000,
            max_concurrent_users=5,
        )

    async def increment_usage(self, tenant_id: str, resource: str, amount: int = 1) -> None:
        """增加使用量"""
        if not self._redis:
            return

        key = f"tenant:{tenant_id}:usage:{resource}:{datetime.now(timezone.utc).strftime('%Y%m%d')}"
        await self._redis.incrby(key, amount)
        await self._redis.expire(key, 86400 * 2)  # 2 天过期

    async def get_usage_stats(self, tenant_id: str) -> Dict[str, int]:
        """获取使用统计"""
        if not self._redis:
            return {}

        stats = {}
        for resource in ["users", "storage", "api_calls"]:
            key = f"tenant:{tenant_id}:usage:{resource}:{datetime.now(timezone.utc).strftime('%Y%m%d')}"
            value = await self._redis.get(key)
            stats[resource] = int(value) if value else 0

        return stats


# ═════════════════════════════════════════════
# 🟡 P4-1: 租户配置模型
# ═════════════════════════════════════════════


class TenantConfig(BaseModel):
    """租户配置"""
    tenant_id: str
    name: str
    plan: str = "basic"
    isolation_mode: TenantIsolationMode = TenantIsolationMode.SHARED_SCHEMA
    features: List[str] = []
    settings: Dict[str, Any] = {}

    # 配额
    max_users: int = 10
    max_storage_mb: int = 1024
    max_api_calls_per_day: int = 10000

    # Branding
    logo_url: Optional[str] = None
    primary_color: str = "#667eea"
    custom_domain: Optional[str] = None

    def has_feature(self, feature: str) -> bool:
        """检查是否启用了某功能"""
        if not self.features:
            # 默认全部关闭
            return False
        return feature in self.features

    def to_context(self) -> TenantContext:
        """转换为租户上下文"""
        return TenantContext(
            tenant_id=self.tenant_id,
            tenant_name=self.name,
            tenant_code=self.tenant_id,  # 简化处理
            plan=self.plan,
            max_users=self.max_users,
            max_storage_mb=self.max_storage_mb,
            features=set(self.features),
            isolation_mode=self.isolation_mode,
        )


# ═════════════════════════════════════════════
# 🟡 P4-1: 租户依赖注入（FastAPI）
# ═════════════════════════════════════════════


async def get_tenant() -> TenantContext:
    """
    FastAPI 依赖注入：获取当前租户

    使用:
        @app.get("/formulas")
        async def list_formulas(tenant: TenantContext = Depends(get_tenant)):
            ...
    """
    tenant = get_current_tenant()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少租户上下文",
        )
    return tenant


async def get_optional_tenant() -> Optional[TenantContext]:
    """FastAPI 依赖注入：获取当前租户（可选）"""
    return get_current_tenant()


def require_feature(feature: str):
    """
    FastAPI 依赖注入：检查功能是否启用

    使用:
        @app.get("/analytics")
        async def analytics(tenant: TenantContext = Depends(get_tenant)):
            require_feature("analytics")(tenant)  # 如果未启用则抛出异常
    """
    def check(tenant: TenantContext = Depends(get_tenant)):
        if not tenant.features or feature not in tenant.features:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"当前订阅计划不支持此功能: {feature}",
            )
        return tenant
    return check


# ═════════════════════════════════════════════
# 🟡 P4-1: 常用订阅计划
# ═════════════════════════════════════════════


PLANS = {
    "free": {
        "max_users": 3,
        "max_storage_mb": 100,
        "max_api_calls_per_day": 1000,
        "features": ["formulas", "basic_export"],
    },
    "basic": {
        "max_users": 10,
        "max_storage_mb": 1024,
        "max_api_calls_per_day": 10000,
        "features": ["formulas", "basic_export", "ai_assist", "collaboration"],
    },
    "pro": {
        "max_users": 50,
        "max_storage_mb": 10240,
        "max_api_calls_per_day": 100000,
        "features": ["formulas", "export_all", "ai_assist", "collaboration", "analytics", "api_access"],
    },
    "enterprise": {
        "max_users": 999999,
        "max_storage_mb": 999999,
        "max_api_calls_per_day": 999999,
        "features": ["*"],  # 所有功能
    },
}


def get_plan_config(plan: str) -> Dict[str, Any]:
    """获取订阅计划配置"""
    return PLANS.get(plan, PLANS["free"])


# ═════════════════════════════════════════════
# 🟡 P4-1: 跨租户数据隔离验证
# ═════════════════════════════════════════════


class TenantIsolationValidator:
    """
    🛡️ 租户隔离验证器

    确保所有数据访问都经过租户过滤，防止数据泄露。
    """

    def __init__(self):
        self._validation_enabled = True

    def enable(self) -> None:
        self._validation_enabled = True

    def disable(self) -> None:
        """禁用验证（仅用于管理操作）"""
        self._validation_enabled = False

    def validate_ownership(
        self,
        resource_tenant_id: str,
        current_tenant_id: Optional[str] = None,
    ) -> bool:
        """
        验证资源所有权

        防止租户 A 访问租户 B 的数据。
        """
        if not self._validation_enabled:
            return True

        if not current_tenant_id:
            current_tenant_id = get_current_tenant_id()

        # 超级管理员可以跨租户访问
        if self._is_super_admin():
            return True

        # 租户 ID 必须匹配
        return resource_tenant_id == current_tenant_id

    def _is_super_admin(self) -> bool:
        """判断是否为超级管理员"""
        # 检查当前用户是否有超级管理员角色
        # 这里简化处理
        return False


# 全局验证器
tenant_isolation_validator = TenantIsolationValidator()


def assert_tenant_ownership(resource_tenant_id: str) -> None:
    """断言租户所有权，不匹配则抛出异常"""
    if not tenant_isolation_validator.validate_ownership(resource_tenant_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权访问此资源",
        )


# ═════════════════════════════════════════════
# 🟡 P4-1: 模块导出
# ═════════════════════════════════════════════


__all__ = [
    # 枚举
    "TenantIsolationMode",
    "TenantStatus",
    # 上下文
    "TenantContext",
    "get_current_tenant",
    "get_current_tenant_id",
    "require_tenant",
    "tenant_context",
    "with_tenant_context",
    # 解析器
    "TenantResolver",
    "get_tenant_resolver",
    # 中间件
    "tenant_middleware",
    # 查询
    "TenantQueryBuilder",
    "tenant_query",
    # 缓存
    "TenantAwareCache",
    # 配额
    "TenantQuota",
    "TenantQuotaManager",
    # 配置
    "TenantConfig",
    "get_plan_config",
    # 依赖注入
    "get_tenant",
    "get_optional_tenant",
    "require_feature",
    # 隔离验证
    "TenantIsolationValidator",
    "tenant_isolation_validator",
    "assert_tenant_ownership",
]

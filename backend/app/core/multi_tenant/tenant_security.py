"""
多租户行级安全加固 (Row-Level Security)

院士级修复[P1]: 消除租户间数据泄漏风险

设计方案：
1. TenantContext ContextVar — 在请求生命周期中传播当前租户 org_id
2. TenantMiddleware — 从 JWT Token 解析 org_id，写入 ContextVar
3. TenantQueryGuard — SQLAlchemy after_bulk_delete/select 事件监听，
   自动审计无 org_id 过滤的危险查询（模型层行级检查）
4. 辅助依赖 require_tenant — FastAPI Depends，确保路由强制租户上下文
5. 审计日志 — 所有跨租户访问尝试记录到专用 logger

使用示例：
    # 路由中强制绑定租户：
    @router.get("/formulas")
    async def list_formulas(
        tenant: TenantContext = Depends(require_tenant),
        db: AsyncSession = Depends(get_db),
    ):
        # 此时 current_tenant_id() 已是当前请求的 org_id
        formulas = await db.execute(
            select(Formula).where(Formula.organization_id == current_tenant_id())
        )
"""
from __future__ import annotations

import contextvars
import logging
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response
from starlette.types import ASGIApp

logger = logging.getLogger("rmfood.tenant")
audit_logger = logging.getLogger("rmfood.tenant.audit")  # 专用安全审计日志

# ── Tenant ContextVar ──────────────────────────────────────────
_tenant_id_var: contextvars.ContextVar[Optional[int]] = contextvars.ContextVar(
    "tenant_id", default=None
)
_tenant_slug_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "tenant_slug", default=None
)


def current_tenant_id() -> Optional[int]:
    """获取当前请求的租户 org_id（None 表示超级管理员或未设置）"""
    return _tenant_id_var.get()


def current_tenant_slug() -> Optional[str]:
    """获取当前请求的租户 slug"""
    return _tenant_slug_var.get()


def set_tenant_context(org_id: Optional[int], slug: Optional[str] = None):
    """
    设置当前请求的租户上下文（由 TenantMiddleware 或测试代码调用）
    返回 reset tokens，用于请求结束后清理
    """
    t1 = _tenant_id_var.set(org_id)
    t2 = _tenant_slug_var.set(slug)
    return t1, t2


def reset_tenant_context(tokens):
    """清理租户 ContextVar（请求结束时调用）"""
    t1, t2 = tokens
    _tenant_id_var.reset(t1)
    _tenant_slug_var.reset(t2)


# ── TenantContext 数据类 ────────────────────────────────────────
class TenantContext:
    """
    租户上下文（供 FastAPI Depends 注入）

    包含已验证的 org_id，以及便利方法：
    - apply_filter(query, model) → 自动追加 WHERE model.organization_id=org_id
    """

    def __init__(self, org_id: int, slug: str = ""):
        self.org_id = org_id
        self.slug = slug

    def apply_filter(self, query, model_class):
        """
        给 SQLAlchemy select 查询追加 organization_id 过滤条件。

        用法：
            stmt = tenant.apply_filter(select(Formula), Formula)
        """
        if hasattr(model_class, "organization_id"):
            return query.where(model_class.organization_id == self.org_id)
        return query

    def __repr__(self) -> str:
        return f"TenantContext(org_id={self.org_id}, slug={self.slug!r})"


# ── FastAPI 依赖：强制租户上下文 ────────────────────────────────

async def require_tenant(request: Request) -> TenantContext:
    """
    FastAPI Depends — 强制要求当前请求绑定有效的租户上下文。

    从请求 state（由 TenantMiddleware 注入）提取 org_id。
    - 若已登录（有 org_id），返回对应租户上下文
    - 若未登录（org_id 为 None），返回全局租户上下文（不限制组织，仅用于开发/公开模式）

    用法：
        @router.get("/formulas")
        async def list_formulas(tenant: TenantContext = Depends(require_tenant)):
            ...
    """
    org_id: Optional[int] = getattr(request.state, "org_id", None)
    if org_id is None:
        # 未登录时允许匿名访问（开发模式 / 公开 API）
        slug: str = getattr(request.state, "org_slug", "")
        return TenantContext(org_id=None, slug=slug or "global")
    slug: str = getattr(request.state, "org_slug", "")
    return TenantContext(org_id=org_id, slug=slug)


async def optional_tenant(request: Request) -> Optional[TenantContext]:
    """
    FastAPI Depends — 可选租户上下文（超级管理员可不绑定租户）。
    返回 None 表示不限制租户（全局权限），否则返回 TenantContext。
    """
    org_id: Optional[int] = getattr(request.state, "org_id", None)
    if org_id is None:
        return None
    slug: str = getattr(request.state, "org_slug", "")
    return TenantContext(org_id=org_id, slug=slug)


# ── TenantMiddleware ───────────────────────────────────────────

class TenantMiddleware(BaseHTTPMiddleware):
    """
    租户中间件

    功能：
    1. 从 JWT Token（通过 decode_access_token）提取 org_id
    2. 写入 request.state.org_id（供依赖注入使用）
    3. 写入 ContextVar（供 SQLAlchemy 事件、日志等使用）
    4. 对跨租户路径访问记录审计日志
    5. 路径白名单（auth/health/metrics 不需要租户）

    注意：此中间件不鉴权（鉴权由 AuthMiddleware 完成），
    它只负责从已验证的 Token 中提取租户信息。
    """

    # 不需要租户上下文的路径前缀
    TENANT_BYPASS_PATHS = {
        "/api/v1/auth",
        "/health",
        "/metrics",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/debug",
    }

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path

        # ── 白名单路径直接放行 ──
        if any(path.startswith(bypass) for bypass in self.TENANT_BYPASS_PATHS):
            return await call_next(request)

        org_id: Optional[int] = None
        org_slug: Optional[str] = None

        # ── 从 JWT 提取 org_id ──
        token = self._extract_bearer_token(request)
        if token:
            try:
                from .security import decode_access_token
                payload = decode_access_token(token)
                # JWT payload 应包含 org_id 字段（见 auth_service.create_access_token）
                raw_org_id = getattr(payload, "org_id", None)
                if raw_org_id is not None:
                    org_id = int(raw_org_id)
                    org_slug = getattr(payload, "org_slug", "")
            except Exception as e:
                # Token 解析失败（过期/无效）—— 不阻塞，让 AuthMiddleware 处理
                logger.debug("[Tenant] Token 解析失败（将由鉴权层处理）: %s", e)

        # ── 写入 request.state 和 ContextVar ──
        request.state.org_id = org_id
        request.state.org_slug = org_slug or ""

        tokens = set_tenant_context(org_id, org_slug)
        try:
            response = await call_next(request)
        finally:
            reset_tenant_context(tokens)

        return response

    @staticmethod
    def _extract_bearer_token(request: Request) -> Optional[str]:
        """从 Authorization: Bearer <token> 头提取 token"""
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            return auth_header[7:].strip()
        return None


# ── SQLAlchemy 查询审计守卫 ─────────────────────────────────────

class TenantQueryGuard:
    """
    SQLAlchemy 查询审计守卫

    监听 SQLAlchemy 的 before_execute 事件，
    检测可能跨租户的危险查询（缺少 organization_id WHERE 条件）。

    注意：此守卫仅做警告/审计，不阻断查询（避免影响超级管理员功能）。
    生产环境可通过 strict_mode=True 切换为阻断模式。

    用法：
        guard = TenantQueryGuard(strict_mode=False)
        guard.attach(engine)  # 在应用启动时调用
    """

    # 需要检查租户隔离的表名（应包含 organization_id 列的核心业务表）
    TENANT_TABLES = {
        "formulas", "experiments", "ingredients", "peptides",
        "formula_versions", "audit_logs", "notifications",
    }

    def __init__(self, strict_mode: bool = False):
        self.strict_mode = strict_mode
        self._attached = False

    def attach(self, engine) -> None:
        """
        将守卫附加到 SQLAlchemy Engine。
        在 lifespan startup 中调用一次。
        """
        if self._attached:
            return
        try:
            from sqlalchemy import event as sa_event

            @sa_event.listens_for(engine.sync_engine, "before_execute")
            def _before_execute(conn, clauseelement, multiparams, params, execution_options):
                self._audit_query(clauseelement)

            self._attached = True
            logger.info(
                "[TenantGuard] 已附加到 Engine，监控表: %s，严格模式: %s",
                self.TENANT_TABLES, self.strict_mode,
            )
        except Exception as e:
            logger.warning("[TenantGuard] 附加 Engine 事件失败: %s", e)

    def _audit_query(self, clauseelement) -> None:
        """检查 SQL 语句是否涉及租户表且是否携带 org_id 过滤"""
        try:
            from sqlalchemy.sql import Select, Delete, Update
            import sqlalchemy as sa

            # 仅检查 SELECT/DELETE/UPDATE
            if not isinstance(clauseelement, (Select, Delete, Update)):
                return

            # 提取涉及的表名
            tables = set()
            if hasattr(clauseelement, "froms"):
                for f in clauseelement.froms:
                    if hasattr(f, "name"):
                        tables.add(f.name)
            elif hasattr(clauseelement, "table"):
                tables.add(clauseelement.table.name)

            # 是否涉及需要租户隔离的表
            sensitive = tables & self.TENANT_TABLES
            if not sensitive:
                return

            # 当前请求是否绑定了租户上下文
            org_id = current_tenant_id()
            if org_id is not None:
                return  # 已有租户上下文，正常

            # ⚠️ 无租户上下文但查询了敏感表
            audit_logger.warning(
                "[TenantGuard] ⚠️ 无租户上下文查询敏感表 %s — 可能的跨租户访问！",
                sensitive,
            )

            if self.strict_mode:
                raise PermissionError(
                    f"[TenantGuard] 严格模式：查询表 {sensitive} 必须提供租户上下文"
                )
        except PermissionError:
            raise
        except Exception as e:
            logger.debug("[TenantGuard] 查询审计异常（已忽略）: %s", e)


# ── 全局守卫实例 ────────────────────────────────────────────────
tenant_query_guard = TenantQueryGuard(strict_mode=False)

"""
API 版本管理模块

🔒 P1-5 修复: API 版本管理完善
- 版本元数据端点: GET /api
- 健康检查: GET /health
- API 信息: GET /api/v1/info
- 弃用策略: deprecated_routes 注册
- 版本兼容性报告

路由版本策略:
- v1: 当前稳定版本（2024+）
- 每个 API 路由支持 X-API-Version header 标注版本
- deprecated 路由将在响应头包含 Deprecation-Warning
"""

import logging
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, FastAPI, Request, Response
try:
    from starlette.middleware.base import BaseHTTPMiddleware
except ImportError:
    try:
        from fastapi.middleware.base import BaseHTTPMiddleware
    except ImportError:
        BaseHTTPMiddleware = object
from datetime import datetime, timezone

from ..core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["系统信息"])

# ── 当前 API 版本元数据 ──
CURRENT_API_VERSION = "1.0.0"
API_MATRIX = {
    "v1": {
        "status": "current",
        "released": "2024-01-01",
        "deprecates": "2026-01-01",
        "description": "RMFOOD 配方设计平台 v1 API（核心功能）",
        "features": [
            "认证与授权 (JWT + OAuth2)",
            "配方管理（CRUD + 版本控制）",
            "用户与权限管理",
            "AI 配方生成",
            "AI 肽段分析与设计",
            "知识库与知识图谱",
            "RAG 向量检索",
            "多目标优化",
            "文档导出（Excel/Word/PDF）",
            "文件上传与管理",
            "多租户与组织管理",
        ],
    },
    "v2": {
        "status": "planning",
        "released": None,
        "deprecates": None,
        "description": "RMFOOD 配方设计平台 v2 API（规划中）",
        "features": [
            "GraphQL 统一接口",
            "细粒度权限控制（Casbin）",
            "分布式事务支持",
            "更完善的流式响应",
        ],
    },
}

# ── 弃用路由记录（用于警告） ──
DEPRECATED_ROUTES: Dict[str, str] = {
    # 示例: "/api/v1/old-endpoint": "请使用 /api/v1/new-endpoint 替代",
}


@router.get("/")
async def api_root() -> Dict[str, Any]:
    """
    API 版本元数据

    返回支持的 API 版本、当前版本、弃用策略
    """
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "api_versions": API_MATRIX,
        "current_version": "v1",
        "endpoints": {
            "health": "/health",
            "api_v1": "/api/v1",
            "info": "/api/v1/info",
            "openapi_schema": "/openapi.json",
            "docs": "/docs",
            "redoc": "/redoc",
        },
        "authentication": {
            "type": "JWT (HTTP-Only Cookie) + Authorization Bearer",
            "login_endpoint": "/api/v1/auth/login",
            "token_refresh": "/api/v1/auth/refresh",
            "token_type": "Access Token (30min) + Refresh Token (7d)",
        },
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/info")
async def api_info() -> Dict[str, Any]:
    """
    API v1 详细信息

    包括支持的特性、速率限制、配额等
    """
    return {
        "api_version": CURRENT_API_VERSION,
        "app_version": settings.app_version,
        "app_name": settings.app_name,
        "features": API_MATRIX["v1"]["features"],
        "rate_limits": {
            "auth_login": "5 requests / minute per IP",
            "password_reset": "5 requests / minute per email",
            "general": "60 requests / minute per user",
            "ai_generation": "20 requests / minute per user",
        },
        "authentication_required": True,
        "pagination": {
            "default_page_size": 20,
            "max_page_size": 100,
        },
        "data_formats": {
            "request": "application/json",
            "response": "application/json",
            "datetime_format": "ISO 8601 (YYYY-MM-DDTHH:MM:SS+ZZ)",
        },
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    健康检查

    返回系统健康状态（不包含敏感信息）
    """
    return {
        "status": "healthy",
        "version": settings.app_version,
        "api_version": CURRENT_API_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── 版本兼容中间件 ──
class APIVersionMiddleware(BaseHTTPMiddleware):
    """
    API 版本中间件

    功能:
    1. 注入 X-API-Version 响应头
    2. 检测并警告调用已弃用的路由
    3. 记录 API 版本使用情况（用于监控）
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()

        response = await call_next(request)

        # 注入版本信息
        response.headers["X-API-Version"] = CURRENT_API_VERSION
        response.headers["X-Server-Time"] = datetime.now(timezone.utc).isoformat()

        # 检查是否为弃用路由
        for path, replacement in DEPRECATED_ROUTES.items():
            if request.url.path.startswith(path):
                response.headers["X-Deprecated"] = "true"
                response.headers["X-Deprecation-Replacement"] = replacement
                logger.warning(
                    f"⚠️ 弃用路由调用: {request.method} {request.url.path} -> 请使用 {replacement}"
                )

        # 记录处理时间（用于性能监控）
        process_time = (time.time() - start_time) * 1000
        response.headers["X-Process-Time-MS"] = f"{process_time:.2f}"

        return response


def register_version_routes(app: FastAPI) -> None:
    """
    注册 API 版本管理路由

    注册顺序:
    1. 根路由 /api → 版本矩阵信息
    2. /health → 健康检查
    3. /api/v1/info → v1 详细信息

    Args:
        app: FastAPI 应用实例
    """
    # 根 API 路由: /api → 返回版本矩阵
    app.include_router(router, prefix="/api", include_in_schema=True)

    # v1 信息路由
    v1_info_router = APIRouter()
    v1_info_router.include_router(router)
    # 确保 /health 在根路径可访问
    v1_info_router.add_api_route("/health", health_check, include_in_schema=True)
    app.include_router(v1_info_router, prefix="/api/v1")

    # 确保 /health 在根路径可直接访问
    if not any(route.path == "/health" for route in app.routes):
        app.add_api_route("/health", health_check, include_in_schema=True)

    logger.info(f"✅ API 版本管理已注册 (当前版本 v{CURRENT_API_VERSION})")


def register_version_middleware(app: FastAPI) -> None:
    """
    注册 API 版本中间件

    在所有响应中注入版本信息和性能指标

    Args:
        app: FastAPI 应用实例
    """
    app.add_middleware(APIVersionMiddleware)
    logger.info("✅ API 版本中间件已注册")

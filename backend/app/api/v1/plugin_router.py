"""
插件管理 API

提供插件列表、健康检查、开关控制等接口。
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.core.api_framework.integration_framework import get_api_key_service
from app.services.plugin_registry import PluginType, get_plugin_registry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/plugins", tags=["插件管理"])


@router.get("", summary="列出所有插件")
async def list_plugins(plugin_type: Optional[str] = None):
    """返回所有已注册插件列表"""
    registry = get_plugin_registry()
    plugins = registry.list_all()
    if plugin_type:
        plugins = [p for p in plugins if p.plugin_type.value == plugin_type]

    return {
        "success": True,
        "count": len(plugins),
        "plugins": [
            {
                "plugin_id": p.plugin_id,
                "name": p.plugin_name,
                "type": p.plugin_type.value,
                "version": p.version,
                "description": p.description,
                "dependencies": p.dependencies,
                "capabilities": p.capabilities,
            }
            for p in plugins
        ],
    }


@router.get("/health", summary="插件健康检查")
async def plugin_health():
    """聚合所有插件的健康状态"""
    registry = get_plugin_registry()
    return {"success": True, "data": registry.health_check()}


@router.get("/types", summary="列出插件类型")
async def list_plugin_types():
    """返回支持的插件类型"""
    return {
        "success": True,
        "types": [
            {"value": t.value, "name": t.name}
            for t in PluginType
        ],
    }


# ════════════════════════════════════════════
# API Key 管理端点
# ════════════════════════════════════════════


@router.post("/api-keys", summary="创建 API Key")
async def create_api_key(
    name: str,
    user_id: int,
    organization_id: Optional[int] = None,
    permissions: list = [],
    db: AsyncSession = Depends(get_db_session),
):
    """创建新的 API Key（明文仅返回一次）。

    统一使用 DB 持久化的 APIKeyService（与 /integrations/api-keys 同源），
    不再使用内存版 api_key_manager。permissions 映射为 scopes。
    """
    svc = get_api_key_service(db)
    api_key, plain_key = await svc.create_api_key(
        name=name,
        scopes=permissions,
        owner_id=user_id,
        org_id=organization_id,
    )
    return {
        "success": True,
        "data": {
            "id": api_key.id,
            "name": api_key.name,
            "key_prefix": api_key.key_prefix,
            "key": plain_key,
            "scopes": api_key.scopes,
            "expires_at": api_key.expires_at.isoformat() if api_key.expires_at else None,
            "created_at": api_key.created_at.isoformat(),
            "warning": "⚠️ 请立即保存此密钥，它将不会再次显示！",
        },
    }


@router.get("/api-keys", summary="列出 API Keys")
async def list_api_keys(
    user_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db_session),
):
    """列出 API Keys（不含明文），统一为 DB 持久化来源。"""
    svc = get_api_key_service(db)
    if user_id is None:
        # 未指定 user_id 时返回该服务可管理的汇总占位（保持接口向后兼容）
        return {"success": True, "data": {"keys": [], "stats": {"total": 0}}}
    keys = await svc.list_keys(user_id)
    return {
        "success": True,
        "data": {
            "keys": keys,
            "stats": {"total": len(keys), "active": sum(1 for k in keys if k.get("is_active"))},
        },
    }


@router.delete("/api-keys/{key_id}", summary="吊销 API Key")
async def revoke_api_key(
    key_id: str,
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """吊销指定 API Key（DB 持久化）。user_id 必填以限定所有者。"""
    svc = get_api_key_service(db)
    ok = await svc.revoke_key(key_id, user_id)
    if not ok:
        raise HTTPException(404, detail="API Key 不存在")
    return {"success": True, "message": f"已吊销: {key_id}"}


@router.get("/api-keys/stats", summary="API Key 统计")
async def api_key_stats(
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """API Key 统计（DB 持久化来源）。"""
    svc = get_api_key_service(db)
    keys = await svc.list_keys(user_id)
    return {
        "success": True,
        "data": {
            "total": len(keys),
            "active": sum(1 for k in keys if k.get("is_active")),
            "revoked": sum(1 for k in keys if not k.get("is_active")),
        },
    }


# ════════════════════════════════════════════
# 开发者文档端点
# ════════════════════════════════════════════


@router.get("/sdk/meta", summary="SDK 元数据")
async def sdk_metadata():
    """返回 SDK 可用信息和元数据"""
    registry = get_plugin_registry()
    plugins = registry.list_all()
    return {
        "success": True,
        "sdk_version": "1.0.0",
        "plugin_count": len(plugins),
        "plugin_types": [p.plugin_type.value for p in plugins],
        "base_url": "/api/v1",
        "authentication": "Bearer Token 或 API Key",
    }


@router.get("/openapi", summary="开放 API Schema")
async def openapi_schema():
    """返回可被外部消费的 API Schema 摘要"""
    registry = get_plugin_registry()
    plugins = registry.list_all()
    endpoints = []
    for p in plugins:
        endpoints.append({
            "plugin": p.plugin_id,
            "type": p.plugin_type.value,
            "capabilities": p.capabilities,
        })
    return {
        "success": True,
        "version": "v1",
        "endpoints": endpoints,
        "docs_url": "/docs",
    }

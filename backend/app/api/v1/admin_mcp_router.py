"""
MCP 服务器管理 API（v3.3）

端点：
- GET    /api/v1/admin/mcp-servers          列表
- POST   /api/v1/admin/mcp-servers          新增配置
- PUT    /api/v1/admin/mcp-servers/{id}    更新配置
- DELETE /api/v1/admin/mcp-servers/{id}    删除配置
- POST   /api/v1/admin/mcp-servers/{id}/test  测试连接并列出工具
"""
from __future__ import annotations

import json
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.ai.agent.mcp_bridge import McpBridge
from app.services.llm_service import _get_encryption_key
from app.utils.encryption import EncryptionUtils

from ...core.multi_tenant.tenant_security import TenantContext, require_tenant
from ...models import User
from ...models.mcp_server import McpServerConfig
from ..deps import get_current_active_user, get_db_session

router = APIRouter(prefix="/admin/mcp-servers", tags=["MCP 服务器管理"])


class McpServerCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=64)
    transport: str = Field("http", pattern="^(http|sse|stdio)$")
    url: Optional[str] = Field(None, max_length=512, description="HTTP/SSE 端点 URL；stdio 可不填")
    headers: dict[str, Any] = Field(default_factory=dict)
    auth_token: Optional[str] = Field(None, max_length=2000, description="认证 Token（可选）")
    enabled: bool = True
    allow_tools: list[str] = Field(default_factory=list)
    visibility: str = Field("org", pattern="^(org|private)$")


class McpServerUpdateRequest(BaseModel):
    url: Optional[str] = Field(None, max_length=512)
    headers: Optional[dict[str, Any]] = None
    auth_token: Optional[str] = Field(None, max_length=2000)
    enabled: Optional[bool] = None
    allow_tools: Optional[list[str]] = None
    visibility: Optional[str] = Field(None, pattern="^(org|private)$")


def _encrypt_token(token: str) -> str | None:
    if not token:
        return None
    import base64
    key = _get_encryption_key()
    encrypted = EncryptionUtils.encrypt(token.encode("utf-8"), key)
    # 存储为 {v: base64密文, n: base64 nonce}
    return json.dumps({
        "v": base64.b64encode(encrypted[0]).decode("ascii"),
        "n": base64.b64encode(encrypted[1]).decode("ascii"),
    })


@router.get("", summary="MCP 服务器列表")
async def list_mcp_servers(
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    tenant_id = tenant.org_id or 1
    rows = (await db.execute(
        select(McpServerConfig).where(McpServerConfig.tenant_id == tenant_id).order_by(McpServerConfig.id)
    )).scalars().all()
    return {"success": True, "items": [r.to_dict() for r in rows]}


@router.post("", summary="新增 MCP 服务器")
async def create_mcp_server(
    req: McpServerCreateRequest,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    tenant_id = tenant.org_id or 1
    # 同名去重
    exists = (await db.execute(
        select(McpServerConfig).where(
            McpServerConfig.tenant_id == tenant_id, McpServerConfig.name == req.name,
        )
    )).scalar_one_or_none()
    if exists is not None:
        raise HTTPException(status_code=400, detail="同名 MCP 服务器已存在")
    cfg = McpServerConfig(
        tenant_id=tenant_id,
        name=req.name,
        transport=req.transport,
        url=req.url,
        headers=req.headers or {},
        auth_token_encrypted=_encrypt_token(req.auth_token or ""),
        enabled=req.enabled,
        allow_tools=req.allow_tools or [],
        visibility=req.visibility,
        created_by=user.id,
    )
    db.add(cfg)
    await db.commit()
    await db.refresh(cfg)
    return {"success": True, "data": cfg.to_dict()}


@router.put("/{server_id}", summary="更新 MCP 服务器")
async def update_mcp_server(
    server_id: int,
    req: McpServerUpdateRequest,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    tenant_id = tenant.org_id or 1
    cfg = (await db.execute(
        select(McpServerConfig).where(
            McpServerConfig.id == server_id, McpServerConfig.tenant_id == tenant_id,
        )
    )).scalar_one_or_none()
    if cfg is None:
        raise HTTPException(status_code=404, detail="MCP 服务器不存在")
    if req.url is not None:
        cfg.url = req.url
    if req.headers is not None:
        cfg.headers = req.headers
    if req.auth_token is not None:
        cfg.auth_token_encrypted = _encrypt_token(req.auth_token)
    if req.enabled is not None:
        cfg.enabled = req.enabled
    if req.allow_tools is not None:
        cfg.allow_tools = req.allow_tools
    if req.visibility is not None:
        cfg.visibility = req.visibility
    await db.commit()
    await db.refresh(cfg)
    return {"success": True, "data": cfg.to_dict()}


@router.delete("/{server_id}", summary="删除 MCP 服务器")
async def delete_mcp_server(
    server_id: int,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    tenant_id = tenant.org_id or 1
    cfg = (await db.execute(
        select(McpServerConfig).where(
            McpServerConfig.id == server_id, McpServerConfig.tenant_id == tenant_id,
        )
    )).scalar_one_or_none()
    if cfg is None:
        raise HTTPException(status_code=404, detail="MCP 服务器不存在")
    await db.delete(cfg)
    await db.commit()
    return {"success": True}


@router.post("/{server_id}/test", summary="测试连接并列出工具")
async def test_mcp_server(
    server_id: int,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    tenant_id = tenant.org_id or 1
    cfg = (await db.execute(
        select(McpServerConfig).where(
            McpServerConfig.id == server_id, McpServerConfig.tenant_id == tenant_id,
        )
    )).scalar_one_or_none()
    if cfg is None:
        raise HTTPException(status_code=404, detail="MCP 服务器不存在")
    bridge = McpBridge()
    try:
        tools = await bridge._list_tools_remote(cfg)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"连接失败：{str(e)[:300]}")
    return {"success": True, "tool_count": len(tools), "tools": [t["name"] for t in tools]}

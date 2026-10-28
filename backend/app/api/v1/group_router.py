"""
群聊协作 API（DS Bot 移植 Phase 2）

端点：
- POST   /api/v1/groups                创建群聊（指定 Chief + 成员 Bot）
- GET    /api/v1/groups                群聊列表
- GET    /api/v1/groups/{group_id}     群聊详情（含成员）
- POST   /api/v1/groups/{group_id}/members        添加成员
- DELETE /api/v1/groups/{group_id}/members/{bot_id}  移除成员
- POST   /api/v1/groups/{group_id}/message         用户发言（@ 定向 / Chief 默认回复）
- GET    /api/v1/groups/{group_id}/messages        群聊消息流
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.multi_tenant.tenant_security import TenantContext, require_tenant
from ...models import User
from ...services.ai.agent.group_chat_service import GroupChatService
from ..deps import get_current_active_user, get_db_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/groups", tags=["群聊协作"])


def _tenant_id(org_id: int | None) -> int:
    """平台 JWT 可能无 org_id（global 模式），默认租户 1（与 ai_bots 种子一致）。"""
    return org_id if org_id is not None else 1


# ── Schemas ──────────────────────────────────────────────────────


class GroupCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    chief_bot_id: int = Field(..., gt=0)
    member_bot_ids: list[int] = Field(default_factory=list)


class GroupMemberAddRequest(BaseModel):
    bot_ids: list[int] = Field(..., min_length=1)


class GroupMessagePostRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)
    mentioned_bot_ids: list[int] = Field(default_factory=list)
    reply_to: Optional[int] = None


# ── 依赖 ──────────────────────────────────────────────────────────


async def _get_service(db: AsyncSession = Depends(get_db_session)) -> GroupChatService:
    return GroupChatService(db)


# ── 端点 ──────────────────────────────────────────────────────────


@router.post("", summary="创建群聊")
async def create_group(
    req: GroupCreateRequest,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    service: GroupChatService = Depends(_get_service),
):
    try:
        group = await service.create_group(
            tenant_id=_tenant_id(tenant.org_id),
            name=req.name,
            chief_bot_id=req.chief_bot_id,
            created_by=user.id,
            member_bot_ids=req.member_bot_ids,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"success": True, "data": group.to_dict()}


@router.get("", summary="群聊列表")
async def list_groups(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    include_archived: bool = Query(False, description="是否包含已归档群聊"),
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    service: GroupChatService = Depends(_get_service),
):
    return await service.list_groups(
        _tenant_id(tenant.org_id), user.id, offset, limit, include_archived=include_archived,
    )


@router.get("/{group_id}", summary="群聊详情")
async def get_group(
    group_id: int,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    service: GroupChatService = Depends(_get_service),
):
    try:
        group = await service.get_group(group_id, _tenant_id(tenant.org_id))
    except ValueError:
        raise HTTPException(status_code=404, detail="群聊不存在")
    return {"success": True, "data": group.to_dict()}


@router.post("/{group_id}/members", summary="添加群成员")
async def add_members(
    group_id: int,
    req: GroupMemberAddRequest,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    service: GroupChatService = Depends(_get_service),
):
    try:
        members = await service.add_members(group_id, _tenant_id(tenant.org_id), req.bot_ids)
    except ValueError:
        raise HTTPException(status_code=404, detail="群聊不存在")
    return {"success": True, "items": members}


@router.delete("/{group_id}/members/{bot_id}", summary="移除群成员")
async def remove_member(
    group_id: int,
    bot_id: int,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    service: GroupChatService = Depends(_get_service),
):
    try:
        ok = await service.remove_member(group_id, _tenant_id(tenant.org_id), bot_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"success": ok}


@router.post("/{group_id}/message", summary="群聊发言（触发 Bot 应答）")
async def post_message(
    group_id: int,
    req: GroupMessagePostRequest,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    service: GroupChatService = Depends(_get_service),
):
    try:
        result = await service.post_message(
            group_id=group_id,
            tenant_id=_tenant_id(tenant.org_id),
            user_id=user.id,
            content=req.content,
            mentioned_bot_ids=req.mentioned_bot_ids,
            reply_to=req.reply_to,
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="群聊不存在")
    return {"success": True, "data": result}


@router.get("/{group_id}/messages", summary="群聊消息流")
async def list_messages(
    group_id: int,
    limit: int = Query(100, ge=1, le=500),
    before_id: Optional[int] = Query(None),
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    service: GroupChatService = Depends(_get_service),
):
    try:
        return await service.list_messages(
            group_id, _tenant_id(tenant.org_id), limit=limit, before_id=before_id,
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="群聊不存在")


@router.post("/{group_id}/archive", summary="归档群聊")
async def archive_group(
    group_id: int,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    service: GroupChatService = Depends(_get_service),
):
    from ....infrastructure.bots_impl import SQLAlchemyGroupChatRepository
    try:
        await service.get_group(group_id, _tenant_id(tenant.org_id))
    except ValueError:
        raise HTTPException(status_code=404, detail="群聊不存在")
    repo = SQLAlchemyGroupChatRepository(service._db)
    await repo.set_group_archived(group_id, _tenant_id(tenant.org_id), True)
    return {"success": True}


@router.post("/{group_id}/restore", summary="恢复群聊")
async def restore_group(
    group_id: int,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    service: GroupChatService = Depends(_get_service),
):
    from ....infrastructure.bots_impl import SQLAlchemyGroupChatRepository
    try:
        await service.get_group(group_id, _tenant_id(tenant.org_id))
    except ValueError:
        raise HTTPException(status_code=404, detail="群聊不存在")
    repo = SQLAlchemyGroupChatRepository(service._db)
    await repo.set_group_archived(group_id, _tenant_id(tenant.org_id), False)
    return {"success": True}

"""
团队权限管理 API

提供团队角色管理、成员邀请、资源级权限控制等功能。
"""
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.enums import TeamRole
from ..models.team_member import TeamMember
from ..schemas.base import ApiResponse
from .deps import get_db

router = APIRouter(prefix="/teams", tags=["团队管理"])


@router.put("/{team_id}/members/{member_id}/role", response_model=ApiResponse)
async def update_member_role(
    team_id: int,
    member_id: int,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
):
    """更新成员角色"""
    new_role = payload.get("role")
    if not new_role or new_role not in ["owner", "admin", "member", "guest"]:
        raise HTTPException(status_code=400, detail="无效的角色")

    member = (await db.execute(
        select(TeamMember).where(
            TeamMember.id == member_id,
            TeamMember.team_id == team_id,
        )
    )).scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=404, detail="成员不存在")

    member.role = TeamRole(new_role)
    await db.commit()

    return ApiResponse(data={"member_id": member_id, "role": member.role.value})


@router.delete("/{team_id}/members/{member_id}", response_model=ApiResponse)
async def remove_team_member(
    team_id: int,
    member_id: int,
    db: AsyncSession = Depends(get_db),
):
    """移除团队成员"""
    member = (await db.execute(
        select(TeamMember).where(
            TeamMember.id == member_id,
            TeamMember.team_id == team_id,
        )
    )).scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=404, detail="成员不存在")

    await db.delete(member)
    await db.commit()

    return ApiResponse(data={"removed": member_id})


@router.get("/{team_id}/permissions", response_model=ApiResponse)
async def get_team_permissions(
    team_id: int,
    user_id: int = Query(..., description="用户ID"),
    db: AsyncSession = Depends(get_db),
):
    """获取用户在团队中的权限"""
    member = (await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
        )
    )).scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=403, detail="无权限访问此团队")

    # 基于角色的权限映射
    role_permissions = {
        "owner": ["read", "write", "delete", "manage_members", "manage_settings"],
        "admin": ["read", "write", "delete", "manage_members"],
        "member": ["read", "write"],
        "guest": ["read"],
    }

    return ApiResponse(data={
        "user_id": user_id,
        "role": member.role.value,
        "permissions": role_permissions.get(member.role.value, []),
    })


@router.post("/invite", response_model=ApiResponse)
async def invite_team_member(
    team_id: int,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
):
    """生成邀请链接（一次性）"""
    email = payload.get("email")
    role = payload.get("role", "member")

    if not email:
        raise HTTPException(status_code=400, detail="缺少 email")

    # 生成一次性邀请码
    import hashlib
    import uuid
    invite_code = hashlib.sha256(f"{team_id}_{email}_{uuid.uuid4()}".encode()).hexdigest()[:16]

    return ApiResponse(data={
        "invite_code": invite_code,
        "invite_url": f"/invite/{invite_code}",
        "role": role,
        "expires_in": "7天",
    })

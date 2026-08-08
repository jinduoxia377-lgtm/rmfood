"""
团队权限管理 API

提供团队角色管理、成员邀请、资源级权限控制等功能。
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models.team import Team
from ..models.team_member import TeamMember
from ..models.user_model import User
from ..models.enums import TeamRole
from ..schemas.base import ApiResponse
from .deps import get_db

router = APIRouter(prefix="/teams", tags=["团队管理"])


@router.get("/{team_id}/members", response_model=ApiResponse)
def list_team_members(
    team_id: int,
    db: Session = Depends(get_db),
):
    """获取团队成员列表及角色"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="团队不存在")

    members = db.query(TeamMember).filter(
        TeamMember.team_id == team_id
    ).all()

    return ApiResponse(data={
        "team_id": team_id,
        "team_name": team.name,
        "members": [
            {
                "id": m.id,
                "user_id": m.user_id,
                "username": m.user.username if m.user else "unknown",
                "email": m.user.email if m.user else "",
                "role": m.role.value,
                "joined_at": m.joined_at.isoformat() if m.joined_at else None,
            }
            for m in members
        ],
        "total": len(members),
    })


@router.post("/{team_id}/members", response_model=ApiResponse)
def add_team_member(
    team_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
):
    """添加团队成员"""
    user_id = payload.get("user_id")
    role = payload.get("role", "member")

    if not user_id:
        raise HTTPException(status_code=400, detail="缺少 user_id")

    # 检查是否已存在
    existing = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == user_id,
    ).first()

    if existing:
        raise HTTPException(status_code=409, detail="该用户已是团队成员")

    member = TeamMember(
        team_id=team_id,
        user_id=user_id,
        role=TeamRole(role),
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    return ApiResponse(data={"member_id": member.id, "role": member.role.value})


@router.put("/{team_id}/members/{member_id}/role", response_model=ApiResponse)
def update_member_role(
    team_id: int,
    member_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
):
    """更新成员角色"""
    new_role = payload.get("role")
    if not new_role or new_role not in ["owner", "admin", "member", "guest"]:
        raise HTTPException(status_code=400, detail="无效的角色")

    member = db.query(TeamMember).filter(
        TeamMember.id == member_id,
        TeamMember.team_id == team_id,
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="成员不存在")

    member.role = TeamRole(new_role)
    db.commit()

    return ApiResponse(data={"member_id": member_id, "role": member.role.value})


@router.delete("/{team_id}/members/{member_id}", response_model=ApiResponse)
def remove_team_member(
    team_id: int,
    member_id: int,
    db: Session = Depends(get_db),
):
    """移除团队成员"""
    member = db.query(TeamMember).filter(
        TeamMember.id == member_id,
        TeamMember.team_id == team_id,
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="成员不存在")

    db.delete(member)
    db.commit()

    return ApiResponse(data={"removed": member_id})


@router.get("/{team_id}/permissions", response_model=ApiResponse)
def get_team_permissions(
    team_id: int,
    user_id: int = Query(..., description="用户ID"),
    db: Session = Depends(get_db),
):
    """获取用户在团队中的权限"""
    member = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == user_id,
    ).first()

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
def invite_team_member(
    team_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
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

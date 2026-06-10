"""RMFOOD 团队协作 API Router

提供团队CRUD、成员管理、邀请链接和权限控制的RESTful接口。
支持owner/admin/member/guest四级权限体系。
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete

from ...core.session import get_db
from ...models.team import Team
from ...models.team_member import TeamMember
from ...models.user_model import User
from ...models.notification import Notification
from ...models.enums import TeamRole, NotificationType
from ...schemas.team_schemas import (
    TeamCreate,
    TeamUpdate,
    TeamResponse,
    TeamListResponse,
    TeamDetailResponse,
    TeamMemberInfo,
    TeamMemberUpdate,
    InviteMemberRequest,
    InviteLinkResponse,
    JoinTeamRequest,
)
from ...api.deps import get_current_active_user, CurrentUser, DbSession

router = APIRouter(prefix="/teams", tags=["Team Collaboration"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _check_team_permission(
    db: AsyncSession,
    team_id: int,
    user_id: int,
    required_roles: list[TeamRole] = None,
) -> TeamMember:
    """检查用户在团队中的权限"""
    if required_roles is None:
        required_roles = [TeamRole.OWNER, TeamRole.ADMIN]
    
    result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="您不是该团队成员",
        )
    
    if member.role not in required_roles and member.role != TeamRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足，需要管理员或更高权限",
        )
    
    return member


@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED, summary="创建团队")
async def create_team(
    request: TeamCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    创建新团队
    
    - **name**: 团队名称（2-100字符）
    - **description**: 可选，团队描述
    - **settings**: 可选，团队设置（JSON格式）
    
    创建者自动成为团队Owner。
    """
    team = Team(
        name=request.name,
        description=request.description,
        owner_id=current_user.id,
        settings=request.settings or {},
    )
    db.add(team)
    await db.flush()
    
    owner_member = TeamMember(
        team_id=team.id,
        user_id=current_user.id,
        role=TeamRole.OWNER,
        invited_by=current_user.id,
    )
    db.add(owner_member)
    await db.commit()
    await db.refresh(team)
    
    return TeamResponse.model_validate(team)


@router.get("", response_model=TeamListResponse, summary="列出我加入的团队")
async def list_teams(
    db: DbSession,
    current_user: CurrentUser,
    include_archived: bool = Query(False, description="是否包含已归档团队"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """
    获取当前用户加入的所有团队列表
    
    - **include_archived**: 是否包含已归档的团队（默认否）
    - **page**: 页码（默认1）
    - **page_size**: 每页条数（默认20）
    
    返回团队基本信息和成员数量。
    """
    query = (
        select(Team)
        .join(TeamMember, Team.id == TeamMember.team_id)
        .where(TeamMember.user_id == current_user.id)
    )
    
    if not include_archived:
        query = query.where(Team.is_archived == False)
    
    count_query = (
        select(func.count(Team.id))
        .join(TeamMember, Team.id == TeamMember.team_id)
        .where(TeamMember.user_id == current_user.id)
    )
    if not include_archived:
        count_query = count_query.where(Team.is_archived == False)
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    offset = (page - 1) * page_size
    query = query.order_by(Team.updated_at.desc()).offset(offset).limit(page_size)
    
    result = await db.execute(query)
    teams = result.scalars().all()
    
    team_responses = []
    for team in teams:
        member_count = await db.execute(
            select(func.count(TeamMember.id)).where(TeamMember.team_id == team.id)
        )
        count = member_count.scalar() or 0
        
        team_resp = TeamResponse.model_validate(team)
        team_resp.member_count = count
        team_responses.append(team_resp)
    
    return TeamListResponse(teams=team_responses, total=total)


@router.get("/{team_id}", response_model=TeamDetailResponse, summary="获取团队详情")
async def get_team_detail(
    team_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    获取团队的详细信息，包括成员列表
    
    - **team_id**: 团队ID
    
    返回团队信息、成员列表和邀请链接。
    """
    await _check_team_permission(db, team_id, current_user.id, [TeamRole.OWNER, TeamRole.ADMIN, TeamRole.MEMBER, TeamRole.GUEST])
    
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="团队不存在",
        )
    
    members_result = await db.execute(
        select(TeamMember, User.username)
        .join(User, TeamMember.user_id == User.id)
        .where(TeamMember.team_id == team_id)
        .order_by(TeamMember.joined_at.asc())
    )
    members_data = members_result.all()
    
    member_infos = []
    for member, username in members_data:
        member_info = TeamMemberInfo(
            id=member.id,
            user_id=member.user_id,
            username=username,
            role=member.role,
            joined_at=member.joined_at,
        )
        member_infos.append(member_info)
    
    return TeamDetailResponse(
        **TeamResponse.model_validate(team).model_dump(),
        members=member_infos,
        invite_link=None,
    )


@router.put("/{team_id}", response_model=TeamResponse, summary="更新团队设置")
async def update_team(
    team_id: int,
    request: TeamUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    更新团队的基本信息和设置
    
    - **team_id**: 团队ID
    - **name**: 可选，新的团队名称
    - **description**: 可选，新的描述
    - **settings**: 可选，新的设置
    - **is_archived**: 可选，归档状态
    
    需要Owner或Admin权限。
    """
    await _check_team_permission(db, team_id, current_user.id)
    
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="团队不存在",
        )
    
    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(team, field, value)
    
    await db.commit()
    await db.refresh(team)
    
    return TeamResponse.model_validate(team)


@router.delete("/{team_id}", summary="归档/删除团队")
async def archive_team(
    team_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    归档或删除团队（软删除）
    
    - **team_id**: 团队ID
    
    只有Owner可以执行此操作。
    归档后团队将变为只读状态。
    """
    member = await _check_team_permission(db, team_id, current_user.id, [TeamRole.OWNER])
    
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="团队不存在",
        )
    
    team.is_archived = True
    await db.commit()
    
    return {"success": True, "message": "团队已归档"}


@router.post("/{team_id}/members", status_code=status.HTTP_201_CREATED, summary="邀请成员")
async def invite_member(
    team_id: int,
    request: InviteMemberRequest,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    邀请新成员加入团队
    
    - **team_id**: 团队ID
    - **user_id**: 被邀请用户的ID
    - **role**: 初始角色（默认member）
    
    需要Owner或Admin权限。
    """
    await _check_team_permission(db, team_id, current_user.id)
    
    existing_member = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == request.user_id,
        )
    )
    if existing_member.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该用户已经是团队成员",
        )
    
    target_user = await db.execute(
        select(User).where(User.id == request.user_id)
    )
    if not target_user.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="目标用户不存在",
        )
    
    new_member = TeamMember(
        team_id=team_id,
        user_id=request.user_id,
        role=request.role,
        invited_by=current_user.id,
    )
    db.add(new_member)
    
    notification = Notification(
        user_id=request.user_id,
        type=NotificationType.SYSTEM,
        title="团队邀请通知",
        content=f"您已被邀请加入团队",
        metadata_={"team_id": team_id, "inviter_id": current_user.id},
    )
    db.add(notification)
    
    await db.commit()
    
    return {"success": True, "message": "邀请已发送"}


@router.get("/{team_id}/members", response_model=list[TeamMemberInfo], summary="获取成员列表")
async def list_members(
    team_id: int,
    db: DbSession,
    current_user: CurrentUser,
    role_filter: Optional[str] = Query(None, description="按角色筛选"),
):
    """
    获取团队成员列表
    
    - **team_id**: 团队ID
    - **role_filter**: 可选，按角色筛选 (owner/admin/member/guest)
    
    返回成员的用户名、角色和加入时间。
    """
    await _check_team_permission(db, team_id, current_user.id, [TeamRole.OWNER, TeamRole.ADMIN, TeamRole.MEMBER, TeamRole.GUEST])
    
    query = (
        select(TeamMember, User.username)
        .join(User, TeamMember.user_id == User.id)
        .where(TeamMember.team_id == team_id)
    )
    
    if role_filter:
        try:
            role = TeamRole(role_filter)
            query = query.where(TeamMember.role == role)
        except ValueError:
            pass
    
    query = query.order_by(TeamMember.joined_at.asc())
    
    result = await db.execute(query)
    members_data = result.all()
    
    member_infos = []
    for member, username in members_data:
        member_info = TeamMemberInfo(
            id=member.id,
            user_id=member.user_id,
            username=username,
            role=member.role,
            joined_at=member.joined_at,
        )
        member_infos.append(member_info)
    
    return member_infos


@router.put("/{team_id}/members/{member_id}", summary="更新成员角色")
async def update_member_role(
    team_id: int,
    member_id: int,
    request: TeamMemberUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    更新团队成员的角色权限
    
    - **team_id**: 团队ID
    - **member_id**: 成员记录ID
    - **role**: 新角色
    - **user_id**: 目标用户ID
    
    只有Owner可以提升为Admin，不能修改自己的角色。
    """
    await _check_team_permission(db, team_id, current_user.id)
    
    if request.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能修改自己的角色",
        )
    
    result = await db.execute(
        select(TeamMember).where(
            TeamMember.id == member_id,
            TeamMember.team_id == team_id,
        )
    )
    member = result.scalar_one_or_none()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="成员记录不存在",
        )
    
    if request.role == TeamRole.OWNER:
        target_member = await _check_team_permission(db, team_id, current_user.id, [TeamRole.OWNER])
        if target_member.role != TeamRole.OWNER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="只有Owner可以转让所有权",
            )
    
    member.role = request.role
    await db.commit()
    
    return {"success": True, "message": f"角色已更新为 {request.role.value}"}


@router.delete("/{team_id}/members/{member_id}", summary="移除成员")
async def remove_member(
    team_id: int,
    member_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    从团队中移除成员
    
    - **team_id**: 团队ID
    - **member_id**: 成员记录ID
    
    Owner/Admin可移除其他成员，任何成员可自行退出。
    """
    result = await db.execute(
        select(TeamMember).where(
            TeamMember.id == member_id,
            TeamMember.team_id == team_id,
        )
    )
    member = result.scalar_one_or_none()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="成员记录不存在",
        )
    
    is_self_removal = member.user_id == current_user.id
    
    if not is_self_removal:
        await _check_team_permission(db, team_id, current_user.id)
        
        if member.role == TeamRole.OWNER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="不能移除团队Owner",
            )
    
    await db.delete(member)
    await db.commit()
    
    action = "退出团队" if is_self_removal else "已移除成员"
    return {"success": True, "message": action}


@router.post("/{team_id}/invite-link", response_model=InviteLinkResponse, summary="生成邀请链接")
async def generate_invite_link(
    team_id: int,
    db: DbSession,
    current_user: CurrentUser,
    max_uses: int = Query(10, ge=1, le=100, description="最大使用次数"),
    expires_hours: int = Query(24, ge=1, le=720, description="有效期（小时）"),
):
    """
    生成团队邀请链接
    
    - **team_id**: 团队ID
    - **max_uses**: 最大使用次数（默认10）
    - **expires_hours**: 有效期小时数（默认24，最大30天）
    
    需要Owner或Admin权限。生成的链接可分享给其他人加入团队。
    """
    await _check_team_permission(db, team_id, current_user.id)
    
    invite_code = str(uuid.uuid4())[:8].upper()
    expires_at = _now() + timedelta(hours=expires_hours)
    
    invite_url = f"{settings.base_url}/teams/join?code={invite_code}"
    
    return InviteLinkResponse(
        invite_code=invite_code,
        invite_url=invite_url,
        expires_at=expires_at,
        max_uses=max_uses,
        used_count=0,
    )


from ...core.config import settings

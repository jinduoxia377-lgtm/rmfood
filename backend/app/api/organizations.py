"""
多租户组织管理 API 路由

提供:
- 组织 CRUD
- 成员管理 (邀请/移除/角色变更)
- 团队管理
- 配额查询与监控
- 计划信息
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


from .deps import get_db_session, get_current_user
from ..core.multi_tenant_service import (
    OrganizationService,
    OrganizationRole,
    OrganizationPlan,
    ResourceType,
    PLAN_LIMITS,
    get_org_service,
)


router = APIRouter(prefix="/organizations", tags=["organizations"])


# ============================================================
# Request/Response Models
# ============================================================

class CreateOrganizationRequest(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None


class UpdateOrganizationRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    settings: Optional[dict] = None


class InviteMemberRequest(BaseModel):
    email: EmailStr
    role: OrganizationRole = OrganizationRole.MEMBER
    team_ids: Optional[List[int]] = None


class ChangeRoleRequest(BaseModel):
    role: OrganizationRole


class CreateTeamRequest(BaseModel):
    name: str
    description: Optional[str] = None


# ============================================================
# Organization Endpoints
# ============================================================

@router.post("", summary="创建组织")
async def create_organization(
    request: CreateOrganizationRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user),
):
    """
    创建新组织
    
    - 创建者自动成为OWNER
    - 自动生成唯一slug（如未提供）
    - 初始化默认设置
    """
    service = get_org_service(db)
    
    try:
        org = await service.create_organization(
            owner_id=current_user["id"],
            name=request.name,
            slug=request.slug,
            description=request.description,
        )
        
        return {
            "success": True,
            "organization": {
                "id": org.id,
                "name": org.name,
                "slug": org.slug,
                "plan": org.plan.value,
                "created_at": org.created_at.isoformat(),
            },
        }
        
    except ValueError as e:
        logger.error("创建组织失败: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail="参数无效")
    except PermissionError as e:
        logger.error("创建组织权限不足: %s", e, exc_info=True)
        raise HTTPException(status_code=403, detail="权限不足")


@router.get("", summary="获取我的组织列表")
async def list_my_organizations(
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user),
):
    """获取当前用户所属的所有组织"""
    result = await db.execute(
        """SELECT o.*, m.role as member_role
           FROM organizations o
           JOIN organization_members m ON o.id = m.org_id
           WHERE m.user_id = :user_id AND o.is_active = TRUE
           ORDER BY m.joined_at DESC""",
        {"user_id": current_user["id"]},
    )
    
    organizations = []
    for row in result.fetchall():
        organizations.append({
            "id": row.id,
            "name": row.name,
            "slug": row.slug,
            "description": row.description,
            "logo_url": row.logo_url,
            "plan": row.plan,
            "member_role": row.member_role,
            "owner_id": row.owner_id,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        })
    
    return {"organizations": organizations}


@router.get("/{org_id_or_slug}", summary="获取组织详情")
async def get_organization(
    org_id_or_slug: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user),
):
    """通过ID或slug获取组织详情"""
    service = get_org_service(db)
    
    try:
        org_id = int(org_id_or_slug)
        org = await service.get_organization(org_id)
    except ValueError:
        org = await service.get_organization_by_slug(org_id_or_slug)

    if not org:
        raise HTTPException(status_code=404, detail="组织不存在")

    membership = await service._get_membership(org.id, current_user["id"])
    if not membership:
        raise HTTPException(status_code=403, detail="您不是该组织的成员")

    return {
        "organization": {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "description": org.description,
            "logo_url": org.logo_url,
            "plan": org.plan.value,
            "settings": org.settings,
            "owner_id": org.owner_id,
            "my_role": membership["role"],
            "created_at": org.created_at.isoformat(),
            "updated_at": org.updated_at.isoformat(),
        }
    }


@router.put("/{org_id}", summary="更新组织信息")
async def update_organization(
    org_id: int,
    request: UpdateOrganizationRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user),
):
    """更新组织基本信息（需ADMIN或OWNER权限）"""
    service = get_org_service(db)
    
    updates = {}
    if request.name is not None:
        updates["name"] = request.name
    if request.description is not None:
        updates["description"] = request.description
    if request.logo_url is not None:
        updates["logo_url"] = request.logo_url
    if request.settings is not None:
        updates["settings"] = request.settings

    try:
        org = await service.update_organization(org_id, current_user["id"], **updates)
        
        return {"success": True, "organization": org.__dict__}
        
    except PermissionError as e:
        logger.error("更新组织权限不足: %s", e, exc_info=True)
        raise HTTPException(status_code=403, detail="权限不足")


@router.delete("/{org_id}", summary="删除组织")
async def delete_organization(
    org_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user),
):
    """删除组织（仅OWNER，慎用！）"""
    service = get_org_service(db)
    
    try:
        success = await service.delete_organization(org_id, current_user["id"])
        
        return {"success": success}
        
    except PermissionError as e:
        logger.error("删除组织权限不足: %s", e, exc_info=True)
        raise HTTPException(status_code=403, detail="权限不足")


# ============================================================
# Member Management Endpoints
# ============================================================

@router.get("/{org_id}/members", summary="获取成员列表")
async def get_members(
    org_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user),
):
    """获取组织所有成员"""
    service = get_org_service(db)
    
    membership = await service._get_membership(org_id, current_user["id"])
    if not membership:
        raise HTTPException(status_code=403, detail="您不是该组织的成员")
    
    members = await service.get_members(org_id)
    
    return {"members": members}


@router.post("/{org_id}/members", summary="邀请成员")
async def invite_member(
    org_id: int,
    request: InviteMemberRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user),
):
    """
    邀请新成员加入组织
    
    - 需要ADMIN或OWNER权限
    - 可指定初始角色和团队
    - 发送邀请邮件
    """
    service = get_org_service(db)
    
    if not await service._check_permission(org_id, current_user["id"], [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    result = await db.execute(
        "SELECT id FROM users WHERE email = :email",
        {"email": request.email},
    )
    user_row = result.fetchone()
    
    if not user_row:
        raise HTTPException(status_code=404, detail=f"未找到邮箱为 {request.email} 的用户")

    user_id = user_row.id

    try:
        member = await service.add_member(
            org_id=org_id,
            user_id=user_id,
            role=request.role,
            invited_by=current_user["id"],
            team_ids=request.team_ids,
        )

        from ..core.notification_center import notify_mention
        
        await notify_mention(
            db=db,
            author_id=current_user["id"],
            mentioned_user_id=user_id,
            resource_type="organization",
            resource_id=org_id,
            content_preview=f"邀请您加入组织并担任 {request.role.value}",
        )

        return {
            "success": True,
            "member": member.__dict__,
            "message": f"已向 {request.email} 发送邀请",
        }

    except ValueError as e:
        logger.error("邀请成员失败: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail="参数无效")


@router.delete("/{org_id}/members/{user_id}", summary="移除成员")
async def remove_member(
    org_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user),
):
    """从组织中移除成员"""
    service = get_org_service(db)
    
    try:
        success = await service.remove_member(org_id, user_id, current_user["id"])
        
        return {"success": success}
        
    except PermissionError as e:
        logger.error("移除成员权限不足: %s", e, exc_info=True)
        raise HTTPException(status_code=403, detail="权限不足")


@router.put("/{org_id}/members/{user_id}/role", summary="修改成员角色")
async def change_member_role(
    org_id: int,
    user_id: int,
    request: ChangeRoleRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user),
):
    """修改成员角色（需ADMIN或OWNER）"""
    service = get_org_service(db)
    
    try:
        success = await service.change_role(
            org_id=org_id,
            target_user_id=user_id,
            new_role=request.role,
            changer_id=current_user["id"],
        )
        
        return {"success": success}
        
    except PermissionError as e:
        logger.error("修改成员角色权限不足: %s", e, exc_info=True)
        raise HTTPException(status_code=403, detail="权限不足")


# ============================================================
# Team Management Endpoints
# ============================================================

@router.post("/{org_id}/teams", summary="创建团队")
async def create_team(
    org_id: int,
    request: CreateTeamRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user),
):
    """在组织中创建新团队"""
    service = get_org_service(db)
    
    try:
        team = await service.create_team(
            org_id=org_id,
            name=request.name,
            creator_id=current_user["id"],
            description=request.description,
        )
        
        return {"success": True, "team": team.__dict__}
        
    except ValueError as e:
        logger.error("创建团队失败: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail="参数无效")
    except PermissionError as e:
        logger.error("创建团队权限不足: %s", e, exc_info=True)
        raise HTTPException(status_code=403, detail="权限不足")


@router.get("/{org_id}/teams", summary="获取团队列表")
async def get_teams(
    org_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user),
):
    """获取组织的所有团队"""
    service = get_org_service(db)
    
    teams = await service.get_teams(org_id)
    
    return {"teams": [t.__dict__ for t in teams]}


# ============================================================
# Quota & Plan Endpoints
# ============================================================

@router.get("/{org_id}/quotas", summary="获取配额使用情况")
async def get_quotas(
    org_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user),
):
    """获取组织的资源配额使用详情"""
    service = get_org_service(db)
    
    quotas = await service.get_quota_usage(org_id)
    
    return {
        "quotas": {k: v.__dict__ for k, v in quotas.items()},
        "plan": (await service.get_organization(org_id)).plan.value,
    }


@router.get("/plans", summary="获取订阅计划列表")
async def get_plans():
    """获取所有可用的订阅计划及其限制"""
    plans = []
    
    for plan, limits in PLAN_LIMITS.items():
        plans.append({
            "plan": plan.value,
            "display_name": {
                "free": "免费版",
                "pro": "专业版",
                "enterprise": "企业版",
            }.get(plan.value, plan.value),
            "limits": {
                "max_members": limits.max_members,
                "max_teams": limits.max_teams,
                "max_formulas": limits.max_formulas,
                "storage_mb": limits.storage_mb,
                "api_calls_per_day": limits.api_calls_per_day,
                "ai_generations_per_day": limits.ai_generations_per_day,
            },
            "features": limits.features,
        })
    
    return {"plans": plans}


logger.info("🏢 多租户管理API路由加载完成")

"""
多租户组织管理 API 路由

提供:
- 组织 CRUD
- 成员管理 (邀请/移除/角色变更)
- 团队管理
- 配额查询与监控
- 计划信息
- 数据分析
- 归档/恢复/克隆
- 权限管理
- 审计日志
- 数据导出
"""

import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


from ..core.multi_tenant.multi_tenant_service import (  # noqa: E402
    PLAN_LIMITS,
    OrganizationPlan,
    OrganizationRole,
    get_org_service,
)
from .deps import get_current_active_user, get_db_session  # noqa: E402

router = APIRouter(prefix="/organizations", tags=["organizations"])

_PERMISSION_LABELS = {
    "member_management": "成员管理",
    "team_management": "团队管理",
    "formula_access": "配方访问",
    "experiment_access": "实验访问",
    "data_export": "数据导出",
    "api_access": "API 访问",
}


async def _require_org_permission(
    org_id: int,
    current_user,
    setting_key: str,
    db: AsyncSession,
    resource: Optional[str] = None,
    action: Optional[str] = None,
) -> None:
    """组织权限校验：OWNER 始终放行；自定义角色 additive 授权可覆盖组织开关；
    否则组织级开关关闭时拒绝非所有者。"""
    service = get_org_service(db)
    # 自定义角色授权（additive）：即使组织开关关闭，拥有对应 resource:action 的成员也可操作
    if resource and action:
        if await service.member_has_custom_permission(org_id, current_user.id, resource, action):
            return
    if await service.check_org_permission(org_id, current_user.id, setting_key):
        return
    label = _PERMISSION_LABELS.get(setting_key, setting_key)
    raise HTTPException(
        status_code=403,
        detail=f"该组织已关闭「{label}」权限，仅所有者可操作",
    )


async def _admin_whitelist_org_bypass(
    org_id: int,
    current_user,
    db: AsyncSession,
    slug: Optional[str] = None,
) -> bool:
    """admin 对「莱茵分子白名单组织」详情/成员端点特例放行（系统组织，admin 始终可见）。

    背景（P2-5）：白名单组织成员仅在启动/首次批准时由 _ensure_whitelist_org_members
    补齐，启动后新晋 admin 不在成员表 → 详情/成员端点 403。列表端点已对 admin 特例
    显示该组织（见 list_my_organizations），此处对详情/成员做同源特例放行：
    admin + whitelist-org（slug == 'whitelist-org'）→ 视为组织 owner 虚拟成员。
    """
    from ..models.enums import UserRole

    if getattr(current_user, "role", None) != UserRole.ADMIN:
        return False
    if slug is None:
        slug = (
            await db.execute(
                text("SELECT slug FROM organizations WHERE id = :id"),
                {"id": org_id},
            )
        ).scalar_one_or_none()
    return slug == "whitelist-org"


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


class BatchMemberRequest(BaseModel):
    user_ids: List[int]


class BatchRoleRequest(BaseModel):
    user_ids: List[int]
    role: OrganizationRole


class MemberCustomRolesRequest(BaseModel):
    role_codes: List[str] = []


class OrgPrefRequest(BaseModel):
    favorite: Optional[bool] = None
    pinned: Optional[bool] = None


class BatchPlanRequest(BaseModel):
    org_ids: List[int]
    plan: str


class UpgradeSubscriptionRequest(BaseModel):
    plan: str
    billing_cycle: str = "monthly"


class CustomRoleCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str] = []


class CustomRoleUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None


class CreateTeamRequest(BaseModel):
    name: str
    description: Optional[str] = None


class UpdateTeamRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


# ============================================================
# Organization Endpoints
# ============================================================

@router.post("", status_code=201, summary="创建组织")
async def create_organization(
    request: CreateOrganizationRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """创建新组织"""
    service = get_org_service(db)

    try:
        org = await service.create_organization(
            owner_id=current_user.id,
            name=request.name,
            slug=request.slug,
            description=request.description,
        )

        return {
            "success": True,
            "organization": {
                "id": org["id"] if isinstance(org, dict) else org.id,
                "name": org["name"] if isinstance(org, dict) else org.name,
                "slug": org["slug"] if isinstance(org, dict) else org.slug,
                "plan": org["plan"] if isinstance(org, dict) else (org.plan.value if hasattr(org.plan, "value") else org.plan),
                "created_at": (org["created_at"].isoformat() if isinstance(org, dict) else org.created_at.isoformat()),
            },
        }

    except ValueError as e:
        logger.error("创建组织失败: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        logger.error("创建组织权限不足: %s", e, exc_info=True)
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error("创建组织未知异常: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="创建组织失败")


@router.get("", summary="获取我的组织列表")
async def list_my_organizations(
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """获取当前用户所属的所有组织"""
    if not current_user:
        raise HTTPException(status_code=401, detail="未提供有效的认证令牌")
    result = await db.execute(
        text("""SELECT o.*, m.role as member_role,
               COALESCE(p.is_favorite, FALSE) AS is_favorite,
               COALESCE(p.is_pinned, FALSE) AS is_pinned,
               (SELECT COUNT(*) FROM organization_members mm WHERE mm.organization_id = o.id AND mm.is_active = TRUE) AS member_count,
               (SELECT COUNT(*) FROM teams t WHERE t.org_id = o.id) AS team_count
               FROM organizations o
               JOIN organization_members m ON o.id = m.organization_id
               LEFT JOIN organization_user_prefs p ON p.organization_id = o.id AND p.user_id = :user_id
               WHERE m.user_id = :user_id AND o.is_active = TRUE
               ORDER BY p.is_pinned DESC, m.joined_at DESC"""),
        {"user_id": current_user.id},
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
            "is_favorite": bool(row.is_favorite),
            "is_pinned": bool(row.is_pinned),
            "owner_id": row.owner_id,
            "member_count": int(row.member_count or 0),
            "team_count": int(row.team_count or 0),
            "created_at": row.created_at.isoformat() if row.created_at else None,
        })
    # 确保「莱茵分子白名单组织」对 admin 可见（系统组织，无成员关系也显示；
    # 用于白名单获批用户管理与组织级功能授予，见 core/whitelist_org.py）。
    from ..models.enums import UserRole

    if getattr(current_user, "role", None) == UserRole.ADMIN and not any(
        o.get("slug") == "whitelist-org" for o in organizations
    ):
        wl = await db.execute(
            text(
                "SELECT o.id, o.name, o.slug, o.description, o.logo_url, o.plan, o.owner_id, "
                "       o.is_active, o.created_at, "
                "       (SELECT COUNT(*) FROM organization_members mm "
                "        WHERE mm.organization_id = o.id AND mm.is_active = TRUE) AS member_count "
                "FROM organizations o WHERE o.slug='whitelist-org' AND o.is_active=TRUE LIMIT 1"
            )
        )
        wl_row = wl.fetchone()
        if wl_row:
            organizations.insert(
                0,
                {
                    "id": wl_row.id,
                    "name": wl_row.name,
                    "slug": wl_row.slug,
                    "description": wl_row.description,
                    "logo_url": wl_row.logo_url,
                    "plan": wl_row.plan,
                    "member_role": None,
                    "is_favorite": False,
                    "is_pinned": False,
                    "owner_id": wl_row.owner_id,
                    "member_count": int(wl_row.member_count or 0),
                    "team_count": 0,
                    "created_at": wl_row.created_at.isoformat() if wl_row.created_at else None,
                },
            )
    return {"organizations": organizations}


@router.get("/trashed", summary="获取已归档组织列表")
async def list_trashed_organizations(
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """获取当前用户所属的已归档（软删除）组织。"""
    if not current_user:
        raise HTTPException(status_code=401, detail="未提供有效的认证令牌")
    result = await db.execute(
        text("""SELECT o.*, m.role as member_role,
               COALESCE(p.is_favorite, FALSE) AS is_favorite,
               COALESCE(p.is_pinned, FALSE) AS is_pinned,
               (SELECT COUNT(*) FROM organization_members mm WHERE mm.organization_id = o.id AND mm.is_active = TRUE) AS member_count,
               (SELECT COUNT(*) FROM teams t WHERE t.org_id = o.id) AS team_count
               FROM organizations o
               JOIN organization_members m ON o.id = m.organization_id
               LEFT JOIN organization_user_prefs p ON p.organization_id = o.id AND p.user_id = :user_id
               WHERE m.user_id = :user_id AND o.is_active = FALSE
               ORDER BY m.joined_at DESC"""),
        {"user_id": current_user.id},
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
            "is_favorite": bool(row.is_favorite),
            "is_pinned": bool(row.is_pinned),
            "owner_id": row.owner_id,
            "member_count": int(row.member_count or 0),
            "team_count": int(row.team_count or 0),
            "created_at": row.created_at.isoformat() if row.created_at else None,
        })
    return {"organizations": organizations}


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


@router.get("/analytics", summary="组织全局数据分析（我的组织）")
async def get_global_analytics(
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """返回当前用户所属组织的汇总分析数据。"""
    if not current_user:
        raise HTTPException(status_code=401, detail="未提供有效的认证令牌")

    org_rows = (await db.execute(
        text("""
            SELECT o.id, o.name, o.plan,
                   (SELECT COUNT(*) FROM organization_members m WHERE m.organization_id = o.id AND m.is_active = TRUE) AS member_count
            FROM organizations o
            JOIN organization_members me ON o.id = me.organization_id
            WHERE me.user_id = :user_id AND o.is_active = TRUE
            ORDER BY o.id DESC
        """),
        {"user_id": current_user.id},
    )).fetchall()

    total_orgs = len(org_rows)
    total_members = sum(int(r.member_count or 0) for r in org_rows)
    plan_distribution_obj = {"free": 0, "pro": 0, "enterprise": 0}
    for r in org_rows:
        plan = (r.plan or "free").lower()
        if plan in plan_distribution_obj:
            plan_distribution_obj[plan] += 1
    plan_distribution = [
        {"name": "企业版", "value": plan_distribution_obj["enterprise"], "color": "var(--color-accent-500, #A855F7)"},
        {"name": "专业版", "value": plan_distribution_obj["pro"], "color": "var(--color-secondary, #0A84FF)"},
        {"name": "免费版", "value": plan_distribution_obj["free"], "color": "var(--text-muted, #9A9A9F)"},
    ]

    # 真实平均存储使用率：按每个组织 attachments 实际占用 / 计划存储上限计算
    total_storage_percent = 0.0
    for r in org_rows:
        try:
            plan_enum = OrganizationPlan((r.plan or "free").lower())
        except ValueError:
            plan_enum = OrganizationPlan.FREE
        storage_limit_mb = PLAN_LIMITS.get(plan_enum, PLAN_LIMITS[OrganizationPlan.FREE]).storage_mb
        if not storage_limit_mb or storage_limit_mb <= 0:
            continue
        storage_used_mb = (await db.execute(
            text("""
                SELECT COALESCE(SUM(a.file_size), 0) / 1048576.0
                FROM attachments a
                WHERE a.uploaded_by IN (SELECT user_id FROM organization_members WHERE organization_id = :id)
            """),
            {"id": r.id},
        )).scalar() or 0
        total_storage_percent += min((float(storage_used_mb) / storage_limit_mb) * 100.0, 100.0)
    avg_storage_usage = round(total_storage_percent / total_orgs, 1) if total_orgs > 0 else 0

    # 近 30 天成员增长（所有我的组织）
    member_trend_rows = (await db.execute(
        text("""
            SELECT DATE(joined_at) AS d, COUNT(*) AS cnt
            FROM organization_members
            WHERE organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = :user_id)
              AND joined_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE(joined_at) ORDER BY d ASC
        """),
        {"user_id": current_user.id},
    )).fetchall()
    member_trend = [{"date": str(r.d), "count": int(r.cnt)} for r in member_trend_rows]

    api_calls = (await db.execute(
        text("""
            SELECT COUNT(*) FROM audit_logs
            WHERE user_id IN (SELECT user_id FROM organization_members WHERE organization_id IN
                (SELECT organization_id FROM organization_members WHERE user_id = :user_id))
              AND created_at >= CURRENT_DATE - INTERVAL '30 days'
        """),
        {"user_id": current_user.id},
    )).scalar() or 0

    return {
        "totalOrgs": total_orgs,
        "totalMembers": total_members,
        "avgStorageUsage": avg_storage_usage,
        "monthlyApiCalls": int(api_calls),
        "memberTrend": member_trend,
        "storageTrend": [],
        "orgActivity": [
            {"name": r.name, "activity": int(r.member_count or 0)}
            for r in org_rows[:10]
        ],
        "planDistribution": plan_distribution,
    }


@router.get("/{org_id_or_slug}", summary="获取组织详情")
async def get_organization(
    org_id_or_slug: str,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """通过ID或slug获取组织详情"""
    service = get_org_service(db)

    try:
        org_id = int(org_id_or_slug)
        org = await service.get_organization(org_id)
    except ValueError:
        org = await service.get_organization_by_slug(org_id_or_slug)

    try:
        if not org:
            raise HTTPException(status_code=404, detail="组织不存在")

        membership = await service._get_membership(org.id, current_user.id)
        # P2-5：admin 对白名单组织特例放行（系统组织，admin 无成员行也可见）。
        is_admin_bypass = await _admin_whitelist_org_bypass(
            org.id, current_user, db, slug=getattr(org, "slug", None)
        )
        if not membership and not is_admin_bypass:
            raise HTTPException(status_code=403, detail="您不是该组织的成员")

        # 真实成员数/团队数/存储用量（供详情页展示）
        member_count = (await db.execute(
            text("SELECT COUNT(*) FROM organization_members WHERE organization_id = :id AND is_active = TRUE"),
            {"id": org.id},
        )).scalar() or 0
        team_count = (await db.execute(
            text("SELECT COUNT(*) FROM teams WHERE org_id = :id"),
            {"id": org.id},
        )).scalar() or 0
        storage_used_mb = (await db.execute(
            text("""
                SELECT COALESCE(SUM(a.file_size), 0) / 1048576.0
                FROM attachments a
                WHERE a.uploaded_by IN (SELECT user_id FROM organization_members WHERE organization_id = :id)
            """),
            {"id": org.id},
        )).scalar() or 0

        plan_key = org.plan.value if hasattr(org.plan, "value") else org.plan
        try:
            plan_enum = plan_key if isinstance(plan_key, OrganizationPlan) else OrganizationPlan(plan_key)
        except ValueError:
            plan_enum = OrganizationPlan.FREE
        storage_limit_mb = PLAN_LIMITS.get(plan_enum, PLAN_LIMITS[OrganizationPlan.FREE]).storage_mb

        # 组织成员 API 调用量（近 30 天，用于详情页用量展示）
        api_usage = (await db.execute(
            text("""
                SELECT COUNT(*) FROM audit_logs
                WHERE user_id IN (SELECT user_id FROM organization_members WHERE organization_id = :id)
                  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
            """),
            {"id": org.id},
        )).scalar() or 0
        api_limit = PLAN_LIMITS.get(plan_enum, PLAN_LIMITS[OrganizationPlan.FREE]).api_calls_per_day

        return {
            "organization": {
                "id": org.id,
                "name": org.name,
                "slug": org.slug,
                "description": org.description,
                "logo_url": org.logo_url,
                "plan": plan_key,
                "settings": org.settings,
                "owner_id": org.owner_id,
                "is_active": bool(org.is_active) if hasattr(org, "is_active") else True,
                "my_role": (membership.role if hasattr(membership, 'role') else membership["role"]) if membership else "owner",
                "memberCount": int(member_count),
                "teamCount": int(team_count),
                "storageUsed": int(storage_used_mb * 1024 * 1024),
                "storageLimit": int(storage_limit_mb * 1024 * 1024),
                "apiUsage": int(api_usage),
                "apiLimit": int(api_limit or 0),
                "created_at": org.created_at.isoformat(),
                "updated_at": org.updated_at.isoformat(),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取组织详情失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="获取组织详情失败")


@router.put("/{org_id}", summary="更新组织信息")
async def update_organization(
    org_id: int,
    request: UpdateOrganizationRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
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
        org = await service.update_organization(org_id, current_user.id, **updates)
        org_dict = dict(org._mapping) if hasattr(org, "_mapping") else org
        return {"success": True, "organization": org_dict}
    except PermissionError as e:
        logger.error("更新组织权限不足: %s", e, exc_info=True)
        raise HTTPException(status_code=403, detail=str(e))


@router.delete("/{org_id}", summary="删除组织")
async def delete_organization(
    org_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """删除组织（仅OWNER，慎用！）"""
    service = get_org_service(db)

    try:
        success = await service.delete_organization(org_id, current_user.id)
        return {"success": success}
    except PermissionError as e:
        logger.error("删除组织权限不足: %s", e, exc_info=True)
        raise HTTPException(status_code=403, detail=str(e))


# ============================================================
# Member Management Endpoints
# ============================================================

@router.get("/{org_id}/members", summary="获取成员列表")
async def get_members(
    org_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """获取组织所有成员"""
    service = get_org_service(db)

    membership = await service._get_membership(org_id, current_user.id)
    if not membership:
        # P2-5：admin 对白名单组织特例放行（系统组织，admin 无成员行也可见成员列表）。
        if not await _admin_whitelist_org_bypass(org_id, current_user, db):
            raise HTTPException(status_code=403, detail="您不是该组织的成员")

    members = await service.get_members(org_id)
    return {"members": members}


@router.post("/{org_id}/members", summary="邀请成员")
async def invite_member(
    org_id: int,
    request: InviteMemberRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """邀请新成员加入组织"""
    service = get_org_service(db)

    if not (await service._check_permission(org_id, current_user.id, [OrganizationRole.OWNER, OrganizationRole.ADMIN])
                or await service.member_has_custom_permission(org_id, current_user.id, "members", "manage")):
        raise HTTPException(status_code=403, detail="需要管理员权限")

    await _require_org_permission(org_id, current_user, "member_management", db, resource="members", action="manage")

    result = await db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": request.email},
    )
    user_row = result.fetchone()
    user_id = user_row.id if user_row else None

    # 用户不存在 → 创建待接受邀请记录
    if not user_id:
        import uuid as _uuid
        token = _uuid.uuid4().hex
        await db.execute(
            text("""
                INSERT INTO organization_invitations
                    (organization_id, email, role, token, status, invited_by, created_at, updated_at)
                VALUES (:org_id, :email, :role, :token, 'pending', :invited_by, NOW(), NOW())
            """),
            {"org_id": org_id, "email": request.email, "role": request.role.value, "token": token, "invited_by": current_user.id},
        )
        await db.commit()
        await service.record_activity(
            org_id, current_user.id, "members.invite_sent",
            target_type="user", target_id=None,
            metadata={"email": request.email, "role": request.role.value, "status": "pending"},
        )
        # 📧 真实发送邀请邮件（开发环境保存到 logs/email-dev，生产环境 SMTP）
        try:
            import os as _os

            from ..core.config import settings as _settings
            from ..utils.email_service import send_organization_invitation_email
            org_obj = await service.get_organization(org_id)
            org_name = org_obj.name if org_obj else f"组织#{org_id}"
            send_organization_invitation_email(
                to_email=request.email,
                org_name=org_name,
                role=request.role.value,
                token=token,
                inviter_name=current_user.username or current_user.email,
                frontend_url=_os.getenv("FRONTEND_URL", "http://localhost:3000"),
                smtp_host=_os.getenv("SMTP_HOST", ""),
                smtp_port=int(_os.getenv("SMTP_PORT", "465")),
                smtp_username=_os.getenv("SMTP_USERNAME", ""),
                smtp_password=_os.getenv("SMTP_PASSWORD", ""),
                use_tls=_os.getenv("SMTP_PORT", "465") == "465",
                is_development=bool(getattr(_settings, "debug", True)),
            )
        except Exception as _e:
            logger.error("发送邀请邮件失败: %s", _e, exc_info=True)

        return {
            "success": True,
            "invitation": {"email": request.email, "role": request.role.value, "status": "pending", "token": token},
            "message": f"已向 {request.email} 发送邀请（用户尚未注册，等待接受）",
        }

    try:
        member = await service.add_member(
            organization_id=org_id,
            user_id=user_id,
            role=request.role,
            invited_by=current_user.id,
            team_ids=request.team_ids,
        )

        await service.record_activity(
            org_id, current_user.id, "members.invite",
            target_type="user", target_id=user_id,
            metadata={"email": request.email, "role": request.role.value},
        )

        from ..core.realtime.notification_center import notify_mention

        await notify_mention(
            db=db,
            author_id=current_user.id,
            mentioned_user_id=user_id,
            resource_type="organization",
            resource_id=org_id,
            content_preview=f"邀请您加入组织并担任 {request.role.value}",
        )

        # 📧 已注册用户：发送「已加入组织」通知邮件
        try:
            import os as _os

            from ..core.config import settings as _settings
            from ..utils.email_service import send_organization_invitation_email
            org_obj = await service.get_organization(org_id)
            org_name = org_obj.name if org_obj else f"组织#{org_id}"
            send_organization_invitation_email(
                to_email=request.email,
                org_name=org_name,
                role=request.role.value,
                token="",
                inviter_name=current_user.username or current_user.email,
                frontend_url=_os.getenv("FRONTEND_URL", "http://localhost:3000"),
                smtp_host=_os.getenv("SMTP_HOST", ""),
                smtp_port=int(_os.getenv("SMTP_PORT", "465")),
                smtp_username=_os.getenv("SMTP_USERNAME", ""),
                smtp_password=_os.getenv("SMTP_PASSWORD", ""),
                use_tls=_os.getenv("SMTP_PORT", "465") == "465",
                is_development=bool(getattr(_settings, "debug", True)),
            )
        except Exception as _e:
            logger.error("发送加入组织邮件失败: %s", _e, exc_info=True)

        return {
            "success": True,
            "member": member,
            "message": f"已向 {request.email} 发送邀请",
        }

    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        logger.error("邀请成员失败: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{org_id}/members/{user_id}", summary="移除成员")
async def remove_member(
    org_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """从组织中移除成员"""
    service = get_org_service(db)
    await _require_org_permission(org_id, current_user, "member_management", db, resource="members", action="manage")

    try:
        success = await service.remove_member(org_id, user_id, current_user.id)
        return {"success": success}
    except PermissionError as e:
        logger.error("移除成员权限不足: %s", e, exc_info=True)
        raise HTTPException(status_code=403, detail=str(e))


@router.put("/{org_id}/members/{user_id}/role", summary="修改成员角色")
async def change_member_role(
    org_id: int,
    user_id: int,
    request: ChangeRoleRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """修改成员角色（需ADMIN或OWNER）"""
    service = get_org_service(db)
    await _require_org_permission(org_id, current_user, "member_management", db, resource="members", action="manage")

    try:
        success = await service.change_role(
            organization_id=org_id,
            user_id=user_id,
            role=request.role.value,
            actor_id=current_user.id,
        )
        await service.record_activity(
            org_id, current_user.id, "members.role_change",
            target_type="user", target_id=user_id,
            metadata={"role": request.role.value},
        )
        return {"success": success}
    except PermissionError as e:
        logger.error("修改成员角色权限不足: %s", e, exc_info=True)
        raise HTTPException(status_code=403, detail=str(e))


@router.put("/{org_id}/members/{user_id}/custom-roles", summary="分配成员自定义角色")
async def assign_member_custom_roles(
    org_id: int,
    user_id: int,
    request: MemberCustomRolesRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """为成员分配自定义角色（需ADMIN或OWNER；支持 additive 权限授权）"""
    service = get_org_service(db)
    await _require_org_permission(org_id, current_user, "member_management", db, resource="members", action="manage")

    try:
        success = await service.set_member_custom_roles(
            organization_id=org_id,
            user_id=user_id,
            role_codes=request.role_codes,
            actor_id=current_user.id,
        )
        return {"success": success, "custom_roles": request.role_codes}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.put("/{org_id}/members/{user_id}/suspend", summary="停用成员")
async def suspend_member(
    org_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """停用成员（保留记录但禁止访问）"""
    service = get_org_service(db)
    await _require_org_permission(org_id, current_user, "member_management", db, resource="members", action="manage")

    try:
        success = await service.suspend_member(org_id, user_id, current_user.id)
        return {"success": success}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{org_id}/members/{user_id}/resume", summary="恢复成员")
async def resume_member(
    org_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """恢复成员"""
    service = get_org_service(db)
    await _require_org_permission(org_id, current_user, "member_management", db, resource="members", action="manage")

    try:
        success = await service.resume_member(org_id, user_id, current_user.id)
        return {"success": success}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============================================================
# Team Management Endpoints
# ============================================================

@router.post("/{org_id}/teams", summary="创建团队")
async def create_team(
    org_id: int,
    request: CreateTeamRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """在组织中创建新团队"""
    service = get_org_service(db)
    await _require_org_permission(org_id, current_user, "team_management", db, resource="teams", action="create")

    try:
        team = await service.create_team(
            org_id=org_id,
            name=request.name,
            creator_id=current_user.id,
            description=request.description,
        )
        team_dict = dict(team._mapping) if hasattr(team, "_mapping") else team
        await service.record_activity(
            org_id, current_user.id, "teams.create",
            target_type="team", target_id=team_dict.get("id"),
            metadata={"name": request.name},
        )
        return {"success": True, "team": team_dict}
    except PermissionError as e:
        logger.error("创建团队权限不足: %s", e, exc_info=True)
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        logger.error("创建团队失败: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{org_id}/teams/{team_id}", summary="更新团队")
async def update_team(
    org_id: int,
    team_id: int,
    request: UpdateTeamRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """更新团队名称/描述"""
    service = get_org_service(db)
    await _require_org_permission(org_id, current_user, "team_management", db, resource="teams", action="update")
    try:
        success = await service.update_team(
            org_id=org_id,
            team_id=team_id,
            actor_id=current_user.id,
            name=request.name,
            description=request.description,
        )
        await service.record_activity(
            org_id, current_user.id, "teams.update",
            target_type="team", target_id=team_id,
            metadata={"name": request.name},
        )
        return {"success": success}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.delete("/{org_id}/teams/{team_id}", summary="删除团队")
async def delete_team(
    org_id: int,
    team_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """删除团队（需团队管理权限）"""
    service = get_org_service(db)
    await _require_org_permission(org_id, current_user, "team_management", db, resource="teams", action="delete")
    try:
        success = await service.delete_team(
            org_id=org_id,
            team_id=team_id,
            actor_id=current_user.id,
        )
        await service.record_activity(
            org_id, current_user.id, "teams.delete",
            target_type="team", target_id=team_id,
        )
        return {"success": success}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/{org_id}/teams", summary="获取团队列表")
async def get_teams(
    org_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """获取组织的所有团队"""
    service = get_org_service(db)

    teams = await service.get_teams(org_id)
    return {"teams": [dict(t) if hasattr(t, "_mapping") else t for t in teams]}


# ============================================================
# Quota & Plan Endpoints
# ============================================================

@router.get("/{org_id}/quotas", summary="获取配额使用情况")
async def get_quotas(
    org_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """获取组织的资源配额使用详情"""
    service = get_org_service(db)

    quotas = await service.get_quota_usage(org_id)

    return {
        "quotas": quotas,
        "plan": (await service.get_organization(org_id)).plan if hasattr((await service.get_organization(org_id)), 'plan') else 'free',
    }


# ============================================================
# 新增端点：归档、克隆、数据分析
# ============================================================

@router.put("/{org_id}/archive", summary="归档组织")
async def archive_organization(
    org_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """归档组织（软删除）"""
    service = get_org_service(db)

    try:
        success = await service.archive_organization(org_id, current_user.id)
        return {"success": success}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{org_id}/restore", summary="恢复组织")
async def restore_organization(
    org_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """恢复已归档的组织"""
    service = get_org_service(db)

    try:
        success = await service.restore_organization(org_id, current_user.id)
        return {"success": success}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{org_id}/favorite", summary="收藏/取消收藏组织")
async def set_org_favorite(
    org_id: int,
    request: OrgPrefRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """收藏/取消收藏组织（按当前用户持久化）。"""
    if request.favorite is None:
        raise HTTPException(status_code=400, detail="缺少 favorite 字段")
    await db.execute(
        text("""
            INSERT INTO organization_user_prefs (user_id, organization_id, is_favorite, is_pinned, created_at, updated_at)
            VALUES (:uid, :oid, :fav, FALSE, NOW(), NOW())
            ON CONFLICT (user_id, organization_id)
            DO UPDATE SET is_favorite = :fav, updated_at = NOW()
        """),
        {"uid": current_user.id, "oid": org_id, "fav": request.favorite},
    )
    await db.commit()
    return {"success": True, "favorite": request.favorite}


@router.put("/{org_id}/pin", summary="置顶/取消置顶组织")
async def set_org_pin(
    org_id: int,
    request: OrgPrefRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """置顶/取消置顶组织（按当前用户持久化）。"""
    if request.pinned is None:
        raise HTTPException(status_code=400, detail="缺少 pinned 字段")
    await db.execute(
        text("""
            INSERT INTO organization_user_prefs (user_id, organization_id, is_favorite, is_pinned, created_at, updated_at)
            VALUES (:uid, :oid, FALSE, :pin, NOW(), NOW())
            ON CONFLICT (user_id, organization_id)
            DO UPDATE SET is_pinned = :pin, updated_at = NOW()
        """),
        {"uid": current_user.id, "oid": org_id, "pin": request.pinned},
    )
    await db.commit()
    return {"success": True, "pinned": request.pinned}


@router.post("/{org_id}/clone", summary="克隆组织")
async def clone_organization(
    org_id: int,
    request: CreateOrganizationRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """克隆组织（复制基本信息）"""
    service = get_org_service(db)

    try:
        new_org_id = await service.clone_organization(org_id, current_user.id, request.name)
        return {
            "success": True,
            "new_organization_id": new_org_id,
            "message": f"已成功克隆为 '{request.name}'"
        }
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{org_id}/analytics", summary="组织数据分析")
async def get_organization_analytics(
    org_id: int,
    time_range: str = Query(default="30d", description="时间范围: 7d, 30d, 90d"),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """获取组织数据分析"""
    service = get_org_service(db)
    await _require_org_permission(org_id, current_user, "api_access", db, resource="api", action="access")

    try:
        analytics = await service.get_analytics(org_id, time_range)
        return analytics
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/{org_id}/audit-log", summary="审计日志")
async def get_audit_log(
    org_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    action_type: Optional[str] = Query(default=None, description="按动作类型筛选"),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """获取组织审计日志"""
    service = get_org_service(db)
    await _require_org_permission(org_id, current_user, "api_access", db, resource="api", action="access")

    try:
        log_data = await service.get_audit_log(org_id, limit, offset, action_type)
        return log_data
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{org_id}/export", summary="导出组织数据")
async def export_organization(
    org_id: int,
    format_type: str = Query(default="json", description="导出格式: json, csv, excel"),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """导出组织数据"""
    service = get_org_service(db)
    await _require_org_permission(org_id, current_user, "data_export", db, resource="data", action="export")
    await _require_org_permission(org_id, current_user, "api_access", db, resource="api", action="access")

    try:
        export_data = await service.export_organization(org_id, format_type)
        return export_data
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/{org_id}/permissions", summary="获取权限配置")
async def get_permissions(
    org_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """获取组织权限配置"""
    service = get_org_service(db)

    membership = await service._get_membership(org_id, current_user.id)
    if not membership:
        raise HTTPException(status_code=403, detail="您不是该组织的成员")

    org = await service.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="组织不存在")

    settings = org.settings or {}
    if isinstance(settings, str):
        try:
            settings = json.loads(settings)
        except Exception:
            settings = {}

    return {
        "organization_id": org_id,
        "permissions": {
            "member_management": settings.get("permissions", {}).get("member_management", True),
            "team_management": settings.get("permissions", {}).get("team_management", True),
            "formula_access": settings.get("permissions", {}).get("formula_access", True),
            "experiment_access": settings.get("permissions", {}).get("experiment_access", True),
            "data_export": settings.get("permissions", {}).get("data_export", True),
            "api_access": settings.get("permissions", {}).get("api_access", True),
        },
        "my_role": membership["role"],
    }


@router.put("/{org_id}/permissions", summary="更新权限配置")
async def update_permissions(
    org_id: int,
    permissions: Dict[str, bool],
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """更新组织权限配置（需OWNER或ADMIN）"""
    service = get_org_service(db)

    if not await service._check_permission(org_id, current_user.id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
        raise HTTPException(status_code=403, detail="权限不足")

    org = await service.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="组织不存在")

    settings = org.settings or {}
    if isinstance(settings, str):
        try:
            settings = json.loads(settings)
        except Exception:
            settings = {}
    settings["permissions"] = permissions

    await service.db.execute(
        text("UPDATE organizations SET settings = CAST(:settings AS jsonb), updated_at = NOW() WHERE id = :id"),
        {"settings": json.dumps(settings), "id": org_id},
    )
    await service.db.commit()

    return {"success": True, "permissions": permissions}


# ============================================================
# 订阅 / 用量 / 批量成员操作（真实功能）
# ============================================================

@router.post("/batch-plan", summary="批量修改组织计划（管理员）")
async def batch_change_org_plan(
    request: BatchPlanRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """批量修改多个组织的计划（free/pro/enterprise），仅系统管理员可操作。"""
    from ..models.enums import UserRole
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="仅系统管理员可批量修改组织计划")

    try:
        plan_enum = OrganizationPlan(request.plan)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"无效的计划: {request.plan}")

    service = get_org_service(db)
    updated = 0
    for oid in request.org_ids:
        await service.db.execute(
            text("UPDATE organizations SET plan = :plan, updated_at = NOW() WHERE id = :id"),
            {"plan": plan_enum.value, "id": oid},
        )
        # 同步订阅状态
        existing = (await service.db.execute(
            text("SELECT id FROM subscriptions WHERE organization_id = :id ORDER BY id DESC LIMIT 1"),
            {"id": oid},
        )).fetchone()
        if existing:
            await service.db.execute(
                text("UPDATE subscriptions SET plan = :plan, status = 'active', updated_at = NOW() WHERE id = :sub_id"),
                {"plan": plan_enum.value, "sub_id": existing.id},
            )
        else:
            await service.db.execute(
                text("INSERT INTO subscriptions (organization_id, plan, status, billing_cycle, created_at, updated_at) VALUES (:id, :plan, 'active', 'monthly', NOW(), NOW())"),
                {"id": oid, "plan": plan_enum.value},
            )
        updated += 1
    await service.db.commit()
    return {"success": True, "updated": updated, "plan": plan_enum.value}


@router.get("/{org_id}/invitations", summary="获取组织待接受邀请列表")
async def list_invitations(
    org_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """获取组织的邀请记录（OWNER/ADMIN）"""
    service = get_org_service(db)
    if not await service._check_permission(org_id, current_user.id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
        raise HTTPException(status_code=403, detail="需要 OWNER 或 ADMIN 权限")
    rows = (await db.execute(
        text("SELECT * FROM organization_invitations WHERE organization_id = :org_id ORDER BY created_at DESC"),
        {"org_id": org_id},
    )).fetchall()
    return {"invitations": [dict(r._mapping) for r in rows]}


@router.post("/invitations/{token}/accept", summary="接受组织邀请")
async def accept_invitation(
    token: str,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """被邀请用户接受邀请，自动加入组织。"""
    service = get_org_service(db)
    row = (await db.execute(
        text("SELECT * FROM organization_invitations WHERE token = :token AND status = 'pending'"),
        {"token": token},
    )).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="邀请不存在或已失效")

    inv = dict(row._mapping)
    if inv["email"].lower() != (current_user.email or "").lower():
        raise HTTPException(status_code=403, detail="该邀请不属于当前用户")

    # 加入组织（若已是成员则跳过）
    membership = await service._get_membership(inv["organization_id"], current_user.id)
    if not membership:
        await service.add_member(
            organization_id=inv["organization_id"],
            user_id=current_user.id,
            role=OrganizationRole(inv["role"]),
            invited_by=inv.get("invited_by"),
        )
    await db.execute(
        text("UPDATE organization_invitations SET status = 'accepted', accepted_at = NOW() WHERE id = :id"),
        {"id": inv["id"]},
    )
    await db.commit()
    await service.record_activity(
        inv["organization_id"], current_user.id, "members.invite_accepted",
        target_type="user", target_id=current_user.id,
        metadata={"email": current_user.email},
    )
    return {"success": True, "organization_id": inv["organization_id"], "message": "已加入组织"}


@router.get("/{org_id}/subscription/orders", summary="获取组织订阅订单")
async def list_subscription_orders(
    org_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """获取组织的订阅订单记录（OWNER/ADMIN）。"""
    service = get_org_service(db)
    if not await service._check_permission(org_id, current_user.id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
        raise HTTPException(status_code=403, detail="需要 OWNER 或 ADMIN 权限")
    rows = (await db.execute(
        text("SELECT * FROM billing_orders WHERE organization_id = :org_id ORDER BY created_at DESC"),
        {"org_id": org_id},
    )).fetchall()
    return {"orders": [dict(r._mapping) for r in rows]}


@router.get("/billing/providers", summary="获取支付渠道配置")
async def list_billing_providers():
    """列出可用的支付渠道（本期仅模拟支付启用，真实渠道需配置商户密钥）。"""
    providers = [
        {"key": "mock", "name": "模拟支付", "enabled": True, "description": "测试环境专用，不产生真实扣款"},
        {"key": "alipay", "name": "支付宝", "enabled": False, "description": "需配置支付宝商户号/应用私钥"},
        {"key": "wechat", "name": "微信支付", "enabled": False, "description": "需配置微信商户号/API 密钥"},
        {"key": "stripe", "name": "Stripe", "enabled": False, "description": "需配置 Stripe Secret Key"},
    ]
    return {"providers": providers}


@router.get("/{org_id}/subscription", summary="获取组织订阅信息")
async def get_subscription(
    org_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """获取当前计划、订阅状态与真实用量"""
    service = get_org_service(db)
    membership = await service._get_membership(org_id, current_user.id)
    if not membership:
        raise HTTPException(status_code=403, detail="您不是该组织的成员")
    try:
        return await service.get_subscription(org_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{org_id}/subscription/upgrade", summary="升级订阅（模拟支付）")
async def upgrade_subscription(
    org_id: int,
    request: UpgradeSubscriptionRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """升级组织计划（模拟支付：生成已支付订单并更新计划）"""
    service = get_org_service(db)
    if not await service._check_permission(org_id, current_user.id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
        raise HTTPException(status_code=403, detail="需要 OWNER 或 ADMIN 权限")
    try:
        return await service.upgrade_subscription(org_id, request.plan, request.billing_cycle, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{org_id}/subscription/cancel", summary="取消订阅")
async def cancel_subscription(
    org_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """取消订阅（模拟：状态置为 canceled）"""
    service = get_org_service(db)
    if not await service._check_permission(org_id, current_user.id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
        raise HTTPException(status_code=403, detail="需要 OWNER 或 ADMIN 权限")
    return await service.cancel_subscription(org_id, current_user.id)


@router.get("/{org_id}/usage", summary="获取组织配额用量")
async def get_org_usage(
    org_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """获取组织真实配额用量（含是否超限）"""
    service = get_org_service(db)
    membership = await service._get_membership(org_id, current_user.id)
    if not membership:
        raise HTTPException(status_code=403, detail="您不是该组织的成员")
    return await service.get_quota_usage(org_id)


@router.post("/{org_id}/members/batch-role", summary="批量修改成员角色")
async def batch_change_member_role(
    org_id: int,
    request: BatchRoleRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    service = get_org_service(db)
    await _require_org_permission(org_id, current_user, "member_management", db, resource="members", action="manage")
    try:
        count = await service.batch_change_role(org_id, request.user_ids, request.role.value, current_user.id)
        return {"success": True, "updated": count, "role": request.role.value}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{org_id}/members/batch-suspend", summary="批量停用成员")
async def batch_suspend_members(
    org_id: int,
    request: BatchMemberRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    service = get_org_service(db)
    await _require_org_permission(org_id, current_user, "member_management", db, resource="members", action="manage")
    try:
        count = await service.batch_suspend_members(org_id, request.user_ids, current_user.id)
        return {"success": True, "updated": count}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{org_id}/members/batch-resume", summary="批量恢复成员")
async def batch_resume_members(
    org_id: int,
    request: BatchMemberRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    service = get_org_service(db)
    await _require_org_permission(org_id, current_user, "member_management", db, resource="members", action="manage")
    try:
        count = await service.batch_resume_members(org_id, request.user_ids, current_user.id)
        return {"success": True, "updated": count}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{org_id}/members/batch-remove", summary="批量移除成员")
async def batch_remove_members(
    org_id: int,
    request: BatchMemberRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    service = get_org_service(db)
    await _require_org_permission(org_id, current_user, "member_management", db, resource="members", action="manage")
    try:
        count = await service.batch_remove_members(org_id, request.user_ids, current_user.id)
        return {"success": True, "removed": count}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{org_id}/members/export", summary="导出组织成员")
async def export_members(
    org_id: int,
    format_type: str = Query(default="csv", description="导出格式: csv / json"),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """导出组织成员列表（CSV/JSON）"""
    service = get_org_service(db)
    membership = await service._get_membership(org_id, current_user.id)
    if not membership:
        raise HTTPException(status_code=403, detail="您不是该组织的成员")
    await _require_org_permission(org_id, current_user, "data_export", db, resource="data", action="export")
    await _require_org_permission(org_id, current_user, "api_access", db, resource="api", action="access")

    members = await service.get_members(org_id)
    if format_type == "json":
        import datetime as _dt

        from fastapi.responses import JSONResponse
        json_members = []
        for m in members:
            m = dict(m)
            for k, v in list(m.items()):
                if isinstance(v, (_dt.datetime, _dt.date)):
                    m[k] = v.isoformat()
            json_members.append(m)
        return JSONResponse(content={"members": json_members})

    import csv
    import io
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=["user_id", "username", "email", "role", "joined_at", "is_active"])
    writer.writeheader()
    for m in members:
        writer.writerow({
            "user_id": m.get("user_id"),
            "username": m.get("username", ""),
            "email": m.get("email", ""),
            "role": m.get("role", ""),
            "joined_at": m.get("joined_at", ""),
            "is_active": m.get("is_active", True),
        })
    from fastapi.responses import Response
    return Response(content="\ufeff" + buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="org_{org_id}_members.csv"'})


# ============================================================
# 组织自定义角色（权限集）管理
# ============================================================

def _load_custom_roles(settings: Any) -> list:
    """从组织 settings 中读取自定义角色列表。"""
    if isinstance(settings, str):
        try:
            settings = json.loads(settings)
        except Exception:
            settings = {}
    settings = settings or {}
    roles = settings.get("custom_roles") or []
    return roles if isinstance(roles, list) else []


def _save_custom_roles(settings: Any, roles: list) -> dict:
    if isinstance(settings, str):
        try:
            settings = json.loads(settings)
        except Exception:
            settings = {}
    settings = settings or {}
    settings["custom_roles"] = roles
    return settings


@router.get("/{org_id}/roles", summary="获取组织角色列表（含自定义角色）")
async def list_org_roles(
    org_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """返回系统预定义角色 + 组织自定义角色。"""
    service = get_org_service(db)
    membership = await service._get_membership(org_id, current_user.id)
    if not membership:
        raise HTTPException(status_code=403, detail="您不是该组织的成员")
    org = await service.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="组织不存在")
    roles = _load_custom_roles(org.settings)
    return {"roles": roles}


@router.post("/{org_id}/roles", summary="创建自定义角色")
async def create_org_role(
    org_id: int,
    request: CustomRoleCreateRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """创建组织自定义角色（OWNER/ADMIN）。"""
    service = get_org_service(db)
    if not await service._check_permission(org_id, current_user.id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
        raise HTTPException(status_code=403, detail="需要 OWNER 或 ADMIN 权限")

    org = await service.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="组织不存在")

    import uuid as _uuid
    roles = _load_custom_roles(org.settings)
    code = f"custom_{_uuid.uuid4().hex[:8]}"
    roles.append({
        "code": code,
        "name": request.name,
        "description": request.description or "",
        "permissions": request.permissions or {},
    })
    settings = _save_custom_roles(org.settings, roles)
    await service.db.execute(
        text("UPDATE organizations SET settings = CAST(:settings AS jsonb), updated_at = NOW() WHERE id = :id"),
        {"settings": json.dumps(settings, ensure_ascii=False), "id": org_id},
    )
    await service.db.commit()
    await service.record_activity(
        org_id, current_user.id, "roles.create",
        target_type="organization", target_id=org_id,
        metadata={"role_code": code, "name": request.name},
    )
    return {"success": True, "role": {"code": code, "name": request.name, "description": request.description or "", "permissions": request.permissions or []}}


@router.put("/{org_id}/roles/{role_code}", summary="更新自定义角色")
async def update_org_role(
    org_id: int,
    role_code: str,
    request: CustomRoleUpdateRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """更新组织自定义角色（OWNER/ADMIN）。"""
    service = get_org_service(db)
    if not await service._check_permission(org_id, current_user.id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
        raise HTTPException(status_code=403, detail="需要 OWNER 或 ADMIN 权限")

    org = await service.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="组织不存在")

    roles = _load_custom_roles(org.settings)
    for r in roles:
        if r.get("code") == role_code:
            if request.name is not None:
                r["name"] = request.name
            if request.description is not None:
                r["description"] = request.description
            if request.permissions is not None:
                r["permissions"] = request.permissions
            break
    else:
        raise HTTPException(status_code=404, detail="角色不存在")

    settings = _save_custom_roles(org.settings, roles)
    await service.db.execute(
        text("UPDATE organizations SET settings = CAST(:settings AS jsonb), updated_at = NOW() WHERE id = :id"),
        {"settings": json.dumps(settings, ensure_ascii=False), "id": org_id},
    )
    await service.db.commit()
    await service.record_activity(
        org_id, current_user.id, "roles.update",
        target_type="organization", target_id=org_id,
        metadata={"role_code": role_code},
    )
    return {"success": True, "role_code": role_code}


@router.delete("/{org_id}/roles/{role_code}", summary="删除自定义角色")
async def delete_org_role(
    org_id: int,
    role_code: str,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
):
    """删除组织自定义角色（OWNER/ADMIN）。"""
    service = get_org_service(db)
    if not await service._check_permission(org_id, current_user.id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
        raise HTTPException(status_code=403, detail="需要 OWNER 或 ADMIN 权限")

    org = await service.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="组织不存在")

    roles = _load_custom_roles(org.settings)
    new_roles = [r for r in roles if r.get("code") != role_code]
    if len(new_roles) == len(roles):
        raise HTTPException(status_code=404, detail="角色不存在")

    settings = _save_custom_roles(org.settings, new_roles)
    await service.db.execute(
        text("UPDATE organizations SET settings = CAST(:settings AS jsonb), updated_at = NOW() WHERE id = :id"),
        {"settings": json.dumps(settings, ensure_ascii=False), "id": org_id},
    )
    await service.db.commit()
    await service.record_activity(
        org_id, current_user.id, "roles.delete",
        target_type="organization", target_id=org_id,
        metadata={"role_code": role_code},
    )
    return {"success": True, "role_code": role_code}


logger.info("多租户管理API路由加载完成")

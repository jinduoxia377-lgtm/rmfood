"""
Multi-tenant organization management service (minimal fix)
"""

import json
import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import text
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class OrganizationRole(Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


class OrganizationPlan(Enum):
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"



class ResourceType(Enum):
    MEMBERS = "members"
    TEAMS = "teams"
    FORMULAS = "formulas"
    STORAGE = "storage"
    API_CALLS = "api_calls"
    AI_GENERATIONS = "ai_generations"
@dataclass
class PlanLimits:
    plan: OrganizationPlan
    max_members: int
    max_teams: int
    max_formulas: int
    storage_mb: int
    api_calls_per_day: int
    ai_generations_per_day: int
    features: List[str]


PLAN_LIMITS = {
    OrganizationPlan.FREE: PlanLimits(
        plan=OrganizationPlan.FREE,
        max_members=5,
        max_teams=2,
        max_formulas=100,
        storage_mb=1024,
        api_calls_per_day=1000,
        ai_generations_per_day=10,
        features=["Basic features", "Community support"],
    ),
    OrganizationPlan.PRO: PlanLimits(
        plan=OrganizationPlan.PRO,
        max_members=20,
        max_teams=10,
        max_formulas=1000,
        storage_mb=10240,
        api_calls_per_day=10000,
        ai_generations_per_day=100,
        features=["All FREE features", "Advanced analytics", "API access", "Priority support", "Custom branding"],
    ),
    OrganizationPlan.ENTERPRISE: PlanLimits(
        plan=OrganizationPlan.ENTERPRISE,
        max_members=-1,
        max_teams=-1,
        max_formulas=-1,
        storage_mb=-1,
        api_calls_per_day=-1,
        ai_generations_per_day=-1,
        features=["All PRO features", "Unlimited resources", "Dedicated manager", "SLA guarantee", "Private deployment", "SSO integration"],
    ),
}


# 订阅价格（分/月、分/年）— 模拟支付阶段仅作展示与订单记录
PRICING = {
    OrganizationPlan.FREE: {"monthly_cents": 0, "yearly_cents": 0},
    OrganizationPlan.PRO: {"monthly_cents": 19900, "yearly_cents": 199900},
    OrganizationPlan.ENTERPRISE: {"monthly_cents": 199900, "yearly_cents": 1999000},
}


class OrganizationService:
    """Multi-tenant organization management service."""

    def __init__(self, db):
        self.db = db

    async def get_organization(self, organization_id: int) -> Any:
        """Get organization by ID."""
        result = await self.db.execute(
            text("SELECT * FROM organizations WHERE id = :id AND is_active = TRUE"),
            {"id": organization_id},
        )
        return result.fetchone()

    async def get_organization_by_slug(self, slug: str) -> Any:
        """Get organization by slug."""
        result = await self.db.execute(
            text("SELECT * FROM organizations WHERE slug = :slug AND is_active = TRUE"),
            {"slug": slug},
        )
        return result.fetchone()

    async def create_organization(
        self,
        owner_id: int,
        name: str,
        slug: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Any:
        """Create a new organization."""
        final_slug = slug or self._generate_slug(name)

        if await self._slug_exists(final_slug):
            raise ValueError(f"Organization slug '{final_slug}' already exists")

        org = {
            "id": 0,
            "name": name,
            "slug": final_slug,
            "description": description,
            "owner_id": owner_id,
            "plan": OrganizationPlan.FREE.value,
            "settings": {},
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

        # Insert into database
        result = await self.db.execute(
            text("""
            INSERT INTO organizations (name, slug, description, owner_id, plan, settings, is_active, created_at, updated_at)
            VALUES (:name, :slug, :description, :owner_id, :plan, :settings, TRUE, :created_at, :updated_at)
            RETURNING id, name, slug, description, owner_id, plan, settings, created_at, updated_at
            """),
            {
                "name": org["name"],
                "slug": org["slug"],
                "description": org["description"],
                "owner_id": org["owner_id"],
                "plan": org["plan"],
                "settings": json.dumps(org["settings"]),
                "created_at": org["created_at"],
                "updated_at": org["updated_at"],
            },
        )
        row = result.fetchone()
        if row is not None:
            org["id"] = row.id
            org["created_at"] = row.created_at
            org["updated_at"] = row.updated_at
            org["settings"] = json.loads(row.settings) if isinstance(row.settings, str) else row.settings

        # Add owner as member
        await self.add_member(org["id"], owner_id, OrganizationRole.OWNER)
        await self.db.commit()

        return org

    async def _slug_exists(self, slug: str) -> bool:
        """Check if slug already exists."""
        result = await self.db.execute(
            text("SELECT 1 FROM organizations WHERE slug = :slug LIMIT 1"),
            {"slug": slug},
        )
        return result.fetchone() is not None

    async def add_member(
        self,
        organization_id: int,
        user_id: int,
        role: OrganizationRole,
        invited_by: Optional[int] = None,
        team_ids: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """Add a member to organization."""
        # 超额拦截：成员数超限（OWNER 首次建组除外——创建组织时 owner 尚不在成员表）
        await self._check_quota(organization_id, "members")

        member = {
            "id": 0,
            "organization_id": organization_id,
            "user_id": user_id,
            "role": role.value,
            "invited_by": invited_by,
            "team_ids": team_ids or [],
            "custom_roles": [],
            "joined_at": datetime.now(timezone.utc),
        }

        result = await self.db.execute(
            text("""
            INSERT INTO organization_members (organization_id, user_id, role, invited_by, team_ids, is_active, joined_at)
            VALUES (:organization_id, :user_id, :role, :invited_by, :team_ids, TRUE, :joined_at)
            RETURNING id
            """),
            {
                "organization_id": member["organization_id"],
                "user_id": member["user_id"],
                "role": member["role"],
                "invited_by": member["invited_by"],
                "team_ids": member["team_ids"] or [],
                "joined_at": member["joined_at"],
            },
        )
        row = result.fetchone()
        member["id"] = int(row.id) if row else 0
        await self.db.commit()

        return member

    async def _check_permission(
        self,
        organization_id: int,
        user_id: int,
        required_roles: List[OrganizationRole],
    ) -> bool:
        """Check if user has required roles in organization."""
        result = await self.db.execute(
            text("""
            SELECT role FROM organization_members
            WHERE organization_id = :org_id AND user_id = :user_id
            """),
            {"org_id": organization_id, "user_id": user_id},
        )
        row = result.fetchone()
        if not row:
            return False
        # 角色统一小写比较，避免历史大写数据（OWNER）导致权限判断失效
        return str(row.role).lower() in [r.value for r in required_roles]

    async def check_org_permission(
        self,
        organization_id: int,
        user_id: int,
        setting_key: str,
    ) -> bool:
        """组织级权限开关校验：OWNER 始终放行；其余成员按 settings.permissions 判断（默认 true）。

        setting_key: member_management / team_management / formula_access /
                     experiment_access / data_export / api_access
        """
        membership = await self._get_membership(organization_id, user_id)
        if not membership:
            return False
        if str(membership.get("role") or "").lower() == OrganizationRole.OWNER.value:
            return True
        org = await self.get_organization(organization_id)
        if not org:
            return False
        settings = org.settings
        if isinstance(settings, str):
            try:
                settings = json.loads(settings)
            except Exception:
                settings = {}
        settings = settings or {}
        permissions = settings.get("permissions") or {}
        return bool(permissions.get(setting_key, True))

    async def member_has_custom_permission(
        self,
        organization_id: int,
        user_id: int,
        resource: str,
        action: str,
    ) -> bool:
        """判断成员是否通过自定义角色获得 resource:action 权限（additive）。"""
        membership = await self._get_membership(organization_id, user_id)
        if not membership:
            return False
        assigned = membership.get("custom_roles") or []
        if isinstance(assigned, str):
            try:
                assigned = json.loads(assigned)
            except Exception:
                assigned = []
        if not assigned:
            return False
        org = await self.get_organization(organization_id)
        if not org:
            return False
        settings = org.settings
        if isinstance(settings, str):
            try:
                settings = json.loads(settings)
            except Exception:
                settings = {}
        settings = settings or {}
        custom_roles = settings.get("custom_roles") or []
        if not isinstance(custom_roles, list):
            return False
        for role in custom_roles:
            if role.get("code") not in assigned:
                continue
            perms = role.get("permissions") or []
            for perm in perms:
                if perm == f"{resource}:{action}" or perm == f"{resource}:*" or perm == "*":
                    return True
        return False

    async def set_member_custom_roles(
        self,
        organization_id: int,
        user_id: int,
        role_codes: List[str],
        actor_id: int,
    ) -> bool:
        """为成员分配自定义角色（仅 OWNER/ADMIN）。"""
        if not await self._check_permission(organization_id, actor_id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
            raise PermissionError("需要管理员权限")
        await self.db.execute(
            text("UPDATE organization_members SET custom_roles = :roles WHERE organization_id = :org_id AND user_id = :user_id"),
            {"roles": list(role_codes or []), "org_id": organization_id, "user_id": user_id},
        )
        await self.db.commit()
        await self.record_activity(
            organization_id, actor_id, "members.custom_roles",
            target_type="user", target_id=user_id,
            metadata={"custom_roles": list(role_codes or [])},
        )
        return True

    async def _check_member_manage(self, organization_id: int, actor_id: int) -> bool:
        """成员管理权限：OWNER/ADMIN，或拥有自定义角色 members:manage。"""
        if await self._check_permission(organization_id, actor_id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
            return True
        return await self.member_has_custom_permission(organization_id, actor_id, "members", "manage")

    async def _check_team_manage(self, organization_id: int, actor_id: int) -> bool:
        """团队管理权限：OWNER/ADMIN，或拥有自定义角色 teams:*。"""
        if await self._check_permission(organization_id, actor_id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
            return True
        return await self.member_has_custom_permission(organization_id, actor_id, "teams", "create")

    async def _get_membership(self, organization_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        """Get membership info."""
        result = await self.db.execute(
            text("""
            SELECT * FROM organization_members
            WHERE organization_id = :org_id AND user_id = :user_id
            """),
            {"org_id": organization_id, "user_id": user_id},
        )
        row = result.fetchone()
        if row is None:
            return None
        membership = dict(row._mapping)
        # 角色统一小写，避免历史大写数据造成前端/权限判断不一致
        if membership.get("role"):
            membership["role"] = str(membership["role"]).lower()
        return membership

    async def _check_quota(self, organization_id: int, resource: str) -> None:
        """Raise PermissionError if the org has exceeded the plan limit for a resource."""
        usage = await self.get_quota_usage(organization_id)
        item = usage.get(resource)
        if item and item.get("over"):
            raise PermissionError(
                f"当前计划（{usage.get('plan')}）的{resource}上限为 {item.get('limit')}，已使用 {item.get('used')}，请升级计划后继续。 [org_id={organization_id}]"
            )

    def _generate_slug(self, name: str) -> str:
        """Generate URL-friendly slug from name."""
        slug = re.sub(r'[^\w\s-]', '', name).strip().lower()
        slug = re.sub(r'[\s]+', '-', slug)
        return slug

    # Additional methods for organization management...
    async def get_members(self, organization_id: int) -> List[Dict[str, Any]]:
        """Get all members of organization."""
        result = await self.db.execute(
            text("""
            SELECT m.*, u.email, u.username
            FROM organization_members m
            JOIN users u ON m.user_id = u.id
            WHERE m.organization_id = :org_id
            ORDER BY m.joined_at DESC
            """),
            {"org_id": organization_id},
        )
        return [dict(row._mapping) for row in result.fetchall()]

    async def archive_organization(self, organization_id: int, actor_id: int) -> bool:
        """Archive organization (soft delete, recoverable)."""
        if not await self._check_permission(organization_id, actor_id, [OrganizationRole.OWNER]):
            raise PermissionError("Only organization owner can archive")
        
        await self.db.execute(
            text("UPDATE organizations SET is_active = FALSE WHERE id = :id"),
            {"id": organization_id},
        )
        await self.db.commit()
        return True

    async def restore_organization(self, organization_id: int, actor_id: int) -> bool:
        """Restore archived organization."""
        if not await self._check_permission(organization_id, actor_id, [OrganizationRole.OWNER]):
            raise PermissionError("Only organization owner can restore")
        
        await self.db.execute(
            text("UPDATE organizations SET is_active = TRUE WHERE id = :id"),
            {"id": organization_id},
        )
        await self.db.commit()
        return True

    async def clone_organization(
        self,
        source_org_id: int,
        actor_id: int,
        new_name: str,
    ) -> int:
        """Clone organization (deep copy: members, teams, permission settings)."""
        if not await self._check_permission(source_org_id, actor_id, [OrganizationRole.OWNER]):
            raise PermissionError("Only organization owner can clone")

        source_org = await self.get_organization(source_org_id)
        if not source_org:
            raise ValueError("Source organization not found")

        # 1. 创建新组织
        new_org = await self.create_organization(
            owner_id=actor_id,
            name=new_name,
            description=f"Cloned from {source_org['name'] if isinstance(source_org, dict) else source_org.name}",
        )
        new_id = new_org["id"] if isinstance(new_org, dict) else new_org.id

        # 2. 复制设置（含权限矩阵）
        source_settings = (
            json.loads(source_org["settings"]) if isinstance(source_org, dict) and isinstance(source_org.get("settings"), str)
            else json.loads(source_org.settings) if isinstance(source_org.settings, str)
            else (source_org["settings"] if isinstance(source_org, dict) else source_org.settings or {})
        )
        if source_settings:
            await self.update_organization(new_id, actor_id, settings=source_settings)

        # 3. 复制团队（映射旧团队 id → 新团队 id）
        team_id_map: Dict[int, int] = {}
        source_teams = await self.get_teams(source_org_id)
        for t in source_teams:
            tid_row = await self.create_team(new_id, t["name"], actor_id, t.get("description"))
            tid = tid_row["id"] if isinstance(tid_row, dict) else tid_row.id
            team_id_map[int(t["id"])] = int(tid)

        # 4. 复制成员（actor 已是新组织 OWNER，跳过）
        source_members = await self.get_members(source_org_id)
        for m in source_members:
            if int(m["user_id"]) == actor_id:
                continue
            try:
                member_team_ids = [
                    team_id_map[int(x)] for x in (m.get("team_ids") or []) if int(x) in team_id_map
                ]
                await self.add_member(
                    new_id,
                    int(m["user_id"]),
                    OrganizationRole(m["role"]),
                    invited_by=actor_id,
                    team_ids=member_team_ids,
                )
            except (PermissionError, Exception):
                # 成员数超限等原因导致复制失败时跳过，不影响主流程
                continue

        await self.record_activity(
            new_id, actor_id, "organization.clone",
            target_type="organization", target_id=new_id,
            metadata={"source": source_org_id},
        )
        return new_id

    async def suspend_member(self, organization_id: int, user_id: int, actor_id: int) -> bool:
        """Suspend member (keep record but disable access)."""
        if not await self._check_member_manage(organization_id, actor_id):
            raise PermissionError("Permission denied")
        
        await self.db.execute(
            text("UPDATE organization_members SET is_active = FALSE WHERE organization_id = :org_id AND user_id = :user_id"),
            {"org_id": organization_id, "user_id": user_id},
        )
        await self.db.commit()
        return True

    async def resume_member(self, organization_id: int, user_id: int, actor_id: int) -> bool:
        """Resume suspended member."""
        if not await self._check_member_manage(organization_id, actor_id):
            raise PermissionError("Permission denied")
        
        await self.db.execute(
            text("UPDATE organization_members SET is_active = TRUE WHERE organization_id = :org_id AND user_id = :user_id"),
            {"org_id": organization_id, "user_id": user_id},
        )
        await self.db.commit()
        return True

    async def get_teams(self, organization_id: int) -> List[Dict[str, Any]]:
        """Get all teams of organization (含 slug 与成员列表，供前端完整展示)。"""
        result = await self.db.execute(
            text("""
            SELECT * FROM teams
            WHERE org_id = :org_id
            ORDER BY name ASC
            """),
            {"org_id": organization_id},
        )
        teams = [dict(row._mapping) for row in result.fetchall()]
        for t in teams:
            t["slug"] = t.get("slug") or f"team-{t['id']}"
            member_rows = (await self.db.execute(
                text("""
                SELECT user_id FROM organization_members
                WHERE organization_id = :org_id AND :team_id = ANY(team_ids) AND is_active = TRUE
                """),
                {"org_id": organization_id, "team_id": t["id"]},
            )).fetchall()
            t["member_ids"] = [r.user_id for r in member_rows]
        return teams

    async def create_team(
        self,
        org_id: int,
        name: str,
        creator_id: int,
        description: Optional[str] = None,
    ) -> Any:
        """Create a new team in organization."""
        if not await self._check_team_manage(org_id, creator_id):
            raise PermissionError("Only OWNER or ADMIN (or members with teams:create custom role) can create teams")
        await self._check_quota(org_id, "teams")

        result = await self.db.execute(
            text("""
            INSERT INTO teams (org_id, name, description, lead_id, created_at)
            VALUES (:org_id, :name, :description, :creator_id, NOW())
            RETURNING *
            """),
            {"org_id": org_id, "name": name, "description": description, "creator_id": creator_id},
        )
        team_row = result.fetchone()
        await self.db.commit()
        return team_row

    async def update_team(
        self,
        org_id: int,
        team_id: int,
        actor_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> bool:
        """Update team name/description."""
        if not await self._check_team_manage(org_id, actor_id):
            raise PermissionError("Only OWNER or ADMIN (or members with teams:* custom role) can update teams")
        set_clauses = ["updated_at = NOW()"]
        params: Dict[str, Any] = {"org_id": org_id, "team_id": team_id}
        if name is not None:
            set_clauses.append("name = :name")
            params["name"] = name
        if description is not None:
            set_clauses.append("description = :description")
            params["description"] = description
        if len(set_clauses) == 1:
            return True
        await self.db.execute(
            text(f"UPDATE teams SET {', '.join(set_clauses)} WHERE org_id = :org_id AND id = :team_id"),
            params,
        )
        await self.db.commit()
        return True

    async def delete_team(self, org_id: int, team_id: int, actor_id: int) -> bool:
        """Delete a team."""
        if not await self._check_team_manage(org_id, actor_id):
            raise PermissionError("Only OWNER or ADMIN (or members with teams:* custom role) can delete teams")
        await self.db.execute(
            text("DELETE FROM teams WHERE org_id = :org_id AND id = :team_id"),
            {"org_id": org_id, "team_id": team_id},
        )
        await self.db.commit()
        # rowcount 在 asyncpg 下可能返回 -1，只要执行成功即返回 True
        return True

    async def update_organization(
        self,
        organization_id: int,
        actor_id: int,
        **updates,
    ) -> Any:
        """Update organization fields."""
        if not await self._check_permission(organization_id, actor_id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
            raise PermissionError("Only OWNER or ADMIN can update organization")

        set_clauses = []
        params: Dict[str, Any] = {"id": organization_id}
        for key, value in updates.items():
            if value is not None:
                set_clauses.append(f"{key} = :{key}")
                params[key] = json.dumps(value) if isinstance(value, dict) else value
        if not set_clauses:
            return await self.get_organization(organization_id)
        set_clauses.append("updated_at = NOW()")
        await self.db.execute(
            text(f"UPDATE organizations SET {', '.join(set_clauses)} WHERE id = :id"),
            params,
        )
        await self.db.commit()
        return await self.get_organization(organization_id)

    async def delete_organization(self, organization_id: int, actor_id: int) -> bool:
        """Permanently delete organization (only OWNER)."""
        if not await self._check_permission(organization_id, actor_id, [OrganizationRole.OWNER]):
            raise PermissionError("Only OWNER can delete organization")

        await self.db.execute(
            text("DELETE FROM teams WHERE org_id = :id"),
            {"id": organization_id},
        )
        await self.db.execute(
            text("DELETE FROM organization_members WHERE organization_id = :id"),
            {"id": organization_id},
        )
        await self.db.execute(
            text("DELETE FROM organizations WHERE id = :id"),
            {"id": organization_id},
        )
        await self.db.commit()
        return True

    async def remove_member(self, organization_id: int, user_id: int, actor_id: int) -> bool:
        """Remove a member from organization."""
        if not await self._check_member_manage(organization_id, actor_id):
            raise PermissionError("Permission denied")
        if organization_id == actor_id:
            raise ValueError("Cannot remove yourself from the organization")

        await self.db.execute(
            text("DELETE FROM organization_members WHERE organization_id = :org_id AND user_id = :user_id"),
            {"org_id": organization_id, "user_id": user_id},
        )
        await self.db.commit()
        return True

    async def change_role(
        self,
        organization_id: int,
        user_id: int,
        role: str,
        actor_id: int,
    ) -> bool:
        """Change member role in organization."""
        if not await self._check_member_manage(organization_id, actor_id):
            raise PermissionError("Permission denied")

        await self.db.execute(
            text("UPDATE organization_members SET role = :role WHERE organization_id = :org_id AND user_id = :user_id"),
            {"role": role, "org_id": organization_id, "user_id": user_id},
        )
        await self.db.commit()
        return True

    async def get_quota_usage(self, organization_id: int) -> Dict[str, Any]:
        """Get real resource quota usage for organization."""
        result = await self.db.execute(
            text("SELECT plan FROM organizations WHERE id = :id"),
            {"id": organization_id},
        )
        row = result.fetchone()
        plan_name = row.plan if row else "free"
        try:
            plan_enum = OrganizationPlan(plan_name)
        except ValueError:
            plan_enum = OrganizationPlan.FREE
        limits = PLAN_LIMITS.get(plan_enum, PLAN_LIMITS[OrganizationPlan.FREE])

        # 真实用量统计
        members = (await self.db.execute(
            text("SELECT COUNT(*) FROM organization_members WHERE organization_id = :id AND is_active = TRUE"),
            {"id": organization_id},
        )).scalar() or 0

        teams = (await self.db.execute(
            text("SELECT COUNT(*) FROM teams WHERE org_id = :id"),
            {"id": organization_id},
        )).scalar() or 0

        formulas = (await self.db.execute(
            text("SELECT COUNT(*) FROM formulas WHERE organization_id = :id"),
            {"id": organization_id},
        )).scalar() or 0

        storage = (await self.db.execute(
            text("""
                SELECT COALESCE(SUM(a.file_size), 0) FROM attachments a
                WHERE a.uploaded_by IN (
                    SELECT user_id FROM organization_members WHERE organization_id = :id
                )
            """),
            {"id": organization_id},
        )).scalar() or 0

        # API 调用 / AI 生成：以审计日志为代理计数（当日）
        api_calls = (await self.db.execute(
            text("""
                SELECT COUNT(*) FROM audit_logs
                WHERE user_id IN (SELECT user_id FROM organization_members WHERE organization_id = :id)
                  AND created_at >= CURRENT_DATE
            """),
            {"id": organization_id},
        )).scalar() or 0

        ai_generations = (await self.db.execute(
            text("""
                SELECT COUNT(*) FROM audit_logs
                WHERE user_id IN (SELECT user_id FROM organization_members WHERE organization_id = :id)
                  AND created_at >= CURRENT_DATE
                  AND action ILIKE '%ai%'
            """),
            {"id": organization_id},
        )).scalar() or 0

        def _over(used: int, limit: int) -> bool:
            return limit >= 0 and used > limit

        return {
            "plan": plan_enum.value,
            "members": {"used": int(members), "limit": limits.max_members, "over": _over(int(members), limits.max_members)},
            "teams": {"used": int(teams), "limit": limits.max_teams, "over": _over(int(teams), limits.max_teams)},
            "formulas": {"used": int(formulas), "limit": limits.max_formulas, "over": _over(int(formulas), limits.max_formulas)},
            "storage": {"used": int(storage), "limit": limits.storage_mb * 1024 * 1024, "over": _over(int(storage), limits.storage_mb * 1024 * 1024)},
            "api_calls": {"used": int(api_calls), "limit": limits.api_calls_per_day, "over": _over(int(api_calls), limits.api_calls_per_day)},
            "ai_generations": {"used": int(ai_generations), "limit": limits.ai_generations_per_day, "over": _over(int(ai_generations), limits.ai_generations_per_day)},
        }

    async def export_organization(
        self,
        organization_id: int,
        format_type: str = "json",
    ) -> Dict[str, Any]:
        """Export organization data (members/teams/settings)."""
        org = await self.get_organization(organization_id)
        if not org:
            raise ValueError("Organization not found")

        members = await self.get_members(organization_id)
        teams = await self.get_teams(organization_id)

        data = {
            "organization": {
                "id": org.id,
                "name": org.name,
                "slug": org.slug,
                "description": org.description,
                "plan": org.plan.value if hasattr(org.plan, "value") else org.plan,
                "settings": org.settings,
            },
            "members": members,
            "teams": teams,
            "exported_at": datetime.now(timezone.utc).isoformat(),
        }

        if format_type == "csv":
            import csv, io
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
            return {"format": "csv", "data": buf.getvalue(), "size_bytes": len(buf.getvalue().encode("utf-8"))}

        json_str = json.dumps(data, ensure_ascii=False, default=str)
        return {"format": "json", "data": json_str, "size_bytes": len(json_str.encode("utf-8"))}

    # ── 审计活动 ──
    async def record_activity(
        self,
        organization_id: int,
        user_id: int,
        action_type: str,
        target_type: Optional[str] = None,
        target_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
    ) -> None:
        """Write an organization activity/audit record."""
        await self.db.execute(
            text("""
                INSERT INTO organization_activities
                    (org_id, user_id, action_type, target_type, target_id, metadata, ip_address, created_at, updated_at)
                VALUES (:org_id, :user_id, :action_type, :target_type, :target_id, :metadata, :ip_address, NOW(), NOW())
            """),
            {
                "org_id": organization_id,
                "user_id": user_id,
                "action_type": action_type,
                "target_type": target_type,
                "target_id": target_id,
                "metadata": json.dumps(metadata or {}, ensure_ascii=False),
                "ip_address": ip_address,
            },
        )
        await self.db.commit()

    async def get_audit_log(
        self,
        organization_id: int,
        limit: int = 50,
        offset: int = 0,
        action_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get real organization audit log from organization_activities."""
        where_sql = " WHERE org_id = :id"
        params: Dict[str, Any] = {"id": organization_id}
        if action_type:
            where_sql += " AND a.action_type = :action_type"
            params["action_type"] = action_type

        total = (await self.db.execute(
            text(f"SELECT COUNT(*) FROM organization_activities a{where_sql}"),
            params,
        )).scalar() or 0

        rows = (await self.db.execute(
            text(f"""
                SELECT a.*, u.username
                FROM organization_activities a
                LEFT JOIN users u ON a.user_id = u.id
                {where_sql}
                ORDER BY a.created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {**params, "limit": limit, "offset": offset},
        )).fetchall()

        logs = [dict(r._mapping) for r in rows]
        for log in logs:
            log["created_at"] = log.get("created_at").isoformat() if log.get("created_at") else None
            if isinstance(log.get("metadata"), str):
                try:
                    log["metadata"] = json.loads(log["metadata"])
                except Exception:
                    pass
        return {"logs": logs, "total": int(total), "limit": limit, "offset": offset}

    # ── 数据分析（真实聚合）──
    async def get_analytics(self, organization_id: int, time_range: str = "30d") -> Dict[str, Any]:
        """Real organization analytics: member trend, team count, storage, api stats."""
        days = {"7d": 7, "30d": 30, "90d": 90}.get(time_range, 30)

        member_trend_rows = (await self.db.execute(
            text("""
                SELECT DATE(joined_at) AS d, COUNT(*) AS cnt
                FROM organization_members
                WHERE organization_id = :id AND joined_at >= CURRENT_DATE - (:days || ' days')::interval
                GROUP BY DATE(joined_at) ORDER BY d ASC
            """),
            {"id": organization_id, "days": str(days)},
        )).fetchall()

        member_trend = [{"date": str(r.d), "count": int(r.cnt)} for r in member_trend_rows]

        total_members = (await self.db.execute(
            text("SELECT COUNT(*) FROM organization_members WHERE organization_id = :id AND is_active = TRUE"),
            {"id": organization_id},
        )).scalar() or 0

        total_teams = (await self.db.execute(
            text("SELECT COUNT(*) FROM teams WHERE org_id = :id"),
            {"id": organization_id},
        )).scalar() or 0

        storage_used = (await self.db.execute(
            text("""
                SELECT COALESCE(SUM(a.file_size), 0) FROM attachments a
                WHERE a.uploaded_by IN (SELECT user_id FROM organization_members WHERE organization_id = :id)
            """),
            {"id": organization_id},
        )).scalar() or 0

        api_rows = (await self.db.execute(
            text("""
                SELECT COUNT(*) AS total,
                       COALESCE(AVG(LENGTH(COALESCE(details::text, ''))), 0) AS avg_meta
                FROM audit_logs
                WHERE user_id IN (SELECT user_id FROM organization_members WHERE organization_id = :id)
                  AND created_at >= CURRENT_DATE - (:days || ' days')::interval
            """),
            {"id": organization_id, "days": str(days)},
        )).fetchone()

        return {
            "total_members": int(total_members),
            "total_teams": int(total_teams),
            "storage_used_mb": round(int(storage_used) / (1024 * 1024), 2),
            "api_stats": {
                "total_calls": int(api_rows.total) if api_rows else 0,
                "avg_response_time": 0,
                "error_rate": 0,
            },
            "member_trend": member_trend,
            "storage_trend": [],
            "time_range": time_range,
        }

    # ── 订阅与模拟支付 ──
    async def get_subscription(self, organization_id: int) -> Dict[str, Any]:
        """Get current subscription info (plan + status + usage)."""
        org = await self.get_organization(organization_id)
        if not org:
            raise ValueError("Organization not found")

        plan_name = org.plan.value if hasattr(org.plan, "value") else org.plan
        try:
            plan_enum = OrganizationPlan(plan_name)
        except ValueError:
            plan_enum = OrganizationPlan.FREE

        sub_row = (await self.db.execute(
            text("SELECT * FROM subscriptions WHERE organization_id = :id ORDER BY id DESC LIMIT 1"),
            {"id": organization_id},
        )).fetchone()

        usage = await self.get_quota_usage(organization_id)

        return {
            "organization_id": organization_id,
            "plan": plan_enum.value,
            "plan_display_name": {"free": "免费版", "pro": "专业版", "enterprise": "企业版"}.get(plan_enum.value, plan_enum.value),
            "status": sub_row.status if sub_row else ("active" if plan_enum.value != "free" else "active"),
            "billing_cycle": sub_row.billing_cycle if sub_row else "monthly",
            "started_at": sub_row.started_at.isoformat() if sub_row and sub_row.started_at else None,
            "expires_at": sub_row.expires_at.isoformat() if sub_row and sub_row.expires_at else None,
            "usage": usage,
        }

    async def upgrade_subscription(
        self,
        organization_id: int,
        plan: str,
        billing_cycle: str = "monthly",
        actor_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Upgrade organization plan with mock payment (creates paid order + updates plan)."""
        try:
            plan_enum = OrganizationPlan(plan)
        except ValueError:
            raise ValueError(f"无效的计划: {plan}")

        org = await self.get_organization(organization_id)
        if not org:
            raise ValueError("Organization not found")

        price = PRICING.get(plan_enum, {"monthly_cents": 0, "yearly_cents": 0})
        amount_cents = price.get("yearly_cents", 0) if billing_cycle == "yearly" else price.get("monthly_cents", 0)

        # 模拟支付：生成已支付订单
        import uuid as _uuid
        order_id = f"MOCK-{_uuid.uuid4().hex[:12].upper()}"
        await self.db.execute(
            text("""
                INSERT INTO billing_orders
                    (organization_id, plan, billing_cycle, amount_cents, currency, status, provider_order_id, paid_at, created_at, updated_at)
                VALUES (:org_id, :plan, :cycle, :amount, 'CNY', 'paid', :order_id, NOW(), NOW(), NOW())
            """),
            {"org_id": organization_id, "plan": plan_enum.value, "cycle": billing_cycle, "amount": amount_cents, "order_id": order_id},
        )

        # 更新组织计划
        await self.db.execute(
            text("UPDATE organizations SET plan = :plan, updated_at = NOW() WHERE id = :id"),
            {"plan": plan_enum.value, "id": organization_id},
        )

        # 更新/插入订阅记录
        existing = (await self.db.execute(
            text("SELECT id FROM subscriptions WHERE organization_id = :id ORDER BY id DESC LIMIT 1"),
            {"id": organization_id},
        )).fetchone()
        if existing:
            await self.db.execute(
                text("""
                    UPDATE subscriptions SET plan = :plan, status = 'active', billing_cycle = :cycle, started_at = NOW(), updated_at = NOW()
                    WHERE id = :sub_id
                """),
                {"plan": plan_enum.value, "cycle": billing_cycle, "sub_id": existing.id},
            )
        else:
            await self.db.execute(
                text("""
                    INSERT INTO subscriptions (organization_id, plan, status, billing_cycle, started_at, payment_provider, external_id, created_at, updated_at)
                    VALUES (:org_id, :plan, 'active', :cycle, NOW(), 'mock', :order_id, NOW(), NOW())
                """),
                {"org_id": organization_id, "plan": plan_enum.value, "cycle": billing_cycle, "order_id": order_id},
            )

        await self.db.commit()

        if actor_id:
            await self.record_activity(
                organization_id, actor_id, "plan.upgrade",
                target_type="organization", target_id=organization_id,
                metadata={"plan": plan_enum.value, "billing_cycle": billing_cycle, "amount_cents": amount_cents},
            )

        return {
            "success": True,
            "organization_id": organization_id,
            "plan": plan_enum.value,
            "billing_cycle": billing_cycle,
            "amount_cents": amount_cents,
            "order_id": order_id,
            "message": f"已升级到 {plan_enum.value} 计划（模拟支付成功）",
        }

    async def cancel_subscription(self, organization_id: int, actor_id: Optional[int] = None) -> Dict[str, Any]:
        """Cancel subscription (status -> canceled; plan retained until period end in real billing)."""
        existing = (await self.db.execute(
            text("SELECT id FROM subscriptions WHERE organization_id = :id ORDER BY id DESC LIMIT 1"),
            {"id": organization_id},
        )).fetchone()
        if existing:
            await self.db.execute(
                text("UPDATE subscriptions SET status = 'canceled', updated_at = NOW() WHERE id = :sub_id"),
                {"sub_id": existing.id},
            )
            await self.db.commit()

        if actor_id:
            await self.record_activity(
                organization_id, actor_id, "plan.cancel",
                target_type="organization", target_id=organization_id,
            )

        return {"success": True, "organization_id": organization_id, "message": "订阅已取消"}

    # ── 批量成员操作 ──
    async def batch_change_role(self, organization_id: int, user_ids: List[int], role: str, actor_id: int) -> int:
        if not await self._check_member_manage(organization_id, actor_id):
            raise PermissionError("Permission denied")
        result = await self.db.execute(
            text("""
                UPDATE organization_members SET role = :role
                WHERE organization_id = :org_id AND user_id = ANY(:user_ids)
            """),
            {"role": role, "org_id": organization_id, "user_ids": list(user_ids)},
        )
        await self.db.commit()
        await self.record_activity(
            organization_id, actor_id, "members.batch_role",
            target_type="organization", target_id=organization_id,
            metadata={"user_ids": user_ids, "role": role},
        )
        return result.rowcount or 0

    async def batch_suspend_members(self, organization_id: int, user_ids: List[int], actor_id: int) -> int:
        if not await self._check_member_manage(organization_id, actor_id):
            raise PermissionError("Permission denied")
        result = await self.db.execute(
            text("UPDATE organization_members SET is_active = FALSE WHERE organization_id = :org_id AND user_id = ANY(:user_ids)"),
            {"org_id": organization_id, "user_ids": list(user_ids)},
        )
        await self.db.commit()
        await self.record_activity(
            organization_id, actor_id, "members.batch_suspend",
            target_type="organization", target_id=organization_id,
            metadata={"user_ids": user_ids},
        )
        return result.rowcount or 0

    async def batch_resume_members(self, organization_id: int, user_ids: List[int], actor_id: int) -> int:
        if not await self._check_member_manage(organization_id, actor_id):
            raise PermissionError("Permission denied")
        result = await self.db.execute(
            text("UPDATE organization_members SET is_active = TRUE WHERE organization_id = :org_id AND user_id = ANY(:user_ids)"),
            {"org_id": organization_id, "user_ids": list(user_ids)},
        )
        await self.db.commit()
        await self.record_activity(
            organization_id, actor_id, "members.batch_resume",
            target_type="organization", target_id=organization_id,
            metadata={"user_ids": user_ids},
        )
        return result.rowcount or 0

    async def batch_remove_members(self, organization_id: int, user_ids: List[int], actor_id: int) -> int:
        if not await self._check_member_manage(organization_id, actor_id):
            raise PermissionError("Permission denied")
        if actor_id in user_ids:
            raise ValueError("Cannot remove yourself from the organization")
        result = await self.db.execute(
            text("DELETE FROM organization_members WHERE organization_id = :org_id AND user_id = ANY(:user_ids)"),
            {"org_id": organization_id, "user_ids": list(user_ids)},
        )
        await self.db.commit()
        await self.record_activity(
            organization_id, actor_id, "members.batch_remove",
            target_type="organization", target_id=organization_id,
            metadata={"user_ids": user_ids},
        )
        return result.rowcount or 0


def get_org_service(db) -> OrganizationService:
    """Get organization service instance."""
    return OrganizationService(db)


async def ensure_ai_quota(db, user_id: int) -> None:
    """跨模块 AI 配额检查：查找用户的默认组织并校验 ai_generations 上限。

    超限时抛出 PermissionError（调用方转为 403 + upgrade_required 语义）。
    """
    row = (await db.execute(
        text("SELECT organization_id FROM organization_members WHERE user_id = :uid AND is_active = TRUE ORDER BY id LIMIT 1"),
        {"uid": user_id},
    )).fetchone()
    if not row:
        return
    svc = get_org_service(db)
    await svc._check_quota(row.organization_id, "ai_generations")


logger.info("Multi-tenant organization management system initialized")

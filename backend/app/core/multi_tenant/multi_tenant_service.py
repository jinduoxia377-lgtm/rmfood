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
        await self.db.execute(
            text("""
            INSERT INTO organizations (name, slug, description, owner_id, plan, settings, created_at, updated_at)
            VALUES (:name, :slug, :description, :owner_id, :plan, :settings, :created_at, :updated_at)
            RETURNING *
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

        # Add owner as member
        await self.add_member(org["id"], owner_id, OrganizationRole.OWNER)

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
        member = {
            "id": 0,
            "organization_id": organization_id,
            "user_id": user_id,
            "role": role.value,
            "invited_by": invited_by,
            "team_ids": team_ids or [],
            "joined_at": datetime.now(timezone.utc),
        }

        await self.db.execute(
            text("""
            INSERT INTO organization_members (organization_id, user_id, role, invited_by, team_ids, joined_at)
            VALUES (:organization_id, :user_id, :role, :invited_by, :team_ids, :joined_at)
            """),
            {
                "organization_id": member["organization_id"],
                "user_id": member["user_id"],
                "role": member["role"],
                "invited_by": member["invited_by"],
                "team_ids": json.dumps(member["team_ids"]),
                "joined_at": member["joined_at"],
            },
        )

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
        return row.role in [r.value for r in required_roles]

    async def _get_membership(self, organization_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        """Get membership info."""
        result = await self.db.execute(
            text("""
            SELECT * FROM organization_members
            WHERE organization_id = :org_id AND user_id = :user_id
            """),
            {"org_id": organization_id, "user_id": user_id},
        )
        return result.fetchone()

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
        return True

    async def restore_organization(self, organization_id: int, actor_id: int) -> bool:
        """Restore archived organization."""
        if not await self._check_permission(organization_id, actor_id, [OrganizationRole.OWNER]):
            raise PermissionError("Only organization owner can restore")
        
        await self.db.execute(
            text("UPDATE organizations SET is_active = TRUE WHERE id = :id"),
            {"id": organization_id},
        )
        return True

    async def clone_organization(
        self,
        source_org_id: int,
        actor_id: int,
        new_name: str,
    ) -> int:
        """Clone organization (copy basic info only)."""
        if not await self._check_permission(source_org_id, actor_id, [OrganizationRole.OWNER]):
            raise PermissionError("Only organization owner can clone")
        
        # Create new organization
        source_org = await self.get_organization(source_org_id)
        if not source_org:
            raise ValueError("Source organization not found")
        
        new_org = await self.create_organization(
            owner_id=actor_id,
            name=new_name,
            description=f"Cloned from {source_org.name}",
        )
        
        return new_org["id"]

    async def suspend_member(self, organization_id: int, user_id: int, actor_id: int) -> bool:
        """Suspend member (keep record but disable access)."""
        if not await self._check_permission(organization_id, actor_id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
            raise PermissionError("Permission denied")
        
        await self.db.execute(
            text("UPDATE organization_members SET is_active = FALSE WHERE organization_id = :org_id AND user_id = :user_id"),
            {"org_id": organization_id, "user_id": user_id},
        )
        return True

    async def resume_member(self, organization_id: int, user_id: int, actor_id: int) -> bool:
        """Resume suspended member."""
        if not await self._check_permission(organization_id, actor_id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
            raise PermissionError("Permission denied")
        
        await self.db.execute(
            text("UPDATE organization_members SET is_active = TRUE WHERE organization_id = :org_id AND user_id = :user_id"),
            {"org_id": organization_id, "user_id": user_id},
        )
        return True

    async def get_analytics(self, organization_id: int, time_range: str = "30d") -> Dict[str, Any]:
        """Get organization analytics."""
        # Implementation would query various metrics
        return {
            "total_members": 0,
            "total_teams": 0,
            "storage_used_mb": 0,
            "api_stats": {
                "total_calls": 0,
                "avg_response_time": 0,
                "error_rate": 0,
            },
            "member_trend": [],
            "storage_trend": [],
            "time_range": time_range,
        }

    async def get_teams(self, organization_id: int) -> List[Dict[str, Any]]:
        """Get all teams of organization."""
        result = await self.db.execute(
            text("""
            SELECT * FROM teams
            WHERE org_id = :org_id
            ORDER BY name ASC
            """),
            {"org_id": organization_id},
        )
        return [dict(row._mapping) for row in result.fetchall()]

    async def create_team(
        self,
        org_id: int,
        name: str,
        creator_id: int,
        description: Optional[str] = None,
    ) -> Any:
        """Create a new team in organization."""
        if not await self._check_permission(org_id, creator_id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
            raise PermissionError("Only OWNER or ADMIN can create teams")

        result = await self.db.execute(
            text("""
            INSERT INTO teams (org_id, name, description, created_by, created_at)
            VALUES (:org_id, :name, :description, :creator_id, NOW())
            RETURNING *
            """),
            {"org_id": org_id, "name": name, "description": description, "creator_id": creator_id},
        )
        team_row = result.fetchone()
        return team_row

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
            text("DELETE FROM teams WHERE organization_id = :id"),
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
        if not await self._check_permission(organization_id, actor_id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
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
        if not await self._check_permission(organization_id, actor_id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
            raise PermissionError("Permission denied")

        await self.db.execute(
            text("UPDATE organization_members SET role = :role WHERE organization_id = :org_id AND user_id = :user_id"),
            {"role": role, "org_id": organization_id, "user_id": user_id},
        )
        await self.db.commit()
        return True

    async def get_quota_usage(self, organization_id: int) -> Dict[str, Any]:
        """Get resource quota usage for organization."""
        result = await self.db.execute(
            text("SELECT plan FROM organizations WHERE id = :id"),
            {"id": organization_id},
        )
        row = result.fetchone()
        plan_name = row.plan if row else "free"
        plan_enum = OrganizationPlan(plan_name) if isinstance(plan_name, str) else plan_name
        limits = PLAN_LIMITS.get(plan_enum, PLAN_LIMITS[OrganizationPlan.FREE])

        return {
            "members": {"used": 1, "limit": limits.max_members},
            "teams": {"used": 0, "limit": limits.max_teams},
            "formulas": {"used": 0, "limit": limits.max_formulas},
            "storage": {"used": 0, "limit": limits.storage_mb},
            "api_calls": {"used": 0, "limit": limits.api_calls_per_day},
            "ai_generations": {"used": 0, "limit": limits.ai_generations_per_day},
        }

    async def get_audit_log(
        self,
        organization_id: int,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Get organization audit log."""
        return {
            "logs": [],
            "total": 0,
            "limit": limit,
            "offset": offset,
        }

    async def export_organization(
        self,
        organization_id: int,
        format_type: str = "json",
    ) -> Dict[str, Any]:
        """Export organization data."""
        return {
            "format": format_type,
            "data": {},
            "size_bytes": 0,
        }


def get_org_service(db) -> OrganizationService:
    """Get organization service instance."""
    return OrganizationService(db)


logger.info("Multi-tenant organization management system initialized")

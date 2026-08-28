"""
企业级多租户组织管理系统

功能:
- 组织 (Organization) 创建与管理
- 团队 (Team) 与成员管理
- 角色权限矩阵 (RBAC)
- 资源配额管理 (Quotas)
- 组织设置与计费
- 数据隔离与安全
"""

import json
import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Set

from sqlalchemy import text


logger = logging.getLogger(__name__)


# ============================================================
# Enums & Models
# ============================================================

class OrganizationRole(str, Enum):
    """组织角色"""
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    GUEST = "guest"


class OrganizationPlan(str, Enum):
    """订阅计划"""
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class ResourceType(str, Enum):
    """资源类型"""
    FORMULAS = "formulas"
    EXPERIMENTS = "experiments"
    STORAGE = "storage"
    API_CALLS = "api_calls"
    AI_GENERATIONS = "ai_generations"
    MEMBERS = "members"
    TEAMS = "teams"


@dataclass
class Organization:
    """组织"""
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    owner_id: int = 0
    plan: OrganizationPlan = OrganizationPlan.FREE
    settings: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True


@dataclass
class Team:
    """团队"""
    id: int
    organization_id: int
    name: str
    description: Optional[str] = None
    lead_id: Optional[int] = None
    members: List[int] = field(default_factory=list)
    permissions: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class OrganizationMember:
    """组织成员"""
    user_id: int
    organization_id: int
    role: OrganizationRole = OrganizationRole.MEMBER
    team_ids: List[int] = field(default_factory=list)
    joined_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    invited_by: Optional[int] = None


@dataclass
class QuotaUsage:
    """配额使用情况"""
    resource_type: ResourceType
    used: float
    limit: float
    unit: str = ""
    reset_date: Optional[datetime] = None

    @property
    def percentage(self) -> float:
        if self.limit == 0:
            return 0
        return round((self.used / self.limit) * 100, 2)

    @property
    def is_exceeded(self) -> bool:
        return self.used >= self.limit

    @property
    def remaining(self) -> float:
        return max(0, self.limit - self.used)


@dataclass
class PlanLimits:
    """计划限制"""
    plan: OrganizationPlan
    max_members: int
    max_teams: int
    max_formulas: int
    storage_mb: int
    api_calls_per_day: int
    ai_generations_per_day: int
    features: List[str]


PLAN_LIMITS: Dict[OrganizationPlan, PlanLimits] = {
    OrganizationPlan.FREE: PlanLimits(
        plan=OrganizationPlan.FREE,
        max_members=5,
        max_teams=1,
        max_formulas=50,
        storage_mb=500,
        api_calls_per_day=100,
        ai_generations_per_day=10,
        features=["基础配方管理", "团队协作", "数据导出"],
    ),
    OrganizationPlan.PRO: PlanLimits(
        plan=OrganizationPlan.PRO,
        max_members=50,
        max_teams=10,
        max_formulas=1000,
        storage_mb=10240,
        api_calls_per_day=10000,
        ai_generations_per_day=200,
        features=["全部FREE功能", "高级分析报表", "API访问", "优先支持", "自定义品牌"],
    ),
    OrganizationPlan.ENTERPRISE: PlanLimits(
        plan=OrganizationPlan.ENTERPRISE,
        max_members=-1,
        max_teams=-1,
        max_formulas=-1,
        storage_mb=-1,
        api_calls_per_day=-1,
        ai_generations_per_day=-1,
        features=["全部PRO功能", "无限资源", "专属客户经理", "SLA保障", "私有部署", "SSO集成"],
    ),
}


# ============================================================
# Organization Service
# ============================================================

class OrganizationService:
    """
    多租户组织管理服务
    
    Features:
    - 组织CRUD操作
    - 成员邀请与管理
    - 团队创建与权限分配
    - 配额监控与预警
    - 计划升级/降级
    """

    def __init__(self, db):
        self.db = db

    async def create_organization(
        self,
        owner_id: int,
        name: str,
        slug: Optional[str] = None,
        **kwargs
    ) -> Organization:
        """
        创建新组织
        
        Args:
            owner_id: 创建者（将成为OWNER）
            name: 组织名称
            slug: URL标识符（可选，自动生成）
            
        Returns:
            创建的Organization对象
        """
        final_slug = slug or self._generate_slug(name)

        if await self._slug_exists(final_slug):
            raise ValueError(f"组织标识 '{final_slug}' 已存在")

        org = Organization(
            id=0,
            name=name,
            slug=final_slug,
            owner_id=owner_id,
            settings={
                "allow_invitation": True,
                "require_approval": False,
                "default_role": "member",
                **kwargs.get("settings", {}),
            },
        )

        result = await self.db.execute(
            text("""INSERT INTO organizations
               (name, slug, description, owner_id, plan, settings, is_active, created_at, updated_at)
               VALUES (:name, :slug, :description, :owner_id, :plan, :settings::jsonb, :is_active, NOW(), NOW())
               RETURNING id"""),
            {
                "name": org.name,
                "slug": org.slug,
                "description": org.description,
                "owner_id": org.owner_id,
                "plan": org.plan.value,
                "settings": json.dumps(org.settings),
                "is_active": org.is_active,
            },
        )
        
        row = result.fetchone()
        org.id = row.id

        await self.add_member(org.id, owner_id, OrganizationRole.OWNER, invited_by=owner_id)

        logger.info(f"🏢️ 创建组织: {name} (slug={final_slug}, owner={owner_id})")
        
        return org

    async def get_organization(self, organization_id: int) -> Optional[Organization]:
        """获取组织详情"""
        result = await self.db.execute(
            text("SELECT * FROM organizations WHERE id = :id AND is_active = TRUE"),
            {"id": organization_id},
        )
        row = result.fetchone()
        
        if not row:
            return None
        
        return Organization(
            id=row.id,
            name=row.name,
            slug=row.slug,
            description=row.description,
            logo_url=row.logo_url,
            owner_id=row.owner_id,
            plan=OrganizationPlan(row.plan),
            settings=json.loads(row.settings) if row.settings else {},
            created_at=row.created_at,
            updated_at=row.updated_at,
            is_active=row.is_active,
        )

    async def get_organization_by_slug(self, slug: str) -> Optional[Organization]:
        """通过slug获取组织"""
        result = await self.db.execute(
            text("SELECT * FROM organizations WHERE slug = :slug AND is_active = TRUE"),
            {"slug": slug},
        )
        row = result.fetchone()
        
        if not row:
            return None
        
        return Organization(
            id=row.id,
            name=row.name,
            slug=row.slug,
            description=row.description,
            logo_url=row.logo_url,
            owner_id=row.owner_id,
            plan=OrganizationPlan(row.plan),
            settings=json.loads(row.settings) if row.settings else {},
            created_at=row.created_at,
            updated_at=row.updated_at,
            is_active=row.is_active,
        )

    async def update_organization(
        self,
        organization_id: int,
        updater_id: int,
        **updates
    ) -> Organization:
        """更新组织信息"""
        if not await self._check_permission(organization_id, updater_id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
            raise PermissionError("无权修改此组织")

        allowed_fields = ["name", "description", "logo_url", "settings"]
        set_clauses = []
        params = {"id": organization_id}
        
        for key, value in updates.items():
            if key in allowed_fields:
                if key == "settings":
                    set_clauses.append(f"{key} = :{key}::jsonb")
                    params[key] = json.dumps(value)
                else:
                    set_clauses.append(f"{key} = :{key}")
                    params[key] = value

        if set_clauses:
            set_clauses.append("updated_at = NOW()")
            
            await self.db.execute(
                text(f"UPDATE organizations SET {', '.join(set_clauses)} WHERE id = :id"),
                params,
            )
            await self.db.commit()

        return await self.get_organization(organization_id)

    async def delete_organization(self, organization_id: int, deleter_id: int) -> bool:
        """删除组织（仅OWNER）"""
        if not await self._check_permission(organization_id, deleter_id, [OrganizationRole.OWNER]):
            raise PermissionError("仅组织拥有者可删除组织")

        await self.db.execute(
            text("UPDATE organizations SET is_active = FALSE, updated_at = NOW() WHERE id = :id"),
            {"id": organization_id},
        )
        await self.db.commit()

        logger.info(f"🗑️ 组织已删除: organization_id={organization_id}")
        
        return True

    # ============================================================
    # Member Management
    # ============================================================

    async def add_member(
        self,
        organization_id: int,
        user_id: int,
        role: OrganizationRole = OrganizationRole.MEMBER,
        *,
        invited_by: Optional[int] = None,
        team_ids: Optional[List[int]] = None,
    ) -> OrganizationMember:
        """
        添加组织成员
        
        Args:
            organization_id: 组织ID
            user_id: 用户ID
            role: 角色
            invited_by: 邀请人ID
            team_ids: 初始团队列表
            
        Returns:
            OrganizationMember对象
        """
        existing = await self._get_membership(organization_id, user_id)
        if existing:
            raise ValueError(f"用户已是该组织成员")

        limits = PLAN_LIMITS[(await self.get_organization(organization_id)).plan]
        member_count = await self._count_members(organization_id)
        
        if limits.max_members > 0 and member_count >= limits.max_members:
            raise ValueError(f"已达成员上限 ({limits.max_members})")

        member = OrganizationMember(
            user_id=user_id,
            organization_id=organization_id,
            role=role,
            team_ids=team_ids or [],
            invited_by=invited_by,
        )

        await self.db.execute(
            text("""INSERT INTO organization_members (user_id, organization_id, role, team_ids, joined_at, invited_by)
               VALUES (:user_id, :organization_id, :role, :team_ids::int[], NOW(), :invited_by)"""),
            {
                "user_id": member.user_id,
                "organization_id": member.organization_id,
                "role": member.role.value,
                "team_ids": member.team_ids,
                "invited_by": member.invited_by,
            },
        )
        await self.db.commit()

        logger.info(f"👥 添加成员: user={user_id} → org={organization_id} as {role.value}")
        
        return member

    async def remove_member(self, organization_id: int, user_id: int, remover_id: int) -> bool:
        """移除组织成员"""
        if user_id == remover_id:
            if not await self._check_permission(organization_id, remover_id, [OrganizationRole.OWNER]):
                raise PermissionError("组织拥有者无法退出")
        else:
            if not await self._check_permission(organization_id, remover_id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
                raise PermissionError("无权移除成员")

        await self.db.execute(
            text("DELETE FROM organization_members WHERE organization_id = :organization_id AND user_id = :user_id"),
            {"organization_id": organization_id, "user_id": user_id},
        )
        await self.db.commit()

        logger.info(f"🚫 移除成员: user={user_id} from org={organization_id}")
        
        return True

    async def change_role(
        self,
        organization_id: int,
        target_user_id: int,
        new_role: OrganizationRole,
        changer_id: int,
    ) -> bool:
        """修改成员角色"""
        if not await self._check_permission(organization_id, changer_id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
            raise PermissionError("无权修改角色")

        if new_role == OrganizationRole.OWNER and not await self._check_permission(organization_id, changer_id, [OrganizationRole.OWNER]):
            raise PermissionError("仅拥有者可转让OWNER角色")

        await self.db.execute(
            text("UPDATE organization_members SET role = :role WHERE organization_id = :organization_id AND user_id = :user_id"),
            {"role": new_role.value, "organization_id": organization_id, "user_id": target_user_id},
        )
        await self.db.commit()

        logger.info(f"🔄 角色变更: user={target_user_id} → {new_role.value} in org={organization_id}")
        
        return True

    async def get_members(self, organization_id: int) -> List[Dict[str, Any]]:
        """获取组织所有成员"""
        result = await self.db.execute(
            text("""SELECT m.user_id, m.role, m.joined_at, m.invited_id,
                      u.username, u.email, u.avatar_url
               FROM organization_members m
               JOIN users u ON m.user_id = u.id
               WHERE m.organization_id = :organization_id
               ORDER BY m.joined_at ASC"""),
            {"organization_id": organization_id},
        )
        
        return [dict(row._mapping) for row in result.fetchall()]

    # ============================================================
    # Team Management
    # ============================================================

    async def create_team(
        self,
        organization_id: int,
        name: str,
        creator_id: int,
        description: Optional[str] = None,
    ) -> Team:
        """创建团队"""
        if not await self._check_permission(organization_id, creator_id, [OrganizationRole.OWNER, OrganizationRole.ADMIN]):
            raise PermissionError("无权创建团队")

        org = await self.get_organization(organization_id)
        limits = PLAN_LIMITS[org.plan]
        team_count = await self._count_teams(organization_id)
        
        if limits.max_teams > 0 and team_count >= limits.max_teams:
            raise ValueError(f"已达团队上限 ({limits.max_teams})")

        result = await self.db.execute(
            text("""INSERT INTO teams (organization_id, name, description, lead_id, permissions, created_at)
               VALUES (:organization_id, :name, :description, :lead_id, '{}'::jsonb, NOW())
               RETURNING id"""),
            {"organization_id": organization_id, "name": name, "description": description, "lead_id": creator_id},
        )
        
        row = result.fetchone()
        team = Team(id=row.id, organization_id=organization_id, name=name, description=description, lead_id=creator_id)

        logger.info(f"👥 创建团队: {name} in org={organization_id}")
        
        return team

    async def get_teams(self, organization_id: int) -> List[Team]:
        """获取组织的所有团队"""
        result = await self.db.execute(
            text("SELECT * FROM teams WHERE organization_id = :organization_id ORDER BY name ASC"),
            {"organization_id": organization_id},
        )
        
        teams = []
        for row in result.fetchall():
            teams.append(Team(
                id=row.id,
                organization_id=row.organization_id,
                name=row.name,
                description=row.description,
                lead_id=row.lead_id,
                permissions=json.loads(row.permissions) if row.permissions else {},
                created_at=row.created_at,
            ))
        
        return teams

    async def add_team_member(self, team_id: int, user_id: int, adder_id: int) -> bool:
        """添加团队成员"""
        team = await self._get_team(team_id)
        if not team:
            raise ValueError("团队不存在")

        if not await self._check_permission(team.organization_id, adder_id, [OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.MEMBER]):
            if team.lead_id != adder_id:
                raise PermissionError("无权添加团队成员")

        await self.db.execute(
            text("""UPDATE organization_members
               SET team_ids = array_append(team_ids, :team_id)
               WHERE user_id = :user_id AND organization_id = :organization_id"""),
            {"team_id": team_id, "user_id": user_id, "organization_id": team.organization_id},
        )
        await self.db.commit()

        return True

    # ============================================================
    # Quota Management
    # ============================================================

    async def get_quota_usage(self, organization_id: int) -> Dict[str, QuotaUsage]:
        """获取组织的配额使用情况"""
        org = await self.get_organization(organization_id)
        if not org:
            raise ValueError("组织不存在")

        limits = PLAN_LIMITS[org.plan]
        quotas = {}

        formulas_count = await self._count_resource(organization_id, "formulas")
        quotas["formulas"] = QuotaUsage(
            resource_type=ResourceType.FORMULAS,
            used=formulas_count,
            limit=float(limits.max_formulas),
            unit="个",
        )

        experiments_count = await self._count_resource(organization_id, "experiments")
        quotas["experiments"] = QuotaUsage(
            resource_type=ResourceType.EXPERIMENTS,
            used=experiments_count,
            limit=float(limits.max_formulas) * 2,
            unit="个",
        )

        storage_used_mb = await self._get_storage_usage(organization_id)
        quotas["storage"] = QuotaUsage(
            resource_type=ResourceType.STORAGE,
            used=storage_used_mb,
            limit=float(limits.storage_mb),
            unit="MB",
        )

        member_count = await self._count_members(organization_id)
        quotas["members"] = QuotaUsage(
            resource_type=ResourceType.MEMBERS,
            used=float(member_count),
            limit=float(limits.max_members),
            unit="人",
        )

        team_count = await self._count_teams(organization_id)
        quotas["teams"] = QuotaUsage(
            resource_type=ResourceType.TEAMS,
            used=float(team_count),
            limit=float(limits.max_teams),
            unit="个",
        )

        api_calls_today = await self._count_api_calls_today(organization_id)
        quotas["api_calls"] = QuotaUsage(
            resource_type=ResourceType.API_CALLS,
            used=float(api_calls_today),
            limit=float(limits.api_calls_per_day),
            unit="次",
            reset_date=datetime.now(timezone.utc).replace(hour=23, minute=59, second=59),
        )

        ai_gen_today = await self._count_ai_generations_today(organization_id)
        quotas["ai_generations"] = QuotaUsage(
            resource_type=ResourceType.AI_GENERATIONS,
            used=float(ai_gen_today),
            limit=float(limits.ai_generations_per_day),
            unit="次",
            reset_date=datetime.now(timezone.utc).replace(hour=23, minute=59, second=59),
        )

        return quotas

    async def check_quota(self, organization_id: int, resource: ResourceType, amount: float = 1) -> bool:
        """检查是否有足够配额"""
        quotas = await self.get_quota_usage(organization_id)
        quota = quotas.get(resource.value)
        
        if not quota:
            return True
        
        return (quota.used + amount) <= quota.limit

    # ============================================================
    # Helper Methods
    # ============================================================

    def _generate_slug(self, name: str) -> str:
        """从名称生成URL友好的slug"""
        base = re.sub(r'[^\w\u4e00-\u9fff-]', '', name.lower().replace(' ', '-'))
        suffix = uuid.uuid4().hex[:6]
        return f"{base}-{suffix}"

    async def _slug_exists(self, slug: str) -> bool:
        """检查slug是否已存在"""
        result = await self.db.execute(
            text("SELECT COUNT(*) FROM organizations WHERE slug = :slug"),
            {"slug": slug},
        )
        return (result.scalar() or 0) > 0

    async def _get_membership(self, organization_id: int, user_id: int) -> Optional[Dict]:
        """获取成员关系"""
        result = await self.db.execute(
            text("SELECT * FROM organization_members WHERE organization_id = :organization_id AND user_id = :user_id"),
            {"organization_id": organization_id, "user_id": user_id},
        )
        row = result.fetchone()
        return dict(row._mapping) if row else None

    async def _check_permission(self, organization_id: int, user_id: int, required_roles: List[OrganizationRole]) -> bool:
        """检查用户在组织中的权限"""
        membership = await self._get_membership(organization_id, user_id)
        if not membership:
            return False
        
        role_hierarchy = {
            OrganizationRole.GUEST: 0,
            OrganizationRole.MEMBER: 1,
            OrganizationRole.ADMIN: 2,
            OrganizationRole.OWNER: 3,
        }
        
        user_level = role_hierarchy.get(OrganizationRole(membership["role"]), 0)
        min_required = max(role_hierarchy.get(r, 0) for r in required_roles)
        
        return user_level >= min_required

    async def _count_members(self, organization_id: int) -> int:
        """统计成员数"""
        result = await self.db.execute(
            text("SELECT COUNT(*) FROM organization_members WHERE organization_id = :organization_id"),
            {"organization_id": organization_id},
        )
        return result.scalar() or 0

    async def _count_teams(self, organization_id: int) -> int:
        """统计团队数"""
        result = await self.db.execute(
            text("SELECT COUNT(*) FROM teams WHERE organization_id = :organization_id"),
            {"organization_id": organization_id},
        )
        return result.scalar() or 0

    async def _count_resource(self, organization_id: int, table: str) -> int:
        """统计资源数量"""
        result = await self.db.execute(
            f"SELECT COUNT(*) FROM {table} WHERE organization_id = :organization_id",
            {"organization_id": organization_id},
        )
        return result.scalar() or 0

    async def _get_storage_usage(self, organization_id: int) -> float:
        """获取存储使用量(MB)"""
        result = await self.db.execute(
            text("SELECT COALESCE(SUM(file_size), 0) FROM files WHERE organization_id = :organization_id"),
            {"organization_id": organization_id},
        )
        bytes_total = result.scalar() or 0
        return round(bytes_total / 1024 / 1024, 2)

    async def _count_api_calls_today(self, organization_id: int) -> int:
        """统计今日API调用次数"""
        result = await self.db.execute(
            text("""SELECT COUNT(*) FROM api_logs
               WHERE organization_id = :organization_id
               AND created_at >= CURRENT_DATE"""),
            {"organization_id": organization_id},
        )
        return result.scalar() or 0

    async def _count_ai_generations_today(self, organization_id: int) -> int:
        """统计今日AI生成次数"""
        result = await self.db.execute(
            text("""SELECT COUNT(*) FROM ai_generations
               WHERE organization_id = :organization_id
               AND created_at >= CURRENT_DATE"""),
            {"organization_id": organization_id},
        )
        return result.scalar() or 0

    async def _get_team(self, team_id: int) -> Optional[Team]:
        """获取团队详情"""
        result = await self.db.execute(
            text("SELECT * FROM teams WHERE id = :id"),
            {"id": team_id},
        )
        row = result.fetchone()
        
        if not row:
            return None
        
        return Team(
            id=row.id,
            organization_id=row.organization_id,
            name=row.name,
            description=row.description,
            lead_id=row.lead_id,
            permissions=json.loads(row.permissions) if row.permissions else {},
            created_at=row.created_at,
        )


def get_org_service(db) -> OrganizationService:
    """获取组织服务实例"""
    return OrganizationService(db)


logger.info("🏢 多租户组织管理系统初始化完成")

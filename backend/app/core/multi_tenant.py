"""
RMFOOD 多租户/组织管理系统

支持:
- 组织/团队/空间 (Organization/Team/Workspace)
- 多级权限继承
- 资源配额管理 (Quota)
- 成员邀请与管理
- 组织设置与品牌定制

SSS Level Feature
"""

from datetime import datetime, timezone
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class OrganizationRole(str, Enum):
    """组织角色"""
    OWNER = "owner"           # 所有者（超级管理员）
    ADMIN = "admin"           # 管理员
    MEMBER = "member"         # 普通成员
    GUEST = "guest"           # 访客（只读）


class WorkspaceType(str, Enum):
    """工作空间类型"""
    PERSONAL = "personal"     # 个人空间
    TEAM = "team"             # 团队空间
    PROJECT = "project"       # 项目空间


@dataclass
class Organization:
    """组织"""
    id: int
    name: str
    slug: str  # URL-friendly identifier
    logo_url: Optional[str] = None
    description: Optional[str] = None
    owner_id: int
    settings: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    # 配额配置
    max_members: int = 50
    max_formulas: int = 1000
    max_storage_mb: int = 10240  # 10GB
    max_api_calls_per_day: int = 10000
    
    # 功能开关
    enable_ai: bool = True
    enable_collaboration: bool = True
    enable_webhook: bool = True
    custom_domain: Optional[str] = None


@dataclass 
class Team:
    """团队（组织内的子单元）"""
    id: int
    org_id: int
    name: str
    description: Optional[str] = None
    lead_id: int
    members: List[int] = field(default_factory=list)
    permissions: Dict[str, List[str]] = field(default_factory=dict)  # {"formulas": ["read", "create"]}
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Membership:
    """成员资格"""
    id: int
    user_id: int
    org_id: int
    role: OrganizationRole
    team_ids: List[int] = field(default_factory=list)
    invited_by: Optional[int] = None
    joined_at: Optional[datetime] = None
    status: str = "active"  # active/pending/suspended
    
    # 个人配额覆盖
    personal_quota: Optional[Dict[str, Any]] = None


@dataclass
class QuotaUsage:
    """配额使用情况"""
    resource_type: str  # formulas/experiments/storage/api_calls
    used: int
    limit: int
    percentage: float = 0.0
    reset_date: Optional[datetime] = None
    
    def __post_init__(self):
        if self.limit > 0:
            self.percentage = (self.used / self.limit) * 100


# ── 组织管理服务 ──

class OrganizationService:
    """多租户组织管理"""
    
    def __init__(self, db):
        self.db = db
    
    async def create_organization(
        self,
        owner_id: int,
        name: str,
        slug: Optional[str] = None,
        **kwargs
    ) -> Organization:
        """创建组织"""
        org = Organization(
            id=0,
            name=name,
            slug=slug or self._generate_slug(name),
            owner_id=owner_id,
            **kwargs
        )
        
        # TODO: 写入DB
        
        # 自动将创建者设为OWNER
        await self.add_member(org.id, owner_id, OrganizationRole.OWNER, invited_by=owner_id)
        
        logger.info(f"🏢️ 创建组织: {name} (slug={org.slug})")
        
        return org
    
    async def get_user_organizations(self, user_id: int) -> List[Dict]:
        """获取用户所属的所有组织"""
        return []  # TODO: DB查询
    
    async def get_organization(self, org_id: int) -> Optional[Dict]:
        """获取组织详情（含统计信息）"""
        return None  # TODO: DB查询 + 统计聚合
    
    async def add_member(
        self,
        org_id: int,
        user_id: int,
        role: OrganizationRole = OrganizationRole.MEMBER,
        invited_by: Optional[int] = None,
        send_invitation_email: bool = True,
    ) -> Membership:
        """添加成员"""
        membership = Membership(
            id=0,
            user_id=user_id,
            org_id=org_id,
            role=role,
            status="pending",
            invited_by=invited_by,
        )
        
        # TODO: 写入DB
        
        if send_invitation_email:
            await self._send_invitation_email(membership)
        
        logger.info(f"👥 添加成员到组织 {org_id}: user={user_id}, role={role.value}")
        
        return membership
    
    async def remove_member(self, org_id: int, user_id: int, operator_id: int) -> bool:
        """移除成员"""
        # 不能移除所有者
        org = await self.get_organization(org_id)
        if org and org.get('owner_id') == user_id:
            raise ValueError("不能移除组织所有者")
        
        # TODO: 删除membership记录
        return True
    
    async def update_member_role(
        self,
        org_id: int,
        user_id: int,
        new_role: OrganizationRole,
        operator_id: int,
    ) -> bool:
        """更新成员角色"""
        # TODO: 更新DB
        logger.info(f"🔄 角色变更: org={org_id} user={user_id} → {new_role.value}")
        return True
    
    async def get_org_members(self, org_id: int) -> List[Dict]:
        """获取组织成员列表"""
        return []  # TODO: DB查询，包含用户基本信息
    
    async def get_quota_usage(self, org_id: int) -> Dict[str, QuotaUsage]:
        """获取组织的配额使用情况"""
        quotas = {}
        
        # 配方数量
        formula_count = 0  # TODO: COUNT(formulas WHERE org_id)
        quotas["formulas"] = QuotaUsage(
            resource_type="formulas",
            used=formula_count,
            limit=1000,  # 从org.settings读取
        )
        
        # 存储使用量
        storage_used_mb = 0  # TODO: SUM(file_size) / 1024 / 1024
        quotas["storage"] = QuotaUsage(
            resource_type="storage",
            used=storage_used_mb,
            limit=10240,
        )
        
        # API调用次数（当日）
        api_calls_today = 0  # COUNT(api_logs WHERE date=today AND org_id)
        quotas["api_calls"] = QuotaUsage(
            resource_type="api_calls",
            used=api_calls_today,
            limit=10000,
            reset_date=datetime.now(timezone.utc).replace(hour=23, minute=59, second=59),
        )
        
        return quotas
    
    async def check_quota(self, org_id: int, resource_type: str, amount: int = 1) -> tuple[bool, str]:
        """
        检查并扣减配额
        
        Returns:
            (allowed, message): 是否允许操作及原因说明
        """
        usage = (await self.get_quota_usage(org_id)).get(resource_type)
        
        if not usage:
            return True, ""  # 未配置限制则允许
        
        if usage.used + amount > usage.limit:
            return False, f"{resource_type} 配额不足 ({usage.used}/{usage.limit})"
        
        # 扣减配额（实际应在事务中原子操作）
        # TODO: 使用Redis INCR 或 DB计数器
        return True, ""
    
    async def create_team(self, org_id: int, name: str, lead_id: int, **kwargs) -> Team:
        """创建团队"""
        team = Team(
            id=0,
            org_id=org_id,
            name=name,
            lead_id=lead_id,
            **kwargs
        )
        
        # TODO: 写入DB
        return team
    
    async def get_org_teams(self, org_id: int) -> List[Dict]:
        """获取组织下的所有团队"""
        return []
    
    async def update_org_settings(self, org_id: int, settings: Dict[str, Any]) -> bool:
        """更新组织设置"""
        # TODO: 合并更新settings字段
        return True
    
    def _generate_slug(self, name: str) -> str:
        """生成URL友好的slug"""
        import re
        slug = re.sub(r'[^\w\u4e00-\u9fff-]', '', name.lower())
        slug = re.sub(r'[-\s]+', '-', slug)
        return slug[:50]
    
    async def _send_invitation_email(self, membership: Membership):
        """发送邀请邮件"""
        # TODO: 集成邮件服务
        pass
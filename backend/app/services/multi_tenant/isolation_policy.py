"""
多租户隔离策略 (v1.0)

四级分层隔离体系，支撑商业化定价：
- Level 1: 共享实例 + RLS（默认，成本最低）
- Level 2: Schema 级隔离（独立 Schema，共享实例）
- Level 3: 独立数据库实例（物理隔离）
- Level 4: K8s 命名空间 + 独立数据库（极致隔离）

提供动态切换和配置管理功能。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class IsolationLevel(int, Enum):
    """隔离级别"""
    SHARED_RLS = 1        # 共享实例 + 行级安全
    SHARED_SCHEMA = 2     # 共享实例 + 独立 Schema
    PHYSICAL_DB = 3       # 独立数据库实例
    K8S_NAMESPACE = 4     # K8s 命名空间 + 独立数据库


@dataclass
class IsolationPolicy:
    """隔离策略定义"""
    level: IsolationLevel
    name: str
    description: str
    features: List[str] = field(default_factory=list)
    max_concurrent_users: int = 100
    max_database_size_gb: float = 10.0
    price_tier: str = "basic"  # "basic" | "standard" | "enterprise" | "premium"


# 四级隔离策略定义
ISOLATION_POLICIES: Dict[IsolationLevel, IsolationPolicy] = {
    IsolationLevel.SHARED_RLS: IsolationPolicy(
        level=IsolationLevel.SHARED_RLS,
        name="共享实例 + RLS",
        description="成本最低，适合中小型客户",
        features=["行级安全策略", "共享连接池", "基础监控"],
        max_concurrent_users=50,
        max_database_size_gb=5.0,
        price_tier="basic",
    ),
    IsolationLevel.SHARED_SCHEMA: IsolationPolicy(
        level=IsolationLevel.SHARED_SCHEMA,
        name="独立 Schema",
        description="数据物理上分开一层，适合中型企业",
        features=["独立 Schema", "Schema 级权限", "资源组隔离"],
        max_concurrent_users=200,
        max_database_size_gb=50.0,
        price_tier="standard",
    ),
    IsolationLevel.PHYSICAL_DB: IsolationPolicy(
        level=IsolationLevel.PHYSICAL_DB,
        name="独立数据库实例",
        description="物理隔离，适合金融、政务等强合规场景",
        features=["独立数据库", "独立备份", "独立监控", "SLA 保障"],
        max_concurrent_users=1000,
        max_database_size_gb=500.0,
        price_tier="enterprise",
    ),
    IsolationLevel.K8S_NAMESPACE: IsolationPolicy(
        level=IsolationLevel.K8S_NAMESPACE,
        name="K8s 命名空间 + 独立数据库",
        description="极致隔离，适合大型集团客户",
        features=["独立 K8s 命名空间", "独立数据库", "独立计算资源", "专属运维"],
        max_concurrent_users=10000,
        max_database_size_gb=5000.0,
        price_tier="premium",
    ),
}


class IsolationPolicyManager:
    """
    隔离策略管理器

    用法：
        manager = IsolationPolicyManager()
        policy = manager.get_policy(org_id)
        if policy.level == IsolationLevel.SHARED_SCHEMA:
            # 切换到独立 Schema
            session = manager.apply_isolation(db_session, org_id)
    """

    def __init__(self):
        self._org_policies: Dict[int, IsolationLevel] = {}  # org_id -> level
        self._default_level = IsolationLevel.SHARED_RLS

    def set_org_policy(self, org_id: int, level: IsolationLevel) -> None:
        """设置组织的隔离级别"""
        self._org_policies[org_id] = level
        logger.info(
            "[IsolationPolicy] 设置组织 %d 的隔离级别为 %s",
            org_id, level.name,
        )

    def get_org_policy(self, org_id: int) -> IsolationLevel:
        """获取组织的隔离级别"""
        return self._org_policies.get(org_id, self._default_level)

    def get_policy(self, org_id: int) -> IsolationPolicy:
        """获取组织的完整隔离策略"""
        level = self.get_org_policy(org_id)
        return ISOLATION_POLICIES[level]

    def apply_isolation(
        self,
        db_session: Any,
        org_id: int,
    ) -> Dict[str, Any]:
        """
        应用隔离策略到数据库会话

        Returns:
            隔离配置信息
        """
        level = self.get_org_policy(org_id)
        policy = ISOLATION_POLICIES[level]

        config = {
            "org_id": org_id,
            "level": level.value,
            "level_name": level.name,
            "features": policy.features,
            "max_concurrent_users": policy.max_concurrent_users,
            "max_database_size_gb": policy.max_database_size_gb,
        }

        if level == IsolationLevel.SHARED_RLS:
            # RLS: 添加 tenant_id 过滤
            config["rls_enabled"] = True
            config["schema"] = "public"

        elif level == IsolationLevel.SHARED_SCHEMA:
            # Schema 级隔离：切换到租户专属 Schema
            config["schema"] = f"tenant_{org_id}"
            config["rls_enabled"] = False

        elif level == IsolationLevel.PHYSICAL_DB:
            # 独立数据库：返回连接配置
            config["connection_string"] = f"postgresql://rmfood_org{org_id}@localhost/rmfood_org{org_id}"
            config["schema"] = "public"

        elif level == IsolationLevel.K8S_NAMESPACE:
            # K8s 命名空间：返回完整的部署配置
            config["namespace"] = f"rmfood-org-{org_id}"
            config["connection_string"] = f"postgresql://rmfood-org-{org_id}.svc.cluster.local/rmfood"
            config["resources"] = {
                "cpu": "4 cores",
                "memory": "16Gi",
                "storage": "500Gi",
            }

        logger.info(
            "[IsolationPolicy] 应用隔离策略: org=%d level=%s",
            org_id, level.name,
        )
        return config

    def list_policies(self) -> List[Dict[str, Any]]:
        """列出所有隔离策略"""
        return [
            {
                "level": p.level.value,
                "name": p.name,
                "description": p.description,
                "features": p.features,
                "price_tier": p.price_tier,
            }
            for p in ISOLATION_POLICIES.values()
        ]

    def can_upgrade(self, org_id: int, target_level: IsolationLevel) -> bool:
        """检查是否可升级到指定级别"""
        current = self.get_org_policy(org_id)
        return target_level.value > current.value

    def can_downgrade(self, org_id: int, target_level: IsolationLevel) -> bool:
        """检查是否可降级到指定级别"""
        current = self.get_org_policy(org_id)
        return target_level.value < current.value


# ── 全局单例 ───────────────────────────────────────────────────────────

_manager: Optional[IsolationPolicyManager] = None


def get_isolation_manager() -> IsolationPolicyManager:
    """获取全局隔离策略管理器单例"""
    global _manager
    if _manager is None:
        _manager = IsolationPolicyManager()
    return _manager

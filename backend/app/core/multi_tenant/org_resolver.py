"""有效组织解析（租户隔离核心，跨路由共享）。

供各 API 模块统一解析"当前请求的有效组织 ID"，避免各自重复实现
（原在 formulas.py 内嵌、experiments.py 部分重复）。语义：
    优先级：1. tenant_org_id（JWT 解析，可信签名）
            2. current_user.organization_id（用户默认组织）
            3. organization_members 首个 active 组织（本地库真实关系）
返回 None 表示匿名或无有效组织，调用方应拒绝访问（维持 P0 隔离）。
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import text as _text
from sqlalchemy.ext.asyncio import AsyncSession


async def resolve_effective_org_id(
    tenant_org_id: Optional[int],
    current_user: Optional[object],
    db: AsyncSession,
) -> Optional[int]:
    """解析当前请求的有效组织 ID（Cookie 认证兼容）。

    tenant_org_id 为 None（如 Cookie 认证未携带 org_id）时，回退到
    用户默认组织或首个活跃成员关系，避免对已认证且有组织的用户误判为无租户。
    """
    if tenant_org_id is not None:
        return tenant_org_id
    if current_user is None:
        return None
    if getattr(current_user, "organization_id", None):
        return current_user.organization_id
    row = (await db.execute(
        _text(
            "SELECT organization_id FROM organization_members "
            "WHERE user_id = :uid AND is_active = TRUE ORDER BY id LIMIT 1"
        ),
        {"uid": current_user.id},
    )).fetchone()
    return row.organization_id if row else None

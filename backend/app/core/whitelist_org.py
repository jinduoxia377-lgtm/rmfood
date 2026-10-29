"""白名单组织（租户隔离扩展）— 组织级功能授予的载体。

设计（对齐「免费版 + 部分专业版功能」白名单系统）：
- 单一组织「莱茵分子白名单组织」（WHITELIST_ORG_NAME），新批白名单获批用户归入；
  参与租户数据隔离（user.organization_id 指向该组织，数据仅组织内可见），
  不回溯迁移已有用户（仅未来新批用户归入）。
- 白名单用户 plan 仍为 'free'（免费版基础），其专业版功能子集通过「组织授予」
  在 core/plans.py::has_plan 的 org-grant 分支判定（不改 User.plan）。
- 组织 id 按名称查询（避免硬编码 id），进程内缓存避免每次 require_plan 都查库；
  白名单组织在生产环境创建一次、不删除，进程内缓存安全。
"""
from __future__ import annotations

import threading
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.organization import Organization

# ── 白名单组织标识（单一事实来源，与 core/plans.py 常量一致）──
# 注：plans.py 亦导出 WHITELIST_ORG_NAME（组织级授予判定），两处同源。
WHITELIST_ORG_NAME = "莱茵分子白名单组织"
WHITELIST_ORG_SLUG = "whitelist-org"
WHITELIST_ORG_DESCRIPTION = "白名单获批用户组织（免费版 + 部分专业版功能授予，参与租户数据隔离）"

# ── 进程内缓存（组织 id 按名称查询结果）──
# 白名单组织生产环境创建一次、不删除，进程内缓存安全；组织重建（测试/运维）后
# 需调用 clear_whitelist_org_cache() 使缓存失效。
_org_id_cache: Optional[int] = None
_cache_lock = threading.Lock()


def _set_cached_org_id(org_id: Optional[int]) -> None:
    global _org_id_cache
    with _cache_lock:
        _org_id_cache = org_id


def get_cached_whitelist_org_id() -> Optional[int]:
    """读取进程内缓存的白名单组织 id（同步，供 is_whitelist_member / has_plan 使用）。"""
    with _cache_lock:
        return _org_id_cache


def clear_whitelist_org_cache() -> None:
    """清空组织 id 缓存（组织重建后调用；测试夹具 / 运维工具使用）。"""
    _set_cached_org_id(None)


async def get_whitelist_org_id(db: AsyncSession) -> Optional[int]:
    """按名称查询白名单组织 id（避免硬编码 id）。

    优先命中进程内缓存；未命中则按需查库，找到后回填缓存。
    组织不存在时返回 None（不缓存 None，组织创建后可再次查到），不阻断调用方。
    """
    cached = get_cached_whitelist_org_id()
    if cached is not None:
        return cached
    org_id = (
        await db.execute(
            select(Organization.id).where(Organization.name == WHITELIST_ORG_NAME).limit(1)
        )
    ).scalar_one_or_none()
    if org_id is None:
        return None
    _set_cached_org_id(int(org_id))
    return int(org_id)


async def ensure_whitelist_org(db: AsyncSession) -> Organization:
    """按名称查找白名单组织，不存在则创建（幂等）。返回组织对象。

    调用方决定事务边界（本函数只 flush 拿到 org.id 并回填缓存，不 commit），
    确保与批准流程在同一事务内原子提交。
    """
    org = (
        await db.execute(
            select(Organization).where(Organization.name == WHITELIST_ORG_NAME).limit(1)
        )
    ).scalar_one_or_none()
    if org is None:
        org = Organization(
            name=WHITELIST_ORG_NAME,
            slug=WHITELIST_ORG_SLUG,
            description=WHITELIST_ORG_DESCRIPTION,
            is_active=True,
            owner_id=1,  # DB owner_id NOT NULL；约定所有系统/种子组织 owner_id=1（admin）
        )
        db.add(org)
        await db.flush()  # 拿到 org.id
    _set_cached_org_id(int(org.id))
    return org


async def assign_user_to_whitelist_org(db: AsyncSession, user) -> None:
    """将用户归入白名单组织（设置 user.organization_id，参与租户隔离）。

    组织不存在时先 ensure 创建（幂等），保证首个获批用户前组织就绪。
    注意：User 模型的租户字段是 organization_id（非 org_id）。
    """
    org_id = await get_whitelist_org_id(db)
    if org_id is None:
        org = await ensure_whitelist_org(db)
        org_id = int(org.id)
    user.organization_id = org_id


def is_whitelist_member(user) -> bool:
    """判断用户是否属于白名单组织（同步，供 has_plan org-grant 分支）。

    依据：user.organization_id == 白名单组织 id（进程内缓存）。
    组织 id 未缓存（组织不存在或尚未查询）时返回 False —— 保守不误授、不阻断。
    """
    org_id = get_cached_whitelist_org_id()
    if org_id is None:
        return False
    return getattr(user, "organization_id", None) == org_id

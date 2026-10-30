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
import time
from typing import Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.organization import Organization

# ── 白名单组织标识（单一事实来源，与 core/plans.py 常量一致）──
# 注：plans.py 亦导出 WHITELIST_ORG_NAME（组织级授予判定），两处同源。
WHITELIST_ORG_NAME = "莱茵分子白名单组织"
WHITELIST_ORG_SLUG = "whitelist-org"
WHITELIST_ORG_DESCRIPTION = "白名单获批用户组织（免费版 + 部分专业版功能授予，参与租户数据隔离）"

# ── 进程内缓存（组织 id 按名称查询结果）──
# 缓存存 (org_id, cached_at_monotonic)，TTL 后自动失效重查。组织删/重建后 id 变化时，
# 陈旧缓存会导致 assign/count/has_plan 用旧 id（FK 错误/归入错误组织），故加 TTL。
# 白名单组织生产环境创建一次、不删除；组织重建（测试/运维）后亦可调用
# clear_whitelist_org_cache() 立即失效。
_org_id_cache: Optional[tuple[int, float]] = None  # (org_id, cached_at_monotonic)
_ORG_ID_CACHE_TTL: float = 300.0  # 秒
_cache_lock = threading.Lock()


def _set_cached_org_id(org_id: Optional[int]) -> None:
    global _org_id_cache
    with _cache_lock:
        _org_id_cache = (org_id, time.monotonic()) if org_id is not None else None


def get_cached_whitelist_org_id() -> Optional[int]:
    """读取进程内缓存的白名单组织 id（同步，供 is_whitelist_member / has_plan 使用）。

    缓存过期（TTL）或未缓存时返回 None，调用方应经 get_whitelist_org_id 重查库
    （权威解析）。仅读缓存的同步路径在冷缓存/过期后可能返回 None（保守不误授）。
    """
    with _cache_lock:
        if _org_id_cache is None:
            return None
        org_id, cached_at = _org_id_cache
        if time.monotonic() - cached_at > _ORG_ID_CACHE_TTL:
            return None
        return org_id


def clear_whitelist_org_cache() -> None:
    """清空组织 id 缓存（组织重建后调用；测试夹具 / 运维工具使用）。"""
    _set_cached_org_id(None)


async def get_whitelist_org_id(db: AsyncSession) -> Optional[int]:
    """按名称查询白名单组织 id（避免硬编码 id，权威解析）。

    优先命中进程内缓存（TTL 内）；缓存未命中/过期则按需查库，找到后回填缓存。
    组织不存在时返回 None 并清空缓存（组织删除/重建后可再次查到），不阻断调用方。
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
        # 查无此组织：清空缓存（可能缓存了陈旧 id），下次可重查（组织重建/改名后）。
        _set_cached_org_id(None)
        return None
    _set_cached_org_id(int(org_id))
    return int(org_id)


async def _ensure_whitelist_org_members(db: AsyncSession, org_id: int, owner_id: Optional[int]) -> None:
    """确保白名单组织有「owner + 全部 admin 用户」成员（角色 owner，幂等）。

    背景：白名单组织由白名单功能创建时无任何成员，owner（admin，user 1）访问
    GET /organizations/{id} 与 /organizations/{id}/members 时因「非成员」返回 403
    （详情/成员端点要求组织成员资格，见 api/organizations.py get_organization /
    get_members）。列表端点虽有 admin 特殊显示 whitelist-org，但详情仍 403。

    本函数只补 organization_members 成员行（角色 owner），不改 user.organization_id
    （租户归入仍由 assign_user_to_whitelist_org 处理）与 User.plan（org-grant 判定不变）。

    幂等：依赖 organization_members 唯一约束 uq_org_member (organization_id, user_id)
    的 ON CONFLICT DO NOTHING —— 重复 ensure 不重复插成员；用户不存在（FK 校验）时
    直接不出现在查询结果中，不会触发外键错误。
    """
    if org_id is None:
        return
    member_user_ids = (
        await db.execute(
            text("""
                SELECT id FROM users
                WHERE id = :owner_id OR LOWER(role::text) = 'admin'
            """),
            {"owner_id": owner_id},
        )
    ).scalars().all()
    for uid in member_user_ids:
        await db.execute(
            text("""
                INSERT INTO organization_members (organization_id, user_id, role, is_active)
                VALUES (:org_id, :uid, 'owner', TRUE)
                ON CONFLICT (organization_id, user_id) DO NOTHING
            """),
            {"org_id": org_id, "uid": int(uid)},
        )


async def ensure_whitelist_org(db: AsyncSession) -> Organization:
    """按名称查找白名单组织，不存在则创建（幂等）。返回组织对象。

    调用方决定事务边界（本函数只 flush 拿到 org.id 并回填缓存，不 commit），
    确保与批准流程在同一事务内原子提交。
    同时确保组织 owner + 全部 admin 为成员（角色 owner，幂等），
    避免 admin 访问组织详情/成员端点时因非成员返回 403。
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
    await _ensure_whitelist_org_members(db, int(org.id), org.owner_id)
    return org


async def assign_user_to_whitelist_org(db: AsyncSession, user) -> None:
    """将用户归入白名单组织（设置 user.organization_id，参与租户隔离）+ 添加为组织成员。

    组织不存在时先 ensure 创建（幂等），保证首个获批用户前组织就绪。
    同时把用户插入 organization_members（角色 member，幂等）——否则用户虽有
    organization_id 租户指针，但不在组织成员表，组织成员页/详情看不到该用户。
    注意：User 模型的租户字段是 organization_id（非 org_id）。
    """
    org_id = await get_whitelist_org_id(db)
    if org_id is None:
        org = await ensure_whitelist_org(db)
        org_id = int(org.id)
    user.organization_id = org_id
    # 新用户尚未 flush 时 user.id 为 None；先 flush（同一事务内，调用方随后 flush/commit
    # 幂等）拿到 user.id，才能插入 organization_members 成员行。
    if getattr(user, "id", None) is None:
        await db.flush()
    await db.execute(
        text("""
            INSERT INTO organization_members (organization_id, user_id, role, is_active)
            VALUES (:org_id, :uid, 'member', TRUE)
            ON CONFLICT (organization_id, user_id) DO NOTHING
        """),
        {"org_id": org_id, "uid": int(user.id)},
    )


def is_whitelist_member(user) -> bool:
    """判断用户是否属于白名单组织（同步，仅进程内缓存判定，供 has_plan org-grant 分支）。

    依据：user.organization_id == 白名单组织 id（进程内缓存）。
    组织 id 未缓存（组织不存在、尚未查询或缓存过期）时返回 False —— 保守不误授。
    注意：本函数不查库；冷缓存/缓存过期时可能误拒（返回 False）。权威判定请用
    is_whitelist_member_async（has_plan_async / require_plan 使用）。
    """
    org_id = get_cached_whitelist_org_id()
    if org_id is None:
        return False
    return getattr(user, "organization_id", None) == org_id


async def is_whitelist_member_async(db: AsyncSession, user) -> bool:
    """判断用户是否属于白名单组织（async，权威，冷缓存不误拒）。

    与 is_whitelist_member 同语义，但缓存未命中/过期时经 get_whitelist_org_id 查库
    确认（TTL 内重查），避免冷缓存/缓存过期把白名单成员误判为 False。
    """
    org_id = await get_whitelist_org_id(db)
    if org_id is None:
        return False
    return getattr(user, "organization_id", None) == org_id

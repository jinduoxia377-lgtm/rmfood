"""平台默认组织启动自愈引导（ORG-001 方案 C：数据修复 + 引导自愈兜底）。

设计依据：`_deploy_tmp/design/org_design.md` §4.3 与 `_deploy_tmp/org_bootstrap.sql`
（已在生产执行的幂等 SQL 为单一事实来源，此处以代码固化其语义并泛化到全部存量用户）。

目标：
    确保平台至少存在一个默认组织（RMFOOD 平台，slug=rmfood-platform），并让全部
    存量用户归入该组织（成员关系 + users.organization_id 回填），防止默认组织被误删
    后 `/api/v1/formulas` 等租户隔离端点再次 403。

约定（对齐 org_design.md）：
    - 仅在 ``settings.ORG_AUTO_BOOTSTRAP`` 开启且 ``organizations`` 表为空时，由
      lifespan 启动钩子调用一次（写库最小化；接入点见 ``app/main.py``）。
    - 全程幂等：按 slug 守卫，已存在的组织/成员/回填不会被重复写入。
    - **不改** ``resolve_effective_org_id`` / ``require_tenant`` 任何隔离判定逻辑，
      P0 租户隔离的"无有效组织即拒绝"语义原封不动（AC-4）。
    - ``organization_members`` 仅写 4 核心列 + 审计列：生产表缺
      ``joined_at/team_ids/invited_by``（规避 add_member 缺陷），与 org_bootstrap.sql 一致。

失败语义：
    任何数据库异常 → 本函数回滚并重新抛出，由调用方（lifespan）仅 ``logger.warning``
    记录，不阻断应用启动（非阻塞）。
"""
from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("rmfood.tenant.bootstrap")

# ── 平台默认组织标识（单一事实来源，与 org_bootstrap.sql / org_design.md 一致）──
DEFAULT_ORG_SLUG = "rmfood-platform"
DEFAULT_ORG_NAME = "RMFOOD 平台"
DEFAULT_ORG_PLAN = "free"
DEFAULT_ORG_DESCRIPTION = "RMFOODFP 平台默认组织（存量用户引导归属，单租户启动引导）"

# 组织内角色（小写枚举，与 multi_tenant_service / org_design.md §5.2 一致）
ROLE_OWNER = "owner"
ROLE_MEMBER = "member"


async def _resolve_owner_id(db: AsyncSession) -> Optional[int]:
    """取首个 ADMIN 用户作为默认组织 owner（动态定位，避免硬编码 id 漂移）。

    users.role 在库里按枚举**名**（大写，如 'ADMIN'）存储；此处用 ``LOWER``
    归一化匹配，兼容 'ADMIN'/'admin' 等脏值（对齐 whitelist_org.py 既有模式）。
    """
    row = (
        await db.execute(
            text(
                "SELECT id FROM users WHERE LOWER(role::text) = 'admin' "
                "ORDER BY id LIMIT 1"
            )
        )
    ).fetchone()
    return int(row.id) if row else None


async def ensure_default_org(db: AsyncSession) -> int:
    """确保平台默认组织存在，返回其 id。幂等。

    语义（org_design.md §4.3 / org_bootstrap.sql）：
    1. 先按 slug 查询组织，命中直接返回 id（不写库）。
    2. 未命中 → 事务内创建组织（owner_id=首个 ADMIN，plan='free'，settings='{}',
       is_active=true）。
    3. 为**全部存量用户**插入成员关系：owner（首个 ADMIN）→ 'owner'，其余 → 'member'
       （仅写 organization_id/user_id/role/is_active 4 核心列，幂等 WHERE NOT EXISTS）。
    4. 回填 ``users.organization_id`` = 本组织 id（仅 NULL 或不同值，幂等）。
    5. 成功 ``commit``；任何异常 → ``rollback`` 并重新抛出（调用方仅记录日志）。

    Returns:
        平台默认组织 id（int）。

    Raises:
        Exception: 任何数据库异常（已回滚），调用方应 ``logger.warning`` 记录。
    """
    # 1. 已存在 → 直接返回（幂等，无写库）
    row = (
        await db.execute(
            text("SELECT id FROM organizations WHERE slug = :s LIMIT 1"),
            {"s": DEFAULT_ORG_SLUG},
        )
    ).fetchone()
    if row:
        return int(row.id)

    try:
        # 2. 动态定位首个 ADMIN 作为 owner（避免硬编码 id 漂移）
        owner_id = await _resolve_owner_id(db)
        if owner_id is None:
            # 极端兜底：无 ADMIN 时以首个用户为 owner（保证 owner_id 非空、有 owner 成员）
            first = (
                await db.execute(text("SELECT id FROM users ORDER BY id LIMIT 1"))
            ).fetchone()
            owner_id = int(first.id) if first else None

        # 3. 创建组织（幂等：WHERE NOT EXISTS 按 slug 守卫；settings 为 jsonb，对齐
        #    org_bootstrap.sql 已执行且通过 '{}'::jsonb 验证生产 schema）
        ins = await db.execute(
            text(
                """
                INSERT INTO organizations
                    (name, slug, description, owner_id, plan, settings, is_active,
                     created_at, updated_at)
                SELECT :name, :slug, :desc, :owner_id, :plan, '{}'::jsonb, TRUE,
                       now(), now()
                WHERE NOT EXISTS (
                    SELECT 1 FROM organizations WHERE slug = :slug
                )
                RETURNING id
                """
            ),
            {
                "name": DEFAULT_ORG_NAME,
                "slug": DEFAULT_ORG_SLUG,
                "desc": DEFAULT_ORG_DESCRIPTION,
                "owner_id": owner_id,
                "plan": DEFAULT_ORG_PLAN,
            },
        )
        ins_row = ins.fetchone()
        if ins_row is not None:
            org_id = int(ins_row.id)
        else:
            # 并发/竞态兜底：另一事务已创建，重新读取（幂等）
            row = (
                await db.execute(
                    text("SELECT id FROM organizations WHERE slug = :s LIMIT 1"),
                    {"s": DEFAULT_ORG_SLUG},
                )
            ).fetchone()
            if row is None:
                raise RuntimeError(
                    f"ensure_default_org: 平台组织创建失败（slug={DEFAULT_ORG_SLUG} 未找到）"
                )
            org_id = int(row.id)

        # 4. 全部存量用户 → 成员关系（owner→owner、其余→member；4 核心列，幂等）
        users = (await db.execute(text("SELECT id FROM users ORDER BY id"))).fetchall()
        member_ids: list[int] = []
        for u in users:
            uid = int(u.id)
            member_ids.append(uid)
            role = ROLE_OWNER if (owner_id is not None and uid == owner_id) else ROLE_MEMBER
            await db.execute(
                text(
                    """
                    INSERT INTO organization_members
                        (organization_id, user_id, role, is_active, created_at, updated_at)
                    SELECT :org_id, :uid, :role, TRUE, now(), now()
                    WHERE NOT EXISTS (
                        SELECT 1 FROM organization_members
                        WHERE organization_id = :org_id AND user_id = :uid
                    )
                    """
                ),
                {"org_id": org_id, "uid": uid, "role": role},
            )

        # 5. 回填 users.organization_id（仅本组织成员；仅 NULL/不同值，幂等）
        if member_ids:
            await db.execute(
                text(
                    """
                    UPDATE users u
                    SET organization_id = :org_id, updated_at = now()
                    WHERE (u.organization_id IS NULL OR u.organization_id <> :org_id)
                      AND EXISTS (
                          SELECT 1 FROM organization_members m
                          WHERE m.organization_id = :org_id AND m.user_id = u.id
                      )
                    """
                ),
                {"org_id": org_id},
            )

        await db.commit()
        logger.info(
            "平台默认组织已引导创建: id=%s slug=%s owner_id=%s members=%d",
            org_id, DEFAULT_ORG_SLUG, owner_id, len(member_ids),
        )
        return org_id
    except Exception:
        await db.rollback()
        raise

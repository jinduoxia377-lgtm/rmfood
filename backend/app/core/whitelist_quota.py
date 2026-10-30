"""白名单 500 名额配额（租户隔离扩展）。

配额语义（已确认需求）：
- 仅「批准」消耗名额（-1）；待审核 / 拒绝不消耗；用尽即止（剩余 0 时阻止新批准）。
- 剩余 = WHITELIST_QUOTA_TOTAL - 已批准数。
- **已批准数口径（用户定夺「不含已批用户」）**：仅计**新流程**批准（批准时归入
  「莱茵分子白名单组织」的用户）；历史已批用户（旧流程、未归入白名单组织）不消耗
  500 池、不计数——故剩余初始 = 500，每个新流程批准 -1。
- 计数来源：PreRegisterRequest.status=APPROVED JOIN users（user.organization_id = 白名单组织 id）。

并发安全：consume_quota 用 PostgreSQL 事务级 advisory lock（pg_advisory_xact_lock）
串行化所有批准：批准方在持有锁的事务内检查剩余，随后（同一事务）置 status=APPROVED，
锁在事务提交/回滚时释放。这样并发批准不会同时读到相同剩余而超发。
"""
from __future__ import annotations

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.models import User
from ..models.pre_register import PreRegisterRequest, PreRegisterStatus

# ── 配额总量（已确认 500）──
WHITELIST_QUOTA_TOTAL = 500

# ── 事务级 advisory lock key（任意 64-bit 常量，标识白名单配额串行化通道）──
# 0x524D_464F_4F44 = ASCII "RMFOOD" 的数值表示，仅作通道标识，无业务含义。
_QUOTA_LOCK_KEY = 0x524D_464F_4F44


async def get_approved_count(db: AsyncSession) -> int:
    """已批准数 = 归入「莱茵分子白名单组织」的新流程批准数（500 池配额口径）。

    口径（用户定夺「未来新增可批 500（不含已批用户）」）：仅计**新流程**批准——
    即批准时通过 _approve_one 归入白名单组织的用户；历史已批用户（旧流程，plan 各异、
    未归入白名单组织）不消耗 500 池，故不计数。

    去重：多条 APPROVED 申请可能指向同一用户（如同一邮箱重复提交/历史遗留），
    按用户去重计数（COUNT(DISTINCT users.id)），避免重复消耗 500 池。
    """
    from .whitelist_org import get_whitelist_org_id

    org_id = await get_whitelist_org_id(db)
    if org_id is None:
        return 0  # 白名单组织尚未创建 → 尚无新流程批准
    result = await db.execute(
        select(func.count(func.distinct(User.id)))
        .select_from(PreRegisterRequest)
        .join(User, User.id == PreRegisterRequest.user_id)
        .where(
            PreRegisterRequest.status == PreRegisterStatus.APPROVED,
            User.organization_id == org_id,
        )
    )
    return int(result.scalar() or 0)


async def get_remaining_quota(db: AsyncSession) -> int:
    """剩余名额 = WHITELIST_QUOTA_TOTAL - 已批准数（下限 0，不出现负数）。"""
    return max(0, WHITELIST_QUOTA_TOTAL - await get_approved_count(db))


async def consume_quota(db: AsyncSession) -> bool:
    """原子消耗一个名额：剩余 > 0 返回 True（可批准），剩余 = 0 返回 False。

    实际的名额递增是调用方在同一事务内将 PreRegisterRequest 置为 APPROVED；
    consume_quota 只做「advisory lock 串行化 + 剩余检查」，保证并发批准不会超发。
    锁为事务级（pg_advisory_xact_lock），随事务提交/回滚自动释放。
    """
    await db.execute(
        text("SELECT pg_advisory_xact_lock(:key)"),
        {"key": _QUOTA_LOCK_KEY},
    )
    approved = await get_approved_count(db)
    return approved < WHITELIST_QUOTA_TOTAL

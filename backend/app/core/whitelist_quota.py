"""白名单 500 名额配额（租户隔离扩展）。

配额语义（已确认需求）：
- 仅「批准」消耗名额（-1）；待审核 / 拒绝不消耗；用尽即止（剩余 0 时阻止新批准）。
- 剩余 = WHITELIST_QUOTA_TOTAL - 已批准数；已批准数 = PreRegisterRequest.status=APPROVED 的计数
  （与「剩余=500-已批准数」一致；审批钩子在同一事务内置 APPROVED，保证计数原子一致）。
- 计数来源说明：优先取 PreRegisterRequest.status=APPROVED（而非 Users 归入白名单组织数），
  因为批准动作即置 APPROVED，与配额消耗一一对应；Users 组织归属计数会受
  既有存量用户/非白名单用户干扰，不作为配额口径。

并发安全：consume_quota 用 PostgreSQL 事务级 advisory lock（pg_advisory_xact_lock）
串行化所有批准：批准方在持有锁的事务内检查剩余，随后（同一事务）置 status=APPROVED，
锁在事务提交/回滚时释放。这样并发批准不会同时读到相同剩余而超发。
"""
from __future__ import annotations

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.pre_register import PreRegisterRequest, PreRegisterStatus

# ── 配额总量（已确认 500）──
WHITELIST_QUOTA_TOTAL = 500

# ── 事务级 advisory lock key（任意 64-bit 常量，标识白名单配额串行化通道）──
# 0x524D_464F_4F44 = ASCII "RMFOOD" 的数值表示，仅作通道标识，无业务含义。
_QUOTA_LOCK_KEY = 0x524D_464F_4F44


async def get_approved_count(db: AsyncSession) -> int:
    """已批准数 = PreRegisterRequest.status=APPROVED 的计数（配额口径）。"""
    result = await db.execute(
        select(func.count())
        .select_from(PreRegisterRequest)
        .where(PreRegisterRequest.status == PreRegisterStatus.APPROVED)
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

"""
AI 用量统计 API（Phase 3）

- GET /api/v1/usage/stats  用量汇总（今日/本周/总计 + 按 Bot 分组）
- GET /api/v1/usage/recent  最近用量记录
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_current_active_user, get_db_session
from ...core.multi_tenant.tenant_security import TenantContext, require_tenant
from ...models import User
from ...models.usage import AiBotUsage

router = APIRouter(prefix="/usage", tags=["AI 用量统计"])


def _start_of_day() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


@router.get("/stats", summary="AI 用量汇总")
async def usage_stats(
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    tenant_id = tenant.org_id or 1
    today = _start_of_day()
    week_start = today - timedelta(days=today.weekday())

    async def _sum_from(cond):
        row = (await db.execute(
            select(
                func.coalesce(func.sum(AiBotUsage.prompt_tokens), 0),
                func.coalesce(func.sum(AiBotUsage.completion_tokens), 0),
                func.count(AiBotUsage.id),
            ).where(AiBotUsage.tenant_id == tenant_id, cond)
        )).one()
        return {
            "prompt_tokens": int(row[0]),
            "completion_tokens": int(row[1]),
            "total_tokens": int(row[0]) + int(row[1]),
            "calls": int(row[2]),
        }

    today_stats = await _sum_from(AiBotUsage.created_at >= today)
    week_stats = await _sum_from(AiBotUsage.created_at >= week_start)

    # 按 Bot 分组（最近 7 天）
    rows = (await db.execute(
        select(
            AiBotUsage.bot_id,
            func.coalesce(func.sum(AiBotUsage.prompt_tokens), 0),
            func.coalesce(func.sum(AiBotUsage.completion_tokens), 0),
            func.count(AiBotUsage.id),
        )
        .where(AiBotUsage.tenant_id == tenant_id, AiBotUsage.created_at >= week_start)
        .group_by(AiBotUsage.bot_id)
        .order_by(func.sum(AiBotUsage.completion_tokens).desc())
        .limit(20)
    )).all()

    return {
        "success": True,
        "today": today_stats,
        "week": week_stats,
        "by_bot": [
            {
                "bot_id": r[0],
                "prompt_tokens": int(r[1]),
                "completion_tokens": int(r[2]),
                "total_tokens": int(r[1]) + int(r[2]),
                "calls": int(r[3]),
            }
            for r in rows
        ],
    }


@router.get("/recent", summary="最近用量记录")
async def usage_recent(
    limit: int = Query(20, ge=1, le=100),
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    tenant_id = tenant.org_id or 1
    rows = (await db.execute(
        select(AiBotUsage)
        .where(AiBotUsage.tenant_id == tenant_id)
        .order_by(AiBotUsage.created_at.desc())
        .limit(limit)
    )).scalars().all()
    return {"success": True, "items": [r.to_dict() for r in rows], "total": len(rows)}
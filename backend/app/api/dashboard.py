"""
# RMFOOD 配方设计平台 - 仪表盘统计 API
提供配方、实验、用户的综合统计数据和趋势数据
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta

from ..models.models import (
    Formula, Experiment, User,
    FormulaStatus, ExperimentStatus, UserRole,
)
from ..api.deps import get_db_session, get_current_user

router = APIRouter(prefix="/dashboard", tags=["仪表盘"])


@router.get("/statistics", summary="综合统计数据")
async def get_statistics(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    返回仪表盘综合统计数据：
    - 配方总数及按状态分布
    - 实验总数及按状态分布
    - 用户总数及按角色分布
    - 最近30天每日新增配方和实验数量
    """
    # ── 配方统计 ──
    formula_total_result = await db.execute(
        select(func.count(Formula.id))
    )
    formula_total = formula_total_result.scalar() or 0

    formula_by_status_result = await db.execute(
        select(Formula.status, func.count(Formula.id)).group_by(Formula.status)
    )
    formula_status_map = {s.value: 0 for s in FormulaStatus}
    for status_val, count in formula_by_status_result.all():
        key = status_val.value if hasattr(status_val, "value") else status_val
        formula_status_map[key] = count

    # ── 实验统计 ──
    experiment_total_result = await db.execute(
        select(func.count(Experiment.id))
    )
    experiment_total = experiment_total_result.scalar() or 0

    experiment_by_status_result = await db.execute(
        select(Experiment.status, func.count(Experiment.id)).group_by(Experiment.status)
    )
    experiment_status_map = {s.value: 0 for s in ExperimentStatus}
    for status_val, count in experiment_by_status_result.all():
        key = status_val.value if hasattr(status_val, "value") else status_val
        experiment_status_map[key] = count

    # ── 用户统计 ──
    user_total_result = await db.execute(
        select(func.count(User.id))
    )
    user_total = user_total_result.scalar() or 0

    user_by_role_result = await db.execute(
        select(User.role, func.count(User.id)).group_by(User.role)
    )
    user_role_map = {r.value: 0 for r in UserRole}
    for role_val, count in user_by_role_result.all():
        key = role_val.value if hasattr(role_val, "value") else role_val
        user_role_map[key] = count

    # ── 最近30天每日活动数据 ──
    today = datetime.now().date()
    start_date = today - timedelta(days=29)
    recent_activity = []

    for i in range(30):
        day = start_date + timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = day_start + timedelta(days=1)

        formula_day_result = await db.execute(
            select(func.count(Formula.id)).where(
                Formula.created_at >= day_start,
                Formula.created_at < day_end,
            )
        )
        formula_day_count = formula_day_result.scalar() or 0

        experiment_day_result = await db.execute(
            select(func.count(Experiment.id)).where(
                Experiment.created_at >= day_start,
                Experiment.created_at < day_end,
            )
        )
        experiment_day_count = experiment_day_result.scalar() or 0

        recent_activity.append({
            "date": day.isoformat(),
            "formulas": formula_day_count,
            "experiments": experiment_day_count,
        })

    return {
        "formulas": {
            "total": formula_total,
            "by_status": formula_status_map,
        },
        "experiments": {
            "total": experiment_total,
            "by_status": experiment_status_map,
        },
        "users": {
            "total": user_total,
            "by_role": user_role_map,
        },
        "recent_activity": recent_activity,
    }


@router.get("/trends", summary="趋势数据（折线图）")
async def get_trends(
    period: str = Query(
        default="30d",
        pattern="^(7d|30d|90d)$",
        description="时间周期: 7d / 30d / 90d",
    ),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    返回趋势数据（用于折线图）：
    - 每日新增配方数
    - 每日新增实验数
    - 每日批准配方数
    """
    days_map = {"7d": 7, "30d": 30, "90d": 90}
    days = days_map.get(period, 30)

    today = datetime.now().date()
    start_date = today - timedelta(days=days - 1)
    data = []

    for i in range(days):
        day = start_date + timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = day_start + timedelta(days=1)

        formulas_created_result = await db.execute(
            select(func.count(Formula.id)).where(
                Formula.created_at >= day_start,
                Formula.created_at < day_end,
            )
        )
        formulas_created = formulas_created_result.scalar() or 0

        experiments_created_result = await db.execute(
            select(func.count(Experiment.id)).where(
                Experiment.created_at >= day_start,
                Experiment.created_at < day_end,
            )
        )
        experiments_created = experiments_created_result.scalar() or 0

        formulas_approved_result = await db.execute(
            select(func.count(Formula.id)).where(
                Formula.status == FormulaStatus.APPROVED,
                Formula.created_at >= day_start,
                Formula.created_at < day_end,
            )
        )
        formulas_approved = formulas_approved_result.scalar() or 0

        data.append({
            "date": day.isoformat(),
            "formulas_created": formulas_created,
            "experiments_created": experiments_created,
            "formulas_approved": formulas_approved,
        })

    return {
        "period": period,
        "data": data,
    }

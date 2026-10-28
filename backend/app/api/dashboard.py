"""
# RMFOOD 配方设计平台 - 仪表盘统计 API
提供配方、实验、用户的综合统计数据和趋势数据

使用 text() 查询避免 ORM 枚举类型与数据库 varchar 列不匹配问题。
P1-12：逐日统计改为 GROUP BY date(created_at) 聚合，SQL 往返次数从 O(N×2) 降为 O(1)；
       Python 侧补全缺失日期（0 值填充），响应结构与旧实现保持一致。
       注：date() 提取依赖 PostgreSQL；SQLite（测试库）下会抛异常，
       生产环境为 PostgreSQL，该异常路径不影响线上行为。
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import get_current_user, get_db_session
from ..models.models import User

router = APIRouter(prefix="/dashboard", tags=["仪表盘"])

# 默认状态分布（用于填充空值）
FORMULA_STATUS_DEFAULTS = ["draft", "pending_review", "approved", "published", "rejected", "archived"]
EXPERIMENT_STATUS_DEFAULTS = ["planned", "in_progress", "completed", "failed", "cancelled"]
USER_ROLE_DEFAULTS = ["guest", "researcher", "formulator", "reviewer", "admin"]


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
    # ── 配方统计（text 查询避免 ORM 枚举类型问题）──
    formula_total_result = await db.execute(text("SELECT count(*) FROM formulas"))
    formula_total = formula_total_result.scalar() or 0

    formula_status_result = await db.execute(text(
        "SELECT status, count(*) FROM formulas GROUP BY status"
    ))
    formula_status_map = {s: 0 for s in FORMULA_STATUS_DEFAULTS}
    for status_val, count in formula_status_result.all():
        formula_status_map[str(status_val)] = count

    # ── 实验统计 ──
    experiment_total_result = await db.execute(text("SELECT count(*) FROM experiments"))
    experiment_total = experiment_total_result.scalar() or 0

    experiment_status_result = await db.execute(text(
        "SELECT status, count(*) FROM experiments GROUP BY status"
    ))
    experiment_status_map = {s: 0 for s in EXPERIMENT_STATUS_DEFAULTS}
    for status_val, count in experiment_status_result.all():
        experiment_status_map[str(status_val)] = count

    # ── 用户统计 ──
    user_total_result = await db.execute(text("SELECT count(*) FROM users"))
    user_total = user_total_result.scalar() or 0

    user_role_result = await db.execute(text(
        "SELECT role, count(*) FROM users GROUP BY role"
    ))
    user_role_map = {r: 0 for r in USER_ROLE_DEFAULTS}
    for role_val, count in user_role_result.all():
        user_role_map[str(role_val)] = count

    # ── 最近30天每日活动数据（P1-12：GROUP BY 聚合，2 条 SQL 替代 60 次逐日往返）──
    # PostgreSQL：date(created_at) 按日统计后在 Python 侧补全缺失日期为 0
    today = datetime.now().date()
    start_date = today - timedelta(days=29)

    formula_daily = await db.execute(text("""
        SELECT date(created_at) AS d, count(*) AS c
        FROM formulas
        WHERE created_at >= :start
        GROUP BY date(created_at)
        ORDER BY d
    """), {"start": start_date})
    experiment_daily = await db.execute(text("""
        SELECT date(created_at) AS d, count(*) AS c
        FROM experiments
        WHERE created_at >= :start
        GROUP BY date(created_at)
        ORDER BY d
    """), {"start": start_date})

    formula_by_day = {row[0]: row[1] for row in formula_daily.all()}
    experiment_by_day = {row[0]: row[1] for row in experiment_daily.all()}

    recent_activity = []
    for i in range(30):
        day = start_date + timedelta(days=i)
        recent_activity.append({
            "date": day.isoformat(),
            "formulas": formula_by_day.get(day, 0),
            "experiments": experiment_by_day.get(day, 0),
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

    # P1-12：3 条 GROUP BY 聚合 SQL 替代逐日 N×3 次往返（30d=90 次 → 3 次）
    formula_daily = await db.execute(text("""
        SELECT date(created_at) AS d, count(*) AS c
        FROM formulas
        WHERE created_at >= :start
        GROUP BY date(created_at)
        ORDER BY d
    """), {"start": start_date})
    experiment_daily = await db.execute(text("""
        SELECT date(created_at) AS d, count(*) AS c
        FROM experiments
        WHERE created_at >= :start
        GROUP BY date(created_at)
        ORDER BY d
    """), {"start": start_date})
    formula_approved_daily = await db.execute(text("""
        SELECT date(created_at) AS d, count(*) AS c
        FROM formulas
        WHERE status = 'approved' AND created_at >= :start
        GROUP BY date(created_at)
        ORDER BY d
    """), {"start": start_date})

    f_by_day = {row[0]: row[1] for row in formula_daily.all()}
    e_by_day = {row[0]: row[1] for row in experiment_daily.all()}
    fa_by_day = {row[0]: row[1] for row in formula_approved_daily.all()}

    data = []
    for i in range(days):
        day = start_date + timedelta(days=i)
        data.append({
            "date": day.isoformat(),
            "formulas_created": f_by_day.get(day, 0),
            "experiments_created": e_by_day.get(day, 0),
            "formulas_approved": fa_by_day.get(day, 0),
        })

    return {
        "period": period,
        "data": data,
    }

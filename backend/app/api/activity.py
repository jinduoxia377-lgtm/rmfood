"""
用户活动统计 API
仪表盘活动时间线、待办事项、审核队列
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from ..models.models import (
    Formula, FormulaStatus, Experiment, ExperimentStatus,
    AuditLog, User, Notification, NotificationStatus,
)
from ..models.terminology import TermCategory, Term
from ..services.auth import get_current_user
from ..api.deps import get_db_session
from ..models.models import User as UserModel

router = APIRouter(prefix="/activity", tags=["活动统计"])


@router.get("/timeline", summary="获取活动时间线")
async def get_timeline(
    days: int = Query(7, ge=1, le=90, description="天数"),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db_session),
    current_user: UserModel = Depends(get_current_user),
):
    """获取最近的活动时间线"""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    events = []

    # 配方事件
    stmt = (
        select(Formula)
        .where(Formula.updated_at >= since)
        .order_by(Formula.updated_at.desc())
        .limit(limit)
    )
    formulas = (await db.execute(stmt)).scalars().all()
    for f in formulas:
        events.append({
            "id": f.id,
            "type": "formula",
            "title": f.name,
            "status": f.status.value,
            "created_at": f.updated_at.isoformat(),
            "event": "配方更新",
        })

    # 实验事件
    stmt = (
        select(Experiment)
        .where(Experiment.updated_at >= since)
        .order_by(Experiment.updated_at.desc())
        .limit(limit)
    )
    experiments = (await db.execute(stmt)).scalars().all()
    for e in experiments:
        event_type = "实验更新"
        if e.actual_start and e.updated_at.date() == e.actual_start.date():
            event_type = "实验开始"
        elif e.actual_end and e.updated_at.date() == e.actual_end.date():
            event_type = "实验完成"
        events.append({
            "id": e.id,
            "type": "experiment",
            "title": e.title,
            "status": e.status.value,
            "created_at": e.updated_at.isoformat(),
            "event": event_type,
        })

    # 术语分类事件
    stmt = (
        select(TermCategory)
        .where(TermCategory.updated_at >= since)
        .order_by(TermCategory.updated_at.desc())
        .limit(limit // 3)
    )
    categories = (await db.execute(stmt)).scalars().all()
    for c in categories:
        events.append({
            "id": c.id,
            "type": "category",
            "title": c.name,
            "status": "success",
            "created_at": c.updated_at.isoformat(),
            "event": "分类更新",
        })

    # 术语事件
    stmt = (
        select(Term)
        .where(Term.updated_at >= since)
        .order_by(Term.updated_at.desc())
        .limit(limit // 3)
    )
    terms = (await db.execute(stmt)).scalars().all()
    for t in terms:
        events.append({
            "id": t.id,
            "type": "term",
            "title": t.term,
            "status": "success",
            "created_at": t.updated_at.isoformat(),
            "event": "术语更新",
        })

    # 按时间排序
    events.sort(key=lambda x: x["created_at"], reverse=True)

    return {"items": events[:limit], "total": len(events)}


@router.get("/todos", summary="获取待办事项")
async def get_todos(
    db: AsyncSession = Depends(get_db_session),
    current_user: UserModel = Depends(get_current_user),
):
    """获取当前用户的待办事项"""
    todos = []

    # 待审核配方（审核员/管理员）
    if current_user.role.value in ("reviewer", "admin"):
        stmt = (
            select(Formula)
            .where(Formula.status == FormulaStatus.PENDING_REVIEW)
            .order_by(Formula.updated_at.asc())
            .limit(20)
        )
        pending = (await db.execute(stmt)).scalars().all()
        for f in pending:
            todos.append({
                "id": f.id,
                "type": "review_formula",
                "title": f"审核配方: {f.name}",
                "detail": f.code,
                "priority": "high",
                "created_at": f.updated_at.isoformat(),
            })

    # 进行中的实验
    stmt = (
        select(Experiment)
        .where(
            and_(
                Experiment.researcher_id == current_user.id,
                Experiment.status == ExperimentStatus.IN_PROGRESS,
            )
        )
        .order_by(Experiment.updated_at.desc())
        .limit(10)
    )
    active_exps = (await db.execute(stmt)).scalars().all()
    for e in active_exps:
        todos.append({
            "id": e.id,
            "type": "active_experiment",
            "title": f"进行中: {e.title}",
            "detail": e.code,
            "priority": "medium",
            "created_at": e.updated_at.isoformat(),
        })

    # 计划中实验
    stmt = (
        select(Experiment)
        .where(
            and_(
                Experiment.researcher_id == current_user.id,
                Experiment.status == ExperimentStatus.PLANNED,
            )
        )
        .order_by(Experiment.start_date.asc().nullslast())
        .limit(10)
    )
    planned = (await db.execute(stmt)).scalars().all()
    for e in planned:
        todos.append({
            "id": e.id,
            "type": "planned_experiment",
            "title": f"待开始: {e.title}",
            "detail": e.code,
            "priority": "low",
            "created_at": e.updated_at.isoformat(),
        })

    return {"items": todos, "total": len(todos)}


@router.get("/review-queue", summary="获取审核队列")
async def get_review_queue(
    db: AsyncSession = Depends(get_db_session),
    current_user: UserModel = Depends(get_current_user),
):
    """获取待审核配方队列"""
    stmt = (
        select(Formula)
        .where(Formula.status == FormulaStatus.PENDING_REVIEW)
        .order_by(Formula.updated_at.asc())
        .limit(50)
    )
    formulas = (await db.execute(stmt)).scalars().all()

    results = []
    for f in formulas:
        creator = await db.get(User, f.creator_id)
        results.append({
            "id": f.id,
            "name": f.name,
            "code": f.code,
            "creator_name": creator.full_name or creator.username if creator else "未知",
            "target_effects": f.target_effects or [],
            "submitted_at": f.updated_at.isoformat(),
        })

    return {"items": results, "total": len(results)}

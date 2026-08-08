"""
审计日志 API 路由
管理员查看操作审计记录
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import get_db_session, require_role
from ..models.models import AuditLog, User, UserRole
from ..services.user import UserService

router = APIRouter(prefix="/admin", tags=["审计日志"])


@router.get("/audit-logs", summary="审计日志列表（管理员）")
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: str | None = Query(None, description="操作类型过滤"),
    entity_type: str | None = Query(None, description="实体类型过滤"),
    user_id: int | None = Query(None, description="操作用户ID"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """管理员查看审计日志列表"""
    query = select(AuditLog)
    count_query = select(func.count()).select_from(AuditLog)

    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
        count_query = count_query.where(AuditLog.entity_type == entity_type)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
        count_query = count_query.where(AuditLog.user_id == user_id)

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()

    # 获取关联用户名
    user_service = UserService(db)
    user_ids = list({item.user_id for item in items if item.user_id})
    user_map = {}
    for uid in user_ids:
        try:
            user = await user_service.get_user(uid)
            if user:
                user_map[uid] = user.username
        except Exception as e:
            logger.warning("用户查询失败 uid=%s: %s", uid, e)

    return {
        "items": [
            {
                "id": item.id,
                "user_id": item.user_id,
                "username": user_map.get(item.user_id),
                "action": item.action,
                "entity_type": item.entity_type,
                "entity_id": item.entity_id,
                "details": item.details,
                "ip_address": item.ip_address,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/audit-logs/actions", summary="获取所有操作类型（管理员）")
async def get_audit_actions(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """获取系统中所有存在的审计操作类型"""
    result = await db.execute(
        select(AuditLog.action).distinct().order_by(AuditLog.action)
    )
    actions = [row[0] for row in result.all()]
    return {"actions": actions}

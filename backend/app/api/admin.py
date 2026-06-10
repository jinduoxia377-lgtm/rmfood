"""
通知与用户管理 API
Phase 2: 通知列表/已读/删除，用户管理（管理员）
P1-2: 账号安全管理（防暴力破解）
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import get_db_session, get_current_user, require_role
from ..models.models import (
    User, UserRole, Notification, NotificationStatus,
)
from ..schemas.user import UserResponse

router = APIRouter(tags=["通知与用户管理"])


# ═══════════════════════════════════════
# 通知接口
# ═══════════════════════════════════════

@router.get("/notifications", summary="获取通知列表")
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None, description="通知状态过滤"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取当前用户的通知列表"""
    query = select(Notification).where(Notification.user_id == current_user.id)
    count_query = select(func.count()).select_from(Notification).where(
        Notification.user_id == current_user.id
    )

    if status:
        query = query.where(Notification.status == status)
        count_query = count_query.where(Notification.status == status)

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(Notification.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()

    # 统计未读数
    unread_count = (await db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == current_user.id,
            Notification.status == NotificationStatus.UNREAD,
        )
    )).scalar() or 0

    return {
        "items": [
            {
                "id": n.id,
                "type": n.type.value,
                "status": n.status.value,
                "title": n.title,
                "content": n.content,
                "link": n.link,
                "metadata": n.metadata_,
                "read_at": n.read_at.isoformat() if n.read_at else None,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in items
        ],
        "total": total,
        "unread_count": unread_count,
        "page": page,
        "page_size": page_size,
    }


@router.post("/notifications/{notification_id}/read", summary="标记通知已读")
async def mark_notification_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """将通知标记为已读"""
    notification = (await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )).scalar_one_or_none()
    if not notification:
        raise HTTPException(404, detail="通知不存在")
    
    notification.status = NotificationStatus.READ
    notification.read_at = func.datetime('now')
    await db.commit()
    return {"detail": "已标记为已读"}


@router.post("/notifications/read-all", summary="全部标记已读")
async def mark_all_read(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """将当前用户所有未读通知标记为已读"""
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.status == NotificationStatus.UNREAD,
        )
        .values(status=NotificationStatus.READ)
    )
    await db.commit()
    return {"detail": "已全部标记为已读"}


# ═══════════════════════════════════════
# 用户管理（管理员）
# ═══════════════════════════════════════

@router.get("/admin/users", summary="用户列表（管理员）")
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: str | None = Query(None, description="角色过滤"),
    search: str | None = Query(None, description="搜索用户名/姓名"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """管理员查看用户列表"""
    query = select(User)
    count_query = select(func.count()).select_from(User)

    if role:
        query = query.where(User.role == role)
        count_query = count_query.where(User.role == role)
    if search:
        like_pattern = f"%{search}%"
        query = query.where(
            (User.username.ilike(like_pattern)) | (User.full_name.ilike(like_pattern))
        )
        count_query = count_query.where(
            (User.username.ilike(like_pattern)) | (User.full_name.ilike(like_pattern))
        )

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(User.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()

    return {
        "items": [UserResponse.model_validate(u).model_dump() for u in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.put("/admin/users/{user_id}/role", summary="修改用户角色（管理员）")
async def update_user_role(
    user_id: int,
    role: str = Query(..., description="新角色"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """管理员修改用户角色"""
    if user_id == current_user.id:
        raise HTTPException(400, detail="不能修改自己的角色")
    
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, detail="用户不存在")
    
    try:
        new_role = UserRole(role)
    except ValueError:
        raise HTTPException(400, detail=f"无效的角色: {role}")
    
    user.role = new_role
    await db.commit()
    return {"detail": f"用户 {user.username} 角色已更新为 {role}"}


@router.put("/admin/users/{user_id}/status", summary="启用/禁用用户（管理员）")
async def toggle_user_status(
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """管理员启用或禁用用户"""
    if user_id == current_user.id:
        raise HTTPException(400, detail="不能禁用自己")
    
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, detail="用户不存在")
    
    user.is_active = not user.is_active
    await db.commit()
    action = "启用" if user.is_active else "禁用"
    return {"detail": f"用户 {user.username} 已{action}"}


# ═══════════════════════════════════════
# 账号安全管理 (P1-2: 防暴力破解)
# ═══════════════════════════════════════

@router.post("/admin/users/{user_id}/unlock", summary="解锁账号（管理员）")
async def unlock_user_account(
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """
    管理员手动解锁被锁定的账号
    
    功能:
    - 清除登录失败计数器
    - 解除账号锁定状态
    - 记录审计日志
    
    权限要求: ADMIN 角色
    """
    from ..core.account_lockout import AccountLockout
    
    # 检查目标用户是否存在
    target_user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 执行解锁操作
    lockout = AccountLockout()
    success = await lockout.manual_unlock(db, user_id, current_user)
    
    if success:
        return {
            "detail": f"账号 {target_user.username} 已成功解锁",
            "unlocked_at": datetime.now().isoformat(),
            "operator": current_user.username,
        }
    else:
        raise HTTPException(
            status_code=500,
            detail="解锁失败，请稍后重试"
        )


@router.get("/admin/users/{user_id}/lock-status", summary="查看账号锁定状态（管理员）")
async def get_account_lock_status(
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """
    查看用户的账号锁定状态和安全信息
    
    返回信息:
    - 当前锁定状态
    - 登录失败次数
    - 锁定剩余时间（如已锁定）
    - 最后登录时间
    """
    from ..core.account_lockout import AccountLockout
    from datetime import datetime, timezone
    
    # 查询目标用户
    target_user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 检查锁定状态
    lockout = AccountLockout()
    is_locked, lock_info = await lockout.is_account_locked(db, target_user.username)
    
    return {
        "user_id": target_user.id,
        "username": target_user.username,
        "is_locked": is_locked,
        "login_attempts": target_user.login_attempts or 0,
        "last_login": target_user.last_login.isoformat() if target_user.last_login else None,
        "lock_info": lock_info if is_locked else None,
        "security_settings": {
            "max_attempts": lockout.max_attempts,
            "lockout_duration_minutes": int(lockout.lockout_duration.total_seconds() / 60),
        }
    }

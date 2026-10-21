"""RMFOOD 通知系统 API Router（扩展版）

提供多渠道通知管理、已读状态追踪和偏好设置的RESTful接口。
支持云端同步、团队协作和AI辅助模块的通知功能。
"""
import logging  # A-27：文件里只有函数内的 import logging，模块级 logger 拿不到
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, delete

from ...core.database.session import get_db
from ...models.notification import Notification, NotificationPreference as NotificationPreferenceModel
from ...models.enums import NotificationType, NotificationStatus
from ...schemas.notification_schemas import (
    NotificationItem,
    NotificationListResponse,
    UnreadCountResponse,
    MarkReadResponse,
    MarkAllReadResponse,
    DeleteNotificationResponse,
    NotificationPreferencesUpdate,
    NotificationPreferencesResponse,
)
from ...api.deps import get_current_active_user, CurrentUser, DbSession
logger = logging.getLogger(__name__)  # A-27：原缺失

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


@router.get("", response_model=NotificationListResponse, summary="通知列表")
async def list_notifications(
    db: DbSession,
    current_user: CurrentUser,
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    type_filter: Optional[str] = Query(None, alias="type", description="类型筛选"),
    is_read: Optional[bool] = Query(None, alias="is_read", description="是否已读筛选"),
):
    """
    获取当前用户的通知列表

    - **page**: 页码（默认1）
    - **page_size**: 每页条数（默认20，最大100）
    - **type**: 可选，按通知类型筛选 (system/formula_review/experiment_complete/ai_task_done/data_sync)
    - **is_read**: 可选，按已读状态筛选

    返回分页的通知列表和未读数量。
    """
    try:
        query = select(Notification).where(Notification.user_id == current_user.id)
        count_query = select(func.count(Notification.id)).where(Notification.user_id == current_user.id)

        if type_filter:
            try:
                notif_type = NotificationType(type_filter)
                query = query.where(Notification.type == notif_type)
                count_query = count_query.where(Notification.type == notif_type)
            except ValueError:
                logger.debug(f"无效的通知类型过滤器: {type_filter}")

        if is_read is not None:
            query = query.where(Notification.is_read == is_read)
            count_query = count_query.where(Notification.is_read == is_read)

        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        unread_result = await db.execute(
            select(func.count(Notification.id)).where(
                Notification.user_id == current_user.id,
                Notification.is_read == False,
            )
        )
        unread_count = unread_result.scalar() or 0

        offset = (page - 1) * page_size
        query = query.order_by(Notification.created_at.desc()).offset(offset).limit(page_size)

        result = await db.execute(query)
        notifications = result.scalars().all()

        return NotificationListResponse(
            notifications=[NotificationItem.model_validate(n) for n in notifications],
            total=total,
            unread_count=unread_count,
            page=page,
            page_size=page_size,
        )
    except Exception as e:
        # 数据库异常时返回空结果而非 503 崩溃
        import logging
        logging.getLogger(__name__).warning(f"通知查询异常，返回空列表: {e}")
        return NotificationListResponse(
            notifications=[], total=0, unread_count=0, page=page, page_size=page_size,
        )


@router.get("/unread-count", response_model=UnreadCountResponse, summary="未读数量")
async def get_unread_count(
    db: DbSession,
    current_user: CurrentUser,
):
    """
    获取当前用户的未读通知数量

    快速接口，用于显示未读角标。
    同时返回最后读取时间。
    """
    try:
        unread_result = await db.execute(
            select(func.count(Notification.id)).where(
                Notification.user_id == current_user.id,
                Notification.is_read == False,
            )
        )
        unread_count = unread_result.scalar() or 0

        last_read_result = await db.execute(
            select(func.max(Notification.read_at)).where(
                Notification.user_id == current_user.id,
                Notification.is_read == True,
            )
        )
        last_read_at = last_read_result.scalar()

        return UnreadCountResponse(
            unread_count=unread_count,
            last_read_at=last_read_at,
        )
    except Exception as e:
        logging.getLogger(__name__).warning(f"未读计数查询异常: {e}")
        return UnreadCountResponse(unread_count=0, last_read_at=None)


@router.put("/{notification_id}/read", response_model=MarkReadResponse, summary="标记已读")
async def mark_as_read(
    notification_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    将指定通知标记为已读
    
    - **notification_id**: 通知ID
    
    更新已读状态和读取时间。
    """
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="通知不存在",
        )
    
    if notification.is_read:
        return MarkReadResponse(
            success=True,
            message="该通知已经是已读状态",
            notification_id=notification_id,
            is_read=True,
        )
    
    notification.is_read = True
    notification.status = NotificationStatus.READ
    notification.read_at = _now()
    await db.commit()
    
    return MarkReadResponse(
        success=True,
        message="已标记为已读",
        notification_id=notification_id,
        is_read=True,
    )


@router.put("/read-all", response_model=MarkAllReadResponse, summary="全部标记已读")
async def mark_all_as_read(
    db: DbSession,
    current_user: CurrentUser,
    type_filter: Optional[str] = Query(None, alias="type", description="可选，只标记特定类型为已读"),
):
    """
    将所有通知（或指定类型）标记为已读
    
    - **type**: 可选，只标记此类型的通知为已读
    
    批量更新操作，返回标记的数量。
    """
    query = update(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).values(is_read=True, status=NotificationStatus.READ, read_at=_now())
    
    if type_filter:
        try:
            notif_type = NotificationType(type_filter)
            query = query.where(Notification.type == notif_type)
        except ValueError:
            logger.warning("无效的通知类型过滤器，已忽略: %s", type_filter)
    
    result = await db.execute(query)
    await db.commit()
    
    marked_count = result.rowcount
    
    return MarkAllReadResponse(
        success=True,
        message=f"已将 {marked_count} 条通知标记为已读",
        marked_count=marked_count,
        timestamp=_now(),
    )


@router.delete("/clear-all", summary="清空所有通知")
async def clear_all_notifications(
    db: DbSession,
    current_user: CurrentUser,
    type_filter: Optional[str] = Query(None, alias="type", description="可选，只清除特定类型"),
    confirm: bool = Query(True, description="确认操作（必须为true）"),
):
    """
    清空当前用户的所有通知（或指定类型）
    
    - **type**: 可选，只清除此类型
    - **confirm**: 必须设置为true以确认操作
    
    ⚠️ 此操作不可逆，请谨慎使用。
    """
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请设置 confirm=true 以确认清空操作",
        )

    query = delete(Notification).where(Notification.user_id == current_user.id)

    if type_filter:
        try:
            notif_type = NotificationType(type_filter)
            query = query.where(Notification.type == notif_type)
        except ValueError:
            logger.warning("无效的通知类型过滤器，已忽略: %s", type_filter)

    result = await db.execute(query)
    await db.commit()

    cleared_count = result.rowcount

    return {
        "success": True,
        "message": f"已清空 {cleared_count} 条通知",
        "cleared_count": cleared_count,
    }


@router.delete("/{notification_id}", response_model=DeleteNotificationResponse, summary="删除通知")
async def delete_notification(
    notification_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    删除指定通知
    
    - **notification_id**: 通知ID
    
    物理删除通知记录。
    """
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="通知不存在",
        )
    
    await db.delete(notification)
    await db.commit()
    
    return DeleteNotificationResponse(
        success=True,
        message="通知已删除",
        deleted_id=notification_id,
    )


@router.put("/preferences", response_model=NotificationPreferencesResponse, summary="通知偏好设置")
async def update_preferences(
    request: NotificationPreferencesUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    更新通知偏好设置（持久化到 notification_preferences 表）
    
    - **email_enabled**: 启用邮件通知
    - **push_enabled**: 启用推送通知
    - **team_invite**: 团队邀请通知
    - **sync_status**: 同步状态通知
    - **ai_task_complete**: AI任务完成通知
    - **system_alert**: 系统告警通知
    - **formula_review**: 配方审核通知
    - **experiment_complete**: 实验完成通知
    - **quiet_hours_start/end**: 免打扰时间段 (HH:MM格式)
    
    只传入需要修改的字段，未传字段保持不变。
    """
    preferences_data = {
        "user_id": current_user.id,
        "updated_at": _now(),
    }

    if request.email_enabled is not None:
        preferences_data["email_enabled"] = request.email_enabled
    if request.push_enabled is not None:
        preferences_data["push_enabled"] = request.push_enabled
    if request.browser_push is not None:
        preferences_data["browser_push"] = request.browser_push
        preferences_data["push_enabled"] = request.browser_push
    if request.in_app_enabled is not None:
        preferences_data["in_app_enabled"] = request.in_app_enabled
    if request.team_invite is not None:
        preferences_data["team_invite"] = request.team_invite
    if request.sync_status is not None:
        preferences_data["sync_status"] = request.sync_status
    if request.ai_task_complete is not None:
        preferences_data["ai_task_complete"] = request.ai_task_complete
    if request.system_alert is not None:
        preferences_data["system_alert"] = request.system_alert
    if request.system_updates is not None:
        preferences_data["system_updates"] = request.system_updates
        preferences_data["system_alert"] = request.system_updates
    if request.formula_review is not None:
        preferences_data["formula_review"] = request.formula_review
    if request.experiment_complete is not None:
        preferences_data["experiment_complete"] = request.experiment_complete
    if request.notification_frequency is not None:
        preferences_data["notification_frequency"] = request.notification_frequency
    if request.notification_priority is not None:
        preferences_data["notification_priority"] = request.notification_priority
    if request.quiet_hours_start and request.quiet_hours_end:
        preferences_data["quiet_hours"] = {
            "start": request.quiet_hours_start,
            "end": request.quiet_hours_end,
        }

    # ── 持久化到 notification_preferences 表 ──
    result = await db.execute(
        select(NotificationPreferenceModel).where(
            NotificationPreferenceModel.user_id == current_user.id
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = NotificationPreferenceModel(user_id=current_user.id)
        db.add(row)

    if request.email_enabled is not None:
        row.email_enabled = request.email_enabled
    if request.push_enabled is not None:
        row.webhook_enabled = request.push_enabled
    if request.browser_push is not None:
        row.webhook_enabled = request.browser_push
    if request.in_app_enabled is not None:
        row.in_app_enabled = request.in_app_enabled

    # 扩展偏好（团队/同步/AI/系统/审核/实验/频率/优先级）与免打扰时段存入 settings JSON
    settings = dict(row.settings or {})
    for key in (
        "team_invite",
        "sync_status",
        "ai_task_complete",
        "system_alert",
        "formula_review",
        "experiment_complete",
        "notification_frequency",
        "notification_priority",
    ):
        val = getattr(request, key, None)
        if val is not None:
            settings[key] = val
    if request.system_updates is not None:
        settings["system_alert"] = request.system_updates
    if request.quiet_hours_start and request.quiet_hours_end:
        settings["quiet_hours"] = {
            "start": request.quiet_hours_start,
            "end": request.quiet_hours_end,
        }
    row.settings = settings

    await db.commit()

    return NotificationPreferencesResponse(
        user_id=current_user.id,
        preferences=preferences_data,
        updated_at=_now(),
    )


@router.get("/preferences", response_model=NotificationPreferencesResponse, summary="获取通知偏好")
async def get_preferences(
    db: DbSession,
    current_user: CurrentUser,
):
    """
    获取当前用户的通知偏好设置（从 notification_preferences 表读取）
    
    返回所有偏好设置项的当前值。
    """
    default_preferences = {
        "email_enabled": True,
        "push_enabled": True,
        "browser_push": True,
        "in_app_enabled": True,
        "team_invite": True,
        "sync_status": True,
        "ai_task_complete": True,
        "system_alert": True,
        "system_updates": True,
        "formula_review": True,
        "experiment_complete": True,
        "notification_frequency": "realtime",
        "notification_priority": "high",
        "quiet_hours": None,
    }

    result = await db.execute(
        select(NotificationPreferenceModel).where(
            NotificationPreferenceModel.user_id == current_user.id
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return NotificationPreferencesResponse(
            user_id=current_user.id,
            preferences=default_preferences,
            updated_at=None,
        )

    settings = row.settings or {}
    quiet_hours = settings.get("quiet_hours") or {}
    preferences = {
        "email_enabled": row.email_enabled,
        "push_enabled": row.webhook_enabled,
        "browser_push": row.webhook_enabled,
        "in_app_enabled": row.in_app_enabled,
        "team_invite": settings.get("team_invite", True),
        "sync_status": settings.get("sync_status", True),
        "ai_task_complete": settings.get("ai_task_complete", True),
        "system_alert": settings.get("system_alert", True),
        "system_updates": settings.get("system_alert", True),
        "formula_review": settings.get("formula_review", True),
        "experiment_complete": settings.get("experiment_complete", True),
        "notification_frequency": settings.get("notification_frequency", "realtime"),
        "notification_priority": settings.get("notification_priority", "high"),
        "quiet_hours": quiet_hours or None,
    }

    return NotificationPreferencesResponse(
        user_id=current_user.id,
        preferences=preferences,
        updated_at=row.updated_at,
    )


@router.get("/{notification_id}", response_model=NotificationItem, summary="获取通知详情")
async def get_notification_detail(
    notification_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    获取单条通知的详细信息
    
    - **notification_id**: 通知ID
    
    返回完整的通知内容和元数据。
    """
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="通知不存在",
        )
    
    return NotificationItem.model_validate(notification)

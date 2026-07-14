"""
通知中心 API 路由

提供:
- 通知列表查询（分页、筛选）
- 标记已读/全部已读
- 删除通知
- 用户偏好管理
- 批量发送（管理员）
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


from .deps import get_db_session, get_current_user
from ..core.notification_center import (
    NotificationService,
    UserNotificationPreference,
    NotificationChannel,
    NotificationCategory,
    notify_mention,
    notify_comment,
    notify_approval_required,
    notify_ai_generation_complete,
)


router = APIRouter(prefix="/notifications", tags=["notifications"])


# ============================================================
# Request/Response Models
# ============================================================

class MarkReadRequest(BaseModel):
    notification_ids: List[str]


class UpdatePreferenceRequest(BaseModel):
    enabled: Optional[bool] = None
    channel_preferences: Optional[dict] = None
    category_enabled: Optional[dict] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    digest_mode: Optional[bool] = None
    digest_frequency: Optional[str] = None


class BulkSendRequest(BaseModel):
    template_id: str
    user_ids: List[int]
    variables: dict
    channels: Optional[List[str]] = None
    batch_size: int = 100


class SendTestNotificationRequest(BaseModel):
    template_id: str
    recipient_email: Optional[EmailStr] = None


# ============================================================
# Helper Functions
# ============================================================

def _get_user_id(current_user) -> Optional[int]:
    """
    安全获取用户ID（兼容ORM对象和字典）
    
    Args:
        current_user: User ORM对象或字典
        
    Returns:
        用户ID或None
    """
    if current_user is None:
        return None
    
    # 优先尝试属性访问（ORM对象）
    if hasattr(current_user, 'id'):
        return current_user.id
    
    # 回退到字典访问
    if isinstance(current_user, dict):
        return current_user.get('id')
    
    logger.warning(f"无法从current_user对象获取ID: {type(current_user)}")
    return None


# ============================================================
# Endpoints
# ============================================================

@router.get("", summary="获取通知列表")
async def get_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    unread_only: bool = Query(False),
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """
    获取当前用户的通知列表

    - 支持分页浏览
    - 可筛选未读通知
    - 可按分类筛选（collaboration/workflow/security等）
    - 返回未读计数
    """
    user_id = _get_user_id(current_user)
    logger.debug(f"🔍 [DEBUG] get_notifications called: page={page}, user_id={user_id}")

    try:
        if not current_user:
            return {
                "items": [],
                "pagination": {"page": page, "page_size": page_size, "total": 0, "total_pages": 0},
                "unread_count": 0,
            }

        service = NotificationService(db)

        result = await service.get_user_notifications(
            user_id=user_id,
            page=page,
            page_size=page_size,
            unread_only=unread_only,
            category=category,
        )

        return result
    except Exception as e:
        logger.error("获取通知失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.get("/unread-count", summary="获取未读数量")
async def get_unread_count(
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """快速获取当前用户未读通知数量"""
    if not current_user:
        return {"unread_count": 0}

    user_id = _get_user_id(current_user)
    service = NotificationService(db)

    result = await service.get_user_notifications(
        user_id=user_id,
        page_size=1,
    )

    return {"unread_count": result["unread_count"]}


@router.post("/read", summary="标记通知为已读")
async def mark_notifications_read(
    request: MarkReadRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """
    将指定通知标记为已读

    - 支持批量操作
    - 自动更新未读计数
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="需要登录")

    if not request.notification_ids:
        raise HTTPException(status_code=400, detail="notification_ids 不能为空")

    user_id = _get_user_id(current_user)
    service = NotificationService(db)
    await service.mark_as_read(user_id, request.notification_ids)

    return {"success": True, "marked_count": len(request.notification_ids)}


@router.post("/read-all", summary="全部标记为已读")
async def mark_all_read(
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """将所有未读通知标记为已读"""
    if not current_user:
        raise HTTPException(status_code=401, detail="需要登录")

    user_id = _get_user_id(current_user)
    service = NotificationService(db)
    await service.mark_all_as_read(user_id)

    return {"success": True}


@router.delete("/{notification_id}", summary="删除通知")
async def delete_notification(
    notification_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """删除指定通知"""
    if not current_user:
        raise HTTPException(status_code=401, detail="需要登录")

    user_id = _get_user_id(current_user)
    service = NotificationService(db)
    await service.delete_notification(user_id, notification_id)

    return {"success": True}


@router.get("/preferences", summary="获取通知偏好设置")
async def get_preferences(
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """获取当前用户的通知偏好设置"""
    if not current_user:
        raise HTTPException(status_code=401, detail="需要登录")

    user_id = _get_user_id(current_user)
    service = NotificationService(db)
    preference = await service._get_user_preference(user_id)

    return {
        "user_id": user_id,
        **preference.__dict__,
    }


@router.put("/preferences", summary="更新通知偏好设置")
async def update_preferences(
    request: UpdatePreferenceRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """
    更新用户的通知偏好设置

    - 控制各渠道开关
    - 设置分类过滤
    - 配置免打扰时段
    - 开启摘要模式
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="需要登录")

    user_id = _get_user_id(current_user)
    service = NotificationService(db)
    
    existing = await service._get_user_preference(user_id)
    
    update_data = {}
    if request.enabled is not None:
        update_data["enabled"] = request.enabled
    if request.channel_preferences is not None:
        update_data["channel_preferences"] = request.channel_preferences
    if request.category_enabled is not None:
        update_data["category_enabled"] = request.category_enabled
    if request.quiet_hours_start is not None:
        update_data["quiet_hours_start"] = request.quiet_hours_start
    if request.quiet_hours_end is not None:
        update_data["quiet_hours_end"] = request.quiet_hours_end
    if request.digest_mode is not None:
        update_data["digest_mode"] = request.digest_mode
    if request.digest_frequency is not None:
        update_data["digest_frequency"] = request.digest_frequency

    new_preference = UserNotificationPreference(**{**existing.__dict__, **update_data})
    await service.update_user_preference(user_id, new_preference)

    return {"success": True, "message": "偏好设置已更新"}


@router.post("/send", summary="发送测试通知（管理员）")
async def send_test_notification(
    request: SendTestNotificationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """
    发送测试通知（仅管理员可用）

    用于验证通知模板和渠道配置是否正确
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="需要登录")

    user_id = _get_user_id(current_user)
    service = NotificationService(db)
    
    # 检查权限
    user_info = await service._get_user_info(user_id)
    if not user_info or user_info.get("role") != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可执行此操作")

    try:
        # 发送测试通知给当前用户
        background_tasks.add_task(
            notify_ai_generation_complete,
            user_id=user_id,
            formula_name="测试配方",
            formula_id=0,
            channel=NotificationChannel.IN_APP,
        )

        return {
            "success": True,
            "message": f"测试通知已发送至用户 {user_id}",
            "template_id": request.template_id,
        }
    except Exception as e:
        logger.error("发送测试通知失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.post("/bulk-send", summary="批量发送通知（管理员）")
async def bulk_send_notifications(
    request: BulkSendRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """
    批量发送通知（仅管理员可用）

    - 支持多渠道同时发送
    - 自动分批处理避免超载
    - 记录发送统计
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="需要登录")

    user_id = _get_user_id(current_user)
    service = NotificationService(db)
    
    # 检查权限
    user_info = await service._get_user_info(user_id)
    if not user_info or user_info.get("role") != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可执行此操作")

    if not request.user_ids:
        raise HTTPException(status_code=400, detail="user_ids 不能为空")

    try:
        total_results = await service.send_bulk_notifications(
            template_id=request.template_id,
            user_ids=request.user_ids,
            variables=request.variables,
            channels=request.channels,
            batch_size=request.batch_size,
        )

        return {
            "success": True,
            "total_recipients": total_results["total_recipients"],
            "success_count": total_results["success"],
            "failed_count": total_results["failed"],
            "details": total_results.get("details", []),
        }
    except Exception as e:
        logger.error("批量发送通知失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.delete("/clear-all", summary="清空所有通知")
async def clear_all_notifications(
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user),
):
    """清空当前用户的所有通知（慎用）"""
    if not current_user:
        raise HTTPException(status_code=401, detail="需要登录")

    user_id = _get_user_id(current_user)
    service = NotificationService(db)
    
    deleted_count = await service.clear_all_user_notifications(user_id)

    return {
        "success": True,
        "deleted_count": deleted_count,
        "message": f"已清空 {deleted_count} 条通知",
    }

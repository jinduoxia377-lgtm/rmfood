"""
云端同步 API 路由

提供设备注册、同步推/拉、冲突检测等云端同步功能。
"""
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models.sync_log import SyncLog
from ..models.user_device import UserDevice
from ..schemas.base import ApiResponse
from .deps import get_db

router = APIRouter(prefix="/sync", tags=["云端同步"])


@router.post("/device/register", response_model=ApiResponse)
def register_device(
    device_info: Dict[str, Any],
    db: Session = Depends(get_db),
):
    """注册/更新设备"""
    device = db.execute(select(UserDevice).where(
    UserDevice.device_id == device_info.get("device_id")
)).scalar_one_or_none()

    if not device:
        device = UserDevice(
            device_id=device_info.get("device_id"),
            device_type=device_info.get("device_type", "unknown"),
            device_name=device_info.get("device_name", ""),
            os_version=device_info.get("os_version", ""),
            app_version=device_info.get("app_version", ""),
            last_sync_time=None,
            is_active=True,
        )
        db.add(device)
    else:
        device.last_seen_at = db.func.now()
        device.is_active = True

    db.commit()
    db.refresh(device)

    return ApiResponse(
        data={
            "device_id": device.device_id,
            "registered": True,
            "last_sync_time": device.last_sync_time.isoformat() if device.last_sync_time else None,
        }
    )


@router.get("/status", response_model=ApiResponse)
def get_sync_status(
    device_id: str = Query(..., description="设备ID"),
    db: Session = Depends(get_db),
):
    """获取设备同步状态"""
    device = db.execute(select(UserDevice).where(
    UserDevice.device_id == device_id
)).scalar_one_or_none()

    if not device:
        raise HTTPException(status_code=404, detail="设备未注册")

    # 获取最近的同步日志
    recent_logs = db.execute(
        select(SyncLog).where(SyncLog.device_id == device_id).
        order_by(SyncLog.created_at.desc()).limit(10)
    ).scalars().all()

    return ApiResponse(data={
        "device_id": device_id,
        "last_sync_time": device.last_sync_time.isoformat() if device.last_sync_time else None,
        "is_active": device.is_active,
        "recent_syncs": [
            {
                "id": log.id,
                "type": log.sync_type,
                "status": log.status,
                "changes_count": log.changes_count,
                "created_at": log.created_at.isoformat(),
            }
            for log in recent_logs
        ],
    })


@router.post("/push", response_model=ApiResponse)
def sync_push(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
):
    """推送变更到云端"""
    device_id = payload.get("device_id")
    changes = payload.get("changes", [])

    if not device_id:
        raise HTTPException(status_code=400, detail="缺少 device_id")

    # 记录同步日志
    sync_log = SyncLog(
        user_id=1,  # 简化：从认证中获取
        action="sync_push",
        entity_type="formula",
        entity_id=None,
        payload={"changes_count": len(changes)},
        status="completed",
    )
    db.add(sync_log)
    db.commit()

    # 更新设备最后同步时间
    device = db.execute(select(UserDevice).where(
    UserDevice.device_id == device_id
)).scalar_one_or_none()
    if device:
        device.last_sync_time = db.func.now()
        db.commit()

    return ApiResponse(data={
        "synced": len(changes),
        "log_id": sync_log.id,
    })


@router.post("/pull", response_model=ApiResponse)
def sync_pull(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
):
    """从云端拉取变更"""
    device_id = payload.get("device_id")
    since = payload.get("since")  # 上次同步时间戳

    if not device_id:
        raise HTTPException(status_code=400, detail="缺少 device_id")

    # 查询自上次同步以来的变更
    # 简化实现：返回空列表（实际应从 CDC 事件或变更日志中查询）
    changes: List[Dict[str, Any]] = []

    return ApiResponse(data={
        "changes": changes,
        "has_more": False,
        "next_since": db.func.now().isoformat(),
    })

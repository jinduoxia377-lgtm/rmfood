"""
移动端 API 路由（M2.6）

轻量级 API 端点，专为移动端优化。
返回精简的 JSON 响应，减少数据传输量。
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from ..application.mobile_facade import MobileFacade
from ..infrastructure.mobile_service import MobileService
from ..models.user_model import User
from ..services.auth import get_current_user

# 依赖注入：创建 MobileService 实例并注入到 Facade
_mobile_service = MobileService()

router = APIRouter(prefix="/mobile", tags=["移动端"])


@router.get("/dashboard")
async def mobile_dashboard(
    current_user: User = Depends(get_current_user),
):
    """移动端仪表盘"""
    facade = MobileFacade(_mobile_service)
    dashboard = await facade.get_dashboard(current_user.id)
    return {"data": dashboard.__dict__ if hasattr(dashboard, '__dict__') else dashboard, "code": 200}


@router.post("/sync/push")
async def sync_push(
    items: list[dict],
    current_user: User = Depends(get_current_user),
):
    """离线同步 - 客户端推送到服务器"""
    facade = MobileFacade(_mobile_service)
    results = await facade.sync_push(items)
    return {"data": results, "code": 200}


@router.get("/sync/pull")
async def sync_pull(
    last_sync: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """离线同步 - 客户端拉取服务器变更"""
    facade = MobileFacade(_mobile_service)
    changes = await facade.sync_pull(last_sync)
    return {"data": changes, "code": 200}


@router.get("/notifications")
async def list_notifications(
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
):
    """获取通知列表"""
    facade = MobileFacade(_mobile_service)
    notifications = await facade.get_notifications(str(current_user.id), limit)
    return {
        "data": [n.__dict__ if hasattr(n, '__dict__') else n for n in notifications],
        "total": len(notifications),
        "code": 200,
    }


@router.post("/notifications/{notification_id}/read")
async def mark_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
):
    """标记通知已读"""
    facade = MobileFacade(_mobile_service)
    success = await facade.mark_notification_read(notification_id)
    return {"data": {"success": success}, "code": 200}


@router.get("/trace/{batch_id}")
async def trace_product(
    batch_id: str,
    current_user: User = Depends(get_current_user),
):
    """扫码溯源"""
    facade = MobileFacade(_mobile_service)
    record = await facade.trace_product(batch_id)
    if not record:
        raise HTTPException(status_code=404, detail="未找到溯源信息")
    return {"data": record.__dict__ if hasattr(record, '__dict__') else record, "code": 200}


@router.get("/formulas/pending-review")
async def pending_review(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
):
    """待审核配方列表（精简版）"""
    facade = MobileFacade(_mobile_service)
    formulas = await facade.get_pending_review(limit)
    return {"data": formulas, "total": len(formulas) if isinstance(formulas, list) else 0, "code": 200}


@router.post("/formulas/{formula_id}/quick-approve")
async def quick_approve(
    formula_id: str,
    current_user: User = Depends(get_current_user),
):
    """移动端快速审批"""
    facade = MobileFacade(_mobile_service)
    result = await facade.quick_approve(formula_id, str(current_user.id))
    return {"data": result, "code": 200}

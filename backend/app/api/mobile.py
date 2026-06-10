"""
移动端 API 路由（M2.6）

轻量级 API 端点，专为移动端优化。
返回精简的 JSON 响应，减少数据传输量。
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional

from ..application.mobile_facade import MobileFacade
from ..infrastructure.mobile_service import MobileService

# 依赖注入：创建 MobileService 实例并注入到 Facade
_mobile_service = MobileService()

router = APIRouter(prefix="/api/mobile", tags=["移动端"])


async def _get_mock_user():
    """模拟用户认证（生产环境替换为真实 JWT 验证）"""
    return {"id": "user-mock-001", "username": "mobile_user", "role": "reviewer"}


@router.get("/dashboard")
async def mobile_dashboard(
    user: dict = Depends(_get_mock_user),
):
    """移动端仪表盘"""
    facade = MobileFacade(_mobile_service)
    dashboard = await facade.get_dashboard(user.get("id", ""))
    return {"data": dashboard.__dict__, "code": 200}


@router.post("/sync/push")
async def sync_push(
    items: list[dict],
    user: dict = Depends(_get_mock_user),
):
    """离线同步 - 客户端推送到服务器"""
    facade = MobileFacade(_mobile_service)
    results = await facade.sync_push(items)
    return {"data": results, "code": 200}


@router.get("/sync/pull")
async def sync_pull(
    last_sync: Optional[str] = Query(None),
    user: dict = Depends(_get_mock_user),
):
    """离线同步 - 客户端拉取服务器变更"""
    facade = MobileFacade(_mobile_service)
    changes = await facade.sync_pull(last_sync)
    return {"data": changes, "code": 200}


@router.get("/notifications")
async def list_notifications(
    limit: int = Query(20, ge=1, le=50),
    user: dict = Depends(_get_mock_user),
):
    """获取通知列表"""
    facade = MobileFacade(_mobile_service)
    notifications = await facade.get_notifications(user.get("id", ""), limit)
    return {
        "data": [n.__dict__ for n in notifications],
        "total": len(notifications),
        "code": 200,
    }


@router.post("/notifications/{notification_id}/read")
async def mark_read(
    notification_id: str,
    user: dict = Depends(_get_mock_user),
):
    """标记通知已读"""
    facade = MobileFacade(_mobile_service)
    success = await facade.mark_notification_read(notification_id)
    return {"data": {"success": success}, "code": 200}


@router.get("/trace/{batch_id}")
async def trace_product(
    batch_id: str,
    user: dict = Depends(_get_mock_user),
):
    """扫码溯源"""
    facade = MobileFacade(_mobile_service)
    record = await facade.trace_product(batch_id)
    if not record:
        raise HTTPException(status_code=404, detail="未找到溯源信息")
    return {"data": record.__dict__, "code": 200}


@router.get("/formulas/pending-review")
async def pending_review(
    limit: int = Query(10, ge=1, le=50),
    user: dict = Depends(_get_mock_user),
):
    """待审核配方列表（精简版）"""
    facade = MobileFacade(_mobile_service)
    formulas = await facade.get_pending_review(limit)
    return {"data": formulas, "total": len(formulas), "code": 200}


@router.post("/formulas/{formula_id}/quick-approve")
async def quick_approve(
    formula_id: str,
    user: dict = Depends(_get_mock_user),
):
    """移动端快速审批"""
    facade = MobileFacade(_mobile_service)
    result = await facade.quick_approve(formula_id, user.get("id", ""))
    return {"data": result, "code": 200}

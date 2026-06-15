"""
多租户配额管理 API 路由

提供：
- GET  /quotas/usage              → 当前租户的配额使用情况
- GET  /quotas/usage/{org_id}     → 指定租户的配额使用情况（管理员）
- PUT  /quotas/{org_id}/plan      → 修改租户配额方案（管理员）
- POST /quotas/{org_id}/reset     → 重置配额使用量（管理员）
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ...api.deps import get_current_user
from ...models import User
from ...core.tenant_quota import (
    QuotaType, QuotaUsage, TenantQuota,
    get_quota_checker, get_quota_meter,
    QUOTA_PLANS,
)

logger = logging.getLogger("rmfood.api.quotas")

router = APIRouter(prefix="/quotas", tags=["配额管理"])


# ── 请求/响应模型 ─────────────────────────────────────────────

class QuotaUsageResponse(BaseModel):
    """配额使用情况响应"""
    org_id: int
    quota_type: str
    current: int
    limit: int
    remaining: int
    usage_pct: float
    period: str
    is_exceeded: bool


class SetPlanRequest(BaseModel):
    """设置配额方案请求"""
    plan: str = Field(
        ...,
        description="配额方案: free / pro / enterprise",
        example="pro",
    )
    custom_limits: Optional[Dict[str, int]] = Field(
        default=None,
        description="自定义限额覆盖（key 为 QuotaType 值）",
    )


class SetPlanResponse(BaseModel):
    """设置配额方案响应"""
    org_id: int
    plan: str
    message: str


# ── 路由 ─────────────────────────────────────────────────────

@router.get("/usage", response_model=List[QuotaUsageResponse])
async def get_my_quota_usage(
    current_user: User = Depends(get_current_user),
):
    """
    获取当前租户的配额使用情况

    返回所有配额类型的当前使用量、限额和剩余量
    """
    org_id = getattr(current_user, "organization_id", None)
    if org_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="当前用户未关联租户组织",
        )

    checker = get_quota_checker()
    usages = await checker.get_all_usage(org_id)
    return [QuotaUsageResponse(**u.to_dict()) for u in usages]


@router.get("/usage/{org_id}", response_model=List[QuotaUsageResponse])
async def get_tenant_quota_usage(
    org_id: int,
    current_user: User = Depends(get_current_user),
):
    """
    获取指定租户的配额使用情况（管理员）

    需要管理员权限
    """
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅管理员可查看其他租户配额",
        )

    checker = get_quota_checker()
    usages = await checker.get_all_usage(org_id)
    return [QuotaUsageResponse(**u.to_dict()) for u in usages]


@router.put("/{org_id}/plan", response_model=SetPlanResponse)
async def set_tenant_plan(
    org_id: int,
    req: SetPlanRequest,
    current_user: User = Depends(get_current_user),
):
    """
    修改租户配额方案（管理员）

    支持三种方案：free / pro / enterprise
    可选自定义限额覆盖
    """
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅管理员可修改配额方案",
        )

    if req.plan not in QUOTA_PLANS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无效方案: {req.plan}，可选: {list(QUOTA_PLANS.keys())}",
        )

    # 构建自定义限额
    custom_limits = {}
    if req.custom_limits:
        for k, v in req.custom_limits.items():
            try:
                qt = QuotaType(k)
                custom_limits[qt] = v
            except ValueError:
                logger.warning("[QuotaAPI] 忽略无效配额类型: %s", k)

    quota = TenantQuota(
        org_id=org_id,
        plan=req.plan,
        custom_limits=custom_limits,
    )

    checker = get_quota_checker()
    checker.set_tenant_quota(org_id, quota)

    logger.info(
        "[QuotaAPI] 管理员 %s 修改租户 %d 配额方案: %s",
        current_user.id, org_id, req.plan,
    )

    return SetPlanResponse(
        org_id=org_id,
        plan=req.plan,
        message=f"租户 {org_id} 配额方案已更新为 {req.plan}",
    )


@router.post("/{org_id}/reset", response_model=Dict[str, str])
async def reset_tenant_quota(
    org_id: int,
    quota_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """
    重置租户配额使用量（管理员）

    可指定 quota_type 重置特定类型，不指定则重置全部
    """
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅管理员可重置配额",
        )

    meter = get_quota_meter()

    if quota_type:
        try:
            qt = QuotaType(quota_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"无效配额类型: {quota_type}",
            )
        await meter.reset(org_id, qt)
        logger.info("[QuotaAPI] 重置租户 %d 配额: %s", org_id, qt.value)
    else:
        for qt in QuotaType:
            await meter.reset(org_id, qt)
        logger.info("[QuotaAPI] 重置租户 %d 全部配额", org_id)

    return {
        "org_id": str(org_id),
        "message": f"租户 {org_id} 配额已重置",
    }


@router.get("/plans", response_model=Dict[str, Any])
async def list_quota_plans(
    current_user: User = Depends(get_current_user),
):
    """
    列出所有可用的配额方案

    返回每种方案的各类型限额详情
    """
    plans = {}
    for plan_name, quotas in QUOTA_PLANS.items():
        plans[plan_name] = {
            qt.value: limit for qt, limit in quotas.items()
        }
    return {"plans": plans}

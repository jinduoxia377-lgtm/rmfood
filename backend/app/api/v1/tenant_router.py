"""
多租户管理 API

提供隔离级别管理、租户AI配置等接口。
"""
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.multi_tenant import (
    IsolationLevel,
    get_isolation_manager,
    get_tenant_ai_config_manager,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tenant", tags=["租户管理"])


# ── 请求/响应模型 ─────────────────────────────────────────────────

class SetIsolationRequest(BaseModel):
    level: int = Field(..., ge=1, le=4, description="隔离级别（1-4）")


class UpdateAIConfigRequest(BaseModel):
    llm_provider: Optional[str] = Field(None, pattern="^(openai|deepseek|zhipu|custom)$")
    llm_model: Optional[str] = None
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0)
    max_tokens: Optional[int] = Field(None, ge=100, le=100000)
    optimization_weights: Optional[dict] = None
    compliance_overrides: Optional[dict] = None
    custom_prohibited_combos: Optional[list] = None
    custom_max_dosage: Optional[dict] = None


# ── 端点 ──────────────────────────────────────────────────────────


@router.get("/policies", summary="列出所有隔离策略")
async def list_policies():
    """
    返回四级隔离策略定义。

    - Level 1: 共享实例 + RLS（成本最低）
    - Level 2: 独立 Schema（性价比最优）
    - Level 3: 独立数据库实例（强合规）
    - Level 4: K8s 命名空间 + 独立数据库（极致隔离）
    """
    manager = get_isolation_manager()
    policies = manager.list_policies()

    return {
        "success": True,
        "data": {"policies": policies},
    }


@router.get("/{org_id}/isolation-level", summary="查询租户隔离级别")
async def get_isolation_level(org_id: int):
    """查询指定租户的当前隔离级别和策略详情。"""
    manager = get_isolation_manager()
    policy = manager.get_policy(org_id)

    return {
        "success": True,
        "data": {
            "org_id": org_id,
            "level": policy.level.value,
            "name": policy.name,
            "description": policy.description,
            "features": policy.features,
            "price_tier": policy.price_tier,
        },
    }


@router.put("/{org_id}/isolation-level", summary="修改租户隔离级别")
async def set_isolation_level(org_id: int, req: SetIsolationRequest):
    """
    修改租户的隔离级别。

    注意：升级可能需要数据迁移，降级可能导致数据不可访问。
    建议联系管理员执行。
    """
    manager = get_isolation_manager()

    # 验证目标级别合法性
    try:
        target_level = IsolationLevel(req.level)
    except ValueError:
        raise HTTPException(400, detail=f"无效的隔离级别: {req.level}")

    current_level = manager.get_org_policy(org_id)

    if target_level == current_level:
        return {
            "success": True,
            "data": {"message": f"租户 {org_id} 已在 Level {current_level.value}", "no_change": True},
        }

    if target_level.value < current_level.value:
        return {
            "success": False,
            "error": "降级操作需要管理员审批，请联系支持团队",
            "requires_approval": True,
        }

    # 升级操作
    manager.set_org_policy(org_id, target_level)
    config = manager.apply_isolation(None, org_id)  # None = 不实际切换session

    return {
        "success": True,
        "data": {
            "org_id": org_id,
            "previous_level": current_level.value,
            "new_level": target_level.value,
            "new_name": target_level.name,
            "config": config,
        },
    }


@router.get("/{org_id}/ai-config", summary="查询租户AI配置")
async def get_ai_config(org_id: int):
    """查询租户的AI模型和参数配置。"""
    manager = get_tenant_ai_config_manager()
    config = manager.get_config(org_id)

    return {
        "success": True,
        "data": config.to_dict(),
    }


@router.put("/{org_id}/ai-config", summary="更新租户AI配置")
async def update_ai_config(org_id: int, req: UpdateAIConfigRequest):
    """
    更新租户的AI配置。

    支持部分更新，未提供的字段保持原有值。
    """
    manager = get_tenant_ai_config_manager()

    # 构建更新字典
    updates = {}
    if req.llm_provider is not None:
        updates["llm_provider"] = req.llm_provider
    if req.llm_model is not None:
        updates["llm_model"] = req.llm_model
    if req.temperature is not None:
        updates["temperature"] = req.temperature
    if req.top_p is not None:
        updates["top_p"] = req.top_p
    if req.max_tokens is not None:
        updates["max_tokens"] = req.max_tokens
    if req.optimization_weights is not None:
        updates["optimization_weights"] = req.optimization_weights
    if req.compliance_overrides is not None:
        updates["compliance_overrides"] = req.compliance_overrides
    if req.custom_prohibited_combos is not None:
        updates["custom_prohibited_combos"] = req.custom_prohibited_combos
    if req.custom_max_dosage is not None:
        updates["custom_max_dosage"] = req.custom_max_dosage

    if not updates:
        raise HTTPException(400, detail="没有提供可更新的字段")

    config = manager.update_config(org_id, updates)

    return {
        "success": True,
        "data": config.to_dict(),
        "message": f"租户 {org_id} 的AI配置已更新",
    }


@router.post("/{org_id}/ai-config/reset", summary="重置租户AI配置")
async def reset_ai_config(org_id: int):
    """重置租户的AI配置为默认值。"""
    manager = get_tenant_ai_config_manager()
    config = manager.reset_config(org_id)

    return {
        "success": True,
        "data": config.to_dict(),
        "message": f"租户 {org_id} 的AI配置已重置为默认值",
    }

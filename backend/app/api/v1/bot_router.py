"""
Bot 管理 API — 多智能体协作平台（DS Bot 移植 Phase 1）

端点：
- GET    /api/v1/bots                 Bot 列表（租户 + 可见性过滤）
- POST   /api/v1/bots                 创建 Bot（persona 过 PromptGuard）
- GET    /api/v1/bots/available-models 可用 LLM 模型列表（驱动 Bot 表单下拉）
- GET    /api/v1/bots/{bot_id}        Bot 详情（含记忆）
- PUT    /api/v1/bots/{bot_id}        更新 Bot
- DELETE /api/v1/bots/{bot_id}        软删除/归档
- GET    /api/v1/bots/{bot_id}/memories        记忆列表
- POST   /api/v1/bots/{bot_id}/memories        手动添加记忆
- DELETE /api/v1/bots/{bot_id}/memories/{memory_id} 删除记忆

安全：全部端点要求登录（get_current_active_user）+ 租户隔离（require_tenant）。
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db_session, get_current_active_user
from ...core.multi_tenant.tenant_security import TenantContext, require_tenant
from ...domain.bots import AIBot, BotStatus, BotVisibility
from ...models import User
from ...models.ai_model_config import AIModelConfig
from ...services.ai.agent.bot_manager import BotManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bots", tags=["多智能体协作"])

# 平台当前 JWT 不携带 org_id（require_tenant 返回 global 模式），
# 而 ai_bots.tenant_id 为 NOT NULL。global 模式下使用默认租户 1（与种子数据一致）。
def _tenant_id(org_id: int | None) -> int:
    return org_id if org_id is not None else 1


# ── Schemas ──────────────────────────────────────────────────────


class BotCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Bot 名称")
    persona_prompt: str = Field(..., min_length=1, max_length=20000, description="人设 System Prompt")
    avatar: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = Field(None, max_length=500)
    model_config_id: Optional[int] = None
    model_type: str = Field("llm", max_length=64)
    provider: Optional[str] = Field(None, max_length=64)
    model_id: Optional[str] = Field(None, max_length=128)
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(4096, ge=128, le=32768)
    capabilities: list[str] = Field(default_factory=list)
    visibility: str = Field("private", pattern="^(private|org)$")
    is_chief: bool = False


class BotUpdateRequest(BaseModel):
    model_config = {"extra": "ignore"}

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    persona_prompt: Optional[str] = Field(None, min_length=1, max_length=20000)
    avatar: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = Field(None, max_length=500)
    model_config_id: Optional[int] = None
    model_type: Optional[str] = Field(None, max_length=64)
    provider: Optional[str] = Field(None, max_length=64)
    model_id: Optional[str] = Field(None, max_length=128)
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, ge=128, le=32768)
    capabilities: Optional[list[str]] = None
    visibility: Optional[str] = Field(None, pattern="^(private|org)$")
    status: Optional[str] = Field(None, pattern="^(active|disabled|archived)$")


class MemoryCreateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    memory_type: str = Field("preference", pattern="^(preference|fact|contraindication)$")
    importance: int = Field(3, ge=1, le=5)
    source: Optional[str] = Field(None, max_length=100)


# ── 辅助函数 ──────────────────────────────────────────────────────────


def _check_persona_safety(persona: str) -> None:
    """persona PromptGuard 校验（S5）：人设是用户可控文本，存在提示注入面。"""
    try:
        from ...services.ai.safety import check_prompt
        result = check_prompt(persona)
        if result.is_blocked:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "PERSONA_REJECTED",
                    "message": "人设包含疑似提示注入内容，已被安全系统拦截，请修改后重试",
                },
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"[BotRouter] persona 安全校验异常（放行）: {e}")


# ── 依赖注入 ──────────────────────────────────────────────────────────


async def _get_manager(db: AsyncSession = Depends(get_db_session)) -> BotManager:
    return BotManager(db)


# ── 端点 ──────────────────────────────────────────────────────────


@router.get("", summary="Bot 列表")
async def list_bots(
    status: Optional[str] = Query(None, pattern="^(active|disabled|archived)$"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    manager: BotManager = Depends(_get_manager),
):
    return await manager.list_bots(
        tenant_id=_tenant_id(tenant.org_id), user_id=user.id, status=status,
        offset=offset, limit=limit,
    )


@router.post("", summary="创建 Bot")
async def create_bot(
    req: BotCreateRequest,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    manager: BotManager = Depends(_get_manager),
):
    _check_persona_safety(req.persona_prompt)
    bot = AIBot(
        tenant_id=_tenant_id(tenant.org_id),
        created_by=user.id,
        name=req.name,
        persona_prompt=req.persona_prompt,
        avatar=req.avatar,
        description=req.description,
        model_config_id=req.model_config_id,
        model_type=req.model_type,
        provider=req.provider,
        model_id=req.model_id,
        temperature=req.temperature,
        max_tokens=req.max_tokens,
        capabilities=req.capabilities,
        is_chief=req.is_chief,
        visibility=BotVisibility(req.visibility),
        status=BotStatus.ACTIVE,
    )
    created = await manager.create_bot(bot)
    return {"success": True, "data": created.to_dict()}


@router.get("/available-models", summary="可用 LLM 模型列表")
async def list_available_models(
    tenant: TenantContext = Depends(require_tenant),
    db: AsyncSession = Depends(get_db_session),
):
    """聚合 ai_model_configs 中配置的模型 + 全局/用户级 LLM 当前模型。"""
    rows = (await db.execute(
        select(AIModelConfig).where(AIModelConfig.tenant_id == _tenant_id(tenant.org_id))
    )).scalars().all()

    models: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for cfg in rows:
        provider = cfg.provider or "deepseek"
        candidates: list[dict[str, str]] = []
        for m in (cfg.models or []):
            if isinstance(m, dict) and m.get("id"):
                candidates.append(m)
        if not candidates and cfg.default_model:
            candidates.append({"id": cfg.default_model, "display_name": cfg.default_model})
        for m in candidates:
            key = (provider, str(m["id"]))
            if key in seen:
                continue
            seen.add(key)
            models.append({
                "provider": provider,
                "model_id": str(m["id"]),
                "display_name": m.get("display_name") or str(m["id"]),
                "model_type": cfg.model_type,
            })

    # 附加全局 LLM 当前模型（若未出现在配置表）
    try:
        from ...api.ai_modules import _get_llm_service
        llm = _get_llm_service()
        if llm and getattr(llm.config, "model", None):
            key = (llm.config.provider, llm.config.model)
            if key not in seen:
                models.append({
                    "provider": llm.config.provider,
                    "model_id": llm.config.model,
                    "display_name": llm.config.model,
                    "model_type": "llm",
                })
    except Exception as e:
        logger.warning(f"[BotRouter] 读取全局 LLM 模型失败: {e}")

    return {"success": True, "items": models, "count": len(models)}


@router.get("/{bot_id}", summary="Bot 详情")
async def get_bot(
    bot_id: int,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    manager: BotManager = Depends(_get_manager),
):
    bot = await manager.get_bot(bot_id, _tenant_id(tenant.org_id))
    if bot is None:
        raise HTTPException(status_code=404, detail="Bot 不存在或已删除")
    # 可见性校验：仅创建者或 org 共享可见
    if bot.visibility != BotVisibility.ORG and bot.created_by != user.id:
        raise HTTPException(status_code=403, detail="无权查看该 Bot")
    memories = await manager.list_memories(bot_id, user.id, limit=50)
    data = bot.to_dict()
    data["memories"] = memories["items"]
    data["memory_count"] = memories["total"]
    return {"success": True, "data": data}


@router.put("/{bot_id}", summary="更新 Bot")
async def update_bot(
    bot_id: int,
    req: BotUpdateRequest,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    manager: BotManager = Depends(_get_manager),
):
    bot = await manager.get_bot(bot_id, _tenant_id(tenant.org_id))
    if bot is None:
        raise HTTPException(status_code=404, detail="Bot 不存在或已删除")
    if bot.is_system:
        raise HTTPException(status_code=400, detail="系统种子 Bot 不允许修改")
    if bot.created_by != user.id:
        raise HTTPException(status_code=403, detail="无权修改该 Bot")

    if req.persona_prompt is not None:
        _check_persona_safety(req.persona_prompt)

    updated = AIBot(
        id=bot.id,
        tenant_id=bot.tenant_id,
        created_by=bot.created_by,
        name=req.name or bot.name,
        persona_prompt=req.persona_prompt if req.persona_prompt is not None else bot.persona_prompt,
        avatar=req.avatar if "avatar" in req.model_fields else bot.avatar,
        description=req.description if req.description is not None else bot.description,
        model_config_id=req.model_config_id if "model_config_id" in req.model_fields else bot.model_config_id,
        model_type=req.model_type or bot.model_type,
        provider=req.provider if "provider" in req.model_fields else bot.provider,
        model_id=req.model_id if "model_id" in req.model_fields else bot.model_id,
        temperature=req.temperature if req.temperature is not None else bot.temperature,
        max_tokens=req.max_tokens if req.max_tokens is not None else bot.max_tokens,
        capabilities=req.capabilities if req.capabilities is not None else list(bot.capabilities),
        is_chief=bot.is_chief,
        is_system=bot.is_system,
        visibility=BotVisibility(req.visibility) if req.visibility else bot.visibility,
        status=BotStatus(req.status) if req.status else bot.status,
    )
    saved = await manager.update_bot(updated)
    return {"success": True, "data": saved.to_dict()}


@router.delete("/{bot_id}", summary="删除（归档）Bot")
async def delete_bot(
    bot_id: int,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    manager: BotManager = Depends(_get_manager),
):
    bot = await manager.get_bot(bot_id, _tenant_id(tenant.org_id))
    if bot is None:
        raise HTTPException(status_code=404, detail="Bot 不存在或已删除")
    if bot.is_system:
        raise HTTPException(status_code=400, detail="系统种子 Bot 不允许删除")
    if bot.created_by != user.id:
        raise HTTPException(status_code=403, detail="无权删除该 Bot")
    ok = await manager.soft_delete(bot_id, _tenant_id(tenant.org_id))
    return {"success": ok}


@router.get("/{bot_id}/memories", summary="记忆列表")
async def list_memories(
    bot_id: int,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    manager: BotManager = Depends(_get_manager),
):
    bot = await manager.get_bot(bot_id, _tenant_id(tenant.org_id))
    if bot is None:
        raise HTTPException(status_code=404, detail="Bot 不存在或已删除")
    return await manager.list_memories(bot_id, user.id, limit=200)


@router.post("/{bot_id}/memories", summary="手动添加记忆")
async def add_memory(
    bot_id: int,
    req: MemoryCreateRequest,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    manager: BotManager = Depends(_get_manager),
):
    bot = await manager.get_bot(bot_id, _tenant_id(tenant.org_id))
    if bot is None:
        raise HTTPException(status_code=404, detail="Bot 不存在或已删除")
    item = await manager.add_memory(
        bot_id=bot_id, user_id=user.id, content=req.content,
        memory_type=req.memory_type, importance=req.importance, source=req.source,
    )
    return {"success": True, "data": item}


@router.delete("/{bot_id}/memories/{memory_id}", summary="删除记忆")
async def delete_memory(
    bot_id: int,
    memory_id: int,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    manager: BotManager = Depends(_get_manager),
):
    bot = await manager.get_bot(bot_id, _tenant_id(tenant.org_id))
    if bot is None:
        raise HTTPException(status_code=404, detail="Bot 不存在或已删除")
    ok = await manager.delete_memory(memory_id, bot_id, user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="记忆不存在")
    return {"success": True}


@router.get("/{bot_id}/history", summary="Bot 对话历史")
async def get_bot_history(
    bot_id: int,
    tenant: TenantContext = Depends(require_tenant),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """返回当前用户与该 Bot 的最近持续会话历史（待完善项 4）。

    按 chat_sessions.bot_id 过滤，取最近一个会话的消息（时间正序）。
    """
    from ...models.chat import ChatSession, ChatMessage
    from ...models.bot import AIBot as AIBotModel

    bot = (await db.execute(
        select(AIBotModel).where(AIBotModel.id == bot_id, AIBotModel.deleted_at.is_(None))
    )).scalar_one_or_none()
    if bot is None:
        raise HTTPException(status_code=404, detail="Bot 不存在或已删除")

    session = (await db.execute(
        select(ChatSession).where(
            ChatSession.user_id == user.id,
            ChatSession.bot_id == bot_id,
        ).order_by(ChatSession.updated_at.desc()).limit(1)
    )).scalar_one_or_none()
    if session is None:
        return {"success": True, "items": [], "session_id": None}

    msgs = (await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.timestamp.asc())
    )).scalars().all()
    return {
        "success": True,
        "session_id": session.id,
        "items": [m.to_dict() for m in msgs],
    }
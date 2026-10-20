"""
Bot 管理工具 — 让 Chief（主控 Bot）通过对话管理智能体团队（M3）

工具：
- create_bot: 创建新 Bot（含人设/模型/能力白名单）
- update_bot: 更新 Bot（人设/模型/能力/可见性）
- delete_bot: 软删除 Bot
- list_bots:  列出当前用户可见的 Bot

安全说明（R3）：
- 工具通过 context 获取 db / user_id / tenant_id（由 API 层注入），
  避免工具自身持有全局状态。
- 未提供 db 时（例如直接通过 /agent/execute 调用且未传上下文），
  工具内部使用 async_session_factory 新建会话，保证可用性。
"""
from __future__ import annotations

import logging
import time
from typing import Any, Optional

from . import BaseAgentTool, ToolResult, register_tool
from .....domain.bots import AIBot, BotVisibility, BotStatus
from app.infrastructure.bots_impl import SQLAlchemyBotRepository

logger = logging.getLogger(__name__)

_DEFAULT_TENANT_ID = 1


def _get_db(context: dict):
    """从上下文取 db 会话；缺失时新建异步会话。"""
    db = context.get("db")
    if db is not None:
        return db
    from app.core.database.session import async_session_factory
    return async_session_factory()


async def _resolve_identity(context: dict) -> tuple[int, int]:
    """返回 (tenant_id, user_id)。缺失时给默认值并告警。"""
    tenant_id = int(context.get("tenant_id") or _DEFAULT_TENANT_ID)
    user_id = context.get("user_id")
    if user_id is None:
        logger.warning("[BotAdminTool] context 缺少 user_id，使用 0（无法归属创建者）")
        user_id = 0
    return tenant_id, int(user_id)


@register_tool
class CreateBotTool(BaseAgentTool):
    """创建新 Bot"""

    @property
    def name(self) -> str:
        return "create_bot"

    @property
    def description(self) -> str:
        return (
            "创建新的 AI Bot。需要提供名称和人设（persona），"
            "可选模型、能力白名单、可见性。创建后返回 Bot 的 ID 与名称。"
        )

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Bot 名称，如「配方专家」"},
                "persona_prompt": {"type": "string", "description": "人设 System Prompt（核心）"},
                "description": {"type": "string", "description": "一句话介绍（可选）"},
                "avatar": {"type": "string", "description": "头像标识（Emoji/图标名，可选）"},
                "model_id": {"type": "string", "description": "具体模型 ID，如 deepseek-chat（可选）"},
                "provider": {"type": "string", "description": "Provider，如 deepseek（可选）"},
                "capabilities": {
                    "type": "array", "items": {"type": "string"},
                    "description": "工具白名单，如 rag_retrieve、generate_formula",
                },
                "visibility": {
                    "type": "string", "enum": ["private", "org"],
                    "description": "可见性：private（仅本人）/ org（组织共享），默认 private",
                },
            },
            "required": ["name", "persona_prompt"],
        }

    async def execute(self, params: dict, context: dict) -> ToolResult:
        start = time.time()
        try:
            tenant_id, user_id = await _resolve_identity(context)
            name = (params.get("name") or "").strip()
            persona = (params.get("persona_prompt") or "").strip()
            if not name or not persona:
                return ToolResult(
                    tool_name=self.name, success=False,
                    error="name 与 persona_prompt 不能为空", latency_ms=0,
                )

            from ...domain.bots import BotVisibility as BV
            vis = params.get("visibility", "private")
            try:
                visibility = BV(vis)
            except ValueError:
                visibility = BV.PRIVATE

            bot = AIBot(
                tenant_id=tenant_id,
                created_by=user_id,
                name=name,
                persona_prompt=persona,
                avatar=params.get("avatar"),
                description=params.get("description"),
                provider=params.get("provider"),
                model_id=params.get("model_id"),
                capabilities=list(params.get("capabilities") or []),
                visibility=visibility,
                status=BotStatus.ACTIVE,
            )

            async with _get_db(context) as db:
                repo = SQLAlchemyBotRepository(db)
                created = await repo.create(bot)

            return ToolResult(
                tool_name=self.name, success=True,
                data={"id": created.id, "name": created.name},
                latency_ms=(time.time() - start) * 1000,
            )
        except Exception as e:
            logger.error(f"[create_bot] 失败: {e}", exc_info=True)
            return ToolResult(
                tool_name=self.name, success=False, error=str(e),
                latency_ms=(time.time() - start) * 1000,
            )


@register_tool
class UpdateBotTool(BaseAgentTool):
    """更新已有 Bot 的人设/模型/能力/可见性"""

    @property
    def name(self) -> str:
        return "update_bot"

    @property
    def description(self) -> str:
        return "更新已有 Bot 的配置（人设、描述、模型、能力白名单、可见性）。需要 bot_id。"

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "bot_id": {"type": "integer", "description": "要更新的 Bot ID"},
                "name": {"type": "string"},
                "persona_prompt": {"type": "string"},
                "description": {"type": "string"},
                "avatar": {"type": "string"},
                "model_id": {"type": "string"},
                "provider": {"type": "string"},
                "capabilities": {"type": "array", "items": {"type": "string"}},
                "visibility": {"type": "string", "enum": ["private", "org"]},
            },
            "required": ["bot_id"],
        }

    async def execute(self, params: dict, context: dict) -> ToolResult:
        start = time.time()
        try:
            tenant_id, user_id = await _resolve_identity(context)
            bot_id = int(params.get("bot_id") or 0)
            if bot_id <= 0:
                return ToolResult(tool_name=self.name, success=False, error="bot_id 无效")

            async with _get_db(context) as db:
                repo = SQLAlchemyBotRepository(db)
                bot = await repo.get_by_id(bot_id, tenant_id)
                if bot is None:
                    return ToolResult(tool_name=self.name, success=False, error="Bot 不存在或已删除")
                # 仅创建者或组织管理员可修改（简化：仅创建者）
                if bot.created_by != user_id and user_id != 0:
                    return ToolResult(tool_name=self.name, success=False, error="无权修改该 Bot")

                updated = AIBot(
                    id=bot.id,
                    tenant_id=bot.tenant_id,
                    created_by=bot.created_by,
                    name=params.get("name") or bot.name,
                    persona_prompt=params.get("persona_prompt") or bot.persona_prompt,
                    avatar=params.get("avatar") if "avatar" in params else bot.avatar,
                    description=params.get("description") if "description" in params else bot.description,
                    model_config_id=bot.model_config_id,
                    model_type=bot.model_type,
                    provider=params.get("provider") if "provider" in params else bot.provider,
                    model_id=params.get("model_id") if "model_id" in params else bot.model_id,
                    temperature=bot.temperature,
                    max_tokens=bot.max_tokens,
                    capabilities=list(params.get("capabilities")) if "capabilities" in params else list(bot.capabilities),
                    is_chief=bot.is_chief,
                    is_system=bot.is_system,
                    visibility=bot.visibility,
                    status=bot.status,
                )
                if "visibility" in params:
                    try:
                        updated.visibility = BotVisibility(params["visibility"])
                    except ValueError:
                        pass
                saved = await repo.update(updated)

            return ToolResult(
                tool_name=self.name, success=True,
                data={"id": saved.id, "name": saved.name},
                latency_ms=(time.time() - start) * 1000,
            )
        except Exception as e:
            logger.error(f"[update_bot] 失败: {e}", exc_info=True)
            return ToolResult(
                tool_name=self.name, success=False, error=str(e),
                latency_ms=(time.time() - start) * 1000,
            )


@register_tool
class DeleteBotTool(BaseAgentTool):
    """软删除 Bot"""

    @property
    def name(self) -> str:
        return "delete_bot"

    @property
    def description(self) -> str:
        return "删除（归档）一个 Bot。删除后不再出现在列表中，可通过管理员恢复。需要 bot_id。"

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "bot_id": {"type": "integer", "description": "要删除的 Bot ID"},
            },
            "required": ["bot_id"],
        }

    async def execute(self, params: dict, context: dict) -> ToolResult:
        start = time.time()
        try:
            tenant_id, user_id = await _resolve_identity(context)
            bot_id = int(params.get("bot_id") or 0)
            if bot_id <= 0:
                return ToolResult(tool_name=self.name, success=False, error="bot_id 无效")

            async with _get_db(context) as db:
                repo = SQLAlchemyBotRepository(db)
                bot = await repo.get_by_id(bot_id, tenant_id)
                if bot is None:
                    return ToolResult(tool_name=self.name, success=False, error="Bot 不存在或已删除")
                if bot.is_system:
                    return ToolResult(tool_name=self.name, success=False, error="系统 Bot 不允许删除")
                if bot.created_by != user_id and user_id != 0:
                    return ToolResult(tool_name=self.name, success=False, error="无权删除该 Bot")
                ok = await repo.soft_delete(bot_id, tenant_id)

            return ToolResult(
                tool_name=self.name, success=ok,
                data={"deleted": ok, "bot_id": bot_id},
                latency_ms=(time.time() - start) * 1000,
            )
        except Exception as e:
            logger.error(f"[delete_bot] 失败: {e}", exc_info=True)
            return ToolResult(
                tool_name=self.name, success=False, error=str(e),
                latency_ms=(time.time() - start) * 1000,
            )


@register_tool
class ListBotsTool(BaseAgentTool):
    """列出当前用户可见的 Bot"""

    @property
    def name(self) -> str:
        return "list_bots"

    @property
    def description(self) -> str:
        return "列出当前用户可见的所有 Bot（含 Chief 与专业 Bot），返回 id、名称、描述、状态。"

    @property
    def parameters(self) -> dict:
        return {"type": "object", "properties": {}}

    async def execute(self, params: dict, context: dict) -> ToolResult:
        start = time.time()
        try:
            tenant_id, user_id = await _resolve_identity(context)
            async with _get_db(context) as db:
                repo = SQLAlchemyBotRepository(db)
                bots, _total = await repo.list_bots(
                    tenant_id=tenant_id, user_id=user_id, limit=200,
                )
            items = [
                {
                    "id": b.id, "name": b.name, "description": b.description,
                    "status": b.status.value, "is_chief": b.is_chief,
                    "is_system": b.is_system, "visibility": b.visibility.value,
                }
                for b in bots
            ]
            return ToolResult(
                tool_name=self.name, success=True,
                data={"count": len(items), "bots": items},
                latency_ms=(time.time() - start) * 1000,
            )
        except Exception as e:
            logger.error(f"[list_bots] 失败: {e}", exc_info=True)
            return ToolResult(
                tool_name=self.name, success=False, error=str(e),
                latency_ms=(time.time() - start) * 1000,
            )
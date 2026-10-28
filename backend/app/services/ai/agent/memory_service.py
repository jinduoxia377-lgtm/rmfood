"""
记忆服务端化（Phase 3）：对话/执行后自动沉淀记忆。

- `extract_and_store_memories`：用一次轻量 LLM 调用从"用户输入 + Bot 回复"中
  提取结构化记忆（偏好/事实/禁忌），写入 ai_bot_memories（source='auto'）。
- 通过配置开关 `ENABLE_AUTO_MEMORY`（默认关闭）控制，避免默认产生额外 LLM 成本。
"""
from __future__ import annotations

import logging
import os

from sqlalchemy.ext.asyncio import AsyncSession

from ....services.llm_service import LLMMessage, llm_service
from .bot_manager import BotManager

logger = logging.getLogger(__name__)

AUTO_MEMORY_ENABLED = os.getenv("ENABLE_AUTO_MEMORY", "false").lower() in ("1", "true", "yes")
MAX_MEMORY_PER_TURN = 3


async def extract_and_store_memories(
    db: AsyncSession,
    bot_id: int,
    user_id: int,
    user_content: str,
    bot_answer: str,
    tenant_id: int = 1,
) -> int:
    """从一次对话中提取记忆并写入（自动记忆，source='auto'）。

    返回新增记忆条数；失败返回 0（非致命）。
    """
    if not AUTO_MEMORY_ENABLED:
        return 0
    if not user_content.strip() or not bot_answer.strip():
        return 0
    try:
        prompt = (
            "请从以下用户对话中提取对用户有用的持久记忆（偏好、事实、禁忌），"
            "最多 3 条。只输出 JSON 数组，不要解释：\n"
            '[{"memory_type": "preference|fact|contraindication", "content": "...", "importance": 1-5}]\n\n'
            f"用户输入：{user_content[:1000]}\n"
            f"Bot 回复：{bot_answer[:1000]}"
        )
        messages = [
            LLMMessage(role="system", content="你是记忆提取助手。"),
            LLMMessage(role="user", content=prompt),
        ]
        raw = await llm_service.chat_with_json(messages)
        items = raw if isinstance(raw, list) else raw.get("memories", [])
        if not isinstance(items, list):
            return 0
        manager = BotManager(db)
        stored = 0
        for item in items[:MAX_MEMORY_PER_TURN]:
            content = str(item.get("content", "")).strip()
            if not content:
                continue
            mtype = str(item.get("memory_type", "fact"))
            importance = int(item.get("importance", 3) or 3)
            await manager.add_memory(
                bot_id=bot_id,
                user_id=user_id,
                content=content[:500],
                memory_type=mtype if mtype in ("preference", "fact", "contraindication") else "fact",
                importance=importance,
                source="auto",
            )
            stored += 1
        logger.info(f"[Memory] 自动记忆写入 {stored} 条 (bot_id={bot_id})")
        return stored
    except Exception as e:
        logger.warning(f"[Memory] 自动记忆提取失败（非致命）: {e}")
        return 0

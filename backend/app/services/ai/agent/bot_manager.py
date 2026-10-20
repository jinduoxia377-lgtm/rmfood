"""
Bot 管理器 — 多智能体协作平台核心应用服务

职责：
- Bot 生命周期校验（租户隔离、软删除过滤）
- 组装 Bot 对话 System Prompt（persona_prompt + 记忆块）
- 解析 Bot 的模型覆盖（provider/model_id/temperature）
- 按 bot.capabilities 校验并过滤工具白名单
- 驱动 orchestrator 执行 Bot 的智能体任务（Chief 派单/工作流）

DS Bot 移植 v1.2：R4（能力白名单过滤）、M1（模型覆盖）、S5（persona 安全）。
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ....domain.bots import AIBot, BotMemory
from ....infrastructure.bots_impl import SQLAlchemyBotRepository, SQLAlchemyBotMemoryStore
from ..agent.orchestrator import AgentExecution, AgentOrchestrator, get_orchestrator

logger = logging.getLogger(__name__)

# 记忆注入的上限与重要性下限（S4：注入截断，控制成本与上下文长度）
MEMORY_INJECT_LIMIT = 5
MEMORY_INJECT_MIN_IMPORTANCE = 1

# 能力域匹配时忽略的通用词（不用于关键词匹配）
_GENERIC_CAPABILITY_WORDS = {
    "专家", "评估", "设计", "分析", "审查", "工作", "相关", "管理",
    "平台", "系统", "自动", "研发", "方案", "优化", "规划", "支持",
}


def _extract_capability_keywords(capability: str) -> list[str]:
    """从能力域描述中提取关键词（用于匹配 Bot 名称/简介/capabilities）。

    会为长度 ≥3 的词生成 2 字前缀候选（如"安全性"→"安全"），提高匹配命中率。
    """
    text = capability or ""
    for w in _GENERIC_CAPABILITY_WORDS:
        text = text.replace(w, " ")
    words: list[str] = []
    for part in text.replace("，", " ").replace("、", " ").split():
        part = part.strip()
        if len(part) >= 2:
            words.append(part)
            if len(part) >= 3:
                words.append(part[:2])
    # 去重保序
    return list(dict.fromkeys(words))


def _expert_name(capability: str) -> str:
    """生成临时专家名称：<能力域>专家，截断到 30 字符。"""
    core = capability.strip() or "综合"
    if core.endswith("专家"):
        return core[:30]
    return f"{core}专家"[:30]


class BotManager:
    """Bot 应用服务"""

    def __init__(self, db: AsyncSession):
        self._repo = SQLAlchemyBotRepository(db)
        self._memories = SQLAlchemyBotMemoryStore(db)

    # ── 写入 ─────────────────────────────────────────────────────

    async def create_bot(self, bot: AIBot) -> AIBot:
        """创建 Bot（由 REST 与 Chief 工具共用）"""
        bot.capabilities = self.validate_capabilities(bot.capabilities)
        return await self._repo.create(bot)

    async def update_bot(self, bot: AIBot) -> AIBot:
        """更新 Bot（由 REST 与 Chief 工具共用）"""
        bot.capabilities = self.validate_capabilities(bot.capabilities)
        return await self._repo.update(bot)

    async def soft_delete(self, bot_id: int, tenant_id: int) -> bool:
        return await self._repo.soft_delete(bot_id, tenant_id)

    # ── 读取 ─────────────────────────────────────────────────────

    async def get_bot(self, bot_id: int, tenant_id: int) -> Optional[AIBot]:
        """按 id + 租户获取未删除 Bot"""
        return await self._repo.get_by_id(bot_id, tenant_id)

    async def list_bots(
        self,
        tenant_id: int,
        user_id: Optional[int] = None,
        status: Optional[str] = None,
        offset: int = 0,
        limit: int = 100,
    ) -> dict[str, Any]:
        """列出 Bot（含总数）"""
        from ....domain.bots import BotStatus
        st = BotStatus(status) if status else None
        bots, total = await self._repo.list_bots(
            tenant_id=tenant_id, user_id=user_id, status=st,
            offset=offset, limit=limit,
        )
        return {
            "items": [b.to_dict() for b in bots],
            "total": total,
            "offset": offset,
            "limit": limit,
        }

    # ── 记忆 ─────────────────────────────────────────────────────

    async def top_memories(self, bot_id: int, user_id: int, limit: int = MEMORY_INJECT_LIMIT) -> list[BotMemory]:
        return await self._memories.top_memories(
            bot_id, user_id, limit=limit, min_importance=MEMORY_INJECT_MIN_IMPORTANCE,
        )

    async def list_memories(self, bot_id: int, user_id: int, limit: int = 100) -> dict[str, Any]:
        memories = await self._memories.list_memories(bot_id, user_id, limit=limit)
        return {"items": [m.to_dict() for m in memories], "total": len(memories)}

    async def add_memory(
        self, bot_id: int, user_id: int, content: str,
        memory_type: str = "preference", importance: int = 3, source: Optional[str] = None,
    ) -> dict[str, Any]:
        from ....domain.bots import MemoryType
        try:
            mtype = MemoryType(memory_type)
        except ValueError:
            mtype = MemoryType.PREFERENCE
        memory = BotMemory(
            bot_id=bot_id, user_id=user_id, content=content,
            memory_type=mtype, importance=max(1, min(5, importance)), source=source,
        )
        created = await self._memories.add(memory)
        return created.to_dict()

    async def delete_memory(self, memory_id: int, bot_id: int, user_id: int) -> bool:
        return await self._memories.delete(memory_id, bot_id, user_id)

    # ── System Prompt 组装 ────────────────────────────────────────

    async def build_bot_system_prompt(self, bot: AIBot, user_id: int) -> str:
        """persona_prompt + 记忆块，作为 Bot 对话的 system message"""
        parts = [bot.persona_prompt]
        memories = await self.top_memories(bot.id, user_id) if bot.id else []
        if memories:
            lines = [f"- [{m.memory_type.value}] {m.content}" for m in memories]
            parts.append(
                "【跨会话记忆】（来自历史对话，供参考；若与本次问题冲突，以本次用户输入为准）\n"
                + "\n".join(lines)
            )
        return "\n\n".join(parts)

    # ── 模型覆盖解析 ─────────────────────────────────────────────

    def resolve_model_override(self, bot: AIBot) -> tuple[Optional[str], Optional[float]]:
        """返回 (model_override, temperature_override)。

        - 若 bot.model_id 已配置 → 用它覆盖模型（温度取 bot.temperature）
        - 若仅配置了 provider 而未指定 model_id → 不覆盖模型，仅覆盖温度
        """
        model = bot.model_id if bot.model_id else None
        return model, bot.temperature

    # ── 能力白名单校验 ────────────────────────────────────────────

    @staticmethod
    def validate_capabilities(capabilities: Optional[list[str]]) -> list[str]:
        """过滤掉未注册的工具名，只保留工具注册表中真实存在的工具（R4）。

        v3.3：`mcp:<server>` 前缀表示外部 MCP 服务器能力，直接放行
        （由 mcp_bridge 在执行前动态注册）。
        """
        if not capabilities:
            return []
        from ..agent import get_tool_registry
        registry = get_tool_registry()
        valid: list[str] = []
        for name in capabilities:
            if name.startswith("mcp:"):
                valid.append(name)
                continue
            try:
                if registry.get(name) is not None:
                    valid.append(name)
                else:
                    logger.warning(f"[BotManager] 能力白名单包含未注册工具，已忽略: {name}")
            except Exception:  # registry.get 可能抛异常
                logger.warning(f"[BotManager] 校验工具失败，已忽略: {name}")
        return valid

    # ── 智能体任务执行（Chief 派单 / 工作流）───────────────────────

    async def execute_agent_task(
        self,
        bot: AIBot,
        query: str,
        user_id: int,
        max_steps: int = 8,
        context: Optional[dict] = None,
        system_prompt: Optional[str] = None,
    ) -> AgentExecution:
        """以 Bot 身份执行智能体任务：

        - 用 persona_prompt（或 system_prompt 覆盖）作为 orchestrator 的 system prompt
        - 用 capabilities 白名单过滤工具 schema（R4）
        - 用 bot.model_id / temperature 覆盖模型（M1）
        """
        orchestrator: AgentOrchestrator = get_orchestrator(
            system_prompt=system_prompt or bot.persona_prompt
        )
        model_override, temperature_override = self.resolve_model_override(bot)
        allowed_tools = self.validate_capabilities(bot.capabilities)
        execution = await orchestrator.execute_smart(
            query,
            max_steps=max_steps,
            context=context,
            allowed_tools=allowed_tools or None,
            model_override=model_override,
            temperature_override=temperature_override,
        )
        # Phase 3：记录 LLM 用量（非致命）
        await self._record_usage(execution, bot, context, model_override)
        return execution

    async def _record_usage(
        self, execution: AgentExecution, bot: AIBot,
        context: Optional[dict], model_override: Optional[str],
    ) -> None:
        """将执行产生的 LLM token 用量写入 ai_bot_usage（Phase 3）。"""
        try:
            db = (context or {}).get("db")
            if db is None:
                return
            from ....models.usage import AiBotUsage
            tenant_id = int((context or {}).get("tenant_id") or 1)
            user_id = int((context or {}).get("user_id") or 0)
            model = model_override or bot.model_id or ""
            db.add(AiBotUsage(
                tenant_id=tenant_id,
                bot_id=bot.id,
                user_id=user_id,
                model=model,
                prompt_tokens=execution.prompt_tokens,
                completion_tokens=execution.completion_tokens,
                endpoint="agent",
                task_execution_id=execution.execution_id,
            ))
            await db.commit()
        except Exception as e:
            logger.warning(f"[Usage] 用量记录失败（非致命）: {e}")

    # ── 自主派单支持（v2：能力驱动 + 动态编队）────────────────────

    async def list_visible_bots(self, tenant_id: int, user_id: int, limit: int = 200) -> list[AIBot]:
        """返回当前用户可见的 Bot 列表（含总数过滤）。"""
        from ....domain.bots import BotStatus
        bots, _total = await self._repo.list_bots(
            tenant_id=tenant_id, user_id=user_id, status=BotStatus.ACTIVE,
            include_deleted=False, offset=0, limit=limit,
        )
        return bots

    async def get_chief(self, tenant_id: int, user_id: int) -> Optional[AIBot]:
        """返回租户下可用的 Chief Bot（is_chief=true 且未删除）。"""
        from ....domain.bots import BotStatus
        bots, _total = await self._repo.list_bots(
            tenant_id=tenant_id, user_id=user_id, status=BotStatus.ACTIVE,
            include_deleted=False, offset=0, limit=50,
        )
        for b in bots:
            if b.is_chief:
                return b
        return None

    async def find_bot_by_capability(
        self, capability: str, tenant_id: int, user_id: int,
    ) -> Optional[AIBot]:
        """按能力域关键词匹配团队中的现有 Bot（L1 团队匹配）。

        匹配范围：名称 / 简介 / capabilities。
        匹配不到返回 None（由调用方走 L2 动态创建）。
        """
        keywords = _extract_capability_keywords(capability)
        if not keywords:
            return None
        bots = await self.list_visible_bots(tenant_id, user_id)
        # 排除 Chief（Chief 不应被分派给自己）
        candidates = [b for b in bots if not b.is_chief]
        for bot in candidates:
            haystack = f"{bot.name} {bot.description or ''} {' '.join(bot.capabilities or [])}"
            if any(kw in haystack for kw in keywords):
                return bot
        return None

    async def create_temporary_expert(
        self, capability: str, tenant_id: int, user_id: int,
    ) -> Optional[AIBot]:
        """动态创建临时专家 Bot（L2 动态编队）。

        - 名称：<能力域>专家（截断 ≤ 30 字符）
        - persona：模板化生成（不额外调用 LLM，稳定且省成本）
        - capabilities：通用能力集（任意能力域均可使用）
        - visibility=org（组织共享，群成员可见可复用）
        """
        from ....domain.bots import BotStatus, BotVisibility
        name = _expert_name(capability)
        persona = (
            f"你是 RMFOOD 平台的{capability}专家，负责{capability}相关工作。\n"
            "请结合平台知识库与可用工具，完成用户分配的任务，输出专业、可执行、有依据的结果。\n"
            "证据不足时，明确说明'现有研究表明可能具有……潜力'，不得虚构结论。"
        )
        bot = AIBot(
            tenant_id=tenant_id,
            created_by=user_id,
            name=name,
            persona_prompt=persona,
            description=f"系统根据任务自动创建的{capability}专家（可复用、可编辑）",
            capabilities=["rag_retrieve", "literature_search", "qa_answer"],
            visibility=BotVisibility.ORG,
            status=BotStatus.ACTIVE,
            is_chief=False,
            is_system=False,
        )
        return await self.create_bot(bot)

    async def find_or_create_temporary_expert(
        self, capability: str, tenant_id: int, user_id: int,
    ) -> Optional[AIBot]:
        """L2 动态编队入口：先查重（可能已存在同域专家），无则创建。"""
        # 查重：按关键词再匹配一次（含用户自建/历史自动创建的专家）
        existing = await self.find_bot_by_capability(capability, tenant_id, user_id)
        if existing is not None:
            return existing
        return await self.create_temporary_expert(capability, tenant_id, user_id)

    # ── 角色评分匹配与招募（v3.3）────────────────────────────

    async def find_bot_by_name(self, name: str, tenant_id: int) -> Optional[AIBot]:
        """按名称查找同租户下未删除的 Bot（用于招募查重）。"""
        from sqlalchemy import select
        from ....domain.bots import BotStatus
        from ....models.bot import AIBot as AIBotModel
        from ....infrastructure.bots_impl import _to_domain_bot

        result = await self._repo._db.execute(
            select(AIBotModel).where(
                AIBotModel.tenant_id == tenant_id,
                AIBotModel.name == name,
                AIBotModel.status == BotStatus.ACTIVE.value,
                AIBotModel.deleted_at.is_(None),
            ).limit(1)
        )
        m = result.scalar_one_or_none()
        return _to_domain_bot(m) if m is not None else None

    async def match_bot_to_role(
        self, role_template: Any, tenant_id: int, user_id: int, threshold: float = 0.5,
    ) -> tuple[Optional[AIBot], float]:
        """角色评分匹配（v3.3 专业配人 L1）。

        score = 0.35×能力标签命中 + 0.25×内置工具覆盖 + 0.20×角色名匹配 + 0.20×MCP 匹配
        """
        from .role_templates import ROLE_NAME_KEYWORDS

        bots = await self.list_visible_bots(tenant_id, user_id)
        candidates = [b for b in bots if not b.is_chief]
        role_caps = set(role_template.capabilities or [])
        role_tools = set(role_template.required_tools or [])
        role_mcp = set(role_template.required_mcp_servers or [])
        keywords = ROLE_NAME_KEYWORDS.get(role_template.role_key, []) or []

        best_bot: Optional[AIBot] = None
        best_score = 0.0
        for b in candidates:
            bot_text = f"{b.name} {b.description or ''}"
            bot_caps = set(b.capabilities or [])
            # 能力标签命中：角色能力词出现在 Bot 名称/简介中
            cap_hit = sum(1 for c in role_caps if c in bot_text) / len(role_caps) if role_caps else 0.0
            # 内置工具覆盖
            tool_hit = len(role_tools & bot_caps) / len(role_tools) if role_tools else 0.0
            # 角色名匹配
            name_hit = 1.0 if any(kw in bot_text for kw in keywords) else 0.0
            # MCP 服务器匹配
            bot_mcp = {c for c in bot_caps if c.startswith("mcp:")}
            mcp_hit = len(role_mcp & bot_mcp) / len(role_mcp) if role_mcp else 0.0

            score = 0.35 * cap_hit + 0.25 * tool_hit + 0.20 * name_hit + 0.20 * mcp_hit
            if score > best_score:
                best_score = score
                best_bot = b
        if best_bot is not None and best_score >= threshold:
            return best_bot, best_score
        return None, best_score

    async def recruit_bot_from_role_template(
        self, role_template: Any, tenant_id: int, user_id: int,
        task_context: Optional[str] = None,
    ) -> tuple[Optional[AIBot], bool]:
        """按角色模板实时招募 AI 员工（v3.3 L2）。

        - 查重：同名 Bot 已存在则复用（不重复招募）
        - 创建：name=角色名，persona=模板+任务上下文，capabilities=required_tools + mcp:<server>
        - visibility=org（组织共享，长期保留）
        返回 (bot, recruited)（recruited=True 表示本次新建）。
        """
        from ....domain.bots import BotStatus, BotVisibility

        existing = await self.find_bot_by_name(role_template.name, tenant_id)
        if existing is not None:
            return existing, False

        persona = role_template.persona_template
        if task_context:
            persona += f"\n\n【本次任务上下文】{task_context[:500]}"

        capabilities = list(role_template.required_tools or [])
        for server in role_template.required_mcp_servers or []:
            capabilities.append(f"mcp:{server}")

        bot = AIBot(
            tenant_id=tenant_id,
            created_by=user_id,
            name=role_template.name,
            persona_prompt=persona,
            description=role_template.description,
            capabilities=capabilities,
            visibility=BotVisibility.ORG,
            status=BotStatus.ACTIVE,
            is_chief=False,
            is_system=False,
        )
        created = await self.create_bot(bot)
        return created, True


# 便捷工厂：与 get_orchestrator 风格一致
def get_bot_manager(db: AsyncSession) -> BotManager:
    return BotManager(db)
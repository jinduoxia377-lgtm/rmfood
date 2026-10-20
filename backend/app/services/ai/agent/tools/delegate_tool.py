"""
delegate 工具 — Chief 自主派单（v2）

能力驱动派单：Chief 通过 delegate(capability, task) 将子任务分派给专家。
工具内部执行三级兜底：
- L1：按能力关键词匹配团队现有 Bot
- L2：未匹配 → 查重/动态创建临时专家（org 共享，可复用）
- L3：无法创建 → 返回失败，由 Chief 自行兜底

可观测性：每次派单执行结果实时写入群聊消息。
防递归：delegate 仅注册给 Chief，专业 Bot 不具备此工具。
"""
from __future__ import annotations

import logging
import time
from typing import Any, Optional

from . import BaseAgentTool, ToolResult, register_tool
from .....infrastructure.bots_impl import SQLAlchemyGroupChatRepository

logger = logging.getLogger(__name__)

# 每次派单流程中允许动态创建临时专家的次数上限
MAX_TEMP_EXPERTS_PER_DISPATCH = 2
# delegate 返回给 Chief 的结果长度上限（防止 Chief 上下文爆炸）
RESULT_LIMIT = 1500
# 子任务最大步数（目标 Bot 的 Agent 循环上限；5 步可支持「检索→分析→复核→结构化输出」，
# 同时控制端到端时延与成本。步数过低会导致专家复读上下文而非真正调用工具。）
SUBTASK_MAX_STEPS = 5


@register_tool
class DelegateTool(BaseAgentTool):
    """将子任务分派给团队专家 Bot"""

    @property
    def name(self) -> str:
        return "delegate"

    @property
    def description(self) -> str:
        return (
            "将子任务分派给团队中的专家 Bot 执行。"
            "capability 描述所需能力域（如 配方设计/安全性评估/毒理学评估/法规合规/实验方案/文献检索）；"
            "task 为要执行的子任务内容（可包含前序步骤的关键结果）。"
            "若团队中没有对应能力的专家，系统会自动创建临时专家。"
            "执行结果会实时发到当前群聊。"
        )

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "capability": {
                    "type": "string",
                    "description": "所需能力域，如 配方设计、安全性评估、毒理学评估、法规合规、实验方案、文献检索",
                },
                "task": {
                    "type": "string",
                    "description": "要执行的子任务内容（≤2000字符），可包含前序步骤结果",
                },
            },
            "required": ["capability", "task"],
        }

    async def execute(self, params: dict, context: dict) -> ToolResult:
        start = time.time()
        capability = (params.get("capability") or "").strip()
        task = (params.get("task") or "").strip()
        if not capability or not task:
            return ToolResult(
                tool_name=self.name, success=False,
                error="capability 与 task 不能为空",
                latency_ms=(time.time() - start) * 1000,
            )

        db = context.get("db")
        user_id = int(context.get("user_id") or 0)
        tenant_id = int(context.get("tenant_id") or 1)
        group_id = context.get("group_id")

        # 延迟导入，避免模块导入时与 agent 包循环依赖
        from ..bot_manager import BotManager
        bm = BotManager(db)

        # ── L1 团队匹配 ──
        bot = await bm.find_bot_by_capability(capability, tenant_id, user_id)

        # ── L2 动态编队（查重 + 创建临时专家）──
        if bot is None:
            created_count = int(context.get("_l2_created_count", 0) or 0)
            if created_count < MAX_TEMP_EXPERTS_PER_DISPATCH:
                bot = await bm.find_or_create_temporary_expert(capability, tenant_id, user_id)
                if bot is not None:
                    context["_l2_created_count"] = created_count + 1

        # ── L2.5 GitHub 自动供给（v3.4）：团队无专家时从 GitHub 获取开源技能模板创建专家 ──
        if bot is None and int(context.get("_github_supply_used", 0) or 0) < 1:
            from ..github_supply_service import recruit_expert_from_github
            bot, recruited, source = await recruit_expert_from_github(
                db, capability, task, tenant_id, user_id,
            )
            if bot is not None:
                context["_github_supply_used"] = 1
                if group_id is not None:
                    try:
                        repo = SQLAlchemyGroupChatRepository(db)
                        await repo.add_message(
                            int(group_id), "bot",
                            f"【GitHub供给】团队暂无「{capability}」专家，已从 GitHub 开源项目获取技能模板，"
                            f"创建 AI 员工「{bot.name}」（来源 {source}）。",
                            sender_bot_id=1, sender_bot_name="Chief",
                        )
                    except Exception as e:
                        logger.warning(f"[delegate] GitHub 供给消息写入失败（非致命）: {e}")

        # ── 执行目标 Bot ──
        if bot is None:
            return ToolResult(
                tool_name=self.name, success=False,
                error=f"未找到/无法创建 {capability} 专家，请 Chief 直接处理该子任务。",
                latency_ms=(time.time() - start) * 1000,
            )

        try:
            # 内部子任务：跳过 Prompt 注入检测（避免对系统生成的任务文本误报）
            child_context = dict(context or {})
            child_context["skip_prompt_guard"] = True
            execution = await bm.execute_agent_task(
                bot, task, user_id=user_id, max_steps=SUBTASK_MAX_STEPS, context=child_context,
            )
            result_text = (execution.final_response or "（无回复）")[:RESULT_LIMIT]
            execution_id = execution.execution_id
        except Exception as e:
            logger.warning(f"[delegate] Bot {bot.id} 执行失败: {e}")
            result_text = f"（{bot.name} 执行失败：{str(e)[:200]}）"
            execution_id = None

        # ── 写群聊消息（可观测）──
        if group_id is not None:
            try:
                repo = SQLAlchemyGroupChatRepository(db)
                await repo.add_message(
                    group_id=int(group_id),
                    sender_type="bot",
                    sender_bot_id=bot.id,
                    sender_bot_name=bot.name,
                    content=result_text,
                    task_execution_id=execution_id,
                )
            except Exception as e:
                logger.warning(f"[delegate] 群聊消息写入失败（非致命）: {e}")

        return ToolResult(
            tool_name=self.name,
            success=True,
            data={
                "bot_id": bot.id,
                "bot_name": bot.name,
                "capability": capability,
                "result": result_text,
                "created": bool(context.get("_l2_created_count")) and bot.name.endswith("专家"),
            },
            latency_ms=(time.time() - start) * 1000,
        )
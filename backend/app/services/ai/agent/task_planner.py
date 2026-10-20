"""
任务解析器 TaskPlanner（v3.3）

职责：
- 根据用户任务 + 角色模板库 + 可用 Bot 列表，用一次 LLM 调用输出角色需求清单。
- 输出 JSON：{"roles": [{"role_key", "task", "matched_bot_id"}]}
- Pydantic 校验；解析失败重试 1 次；仍失败降级默认角色集。
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from pydantic import BaseModel, Field, ValidationError

from ....services.llm_service import LLMMessage, llm_service
from .role_templates import RoleTemplate

logger = logging.getLogger(__name__)

MAX_ROLES = 4
DEFAULT_ROLE_KEY = "formula_designer"


class RolePlanItem(BaseModel):
    role_key: str
    task: str = Field(..., min_length=1, max_length=2000)
    matched_bot_id: Optional[int] = None


class RolePlan(BaseModel):
    roles: list[RolePlanItem] = Field(..., min_length=1, max_length=MAX_ROLES)


def _build_prompt(content: str, templates: list[RoleTemplate], available_bots: list[dict]) -> str:
    role_lines = "\n".join(
        f"- {t.role_key}（{t.name}）: {t.description}；可用工具={','.join(t.required_tools) or '无'}"
        for t in templates
    )
    bot_lines = "\n".join(
        f"- #{b['id']} {b['name']}：capabilities={','.join(b.get('capabilities') or [])}"
        for b in available_bots[:30]
    ) or "- （无可用 Bot）"
    return (
        "你是一个研发任务规划专家。请根据用户任务，从给定的【专业角色库】中选择最合适的角色，"
        "并拆分成 1-4 个子任务。\n\n"
        f"【专业角色库】\n{role_lines}\n\n"
        f"【可用 Bot 列表】\n{bot_lines}\n\n"
        "【输出要求】只输出 JSON，不要解释：\n"
        '{"roles": [{"role_key": "<角色key>", "task": "<子任务描述>", "matched_bot_id": <Bot id 或 null>}]}\n'
        "约束：\n"
        "1. role_key 必须来自专业角色库；\n"
        "2. 每个角色对应一个子任务，子任务描述要具体、可执行；\n"
        "3. 如果可用 Bot 中某 Bot 的能力与该角色匹配，matched_bot_id 填该 Bot 的 id，否则填 null（系统会实时招募）；\n"
        "4. 子任务之间如果有依赖，后面的子任务描述中要引用前序子任务的结果；\n"
        "5. 所有子任务必须围绕用户任务的【原始目标与功效关键词】，配方/分析不得偏离用户明确诉求；\n"
        "6. 每个子任务描述必须显式要求专家【先调用工具】检索/核实（如 rag_retrieve 检索药食同源目录、"
        "generate_formula 生成配方、compliance_check 校验合规），再基于工具结果输出专业结论，禁止凭空编造。"
    )


def _default_plan(content: str) -> dict[str, Any]:
    """降级默认角色集：单角色（配方设计专家）。"""
    return {
        "roles": [
            {"role_key": DEFAULT_ROLE_KEY, "task": content[:2000], "matched_bot_id": None},
        ]
    }


def _validate_plan(raw: dict, templates: list[RoleTemplate], bot_ids: set[int]) -> Optional[RolePlan]:
    try:
        plan = RolePlan.model_validate(raw)
    except ValidationError as e:
        logger.warning(f"[TaskPlanner] 规划校验失败: {e}")
        return None
    # 角色 key 必须存在
    valid_keys = {t.role_key for t in templates}
    for item in plan.roles:
        if item.role_key not in valid_keys:
            logger.warning(f"[TaskPlanner] 未知角色 key: {item.role_key}")
            return None
        if item.matched_bot_id is not None and item.matched_bot_id not in bot_ids:
            item.matched_bot_id = None  # 无效 id 置空，走招募
    return plan


class TaskPlanner:
    """任务解析器"""

    async def plan(
        self,
        content: str,
        templates: list[RoleTemplate],
        available_bots: list[dict],
    ) -> dict[str, Any]:
        """返回 {"roles": [{role_key, task, matched_bot_id}]}"""
        prompt = _build_prompt(content, templates, available_bots)
        bot_ids = {b["id"] for b in available_bots if b.get("id")}

        messages = [
            LLMMessage(role="system", content="你是一个严谨的任务规划助手。"),
            LLMMessage(role="user", content=prompt),
        ]

        # 最多尝试 2 次
        for attempt in range(2):
            try:
                raw = await llm_service.chat_with_json(messages)
            except Exception as e:
                logger.warning(f"[TaskPlanner] LLM 调用失败（第{attempt+1}次）: {e}")
                continue
            plan = _validate_plan(raw, templates, bot_ids)
            if plan is not None:
                return {"roles": [item.model_dump() for item in plan.roles]}
        # 降级
        logger.warning("[TaskPlanner] 规划失败，降级默认角色集")
        return _default_plan(content)


_task_planner_instance: Optional[TaskPlanner] = None


def get_task_planner() -> TaskPlanner:
    global _task_planner_instance
    if _task_planner_instance is None:
        _task_planner_instance = TaskPlanner()
    return _task_planner_instance
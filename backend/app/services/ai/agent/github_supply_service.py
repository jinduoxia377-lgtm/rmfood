"""
GitHub 自动供给服务（v3.4：Chief 派单链路 L2.5 兜底）

当团队没有对应专家/工具时，自动通过 GitHub MCP 从 GitHub 搜索并获取：
- 开源 Agent/技能模板 → 创建"GitHub 来源专家"（persona 含来源与技能说明）
- 开源 MCP 服务器项目 → 生成 ai_mcp_servers 配置模板（默认 disabled，用户确认启用）

安全：只导入模板/提示词，不自动执行第三方代码。
"""
from __future__ import annotations

import json
import logging
from typing import Optional

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.github_mcp_router import _call_tool

from ....domain.bots import AIBot, BotStatus, BotVisibility
from ....models.mcp_server import McpServerConfig
from ....services.llm_service import LLMMessage, llm_service
from .bot_manager import BotManager

logger = logging.getLogger(__name__)

GITHUB_CAPABILITIES = ["rag_retrieve", "literature_search", "qa_answer", "mcp:github"]


class GithubExpertPlan(BaseModel):
    """LLM 从 README 解析出的专家/技能模板"""
    name: str = Field(..., min_length=2, max_length=50)
    capabilities: list[str] = Field(default_factory=list)
    persona: str = Field(..., min_length=20, max_length=3000)
    is_mcp_server: bool = False
    mcp_command: Optional[str] = Field(None, max_length=500)
    mcp_description: str = Field("", max_length=500)


async def _read_repo_text(full_name: str, path: str = "README.md") -> str:
    """读取仓库文件文本（通过 GitHub MCP 端点）。"""
    try:
        result = await _call_tool("github_read_file", {"repo": full_name, "path": path})
        content = (result.get("content") or [{}])[0].get("text", "")
        return content[:8000]
    except Exception as e:
        logger.warning(f"[GithubSupply] 读取 {full_name} {path} 失败: {e}")
        return ""


async def _search_repositories(query: str) -> list[dict]:
    """搜索 GitHub 仓库（通过 GitHub MCP 端点）。"""
    try:
        result = await _call_tool("github_search_repositories", {"query": query})
        text = (result.get("content") or [{}])[0].get("text", "")
        return json.loads(text) if text else []
    except Exception as e:
        logger.warning(f"[GithubSupply] 仓库搜索失败: {e}")
        return []


async def _parse_expert_plan(description: str, readme: str) -> Optional[GithubExpertPlan]:
    """LLM 解析 README 为专家/技能模板。"""
    try:
        prompt = (
            "请根据以下开源项目的描述与 README 摘要，判断它是否适合作为平台 AI 员工的技能模板，"
            "并输出 JSON（不要解释）：\n"
            '{"name": "专家名称", "capabilities": ["能力标签数组"], '
            '"persona": "专家人设提示词（300字内，含技能说明与 GitHub 来源）", '
            '"is_mcp_server": true/false, "mcp_command": "若为 MCP 服务器项目则填启动命令如 npx -y xxx，否则空", '
            '"mcp_description": "MCP 服务器用途简介（100字内）"}\n\n'
            f"项目描述：{description[:1000]}\n\nREADME 摘要：{readme[:4000]}"
        )
        messages = [
            LLMMessage(role="system", content="你是一个严谨的开源能力解析助手。"),
            LLMMessage(role="user", content=prompt),
        ]
        raw = await llm_service.chat_with_json(messages)
        return GithubExpertPlan.model_validate(raw)
    except (Exception, ValidationError) as e:
        logger.warning(f"[GithubSupply] 专家模板解析失败: {e}")
        return None


async def search_capability(capability: str, task: str) -> list[dict]:
    """从 GitHub 搜索与能力/任务相关的开源仓库。返回仓库列表。"""
    # 从 capability 提取英文关键词（简化：capability 本身作为搜索词）
    query = f"{capability} agent OR mcp OR skill"
    repos = await _search_repositories(query)
    return repos[:5]


async def register_mcp_from_github(
    db: AsyncSession, tenant_id: int, repo_full_name: str, plan: GithubExpertPlan,
) -> bool:
    """将 MCP 服务器项目登记为 ai_mcp_servers 配置（默认 disabled）。"""
    if not plan.is_mcp_server or not plan.mcp_command:
        return False
    name = f"github_{repo_full_name.split('/')[-1]}"[:64]
    exists = (await db.execute(
        select(McpServerConfig).where(McpServerConfig.name == name)
    )).scalar_one_or_none()
    if exists is not None:
        return False
    db.add(McpServerConfig(
        tenant_id=tenant_id,
        name=name,
        transport="stdio",
        url=None,
        command=plan.mcp_command,
        headers={},
        enabled=False,
        allow_tools=[],
        visibility="org",
        created_by=1,
    ))
    await db.commit()
    logger.info(f"[GithubSupply] 已登记 MCP 服务器配置（disabled）: {name}")
    return True


async def recruit_expert_from_github(
    db: AsyncSession, capability: str, task: str, tenant_id: int, user_id: int,
) -> tuple[Optional[AIBot], bool, str]:
    """L2.5：从 GitHub 搜索并创建"GitHub 来源专家"。

    返回 (bot, recruited, source_info)。recruited=True 表示本次从 GitHub 创建。
    无合适仓库/解析失败 → 返回 (None, False, "")（由上层走 L3）。
    改进：
    - 遍历多个候选仓库（最多 3 个），提高解析成功率；
    - 创建前按名称查重（复用已有专家，避免团队膨胀）；
    - persona 输出安全校验（防 README prompt 注入）。
    """
    try:
        repos = await search_capability(capability, task)
        if not repos:
            return None, False, ""

        bm = BotManager(db)
        plan = None
        full_name = ""
        repo_info: dict = {}
        # 遍历候选仓库直到解析出有效专家模板
        for candidate in repos[:3]:
            candidate_name = candidate.get("full_name", "")
            if not candidate_name:
                continue
            readme = await _read_repo_text(candidate_name)
            parsed = await _parse_expert_plan(candidate.get("description") or "", readme)
            if parsed is not None:
                plan = parsed
                full_name = candidate_name
                repo_info = candidate
                break
        if plan is None or not full_name:
            return None, False, ""

        # 登记 MCP 服务器配置（若适用，默认 disabled）
        try:
            await register_mcp_from_github(db, tenant_id, full_name, plan)
        except Exception as e:
            logger.warning(f"[GithubSupply] MCP 配置登记失败（非致命）: {e}")

        # 查重：同名专家已存在则复用，避免团队膨胀
        existing = await bm.find_bot_by_name(plan.name, tenant_id)
        if existing is not None:
            logger.info(f"[GithubSupply] 复用已有 GitHub 专家: {existing.name}")
            return existing, False, f"GitHub:{full_name}"

        persona = (
            f"{plan.persona}\n\n"
            f"【来源】GitHub 开源项目 {full_name}（{repo_info.get('html_url', '')}）\n"
            f"【能力】{capability}；本专家由系统根据任务需求自动从 GitHub 获取开源技能模板创建。"
        )
        # 输出安全校验（防 README 注入）
        try:
            from app.services.ai.safety.output_filter import check_output
            output_check = check_output(persona)
            persona = output_check.sanitized_text if not output_check.is_safe else persona
        except Exception:
            pass

        capabilities = list(set(plan.capabilities + GITHUB_CAPABILITIES))[:20]
        bot = AIBot(
            tenant_id=tenant_id,
            created_by=user_id,
            name=plan.name[:50],
            persona_prompt=persona,
            description=f"GitHub 开源技能专家（来源 {full_name}）：{capability}",
            capabilities=capabilities,
            visibility=BotVisibility.ORG,
            status=BotStatus.ACTIVE,
            is_chief=False,
            is_system=False,
        )
        created = await bm.create_bot(bot)
        logger.info(f"[GithubSupply] 已从 GitHub 创建专家: {created.name} (repo={full_name})")
        return created, True, f"GitHub:{full_name}"
    except Exception as e:
        logger.warning(f"[GithubSupply] GitHub 供给失败（降级 L3）: {e}")
        return None, False, ""

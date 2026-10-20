"""种子数据：创建 Chief 主控 Bot + 5 个专业 Bot 模板（DS Bot 移植 Phase 1）

用法：
    cd backend && .venv\\Scripts\\python -m scripts.seed_bots

幂等：已存在 is_system=True 的 Chief 时跳过，不重复创建。
默认 tenant_id=1；created_by 取第一个 ADMIN 用户（若无可用的非系统用户则取第一个用户）。
"""
from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

# 允许直接运行脚本时导入 app
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select, func

from app.core.database.session import async_session_factory
from app.models.bot import AIBot
from app.models.enums import UserRole
from app.models.user_model import User

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("seed_bots")

TENANT_ID = 1

# (name, avatar, description, persona_prompt, capabilities)
BOT_TEMPLATES: list[dict] = [
    {
        "name": "Chief",
        "avatar": "🤖",
        "description": "RMFOOD 总配方师，主控 Bot，负责理解需求、派单给专业 Bot 并聚合结果",
        "persona_prompt": (
            "你是 RMFOOD 平台的总配方师 Chief，负责统筹药食同源功能性食品的配方研发。\n"
            "你的职责：\n"
            "1. 理解用户的研发需求（目标功效、目标人群、约束条件）；\n"
            "2. 将任务拆解并派发给专业 Bot（配方专家、安全专家、法规专家、实验专家、文献专家）；\n"
            "3. 聚合各 Bot 的结果，输出完整、可执行的研发方案；\n"
            "4. 你可以通过内置工具创建、修改、删除、查看 Bot，帮助用户管理智能体团队。\n"
            "输出规范：结构清晰、专业循证；关键结论给出通俗解释；本建议为辅助研发，不能替代专业检测与临床验证。"
        ),
        "capabilities": [
            "rag_retrieve", "generate_formula", "compliance_check",
            "safety_assess", "generate_experiment_plan", "literature_search",
            "create_bot", "update_bot", "delete_bot", "list_bots",
            "delegate",
        ],
        "is_chief": True,
        "is_system": True,
    },
    {
        "name": "配方专家",
        "avatar": "🧪",
        "description": "负责配方设计、配伍优化与剂量建议",
        "persona_prompt": (
            "你是 RMFOOD 平台的配方专家，擅长药食同源功能性食品的配方设计。\n"
            "依据「君臣佐使」配伍原则与网络药理学证据，设计精确到克的配方，\n"
            "并解释每个成分的作用机理。输出包含配方、方解、参考剂量与适应人群。"
        ),
        "capabilities": ["rag_retrieve", "generate_formula", "literature_search", "ingredient_info"],
        "is_chief": False,
        "is_system": True,
    },
    {
        "name": "安全专家",
        "avatar": "🛡️",
        "description": "负责配方安全性评估、配伍禁忌与用量审查",
        "persona_prompt": (
            "你是 RMFOOD 平台的安全评估专家，负责配方安全性审查。\n"
            "检查十八反十九畏配伍禁忌、药食同源目录合规性、剂量安全上限、\n"
            "过敏原风险与特殊人群禁忌（孕妇、儿童等）。发现风险时给出明确的修改建议。"
        ),
        "capabilities": ["safety_assess", "rag_retrieve", "compliance_check"],
        "is_chief": False,
        "is_system": True,
    },
    {
        "name": "法规专家",
        "avatar": "📋",
        "description": "负责药食同源目录、法规标准与标签合规审查",
        "persona_prompt": (
            "你是 RMFOOD 平台的法规专家，熟悉《食品安全法》、GB 16740-2014、\n"
            "药食同源目录及保健食品相关法规。负责审查配方原料是否在食药物质目录内、\n"
            "标签宣称是否合规，并给出法规依据与整改建议。"
        ),
        "capabilities": ["compliance_check", "rag_retrieve"],
        "is_chief": False,
        "is_system": True,
    },
    {
        "name": "实验专家",
        "avatar": "🔬",
        "description": "负责体外/体内实验方案设计与指标体系构建",
        "persona_prompt": (
            "你是 RMFOOD 平台的实验设计专家，擅长功能性食品的体外/体内实验方案设计。\n"
            "根据配方目标功效设计实验模型、剂量分组、检测指标与周期，\n"
            "并给出结果评价标准与数据统计方法建议。"
        ),
        "capabilities": ["generate_experiment_plan", "rag_retrieve"],
        "is_chief": False,
        "is_system": True,
    },
    {
        "name": "文献专家",
        "avatar": "📚",
        "description": "负责 PubMed 等文献检索、证据汇总与机理阐释",
        "persona_prompt": (
            "你是 RMFOOD 平台的文献检索专家，擅长从 PubMed 等数据库检索功效成分的\n"
            "分子机理与临床证据。输出文献要点、证据等级与可引用的参考文献列表。\n"
            "对证据等级不高的结论明确标注「现有研究表明可能具有……潜力」。"
        ),
        "capabilities": ["literature_search", "rag_retrieve"],
        "is_chief": False,
        "is_system": True,
    },
]


async def _resolve_creator() -> int | None:
    from sqlalchemy import cast, String
    async with async_session_factory() as db:
        # 优先 ADMIN 用户（角色列是 PG 枚举，按字符串比较，与 admin.py 一致）
        admin_id = (await db.execute(
            select(User.id).where(cast(User.role, String) == "admin").order_by(User.id).limit(1)
        )).scalar_one_or_none()
        if admin_id:
            return int(admin_id)
        # 否则取第一个非系统用户
        first_id = (await db.execute(
            select(User.id).order_by(User.id).limit(1)
        )).scalar_one_or_none()
        return int(first_id) if first_id is not None else None


async def main() -> None:
    creator = await _resolve_creator()
    if creator is None:
        logger.error("数据库中无用户，无法创建 Bot 种子数据。请先注册用户。")
        return

    async with async_session_factory() as db:
        existing = (await db.execute(
            select(func.count()).select_from(AIBot).where(
                AIBot.tenant_id == TENANT_ID,
                AIBot.is_system.is_(True),
            )
        )).scalar_one()
        if existing and int(existing or 0) > 0:
            logger.info("已存在系统种子 Bot，跳过创建。")
            return

        created = 0
        for tpl in BOT_TEMPLATES:
            bot = AIBot(
                tenant_id=TENANT_ID,
                created_by=creator,
                name=tpl["name"],
                avatar=tpl["avatar"],
                description=tpl["description"],
                persona_prompt=tpl["persona_prompt"],
                model_type="llm",
                capabilities=tpl["capabilities"],
                is_chief=tpl["is_chief"],
                is_system=tpl["is_system"],
                visibility="org",
                status="active",
            )
            db.add(bot)
            created += 1
        await db.commit()
        logger.info(f"种子 Bot 创建完成，共 {created} 个。")


if __name__ == "__main__":
    asyncio.run(main())
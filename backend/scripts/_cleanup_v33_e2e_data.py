"""清理 v3.3 端到端实测数据（任务群/任务记录/测试 Bot）。"""
import asyncio
from sqlalchemy import text
from app.core.database.session import async_session_factory


async def main() -> None:
    async with async_session_factory() as db:
        await db.execute(text("DELETE FROM ai_task_groups"))
        await db.execute(text(
            "DELETE FROM ai_bot_group_messages WHERE group_id IN "
            "(SELECT id FROM ai_bot_group_sessions WHERE name LIKE '任务·%')"
        ))
        await db.execute(text(
            "DELETE FROM ai_bot_group_members WHERE group_id IN "
            "(SELECT id FROM ai_bot_group_sessions WHERE name LIKE '任务·%')"
        ))
        await db.execute(text("DELETE FROM ai_bot_group_sessions WHERE name LIKE '任务·%'"))
        await db.execute(text(
            "DELETE FROM ai_bots WHERE is_system = false AND (name LIKE '%专家%' OR description LIKE '%根据任务自动创建%')"
        ))
        await db.commit()
        print("CLEANUP_OK")


if __name__ == "__main__":
    asyncio.run(main())
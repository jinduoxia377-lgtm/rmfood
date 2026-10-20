"""清理测试数据：删除所有非系统 Bot（保留 6 个种子系统 Bot）及测试群聊。

- 清空群聊三表（当前均为测试数据）
- 删除 ai_bot_memories 中属于非系统 Bot 的记忆
- 删除 ai_bots 中 is_system=false 的测试 Bot
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from app.core.database.session import async_session_factory


async def main() -> None:
    async with async_session_factory() as db:
        # 群聊数据
        for table in ("ai_bot_group_messages", "ai_bot_group_members", "ai_bot_group_sessions"):
            await db.execute(text(f"DELETE FROM {table}"))
        # 非系统 Bot 的记忆
        await db.execute(text(
            "DELETE FROM ai_bot_memories WHERE bot_id IN (SELECT id FROM ai_bots WHERE is_system = false)"
        ))
        # 非系统 Bot（pytest/测试创建）
        res = await db.execute(text("DELETE FROM ai_bots WHERE is_system = false"))
        await db.commit()
        deleted = res.rowcount
        remaining = (await db.execute(text("SELECT count(*) FROM ai_bots"))).scalar_one()
        print(f"CLEANUP_OK deleted_test_bots={deleted} remaining_bots={remaining}")


if __name__ == "__main__":
    asyncio.run(main())
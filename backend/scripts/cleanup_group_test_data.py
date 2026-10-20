"""清理群聊测试数据（含乱码标题的演示群）。

当前 ai_bot_group_sessions 中的记录均为开发测试数据：
- pytest 用例用随机用户创建的测试群
- HTTP 实测时用 PowerShell 发送导致的乱码群（name 含 ?）

为确保用户看到干净状态，清空三张群聊表。后续前端（axios UTF-8）创建不会乱码。
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from app.core.database.session import async_session_factory


async def main() -> None:
    async with async_session_factory() as db:
        for table in ("ai_bot_group_messages", "ai_bot_group_members", "ai_bot_group_sessions"):
            await db.execute(text(f"DELETE FROM {table}"))
        await db.commit()
        print("GROUP_CLEANUP_OK")


if __name__ == "__main__":
    asyncio.run(main())
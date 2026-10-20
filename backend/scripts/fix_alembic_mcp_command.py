"""修复 alembic 状态与 mcp command 列（幂等）。

背景：ai_bot_usage 表已存在但 alembic_version 未记录对应迁移，
导致 alembic upgrade head 报 DuplicateTableError。
本脚本：
1. 若 ai_mcp_servers 无 command 列则添加（对应 20261014_020000）
2. 将 alembic_version 重置为最新 head 20261014_020000
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from app.core.database.session import async_session_factory

TARGET_HEAD = "20261014_020000"


async def main() -> None:
    async with async_session_factory() as db:
        # 1. 添加 command 列（幂等）
        col = (await db.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='ai_mcp_servers' AND column_name='command'"
        ))).first()
        if col is None:
            await db.execute(text("ALTER TABLE ai_mcp_servers ADD COLUMN command VARCHAR(512) NULL"))
            print("ADDED command column")
        else:
            print("command column already exists")

        # 2. 重置 alembic_version 为最新 head
        await db.execute(text("DELETE FROM alembic_version"))
        await db.execute(text("INSERT INTO alembic_version (version_num) VALUES (:v)"), {"v": TARGET_HEAD})
        await db.commit()
        print(f"ALEMBIC_HEAD_OK={TARGET_HEAD}")


if __name__ == "__main__":
    asyncio.run(main())
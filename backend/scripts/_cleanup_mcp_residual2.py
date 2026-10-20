"""清理测试残留 MCP 服务器（pubmed_*/server_*）。"""
import asyncio
from sqlalchemy import text
from app.core.database.session import async_session_factory


async def main() -> None:
    async with async_session_factory() as db:
        r = await db.execute(text(
            "DELETE FROM ai_mcp_servers WHERE name LIKE 'pubmed_%' OR name LIKE 'server_%'"
        ))
        await db.commit()
        print("DELETED:", r.rowcount)


if __name__ == "__main__":
    asyncio.run(main())
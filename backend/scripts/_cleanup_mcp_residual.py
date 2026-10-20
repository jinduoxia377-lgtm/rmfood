"""清理测试残留 MCP 服务器。"""
import asyncio
from sqlalchemy import text
from app.core.database.session import async_session_factory


async def main() -> None:
    async with async_session_factory() as db:
        await db.execute(text(
            "DELETE FROM ai_mcp_servers WHERE name LIKE 'pubmed_%' OR name LIKE 'server_%' "
            "OR name = 'test_pubmed' OR name = 'pubmed' OR name = 'testserver'"
        ))
        await db.commit()
        print("MCP_CLEANUP_OK")


if __name__ == "__main__":
    asyncio.run(main())
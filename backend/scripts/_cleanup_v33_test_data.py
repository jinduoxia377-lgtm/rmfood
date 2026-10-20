"""清理 v3.3 测试残留数据（临时脚本）。"""
import asyncio
from sqlalchemy import text
from app.core.database.session import async_session_factory


async def main() -> None:
    async with async_session_factory() as db:
        await db.execute(text(
            "DELETE FROM ai_bots WHERE "
            "(name LIKE '%专家' AND is_system = false AND description LIKE '%根据任务自动创建%') "
            "OR name IN ('毒理学评估专家','合规专家','配方设计专家','安全性评估专家',"
            "'实验方案专家','文献检索专家','工艺工程专家','成本分析专家','质量合规专家','市场分析专家')"
        ))
        await db.execute(text("DELETE FROM ai_mcp_servers WHERE name IN ('pubmed','testserver')"))
        await db.commit()
        print("CLEANUP_OK")


if __name__ == "__main__":
    asyncio.run(main())
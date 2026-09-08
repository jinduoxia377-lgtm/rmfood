"""PostgreSQL 连接测试 v4 — 无密码 + 多数据库"""
import asyncio
import asyncpg
from scripts.db_utils import get_asyncpg_dsn

async def test():
    # 测试多种 DSN（无密码）
    dsns = [
        "postgresql://postgres@localhost:5432/postgres",
        get_asyncpg_dsn(),
    ]

    for dsn in dsns:
        print(f"\n尝试: {dsn}")
        try:
            conn = await asyncpg.connect(dsn, timeout=5)
            version = await conn.fetchval("SELECT version()")
            print(f"  ✅ 成功! {str(version)[:80]}")
            await conn.close()
            return True
        except Exception as e:
            print(f"  ❌ {type(e).__name__}: {e}")

    return False

if __name__ == "__main__":
    ok = asyncio.run(test())
    exit(0 if ok else 1)

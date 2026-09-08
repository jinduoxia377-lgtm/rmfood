"""PostgreSQL 连接测试脚本"""
import asyncio
import asyncpg
from scripts.db_utils import get_asyncpg_dsn

async def test_pg_connection():
    """测试 PostgreSQL 连接"""
    dsn = get_asyncpg_dsn()
    print(f"正在连接 PostgreSQL: {dsn}")

    try:
        conn = await asyncpg.connect(dsn, timeout=5)
        version = await conn.fetchval("SELECT version()")
        print(f"✅ PostgreSQL 连接成功!")
        print(f"   版本: {str(version)[:100]}")

        # 检查是否已有表
        tables = await conn.fetchval(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
        )
        print(f"   已有表数量: {tables}")
        await conn.close()
        return True
    except Exception as e:
        print(f"❌ 连接失败: {type(e).__name__}: {e}")
        return False

if __name__ == "__main__":
    ok = asyncio.run(test_pg_connection())
    exit(0 if ok else 1)

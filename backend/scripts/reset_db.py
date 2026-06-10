"""删除并重建 rmfood_platform 数据库（用于重新执行迁移）"""
import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres@localhost:5432/postgres')
    print("⏳ 终止现有连接并删除数据库...")

    # 终止到该数据库的所有连接
    try:
        await conn.execute("""
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = 'rmfood_platform' AND pid != pg_backend_pid()
        """)
    except Exception:
        pass  # 可能没有活动连接

    # 删除数据库
    try:
        await conn.execute("DROP DATABASE rmfood_platform")
        print("✅ 已删除旧数据库")
    except Exception as e:
        print(f"⚠️ 删除失败 (可能不存在): {e}")

    # 重建数据库
    await conn.execute("CREATE DATABASE rmfood_platform ENCODING 'UTF8'")
    print("✅ 已创建新数据库 rmfood_platform")

    await conn.close()
    print("\n✅ 完成! 现在可以运行 alembic upgrade head")

if __name__ == '__main__':
    asyncio.run(main())

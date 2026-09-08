"""Step 6: 创建 rmfood 数据库 + 验证"""
import asyncio
import asyncpg

async def main():
    # 连接到默认 postgres 数据库
    conn = await asyncpg.connect('postgresql://postgres@localhost:5432/postgres')
    print(f"✅ 已连接到 PostgreSQL {conn.get_server_version()}")

    # 检查 rmfood 是否存在
    rows = await conn.fetch(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        'rmfood'
    )

    if rows:
        print("✅ 数据库 'rmfood' 已存在")
    else:
        print("⏳ 创建数据库 'rmfood' ...")
        await conn.execute("CREATE DATABASE rmfood ENCODING 'UTF8'")
        print("✅ 数据库 'rmfood' 创建成功")

    # 列出所有数据库
    dbs = await conn.fetch("SELECT datname, pg_size_pretty(pg_database_size(datname)) as size FROM pg_database WHERE datistemplate = false ORDER BY datname")
    print("\n📋 当前数据库列表:")
    for db in dbs:
        marker = " ← 目标" if db['datname'] == 'rmfood' else ""
        print(f"   - {db['datname']:20s} ({db['size']}){marker}")

    await conn.close()
    print("\n✅ 全部完成!")

if __name__ == '__main__':
    asyncio.run(main())

"""完整诊断：organizations API 失败原因"""
import sys, asyncio
sys.path.insert(0, '.')
import asyncpg

DB = 'postgresql://postgres:password@localhost:5432/rmfood'


async def main():
    conn = await asyncpg.connect(DB)

    # 1. organization_members 实际列名
    r = await conn.fetch("SELECT column_name FROM information_schema.columns WHERE table_name = 'organization_members' ORDER BY ordinal_position")
    cols = [c['column_name'] for c in r]
    print(f"organization_members 列: {cols}")

    # 2. 尝试执行 organizations 端点的实际查询
    # 先找 admin 用户 ID
    r2 = await conn.fetch("SELECT id, username FROM users WHERE username = $1", 'admin')
    if not r2:
        print("admin 用户不存在！")
        await conn.close()
        return
    admin_id = r2[0]['id']
    print(f"admin id={admin_id}")

    # 3. 测试端点 SQL（使用正确的列名）
    # 原 SQL 用的是 m.role 和 m.joined_at
    test_sql = f"""SELECT o.id, o.name, o.slug, o.description, o.logo_url, o.plan,
                     o.owner_id, o.is_active, o.created_at,
                     m.role as member_role
              FROM organizations o
              JOIN organization_members m ON o.id = m.organization_id
              WHERE m.user_id = {admin_id} AND o.is_active = TRUE
              ORDER BY m.joined_at DESC"""

    try:
        r3 = await conn.fetch(test_sql)
        print(f"\n组织查询成功 ({len(r3)} 条):")
        for org in r3:
            print(f"  id={org['id']} name={org['name']} role={org['member_role']}")
    except Exception as e:
        print(f"\n组织查询失败: {type(e).__name__}: {e}")

    # 4. 检查公式状态 enum 问题
    print("\n--- formulastatus 问题 ---")
    # 检查是否有代码在使用 ::formulastatus cast
    r4 = await conn.fetch("SELECT typname FROM pg_type WHERE typname = 'formulastatus'")
    print(f"formulastatus 枚举存在: {bool(r4)}")

    # 检查 formulas.status 实际类型
    r5 = await conn.fetch("SELECT data_type, udt_name FROM information_schema.columns WHERE table_name = 'formulas' AND column_name = 'status'")
    for row in r5:
        print(f"formulas.status: data_type={row['data_type']} udt_name={row['udt_name']}")

    # 5. 尝试用 SQLAlchemy 查询 formulas
    from sqlalchemy import text
    from app.core.database.session import get_engine
    engine = get_engine()
    async with engine.connect() as s:
        try:
            r6 = await s.execute(text("SELECT id, name, status FROM formulas LIMIT 3"))
            rows = r6.fetchall()
            print(f"\nSQLAlchemy formulas 查询 OK: {len(rows)} 条")
            for row in rows:
                print(f"  id={row[0]} name={row[1]} status={row[2]}")
        except Exception as e:
            print(f"\nSQLAlchemy formulas 查询失败: {type(e).__name__}: {str(e)[:200]}")

    # 6. 检查连接池
    r7 = await conn.fetch("SELECT count(*) as total, state FROM pg_stat_activity WHERE datname = current_database() GROUP BY state")
    print(f"\nDB 连接池: {[(row['state'], row['total']) for row in r7]}")

    await conn.close()

asyncio.run(main())

"""检查 PostgreSQL 中的用户表"""
import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres@localhost:5432/rmfood_platform')
    rows = await conn.fetch('SELECT id, username, email, is_active, role FROM users')
    print(f'Users count: {len(rows)}')
    if rows:
        for r in rows:
            print(f'  id={r["id"]} user={r["username"]} role={r["role"]} active={r["is_active"]}')
    else:
        print('  ⚠️ 用户表为空! 需要创建管理员账号')
    
    # 检查是否有 admin
    count = await conn.fetchval("SELECT COUNT(*) FROM users WHERE username='admin'")
    print(f'\nAdmin 用户存在: {"是" if count > 0 else "否"} ({count} 条)')
    
    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())

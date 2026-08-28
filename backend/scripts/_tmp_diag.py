"""诊断 test_external 账户状态 + 检查是否还有遗漏用户"""
import sys, asyncio, datetime
sys.path.insert(0, '.')
import asyncpg
from app.utils.auth import get_password_hash, verify_password


DB = 'postgresql://postgres@localhost:5432/rmfood_platform'


async def main():
    conn = await asyncpg.connect(DB)

    # 1. 列出所有用户（含完整字段）
    rows = await conn.fetch("""
        SELECT id, username, email, role, is_active,
               login_attempts, locked_until, created_at, updated_at
        FROM users ORDER BY id
    """)
    print(f'数据库用户总数: {len(rows)}')
    for r in rows:
        locked = f'LOCKED({r["locked_until"]})' if r['locked_until'] else '正常'
        print(f'  {r["id"]:3d}  {r["username"]:<20s}  role={r["role"]:<10s}  active={r["is_active"]}  attempts={r["login_attempts"]}  {locked}')

    # 2. 检查 test_external 密码是否正确
    if rows:
        te = next((r for r in rows if r['username'] == 'test_external'), None)
        if te:
            expected_hash = get_password_hash('TestPass123!')
            actual_hash = await conn.fetchval('SELECT hashed_password FROM users WHERE username = $1', 'test_external')
            match = expected_hash == actual_hash
            print(f'\ntest_external 密码验证:')
            print(f'  期望哈希前20位: {expected_hash[:20]}...')
            print(f'  实际哈希前20位: {actual_hash[:20]}...')
            print(f'  哈希匹配: {"是" if match else "否"}')

            # 尝试 verify_password
            verified = await conn.fetchval('SELECT hashed_password FROM users WHERE username = $1', 'test_external')
            result = verify_password('TestPass123!', verified)
            print(f'  verify_password("TestPass123!"): {result}')

    # 3. 检查 admin 的哈希
    admin = next((r for r in rows if r['username'] == 'admin'), None)
    if admin:
        admin_hash = await conn.fetchval('SELECT hashed_password FROM users WHERE username = $1', 'admin')
        admin_verified = verify_password('admin123', admin_hash)
        print(f'\nadmin 密码验证: {admin_verified}')

    # 4. 检查是否有其他登录相关表
    tables = await conn.fetch("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND (table_name LIKE '%login%' OR table_name LIKE '%session%'
               OR table_name LIKE '%token%' OR table_name LIKE '%audit%')
        ORDER BY table_name
    """)
    print(f'\n登录/会话相关表: {[t["table_name"] for t in tables]}')

    # 5. 检查 userroles 枚举
    roles = await conn.fetch("SELECT unnest(enum_range(NULL::userrole)) AS role")
    print(f'\n有效角色枚举: {[r["role"] for r in roles]}')

    await conn.close()

asyncio.run(main())

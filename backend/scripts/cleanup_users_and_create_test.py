"""清除非 admin 用户，并创建外部测试账户（自动处理所有外键）"""
import sys, asyncio, datetime
sys.path.insert(0, '.')
import asyncpg
from app.utils.auth import get_password_hash
from scripts.db_utils import get_asyncpg_dsn


DB = get_asyncpg_dsn()
KEEP = {'admin'}
TEST_USERS = [
    {'username': 'test_external', 'email': 'test.external@rmfood.com', 'password': 'TestPass123!', 'role': 'GUEST'},
]


async def main():
    conn = await asyncpg.connect(DB)

    try:
        # 1. 查看所有用户
        rows = await conn.fetch('SELECT id, username, email, role, is_active FROM users ORDER BY id')
        print(f'当前用户 ({len(rows)} 人):')
        for r in rows:
            mark = '[保留]' if r['username'] in KEEP else '[删除]'
            print(f'  {r["id"]:3d}  {r["username"]:<20s}  role={r["role"]:<10s}  active={r["is_active"]}  {mark}')

        to_delete_ids = [r['id'] for r in rows if r['username'] not in KEEP]
        admin_id = next(r['id'] for r in rows if r['username'] in KEEP)

        if to_delete_ids:
            # 2. 查询所有引用 users.id 的外键（排除 users 自身，去重）
            fks = await conn.fetch("""
                SELECT DISTINCT ON (c.conrelid, a.attname)
                       c.conrelid::regclass::text AS table_name,
                       a.attname AS column_name
                FROM pg_constraint c
                JOIN pg_class     t ON t.oid = c.conrelid
                JOIN pg_class     r ON r.oid = c.confrelid
                JOIN pg_attribute a ON a.attrelid = c.conrelid
                                   AND a.attnum = ANY(c.conkey)
                WHERE c.contype = 'f'
                  AND r.relname = 'users'
                  AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  AND r.relname <> t.relname
                ORDER BY c.conrelid, a.attname
            """)
            fk_list = [(r['table_name'], r['column_name']) for r in fks]
            print(f'  [外键约束] {len(fk_list)} 个表-列组合')

            # 3. 在事务内迁移各表中的外键引用到 admin
            async with conn.transaction():
                for table, col in fk_list:
                    for uid in to_delete_ids:
                        try:
                            cnt = await conn.fetchval(f'SELECT COUNT(*) FROM {table} WHERE {col} = $1', uid)
                        except asyncpg.UndefinedColumnError:
                            print(f'  [跳过] {table}.{col} 列不存在')
                            continue
                        if cnt:
                            await conn.execute(
                                f'UPDATE {table} SET {col} = $1 WHERE {col} = $2', admin_id, uid)
                            print(f'  [迁移{table}.{col}] {cnt} 条 -> admin')

                # 4. 删除用户
                for uid in to_delete_ids:
                    await conn.execute('DELETE FROM users WHERE id = $1', uid)
                    print(f'  [已删除] id={uid}')
        else:
            print('\n无需删除任何账户')

        # 5. 创建测试账户
        for acct in TEST_USERS:
            exists = await conn.fetchval('SELECT id FROM users WHERE username = $1', acct['username'])
            if exists:
                print(f'  [跳过] {acct["username"]} 已存在 (id={exists})')
                continue
            ph = get_password_hash(acct['password'])
            now = datetime.datetime.now()
            async with conn.transaction():
                await conn.execute(
                    'INSERT INTO users (username, email, hashed_password, role, is_active, login_attempts, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
                    acct['username'], acct['email'], ph, acct['role'], True, 0, now, now)
            print(f'  [已创建] {acct["username"]} / {acct["password"]}  role={acct["role"]}')

        # 6. 最终结果
        final = await conn.fetch('SELECT id, username, email, role, is_active FROM users ORDER BY id')
        print(f'\n{"="*60}')
        print(f'最终用户 ({len(final)} 人):')
        for r in final:
            print(f'  {r["id"]:3d}  {r["username"]:<20s}  role={r["role"]:<10s}  active={r["is_active"]}')
        print(f"{'='*60}")

    finally:
        await conn.close()

asyncio.run(main())

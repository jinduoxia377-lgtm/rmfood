"""重置管理员密码为 admin123 — 使用后端自身的安全模块"""
import asyncio
import asyncpg
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app.utils.auth import get_password_hash

async def main():
    new_hash = get_password_hash('admin123')
    print(f"新哈希: {new_hash[:40]}...")
    
    conn = await asyncpg.connect('postgresql://postgres@localhost:5432/rmfood_platform')
    
    await conn.execute(
        "UPDATE users SET hashed_password=$1, login_attempts=0, locked_until=NULL WHERE username='admin'",
        new_hash,
    )
    
    row = await conn.fetchrow("SELECT username, login_attempts FROM users WHERE username='admin'")
    print(f"[OK] Password reset: user={row['username']}, attempts={row['login_attempts']}")

    await conn.close()
    print("\n[OK] Now you can login with admin / admin123")

if __name__ == '__main__':
    asyncio.run(main())

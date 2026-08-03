"""创建管理员账户"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import text
from app.core.database.session import get_engine
from app.utils.auth import get_password_hash


async def create_admin():
    engine = get_engine()

    async with engine.connect() as conn:
        # Check if admin exists
        result = await conn.execute(text("SELECT id FROM users WHERE username = 'admin'"))
        admin = result.fetchone()

        if admin:
            print(f"Admin user already exists (ID: {admin[0]})")
            return

        # Create admin user
        password_hash = get_password_hash('admin123')
        await conn.execute(text("""
            INSERT INTO users (username, email, hashed_password, role, is_active)
            VALUES (:username, :email, :hashed_password, :role, :is_active)
        """), {
            'username': 'admin',
            'email': 'admin@rmfood.com',
            'hashed_password': password_hash,
            'role': 'admin',
            'is_active': True
        })
        await conn.commit()
        print("[OK] Admin user created: admin / admin123")


if __name__ == '__main__':
    asyncio.run(create_admin())

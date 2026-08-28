import asyncio
from app.core.database.session import async_session_factory
from app.models.user_model import User
from sqlalchemy import select

async def main():
    async with async_session_factory() as db:
        r = await db.execute(select(User).where(User.username == 'admin'))
        u = r.scalar_one_or_none()
        if u:
            print(f"Before: locked_until={u.locked_until}, attempts={u.login_attempts}")
            u.login_attempts = 0
            u.locked_until = None
            await db.commit()
            print("Admin account unlocked")
        else:
            print("User not found")

asyncio.run(main())

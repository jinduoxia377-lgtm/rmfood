"""Test organizations endpoint directly"""
import sys, asyncio, traceback
sys.path.insert(0, '.')

from fastapi import Depends
from sqlalchemy import select, text
from app.core.database.session import get_engine
from app.models.user_model import User
from app.utils.auth import decode_token

TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sZSI6IkFETUlOIiwiZXhwIjoxNzg3OTE1MzcwLCJpYXQiOjE3ODc5MTE3NzAsImlzcyI6InJtZm9vZCIsImF1ZCI6InJtZm9vZC1hcGkiLCJ0eXBlIjoiYWNjZXNzIiwianRpIjoiZDViODQ0MGQtYmI1ZS00YWEwLWE2ZDEtZjJhY2Y1ZDYwNTkwIn0.QFF06PjVJHHDmaFb3PQLVKgX5KxNRKxeXJwTebLOUIo'


async def main():
    engine = get_engine()

    # Step 1: Decode token
    payload = decode_token(TOKEN)
    user_id = int(payload['sub'])
    print(f"User ID: {user_id}")

    # Step 2: Load user from DB (like get_current_user does)
    async with engine.connect() as s:
        r = await s.execute(select(User).where(User.id == user_id))
        user = r.scalar_one_or_none()
        if not user:
            print("User not found!")
            return
        print(f"User: {user.username} role={user.role}")

        # Step 3: Execute the exact query from organizations.py
        try:
            result = await s.execute(text("""
                SELECT o.*, m.role as member_role
                FROM organizations o
                JOIN organization_members m ON o.id = m.organization_id
                WHERE m.user_id = :user_id AND o.is_active = TRUE
                ORDER BY m.joined_at DESC
            """), {"user_id": user_id})
            rows = result.fetchall()
            print(f"Query OK: {len(rows)} rows")
            for row in rows:
                print(f"  id={row['id']} name={row['name']} role={row['member_role']}")
        except Exception as e:
            print(f"Query FAILED: {type(e).__name__}: {e}")
            traceback.print_exc()

        # Step 4: Also test with positional params
        try:
            result2 = await s.execute(text("""
                SELECT o.*, m.role as member_role
                FROM organizations o
                JOIN organization_members m ON o.id = m.organization_id
                WHERE m.user_id = $1 AND o.is_active = TRUE
                ORDER BY m.joined_at DESC
            """), (user_id,))
            rows2 = result2.fetchall()
            print(f"Positional query OK: {len(rows2)} rows")
        except Exception as e:
            print(f"Positional query FAILED: {type(e).__name__}: {e}")


asyncio.run(main())

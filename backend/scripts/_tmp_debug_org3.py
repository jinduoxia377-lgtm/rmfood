"""直接调用 endpoint 函数捕获异常"""
import sys, asyncio, traceback
sys.path.insert(0, '.')
from fastapi import Depends
from app.api.organizations import list_my_organizations
from app.api.deps import get_current_user, get_db_session
from app.core.database.session import get_engine
from sqlalchemy import select
from app.models.user_model import User
from app.utils.auth import decode_token

TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sZSI6IkFETUlOIiwiZXhwIjoxNzg3OTE1MzcwLCJpYXQiOjE3ODc5MTE3NzAsImlzcyI6InJtZm9vZCIsImF1ZCI6InJtZm9vZC1hcGkiLCJ0eXBlIjoiYWNjZXNzIiwianRpIjoiZDViODQ0MGQtYmI1ZS00YWEwLWE2ZDEtZjJhY2Y1ZDYwNTkwIn0.QFF06PjVJHHDmaFb3PQLVKgX5KxNRKxeXJwTebLOUIo'


async def main():
    engine = get_engine()
    
    # Decode token to get user_id
    payload = decode_token(TOKEN)
    user_id = int(payload['sub'])
    print(f"User ID from token: {user_id}")
    
    # Get a DB session like the endpoint would
    session_gen = get_db_session()
    async for db in session_gen:
        print(f"Got DB session: {type(db)}")
        
        # Load user
        r = await db.execute(select(User).where(User.id == user_id))
        user = r.scalar_one_or_none()
        if not user:
            print("User not found!")
            break
        print(f"User: {user.username} role={user.role}")
        
        # Now call the endpoint logic directly
        try:
            result = await db.execute("""
                SELECT o.*, m.role as member_role
                FROM organizations o
                JOIN organization_members m ON o.id = m.organization_id
                WHERE m.user_id = :user_id AND o.is_active = TRUE
                ORDER BY m.joined_at DESC
            """, {"user_id": user.id})
            
            rows = result.fetchall()
            print(f"Query OK: {len(rows)} rows")
            
            organizations = []
            for row in rows:
                organizations.append({
                    "id": row.id,
                    "name": row.name,
                    "slug": row.slug,
                    "description": row.description,
                    "logo_url": row.logo_url,
                    "plan": row.plan,
                    "member_role": row.member_role,
                    "owner_id": row.owner_id,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                })
            print(f"Build OK: {len(organizations)} orgs")
            
        except Exception as e:
            print(f"Endpoint logic FAILED: {type(e).__name__}: {e}")
            traceback.print_exc()
            break
    
    await session_gen.aclose()


asyncio.run(main())

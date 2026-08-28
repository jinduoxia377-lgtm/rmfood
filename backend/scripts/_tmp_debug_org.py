"""调试 organizations API 503 问题"""
import sys, asyncio, traceback
sys.path.insert(0, '.')
import asyncpg
from sqlalchemy import text, select
from app.core.database.session import get_engine
from app.models.user_model import User
from app.utils.auth import decode_token

TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sZSI6IkFETUlOIiwiZXhwIjoxNzg3OTEzMDAwLCJpYXQiOjE3ODc5MDk0MDAsImlzcyI6InJtZm9vZCIsImF1ZCI6InJtZm9vZC1hcGkiLCJ0eXBlIjoiYWNjZXNzIiwianRpIjoiMmI2OWUzMDQtMDFjNS00OWFmLThlMTMtZWJhYjBiZjg2YjFiIn0.XU4cgjhSsgL_LoY7PlH30NN6L7ceefMQUQEXDdPlDjI'


async def main():
    # 1. 解码 token
    try:
        payload = decode_token(TOKEN)
        print(f'Token OK: sub={payload.get("sub")} role={payload.get("role")}')
        user_id = int(payload['sub'])
    except Exception as e:
        print(f'Token decode failed: {type(e).__name__}: {e}')
        return

    # 2. 通过 SQLAlchemy 加载用户
    engine = get_engine()
    async with engine.connect() as s:
        try:
            r = await s.execute(select(User).where(User.id == user_id))
            user = r.scalar_one_or_none()
            if user:
                print(f'User loaded: id={user.id} username={user.username} role={user.role}')
            else:
                print('User NOT found!')
        except Exception as e:
            print(f'User query failed: {type(e).__name__}: {str(e)[:200]}')
            traceback.print_exc()

        # 3. 执行 organizations 查询
        try:
            r2 = await s.execute(text('''
                SELECT o.id, o.name, o.slug, o.description, o.logo_url, o.plan,
                       o.owner_id, o.is_active, o.created_at,
                       m.role as member_role
                FROM organizations o
                JOIN organization_members m ON o.id = m.organization_id
                WHERE m.user_id = :user_id AND o.is_active = TRUE
                ORDER BY m.joined_at DESC
            '''), {'user_id': user_id})
            rows = r2.fetchall()
            print(f'Organizations query OK: {len(rows)} rows')
            for row in rows:
                print(f'  id={row[0]} name={row[1]} role={row[9]}')
        except Exception as e:
            print(f'Org query failed: {type(e).__name__}: {str(e)[:300]}')
            traceback.print_exc()

asyncio.run(main())

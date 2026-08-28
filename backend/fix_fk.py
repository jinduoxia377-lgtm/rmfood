import sys, asyncio
sys.stdout.reconfigure(encoding='utf-8')

from app.core.database import async_session_factory
from sqlalchemy import text

async def test():
    async with async_session_factory() as db:
        # Test raw SQL case 12
        r = await db.execute(text('SELECT id, title, formula_id, bookmarks FROM formula_cases WHERE id = 12'))
        row = r.fetchone()
        print(f'case 12 raw: id={row[0]}, title={row[1][:40]}, formula_id={row[2]}, bookmarks={row[3]}')

        # Try ORM with explicit org_id fix
        from app.models.organization import OrganizationMember
        print(f'OrganizationMember columns: {[c.key for c in OrganizationMember.__mapper__.columns]}')

asyncio.run(test())

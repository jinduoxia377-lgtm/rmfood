import sys, asyncio, re
sys.stdout.reconfigure(encoding='utf-8')

# Fix 1: Wrong revision ID in 20260811 migration
path = r'D:\RMFOODFP\backend\alembic\versions\20260811_000000_add_workflow_templates.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
old_rev = "revision: str = '20260811_000000_add_workflow_templates'"
new_rev = "revision: str = '20260811_000000'"
if old_rev in content:
    content = content.replace(old_rev, new_rev)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed: 20260811 revision ID')
else:
    print('20260811 revision already correct or not found')

# Fix 2: Also check 20260816 revision ID format
path2 = r'D:\RMFOODFP\backend\alembic\versions\20260816_000000_add_formula_cases.py'
with open(path2, 'r', encoding='utf-8') as f:
    c2 = f.read()
# down_revision should be '20260811_000000' (already fixed above)
if "down_revision = '20260811_000000'" in c2:
    print('20260816 down_revision OK')
else:
    print('20260816 down_revision needs fix')

# Check DB state
from app.core.database import async_session_factory
from sqlalchemy import text

async def check():
    async with async_session_factory() as db:
        r = await db.execute(text('SELECT version_num FROM alembic_version'))
        row = r.fetchone()
        print(f'Current DB alembic: {row[0] if row else "EMPTY"}')

        r2 = await db.execute(text('SELECT COUNT(*) FROM formula_cases'))
        count = r2.scalar()
        print(f'formula_cases count: {count}')

        r3 = await db.execute(text('SELECT id, title FROM formula_cases ORDER BY id LIMIT 20'))
        for row in r3.fetchall():
            print(f'  case {row[0]}: {str(row[1])[:60]}')

        # Check missing columns/tables
        r4 = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'formula_cases'"))
        cols = [row[0] for row in r4.fetchall()]
        print(f'formula_cases columns: {cols}')

asyncio.run(check())

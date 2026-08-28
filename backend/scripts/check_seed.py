# -*- coding: utf-8 -*-
"""Check seeded data and verify"""
import asyncio, sys
sys.path.insert(0, 'D:/RMFOODFP/backend')
from app.core.database.session import get_session_factory
from sqlalchemy import text

async def main():
    Session = get_session_factory()
    async with Session() as db:
        tables = ['formulas','formula_cases','experiments','organizations',
                  'term_categories','terms','comments','notifications']
        for t in tables:
            try:
                r = await db.execute(text(f'SELECT COUNT(*) FROM "{t}"'))
                cnt = r.scalar_one()
                print(f'  {t}: {cnt}')
            except Exception as e:
                print(f'  {t}: ERROR - {str(e)[:50]}')

asyncio.run(main())

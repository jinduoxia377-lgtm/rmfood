import asyncio
from sqlalchemy import text
from app.core.database.session import async_engine

async def check():
    async with async_engine.connect() as conn:
        tables = await conn.execute(text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name LIKE 'term%'"
        ))
        for row in tables:
            print(row[0])

        for tbl in ['term_statistics', 'term_categories', 'terms', 'term_variants', 'term_normalization_rules']:
            try:
                cols = await conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{tbl}'"))
                for row in cols:
                    print(f'  {tbl}: {row[0]}')
            except Exception as e:
                print(f'{tbl} error: {e}')

        try:
            count = await conn.execute(text('SELECT COUNT(*) FROM term_categories'))
            print(f'term_categories count: {count.scalar()}')
        except Exception as e:
            print(f'term_categories error: {e}')

        try:
            count = await conn.execute(text('SELECT COUNT(*) FROM terms'))
            print(f'terms count: {count.scalar()}')
        except Exception as e:
            print(f'terms error: {e}')

asyncio.run(check())

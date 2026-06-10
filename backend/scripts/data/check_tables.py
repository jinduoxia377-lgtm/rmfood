"""检查数据库表结构和数据量"""
import asyncio
from sqlalchemy import text
from app.core.session import async_session_factory

async def check():
    async with async_session_factory() as s:
        tables = [
            'kg_nodes', 'kg_edges',
            'tcm_herbs',
            'tcm_compounds',
            'tcm_herb_compounds',
            'tcm_targets',
            'tcm_compound_targets',
        ]
        for t in tables:
            try:
                r = await s.execute(text(f'SELECT COUNT(*) FROM {t}'))
                print(f'  {t}: {r.scalar()} rows')
            except Exception as e:
                print(f'  {t}: NOT FOUND ({e})')

        # 检查tcm_herbs的compounds字段结构
        print('\n--- tcm_herbs.compounds sample ---')
        r = await s.execute(text("""
            SELECT name_cn, json_array_length(compounds) as cc
            FROM tcm_herbs WHERE compounds IS NOT NULL AND json_array_length(compounds) > 0
            ORDER BY json_array_length(compounds) DESC LIMIT 3
        """))
        for row in r.all():
            print(f'  {row[0]}: {row[1]} compounds')

asyncio.run(check())

"""检查kg_nodes表约束+执行图谱构建"""
import asyncio
from sqlalchemy import text
from app.core.session import async_session_factory

async def main():
    async with async_session_factory() as s:
        # 检查唯一约束
        r = await s.execute(text("""
            SELECT conname, pg_get_constraintdef(oid)
            FROM pg_constraint WHERE conrelid = 'kg_nodes'::regclass
        """))
        constraints = r.fetchall()
        print('=== kg_nodes constraints ===')
        for c in constraints:
            print(f'  {c[0]}: {c[1]}')

        # 检查kg_edges约束
        r = await s.execute(text("""
            SELECT conname, pg_get_constraintdef(oid)
            FROM pg_constraint WHERE conrelid = 'kg_edges'::regclass
        """))
        constraints = r.fetchall()
        print('\n=== kg_edges constraints ===')
        for c in constraints:
            print(f'  {c[0]}: {c[1]}')

asyncio.run(main())

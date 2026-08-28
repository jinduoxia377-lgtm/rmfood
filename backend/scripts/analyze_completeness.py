# -*- coding: utf-8 -*-
"""深度分析项目完整性"""
import sys, asyncio, json
sys.path.insert(0, '.')
from app.core.database.session import get_session_factory
from sqlalchemy import text

async def main():
    Session = get_session_factory()
    async with Session() as db:
        # 1. 数据库表
        r = await db.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"))
        tables = [row[0] for row in r.fetchall()]
        print("=== 数据库表 ===")
        for t in tables:
            rc = await db.execute(text(f"SELECT COUNT(*) FROM {t}"))
            cnt = rc.scalar_one()
            print(f"  {t}: {cnt} 条")

        # 2. 各表字段数
        print("\n=== 关键字段检查 ===")
        for table in ['formulas', 'formula_cases', 'experiments', 'comments', 'users', 'organizations']:
            if table in tables:
                rc = await db.execute(text(f"SELECT COUNT(*) FROM {table}"))
                cnt = rc.scalar_one()
                rc2 = await db.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name='{table}' ORDER BY ordinal_position"))
                cols = [row[0] for row in rc2.fetchall()]
                print(f"  {table}: {cnt}条, {len(cols)}列 [{', '.join(cols[:8])}{'...' if len(cols)>8 else ''}]")

asyncio.run(main())

# -*- coding: utf-8 -*-
"""深度分析项目完整性，输出详细报告"""
import sys, asyncio, json
sys.path.insert(0, '.')
from app.core.database.session import get_session_factory
from sqlalchemy import text

async def main():
    Session = get_session_factory()
    async with Session() as db:
        # DB stats
        tables_info = {}
        for table in ['formulas', 'formula_cases', 'experiments', 'comments', 'users', 'organizations', 'experiments', 'activity_logs', 'versions']:
            try:
                rc = await db.execute(text(f"SELECT COUNT(*) FROM {table}"))
                cnt = rc.scalar_one()
                rc2 = await db.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name='{table}' ORDER BY ordinal_position"))
                cols = [row[0] for row in rc2.fetchall()]
                tables_info[table] = {'count': cnt, 'columns': cols}
            except Exception as e:
                tables_info[table] = {'count': 0, 'columns': [], 'error': str(e)}
        
        print(json.dumps(tables_info, ensure_ascii=False, indent=2))

asyncio.run(main())

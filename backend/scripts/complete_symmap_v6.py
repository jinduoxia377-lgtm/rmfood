"""
SymMap 终极补全 v6 — 通过 MMID 数据库批量补全 name_eng
"""
import asyncio, sys, os
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

async def complete_via_mmid():
    engine = create_async_engine(settings.database.url, echo=False, pool_pre_ping=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    stats = {'name_eng': 0, 'alias': 0, 'use_part': 0}

    async with async_session() as session:
        # 1. 通过 MMID 补全 name_eng
        print("[1/2] 通过 MMID 补全 name_eng...")
        r = await session.execute(text("""
            UPDATE symmap_herbs s
            SET name_eng = m.name_eng
            FROM mmid_herbs m
            WHERE s.name_cn = m.name_cn
              AND (s.name_eng IS NULL OR s.name_eng = '')
              AND m.name_eng IS NOT NULL AND m.name_eng <> ''
        """))
        stats['name_eng'] = r.rowcount
        print(f"  补全: {stats['name_eng']} 味")

        # 2. 通过 MMID 补全 alias（MMID 的 notes 字段可能有别名信息）
        print("[2/2] 检查 MMID notes 字段...")
        r = await session.execute(text("""
            SELECT name_cn, notes FROM mmid_herbs
            WHERE notes IS NOT NULL AND notes <> ''
            LIMIT 10
        """))
        rows = r.fetchall()
        for row in rows:
            print(f"  {row[0]}: notes={str(row[1])[:60]}")

        await session.commit()

    await engine.dispose()
    print(f"\nname_eng 补全: {stats['name_eng']}")


if __name__ == "__main__":
    asyncio.run(complete_via_mmid())

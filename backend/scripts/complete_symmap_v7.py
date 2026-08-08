"""
SymMap 终极补全 v7 — 通过拉丁名匹配 MMID 补全 name_eng
"""
import asyncio, sys, os
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

async def complete_via_latin():
    engine = create_async_engine(settings.database.url, echo=False, pool_pre_ping=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    stats = {'name_eng': 0}

    async with async_session() as session:
        print("通过拉丁名匹配 MMID 补全 name_eng...")

        # 用拉丁名前缀匹配
        r = await session.execute(text("""
            WITH matches AS (
                SELECT s.symmap_id, m.name_eng
                FROM symmap_herbs s
                CROSS JOIN mmid_herbs m
                WHERE s.name_latin IS NOT NULL AND s.name_latin <> ''
                  AND m.name_latin IS NOT NULL AND m.name_latin <> ''
                  AND (s.name_eng IS NULL OR s.name_eng = '')
                  AND m.name_eng IS NOT NULL AND m.name_eng <> ''
                  AND (
                      LOWER(s.name_latin) LIKE LOWER(m.name_latin) || '%'
                      OR LOWER(m.name_latin) LIKE LOWER(s.name_latin) || '%'
                      OR LOWER(s.name_latin) = LOWER(m.name_latin)
                  )
            )
            UPDATE symmap_herbs s
            SET name_eng = m.name_eng
            FROM matches m
            WHERE s.symmap_id = m.symmap_id
              AND s.name_eng IS NULL OR s.name_eng = ''
        """))
        # 上面的 CTE UPDATE 在 PG 中不支持，改用逐条更新
        r = await session.execute(text("""
            SELECT s.symmap_id, m.name_eng
            FROM symmap_herbs s
            JOIN mmid_herbs m ON (
                s.name_latin IS NOT NULL AND s.name_latin <> ''
                AND m.name_latin IS NOT NULL AND m.name_latin <> ''
                AND (s.name_eng IS NULL OR s.name_eng = '')
                AND (m.name_eng IS NOT NULL AND m.name_eng <> '')
                AND (
                    LOWER(s.name_latin) LIKE LOWER(m.name_latin) || '%'
                    OR LOWER(m.name_latin) LIKE LOWER(s.name_latin) || '%'
                    OR LOWER(s.name_latin) = LOWER(m.name_latin)
                )
            )
            LIMIT 200
        """))
        rows = r.fetchall()
        print(f"  找到 {len(rows)} 个匹配")

        seen = set()
        for sid, eng in rows:
            if sid not in seen:
                await session.execute(
                    text("UPDATE symmap_herbs SET name_eng = :eng WHERE symmap_id = :id"),
                    {'eng': eng, 'id': sid}
                )
                seen.add(sid)
                stats['name_eng'] += 1

        await session.commit()

    await engine.dispose()
    print(f"  成功补全: {stats['name_eng']}")


if __name__ == "__main__":
    asyncio.run(complete_via_latin())

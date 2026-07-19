"""
SymMap 终极补全 v9 — 逐条匹配 MMID 补全 name_eng
"""
import asyncio, sys, os
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

async def complete():
    engine = create_async_engine(settings.database.url, echo=False, pool_pre_ping=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    stats = {'name_eng': 0}

    async with async_session() as session:
        print("通过拉丁名匹配 MMID 补全 name_eng...")

        # 获取所有需要补全的 SymMap 药材
        r = await session.execute(text("""
            SELECT symmap_id, name_latin
            FROM symmap_herbs
            WHERE (name_eng IS NULL OR name_eng = '')
              AND name_latin IS NOT NULL AND name_latin <> ''
        """))
        symmap_herbs = r.fetchall()
        print(f"  需要补全: {len(symmap_herbs)} 味")

        # 获取所有有 name_eng 的 MMID 药材
        r = await session.execute(text("""
            SELECT name_latin, name_eng
            FROM mmid_herbs
            WHERE name_eng IS NOT NULL AND name_eng <> ''
        """))
        mmid_herbs = r.fetchall()
        mmid_map = [(row[0].lower(), row[1]) for row in mmid_herbs]
        print(f"  MMID 参考: {len(mmid_map)} 味")

        updated = 0
        for sid, name_latin in symmap_herbs:
            latin_lower = name_latin.lower()
            for mmid_latin, eng in mmid_map:
                # 双向包含匹配
                if mmid_latin in latin_lower or latin_lower in mmid_latin:
                    await session.execute(
                        text("UPDATE symmap_herbs SET name_eng = :eng WHERE symmap_id = :id"),
                        {'eng': eng, 'id': sid}
                    )
                    updated += 1
                    break
        stats['name_eng'] = updated
        print(f"  补全: {stats['name_eng']} 味")

        await session.commit()

    await engine.dispose()
    print(f"\nname_eng 补全: {stats['name_eng']}")


if __name__ == "__main__":
    asyncio.run(complete())

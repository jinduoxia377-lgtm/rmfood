"""
SymMap 数据补全 v11 — 从官网爬取 Function(功效) 字段
"""
import asyncio, sys, os, re, time, urllib.request
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings


async def scrape_functions():
    engine = create_async_engine(settings.database.url, echo=False, pool_pre_ping=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    stats = {'functions': 0}

    async with async_session() as session:
        r = await session.execute(text("""
            SELECT symmap_id, name_cn FROM symmap_herbs ORDER BY symmap_id
        """))
        herbs = r.fetchall()
        total = len(herbs)
        print(f"开始爬取 {total} 味药材的 Function 字段...")

        updated = 0
        for i, (sid, name_cn) in enumerate(herbs):
            symmap_id = f"SMHB{sid:05d}"
            try:
                req = urllib.request.Request(f"http://www.symmap.org/detail/{symmap_id}")
                req.add_header('User-Agent', 'Mozilla/5.0')
                with urllib.request.urlopen(req, timeout=15) as resp:
                    html = resp.read().decode('utf-8', errors='ignore')

                m = re.search(r'<b>Function</b>.*?<td[^>]*>(.*?)</td>', html, re.DOTALL)
                if m:
                    func_raw = m.group(1).strip()
                    func_raw = re.sub(r'<[^>]+>', ' ', func_raw)
                    func_raw = re.sub(r'\s+', ' ', func_raw).strip()

                    parts = func_raw.split(';')
                    en_parts = [p.strip() for p in parts if re.search(r'[a-zA-Z]', p) and not re.search(r'^[一-鿿]', p)]
                    cn_parts = [p.strip() for p in parts if re.search(r'[一-鿿]', p)]

                    func_en = '; '.join(en_parts).strip() if en_parts else ''
                    func_cn = '; '.join(cn_parts).strip() if cn_parts else ''

                    if func_cn or func_en:
                        # 检查数据库是否有 function_cn 字段
                        try:
                            await session.execute(
                                text("ALTER TABLE symmap_herbs ADD COLUMN IF NOT EXISTS function_cn TEXT"),
                            )
                            await session.execute(
                                text("ALTER TABLE symmap_herbs ADD COLUMN IF NOT EXISTS function_en TEXT"),
                            )
                            await session.commit()

                            await session.execute(
                                text("UPDATE symmap_herbs SET function_cn = :fcn, function_en = :fen WHERE symmap_id = :id"),
                                {'fcn': func_cn or None, 'fen': func_en or None, 'id': sid}
                            )
                            await session.commit()
                            updated += 1
                        except Exception as e:
                            print(f"  DB error: {e}")

            except Exception as e:
                pass

            if (i + 1) % 100 == 0:
                print(f"  进度: {i+1}/{total}, 已更新: {updated}")

        print(f"\n完成！成功提取 Function: {updated} 味")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(scrape_functions())

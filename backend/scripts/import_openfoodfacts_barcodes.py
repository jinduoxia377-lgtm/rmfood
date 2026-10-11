# -*- coding: utf-8 -*-
"""基于条码导入 OFF 产品（修正返回值用法）"""
import sys, os, asyncio, logging, time
sys.path.insert(0, r"D:\RMFOODFP\backend"); os.chdir(r"D:\RMFOODFP\backend")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
logging.basicConfig(level=logging.ERROR)
from app.services.openfoodfacts.client import OFFClient
from app.services.openfoodfacts.mapper import OFFMapper
from app.services.openfoodfacts.loader import OFFLoader
from app.core.database.session import async_session_factory

BARCODES = ["3017620422003", "7622210449283", "3017624010701"]

async def main():
    client = OFFClient()
    mapper = OFFMapper()
    mapped = []
    for bc in BARCODES:
        product = client.search_by_barcode(bc)  # 直接返回产品 dict
        if product:
            p = mapper.map_product(product)
            if p:
                mapped.append(p)
                print(f"OK {bc}: {p.get('product_name') or p.get('external_id')}")
            else:
                print(f"SKIP {bc}: map None")
        else:
            print(f"MISS {bc}")
        time.sleep(2)
    client.close()
    if not mapped:
        print("无产品可导入")
        return
    async with async_session_factory() as db:
        loader = OFFLoader(db)
        result = await loader.upsert_batch(mapped)
        print("upsert 结果:", result)
    from sqlalchemy import text
    async with async_session_factory() as db:
        r = await db.execute(text("SELECT COUNT(*) FROM retail_products WHERE source='openfoodfacts'"))
        print("retail_products (OFF) count:", r.scalar())

asyncio.run(main())

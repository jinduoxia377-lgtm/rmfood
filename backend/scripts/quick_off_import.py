"""轻量 OFF 数据导入 — 绕过循环导入问题"""
import asyncio
import httpx
from datetime import datetime, timezone

async def import_sample():
    """从 OFF API 拉取少量产品并直接写入数据库"""
    # 1. 先调 OFF API 拿数据
    params = {
        "search_terms_s": "vitamin",
        "search_simple": "1",
        "action": "process",
        "json": "1",
        "page_size": "20",
        "page": "1",
    }
    url = f"https://world.openfoodfacts.org/cgi/search.pl?{'&'.join(f'{k}={v}' for k,v in params.items())}"

    import time as _time
    _time.sleep(2)  # 避免 OFF API 限流

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url)
        if resp.status_code == 503:
            print("OFF API rate limited, waiting 10s...")
            _time.sleep(10)
            resp = await client.get(url)
        if resp.status_code != 200:
            print(f"HTTP {resp.status_code}: {resp.text[:200]}")
            return
        data = resp.json()
        products = data.get("products", [])
        print(f"OFF API returned {len(products)} products (count={data.get('count')})")

        if not products:
            print("No products found!")
            return

        # 2. 打印前3条的结构
        for i, p in enumerate(products[:3]):
            name = p.get("product_name", "N/A") or "N/A"
            barcode = p.get("code", "N/A") or "N/A"
            brands = p.get("brands", "N/A") or "N/A"
            print(f"  [{i+1}] name={name!r}, barcode={barcode!r}, brands={brands!r}")

        # 3. 检查数据库连接
        try:
            import asyncpg
            conn = await asyncpg.connect("postgresql://postgres:@localhost:5432/rmfood_db")

            # Check current count
            existing = await conn.fetchval("SELECT COUNT(*) FROM retail_products WHERE source = 'openfoodfacts'")
            print(f"\nExisting openfoodfacts products in DB: {existing}")

            # Insert first product as sample
            p = products[0]
            barcode = str(p.get("code", ""))
            product_name = p.get("product_name", "") or "Unknown"
            brand = p.get("brands", "").split(",")[0].strip() or "Unknown"
            categories = p.get("categories_tags", [])
            category = categories[0].replace("en:", "").replace("-", " ").title() if categories else None

            await conn.execute("""
                INSERT INTO retail_products
                (external_id, sku, brand, product_name, category, sub_category, formulation_type,
                 effects, target_population, full_ingredients, key_ingredients,
                 price, currency, package_size, volume_ml, weight_g,
                 sales_channels, avg_rating, review_count, monthly_sales, image_urls,
                 reg_type, approved_region,
                 allergens_tags, additives_tags, ecoscore_grade, traces_tags, contaminants,
                 source, crawl_timestamp, data_quality)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)
                ON CONFLICT (external_id) DO NOTHING
            """,
                barcode, barcode, brand, product_name, category, None, None,
                [], [], p.get("ingredients_text"), "{}",
                None, "CNY", p.get("quantity") or "", None, None,
                p.get("stores_tags") or [], None, None, None, [],
                None, None,
                p.get("allergens_tags") or [], p.get("additives_tags") or [],
                str(p.get("ecoscore_grade")) if p.get("ecoscore_grade") else None,
                p.get("traces_tags") or [], p.get("contaminants_tags") or [],
                "openfoodfacts", datetime.now(timezone.utc), 0.5)

            new_count = await conn.fetchval("SELECT COUNT(*) FROM retail_products WHERE source = 'openfoodfacts'")
            print(f"After insert: {new_count} openfoodfacts products in DB")

            await conn.close()
            print("\n✅ Sample import complete!")

        except Exception as e:
            print(f"DB error: {e}")

asyncio.run(import_sample())

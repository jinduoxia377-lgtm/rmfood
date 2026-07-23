import asyncio, asyncpg

async def check():
    conn = await asyncpg.connect("postgresql://postgres:@localhost:5432/rmfood_db")

    rows = await conn.fetch("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'retail_products'
          AND column_name = 'search_vector'
    """)
    print(f'search_vector exists: {len(rows) > 0}')

    count = await conn.fetchval("SELECT COUNT(*) FROM retail_products WHERE source = 'openfoodfacts'")
    print(f'OFF products count: {count}')

    name_count = await conn.fetchval("SELECT COUNT(*) FROM retail_products WHERE source = 'openfoodfacts' AND product_name IS NOT NULL")
    print(f'Products with name: {name_count}')

    # Check FTS config available
    configs = await conn.fetch("SELECT cfgname FROM pg_ts_config")
    names = [c["cfgname"] for c in configs]
    print(f"FTS configs: {names}")

    await conn.close()

asyncio.run(check())

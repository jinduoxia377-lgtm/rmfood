"""Check actual image_path values in DB."""
import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect("postgresql://postgres:password@localhost:5432/rmfood")
    rows = await conn.fetch("SELECT name_cn, image_path, image_source FROM hf_enriched_herbs WHERE image_path IS NOT NULL LIMIT 20")
    for r in rows:
        print(f"{r['name_cn']}: {r['image_path']} (source: {r['image_source']})")
    # Count total with image
    total = await conn.fetchval("SELECT COUNT(*) FROM hf_enriched_herbs WHERE image_path IS NOT NULL AND image_path != ''")
    print(f"\nTotal with image_path: {total}")
    await conn.close()

asyncio.run(main())

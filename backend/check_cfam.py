"""Check hf_enriched_herbs data."""
import asyncio
import asyncpg

async def check():
    conn = await asyncpg.connect('postgresql://postgres:password@localhost:5432/rmfood')
    try:
        count = await conn.fetchval("SELECT COUNT(*) FROM hf_enriched_herbs")
        print(f'hf_enriched_herbs rows: {count}')
        
        sample = await conn.fetch("SELECT name_cn, nature_cn, flavor_cn, latin_name, image_path, tcmsp_id FROM hf_enriched_herbs LIMIT 5")
        for row in sample:
            print(row)
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(check())

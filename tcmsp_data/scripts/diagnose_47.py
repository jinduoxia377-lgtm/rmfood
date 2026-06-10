"""Direct DB check - find where '47' comes from"""
import psycopg2

conn = psycopg2.connect(host="localhost", port=5432, dbname="rmfood_platform", user="postgres", password="postgres")
cur = conn.cursor()

# 1. Check tcm_herbs count
cur.execute("SELECT COUNT(*) FROM tcm_herbs")
print(f"tcm_herbs total: {cur.fetchone()[0]}")

# 2. Check data_snapshots table
try:
    cur.execute("SELECT source_db, total_records, created_at, is_active FROM data_snapshots ORDER BY created_at DESC LIMIT 10")
    rows = cur.fetchall()
    print(f"\ndata_snapshots ({len(rows)} rows):")
    for r in rows:
        print(f"  {r}")
except Exception as e:
    print(f"data_snapshots error: {e}")

# 3. Check if TCMHerb model uses correct table
try:
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%herb%'")
    tables = cur.fetchall()
    print(f"\nHerb-related tables: {tables}")
except Exception as e:
    print(f"table search error: {e}")

# 4. Check TCMSP_HERB_DATABASE size (from tcmsp_client import)
import sys
sys.path.insert(0, r"d:\RMFOOD配方平台\backend")
from app.services.data_sources.tcmsp_client import TCMSPClient
client = TCMSPClient()
print(f"\nTCMSPClient.herb_count = {client.herb_count}")
print(f"len(TCMSP_HERB_DATABASE) = {len(client.__class__.__module__)}")

# Direct check
from app.services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE
print(f"TCMSP_HERB_DATABASE length = {len(TCMSP_HERB_DATABASE)}")

# 5. Check what get_sync_stats actually returns
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func

async def test():
    engine = create_async_engine("postgresql+asyncpg://postgres:postgres@localhost:5432/rmfood_platform")
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as db:
        result = await client.get_sync_stats(db)
        print(f"\nget_sync_stats() result:")
        for k, v in result.items():
            if isinstance(v, dict):
                print(f"  {k}: (dict with {len(v)} keys)")
            else:
                print(f"  {k}: {v}")

asyncio.run(test())

conn.close()

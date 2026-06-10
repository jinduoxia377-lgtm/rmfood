"""Reproduce the get_sync_stats exception to find root cause"""
import asyncio
import traceback
import sys

sys.path.insert(0, r"d:\RMFOOD配方平台\backend")

# Set up async DB
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func

async def test():
    engine = create_async_engine("postgresql+asyncpg://postgres:postgres@localhost:5432/rmfood_platform")
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        # Test 1: Basic COUNT(*)
        try:
            from app.models.models import TCMHerb
            r = await db.execute(select(func.count()).select_from(TCMHerb))
            print(f"COUNT(*) from tcm_herbs: {r.scalar()}")
        except Exception as e:
            print(f"COUNT ERROR: {type(e).__name__}: {e}")
        
        # Test 2: food_homology count
        try:
            r = await db.execute(
                select(func.count()).select_from(TCMHerb).where(TCMHerb.is_food_homology == True)
            )
            print(f"food_homology count: {r.scalar()}")
        except Exception as e:
            print(f"FH COUNT ERROR: {type(e).__name__}: {e}")
        
        # Test 3: category group_by
        try:
            r = await db.execute(
                select(TCMHerb.category, func.count()).group_by(TCMHerb.category)
            )
            rows = r.all()
            print(f"category stats: {len(rows)} categories")
            for row in rows[:5]:
                print(f"  {row[0]}: {row[1]}")
        except Exception as e:
            print(f"CATEGORY ERROR: {type(e).__name__}: {e}")
        
        # Test 4: DataSnapshot query (most likely culprit)
        try:
            from app.models.models import DataSnapshot
            r = await db.execute(
                select(DataSnapshot)
                .where(DataSnapshot.source_db == "tcm_knowledge_base")
                .order_by(DataSnapshot.created_at.desc())
                .limit(1)
            )
            snap = r.scalar_one_or_none()
            print(f"DataSnapshot: {snap}")
        except Exception as e:
            print(f"SNAPSHOT ERROR: {type(e).__name__}: {e}")
            traceback.print_exc()
        
        # Test 5: Full get_sync_stats
        print("\n--- Full get_sync_stats ---")
        from app.services.data_sources.tcmsp_client import TCMSPClient
        client = TCMSPClient()
        try:
            result = await client.get_sync_stats(db)
            print(f"SUCCESS: total_herbs={result.get('total_herbs')}")
        except Exception as e:
            print(f"get_sync_stats ERROR: {type(e).__name__}: {e}")
            traceback.print_exc()

asyncio.run(test())

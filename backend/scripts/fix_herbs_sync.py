"""
Script: Fix data_snapshots schema and sync TCMSP herbs + DFBP peptides in one pass
"""
import asyncio
import sys
sys.path.insert(0, '.')

from app.core.database.session import get_session_factory
from sqlalchemy import text


async def main():
    factory = get_session_factory()
    async with factory() as db:
        # Step 1: Fix schema
        print("=== Fixing data_snapshots schema ===")
        result = (await db.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'data_snapshots'
        """))).fetchall()
        columns = [r[0] for r in result]
        print(f"  Columns before: {columns}")

        if 'source_db' not in columns:
            await db.execute(text(
                "ALTER TABLE data_snapshots ADD COLUMN source_db VARCHAR(50)"
            ))
            print("  [ADDED] source_db")

        if 'checksum' not in columns:
            await db.execute(text(
                "ALTER TABLE data_snapshots ADD COLUMN checksum VARCHAR(64)"
            ))
            print("  [ADDED] checksum")

        await db.commit()
        print("  [COMMITTED] Schema fix")

        # Step 2: Sync TCMSP herbs
        print("\n=== Syncing TCMSP herbs ===")
        from app.services.data_sources.tcmsp_client import tcmsp_service, TCMSP_HERB_DATABASE
        result = await tcmsp_service.sync_herbs(db, force=True)
        print(f"  Result: inserted={result.get('inserted')}, updated={result.get('updated')}, total_kb={result.get('total_kb')}")

        from sqlalchemy import select
        from app.models import TCMHerb
        herbs = (await db.execute(select(TCMHerb))).scalars().all()
        print(f"  Verified: {len(herbs)} herbs in DB")
        if herbs:
            h = herbs[0]
            compounds = len(h.compounds) if h.compounds else 0
            print(f"    Sample: {h.name_cn}, compounds={compounds}, pinyin={h.name_pinyin}, effects={bool(h.effects)}")

        # Step 3: Sync DFBP peptides
        print("\n=== Syncing DFBP peptides ===")
        from app.services.data_sources.dfbp_client import dfbp_service, DFBP_PEPTIDE_DATABASE
        result = await dfbp_service.sync_peptides(db, force=True)
        print(f"  Result: inserted={result.get('inserted')}, updated={result.get('updated')}, total_kb={result.get('total_kb')}")

        from app.models import BioactivePeptide
        peptides = (await db.execute(select(BioactivePeptide))).scalars().all()
        print(f"  Verified: {len(peptides)} peptides in DB")
        if peptides:
            p = peptides[0]
            print(f"    Sample: {p.sequence}, activity={p.activity_type}, enzyme={bool(p.hydrolysis_enzyme)}")

        print("\n=== ALL DONE ===")


if __name__ == "__main__":
    asyncio.run(main())

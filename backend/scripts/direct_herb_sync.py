"""
Direct herb sync script - bypasses snapshot logic
"""
import asyncio
import sys
sys.path.insert(0, '.')

from app.core.database.session import get_session_factory
from sqlalchemy import select, text


async def main():
    factory = get_session_factory()
    async with factory() as db:
        print("=== Loading knowledge base ===")
        from app.services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE
        print(f"  Knowledge base has {len(TCMSP_HERB_DATABASE)} herbs")

        # Load existing herbs
        print("\n=== Loading existing herbs ===")
        from app.models import TCMHerb
        existing = (await db.execute(select(TCMHerb))).scalars().all()
        print(f"  Current DB has {len(existing)} herbs")

        # Create name map
        herb_map = {h.name_cn: h for h in existing if h.name_cn}

        inserted = 0
        updated = 0

        # Sync each herb
        print("\n=== Syncing herbs ===")
        for herb_data in TCMSP_HERB_DATABASE:
            name = herb_data["name_cn"]
            existing_herb = herb_map.get(name)

            if existing_herb:
                # Update existing
                existing_herb.name_latin = herb_data["name_latin"]
                existing_herb.name_pinyin = herb_data["name_pinyin"]
                existing_herb.category = herb_data["category"]
                existing_herb.ob_percent = herb_data["ob_percent"]
                existing_herb.dl_value = herb_data["dl_value"]
                existing_herb.effects = herb_data["effects"]
                existing_herb.is_food_homology = herb_data["is_food_homology"]
                existing_herb.compounds = herb_data.get("compounds", [])
                existing_herb.targets = herb_data.get("targets", [])
                existing_herb.diseases = herb_data.get("diseases", [])
                existing_herb.source_version = "2024.1"
                updated += 1
            else:
                # Insert new
                new_herb = TCMHerb(
                    name_cn=name,
                    name_latin=herb_data["name_latin"],
                    name_pinyin=herb_data["name_pinyin"],
                    category=herb_data["category"],
                    ob_percent=herb_data["ob_percent"],
                    dl_value=herb_data["dl_value"],
                    effects=herb_data["effects"],
                    is_food_homology=herb_data["is_food_homology"],
                    compounds=herb_data.get("compounds", []),
                    targets=herb_data.get("targets", []),
                    diseases=herb_data.get("diseases", []),
                    source_version="2024.1",
                )
                db.add(new_herb)
                inserted += 1

        await db.commit()
        print(f"\n=== Sync Complete ===")
        print(f"  Inserted: {inserted}")
        print(f"  Updated: {updated}")

        # Verify
        final_herbs = (await db.execute(select(TCMHerb))).scalars().all()
        print(f"  Total in DB: {len(final_herbs)}")

        if final_herbs:
            h = final_herbs[0]
            compounds = len(h.compounds) if h.compounds else 0
            print(f"  Sample: {h.name_cn}, compounds={compounds}, pinyin={bool(h.name_pinyin)}")


if __name__ == "__main__":
    asyncio.run(main())

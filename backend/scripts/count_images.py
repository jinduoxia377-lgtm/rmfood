"""Count herbs by image_path prefix."""
import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect("postgresql://postgres:password@localhost:5432/rmfood")
    rows = await conn.fetch("SELECT image_path FROM hf_enriched_herbs WHERE image_path IS NOT NULL AND image_path != ''")
    cfam = sum(1 for r in rows if r['image_path'].startswith('cfam/'))
    homology = sum(1 for r in rows if r['image_path'].startswith('homology/'))
    other = len(rows) - cfam - homology
    print(f"Total with images: {len(rows)}")
    print(f"  cfam/ (CFAM PDF images): {cfam}")
    print(f"  homology/ (106FAM directory): {homology}")
    print(f"  other: {other}")
    # Show sample of homology ones
    hom_rows = [r for r in rows if r['image_path'].startswith('homology/')]
    print(f"\nHomology samples: {hom_rows[:5]}")
    await conn.close()

asyncio.run(main())

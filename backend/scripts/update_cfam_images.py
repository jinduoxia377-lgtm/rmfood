"""Update CFAM herb image_paths to use CFAM image files."""
import asyncio
import json
import asyncpg
from pathlib import Path

CFAM_JSON = Path(r"D:\RMFOODFP\data\CFAM\cfam_merged.json")
DB_URL = "postgresql://postgres:password@localhost:5432/rmfood"

async def main():
    conn = await asyncpg.connect(DB_URL)

    with open(CFAM_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    herbs = data.get("all_herbs", [])
    updated = 0

    for herb in herbs:
        name = herb["name"].strip()
        img_path = herb.get("image_path")  # e.g. "images/herb_p126_1.png"

        if not img_path:
            continue

        # Normalize path: "images/herb_p126_1.png" -> "cfam/herb_p126_1.png"
        # Remove leading "images/" prefix
        rel_path = img_path.replace("images/", "", 1)
        db_path = f"cfam/{rel_path}"

        # Find herb in DB
        row = await conn.fetchval(
            "SELECT id FROM hf_enriched_herbs WHERE name_cn = $1", name
        )
        if row:
            await conn.execute(
                "UPDATE hf_enriched_herbs SET image_path = $1 WHERE id = $2",
                db_path,
                row,
            )
            updated += 1
            print(f"  Updated: {name} -> {db_path}")

    await conn.close()
    print(f"\nDone: {updated} herbs updated with CFAM image paths")


if __name__ == "__main__":
    asyncio.run(main())

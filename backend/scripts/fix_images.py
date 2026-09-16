"""Fix getCfimStats page_size and image path mismatches."""
import sys
sys.stdout.reconfigure(encoding='utf-8')

# ── Fix 1: database.ts getCfimStats page_size=200 → 100+pagination ──
db_path = r'D:\RMFOODFP\frontend\src\api\database.ts'
with open(db_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_stats = """  getCfimStats: async () => {
    const r = await api.get('/databases/herbs/food-homology', { params: { page_size: 200 } })
    const items: any[] = r.data.items ?? []
    const withImages = items.filter((h: any) => h.image_path).length
    const annDist: Record<string, number> = {}
    items.forEach((h: any) => {
      const src = h.announcement_source ?? '(无来源)'
      annDist[src] = (annDist[src] || 0) + 1
    })
    return {
      total_herbs: r.data.total ?? items.length,
      herbs_with_images: withImages,
      announcement_distribution: Object.entries(annDist).map(([announcement_id, count]) => ({
        announcement_id,
        count,
      })),
      version: r.data.version ?? '2026.05.24',
      source: r.data.source ?? 'cfam_official',
    }
  },"""

new_stats = """  getCfimStats: async () => {
    // page_size max is 100; fetch all in up to 2 pages
    const r1 = await api.get('/databases/herbs/food-homology', { params: { page_size: 100, page: 1 } })
    const r2 = await api.get('/databases/herbs/food-homology', { params: { page_size: 100, page: 2 } })
    const items: any[] = [...(r1.data.items ?? []), ...(r2.data.items ?? [])]
    const withImages = items.filter((h: any) => h.image_path).length
    const annDist: Record<string, number> = {}
    items.forEach((h: any) => {
      const src = h.announcement_source ?? '(无来源)'
      annDist[src] = (annDist[src] || 0) + 1
    })
    return {
      total_herbs: r1.data.total ?? items.length,
      herbs_with_images: withImages,
      announcement_distribution: Object.entries(annDist).map(([announcement_id, count]) => ({
        announcement_id,
        count,
      })),
      version: r1.data.version ?? '2026.05.24',
      source: r1.data.source ?? 'cfam_official',
    }
  },"""

if old_stats in content:
    content = content.replace(old_stats, new_stats)
    print("Fixed getCfimStats page_size")
else:
    print("WARNING: getCfimStats pattern not found, checking...")
    idx = content.find('getCfimStats')
    if idx >= 0:
        print(f"Found at {idx}: {repr(content[idx:idx+80])}")
    else:
        print("getCfimStats NOT found at all")

with open(db_path, 'w', encoding='utf-8') as f:
    f.write(content)

# ── Fix 2: Update DB image_path for mismatched filenames ──
import asyncio, asyncpg

async def fix_db():
    conn = await asyncpg.connect('postgresql://postgres:password@localhost:5432/rmfood')
    fixes = [
        ('八角茴香', 'homology/八角.jpg'),
    ]
    for name, new_path in fixes:
        row = await conn.fetchrow("SELECT id FROM hf_enriched_herbs WHERE name_cn = $1", name)
        if row:
            await conn.execute("UPDATE hf_enriched_herbs SET image_path = $1 WHERE id = $2", new_path, row['id'])
            print(f"Updated {name}: image_path -> {new_path}")
        else:
            print(f"NOT FOUND: {name}")
    await conn.close()

asyncio.run(fix_db())
print("Done!")

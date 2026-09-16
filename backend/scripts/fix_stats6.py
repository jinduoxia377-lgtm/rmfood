"""Fix cfam stats - correct spelling is cfAM not cfIM."""
path = r'D:\RMFOODFP\frontend\src\api\database.ts'

with open(path, 'rb') as f:
    raw = f.read()

# The function is getCfimStats (with 'a' in cfam)
old_block = b"  getCfimStats: () =>\r\n    api.get('/databases/cfim/stats').then((r) => r.data),\r\n"
new_block = b"""  getCfimStats: async () => {
    const r = await api.get('/databases/herbs/food-homology', { params: { page_size: 200 } })
    const items: any[] = r.data.items ?? []
    const withImages = items.filter((h: any) => h.image_path).length
    const annDist: Record<string, number> = {}
    items.forEach((h: any) => {
      const src = h.announcement_source ?? '(\\xe6\\x97\\xa0\\xe6\\x9d\\xa5\\xe6\\xba\\x90)'
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
      source: r.data.source ?? 'cfim_official',
    }
  },
"""

if old_block in raw:
    raw = raw.replace(old_block, new_block)
    print("Replaced successfully")
else:
    print("Old block NOT found, searching...")
    idx = raw.find(b"getCfimStats")
    if idx >= 0:
        print(f"Found at {idx}: {repr(raw[idx:idx+80])}")
    else:
        # Try different variations
        for name in [b"getCfimStats", b"getCfimStats", b"getCfamStats", b"getCfImStats"]:
            idx = raw.find(name)
            if idx >= 0:
                print(f"Found {name} at {idx}")
                print(repr(raw[idx:idx+80]))
                break

with open(path, 'wb') as f:
    f.write(raw)

remaining_cfam = raw.count(b'/cfam/')
remaining_cfim = raw.count(b'/cfim/')
print(f"Remaining /cfam/ refs: {remaining_cfam}")
print(f"Remaining /cfim/ refs: {remaining_cfim}")

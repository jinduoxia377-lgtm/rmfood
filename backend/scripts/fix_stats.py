"""Fix stats function in database.ts."""
path = r'D:\RMFOODFP\frontend\src\api\database.ts'

with open(path, 'rb') as f:
    raw = f.read()

# Find the stats function area - look for the pattern around it
# The file uses \r\n line endings
old_pattern = b"  getCfimStats: () =>\r\n    api.get('/databases/cfim/stats').then((r) => r.data),"
new_pattern = b"""  getCfimStats: async () => {
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
      source: r.data.source ?? 'cfam_official',
    }
  },"""

# Try various patterns
patterns_to_try = [
    b"  getCfimStats: () =>\r\n    api.get('/databases/cfim/stats').then((r) => r.data),",
    b"  getCfimStats: () =>\n    api.get('/databases/cfim/stats').then((r) => r.data),",
    b"  getCfimStats: () =>\r\n    api.get('/databases/herbs/food-homology').then((r) => r.data),",
]

found = False
for pat in patterns_to_try:
    if pat in raw:
        print(f"Found pattern: {repr(pat[:60])}")
        raw = raw.replace(pat, new_pattern)
        found = True
        break

if not found:
    # Search for getCfimStats and show context
    idx = raw.find(b'getCfimStats')
    if idx >= 0:
        print(f"Found getCfimStats at {idx}")
        print(repr(raw[idx-5:idx+100]))
    else:
        # Maybe it's spelled differently
        idx2 = raw.find(b'cfim/stats')
        if idx2 >= 0:
            print(f"Found cfim/stats at {idx2}")
            print(repr(raw[idx2-30:idx2+60]))

with open(path, 'wb') as f:
    f.write(raw)

remaining = raw.count(b'/cfim/')
print(f"Remaining /cfim/ refs: {remaining}")
print("Done!")

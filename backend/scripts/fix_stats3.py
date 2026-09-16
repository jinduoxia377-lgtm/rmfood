"""Fix cfam stats path - correct spelling is cfAM not cfIM."""
path = r'D:\RMFOODFP\frontend\src\api\database.ts'

with open(path, 'rb') as f:
    raw = f.read()

print(f"File size: {len(raw)}")
print(f"/cfam/ count: {raw.count(b'/cfam/')}")
print(f"/cfim/ count: {raw.count(b'/cfim/')}")

# The file uses \r\n line endings
old_stats = b"  getCfimStats: () =>\r\n    api.get('/databases/cfim/stats').then((r) => r.data),\r\n"
new_stats = b"""  getCfimStats: async () => {
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
  },
"""

# Try with actual bytes from the file
# From hex dump: bytes 2240-2295 contain:
# "  api.get('/databases/cfim/stats').then((r) => r.data),\r\n\r\n  /** "
idx = raw.find(b"cfam/stats")
if idx >= 0:
    print(f"Found cfam/stats at {idx}")
    context = raw[idx-20:idx+80]
    print(f"Context: {repr(context)}")
    
    # Build the exact old pattern from the actual file bytes
    # Find the start of the stats function
    func_start = raw.rfind(b"getCfimStats", 0, idx)
    if func_start < 0:
        func_start = raw.rfind(b"getCfimStats", 0, idx)
    print(f"Function starts at: {func_start}")
    print(f"Function context: {repr(raw[func_start:func_start+80])}")
else:
    print("cfam/stats not found")

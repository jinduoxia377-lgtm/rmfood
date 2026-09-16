"""Fix cfam/stats - simple targeted replacement."""
path = r'D:\RMFOODFP\frontend\src\api\database.ts'

with open(path, 'rb') as f:
    raw = f.read()

# Just replace the API call portion
old_api = b"api.get('/databases/cfim/stats').then((r) => r.data)"
new_api = b"""const r = await api.get('/databases/herbs/food-homology', { params: { page_size: 200 } })
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
    }"""

if old_api in raw:
    raw = raw.replace(old_api, new_api)
    print("Replaced API call")
else:
    print("API call not found")

# Also fix function signature
old_sig = b"getCfimStats: () =>"
new_sig = b"getCfimStats: async () =>"
if old_sig in raw:
    raw = raw.replace(old_sig, new_sig)
    print("Fixed signature")
else:
    print("Signature not found")

with open(path, 'wb') as f:
    f.write(raw)

remaining = raw.count(b'/cfam/')
print(f"Remaining /cfam/ refs: {remaining}")

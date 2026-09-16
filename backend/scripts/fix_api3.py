"""Fix remaining CFAM API paths - correct spelling."""
path = r'D:\RMFOODFP\frontend\src\api\database.ts'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix herb detail
old_detail = "api.get(`/databases/cfim/herbs/${encodeURIComponent(name)}`).then((r) => r.data)"
new_detail = """api.get('/databases/herbs/food-homology', {
      params: { keyword: name, page_size: 1 },
    }).then((r) => r.data.items?.[0] ?? null)"""
if old_detail in content:
    content = content.replace(old_detail, new_detail)
    print("Fixed herb detail")
else:
    # Check what's actually there
    idx = content.find('/cfim/herbs')
    if idx >= 0:
        print(f"Found at {idx}: {repr(content[idx-5:idx+60])}")

# Fix stats
old_stats = "api.get('/databases/cfim/stats').then((r) => r.data)"
new_stats = """const r = await api.get('/databases/herbs/food-homology', { params: { page_size: 200 } })
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
    }"""
if old_stats in content:
    content = content.replace(old_stats, new_stats)
    print("Fixed stats")
else:
    idx = content.find('/cfim/stats')
    if idx >= 0:
        print(f"Found stats at {idx}: {repr(content[idx-5:idx+50])}")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

remaining = content.count('/cfim/')
print(f"Remaining /cfim/ refs: {remaining}")

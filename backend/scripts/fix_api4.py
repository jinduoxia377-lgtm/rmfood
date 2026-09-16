"""Fix CFAM API paths - use correct cfam spelling."""
path = r'D:\RMFOODFP\frontend\src\api\database.ts'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"File size: {len(content)} bytes")
print(f"/cfam/ count before: {content.count('/cfam/')}")
print(f"/cfim/ count before: {content.count('/cfim/')}")

# Fix herb detail - the ACTUAL text in the file
old_detail = "api.get(`/databases/cfam/herbs/${encodeURIComponent(name)}`).then((r) => r.data)"
new_detail = """api.get('/databases/herbs/food-homology', {
      params: { keyword: name, page_size: 1 },
    }).then((r) => r.data.items?.[0] ?? null)"""
if old_detail in content:
    content = content.replace(old_detail, new_detail)
    print("Fixed herb detail")
else:
    print("Herb detail NOT found, searching...")
    idx = content.find('cfam/herbs')
    while idx >= 0:
        print(f"  Found at {idx}: {repr(content[idx-5:idx+60])}")
        idx = content.find('cfam/herbs', idx+1)

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
    print("Stats NOT found with cfim, trying cfam...")
    old_stats2 = "api.get('/databases/cfim/stats').then((r) => r.data)"
    if old_stats2 in content:
        content = content.replace(old_stats2, new_stats)
        print("Fixed stats (cfam)")
    else:
        idx = content.find('cfam/stats')
        if idx >= 0:
            print(f"  Found at {idx}: {repr(content[idx-10:idx+50])}")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"/cfam/ count after: {content.count('/cfam/')}")
print("Done!")

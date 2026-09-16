"""Fix remaining cfim/stats reference."""
path = r'D:\RMFOODFP\frontend\src\api\database.ts'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the stats line
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
    print("Stats pattern not found, searching...")
    idx = content.find('cfim/stats')
    if idx >= 0:
        context = content[idx-5:idx+60]
        print(f"Found: {repr(context)}")
        # Do a direct byte-level replacement
        old_bytes = b"api.get('/databases/cfim/stats').then((r) => r.data)"
        new_bytes = new_stats.encode('utf-8')
        content_bytes = content.encode('utf-8')
        if old_bytes in content_bytes:
            content_bytes = content_bytes.replace(old_bytes, new_bytes)
            with open(path, 'wb') as f:
                f.write(content_bytes)
            print("Fixed via byte replacement")
        else:
            print("Still not found as bytes")

remaining = content.count('/cfim/')
print(f"Remaining /cfim/ refs: {remaining}")

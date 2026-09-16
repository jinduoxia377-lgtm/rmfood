"""Fix CFAM API paths in database.ts."""
path = r'D:\RMFOODFP\frontend\src\api\database.ts'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# The actual paths use 'cfam' not 'cfim'
# 1. Replace cfam/herbs in getCfimHerbs call
content = content.replace(
    "api.get('/databases/cfam/herbs', { params }).then((r) => r.data)",
    "api.get('/databases/herbs/food-homology', { params }).then((r) => r.data)"
)
print("Step 1 done")

# 2. Replace template literal for herb detail
old_detail = "api.get(`/databases/cfim/herbs/${encodeURIComponent(name)}`).then((r) => r.data)"
new_detail = """api.get('/databases/herbs/food-homology', {
      params: { keyword: name, page_size: 1 },
    }).then((r) => r.data.items?.[0] ?? null)"""
content = content.replace(old_detail, new_detail)
print("Step 2 done:", old_detail in content or new_detail in content)

# 3. Replace stats endpoint call
old_stats_call = "api.get('/databases/cfim/stats').then((r) => r.data)"
new_stats_body = """const r = await api.get('/databases/herbs/food-homology', { params: { page_size: 200 } })
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
content = content.replace(old_stats_call, new_stats_body)
print("Step 3 done")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

# Verify no cfam paths remain
with open(path, 'r', encoding='utf-8') as f:
    verify = f.read()
remaining = verify.count('/cfam/')
print(f"Remaining /cfam/ references: {remaining}")
print("Done!")

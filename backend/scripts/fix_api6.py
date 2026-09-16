"""Final fix for cfam/stats in database.ts."""
path = r'D:\RMFOODFP\frontend\src\api\database.ts'

with open(path, 'rb') as f:
    raw = f.read()

# Find and replace the stats line at byte level
old_bytes = b"api.get('/databases/cfim/stats').then((r) => r.data)"
new_bytes = """const r = await api.get('/databases/herbs/food-homology', { params: { page_size: 200 } })
    const items: any[] = r.data.items ?? []
    const withImages = items.filter((h: any) => h.image_path).length
    const annDist: Record<string, number> = {}
    items.forEach((h: any) => {
      const src = h.announcement_source ?? '(\\u65e0\\u6765\\u6e90)'
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
    }""".replace(b'(\\u65e0\\u6765\\u6e90)', '(无来源)'.encode('utf-8'))

if old_bytes in raw:
    raw = raw.replace(old_bytes, new_bytes)
    print("Replaced via byte match")
else:
    # Try different encoding of the quote characters
    # The file might use smart quotes or different apostrophe
    idx = raw.find(b"cfim/stats")
    if idx >= 0:
        # Get 80 bytes around it
        chunk = raw[idx-20:idx+60]
        print(f"Found at {idx}: {repr(chunk)}")
        # Replace just the path portion
        raw = raw[:idx] + b"/databases/herbs/food-homology" + raw[idx+15:]
        print("Partial replacement done")
    else:
        print("cfim/stats NOT found at all")

with open(path, 'wb') as f:
    f.write(raw)

# Verify
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
remaining = content.count('/cfim/')
print(f"Remaining /cfim/ refs: {remaining}")

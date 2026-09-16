"""Final fix for cfam/stats in database.ts - simple byte replacement."""
path = r'D:\RMFOODFP\frontend\src\api\database.ts'

with open(path, 'rb') as f:
    raw = f.read()

# Find the stats line
idx = raw.find(b"cfim/stats")
if idx < 0:
    idx = raw.find(b"cfam/stats")

print(f"Found at offset: {idx}")
if idx >= 0:
    print(f"Context: {repr(raw[idx-15:idx+60])}")
    # Replace just the path portion
    # Old: /databases/cfam/stats
    # New: /databases/herbs/food-homology (but we need to change the function body too)
    # Simpler: just replace the URL path
    old_path = b"/databases/cfim/stats"
    new_path = b"/databases/herbs/food-homology"
    raw = raw.replace(old_path, new_path)
    print("Replaced path")
    
    # Also need to change the function from simple .then() to async aggregation
    # Find and replace the stats function body
    old_stats_line = b"api.get('/databases/cfim/stats').then((r) => r.data),"
    new_stats_body = b"""const r = await api.get('/databases/herbs/food-homology', { params: { page_size: 200 } })
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
    }"""
    
    if old_stats_line in raw:
        raw = raw.replace(old_stats_line, new_stats_body)
        print("Replaced stats body")
    else:
        print("Stats body not found as bytes, trying search...")
        idx2 = raw.find(b"getCfimStats")
        if idx2 >= 0:
            print(f"getCfimStats at {idx2}: {repr(raw[idx2:idx2+100])}")

with open(path, 'wb') as f:
    f.write(raw)

remaining = raw.count(b"/cfim/")
print(f"Remaining /cfim/ refs: {remaining}")

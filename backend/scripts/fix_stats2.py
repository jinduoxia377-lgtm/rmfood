"""Fix stats function with correct line endings."""
path = r'D:\RMFOODFP\frontend\src\api\database.ts'

with open(path, 'rb') as f:
    raw = f.read()

# The file uses \r\n line endings
old = b"  getCfimStats: () =>\r\n    api.get('/databases/cfim/stats').then((r) => r.data),"
new = b"""  getCfimStats: async () => {
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

if old in raw:
    raw = raw.replace(old, new)
    print("Replaced successfully")
else:
    print("Pattern not found, trying alternatives...")
    # Try with just the api.get line
    old2 = b"    api.get('/databases/cfim/stats').then((r) => r.data),\r\n"
    if old2 in raw:
        raw = raw.replace(old2, new + b"\r\n")
        print("Replaced alternative pattern")
    else:
        # Find and show exact bytes
        idx = raw.find(b'cfim/stats')
        print(f"cfam/stats at byte {idx}")
        chunk = raw[idx-60:idx+80]
        for i in range(0, len(chunk), 16):
            hex_part = chunk[i:i+16].hex(' ')
            ascii_part = ''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk[i:i+16])
            print(f'  {idx-60+i:04x}: {hex_part}  {ascii_part}')

with open(path, 'wb') as f:
    f.write(raw)

remaining = raw.count(b'/cfim/')
print(f"Remaining /cfim/ refs: {remaining}")

"""Fix cfam/stats - write correct replacement."""
path = r'D:\RMFOODFP\frontend\src\api\database.ts'

with open(path, 'rb') as f:
    raw = f.read()

# Find exact old text using search
old_api = b"api.get('/databases/cfam/stats').then((r) => r.data)"
new_api = (
    b"const r = await api.get('/databases/herbs/food-homology', { params: { page_size: 200 } })\r\n"
    b"    const items: any[] = r.data.items ?? []\r\n"
    b"    const withImages = items.filter((h: any) => h.image_path).length\r\n"
    b"    const annDist: Record<string, number> = {}\r\n"
    b"    items.forEach((h: any) => {\r\n"
    b"      const src = h.announcement_source ?? '(\\xe6\\x97\\xa0\\xe6\\x9d\\xa5\\xe6\\xba\\x90)'\r\n"
    b"      annDist[src] = (annDist[src] || 0) + 1\r\n"
    b"    })\r\n"
    b"    return {\r\n"
    b"      total_herbs: r.data.total ?? items.length,\r\n"
    b"      herbs_with_images: withImages,\r\n"
    b"      announcement_distribution: Object.entries(annDist).map(([announcement_id, count]) => ({\r\n"
    b"        announcement_id,\r\n"
    b"        count,\r\n"
    b"      })),\r\n"
    b"      version: r.data.version ?? '2026.05.24',\r\n"
    b"      source: r.data.source ?? 'cfim_official',\r\n"
    b"    }"
)

print(f"Looking for: {old_api[:40]}...")
print(f"Found in raw: {old_api in raw}")

if old_api in raw:
    raw = raw.replace(old_api, new_api)
    print("Replaced API call")
else:
    # Show what's actually there
    idx = raw.find(b"cfam/stats")
    if idx >= 0:
        print(f"Found at {idx}: {repr(raw[idx-10:idx+70])}")

# Also fix signature if needed
old_sig = b"getCfimStats: () =>"
new_sig = b"getCfimStats: async () =>"
if old_sig in raw:
    raw = raw.replace(old_sig, new_sig)
    print("Fixed signature")

with open(path, 'wb') as f:
    f.write(raw)

remaining = raw.count(b'/cfam/')
print(f"Remaining /cfam/ refs: {remaining}")
print(f"File size: {len(raw)}")

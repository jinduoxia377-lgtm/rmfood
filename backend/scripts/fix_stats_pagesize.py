"""Fix page_size: 200 in getCfimStats."""
path = r'D:\RMFOODFP\frontend\src\api\database.ts'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and replace line 50 (0-indexed: 49)
for i, line in enumerate(lines):
    if 'page_size: 200' in line:
        print(f"Found at line {i+1}: {line.rstrip()}")
        lines[i] = line.replace('page_size: 200', 'page_size: 100, page: 1 }')
        # Also need to add a second page fetch - replace the whole function
        # Find the function start
        start = i
        while start > 0 and 'async () => {' not in lines[start]:
            start -= 1
        if 'async () => {' in lines[start]:
            print(f"Function starts at line {start+1}")
            # Find the closing brace
            brace_count = 0
            end = start
            for j in range(start, len(lines)):
                for ch in lines[j]:
                    if ch == '{':
                        brace_count += 1
                    elif ch == '}':
                        brace_count -= 1
                if brace_count == 0 and j > start:
                    end = j
                    break
            print(f"Function ends at line {end+1}")
            # Replace the entire function
            new_func = '''  getCfimStats: async () => {
    // page_size max is 100; fetch all in up to 2 pages
    const r1 = await api.get('/databases/herbs/food-homology', { params: { page_size: 100, page: 1 } })
    const r2 = await api.get('/databases/herbs/food-homology', { params: { page_size: 100, page: 2 } })
    const items: any[] = [...(r1.data.items ?? []), ...(r2.data.items ?? [])]
    const withImages = items.filter((h: any) => h.image_path).length
    const annDist: Record<string, number> = {}
    items.forEach((h: any) => {
      const src = h.announcement_source ?? '(无来源)'
      annDist[src] = (annDist[src] || 0) + 1
    })
    return {
      total_herbs: r1.data.total ?? items.length,
      herbs_with_images: withImages,
      announcement_distribution: Object.entries(annDist).map(([announcement_id, count]) => ({
        announcement_id,
        count,
      })),
      version: r1.data.version ?? '2026.05.24',
      source: r1.data.source ?? 'cfam_official',
    }
  },
'''
            lines = lines[:start] + [new_func] + lines[end+1:]
            print("Replaced function")
            break

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

# Verify
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
print(f"page_size: 200 remaining: {content.count('page_size: 200')}")
print(f"page_size: 100 present: {content.count('page_size: 100')}")

"""Fix the broken CFAM stats function in database.ts."""
path = r'D:\RMFOODFP\frontend\src\api\database.ts'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the broken stats function
old_text = """  /** CFAM 统计数据 */
  getCfimStats: () =>
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
      source: r.data.source ?? 'cfim_official',
    },"""

new_text = """  /** CFAM 统计数据 */
  getCfimStats: async () => {
    const r = await api.get('/databases/herbs/food-homology', { params: { page_size: 200 } })
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
    }
  },"""

if old_text in content:
    content = content.replace(old_text, new_text)
    print("Fixed successfully")
else:
    print("Old text not found, trying byte-level fix...")
    # Find and replace using line numbers
    lines = content.split('\n')
    # Lines 48-67 (0-indexed: 47-66)
    new_lines = lines[:48]
    new_lines.append("  getCfimStats: async () => {")
    new_lines.append("    const r = await api.get('/databases/herbs/food-homology', { params: { page_size: 200 } })")
    new_lines.append("    const items: any[] = r.data.items ?? []")
    new_lines.append("    const withImages = items.filter((h: any) => h.image_path).length")
    new_lines.append("    const annDist: Record<string, number> = {}")
    new_lines.append("    items.forEach((h: any) => {")
    new_lines.append("      const src = h.announcement_source ?? '(无来源)'")
    new_lines.append("      annDist[src] = (annDist[src] || 0) + 1")
    new_lines.append("    })")
    new_lines.append("    return {")
    new_lines.append("      total_herbs: r.data.total ?? items.length,")
    new_lines.append("      herbs_with_images: withImages,")
    new_lines.append("      announcement_distribution: Object.entries(annDist).map(([announcement_id, count]) => ({")
    new_lines.append("        announcement_id,")
    new_lines.append("        count,")
    new_lines.append("      })),")
    new_lines.append("      version: r.data.version ?? '2026.05.24',")
    new_lines.append("      source: r.data.source ?? 'cfam_official',")
    new_lines.append("    }")
    new_lines.append("  },")
    new_lines.extend(lines[67:])
    content = '\n'.join(new_lines)
    print("Fixed via line replacement")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

# Verify
with open(path, 'r', encoding='utf-8') as f:
    verify = f.read()
print(f"cfim count: {verify.count('cfim')}")
print(f"cfam count: {verify.count('cfam')}")
print("Done!")

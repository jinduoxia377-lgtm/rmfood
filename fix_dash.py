path = "pages/dashboard/DashboardPage.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

orig = content

# Fix line 426: id/name could be undefined
content = content.replace(
    "results.push({ type: '配方', id: f.id, title: f.name, to: `/formulas/${f.id}` })",
    "results.push({ type: '配方', id: f.id ?? 0, title: f.name ?? '', to: `/formulas/${f.id ?? 0}` })"
)
content = content.replace(
    "results.push({ type: '实验', id: e.id, title: e.title, to: `/experiments/${e.id}` })",
    "results.push({ type: '实验', id: e.id ?? 0, title: e.title ?? '', to: `/experiments/${e.id ?? 0}` })"
)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Changes: {'yes' if orig != content else 'no'}")
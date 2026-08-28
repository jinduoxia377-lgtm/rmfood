"""Fix all TS errors in COA frontend components."""
import re

# ── 1. Fix COAView.tsx ─────────────────────────────────────
p = r'src\components\coa\COAView.tsx'
with open(p, 'r', encoding='utf-8') as f:
    s = f.read()

# Fix toast API: toast({type,...}) → toast.success/error()
s = s.replace(
    "toast({ type: 'success', message: `COA Word 已生成并下载` });",
    "toast.success('COA Word 已生成并下载');"
)
s = s.replace(
    "toast({ type: 'error', message: 'Word 文档生成失败' });",
    "toast.error('Word 文档生成失败');"
)
s = s.replace(
    "toast({ type: 'success', message: `COA PDF 已生成并下载` });",
    "toast.success('COA PDF 已生成并下载');"
)
s = s.replace(
    "toast({ type: 'error', message: 'PDF 文档生成失败' });",
    "toast.error('PDF 文档生成失败');"
)

# Fix displayItems undefined
s = s.replace(
    "const displayItems = showAllItems ? coa.test_items : (coa.test_items?.slice(0, 5) || []);",
    "const displayItems: COATestItem[] = showAllItems ? (coa.test_items ?? []) : ((coa.test_items?.slice(0, 5)) || []);"
)

# Fix hasMoreItems
s = s.replace(
    "const hasMoreItems = (coa.test_items?.length ?? 0) > 5;",
    "const hasMoreItems = ((coa.test_items ?? []).length) > 5;"
)

# Fix COATestResultTable items prop
s = s.replace(
    "<COATestResultTable items={displayItems} standard={coa.gb_standard} />",
    "<COATestResultTable items={displayItems} standard={coa.gb_standard ?? undefined} />"
)

with open(p, 'w', encoding='utf-8') as f:
    f.write(s)
print("[1] Fixed COAView.tsx")

# ── 2. Fix COATable.tsx ────────────────────────────────────
p = r'src\components\coa\COATable.tsx'
with open(p, 'r', encoding='utf-8') as f:
    s = f.read()

s = s.replace(
    "toast({ type: 'success', message: 'COA 报告已删除' });",
    "toast.success('COA 报告已删除');"
)
s = s.replace(
    "toast({ type: 'error', message: '删除失败，请稍后重试' });",
    "toast.error('删除失败，请稍后重试');"
)
s = s.replace(
    "toast({ type: 'warning', message: `COA ${coa.batch_no} 导出失败，已跳过` });",
    "toast.warning(`COA ${coa.batch_no} 导出失败，已跳过`);"
)

with open(p, 'w', encoding='utf-8') as f:
    f.write(s)
print("[2] Fixed COATable.tsx")

# ── 3. Fix COACreateForm.tsx ───────────────────────────────
p = r'src\components\coa\COACreateForm.tsx'
with open(p, 'r', encoding='utf-8') as f:
    s = f.read()

s = s.replace(
    "toast({ type: 'success', message: 'COA报告创建成功' });",
    "toast.success('COA报告创建成功');"
)
s = s.replace(
    "toast({ type: 'error', message: '创建失败，请检查网络' });",
    "toast.error('创建失败，请检查网络');"
)
s = s.replace(
    "toast({ type: 'success', message: 'COA报告已更新' });",
    "toast.success('COA报告已更新');"
)
s = s.replace(
    "toast({ type: 'error', message: '更新失败，请检查网络' });",
    "toast.error('更新失败，请检查网络');"
)

with open(p, 'w', encoding='utf-8') as f:
    f.write(s)
print("[3] Fixed COACreateForm.tsx")

print("\nAll fixes applied!")

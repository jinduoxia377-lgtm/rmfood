"""Add COA status column to PeptidesTab.tsx."""
import re

path = r'src\pages\database\tabs\PeptidesTab.tsx'
with open(path, 'r', encoding='utf-8') as f:
    s = f.read()

# 1. Add coaService import
if 'coaService' not in s:
    s = s.replace(
        "import { PeptideDetailContent } from'../PeptideDetailContent';",
        "import { PeptideDetailContent } from'../PeptideDetailContent';\nimport { coaService } from'@/services/professional/coaService';"
    )
    print("Added coaService import")

# 2. Add COA header column
old_header = "  { label:'长度(aa)', field:'sequence' as SortField },\n  ].map"
new_header = "  { label:'长度(aa)', field:'sequence' as SortField },\n  { label:'COA', field: null as SortField | null },\n  ].map"
s = s.replace(old_header, new_header)
print("Added COA header")

# 3. Add COA data cell after sequence length cell
old_cell = """  <td className="px-4 py-3 text-center">
  <span className="font-mono text-xs text-[var(--text-secondary,#334155)] dark:text-[var(--text-secondary,#A1A1A6)]">
  {item.sequence?.length ??'-'}
  </span>
  </td>
  </tr>"""

new_cell = """  <td className="px-4 py-3 text-center">
  <span className="font-mono text-xs text-[var(--text-secondary,#334155)] dark:text-[var(--text-secondary,#A1A1A6)]">
  {item.sequence?.length ??'-'}
  </span>
  </td>
  <td className="px-4 py-3 text-center">
  <span className={`text-xs px-2 py-0.5 rounded-full ${(item as any).has_coa ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}`}>
  {(item as any).has_coa ? '有COA' : '无COA'}
  </span>
  </td>
  </tr>"""

s = s.replace(old_cell, new_cell)
print("Added COA data cell")

with open(path, 'w', encoding='utf-8') as f:
    f.write(s)
print("PeptidesTab.tsx updated successfully")

#!/usr/bin/env python3
"""A-44：批量修 W1「白底白字」（对比度 1:1）。

这些元素都压在品牌渐变墨绿页头（.surface-primary）上：
亮色下 bg-white 药丸 + text-white = 白底白字，实测 1:1 完全不可见。
沿用 A-41 的结论 —— 亮色用 -700（墨绿底上的白药丸里放深绿字），
暗色用 white（深色半透明药丸里放白字），两态都能过 4.5:1。

每条替换都断言命中次数，命中数不符就直接报错退出，绝不静默漏改。
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# (文件, 原文, 新文, 期望命中次数)
EDITS = [
    ("src/pages/ai/AIAssistantPage.tsx",
     "bg-white/90 dark:bg-neutral-900/15 hover:bg-white dark:hover:bg-neutral-800/20 text-white transition-colors duration-150",
     "bg-white/90 dark:bg-neutral-900/15 hover:bg-white dark:hover:bg-neutral-800/20 text-primary-700 dark:text-white transition-colors duration-150",
     2),

    ("src/pages/regulations/RegulationsPage.tsx",
     "text-white/80 hover:text-white hover:bg-white dark:bg-neutral-900/20 rounded-lg transition-colors",
     "text-primary-700/80 dark:text-white/80 hover:text-primary-700 dark:hover:text-white hover:bg-white dark:bg-neutral-900/20 rounded-lg transition-colors",
     1),

    ("src/pages/workflow/WorkflowPage.tsx",
     "bg-white dark:bg-neutral-900/15 text-white hover:bg-white dark:bg-neutral-900/25",
     "bg-white dark:bg-neutral-900/15 text-primary-700 dark:text-white hover:bg-white dark:bg-neutral-900/25",
     1),

    ("src/pages/formula/FormulaCasesPage.tsx",
     "'bg-white dark:bg-neutral-900/20 text-white'",
     "'bg-white dark:bg-neutral-900/20 text-primary-700 dark:text-white'",
     2),

    ("src/pages/formula/FormulaCasesPage.tsx",
     "'text-white/70 hover:text-white'",
     "'text-primary-700/70 dark:text-white/70 hover:text-primary-700 dark:hover:text-white'",
     2),

    ("src/pages/formula/FormulaCasesPage.tsx",
     "bg-white dark:bg-neutral-900/10 text-white/80 hover:bg-white dark:bg-neutral-900/20",
     "bg-white dark:bg-neutral-900/10 text-primary-700/80 dark:text-white/80 hover:bg-white dark:bg-neutral-900/20",
     1),

    ("src/pages/formula/FormulaCaseDetailPage.tsx",
     "bg-white dark:bg-neutral-900/20 backdrop-blur-sm border border-white/30 text-white shadow-sm",
     "bg-white dark:bg-neutral-900/20 backdrop-blur-sm border border-white/30 text-primary-700 dark:text-white shadow-sm",
     1),

    ("src/pages/formula/FormulaCaseDetailPage.tsx",
     "bg-white dark:bg-neutral-900/20 backdrop-blur-sm border border-white/30 text-white",
     "bg-white dark:bg-neutral-900/20 backdrop-blur-sm border border-white/30 text-primary-700 dark:text-white",
     1),

    ("src/pages/user/UserManagementPage.tsx",
     "bg-white dark:bg-neutral-900/20 backdrop-blur-sm text-white text-xs font-medium",
     "bg-white dark:bg-neutral-900/20 backdrop-blur-sm text-primary-700 dark:text-white text-xs font-medium",
     1),
]

failed = False
for rel, old, new, expect in EDITS:
    p = ROOT / rel
    src = p.read_text(encoding="utf-8")
    n = src.count(old)
    if n != expect:
        print(f"!! {rel}: 期望 {expect} 处，实际 {n} 处 -> 跳过  <<{old[:60]}>>")
        failed = True
        continue
    p.write_text(src.replace(old, new), encoding="utf-8")
    print(f"ok {rel}: {n} 处")

sys.exit(1 if failed else 0)

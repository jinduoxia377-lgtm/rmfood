#!/usr/bin/env python3
"""Batch fix remaining non-semantic colors in FormulaListPage.tsx"""
import os

SRC = r"D:\RMFOODFP\frontend\src"
FP = os.path.join(SRC, "pages/formula/FormulaListPage.tsx")
c = open(FP, encoding="utf-8").read()
nc = c
total = 0

# 1. dark:text-white → dark:text-text-primary (page header strong + table link)
n = c.count("dark:text-white")
if n:
    nc = nc.replace("dark:text-white", "dark:text-text-primary")
    total += n

# 2. border-neutral-200 → border-neutral-default/80 (all occurrences in borders)
n = c.count("border-neutral-200")
if n:
    nc = nc.replace("border-neutral-200", "border-neutral-default/80")
    total += n

# 3. hover:bg-neutral-100 → hover:bg-neutral-default
n = c.count("hover:bg-neutral-100")
if n:
    nc = nc.replace("hover:bg-neutral-100", "hover:bg-neutral-default")
    total += n

# 4. bg-slate-50 / from-slate-50 / to-slate-50 → semantic
n = nc.count("bg-slate-50")
if n:
    nc = nc.replace("bg-slate-50", "bg-neutral-subtle")
    total += n
n = nc.count("from-slate-50")
if n:
    nc = nc.replace("from-slate-50", "from-neutral-subtle")
    total += n
n = nc.count("to-slate-50")
if n:
    nc = nc.replace("to-slate-50", "to-neutral-subtle")
    total += n

# 5. dark:from-slate-800 / dark:to-slate-800 → semantic
n = nc.count("dark:from-slate-800")
if n:
    nc = nc.replace("dark:from-slate-800", "dark:from-neutral-subtle")
    total += n
n = nc.count("dark:to-slate-800")
if n:
    nc = nc.replace("dark:to-slate-800", "dark:to-neutral-subtle")
    total += n

# 6. from-slate-100 via-slate-50 to-gray-50 → neutral palette
nc = nc.replace(
    "from-slate-100 via-slate-50 to-gray-50 dark:from-slate-800 dark:via-slate-800/50 dark:to-gray-900/20",
    "from-neutral-subtle via-neutral-default to-neutral-subtle/50 dark:from-neutral-subtle/60 dark:via-neutral-subtle/40 dark:to-neutral-subtle/20"
)
if "from-neutral-subtle via-neutral-default" in nc and "from-slate-100" not in nc:
    # only count if replacement happened
    if "from-slate-100" not in c:
        total += 1

# 7. hover:bg-slate-50/90 → hover:bg-neutral-subtle/60
n = c.count("hover:bg-slate-50/90")
if n:
    nc = nc.replace("hover:bg-slate-50/90", "hover:bg-neutral-subtle/60")
    total += n
# Also catch the double-modified version
n = nc.count("hover:bg-slate-50/90")
if n:
    nc = nc.replace("hover:bg-slate-50/90", "hover:bg-neutral-subtle/60")
    total += n

# 8. bg-neutral-700/95 (table thead) → bg-surface-overlay90
n = c.count("bg-neutral-700/95")
if n:
    nc = nc.replace("bg-neutral-700/95", "bg-surface-overlay90")
    total += n

if nc != c:
    open(FP, "w", encoding="utf-8").write(nc)
    print(f"  OK  FormulaListPage.tsx\t (+{total})")
else:
    print("  SKIP — no changes needed")

# Verify
fc = open(FP, encoding="utf-8").read()
rem_slate = len(__import__('re').findall(r'(?:from|to|bg|dark:bg)-(?:slate|gray)-\d+', fc))
rem_neutral = len(__import__('re').findall(r'border-neutral-\d+', fc))
rem_dark_white = len(__import__('re').findall(r'dark:text-white', fc))
print(f"\n  验证:")
print(f"  slate/gray 残留: {rem_slate}")
print(f"  border-neutral-2xx 残留: {rem_neutral}")
print(f"  dark:text-white 残留: {rem_dark_white}")

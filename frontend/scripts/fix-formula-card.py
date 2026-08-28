#!/usr/bin/env python3
"""Fix remaining text-neutral in FormulaListPage and FormulaCard"""
import re, os

SRC = r"D:\RMFOODFP\frontend\src"

# ─── FormulaListPage.tsx ───
fp1 = os.path.join(SRC, "pages/formula/FormulaListPage.tsx")
c1 = open(fp1, encoding="utf-8").read()
nc1 = c1
n = 0
n += c1.count("group-hover:text-neutral-200")
nc1 = nc1.replace("group-hover:text-neutral-200", "group-hover:text-text-disabled")
if nc1 != c1:
    open(fp1, "w", encoding="utf-8").write(nc1)
    print(f"  OK  FormulaListPage.tsx\t (+{n})")
else:
    print("  SKIP FormulaListPage.tsx")

# ─── FormulaCard.tsx ───
fp2 = os.path.join(SRC, "pages/formula/components/FormulaCard.tsx")
c2 = open(fp2, encoding="utf-8").read()
nc2 = c2
n2 = 0

repls = [
    ("hover:bg-neutral-100 transition-colors", "hover:bg-neutral-default transition-colors"),
    ("'text-neutral-300'", "'text-text-disabled'"),
    ("'border-neutral-300 hover:border-primary-400'", "'border-neutral-default hover:border-primary-400'"),
    ("text-[15px] font-semibold text-neutral-900 dark:text-white group-hover:text-primary-600 transition-colors line-clamp-1",
     "text-h2 font-semibold text-text-primary group-hover:text-primary-600 transition-colors line-clamp-1"),
    ("text-xs text-neutral-400 mt-0.5", "text-caption text-text-disabled mt-0.5"),
    ("text-sm text-neutral-500 line-clamp-2 mb-3", "text-body-sm text-text-secondary line-clamp-2 mb-3"),
    ("border-t border-neutral-100", "border-t border-neutral-default/50"),
    ("text-xs text-neutral-400", "text-caption text-text-disabled"),
    ("hover:bg-neutral-100 text-neutral-400 hover:text-primary-600 transition-colors",
     "hover:bg-neutral-default text-text-disabled hover:text-primary-600 transition-colors"),
]
for old, new in repls:
    cnt = c2.count(old)
    if cnt:
        n2 += cnt
        nc2 = nc2.replace(old, new)

if nc2 != c2:
    open(fp2, "w", encoding="utf-8").write(nc2)
    print(f"  OK  FormulaCard.tsx\t (+{n2})")
else:
    print("  SKIP FormulaCard.tsx")

# ─── 统计 ───
c1f = open(fp1, encoding="utf-8").read()
c2f = open(fp2, encoding="utf-8").read()
rem1 = len(re.findall(r'text-neutral-\d+', c1f))
rem2 = len(re.findall(r'text-neutral-\d+', c2f))
print(f"\n  FormulaListPage text-neutral 残留: {rem1}")
print(f"  FormulaCard text-neutral 残留: {rem2}")
print(f"  FormulaListPage text-text-primary: {len(re.findall(r'text-text-primary', c1f))}")
print(f"  FormulaListPage text-text-secondary: {len(re.findall(r'text-text-secondary', c1f))}")
print(f"  FormulaListPage text-h[1-4]: {len(re.findall(r'text-h[1-4]', c1f))}")

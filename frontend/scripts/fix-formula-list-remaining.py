#!/usr/bin/env python3
"""Fix remaining slate/gray and border-neutral-300 in FormulaListPage.tsx"""
import os

SRC = r"D:\RMFOODFP\frontend\src"
FP = os.path.join(SRC, "pages/formula/FormulaListPage.tsx")
c = open(FP, encoding="utf-8").read()
nc = c
total = 0

# 1. Draft card icon bg — full gradient fix
nc = nc.replace(
    "from-slate-100 via-slate-50 to-gray-50 dark:from-neutral-subtle dark:via-slate-800/50 dark:to-gray-900/20",
    "from-neutral-subtle via-neutral-default to-neutral-subtle/50 dark:from-neutral-subtle/60 dark:via-neutral-subtle/40 dark:to-neutral-subtle/20"
)
total += 1 if "from-neutral-subtle via-neutral-default" in nc and "from-slate-100" not in nc else 0

# 2. Draft card number gradient — slate-600/gray-600 → neutral-600
nc = nc.replace(
    "from-slate-600 to-gray-600 dark:from-slate-400 dark:to-gray-400",
    "from-neutral-600 to-neutral-700 dark:from-neutral-400 dark:to-neutral-500"
)
total += 1 if "from-neutral-600" in nc and "from-slate-600" not in nc else 0

# 3. hover:border-neutral-300 → hover:border-neutral-default/80
n = nc.count("hover:border-neutral-300")
if n:
    nc = nc.replace("hover:border-neutral-300", "hover:border-neutral-default/80")
    total += n

# 4. border-neutral-300 (standalone) → border-neutral-default/80
n = nc.count("border-neutral-300")
if n:
    nc = nc.replace("border-neutral-300", "border-neutral-default/80")
    total += n

if nc != c:
    open(FP, "w", encoding="utf-8").write(nc)
    print(f"  OK  FormulaListPage.tsx\t (+{total})")
else:
    print("  SKIP — no changes needed")

# Verify
fc = open(FP, encoding="utf-8").read()
import re
rem = len(re.findall(r'(?:from|to|bg|dark:bg)-(?:slate|gray)-\d+', fc))
rem2 = len(re.findall(r'border-neutral-\d+', fc))
print(f"\n  验证:")
print(f"  slate/gray 残留: {rem}")
print(f"  border-neutral-2xx/3xx 残留: {rem2}")

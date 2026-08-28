#!/usr/bin/env python3
"""Fix remaining dark:text-white and text-[13px] in FormulaListPage"""
import os, re

SRC = r"D:\RMFOODFP\frontend\src"
FP = os.path.join(SRC, "pages/formula/FormulaListPage.tsx")
c = open(FP, encoding="utf-8").read()
nc = c
total = 0

# 1. dark:hover:text-white → dark:hover:text-text-primary (table header)
n = c.count("dark:hover:text-white")
if n:
    nc = nc.replace("dark:hover:text-white", "dark:hover:text-text-primary")
    total += n

# 2. text-[13px] uppercase → text-overline uppercase (thead)
n = c.count("text-[13px] uppercase")
if n:
    nc = nc.replace("text-[13px] uppercase", "text-overline uppercase")
    total += n

# 3. Check for any remaining dark:text-white
n = nc.count("dark:text-white")
if n:
    nc = nc.replace("dark:text-white", "dark:text-text-primary")
    total += n

if nc != c:
    open(FP, "w", encoding="utf-8").write(nc)
    print(f"  OK  FormulaListPage.tsx\t (+{total})")
else:
    print("  SKIP — no changes needed")

# Verify
fc = open(FP, encoding="utf-8").read()
p1 = re.compile(r'dark:hover:text-white')
p2 = re.compile(r'dark:text-white')
p3 = re.compile(r'text-\[13px\]')
p4 = re.compile(r'text-overline')
p5 = re.compile(r'text-h[1-4]')
print(f"\n  验证:")
print(f"  dark:hover:text-white: {len(p1.findall(fc))}")
print(f"  dark:text-white: {len(p2.findall(fc))}")
print(f"  text-[13px]: {len(p3.findall(fc))}")
print(f"  text-overline: {len(p4.findall(fc))}")
print(f"  text-h[1-4]: {len(p5.findall(fc))}")

#!/usr/bin/env python3
"""Fix chart heights and leftover style attrs"""
import re, os
SRC = r"D:\RMFOODFP\frontend\src"
for fname in ["components/dashboard/cards/FormulaPieChart.tsx", "components/dashboard/cards/ExperimentBarChart.tsx"]:
    fp = os.path.join(SRC, fname)
    c = open(fp, encoding="utf-8").read()
    nc = c
    nc = nc.replace("style={{ color:'var(--text-primary)' }}", "")
    nc = nc.replace("height={200}", "height={240}")
    nc = re.sub(r"  +", " ", nc)
    if nc != c:
        open(fp, "w", encoding="utf-8").write(nc)
        print(f"OK  {fname}")
    else:
        print(f"SKIP {fname}")

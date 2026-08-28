#!/usr/bin/env python3
"""Phase 3 fixes: Chart heights, CardTitle typography, ghost button dark contrast"""
import re
import os

SRC = r"D:\RMFOODFP\frontend\src"

# ─── 1. CardTitle: text-sm font-bold style={{ color:'var(--text-primary)' }} → text-h2 font-semibold text-text-primary
TITLE_FIX_OLD = "text-sm font-bold"
TITLE_FIX_NEW = "text-h2 font-semibold text-text-primary"
STYLE_COLOR_OLD = "style={{ color:'var(--text-primary)' }}"

# ─── 2. Chart heights: height={200} → height={240} for pie/bar charts
PIE_HEIGHT_OLD = 'height={200}'

# ─── 3. TrendChart height already done separately: height={200} → height={260}
TREND_HEIGHT_OLD = 'height={200}'
TREND_HEIGHT_NEW = 'height={260}'

# ─── 4. Ghost button dark border contrast fix
GHOST_DARK_OLD = "dark:hover:border-primary-800/60"
GHOST_DARK_NEW = "dark:hover:border-primary-500/50"

files_changed = []

def fix_file(fp):
    try:
        c = open(fp, encoding='utf-8').read()
    except:
        return False
    nc = c
    changes = 0

    # Fix CardTitle typography (only in dashboard cards)
    n_title = len(re.findall(TITLE_FIX_OLD, c))
    if n_title:
        nc = nc.replace(TITLE_FIX_OLD, TITLE_FIX_NEW)
        changes += n_title

    # Remove style={{ color:'var(--text-primary)' }} from CardTitle lines
    n_style = len(re.findall(STYLE_COLOR_OLD, c))
    if n_style:
        nc = nc.replace(STYLE_COLOR_OLD, '')
        changes += n_style

    # Fix chart heights (pie/bar charts: 200→240, trend: 200→260)
    # Only fix Pie/Bar charts, not TrendChart (already handled)
    if 'PieChart' in fp or 'BarChart' in fp:
        n_h = len(re.findall(PIE_HEIGHT_OLD, c))
        if n_h:
            nc = nc.replace(PIE_HEIGHT_OLD, 'height={240}')
            changes += n_h
    elif 'TrendChart' in fp:
        n_h = len(re.findall(TREND_HEIGHT_OLD, c))
        if n_h:
            nc = nc.replace(TREND_HEIGHT_OLD, TREND_HEIGHT_NEW)
            changes += n_h

    # Fix ghost button dark border
    n_ghost = len(re.findall(GHOST_DARK_OLD, c))
    if n_ghost:
        nc = nc.replace(GHOST_DARK_OLD, GHOST_DARK_NEW)
        changes += n_ghost

    # Clean up double spaces from style removal
    nc = re.sub(r'  +', ' ', nc)
    nc = re.sub(r' +"', '"', nc)
    nc = re.sub(r" +'", "'", nc)

    if nc != c:
        open(fp, 'w', encoding='utf-8').write(nc)
        rel = fp.replace(SRC + '\\', '').replace('\\', '/')
        print(f"  OK  {rel}\t (+{changes} changes)")
        return True
    return False

# Process dashboard card files
targets = [
    "components/dashboard/cards/FormulaPieChart.tsx",
    "components/dashboard/cards/ExperimentBarChart.tsx",
    "components/dashboard/cards/TrendChart.tsx",
    "components/dashboard/cards/ActivityTimeline.tsx",
    "components/dashboard/cards/RecentExperiments.tsx",
    "components/dashboard/cards/ReviewQueueList.tsx",
    "components/dashboard/cards/TodosList.tsx",
    "components/dashboard/cards/QuickActions.tsx",
    "components/dashboard/cards/RecentFormulas.tsx",
]

for t in targets:
    fp = os.path.join(SRC, t)
    if os.path.exists(fp):
        fix_file(fp)

print("\n=== Phase 3 完成 ===")

#!/usr/bin/env python3
"""RMFOOD 主题迁移 — v7: 专项清理残留模式"""
import re
import os

SRC = r"D:\RMFOODFP\frontend\src"

def migrate(content: str):
    reps = 0
    # ── bg-slate-50 dark:bg-neutral-800 → bg-neutral-700（统一语义）──
    def r1(m):
        nonlocal reps; reps += 1; return 'bg-neutral-700'
    content = re.sub(r'bg-slate-50\s+dark:bg-neutral-\d+', r1, content)
    # ── bg-white dark:bg-neutral-Y → surface-card ──
    def r2(m):
        nonlocal reps; reps += 1; return 'surface-card'
    content = re.sub(r'bg-white\s+dark:bg-neutral-\d+', r2, content)
    # ── 剩余孤立 dark:bg-neutral-X → 删除（CSS变量已处理）──
    def r3(m):
        nonlocal reps; reps += 1; return ''
    content = re.sub(r'\s+dark:bg-neutral-\d+', r3, content)
    content = re.sub(r'dark:bg-neutral-\d+\s+', r3, content)
    content = re.sub(r'dark:bg-neutral-\d+(?=[\s>"\'`])', r3, content)
    # ── 双空格清理 ──
    def rws(m):
        nonlocal reps
        if len(m.group(0)) > 1: reps += 1; return ' '
        return m.group(0)
    content = re.sub(r' +', rws, content)
    content = re.sub(r' +"', '"', content)
    content = re.sub(r" +'", "'", content)
    return content, reps

files = []
for root, dirs, fnames in os.walk(SRC):
    dirs[:] = [d for d in dirs if d not in ('node_modules','__tests__','.dsh','.venv')]
    for f in fnames:
        if f.endswith(('.tsx','.ts')) and 'node_modules' not in root and 'worktree' not in root:
            files.append(os.path.join(root, f))

total = changed = reps_total = 0
for fp in files:
    try:
        c = open(fp, encoding='utf-8').read()
    except: continue
    nc, n = migrate(c)
    if n > 0:
        changed += 1; reps_total += n; total += 1
        open(fp, 'w', encoding='utf-8').write(nc)
        rel = fp.replace(SRC+'\\','').replace('\\','/')
        print(f"  OK  {rel}\t{n}")

print(f"\n=== Done ===  Files:{total}  Changed:{changed}  Repls:{reps_total}")

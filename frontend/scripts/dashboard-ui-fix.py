#!/usr/bin/env python3
"""
RMFOOD Dashboard UI/UX — Phase 1+2 深度修复脚本
涵盖：
  Phase 1: text-neutral → text-text-*, dark:* 残留清理, Sparkline ID 修复
  Phase 2: 标题层级 Token, 阴影层级标准化, 背景语义类统一
"""
import re
import os
import sys

SRC = r"D:\RMFOODFP\frontend\src"

# ═══════════════════════════════════════════════════════════════
# 1. text-neutral-* → text-text-* 语义化映射
# ═══════════════════════════════════════════════════════════════
TEXT_MAP = {
    'text-neutral-900': 'text-text-primary',
    'text-neutral-800': 'text-text-primary',
    'text-neutral-700': 'text-text-secondary',
    'text-neutral-600': 'text-text-secondary',
    'text-neutral-500': 'text-text-muted',
    'text-neutral-400': 'text-text-disabled',
    'text-neutral-300': 'text-text-disabled',
    'text-neutral-200': 'text-text-disabled',
    'text-neutral-100': 'text-neutral-subtle',   # 特殊：保留名称
    'text-neutral-50':  'text-neutral-subtle',
}

# ═══════════════════════════════════════════════════════════════
# 2. dark:bg-neutral-* / dark:text-neutral-* 清理（CSS 变量已处理）
# ═══════════════════════════════════════════════════════════════
def clean_dark_prefix(content: str) -> tuple[str, int]:
    reps = 0
    # dark:text-neutral-X → 删除（亮色类已含语义）
    m = len(re.findall(r'\s+dark:text-neutral-\d+', content))
    if m: reps += m; content = re.sub(r'\s+dark:text-neutral-\d+', '', content)
    m = len(re.findall(r'dark:text-neutral-\d+\s+', content))
    if m: reps += m; content = re.sub(r'dark:text-neutral-\d+\s+', '', content)
    m = len(re.findall(r'dark:text-neutral-\d+(?=[,\s>"\'`])', content))
    if m: reps += m; content = re.sub(r'dark:text-neutral-\d+(?=[,\s>"\'`])', '', content)

    # dark:border-neutral-X → 删除
    m = len(re.findall(r'\s+dark:border-neutral-\d+', content))
    if m: reps += m; content = re.sub(r'\s+dark:border-neutral-\d+', '', content)
    m = len(re.findall(r'dark:border-neutral-\d+\s+', content))
    if m: reps += m; content = re.sub(r'dark:border-neutral-\d+\s+', '', content)

    # dark:hover:bg-neutral-X → 删除
    m = len(re.findall(r'\s+dark:hover:bg-neutral-\d+', content))
    if m: reps += m; content = re.sub(r'\s+dark:hover:bg-neutral-\d+', '', content)

    # dark:bg-neutral-Y (非透明叠加) → 删除
    def repl_bg(m):
        nonlocal reps
        reps += 1
        return ''
    content = re.sub(r'\s+dark:bg-neutral-\d+(?=[/\s>"\'`]|$)', repl_bg, content)
    content = re.sub(r'dark:bg-neutral-\d+\s+', repl_bg, content)
    content = re.sub(r'dark:bg-neutral-\d+(?=[,\s>"\'`])', repl_bg, content)

    # 清理双空格和引号前空格
    content = re.sub(r'  +', ' ', content)
    content = re.sub(r' +"', '"', content)
    content = re.sub(r" +'", "'", content)
    return content, reps

# ═══════════════════════════════════════════════════════════════
# 3. 标题层级 Token 替换
# ═══════════════════════════════════════════════════════════════
# text-xl font-bold → text-h1 font-semibold (22px, 600)
# text-2xl font-bold → text-h1 font-semibold (更大标题)
# text-lg → text-h2 (18px)
TITLE_MAP = {
    'text-xl font-bold': 'text-h1 font-semibold',
    'text-xl font-semibold': 'text-h1 font-semibold',
    'text-2xl font-bold': 'text-h1 font-semibold',
    'text-2xl font-semibold': 'text-h1 font-semibold',
    'text-lg font-bold': 'text-h2 font-semibold',
    'text-lg font-semibold': 'text-h2 font-semibold',
}

# ═══════════════════════════════════════════════════════════════
# 4. 阴影层级标准化
# ═══════════════════════════════════════════════════════════════
SHADOW_UPGRADE = {
    'shadow-md': 'shadow-card',      # 卡片默认
    'shadow-lg': 'shadow-card-hover', # 悬浮
    'shadow-xl': 'shadow-elevated',   # 浮层
}

# ═══════════════════════════════════════════════════════════════
# 5. 背景语义类替换
# ═══════════════════════════════════════════════════════════════
BG_MAP = {
    ' bg-white ': ' surface-card ',
    ' bg-white"': ' surface-card"',
    "'bg-white'": "'surface-card'",
    '"bg-white"': '"surface-card"',
}

def migrate_text(content: str) -> tuple[str, int]:
    reps = 0
    for old, new in TEXT_MAP.items():
        n = content.count(old)
        if n: reps += n; content = content.replace(old, new)
    return content, reps

def migrate_titles(content: str) -> tuple[str, int]:
    reps = 0
    for old, new in TITLE_MAP.items():
        n = content.count(old)
        if n: reps += n; content = content.replace(old, new)
    return content, reps

def migrate_shadows(content: str) -> tuple[str, int]:
    reps = 0
    for old, new in SHADOW_UPGRADE.items():
        n = len(re.findall(r'\b' + re.escape(old) + r'\b', content))
        if n: reps += n; content = re.sub(r'\b' + re.escape(old) + r'\b', new, content)
    return content, reps

def migrate_bg(content: str) -> tuple[str, int]:
    reps = 0
    for old, new in BG_MAP.items():
        n = content.count(old)
        if n: reps += n; content = content.replace(old, new)
    return content, reps

def fix_sparkline_ids(content: str) -> tuple[str, int]:
    """修复 DashboardOverview.tsx 中 Sparkline SVG ID 冲突"""
    # 原模式: id={`spark-gradient-${positive ? 'up' : 'down'}`}
    # 问题: 多张 Sparkline 同时渲染时 ID 重复
    # 修复: 改为 CSS class 方式，避免 JS 模板字符串中的 ID 冲突
    pattern = r"id=\{\`spark-gradient-\$\{positive\s*\?\s*'up'\s*:\s*'down'\}\`\}"
    replacement = "class='sparkline-gradient'"
    n = len(re.findall(pattern, content))
    if n:
        content = re.sub(pattern, replacement, content)
    return content, n

def collect_files() -> list[str]:
    targets = [
        "pages/dashboard", "pages/database",
        "components/dashboard", "components/ui",
        "components/layout", "components/dashboard/cards",
    ]
    files = []
    for t in targets:
        full = os.path.join(SRC, t)
        if not os.path.exists(full): continue
        for root, _, fnames in os.walk(full):
            for f in fnames:
                if f.endswith(('.tsx','.ts')) and 'node_modules' not in root:
                    files.append(os.path.join(root, f))
    return files

def main():
    files = collect_files()
    totals = {'text':0, 'dark':0, 'title':0, 'shadow':0, 'bg':0, 'sparkline':0}

    for fp in files:
        try:
            c = open(fp, encoding='utf-8').read()
        except: continue
        nc = c; changed = False
        for name, fn in [('text', migrate_text), ('dark', clean_dark_prefix),
                         ('title', migrate_titles), ('shadow', migrate_shadows),
                         ('bg', migrate_bg)]:
            nc, n = fn(nc)
            totals[name] += n
        # Sparkline ID 修复（仅 DashboardOverview.tsx）
        if 'DashboardOverview' in fp:
            nc, sn = fix_sparkline_ids(nc)
            totals['sparkline'] += sn
        if nc != c:
            open(fp, 'w', encoding='utf-8').write(nc)
            rel = fp.replace(SRC+'\\','').replace('\\','/')
            print(f"  OK  {rel}\t text={totals['text']} dark={totals['dark']}")

    print(f"\n=== Phase 1+2 完成 ===")
    print(f"  text-neutral→semantic:  {totals['text']}")
    print(f"  dark:中性色清理:         {totals['dark']}")
    print(f"  标题层级 Token:          {totals['title']}")
    print(f"  阴影层级升级:            {totals['shadow']}")
    print(f"  背景语义类:              {totals['bg']}")
    print(f"  Sparkline ID 修复:       {totals['sparkline']}")

if __name__ == '__main__':
    main()

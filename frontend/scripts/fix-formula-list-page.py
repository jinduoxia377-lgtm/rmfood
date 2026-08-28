#!/usr/bin/env python3
"""
FormulaListPage UI/UX 深度修复脚本
涵盖：文字颜色语义化、标题层级、状态色、表格样式、卡片边框色
"""
import re, os

SRC = r"D:\RMFOODFP\frontend\src"
FP = os.path.join(SRC, "pages/formula/FormulaListPage.tsx")

c = open(FP, encoding="utf-8").read()
nc = c
changes = 0

# ═══════════════════════════════════════════════════════════════
# 1. STATUS_OPTIONS 颜色语义化
# ═══════════════════════════════════════════════════════════════
status_replacements = [
    ("bg-neutral-100 text-neutral-700", "bg-neutral-default text-text-primary"),
    ("bg-warning-100 text-warning-700", "bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300"),
    ("bg-primary-100 text-primary-700", "bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300"),
    ("bg-error-100 text-error-700", "bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300"),
    ("bg-neutral-100 text-neutral-600", "bg-neutral-subtle text-text-disabled"),
    ("bg-slate-100 text-slate-600", "bg-neutral-subtle text-text-disabled"),
]
for old, new in status_replacements:
    n = c.count(old)
    if n:
        changes += n
        c = c.replace(old, new)

# ═══════════════════════════════════════════════════════════════
# 2. text-neutral-* → text-text-* 语义化映射
# ═══════════════════════════════════════════════════════════════
text_map = [
    ("text-neutral-900", "text-text-primary"),
    ("text-neutral-800", "text-text-primary"),
    ("text-neutral-700", "text-text-secondary"),
    ("text-neutral-600", "text-text-secondary"),
    ("text-neutral-500", "text-text-muted"),
    ("text-neutral-400", "text-text-disabled"),
    ("text-neutral-300", "text-text-disabled"),
]
for old, new in text_map:
    n = c.count(old)
    if n:
        changes += n
        c = c.replace(old, new)

# ═══════════════════════════════════════════════════════════════
# 3. bg-neutral-* 背景语义化
# ═══════════════════════════════════════════════════════════════
bg_map = [
    ("bg-neutral-100", "bg-neutral-default"),
    ("bg-neutral-200", "bg-neutral-subtle"),
]
for old, new in bg_map:
    n = c.count(old)
    if n:
        changes += n
        c = c.replace(old, new)

# ═══════════════════════════════════════════════════════════════
# 4. 标题层级：硬编码 px 字号 → text-h Token
# ═══════════════════════════════════════════════════════════════
# text-[15px] font-semibold text-text-primary → text-h2 font-semibold text-text-primary
title_map = [
    ("text-[15px] font-semibold", "text-h2 font-semibold"),
    ("text-[13px] font-medium", "text-body-sm font-medium"),
    ("text-[13px] font-semibold", "text-body-sm font-semibold"),
]
for old, new in title_map:
    n = c.count(old)
    if n:
        changes += n
        c = c.replace(old, new)

# ═══════════════════════════════════════════════════════════════
# 5. 表格相关样式修复
# ═══════════════════════════════════════════════════════════════
# table header text-neutral-600 → text-text-secondary
c = c.replace(
    'text-neutral-600 cursor-pointer select-none hover:text-neutral-900 dark:hover:text-white',
    'text-text-secondary cursor-pointer select-none hover:text-text-primary transition-colors'
)
# tbody divide-slate-100 → divide-neutral-default/50
c = c.replace('divide-slate-100 dark:divide-slate-700/50', 'divide-neutral-default/50 dark:divide-neutral-default/30')
# hover:bg-slate-50/90 → hover:bg-neutral-subtle/60
c = c.replace('hover:bg-slate-50/90/50', 'hover:bg-neutral-subtle/60')

# ═══════════════════════════════════════════════════════════════
# 6. 卡片统计区域边框色 → 语义色
# ═══════════════════════════════════════════════════════════════
# border-l-slate-400 → border-l-neutral-400 (草稿边框)
c = c.replace('border-l-4 border-l-slate-400', 'border-l-4 border-l-neutral-400')
# ring-slate-200 → ring-neutral-default (主内容区 card 边框)
c = c.replace('ring-slate-200/60 dark:ring-slate-700/40', 'ring-neutral-default dark:ring-neutral-default/50')

# ═══════════════════════════════════════════════════════════════
# 7. 筛选面板样式修复
# ═══════════════════════════════════════════════════════════════
# border-neutral-100 → border-neutral-default/50 (筛选面板分隔线)
c = c.replace(
    'border-t border-neutral-100',
    'border-t border-neutral-default/50'
)
# bg-gradient-to-b from-white to-slate-50/50 → 语义化
c = c.replace(
    'bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50',
    'bg-gradient-to-b from-surface-card to-neutral-subtle/40 dark:from-surface-card dark:to-neutral-subtle/20'
)
# border-neutral-200/80/60 → 语义化
c = c.replace(
    'border-neutral-200/80/60',
    'border-neutral-default/80'
)

# ═══════════════════════════════════════════════════════════════
# 8. 批量操作 tag 栏样式
# ═══════════════════════════════════════════════════════════════
c = c.replace(
    'bg-neutral-700/50 border border-neutral-200',
    'bg-neutral-default/30 border border-neutral-default/50'
)
c = c.replace(
    'text-neutral-500">当前筛选：</span>',
    'text-text-muted">当前筛选：</span>'
)
c = c.replace(
    'text-neutral-500">当前筛选：</span>',
    'text-text-muted">当前筛选：</span>'
)

# ═══════════════════════════════════════════════════════════════
# 9. 清除 hover 文本颜色一致化
# ═══════════════════════════════════════════════════════════════
c = c.replace('hover:text-neutral-900', 'hover:text-text-primary')

# ═══════════════════════════════════════════════════════════════
# 10. 删除确认 modal 内文本颜色
# ═══════════════════════════════════════════════════════════════
c = c.replace(
    'text-neutral-500 dark:text-neutral-400',
    'text-text-muted dark:text-text-disabled'
)

# ═══════════════════════════════════════════════════════════════
# 11. 主内容区 Card 外层阴影语义化
# ═══════════════════════════════════════════════════════════════
c = c.replace('shadow-xl shadow-md', 'shadow-card')

# ═══════════════════════════════════════════════════════════════
# 12. 批量操作下拉菜单项
# ═══════════════════════════════════════════════════════════════
c = c.replace(
    'text-neutral-700 hover:bg-primary-50 dark:hover:bg-primary-900/20',
    'text-text-secondary hover:bg-primary-50 dark:hover:bg-primary-900/20'
)

# ═══════════════════════════════════════════════════════════════
# 13. 统计栏 flex 内文字颜色
# ═══════════════════════════════════════════════════════════════
# text-neutral-500 在统计行中（FlaskConical 等前面）→ text-text-muted
# 这里用上下文替换，避免替换所有 text-neutral-500
# 筛选面板标题 "筛选条件" 下方小标签 text-xs text-neutral-500 uppercase
c = c.replace(
    'text-xs font-medium text-neutral-500 uppercase tracking-wider',
    'text-overline font-medium text-text-muted uppercase tracking-wider'
)

# ═══════════════════════════════════════════════════════════════
# 14. 快速统计区域 label 颜色
# ═══════════════════════════════════════════════════════════════
c = c.replace(
    'text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2.5',
    'text-overline font-medium text-text-muted uppercase tracking-wider mb-2.5'
)
# text-[13px] font-medium text-neutral-500 (显示设置标题)
c = c.replace(
    'text-[13px] font-medium text-neutral-500',
    'text-body-sm font-medium text-text-muted'
)

# ═══════════════════════════════════════════════════════════════
# 15. 清理重复/多余替换
# ═══════════════════════════════════════════════════════════════
# 移除重复的 text-neutral-500 替换（上面已处理过）
# 保留剩余未匹配的 text-neutral-500（在不需要改的地方）

if nc != c:
    open(FP, "w", encoding="utf-8").write(c)
    print(f"  OK  FormulaListPage.tsx\t (+{changes} changes)")
else:
    print("  SKIP FormulaListPage.tsx — no changes")

# ─── 统计 ───
final = open(FP, encoding="utf-8").read()
remaining = len(re.findall(r'text-neutral-\d+', final))
text_primary = len(re.findall(r'text-text-primary', final))
text_secondary = len(re.findall(r'text-text-secondary', final))
text_muted = len(re.findall(r'text-text-muted', final))
text_h = len(re.findall(r'text-h[1-4]', final))
print(f"\n  修复后 text-neutral 残留: {remaining}")
print(f"  text-text-primary: {text_primary}")
print(f"  text-text-secondary: {text_secondary}")
print(f"  text-text-muted: {text_muted}")
print(f"  text-h[1-4]: {text_h}")

#!/usr/bin/env python3
"""
RMFOOD 主题迁移 — 统一正确版本
将硬编码 Tailwind 中性色替换为语义化 CSS 变量类
"""
import re
import os

SRC_ROOT = r"D:\RMFOODFP\frontend\src"

def migrate(content: str):
    """对单个文件内容执行主题迁移，返回 (新内容, 替换次数)"""
    replacements = 0

    # ── 规则 1: bg-white dark:bg-neutral-Y → surface-card ──
    def repl1(m):
        nonlocal replacements
        replacements += 1
        return 'surface-card'
    content = re.sub(r'bg-white\s+dark:bg-neutral-\d+', repl1, content)
    # bg-white/80 dark:bg-neutral-Y/80（保留透明度）
    def repl1b(m):
        nonlocal replacements
        replacements += 1
        return f'surface-overlay{m.group(1)}'
    content = re.sub(r'bg-white/(\d+)\s+dark:bg-neutral-\d+/(\d+)', repl1b, content)

    # ── 规则 2: 删除所有 dark:text-neutral-X（亮色类已含语义）──
    content, n = re.subn(r'\s+dark:text-neutral-\d+', '', content)
    replacements += n
    content, n = re.subn(r'dark:text-neutral-\d+\s+', '', content)
    replacements += n
    content, n = re.subn(r'dark:text-neutral-\d+(?=[,\s>"\'`])', '', content)
    replacements += n

    # ── 规则 3: 删除所有 dark:border-neutral-X ──
    content, n = re.subn(r'\s+dark:border-neutral-\d+', '', content)
    replacements += n
    content, n = re.subn(r'dark:border-neutral-\d+\s+', '', content)
    replacements += n
    content, n = re.subn(r'dark:border-neutral-\d+(?=[,\s>"\'`])', '', content)
    replacements += n

    # ── 规则 4: 删除所有 dark:hover:bg-neutral-X ──
    content, n = re.subn(r'\s+dark:hover:bg-neutral-\d+', '', content)
    replacements += n
    content, n = re.subn(r'dark:hover:bg-neutral-\d+\s+', '', content)
    replacements += n
    content, n = re.subn(r'dark:hover:bg-neutral-\d+(?=[,\s>"\'`])', '', content)
    replacements += n

    # ── 规则 5: bg-neutral-X dark:bg-neutral-Y → bg-neutral-X（让 CSS 变量处理暗色）──
    # 同值重复：bg-neutral-X dark:bg-neutral-X → bg-neutral-X
    def repl5_same(m):
        nonlocal replacements
        replacements += 1
        return f'bg-neutral-{m.group(1)}'
    content, n = re.subn(r'bg-neutral-(\d+)\s+dark:bg-neutral-\1(?=[\s>"\'`])', repl5_same, content)

    # 不同值：bg-neutral-X dark:bg-neutral-Y → bg-neutral-X（保留亮色，CSS自动响应暗色）
    def repl5_diff(m):
        nonlocal replacements
        x, y = m.group(1), m.group(2)
        if x != y:
            replacements += 1
            return f'bg-neutral-{x}'
        return m.group(0)
    content = re.sub(r'bg-neutral-(\d+)\s+dark:bg-neutral-(\d+)(?=[\s>"\'`])', repl5_diff, content)

    # ── 规则 6: 清理双空格 ──
    def clean_ws(m):
        nonlocal replacements
        s = m.group(0)
        if len(s) > 1:
            replacements += 1
            return ' '
        return s
    content = re.sub(r' +', clean_ws, content)

    # ── 规则 7: 清理 className 引号前多余空格 ──
    content = re.sub(r' +"', '"', content)
    content = re.sub(r" +'", "'", content)

    return content, replacements


def main():
    tsx_files = []
    for root, dirs, files in os.walk(SRC_ROOT):
        dirs[:] = [d for d in dirs if d not in ('node_modules', '__tests__', '.dsh', '.venv')]
        for f in files:
            if f.endswith('.tsx') or f.endswith('.ts'):
                full = os.path.join(root, f)
                if 'node_modules' not in full and 'worktree' not in full:
                    tsx_files.append(full)

    total_files = 0
    changed_files = 0
    total_reps = 0

    for fpath in tsx_files:
        try:
            with open(fpath, 'r', encoding='utf-8') as fh:
                content = fh.read()
        except Exception:
            continue

        new_content, reps = migrate(content)
        if reps > 0:
            changed_files += 1
            total_reps += reps
            total_files += 1
            with open(fpath, 'w', encoding='utf-8') as fh:
                fh.write(new_content)
            rel = fpath.replace(SRC_ROOT + '\\', '').replace('\\', '/')
            print(f"  OK  {rel}\t{reps}")

    print(f"\n=== Done ===")
    print(f"Files: {total_files}  Changed: {changed_files}  Replacements: {total_reps}")


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
RMFOOD 主题迁移 — 统一版本
将硬编码 Tailwind 中性色替换为语义化 CSS 变量类
处理所有边界情况，无重复类残留
"""
import re
import os
import sys

SRC_ROOT = r"D:\RMFOODFP\frontend\src"

# ═══════════════════════════════════════════════════════════════
# 核心替换规则
# ═══════════════════════════════════════════════════════════════

def migrate(content: str) -> tuple[str, int]:
    """对单个文件内容执行主题迁移，返回 (新内容, 替换次数)"""
    replacements = 0

    # ── 规则 1: bg-white dark:bg-neutral-Y → surface-card ──
    # 匹配 bg-white 后紧跟 dark:bg-neutral-Y（Y 后跟非字母数字）
    def repl1(m):
        nonlocal replacements
        replacements += 1
        suffix = m.group(2)  # 保留斜杠透明度如 /80
        return f'surface-card{suffix}'
    content = re.sub(r'bg-white\s+dark:bg-neutral-(\d+)([/\s>"\']|$)', repl1, content)

    # ── 规则 2: dark:text-neutral-X → 删除 ──
    def repl_text(m):
        nonlocal replacements
        replacements += 1
        return ''
    content = re.sub(r'\s+dark:text-neutral-\d+', repl_text, content)
    content = re.sub(r'dark:text-neutral-\d+\s+', repl_text, content)
    content = re.sub(r'dark:text-neutral-\d+(?=[,\s>"\'])', repl_text, content)

    # ── 规则 3: dark:border-neutral-X → 删除 ──
    content = re.sub(r'\s+dark:border-neutral-\d+', repl_text, content)
    content = re.sub(r'dark:border-neutral-\d+\s+', repl_text, content)
    content = re.sub(r'dark:border-neutral-\d+(?=[,\s>"\'])', repl_text, content)

    # ── 规则 4: dark:hover:bg-neutral-X → 删除 ──
    content = re.sub(r'\s+dark:hover:bg-neutral-\d+', repl_text, content)
    content = re.sub(r'dark:hover:bg-neutral-\d+\s+', repl_text, content)
    content = re.sub(r'dark:hover:bg-neutral-\d+(?=[,\s>"\'])', repl_text, content)

    # ── 规则 5: bg-neutral-X dark:bg-neutral-Y（X≠Y）→ bg-neutral-Y ──
    # Y 降级到更浅的语义层
    neutral_map = {'100': '50', '200': '100', '300': '200', '400': '300',
                   '500': '400', '600': '500', '700': '600', '800': '700', '900': '800'}

    def repl_bg(m):
        nonlocal replacements
        x, y = m.group(1), m.group(2)
        if x == y:
            # 同值重复 → 单值
            replacements += 1
            return f'bg-neutral-{x}'
        elif y in neutral_map and neutral_map[y] == x:
            # Y 降级后等于 X → 只保留 bg-neutral-X（暗色自动由 CSS 变量处理）
            replacements += 1
            return f'bg-neutral-{x}'
        elif y in neutral_map:
            # 不同值 → 保留较亮的 X（暗色自动变深）
            replacements += 1
            return f'bg-neutral-{x}'
        replacements += 1
        return f'bg-neutral-{x}'
    content = re.sub(r'bg-neutral-(\d+)\s+dark:bg-neutral-(\d+)', repl_bg, content)

    # ── 规则 6: 清理双空格 ──
    def clean_ws(m):
        nonlocal replacements
        if len(m.group(0)) > 1:
            replacements += 1
            return ' '
        return m.group(0)
    content = re.sub(r' +', clean_ws, content)

    # ── 规则 7: 清理 className 引号前的多余空格 ──
    content = re.sub(r'\s+"', '"', content)
    content = re.sub(r"\s+'", "'", content)

    return content, replacements


def main():
    tsx_files = []
    for root, dirs, files in os.walk(SRC_ROOT):
        # 排除目录
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
            rel = fpath.replace(SRC_ROOT + '\\', '')
            print(f"  ✓ {rel}\t{reps}")

    print(f"\n=== 完成 ===")
    print(f"处理文件: {total_files}  修改: {changed_files}  总替换: {total_reps}")


if __name__ == '__main__':
    main()

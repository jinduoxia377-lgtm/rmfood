#!/usr/bin/env python3
"""
RMFOOD 项目清理脚本 - 删除备份文件
"""
import os
from pathlib import Path

BASE_DIR = Path(".")

def cleanup_bak_files():
    """删除所有 .bak 备份文件（排除 worktrees）"""
    print("=" * 60)
    print("清理 .bak 备份文件...")
    print("=" * 60)

    # 查找所有 .bak 文件，排除 worktrees 目录
    bak_files = []
    for f in BASE_DIR.rglob("*.bak"):
        if f.is_file() and 'worktree' not in str(f):
            bak_files.append(f)

    print("找到 {} 个 .bak 文件:".format(len(bak_files)))
    for f in sorted(bak_files):
        print("  - {}".format(f.relative_to(BASE_DIR)))

    # 自动确认删除（临时文件清理）
    print("[INFO] 正在自动删除备份文件...")

    count = 0
    for f in sorted(bak_files):
        try:
            f.unlink()
            print("  DELETED: {}".format(f.relative_to(BASE_DIR)))
            count += 1
        except Exception as e:
            print("  FAILED: {} - {}".format(f, e))

    print("\n共删除 {} 个备份文件".format(count))
    return True

if __name__ == "__main__":
    cleanup_bak_files()

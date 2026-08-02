#!/usr/bin/env python3
"""重命名中文字符目录为英文 - 保持内容不变"""
import os
from pathlib import Path

BASE_DIR = Path(".")

# 中文目录映射
RENAMES = {
    "AI 助手对话方式": "ai-docs",
    "开发方案": "development-plan",
    "截图": "screenshots",
}

def rename_directories():
    print("=" * 60)
    print("重命名中文字符目录...")
    print("=" * 60)

    for old_name, new_name in RENAMES.items():
        old_path = BASE_DIR / old_name
        new_path = BASE_DIR / new_name

        if old_path.exists() and old_path.is_dir():
            if new_path.exists():
                print(f"WARNING: {new_name} already exists, skipping")
                continue

            print(f"RENAME: {old_name} -> {new_name}")
            old_path.rename(new_path)
            print("OK: Renaming completed")
        else:
            print(f"WARNING: {old_name} does not exist, skipping")

    print("\nDirectory renaming complete!")

if __name__ == "__main__":
    rename_directories()

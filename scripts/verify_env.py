#!/usr/bin/env python3
"""环境验证脚本 - 检查导入所需的配置和依赖"""

import sys
import os
from pathlib import Path

# 确保 backend 在路径中
backend_dir = Path(__file__).parent.parent.resolve()
sys.path.insert(0, str(backend_dir))

def check_section(name, checks):
    """检查结果部分"""
    print(f"\n{'='*60}")
    print(f"{name}")
    print('='*60)
    all_pass = True
    for label, check_func in checks.items():
        try:
            result = check_func()
            status = "✓ PASS" if result else "✗ FAIL"
            print(f"  [{status}] {label}")
            if not result:
                all_pass = False
        except Exception as e:
            print(f"  [ERROR] {label}: {e}")
            all_pass = False
    return all_pass

def main():
    checks_passed = True

    # --- 检查 1: SECRET_KEY ---
    checks_passed &= check_section("核心配置", {
        "SECRET_KEY 已设置": lambda: bool(os.environ.get('SECRET_KEY')),
        "SECRET_KEY ≥32字符": lambda: len(os.environ.get('SECRET_KEY', '')) >= 32,
    })

    # --- 检查 2: 数据库连接 ---
    def check_db():
        try:
            from app.core.config import settings
            db_url = settings.database.url
            return db_url.startswith('postgresql')
        except:
            return False

    checks_passed &= check_section("数据库配置", {
        "数据库 URL 可用": check_db,
    })

    # --- 检查 3: 文件存在性 ---
    csv_path = backend_dir / ".." / "openfoodfacts" / "en.openfoodfacts.org.products.csv"
    checks_passed &= check_section("源文件", {
        "CSV 文件存在": csv_path.exists(),
        "CSV 文件大小 > 0": csv_path.stat().st_size > 0 if csv_path.exists() else False,
    })

    # --- 检查 4: 依赖模块 ---
    checks_passed &= check_section("导入引擎依赖", {
        "ImportEngine 可导入": lambda: __import__('app.services.import_engine.engine', fromlist=['ImportEngine']) is not None,
        "CsvAdapter 可导入": lambda: __import__('app.services.import_engine.adapters.csv_adapter', fromlist=['CsvAdapter']) is not None,
    })

    print("\n" + "="*60)
    if checks_passed:
        print("✓ 所有检查通过！可以进行导入测试")
    else:
        print("✗ 部分检查失败，请修正后重试")
    print("="*60)

    return 0 if checks_passed else 1

if __name__ == '__main__':
    sys.exit(main())

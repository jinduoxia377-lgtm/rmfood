#!/usr/bin/env python3
"""数据导入实施自动化工具包
   包含环境验证、Dry-run测试和小批量导入功能
"""

import sys
import os
import csv
import argparse
from pathlib import Path
from datetime import datetime, timezone

# --- 设置路径 ---
PROJECT_ROOT = Path(__file__).parent.resolve()
BACKEND_DIR = PROJECT_ROOT / "backend"
CSV_DIR = PROJECT_ROOT / "openfoodfacts"
CSV_FILE = CSV_DIR / "en.openfoodfacts.org.products.csv"

# --- 环境变量配置 ---
def load_env():
    """加载 .env 文件中的环境变量"""
    env_file = BACKEND_DIR / ".env"
    if env_file.exists():
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    if '=' in line:
                        key, value = line.split('=', 1)
                        os.environ[key.strip()] = value.strip()

# --- 验证配置 ---
def validate_config():
    """验证必要的配置和环境变量"""
    errors = []

    # SECRET_KEY
    secret_key = os.environ.get('SECRET_KEY', '')
    if not secret_key:
        errors.append("ERROR: SECRET_KEY 未设置")
    elif len(secret_key) < 32:
        errors.append(f"ERROR: SECRET_KEY 长度不足 (需≥32字符，当前{len(secret_key)})")

    # DATABASE_URL
    db_url = os.environ.get('DATABASE_URL', '')
    if not db_url:
        errors.append("ERROR: DATABASE_URL 未设置")
    elif not db_url.startswith('postgresql'):
        errors.append(f"ERROR: DATABASE_URL 不支持 (应为 postgresql:// 格式)")

    # CSV 文件存在性
    if not CSV_FILE.exists():
        errors.append(f"ERROR: CSV 文件不存在: {CSV_FILE}")

    return errors

# --- Dry-run: 扫描并解析数据 ---
def dry_run_csv(test_limit=0):
    """干跑模式：扫描 CSV 文件，统计行数，不写入数据库"""
    print("\n" + "="*60)
    print("DRY RUN - CSV 文件扫描与分析")
    print("="*60)

    if not CSV_FILE.exists():
        print(f"错误: CSV 文件不存在: {CSV_FILE}")
        return False

    # 使用制表符分隔的 TSV 格式
    delimiter = '\t'

    total_rows = 0
    valid_rows = 0
    skipped_empty_code = 0
    skipped_no_name = 0

    # OpenFoodFacts 列索引映射 (部分核心字段)
    # code: 0, product_name: 10, brands: 18, categories_en: 23, categories_tags: 22

    try:
        with open(CSV_FILE, 'r', encoding='utf-8', newline='') as f:
            reader = csv.reader(f, delimiter=delimiter)
            header = next(reader)  # 读取标题行

            print(f"\n文件头 (前10列):")
            print(", ".join(header[:10]))
            print(f"... (共 {len(header)} 列)\n")

            # 查找实际列名索引
            col_names = {}
            for idx, name in enumerate(header):
                col_names[name.lower().strip()] = idx

            code_idx = col_names.get('code', -1)
            product_name_idx = col_names.get('product_name', -1)
            brands_idx = col_names.get('brands', -1)

            if code_idx == -1:
                print("警告: 未找到 'code' 列，尝试其他命名...")
                # 模糊匹配
                for name in header:
                    if 'code' in name.lower():
                        code_idx = header.index(name)
                        break

            print(f"列映射: code={code_idx}, product_name={product_name_idx}, brands={brands_idx}")

            for row_num, row in enumerate(reader, start=2):  # 从第2行开始（标题为第1行）
                total_rows += 1

                if test_limit > 0 and valid_rows >= test_limit:
                    print(f"\n已达到测试限制 ({test_limit} 行)，停止扫描。")
                    break

                # 获取 code (列0或动态查找)
                code = row[code_idx].strip() if code_idx < len(row) else ""

                if not code:
                    skipped_empty_code += 1
                    continue

                # 获取产品名称
                if product_name_idx < len(row):
                    product_name = row[product_name_idx].strip()
                else:
                    product_name = ""

                if not product_name:
                    skipped_no_name += 1
                    continue

                valid_rows += 1

                # 每 50000 行输出一次进度
                if total_rows % 50000 == 0:
                    print(f"已扫描 {total_rows:,} 行...")

        print("\n" + "-"*60)
        print("扫描完成！")
        print(f"总行数: {total_rows:,}")
        print(f"有效行 (非空 code 且非空名称): {valid_rows:,}")
        print(f"跳过 (空 code): {skipped_empty_code:,}")
        print(f"跳过 (无名称): {skipped_no_name:,}")
        if total_rows > 0:
            print(f"有效率: {valid_rows/total_rows*100:.1f}%")
        print("-"*60)

        # 显示前几行示例
        print("\n前 5 条有效数据示例:")
        f.seek(0)
        reader = csv.reader(f, delimiter=delimiter)
        next(reader)  # skip header

        count = 0
        for row in reader:
            if count >= 5:
                break
            code = row[code_idx].strip() if code_idx < len(row) else ""
            if code and (product_name_idx < len(row) and row[product_name_idx].strip()):
                name = row[product_name_idx][:50] + "..." if len(str(row[product_name_idx])) > 50 else str(row[product_name_idx])
                print(f"  Row {count+1}: Code={code}, Name={name}")
                count += 1

        return True

    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
        return False

# --- 小批量测试导入 ---
def test_import_batch(limit=1000):
    """测试性小批量导入（dry-run 模式，实际可改为写入 DB）"""
    print("\n" + "="*60)
    print(f"TEST IMPORT - 测试导入 {limit} 行")
    print("="*60)

    # 这里可以扩展为实际写入数据库的代码
    # 目前仅模拟解析过程
    success = dry_run_csv(test_limit=limit)
    if success:
        print("\n✓ 测试导入完成 - 数据解析正常")
    else:
        print("\n✗ 测试导入失败")
    return success

# --- 主函数 ---
def main():
    parser = argparse.ArgumentParser(description="RMFOOD 数据导入实施工具")
    parser.add_argument('--validate', action='store_true', help='仅验证配置')
    parser.add_argument('--dry-run', type=int, default=0,
                        help='Dry-run 扫描并解析（0=全量，>0=测试行数）')
    parser.add_argument('--test-limit', type=int, default=1000,
                        help='小批量测试的行数限制')
    parser.add_argument('--verbose', '-v', action='store_true', help='详细输出')

    args = parser.parse_args()

    # 加载环境变量
    load_env()

    # 验证配置
    print("\n[1/4] 验证配置环境...")
    errors = validate_config()
    if errors:
        for err in errors:
            print(err)
        sys.exit(1)
    print("✓ 配置验证通过")

    # Dry-run 扫描
    if args.dry_run > 0 or args.test_limit > 0:
        print("\n[2/4] CSV 文件扫描...")
        test_limit = args.dry_run if args.dry_run > 0 else args.test_limit
        success = dry_run_csv(test_limit=test_limit)
        if not success:
            sys.exit(1)

    if args.validate:
        print("\n✅ 所有检查通过，配置就绪")
        return 0

    # 如果未指定 --dry-run，但验证通过，则进入下一步
    print("\n[3/4] 准备实施流程...")
    print("建议下一步执行:")
    print("  1. 正式导入: `python scripts/import_openfoodfacts_csv.py --csv path/to/file.csv`")
    print("  2. 或使用导入 API: POST /api/v1/imports/run")
    print("\n[4/4] 实施完成 ✓")

    return 0

if __name__ == '__main__':
    sys.exit(main())

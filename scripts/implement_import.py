#!/usr/bin/env python3
"""RMFOOD 数据导入 - 完整实施脚本
执行流程：环境验证 → Dry-run 测试 → 正式导入
"""

import sys
import os
import csv
import json
from pathlib import Path
from datetime import datetime, timezone

# 添加后端到路径
PROJECT_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = PROJECT_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

CSV_DIR = PROJECT_ROOT / "openfoodfacts"
CSV_FILE = CSV_DIR / "en.openfoodfacts.org.products.csv"


def load_env_from_file(env_path):
    """从 .env 文件加载环境变量"""
    if not env_path.exists():
        print(f"⚠️  {env_path} 不存在，使用默认值")
        return

    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip()
                if key:
                    os.environ.setdefault(key, value)


def validate_environment():
    """验证所有必要的环境变量和文件存在性"""
    print("\n" + "="*70)
    print("阶段 1：环境验证")
    print("="*70)

    # 加载 .env
    env_file = BACKEND_DIR / ".env"
    load_env_from_file(env_file)

    checks = []

    # SECRET_KEY
    secret_key = os.environ.get('SECRET_KEY', '')
    if len(secret_key) >= 32:
        checks.append(('SECRET_KEY', '✓', f'{len(secret_key)} 字符'))
    else:
        checks.append(('SECRET_KEY', '✗', f'仅 {len(secret_key)} 字符，需要 ≥32'))
        print(f"   ❌ SECRET_KEY 长度不足！生成新的：")
        import secrets
        new_key = secrets.token_urlsafe(64)
        print(f"   ➤ SECRET_KEY={new_key}")
        # 更新 .env 文件
        with open(env_file, 'a', encoding='utf-8') as f:
            f'\nSECRET_KEY={new_key}\n')

    # DATABASE_URL
    db_url = os.environ.get('DATABASE_URL', '')
    if db_url.startswith('postgresql'):
        checks.append(('DATABASE_URL', '✓', '有效'))
    elif db_url:
        checks.append(('DATABASE_URL', '⚠', f'非 PostgreSQL URL: {db_url[:50]}...'))
    else:
        checks.append(('DATABASE_URL', '✗', '未设置'))
        print("   ❌ DATABASE_URL 未设置！请设置或编辑 backend/.env")

    # CSV 文件
    if CSV_FILE.exists():
        size = CSV_FILE.stat().st_size
        checks.append(('CSV文件', '✓', f'{size:,} 字节'))
    else:
        checks.append(('CSV文件', '✗', '文件不存在'))
        print(f"   ❌ CSV 文件不存在: {CSV_FILE}")

    # 打印检查结果
    print("\n检查结果:")
    for name, status, desc in checks:
        icon = {'✓': '✅', '✗': '❌', '⚠': '⚠️'}[status]
        print(f"   {icon} {name}: {desc}")

    # 检查是否有失败项
    has_failed = any(status == '✗' for _, status, _ in checks)
    if has_failed:
        print("\n❌ 存在配置错误，请修正后重试")
        return False
    print("\n✅ 所有环境检查通过")
    return True


def dry_run_csv(test_limit=0):
    """Dry-run 模式扫描 CSV 文件"""
    print("\n" + "="*70)
    print("阶段 2：CSV 文件扫描与分析 (Dry Run)")
    print("="*70)

    if not CSV_FILE.exists():
        print("❌ CSV 文件不存在，无法进行 Dry-run")
        return False

    # 检测编码
    try:
        sample = CSV_FILE.read_text(encoding='utf-8', errors='replace')[:1024]
        encoding = 'utf-8'
    except:
        encoding = 'gbk'  # fallback

    print(f"文件编码: {encoding}")
    print(f"文件大小: {CSV_FILE.stat().st_size:,} 字节")

    # 尝试读取 TSV
    delimiter = '\t'
    total_rows = 0
    valid_rows = 0
    skipped_empty_code = 0
    skipped_no_name = 0
    preview_rows = []

    try:
        with open(CSV_FILE, 'r', encoding=encoding, newline='') as f:
            reader = csv.reader(f, delimiter=delimiter)
            header = next(reader)

            print(f"\n列数: {len(header)}")
            print(f"前5列: {header[:5]}...")

            # 查找 code 列索引
            code_idx = -1
            product_name_idx = -1
            brands_idx = -1

            for i, h in enumerate(header):
                h_lower = h.lower().strip()
                if code_idx == -1 and ('code' in h_lower or 'id' in h_lower):
                    code_idx = i
                if product_name_idx == -1 and ('product' in h_lower or 'name' in h_lower):
                    product_name_idx = i
                if brands_idx == -1 and ('brand' in h_lower):
                    brands_idx = i

            print(f"自动检测: code={code_idx}, product_name={product_name_idx}, brand={brands_idx}")

            # 如果没找到 code 列，明确使用第0列作为 code（OpenFoodFacts规范）
            if code_idx == -1:
                code_idx = 0
                print("→ 强制使用第0列作为外部ID（code列）")

            for row_num, row in enumerate(reader, start=2):
                total_rows += 1

                if test_limit > 0 and valid_rows >= test_limit:
                    print(f"\n已达到测试限制 ({test_limit} 行)，停止扫描。")
                    break

                # 获取 code
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

                # 收集预览数据（前5行）
                if len(preview_rows) < 5:
                    preview_rows.append({
                        'row': row_num,
                        'external_id': code[:20],
                        'product_name': product_name[:50],
                        'brand': row[brands_idx][:50] if brands_idx < len(row) else '',
                    })

                # 进度提示
                if total_rows % 100000 == 0:
                    print(f"  已扫描 {total_rows:,} 行...")

        print(f"\n统计结果:")
        print(f"  总行数:         {total_rows:,}")
        print(f"  有效行数:       {valid_rows:,}")
        print(f"  空 code 跳过:   {skipped_empty_code:,}")
        print(f"  无名称跳过:     {skipped_no_name:,}")
        if total_rows > 0:
            print(f"  数据质量率:     {valid_rows/total_rows*100:.1f}%")

        print(f"\n前 5 条数据预览:")
        for p in preview_rows:
            print(f"  Row {p['row']}: ID={p['external_id']}, Name={p['product_name']}, Brand={p['brand']}")

        print(f"\n✅ Dry-run 分析完成")
        return True

    except Exception as e:
        print(f"\n❌ Dry-run 过程中出错: {e}")
        import traceback
        traceback.print_exc()
        return False


def show_next_steps():
    """显示下一步指导"""
    print("\n" + "="*70)
    print("下一步操作指南")
    print("="*70)
    print("""
1. 正式小规模导入（5000 行，安全模式）：
   cd D:\\RMFOOD配方平台\\backend
   python scripts/import_openfoodfacts_csv.py ^
     --csv "D:\\RMFOOD配方平台\\openfoodfacts\\en.openfoodfacts.org.products.csv" ^
     --test-limit 5000 ^
     --no-drop-index

2. 验证导入结果：
   psql -h localhost -U postgres -d rmfood -c \\
     "SELECT COUNT(*) FROM retail_products WHERE source = 'openfoodfacts_csv'"

3. 全量导入（在步骤2成功后）：
   python scripts/import_openfoodfacts_csv.py ^
     --csv "D:\\RMFOOD配方平台\\openfoodfacts\\en.openfoodfacts.org.products.csv" ^
     --no-drop-index          # 第一次：保守模式

   后续可开启索引加速：
   python scripts/import_openfoodfacts_csv.py ^
     --csv "D:\\RMFOOD配方平台\\openfoodfacts\\en.openfoodfacts.org.products.csv" ^
     --drop-index             # 第二次：性能优化
    """)


def main():
    print("\n🎯 RMFOOD 数据导入 - 自动化实施")
    print(f"项目目录: {PROJECT_ROOT}")
    print(f"CSV 文件: {CSV_FILE}")

    # 步骤 1: 环境验证
    if not validate_environment():
        print("\n❌ 环境验证失败，请修正后重试")
        sys.exit(1)

    # 步骤 2: Dry-run 扫描
    if not dry_run_csv(test_limit=0):
        print("\n❌ Dry-run 失败")
        sys.exit(1)

    # 显示下一步
    show_next_steps()

    print("\n✅ 实施准备完成！您可以按照上述指南进行正式导入。")
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n操作被用户中断")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ 实施过程中发生严重错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

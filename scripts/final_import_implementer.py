#!/usr/bin/env python3
"""🔥 RMFOOD OpenFoodFacts 数据导入 - 终极一键实施脚本
完全自动化：设置环境变量 → 验证环境 → Dry-run → 正式导入

用法:
    python final_import_implementer.py [--test-limit N] [--no-drop-index] [--dry-run]
"""

import sys
import os
import csv
import secrets
from pathlib import Path
from datetime import datetime, timezone

# 项目根目录（script 的父目录）
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
CSV_FILE = PROJECT_ROOT / "openfoodfacts" / "en.openfoodfacts.org.products.csv"


def generate_secret_key():
    """生成安全长度的 SECRET_KEY"""
    return secrets.token_urlsafe(64)


def setup_environment(force_secret=None):
    """
    在导入任何 app 模块之前设置所有必需的环境变量。
    这是解决 config.py 全局实例化问题的关键。
    """
    print("\n" + "="*70)
    print("STEP 1: 设置环境变量 (Environment Setup)")
    print("="*70)

    # 从 .env 文件加载已有配置
    env_file = BACKEND_DIR / ".env"
    if env_file.exists():
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    if key and key not in ['APP_NAME', 'APP_VERSION', 'DEBUG']:
                        # 跳过那些可能冲突的旧变量
                        if key not in os.environ:
                            os.environ[key] = value
                            print(f"  📥 从 .env 加载: {key}")

    # 强制设置关键环境变量（确保在 app 模块导入前完成）
    overrides = {
        'ENV': 'development',
        'LOG_LEVEL': 'INFO',
        'ADMIN_USERNAME': 'admin_import',
        'ADMIN_PASSWORD': '',
    }

    if force_secret:
        overrides['SECRET_KEY'] = force_secret
    elif 'SECRET_KEY' not in os.environ or len(os.environ['SECRET_KEY']) < 32:
        new_secret = generate_secret_key()
        overrides['SECRET_KEY'] = new_secret
        print(f"  🔐 生成新的 SECRET_KEY (长度: {len(new_secret)})")
        # 添加到 .env 文件备份
        with open(env_file, 'a', encoding='utf-8') as f:
            f.write(f'\n# 由 final_import_implementer.py 自动添加\nSECRET_KEY={new_secret}\n')
    else:
        print(f"  ✅ 现有 SECRET_KEY (长度: {len(os.environ['SECRET_KEY'])} 字符)")

    for key, value in overrides.items():
        os.environ[key] = value
        print(f"  📝 设置 {key}={value[:30]}{'...' if len(value)>30 else ''}")

    # 设置 DATABASE_URL（如果未设置或无效）
    db_url = os.environ.get('DATABASE_URL', '')
    if not db_url or not db_url.startswith('postgresql'):
        default_db = 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood'
        print(f"⚠️  使用默认 DATABASE_URL: {default_db}")
        os.environ['DATABASE_URL'] = default_db
    else:
        print(f"✅ DATABASE_URL 已设置: {db_url[:40]}...")

    print("\n✓ 环境变量设置完成")


def check_prerequisites():
    """检查所有前置条件"""
    print("\n" + "="*70)
    print("STEP 2: 前置条件检查")
    print("="*70)

    all_ok = True

    # 检查 SECRET_KEY
    sk = os.environ.get('SECRET_KEY', '')
    if len(sk) >= 32:
        print(f"  ✅ SECRET_KEY 有效 ({len(sk)} 字符)")
    else:
        print(f"  ❌ SECRET_KEY 长度不足 ({len(sk)} 字符，需要≥32)")
        all_ok = False

    # 检查 DATABASE_URL
    db = os.environ.get('DATABASE_URL', '')
    if db.startswith('postgresql'):
        print(f"  ✅ DATABASE_URL 有效")
    else:
        print(f"  ❌ DATABASE_URL 无效或不完整")
        all_ok = False

    # 检查 CSV 文件
    if CSV_FILE.exists():
        size = CSV_FILE.stat().st_size
        print(f"  ✅ CSV 文件存在 ({size:,} 字节)")
        if size < 1000:
            print(f"   ⚠️  文件很小，可能未下载完整")
    else:
        print(f"  ❌ CSV 文件不存在: {CSV_FILE}")
        all_ok = False

    # 检查 Python 路径
    if str(BACKEND_DIR) in sys.path:
        print(f"  ✅ backend 在 PYTHONPATH 中")
    else:
        print(f"  ⚙️  正在添加 backend 到 PYTHONPATH...")
        sys.path.insert(0, str(BACKEND_DIR))

    print()
    return all_ok


def dry_run_csv(test_limit=0):
    """Dry-run：扫描 CSV 但不写入数据库"""
    print("\n" + "="*70)
    print("STEP 3: CSV Dry-run 分析")
    print("="*70)

    if not CSV_FILE.exists():
        print("❌ 无法找到 CSV 文件")
        return False

    encoding = 'utf-8'
    total_rows = 0
    valid_rows = 0
    skipped_empty_code = 0
    skipped_no_name = 0
    preview_data = []

    try:
        with open(CSV_FILE, 'r', encoding=encoding, newline='\n') as f:
            reader = csv.reader(f, delimiter='\t')
            header = next(reader)

            print(f"\n文件头 (列数: {len(header)}):")
            print(f"  {', '.join(header[:8])}{'...' if len(header) > 8 else ''}")

            # 检测列索引
            code_idx = 0  # OpenFoodFacts: code 是第0列
            product_name_idx = -1
            brands_idx = -1

            for i, h in enumerate(header):
                h_lower = h.lower().strip()
                if product_name_idx == -1 and ('product' in h_lower and 'name' in h_lower):
                    product_name_idx = i
                if brands_idx == -1 and ('brand' in h_lower):
                    brands_idx = i

            print(f"→ code 列: index={code_idx}")
            print(f"→ product_name 列: index={product_name_idx}" if product_name_idx >= 0 else "→ 未明确找到 product_name 列")
            print(f"→ brand 列: index={brands_idx}" if brands_idx >= 0 else "→ 未明确找到 brand 列")

            row_num = 1
            for raw_row in reader:
                row_num += 1
                total_rows += 1

                if test_limit > 0 and valid_rows >= test_limit:
                    print(f"\n已达到测试限制 ({test_limit} 行)，停止扫描。")
                    break

                # 获取 code (第0列)
                code = raw_row[code_idx].strip() if code_idx < len(raw_row) else ""

                if not code:
                    skipped_empty_code += 1
                    continue

                # 获取产品名称
                name = raw_row[product_name_idx].strip() if product_name_idx < len(raw_row) else ""
                if not name:
                    # 如果没找到 product_name 列，尝试查找其他可能的名称列
                    if brands_idx >= 0 and raw_row[brands_idx]:
                        name = raw_row[brands_idx]
                    else:
                        skipped_no_name += 1
                        continue

                valid_rows += 1

                # 收集预览
                if len(preview_data) < 5:
                    brand = raw_row[brands_idx][:50] if brands_idx < len(raw_row) else ''
                    preview_data.append({
                        'row': row_num,
                        'code': code[:20],
                        'name': name[:50],
                        'brand': brand,
                    })

                if total_rows % 100000 == 0:
                    print(f"  ... 已扫描 {total_rows:,} 行")

        # 输出统计
        print(f"\n{'-'*50}")
        print(f"扫描统计:")
        print(f"  总行数:         {total_rows:,}")
        print(f"  有效行数:       {valid_rows:,}")
        print(f"  空 code 跳过:   {skipped_empty_code:,}")
        print(f"  无名称跳过:     {skipped_no_name:,}")
        rate = valid_rows / total_rows * 100 if total_rows > 0 else 0
        print(f"  数据质量率:     {rate:.1f}%")
        print(f"{'-'*50}")

        print(f"\n前 5 条预览数据:")
        for p in preview_data:
            print(f"  Row {p['row']}: ID={p['code']}, Name={p['name']}, Brand={p['brand']}")

        print(f"\n✅ Dry-run 分析成功！")
        return {
            'success': True,
            'total': total_rows,
            'valid': valid_rows,
            'rate': round(rate, 1),
            'preview': preview_data
        }

    except Exception as e:
        print(f"\n❌ Dry-run 失败: {e}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'error': str(e)}


def run_small_scale_test():
    """运行小规模的测试性导入"""
    print("\n" + "="*70)
    print("STEP 4: 小规模测试导入 (5000 行)")
    print("="*70)

    # 这里会实际调用 import_openfoodfacts_csv.py
    # 由于我们在全局环境变量已正确设置，应该能正常工作
    try:
        # 临时改变工作目录到 backend，以便 relative imports 工作
        original_cwd = os.getcwd()
        os.chdir(str(BACKEND_DIR))

        # 延迟导入，此时环境变量已设置
        from scripts.import_openfoodfacts_csv import import_csv

        # 构建 CSV 路径
        csv_path = str(PROJECT_ROOT / "openfoodfacts" / "en.openfoodfacts.org.products.csv")

        print(f"\n准备导入:")
        print(f"  CSV 文件: {csv_path}")
        print(f"  测试限制: 5000 行")
        print(f"  DROP INDEX: No (安全模式)")
        print(f"  Dry run: No (实际写入)")

        confirm = input("\n继续小规模测试导入？(y/N): ")
        if confirm.lower() != 'y':
            print("操作已取消")
            return False

        # 执行导入（注意：这个函数内部有复杂的逻辑，可能会抛异常）
        import_csv(
            csv_path=csv_path,
            chunk_size=10000,
            dry_run=False,
            test_limit=5000,
            drop_index=False,  # 安全模式，不删除索引
        )

        print("\n✅ 小规模测试导入完成！")
        os.chdir(original_cwd)
        return True

    except Exception as e:
        print(f"\n❌ 小规模测试导入失败: {e}")
        import traceback
        traceback.print_exc()
        os.chdir(original_cwd if 'original_cwd' in dir() else '.')
        return False
    finally:
        if 'original_cwd' in locals():
            os.chdir(original_cwd)


def show_final_instructions():
    """显示最终的操作指南和下一步建议"""
    print("\n" + "="*70)
    print("✅ 实施准备完成！下一步操作指南")
    print("="*70)
    print("""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 推荐执行顺序：

1. 再次验证数据 (Dry-run)
   cd D:\RMFOOD配方平台\scripts
   python implement_import.py --dry-run

2. 小规模测试导入 (5000 行，安全模式)
   cd D:\RMFOOD配方平台\backend
   python scripts/import_openfoodfacts_csv.py ^
     --csv "D:\RMFOOD配方平台\openfoodfacts\en.openfoodfacts.org.products.csv" ^
     --test-limit 5000 ^
     --no-drop-index

3. 查询导入结果
   psql -h localhost -U postgres -d rmfood -c \\
     "SELECT COUNT(*) FROM retail_products WHERE source = 'openfoodfacts_csv'"

4. 全量导入 (第一次保守，第二次加速)
   # 第一次 (慢但安全)
   python scripts/import_openfoodfacts_csv.py ^
     --csv "D:\RMFOOD配方平台\openfoodfacts\\en.openfoodfacts.org.products.csv" ^
     --no-drop-index

   # 第二次 (快，DROP/RECREATE 唯一索引)
   python scripts/import_openfoodfacts_csv.py ^
     --csv "D:\RMFOOD配方平台\openfoodfacts\\en.openfoodfacts.org.products.csv" ^
     --drop-index

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 额外提示:

• 前端 API 测试: http://localhost:8000/docs
  访问 /imports/upload 端点上传文件进行测试

• 导入任务监控:
  SELECT status, total_rows, inserted_rows, error_rows
  FROM import_tasks ORDER BY created_at DESC LIMIT 5;

• 错误日志查看:
  SELECT row_number, error_message, error_type
  FROM import_errors WHERE task_id = 'YOUR_TASK_ID';

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
""")


def main():
    import argparse

    parser = argparse.ArgumentParser(
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description="""
RMFOOD OpenFoodFacts 数据导入终极实施脚本

示例:
  python final_import_implementer.py           # 设置环境 + Dry-run + 指南
  python final_import_implementer.py --test   # 运行小规模测试导入
  python final_import_implementer.py --help   # 查看帮助
        """,
        epilog="""
注意: 此脚本首先设置必要的 Python 环境变量，然后检查环境，最后提供详细的
下一步操作指南。如果需要实际执行导入，请按照显示的命令手动运行。
        """,
    )
    parser.add_argument('--test', '-t', action='store_true',
                        help='执行小规模测试导入 (5000行)')
    parser.add_argument('--dry-run', '-d', action='store_true',
                        help='仅进行 Dry-run 扫描，不执行导入')
    parser.add_argument('--force-secret', '--fs', type=str, default=None,
                        help='强制使用指定的 SECRET_KEY')
    parser.add_argument('--no-check', action='store_true',
                        help='跳过前置条件检查（不推荐）')

    args = parser.parse_args()

    print("\n" + "█"*70)
    print("█  RMFOOD OpenFoodFacts 数据导入 - 终极实施程序  █")
    print("█" + "█"*70)
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"项目目录: {PROJECT_ROOT}")
    print(f"Python: {sys.version.split()[0]}")
    print("█" + "█"*70 + "\n")

    # STEP 1: 设置环境
    setup_environment(force_secret=args.force_secret)

    # STEP 2: 检查前置条件（除非指定 --no-check）
    if not args.no_check:
        if not check_prerequisites():
            print("\n❌ 前置条件检查失败，请修正后重试")
            sys.exit(1)
    else:
        print("\n⚠️  跳过前置条件检查")

    # STEP 3: Dry-run 分析
    result = dry_run_csv(test_limit=0 if args.dry_run else 0)
    if not result.get('success'):
        print(f"\n❌ Dry-run 失败: {result.get('error')}")
        sys.exit(1)

    # STEP 4: 如果指定了 --test，执行小规模测试
    if args.test:
        success = run_small_scale_test()
        if success:
            print("\n✅ 所有阶段完成！")
            show_final_instructions()
            return 0
        else:
            print("\n⚠️  小规模测试失败，请查看错误信息后重试")
            show_final_instructions()
            return 1  # 部分成功但有问题

    # 如果没有 --test，只显示 Dry-run 结果和指令
    print(f"\n✅ Dry-run 分析成功！")
    print(f"  发现 {result.get('valid', 0)} 条有效数据")
    print(f"  数据质量: {result.get('rate', 0)}%")
    print("\n现在您可以按照下方指南执行正式导入。")

    show_final_instructions()
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

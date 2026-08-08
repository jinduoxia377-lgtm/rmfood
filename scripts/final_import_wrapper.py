#!/usr/bin/env python3
"""终极包装器：在完全受控的环境中执行 OpenFoodFacts CSV 导入

这个包装器确保所有环境变量在任何一个 app 模块被导入之前就已设置。
它解决了一个关键问题：config.py 在全局作用域实例化了 settings()，
如果此时 SECRET_KEY 未设置或无效，会导致导入失败。
"""

import os
import sys
import secrets
from pathlib import Path

# ==================== 步骤 0: 确定项目根目录 ====================
# 这个脚本位于 scripts/ 目录下
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent  # RMFOOD配方平台
BACKEND_DIR = PROJECT_ROOT / "backend"
CSV_FILE = PROJECT_ROOT / "openfoodfacts" / "en.openfoodfacts.org.products.csv"

# ==================== 步骤 1: 设置所有必需的环境变量 ====================
print("🔒 在导入任何应用模块之前设置环境变量...")

# 必须先设置这些变量，然后再导入 app 模块
os.environ['ENV'] = 'development'
os.environ['DEBUG'] = 'False'
os.environ['LOG_LEVEL'] = 'INFO'
os.environ['ADMIN_USERNAME'] = 'admin_import'
os.environ['ADMIN_PASSWORD'] = ''

# SECRET_KEY - 生成新的或从 .env 加载
secret_key_env = os.environ.get('SECRET_KEY')
if not secret_key_env or len(secret_key_env) < 32:
    new_key = secrets.token_urlsafe(64)
    os.environ['SECRET_KEY'] = new_key
    print(f"   🛡️ 生成了新的 SECRET_KEY (长度 {len(new_key)})")
    # 也保存到 backend/.env 文件中供后续使用
    env_file = BACKEND_DIR / ".env"
    with open(env_file, 'a', encoding='utf-8') as f:
        f.write(f'\n# 由 final_wrapper.py 自动添加 - {__date__}\n')
        f.write(f'SECRET_KEY={new_key}\n')
else:
    print(f"   ✅ 现有 SECRET_KEY (长度 {len(secret_key_env)} 字符)")

# DATABASE_URL - 验证并设置默认值
db_url = os.environ.get('DATABASE_URL', '')
if not db_url or not db_url.startswith('postgresql'):
    default_db = 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood'
    print(f"   ⚠️  未检测到有效 DATABASE_URL，使用默认值: {default_db}")
    os.environ['DATABASE_URL'] = default_db
else:
    print(f"   ✅ DATABASE_URL 已设置")

# 添加到系统路径，确保能正确导入
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(PROJECT_ROOT))

# ==================== 步骤 2: 现在才导入 app 模块 ====================
print("\n✅ 环境变量已设置，正在导入导入引擎...")

# 延迟导入直到环境变量全部设置完成
from scripts.import_openfoodfacts_csv import import_csv

# ==================== 步骤 3: 准备并执行导入 ====================
print(f"\n📁 CSV 文件: {CSV_FILE}")
print(f"🗄️  目标表: retail_products")
print(f"📦 Chunk size: 10000")
print(f"⚡ Drop index: True (性能优化)")

if not CSV_FILE.exists():
    print(f"❌ ERROR: CSV 文件不存在: {CSV_FILE}")
    sys.exit(1)

try:
    # 执行实际导入
    report = import_csv(
        csv_path=str(CSV_FILE),
        chunk_size=10000,
        dry_run=False,      # 实际写入数据库
        test_limit=0,       # 无限制，导入所有有效行
        drop_index=True,    # DROP/RECREATE 唯一索引以提升性能
    )

    print(f"\n{'='*60}")
    print(f"✓ IMPORT COMPLETED SUCCESSFULLY!")
    print(f"{'='*60}")
    if report:
        print(f"  Imported/Updated rows: {report.get('import_count', 'N/A')}")
        print(f"  Error count: {report.get('error_count', 'N/A')}")
        print(f"  Duration: {report.get('duration', 'N/A')}s")
except Exception as e:
    print(f"\n❌ IMPORT FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

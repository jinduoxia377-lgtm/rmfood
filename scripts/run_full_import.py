#!/usr/bin/env python3
"""Execute OpenFoodFacts CSV import with proper environment configuration.

IMPORTANT: This wrapper sets ALL necessary environment variables BEFORE
importing any application modules, avoiding the config.py global instance
issue that caused SECRET_KEY validation failures in previous attempts.
"""

import os
import sys
import secrets
from pathlib import Path

# ==================== 步骤 0: 确定项目路径 ====================
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent  # RMFOOD配方平台
BACKEND_DIR = PROJECT_ROOT / "backend"
CSV_FILE = PROJECT_ROOT / "openfoodfacts" / "en.openfoodfacts.org.products.csv"

print("=" * 70)
print("OpenFoodFacts 数据导入 - 受控环境包装器")
print("=" * 70)

# ==================== 步骤 1: 在导入任何 app 模块之前设置环境变量 ====================
print("\nSetting up secure environment variables...")

# SECRET_KEY - generate or from existing env
secret_key = os.environ.get('SECRET_KEY', '')
if not secret_key or len(secret_key) < 32:
    new_secret = secrets.token_urlsafe(64)
    os.environ['SECRET_KEY'] = new_secret
    print(f"  Generated new SECRET_KEY (length: {len(new_secret)})")
else:
    print(f"  Using existing SECRET_KEY (length: {len(secret_key)} chars)")

# Required environment variables
os.environ.setdefault('ENV', 'development')
os.environ.setdefault('DEBUG', 'False')
os.environ.setdefault('LOG_LEVEL', 'INFO')
os.environ.setdefault('ADMIN_USERNAME', 'admin_import')
os.environ.setdefault('ADMIN_PASSWORD', '')

# DATABASE_URL - validate and set default
db_url = os.environ.get('DATABASE_URL', '')
if not db_url or not db_url.startswith('postgresql'):
    default_db = 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood'
    print(f"  Using default DATABASE_URL: {default_db}")
    os.environ['DATABASE_URL'] = default_db
else:
    print(f"  DATABASE_URL already set: {db_url[:40]}...")

# Add to system path
project_root_str = str(PROJECT_ROOT)
if project_root_str not in sys.path:
    sys.path.insert(0, project_root_str)

backend_dir_str = str(BACKEND_DIR)
if backend_dir_str not in sys.path:
    sys.path.insert(0, backend_dir_str)

scripts_dir_str = str(SCRIPT_DIR)
if scripts_dir_str not in sys.path:
    sys.path.insert(0, scripts_dir_str)

print(f"\nCurrent working directory: {os.getcwd()}")
print(f"Python path (first 5 items):")
for p in sys.path[:5]:
    print(f"  {p}")
print("...")

# ==================== 步骤 2: 现在才导入 app 模块 ====================
print("\nEnvironment variables set successfully, loading import engine...")

try:
    from scripts.import_openfoodfacts_csv import import_csv
except ImportError as e:
    print(f"ERROR: Cannot import import_openfoodfacts_csv: {e}")
    print("Please ensure backend/ directory is in PYTHONPATH and structure is correct.")
    sys.exit(1)

# ==================== 步骤 3: 执行导入 ====================
csv_path = str(CSV_FILE)

print(f"\nCSV File: {csv_path}")
if not os.path.exists(csv_path):
    print(f"ERROR: CSV file does not exist!")
    sys.exit(1)

print(f"File size: {os.path.getsize(csv_path):,} bytes")

try:
    # Execute actual import
    # Note: This function internally connects to database and performs import
    import_csv(
        csv_path=csv_path,
        chunk_size=10000,      # Batch size for performance
        dry_run=False,         # Actually write to database
        test_limit=0,          # No row limit - import all valid rows
        drop_index=True,       # DROP/RECREATE unique index for speed
    )

    print("\n" + "=" * 70)
    print("IMPORT COMPLETED SUCCESSFULLY!")
    print("=" * 70)

except Exception as e:
    print("\n" + "=" * 70)
    print(f"IMPORT FAILED: {e}")
    print("=" * 70)
    import traceback
    traceback.print_exc()
    sys.exit(1)
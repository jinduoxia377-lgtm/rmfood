#!/usr/bin/env python3
"""Simulate the import process environment setup"""
import os
import sys
import secrets
from pathlib import Path

# Simulate what run_full_import.py does
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR
BACKEND_DIR = PROJECT_ROOT / "backend"

# Set environment variables just like run_full_import.py
secret_key = os.environ.get('SECRET_KEY', '')
if not secret_key or len(secret_key) < 32:
    new_secret = secrets.token_urlsafe(64)
    os.environ['SECRET_KEY'] = new_secret
    print(f"[OK] Generated new SECRET_KEY (length: {len(new_secret)})")
else:
    print(f"[OK] Using existing SECRET_KEY (length: {len(secret_key)} chars)")

os.environ.setdefault('ENV', 'development')
os.environ.setdefault('DEBUG', 'False')
os.environ.setdefault('LOG_LEVEL', 'INFO')
os.environ.setdefault('ADMIN_USERNAME', 'admin_import')
os.environ.setdefault('ADMIN_PASSWORD', '')

db_url = os.environ.get('DATABASE_URL', '')
if not db_url or not db_url.startswith('postgresql'):
    default_db = 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood'
    print(f"[OK] Using default DATABASE_URL: {default_db[:30]}...")
    os.environ['DATABASE_URL'] = default_db

# Add project to path
project_root_str = str(PROJECT_ROOT)
if project_root_str not in sys.path:
    sys.path.insert(0, project_root_str)

backend_dir_str = str(BACKEND_DIR)
if backend_dir_str not in sys.path:
    sys.path.insert(0, backend_dir_str)

print("\n[OK] Environment variables set successfully")

# Now try to import settings - THIS IS WHERE THE ERROR USED TO HAPPEN
try:
    # Force re-import of config module to simulate fresh state
    for mod in list(sys.modules.keys()):
        if 'core.config' in mod:
            del sys.modules[mod]

    from app.core.config import settings
    print("[OK] Successfully imported settings!")
    print(f"  - SECRET_KEY length: {len(settings.security.secret_key)}")
    print(f"  - ENV: {settings.app_env}")
    print(f"  - Database URL: {settings.database.url[:40]}...")
except Exception as e:
    print(f"[FAILED] Failed to import settings: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 50)
print("ALL TESTS PASSED - Import process should now work!")
print("=" * 50)

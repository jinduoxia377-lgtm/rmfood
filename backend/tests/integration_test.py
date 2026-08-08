#!/usr/bin/env python3
"""Full integration test simulating the import process"""
import os
import sys
import secrets
from pathlib import Path

# Setup - mimic run_full_import.py
PROJECT_ROOT = Path(__file__).resolve().parent  # Directory containing the script, not the script itself
os.environ['SECRET_KEY'] = secrets.token_urlsafe(64)
os.environ.setdefault('ENV', 'development')
os.environ.setdefault('DEBUG', 'False')
os.environ.setdefault('LOG_LEVEL', 'INFO')
os.environ['DATABASE_URL'] = 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood'

# Add paths - backend should contain the 'app' package
backend_dir = PROJECT_ROOT / 'backend'
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Note: We don't delete modules here because we want to use the already-loaded
# settings if available. The environment variables are set before any import.
# print("Forcing config module re-load...")
# For mod in ['app.core.config', 'app.core.settings']:
#     if mod in sys.modules:
#         del sys.modules[mod]

print("Testing full integration...")
print(f"SECRET_KEY in env: {bool(os.environ.get('SECRET_KEY'))}")
print(f"ENV in env: {os.environ.get('ENV')}")
print(f"sys.path:")
for p in sys.path:
    print(f"  {p}")
print(f"backend exists: {os.path.exists('backend')}")
print(f"app directory: {os.path.exists('backend/app')}")

# This is the critical import that used to fail
try:
    from app.core.config import settings
    print("[OK] Config loaded successfully!")
    print(f"  - Secret key length: {len(settings.security.secret_key)}")
    print(f"  - App environment: {settings.app_env}")
    print(f"  - Database URL: {settings.database.url[:40]}...")

    # Verify the secret key was properly set from env
    assert settings.security.secret_key == os.environ['SECRET_KEY'], \
        "SECRET_KEY mismatch between env and settings!"
    print("[OK] SECRET_KEY matches environment variable")

except Exception as e:
    print(f"[FAILED] Integration test failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("ALL INTEGRATION TESTS PASSED!")
print("=" * 60)

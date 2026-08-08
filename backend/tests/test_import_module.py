#!/usr/bin/env python3
"""Test importing the OpenFoodFacts import module"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__)
backend_dir = PROJECT_ROOT / "backend"
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(backend_dir))

# Set up environment first
import os
os.environ['SECRET_KEY'] = 'test-secret-key-32-chars-long-1234567890abcdef'
os.environ['ENV'] = 'development'
os.environ['DATABASE_URL'] = 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood'

try:
    # Import the module - this should NOT crash now
    from backend.scripts import import_openfoodfacts_csv
    print("[OK] Successfully imported import_openfoodfacts_csv module")

    # Check if import_csv function exists
    if hasattr(import_openfoodfacts_csv, 'import_csv'):
        print("[OK] import_csv function exists")
    else:
        print("[FAIL] import_csv function not found")

    # List all functions in the module
    print("\nFunctions in module:")
    for name in dir(import_openfoodfacts_csv):
        if name.startswith('import_') or name.startswith('get_') or name.startswith('_'):
            print(f"  {name}")

except ImportError as e:
    print(f"[FAILED] ImportError: {e}")
    sys.exit(1)
except Exception as e:
    print(f"[FAILED] Unexpected error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\nImport module tests passed!")

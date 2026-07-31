#!/usr/bin/env python3
"""Backend pre-deployment problem scanner - static analysis."""

import os
import sys
import re
from pathlib import Path

BASE_DIR = Path("d:/RMFOOD配方平台/backend")
sys.path.insert(0, str(BASE_DIR))

def check_requirements():
    print("[1] Dependency check")
    reqs = ["fastapi", "uvicorn", "sqlalchemy", "asyncpg", "httpx", "celery", "redis"]
    for pkg in reqs:
        try:
            __import__(pkg)
            print(f"  OK: {pkg}")
        except ImportError:
            print(f"  MISSING: {pkg} - add to requirements.txt")

def test_imports():
    print("[2] Module import test")
    modules = [
        ("app.main", "entry point"),
        ("app.core.config", "config"),
        ("app.api.v1.import_router", "import API"),
    ]
    for name, desc in modules:
        try:
            __import__(name)
            print(f"  OK: {name} ({desc})")
        except Exception as e:
            print(f"  FAIL: {name}: {e}")

def main():
    print("=" * 60)
    print("Backend Pre-Deployment Scanner")
    print("=" * 60)
    check_requirements()
    test_imports()
    print("
Scan complete. Review output above.")

if __name__ == "__main__":
    main()
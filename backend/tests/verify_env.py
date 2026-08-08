#!/usr/bin/env python3
"""Environment verification script"""
import os
import sys
import subprocess
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.resolve()  # Script's parent directory = project root
print("=" * 70)
print("RMFOOD 平台 - 环境验证")
print("=" * 70)

# Check Python version
print("")
print("[1/6] Python version:")
python_result = subprocess.run([sys.executable, "--version"], capture_output=True, text=True)
print("   " + python_result.stdout.strip())

# Check critical modules
print("")
print("[2/6] Critical Python packages:")
modules = ['asyncpg', 'pydantic', 'pydantic-settings']
for mod in modules:
    try:
        __import__(mod)
        print("   [OK] %s available" % mod)
    except ImportError:
        print("   [MISSING] %s NOT available" % mod)

# Check environment variables
print("")
print("[3/6] Environment variables:")
env_vars = ['SECRET_KEY', 'ENV', 'DATABASE_URL']
for var in env_vars:
    val = os.environ.get(var, '(not set)')
    if val == '(not set)':
        print("   [" + var + "] = " + val)
    else:
        print("   [" + var + "] = " + val[:40] + ("..." if len(val)>40 else ""))

# Check directories
print("")
print("[4/6] Required directories:")
dirs = [
    (PROJECT_ROOT / "openfoodfacts", "OpenFoodFacts data directory"),
    (PROJECT_ROOT / "backend", "Backend code directory"),
    (PROJECT_ROOT / "logs", "Log directory"),
]
for path, desc in dirs:
    exists = path.exists()
    marker = "exists" if exists else "MISSING"
    print("   " + ("%d" % exists if exists else "-") + " " + desc + ": " + str(path) + " (" + marker + ")")

# Create missing directories
for path, _ in dirs:
    if not path.exists():
        try:
            path.mkdir(parents=True, exist_ok=True)
            print("   -> Created: " + str(path))
        except Exception as e:
            print("   Failed to create " + str(path) + ": " + str(e))

print("")
print("=" * 70)

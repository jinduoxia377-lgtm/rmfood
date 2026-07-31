#!/usr/bin/env python3
"""执行 OpenFoodFacts CSV 导入 - 终极方案"""
import os
import sys
import io

# 确保所有输出都使用 UTF-8，避免 Windows 编码问题
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

os.chdir("D:/RMFOOD配方平台/backend")
sys.path.insert(0, "D:/RMFOOD配方平台/backend")

# 设置环境变量
os.environ['DATABASE_URL'] = 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood'
os.environ['ENV'] = 'development'
os.environ['DEBUG'] = 'False'

print("Starting import...")
print(f"Working directory: {os.getcwd()}")
print(f"Database URL set: {os.environ.get('DATABASE_URL')[:30]}...")

# 直接调用 main via subprocess to isolate environment
import subprocess

result = subprocess.run(
    [sys.executable, "scripts/import_openfoodfacts_csv.py", "--test-limit", "500", "--no-drop-index"],
    capture_output=True,
    text=True,
    encoding='utf-8',
    errors='replace',
    env=os.environ.copy(),
    timeout=120
)

print("\n=== Command completed with exit code:", result.returncode)
print("\n=== STDOUT (last 20 lines) ===")
lines = result.stdout.strip().split('\n')
for line in lines[-20:]:
    print(line)

if result.stderr:
    print("\n=== STDERR (last 10 lines) ===")
    lines_err = result.stderr.strip().split('\n')
    for line in lines_err[-10:]:
        print(line)

if result.returncode == 0:
    print("\n✅ IMPORT SUCCESS!")
else:
    print("\n⚠️  IMPORT WITH ERRORS - Check log above")

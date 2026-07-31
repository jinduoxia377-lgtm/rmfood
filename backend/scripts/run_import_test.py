import os
import sys
import subprocess

# 切换到 backend 目录
os.chdir(r"D:\RMFOOD配方平台\backend")

# 设置环境变量
env = os.environ.copy()
env['DATABASE_URL'] = 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood'
env['ENV'] = 'development'
env['DEBUG'] = 'False'

print("Starting import process...")
print(f"Working directory: {os.getcwd()}")

# 运行导入子进程
result = subprocess.run(
    [sys.executable, "scripts/import_openfoodfacts_csv.py", "--test-limit", "500", "--no-drop-index"],
    capture_output=True,
    text=True,
    encoding='utf-8',
    errors='replace',
    env=env,
    timeout=180
)

print("\n" + "="*60)
print(f"Import completed with exit code: {result.returncode}")
print("="*60)

if result.stdout:
    lines = result.stdout.strip().split('\n')
    for line in lines[-15:]:
        print(line)

if result.stderr and "error" in result.stderr.lower():
    print("\n--- STDERR ---")
    print(result.stderr[-500:])

if result.returncode == 0:
    print("\n✅ SUCCESS: Import completed!")
else:
    print("\n⚠️  WARNING: Import completed with errors (check output above)")

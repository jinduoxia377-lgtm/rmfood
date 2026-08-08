#!/usr/bin/env python3
"""Run the sync import test with psycopg2"""
import os
import sys
import subprocess

os.chdir(r"D:\RMFOOD配方平台\backend")

env = os.environ.copy()
env['DATABASE_URL'] = 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood'
env['ENV'] = 'development'
env['DEBUG'] = 'False'

print("Starting sync import process...")
print(f"Working directory: {os.getcwd()}")

# Run the sync import script
result = subprocess.run(
    [sys.executable, "scripts/import_offsync.py", "--test-limit", "500", "--no-drop-index"],
    capture_output=True,
    text=True,
    encoding='utf-8',
    errors='replace',
    env=env,
    timeout=600  # 10 minutes for potentially large operation
)

print("\n" + "="*60)
print(f"Import completed with exit code: {result.returncode}")
print("="*60)

if result.stdout:
    lines = result.stdout.strip().split('\n')
    for line in lines[-20:]:
        print(line)

if result.stderr:
    try:
        print("\n--- STDERR ---")
        print(result.stderr[-500:])
    except Exception as e:
        print(f"\n--- STDERR (encoding issue) ---: {e}")

if result.returncode == 0:
    print("\nSUCCESS: Import completed!")
else:
    print("\nWARNING: Import completed with errors (check output above)")

#!/usr/bin/env python3
"""Run import test and save output to file"""
import os
import sys
import subprocess

os.chdir(r"D:\RMFOOD配方平台\backend")

env = os.environ.copy()
env['DATABASE_URL'] = 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood'
env['ENV'] = 'development'
env['DEBUG'] = 'False'

print('Starting sync import...')

result = subprocess.run(
    [sys.executable, 'scripts/import_offsync.py', '--test-limit', '500', '--no-drop-index'],
    capture_output=True,
    text=True,
    encoding='utf-8',
    errors='replace',
    env=env,
    timeout=600
)

with open('import_sync_result.txt', 'w', encoding='utf-8') as f:
    f.write(f'Exit code: {result.returncode}\n\n')
    f.write('STDOUT:\n')
    f.write(result.stdout)
    f.write('\nSTDERR:\n')
    f.write(result.stderr if result.stderr else '(empty)')

print(f'Exported to import_sync_result.txt (exit code: {result.returncode})')

if result.stdout:
    lines = result.stdout.strip().split('\n')
    for line in lines[-10:]:
        print(line)

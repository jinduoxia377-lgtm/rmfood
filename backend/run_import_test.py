#!/usr/bin/env python3
"""OpenFoodFacts CSV 导入测试 - 直接执行 500 条"""
import os
import sys

os.chdir("d:/RMFOOD配方平台/backend")

# 设置环境变量
os.environ['DATABASE_URL'] = 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood'
os.environ['ENV'] = 'development'
os.environ['DEBUG'] = 'False'

# 执行导入
cmd = 'python scripts/import_openfoodfacts_csv.py --test-limit 500 --no-drop-index'
print(f"执行命令: {cmd}")
print()

# 直接运行子进程并输出到 stdout
import subprocess
result = subprocess.run(cmd, shell=True)

if result.returncode == 0:
    print("\n✅ 导入成功完成！")
else:
    print(f"\n❌ 导入失败，退出码: {result.returncode}")
    sys.exit(result.returncode)

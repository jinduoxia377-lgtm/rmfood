#!/usr/bin/env python3
"""执行 OpenFoodFacts CSV 导入测试"""
import os
import sys
import subprocess

os.chdir("D:/RMFOOD配方平台/backend")

# 设置环境变量
env = os.environ.copy()
env['DATABASE_URL'] = 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood'
env['ENV'] = 'development'

print(f"当前目录: {os.getcwd()}")
print(f"数据库URL: {env['DATABASE_URL']}")
print()

# 运行导入命令
cmd = [sys.executable, 'scripts/import_openfoodfacts_csv.py', '--test-limit', '500', '--no-drop-index']
print(f"运行命令: {' '.join(cmd)}")

try:
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace',
        env=env,
        timeout=120
    )

    print("\n" + "="*60)
    print("导出结果:")
    print("="*60)

    # 显示最后部分输出（避免过长）
    output = result.stdout
    if len(output) > 5000:
        output = output[-5000:]
    print(output)

    if result.stderr:
        print("\n--- STDERR ---")
        print(result.stderr[-2000:] if len(result.stderr) > 2000 else result.stderr)

    print(f"\n退出码: {result.returncode}")

    if result.returncode == 0:
        print("\n✅ 导入成功完成！")
    else:
        print("\n❌ 导入失败，请检查上面的错误信息")

except subprocess.TimeoutExpired:
    print("\n⚠️ 导入超时（120秒），可能需要更长时间或遇到问题")
except Exception as e:
    print(f"\n错误: {type(e).__name__}: {e}")

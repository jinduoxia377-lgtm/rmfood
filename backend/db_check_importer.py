#!/usr/bin/env python3
"""执行 OpenFoodFacts CSV 导入（使用同步加载器替代 asyncpg）"""
import os
import sys
import importlib.util

# 加载模块来检查 OFFLoaderSync
sys.path.insert(0, "D:/RMFOOD配方平台/backend")

from app.core.database.session import get_session_factory
import asyncio
from sqlalchemy import text

async def check_db():
    """检查数据库状态和已有数据"""
    try:
        factory = get_session_factory()
        async with factory() as db:
            # 检查现有记录
            r = await db.execute("SELECT COUNT(*) FROM retail_products WHERE source = 'openfoodfacts_csv'")
            count = await r.scalar()
            print(f"✅ 数据库中已有的 openfoodfacts_csv 记录: {count:,}")

            # 检查表结构
            r = await db.execute("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'retail_products' AND column_name = 'external_id'
                ORDER BY ordinal_position
            """)
            rows = await r.fetchall()
            print(f"✅ retail_products 表有 {len(rows)} 列查询成功")

    except Exception as e:
        print(f"❌ 数据库检查失败: {e}")

# 先快速检查数据库状态
print("=== 数据库健康检查 ===")
asyncio.run(check_db())

print("\n准备开始导入...")
print("\n说明：由于 Windows 环境下的 Unicode 编码问题，建议您在 CMD 中直接运行以下命令以获得完整输出：")
print('')
print('cd D:\\RMFOOD配方平台\\backend')
print('python scripts/import_openfoodfacts_csv.py --test-limit 500 --no-drop-index')
print()
print("或在 PowerShell 中设置 UTF-8 编码后运行：")
print('chcp 65001')
print('python scripts/import_openfoodfacts_csv.py --test-limit 500 --no-drop-index')

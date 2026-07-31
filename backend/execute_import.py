#!/usr/bin/env python3
"""直接执行 OpenFoodFacts CSV 导入测试（500行）"""
import os
import sys
import asyncio
import logging

# 设置工作目录
os.chdir("D:/RMFOOD配方平台/backend")

# 添加 backend 到路径
sys.path.insert(0, "D:/RMFOOD配方平台/backend")

# 配置日志 - 使用 UTF-8 编码避免 Unicode 问题
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler("import_runner.log", encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ],
)
logger = logging.getLogger(__name__)

# 强制设置环境变量
os.environ['DATABASE_URL'] = 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood'
os.environ['ENV'] = 'development'
os.environ['DEBUG'] = 'False'

# 直接导入并运行
try:
    # 修改 sys.argv 模拟命令行参数
    import importlib.util
    spec = importlib.util.spec_from_file_location("import_csv", "scripts/import_openfoodfacts_csv.py")
    mod = importlib.util.module_from_spec(spec)

    # 临时替换 argv
    old_argv = sys.argv
    sys.argv = ["import_openfoodfacts_csv.py", "--test-limit", "500", "--no-drop-index"]

    spec.loader.exec_module(mod)

    sys.argv = old_argv

    print("\n✅ 导入命令已成功触发！请等待...")
    print("检查日志文件 import_runner.log 获取详细结果。")

except Exception as e:
    logger.error(f"执行失败: {e}")
    import traceback
    traceback.print_exc()
    print(f"\n❌ 错误: {e}")

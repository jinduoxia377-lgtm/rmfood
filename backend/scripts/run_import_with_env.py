#!/usr/bin/env python
"""
带环境变量前置配置的OpenFoodFacts数据导入脚本入口

确保在导入任何配置模块之前先设置必需的环境变量。
"""

import os
import sys
from pathlib import Path

# 项目根目录（script的上一级）
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# ── 环境配置 ───────────────────────────────────────────────

# 读取.env文件中的配置（简单实现）
env_file = PROJECT_ROOT / ".env"
if env_file.exists():
    with open(env_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip()
                if value:  # 空值也设置，让pydantic使用默认值
                    os.environ[key] = value

# 设置必要的开发环境默认值（如果未设置）
os.environ.setdefault("ENV", "development")
os.environ.setdefault("DEBUG", "False")
os.environ.setdefault("LOG_LEVEL", "INFO")

# 为数据库连接提供默认值（如未设置）
if "DATABASE_URL" not in os.environ:
    os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:password@localhost:5432/rmfood"

# 生成或获取SECRET_KEY
if "SECRET_KEY" not in os.environ or len(os.environ["SECRET_KEY"]) < 32:
    import secrets
    os.environ["SECRET_KEY"] = secrets.token_urlsafe(32)
    print(f"⚠️ 生成的SECRET_KEY已设置到环境变量（长度: {len(os.environ['SECRET_KEY'])}）")

# ── 执行实际导入 ───────────────────────────────────────────

# 确保backend在PATH中以便导入app模块
backend_dir = PROJECT_ROOT / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# 现在安全地导入实际的导入脚本
from importlib import util
spec = util.spec_from_file_location("import_openfoodfacts_csv", backend_dir / "scripts" / "import_openfoodfacts_csv.py")
if spec is None or spec.loader is None:
    raise RuntimeError("无法找到import_openfoodfacts_csv模块")

module = util.module_from_spec(spec)
sys.modules["import_openfoodfacts_csv"] = module
spec.loader.exec_module(module)

# 调用主函数（如果存在）
if hasattr(module, "main"):
    module.main()
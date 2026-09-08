"""脚本数据库连接工具 — 从 .env 读取 DATABASE_URL"""
import asyncio
import os
import sys
from functools import lru_cache

# 从项目根目录（backend/../）解析 .env
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ENV_PATH = os.path.join(_PROJECT_ROOT, "backend", ".env")


@lru_cache(maxsize=1)
def get_db_url() -> str:
    """读取 .env 中的 DATABASE_URL，失败时返回默认值"""
    if os.path.exists(_ENV_PATH):
        with open(_ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    if key.strip() == "DATABASE_URL":
                        return val.strip()
    # 兜底：从环境变量或系统配置读取
    return os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:password@localhost:5432/rmfood",
    )


def get_asyncpg_dsn() -> str:
    """转换为 asyncpg 兼容的 DSN（去掉 +asyncpg 前缀）"""
    url = get_db_url()
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://", 1)
    return url


async def connect():
    """便捷连接函数"""
    import asyncpg
    return await asyncpg.connect(get_asyncpg_dsn())

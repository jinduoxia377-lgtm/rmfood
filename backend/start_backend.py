#!/usr/bin/env python
"""启动后端服务（推荐方式：直接运行 uvicorn）

此脚本仅作为兼容层，实际启动应使用：
  uvicorn app.main:app --host 0.0.0.0 --port 8000

配置通过 .env 文件和系统环境变量自动加载，无需硬编码。
"""
import asyncio
import os
import sys
from pathlib import Path


def add_backend_to_path():
    """确保 backend 目录在 Python 路径中，使用相对路径而非硬编码编码路径."""
    # 确定当前脚本所在目录的 parent（即 project root）
    script_dir = Path(__file__).resolve().parent
    backend_dir = script_dir / "backend"

    if backend_dir not in sys.path:
        sys.path.insert(0, str(backend_dir))


async def run():
    """启动 uvicorn 服务器."""
    add_backend_to_path()

    from uvicorn import Config, Server

    server = Server(
        config=Config(
            app="app.main:app",
            host="0.0.0.0",
            port=int(os.getenv("PORT", "9000")),
            log_level=os.getenv("LOG_LEVEL", "info").lower(),
            reload=os.getenv("DEBUG", "false").lower() == "true",
        )
    )
    print("Starting RMFOOD backend...")
    await server.serve()


if __name__ == "__main__":
    asyncio.run(run())

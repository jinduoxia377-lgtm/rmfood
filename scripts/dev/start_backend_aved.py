#!/usr/bin/env python3
"""RMFOOD 后端启动脚本 - 方式A (uvicorn)"""
import os
import sys
from pathlib import Path

# 使用绝对路径避免编码问题
project_root = Path('d:/RMFOOD配方平台')
backend_dir = project_root / 'backend'

# 确保当前工作目录正确
os.chdir(backend_dir)

# 添加 backend 到 Python path（使其能够导入 app 模块）
sys.path.insert(0, str(backend_dir))

# 设置环境变量
os.environ.setdefault('ENV', 'development')
os.environ.setdefault('DEBUG', 'true')
os.environ.setdefault('SECRET_KEY', 'test-secret-key-for-development-only-minimum-32')
os.environ.setdefault('DATABASE_URL', 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood')

print(f"Working directory: {backend_dir}")
print(f"Python path: {[p for p in sys.path if 'RMFOOD' in p]}")
print(f"Environment: ENV={os.environ['ENV']}, DEBUG={os.environ['DEBUG']}")

# 启动 uvicorn
if __name__ == '__main__':
    from uvicorn import Config, Server

    # 检查 app 是否可导入
    try:
        import app.main
        print("✓ app.main 模块可导入")
    except Exception as e:
        print(f"✗ 导入失败: {e}")
        sys.exit(1)

    server = Server(
        config=Config(
            app="app.main:app",
            host="0.0.0.0",
            port=8000,
            log_level="info",
            reload=True,  # 开发模式启用热重载
        )
    )
    print("\nStarting RMFOOD backend (Development Mode)...")
    print("http://localhost:8000/docs")
    print("Press Ctrl+C to stop")
    server.serve()

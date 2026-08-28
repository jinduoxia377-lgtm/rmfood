# RMFOOD 服务启动脚本
# 用法: python start_all.py [backend|frontend|all]

import subprocess
import sys
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def start_backend():
    """启动后端服务"""
    print("[Backend] 启动中...")
    cmd = [
        sys.executable, "-m", "uvicorn", "app.main:app",
        "--host", "0.0.0.0", "--port", "8000",
        "--reload"
    ]
    subprocess.run(cmd, cwd=os.path.join(BASE_DIR, "backend"))

def start_frontend():
    """启动前端服务"""
    print("[Frontend] 启动中...")
    cmd = ["npx", "vite", "--port", "3000", "--host", "0.0.0.0"]
    subprocess.run(cmd, cwd=os.path.join(BASE_DIR, "frontend"))

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "all"
    if target in ("backend", "all"):
        start_backend()
    if target in ("frontend", "all"):
        start_frontend()

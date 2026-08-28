# RMFOOD 后端启动脚本
# 用法: python start_all.py [dev|prod|restart]

import subprocess
import sys
import os
import signal

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VENV_PYTHON = os.path.join(BASE_DIR, ".venv", "Scripts", "python.exe")
DEFAULT_PYTHON = sys.executable

PYTHON = VENV_PYTHON if os.path.exists(VENV_PYTHON) else DEFAULT_PYTHON

def start(mode="dev"):
    """启动后端服务"""
    host = "0.0.0.0"
    port = 8000
    reload = mode == "dev"
    
    cmd = [PYTHON, "-m", "uvicorn", "app.main:app",
           "--host", host, "--port", str(port)]
    if reload:
        cmd.append("--reload")
    
    print(f"[Backend] 启动: {' '.join(cmd)}")
    subprocess.run(cmd, cwd=BASE_DIR)

def stop():
    """停止所有后端进程"""
    import psutil
    for proc in psutil.process_iter(['pid', 'cmdline']):
        try:
            cmdline = " ".join(proc.info['cmdline'] or [])
            if "uvicorn" in cmdline and "app.main" in cmdline:
                proc.kill()
                print(f"[Backend] 已终止 PID {proc.info['pid']}")
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "dev"
    if mode == "stop":
        stop()
    else:
        start(mode)

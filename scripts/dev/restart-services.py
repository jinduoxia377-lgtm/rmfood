#!/usr/bin/env python3
"""RMFOOD 项目安全重启脚本"""
import os
import sys
import time
import signal
import subprocess
import urllib.request
from pathlib import Path

PROJECT_ROOT = Path(r"D:\RMFOODFP")
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"
LOGS_DIR = PROJECT_ROOT / "logs"

def log(msg, color="white"):
    colors = {
        "green": "\033[92m",
        "red": "\033[91m",
        "yellow": "\033[93m",
        "cyan": "\033[96m",
        "white": "\033[97m"
    }
    print(f"{colors.get(color, colors['white'])}{msg}\033[0m")

def check_port(port):
    """检查端口是否被监听"""
    try:
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True, text=True, timeout=5
        )
        for line in result.stdout.split('\n'):
            if f":{port}" in line and "LISTENING" in line:
                # 提取PID
                parts = line.strip().split()
                if parts:
                    return int(parts[-1])
    except:
        pass
    return None

def kill_process(pid):
    """安全终止指定进程"""
    if pid:
        try:
            os.kill(pid, signal.SIGTERM)
            log(f"  已发送终止信号到进程 {pid}", "yellow")
            time.sleep(2)
            # 如果还在运行，强制终止
            try:
                os.kill(pid, 0)  # 检查进程是否存在
                os.kill(pid, signal.SIGKILL)
                log(f"  已强制终止进程 {pid}", "red")
            except ProcessLookupError:
                pass
        except Exception as e:
            log(f"  终止进程 {pid} 失败: {e}", "red")

def start_backend():
    """启动后端服务"""
    log("\n[2/3] 启动后端服务 (端口 8000)...", "cyan")

    # 安装缺失的依赖
    venv_python = BACKEND_DIR / ".venv" / "Scripts" / "python.exe"
    if venv_python.exists():
        log("  安装缺失的依赖...", "yellow")
        subprocess.run(
            [str(venv_python), "-m", "pip", "install", "apscheduler", "celery", "-q"],
            capture_output=True
        )

    # 创建日志目录
    LOGS_DIR.mkdir(exist_ok=True)

    # 启动后端
    log("  启动 uvicorn 服务器...", "yellow")
    log(f"  工作目录: {BACKEND_DIR}", "white")

    process = subprocess.Popen(
        [str(venv_python), "-m", "uvicorn", "app.main:app",
         "--host", "0.0.0.0", "--port", "8000", "--reload"],
        cwd=str(BACKEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    # 等待启动
    log("  等待后端初始化 (15秒)...", "yellow")
    time.sleep(15)

    # 检查健康状态
    try:
        response = urllib.request.urlopen("http://localhost:8000/health", timeout=3)
        if response.status == 200:
            log("  [OK] 后端健康检查通过", "green")
            return True, process
    except Exception as e:
        log(f"  [WARN] 后端健康检查失败: {e}", "red")
        # 检查是否是端口问题
        backend_pid = check_port(8000)
        if backend_pid:
            log(f"  后端进程 PID: {backend_pid}", "yellow")
        return False, process

def start_frontend():
    """启动前端服务"""
    log("\n[3/3] 启动前端服务 (端口 3000)...", "cyan")

    # 检查 node_modules
    node_modules = FRONTEND_DIR / "node_modules"
    if not node_modules.exists():
        log("  安装前端依赖...", "yellow")
        subprocess.run(["npm", "install"], cwd=str(FRONTEND_DIR), capture_output=True)

    # 启动前端
    log("  启动 Vite 开发服务器...", "yellow")

    process = subprocess.Popen(
        ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"],
        cwd=str(FRONTEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    # 等待启动
    log("  等待前端构建 (10秒)...", "yellow")
    time.sleep(10)

    # 检查是否运行
    frontend_pid = check_port(3000)
    if frontend_pid:
        log(f"  [OK] 前端已启动 (PID: {frontend_pid})", "green")
        return True, process
    else:
        log("  [WARN] 前端可能未正常启动", "red")
        return False, process

def main():
    log("=" * 50, "cyan")
    log("   RMFOOD 项目重启", "cyan")
    log("=" * 50, "cyan")

    # Step 1: 停止现有服务
    log("\n[1/3] 停止现有服务...", "cyan")

    # 查找并终止前端进程
    frontend_pid = check_port(3000)
    if frontend_pid:
        log(f"  发现前端进程 PID: {frontend_pid}", "yellow")
        kill_process(frontend_pid)

    # 查找并终止后端进程
    backend_pid = check_port(8000)
    if backend_pid:
        log(f"  发现后端进程 PID: {backend_pid}", "yellow")
        kill_process(backend_pid)

    time.sleep(2)
    log("  服务已停止", "green")

    # Step 2 & 3: 启动服务
    backend_ok, backend_proc = start_backend()
    frontend_ok, frontend_proc = start_frontend()

    # 总结
    log("\n" + "=" * 50, "cyan")
    log("   重启完成！", "green")
    log("=" * 50, "cyan")

    log("\n访问地址:", "white")
    log("  - 前端:      http://localhost:3000" + (" [OK]" if frontend_ok else " [FAIL]"),
        "green" if frontend_ok else "red")
    log("  - 后端 API:  http://localhost:8000" + (" [OK]" if backend_ok else " [FAIL]"),
        "green" if backend_ok else "red")
    log("  - API文档:   http://localhost:8000/docs", "white")
    log("")

    # 保持进程运行
    log("按 Ctrl+C 停止服务", "yellow")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log("\n正在停止服务...", "yellow")
        if backend_proc:
            backend_proc.terminate()
        if frontend_proc:
            frontend_proc.terminate()
        log("服务已停止", "green")

if __name__ == "__main__":
    main()

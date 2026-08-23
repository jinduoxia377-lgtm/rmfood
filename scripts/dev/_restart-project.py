"""RMFOOD 项目重启脚本"""
import os, signal, subprocess, time, sys
from pathlib import Path

PROJECT_ROOT = Path(r"D:\RMFOODFP")
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"

def kill_processes():
    """终止所有 Python 和 Node 进程"""
    print("[1/4] 停止所有服务...")
    try:
        # 使用 taskkill 终止所有 python.exe 和 node.exe
        subprocess.run(["taskkill", "/F", "/IM", "python.exe"], capture_output=True)
        subprocess.run(["taskkill", "/F", "/IM", "node.exe"], capture_output=True)
        print("  已停止所有服务。")
    except Exception as e:
        print(f"  停止失败: {e}")

def start_backend():
    """启动后端服务"""
    print("\n[2/4] 启动后端服务 (http://localhost:8000)...")
    try:
        python_exe = BACKEND_DIR / ".venv" / "Scripts" / "python.exe"
        if not python_exe.exists():
            print(f"  错误: 找不到 Python 虚拟环境 {python_exe}")
            return False

        # 在后台启动后端
        subprocess.Popen(
            [str(python_exe), "-m", "uvicorn", "app.main:app",
             "--host", "0.0.0.0", "--port", "8000", "--reload"],
            cwd=str(BACKEND_DIR),
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
        )
        print("  后端已启动 (等待初始化)...")
        time.sleep(6)

        # 健康检查
        import urllib.request
        try:
            r = urllib.request.urlopen("http://localhost:8000/health", timeout=3)
            if r.status == 200:
                print("  [OK] 后端健康检查通过")
                return True
        except:
            pass
        return False
    except Exception as e:
        print(f"  启动失败: {e}")
        return False

def start_frontend():
    """启动前端服务"""
    print("\n[3/4] 启动前端服务 (http://localhost:3000)...")
    try:
        npm_exe = "npm"
        node_modules = FRONTEND_DIR / "node_modules"

        if not node_modules.exists():
            print("  安装依赖...")
            subprocess.run([npm_exe, "install"], cwd=str(FRONTEND_DIR), capture_output=True)

        # 在后台启动前端
        subprocess.Popen(
            [npm_exe, "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"],
            cwd=str(FRONTEND_DIR),
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
        )
        print("  前端已启动 (等待初始化)...")
        time.sleep(5)

        # 简单检查端口
        import urllib.request
        try:
            r = urllib.request.urlopen("http://localhost:3000", timeout=3)
            if r.status == 200:
                print("  [OK] 前端已启动")
                return True
        except:
            pass
        return False
    except Exception as e:
        print(f"  启动失败: {e}")
        return False

def main():
    print("=" * 40)
    print("   RMFOOD 项目重启")
    print("=" * 40)

    kill_processes()
    time.sleep(2)

    backend_ok = start_backend()
    frontend_ok = start_frontend()

    print("\n" + "=" * 40)
    print("   重启完成！")
    print("=" * 40)
    print("\n访问地址:")
    print("  - 前端:      http://localhost:3000")
    print("  - 后端 API:  http://localhost:8000")
    print("  - API文档:   http://localhost:8000/docs")
    print("  - PostgreSQL: localhost:5432")
    print()

if __name__ == "__main__":
    main()

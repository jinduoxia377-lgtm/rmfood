@echo off
REM RMFOOD 配方平台 - 局域网快速启动脚本
REM 使用说明：双击运行此脚本自动启动所有服务

setlocal enabledelayedexpansion

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║        RMFOOD 配方平台 - 局域网部署启动脚本                  ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

REM 检查 Python
echo [检查] Python 是否已安装...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Python 未安装或未添加到 PATH
    pause
    exit /b 1
)
echo [✓] Python 已安装

REM 检查 npm
echo [检查] npm 是否已安装...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] npm 未安装或未添加到 PATH
    pause
    exit /b 1
)
echo [✓] npm 已安装

REM 检查 Docker（如果使用 Docker）
REM docker --version >nul 2>&1
REM if %errorlevel% neq 0 (
REM     echo [警告] Docker 未安装，将使用本地启动模式
REM )

echo.
echo ════════════════════════════════════════════════════════════════
echo [启动] RMFOOD 配方平台服务...
echo ════════════════════════════════════════════════════════════════
echo.

REM 启动后端
echo [后端] 启动 FastAPI 服务...
cd backend
start "RMFOOD Backend" cmd /k "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1"
timeout /t 3 /nobreak

REM 启动前端
echo [前端] 启动 Vite 开发服务器...
cd ..\frontend
start "RMFOOD Frontend" cmd /k "npm run dev -- --host 0.0.0.0 --port 3000"

echo.
echo ════════════════════════════════════════════════════════════════
echo [✓] 所有服务已启动！
echo ════════════════════════════════════════════════════════════════
echo.
echo 📍 本机 IP 地址：192.168.137.1
echo.
echo 🌐 访问地址：
echo   • 前端应用：http://192.168.137.1:3000 (或 3001)
echo   • 后端 API：http://192.168.137.1:8000
echo   • API 文档：http://192.168.137.1:8000/docs
echo.
echo 💡 在其他设备上访问：
echo   • 同一局域网的其他设备可以使用上述 IP 地址访问
echo   • 确保两台设备在同一个 WiFi 或网络中
echo.
echo ⚠️  按 Ctrl+C 可停止任何窗口中的服务
echo.
echo ════════════════════════════════════════════════════════════════
echo.
echo 正在打开浏览器...
timeout /t 2 /nobreak

REM 打开浏览器
start "" http://localhost:3001

pause

@echo off
REM RMFOOD 配方平台 - 停止脚本
REM 用于停止所有运行中的服务

setlocal enabledelayedexpansion

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║          RMFOOD 配方平台 - 停止所有服务                      ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

REM 检查是否以管理员身份运行
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] 建议以管理员身份运行此脚本
    echo.
)

REM 停止 Python 进程（Uvicorn）
echo [停止] 停止 Python 进程...
taskkill /F /IM python.exe 2>nul
if %errorlevel% equ 0 (
    echo [✓] Python 进程已停止
) else (
    echo [提示] 未找到 Python 进程
)

REM 停止 Node 进程（Vite）
echo [停止] 停止 Node 进程...
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo [✓] Node 进程已停止
) else (
    echo [提示] 未找到 Node 进程
)

REM 停止 Docker Compose
echo [停止] 停止 Docker 容器...
docker-compose -f docker-compose.lan.yml down 2>nul
if %errorlevel% equ 0 (
    echo [✓] Docker 容器已停止
) else (
    echo [提示] Docker Compose 未运行
)

echo.
echo ════════════════════════════════════════════════════════════════
echo [✓] 所有服务已停止！
echo ════════════════════════════════════════════════════════════════
echo.

pause

@echo off
chcp 65001 >nul
echo ========================================
echo RMFOOD 配方平台 - 一键启动脚本
echo ========================================

:: 设置后端端口为可用端口 (8080)
set PORT=8080

:: 启动后端服务
echo [1/2] 正在启动后端服务...
cd /d %~dp0backend
python -m uvicorn app.main:app --host 0.0.0.0 --port %PORT% --reload 2>&1

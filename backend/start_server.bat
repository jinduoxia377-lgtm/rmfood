@echo off
REM RMFOOD 后端服务启动脚本

REM 切换到 backend 目录（确保 uvicorn 能找到 app 模块）
cd /d %~dp0

REM 检查 Python 是否安装
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python is not installed or not in PATH
    pause
    exit /b 1
)

REM 优先使用 .venv（uv 管理，Python 3.12+）
if exist ".venv\Scripts\python.exe" (
    set PYTHON=.venv\Scripts\python.exe
) else if exist "venv\Scripts\python.exe" (
    set PYTHON=venv\Scripts\python.exe
) else (
    echo Error: No virtual environment found
    pause
    exit /b 1
)

REM 安装依赖
echo Installing dependencies...
%PYTHON% -m pip install -r requirements.txt >nul 2>&1

REM 创建必要的目录
echo Creating necessary directories...
mkdir logs 2>nul
mkdir uploads 2>nul
mkdir temp_files 2>nul

REM 启动服务
echo Starting RMFOOD backend service...
echo Service will run at http://localhost:8000
echo Health check: http://localhost:8000/health
echo API docs: http://localhost:8000/docs

%PYTHON% -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
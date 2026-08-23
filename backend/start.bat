@echo off
REM RMFOOD 后端服务启动脚本

setlocal

REM 切换到 backend 目录（确保 uvicorn 能找到 app 模块）
cd /d %~dp0

REM 检查 Python 是否安装
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: Python 未安装或未添加到环境变量
    pause
    exit /b 1
)

REM 优先使用 .venv（uv 管理，Python 3.12+）
if exist ".venv\Scripts\python.exe" (
    set PYTHON=.venv\Scripts\python.exe
) else if exist "venv\Scripts\python.exe" (
    set PYTHON=venv\Scripts\python.exe
) else (
    echo 错误: 未找到虚拟环境，请运行: uv venv && uv pip install -r requirements.txt
    pause
    exit /b 1
)

REM 安装依赖
echo 正在安装依赖...
%PYTHON% -m pip install -r requirements.txt >nul 2>&1
if %errorlevel% neq 0 (
    echo 警告: 依赖安装失败，尝试使用 uv...
    uv pip install -r requirements.txt
)

REM 创建必要的目录
echo 正在创建必要的目录...
mkdir logs 2>nul
mkdir uploads 2>nul
mkdir temp_files 2>nul

REM 启动服务
echo 正在启动 RMFOOD 后端服务...
echo 服务将在 http://localhost:8000 上运行
echo 健康检查: http://localhost:8000/health
echo API 文档: http://localhost:8000/docs

%PYTHON% -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

endlocal
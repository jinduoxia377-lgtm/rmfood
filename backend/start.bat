@echo off
REM RMFOOD 后端服务启动脚本

setlocal

REM 检查 Python 是否安装
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: Python 未安装或未添加到环境变量
    pause
    exit /b 1
)

REM 检查依赖是否已安装
if not exist "venv" (
    echo 正在创建虚拟环境...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo 错误: 创建虚拟环境失败
        pause
        exit /b 1
    )
)

REM 激活虚拟环境
echo 正在激活虚拟环境...
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo 错误: 激活虚拟环境失败
    pause
    exit /b 1
)

REM 安装依赖
echo 正在安装依赖...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo 错误: 安装依赖失败
    pause
    exit /b 1
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

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

endlocal
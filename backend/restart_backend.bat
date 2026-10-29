@echo off
echo Stopping backend...
taskkill /F /IM python.exe 2>nul
timeout /t 2 /nobreak >nul
echo Starting backend...
cd /d %~dp0
REM 使用 backend\venv（实际依赖环境；.venv 为过期空壳无 fastapi）
venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000

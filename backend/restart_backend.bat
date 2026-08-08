@echo off
echo Stopping backend...
taskkill /F /IM python.exe 2>nul
timeout /t 2 /nobreak >nul
echo Starting backend...
cd /d %~dp0
.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000

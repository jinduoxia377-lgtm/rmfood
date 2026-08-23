@echo off
echo Starting backend...
cd /d D:\RMFOODFP\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
echo Backend stopped

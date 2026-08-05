@echo off
echo Starting RMFOOD Backend with DATABASE_URL...
set DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/rmfood
cd /d d:\RMFOODFP\backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

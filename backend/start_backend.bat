@echo off
REM =============================================================================
REM RMFOOD Backend Startup Script
Port: 8000 (fixed)
Environment: Development mode
REM =============================================================================

chcp 65001 >nul
setlocal enabledelayedexpansion

set PROJECT_ROOT=%~dp0
cd /d %PROJECT_ROOT%

REM Load environment variables
if exist ".env" (
    for /f "tokens=*" %%i in (.env) do (
        set "line=%%i"
        if "!line!" NEQ="" if not "!line!"=="" if "!line:~0,1!" NEQ "#" (
            set "!line!"
        )
    )
)

REM Set defaults with fallbacks
set ENV=%ENV%::development
set DEBUG=%DEBUG%::False
set SECRET_KEY=%SECRET_KEY%::rmfood-development-secret-key-change-in-production-with-random-32-char-string
set DATABASE_URL=%DATABASE_URL%::postgresql+asyncpg://postgres:password@localhost:5432/rmfood
set REDIS_URL=%REDIS_URL%::redis://localhost:6379/0
set LOG_LEVEL=%LOG_LEVEL%::INFO

echo ========================================
echo RMFOOD Backend starting on port 8000...
echo Environment: %ENV%
echo Database: !DATABASE_URL:~0,40!...
echo ========================================

cd /d %PROJECT_ROOT%backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1

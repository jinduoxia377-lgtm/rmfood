@echo off
REM =============================================================================
REM RMFOOD Frontend Startup Script
Port: 3000 (fixed)
REM =============================================================================

chcp 65001 >nul
set PROJECT_ROOT=%~dp0
cd /d %PROJECT_ROOT%frontend

REM Check if node_modules exists, install if not
if not exist node_modules (
    echo Installing dependencies...
    pnpm install || npm ci
)

echo ========================================
echo RMFOOD Frontend starting on port 3000...
echo ========================================

npm run dev -- --host 0.0.0.0 --port 3000

@echo off
REM =============================================================================
REM RMFOOD 配方平台 - 完整启动脚本 (Windows)
REM 固定端口：前端 3000，后端 8000，数据库 5432
REM 用法: control.bat [start|stop|restart|status]
REM =============================================================================

chcp 65001 >nul

set PROJECT_ROOT=%~dp0
set BACKEND_SCRIPT=%PROJECT_ROOT%start_backend.bat
set FRONTEND_SCRIPT=%PROJECT_ROOT%start_frontend.bat
set PID_FILE=%PROJECT_ROOT%.pidsplatform.pids

color 16

echo ========================================
echo RMFOOD Platform Control Script
echo Fixed Ports: Frontend(3000), Backend(8000), Database(5432)
echo ========================================

REM Check if port is in use
check_port() (
    set PORT=%1
    netstat -ano 2>nul | findstr /C:":%PORT% LISTENING" >nul
)

log_info() (
    echo [%TIME%] %~1
)

log_warn() (
    echo [WARN %TIME%] %~1
)

log_error() (
    echo [ERROR %TIME%] %~1
)

start_backend() (
    log_info "Starting backend on port 8000..."

    REM Check if already running
    netstat -ano 2>nul | findstr /C:":8000 LISTENING" >nul
    if not errorlevel 1 (
        log_warn "Backend is already running"
        exit /b 0
    )

    REM Start backend in new window
    start "" "cmd.exe /k %BACKEND_SCRIPT%"
    log_info "Backend started successfully"
)

start_frontend() (
    log_info "Starting frontend on port 3000..."

    REM Check if already running
    netstat -ano 2>nul | findstr /C:":3000 LISTENING" >nul
    if not errorlevel 1 (
        log_warn "Frontend is already running"
        exit /b 0
    )

    REM Start frontend in new window
    cd /d %PROJECT_ROOT%frontend
    start "" "cmd.exe /k %FRONTEND_SCRIPT%"
    log_info "Frontend started successfully"
)

stop_all () (
    log_info "Stopping all services..."

    REM Kill backend processes
    tasklist /FI "IMAGING eq python.exe" 2>nul | findstr /i "uvicorn" >nul
    if not errorlevel 1 (
        taskkill /F /IM python.exe >nul 2>&1
    )

    REM Kill frontend processes
    tasklist /FI "IMAGING eq node.exe" 2>nul | findstr /i "vite" >nul
    if not errorlevel 1 (
        taskkill /F /IM node.exe >nul 2>&1
    )

    log_info "All services stopped"
)

status () (
    echo.
    echo ========================================
    echo RMFOOD Platform Status
    echo ========================================

    REM Check frontend
    netstat -ano 2>nul | findstr /C:":3000 LISTENING" >nul
    if not errorlevel 1 (
        echo [OK] Frontend: Running on http://localhost:3000
    ) else (
        echo [FAIL] Frontend: Not running on port 3000
    )

    REM Check backend
    netstat -ano 2>nul | findstr /C:":8000 LISTENING" >nul
    if not errorlevel 1 (
        echo [OK] Backend: Running on http://localhost:8000
    ) else (
        echo [FAIL] Backend: Not running on port 8000
    )

    REM Check database
    netstat -ano 2>nul | findstr /C:":5432 LISTENING" >nul
    if not errorlevel 1 (
        echo [OK] Database: Running on localhost:5432
    ) else (
        echo [FAIL] Database: Not running on port 5432
    )

    echo ========================================
)

case=%~1

if "%case%"=="start" (
    call start_backend
    call start_frontend
) else if "%case%"=="stop" (
    call stop_all
) else if "%case%"=="restart" (
    call stop_all
    timeout /t 2 >nul
    call start_backend
    call start_frontend
) else if "%case%"=="status" (
    call status
) else (
    echo Usage: control.bat [start|stop|restart|status]
    echo.
    echo Fixed Ports:
    echo   Frontend (Vite):     http://localhost:3000
    echo   Backend (FastAPI):   http://localhost:8000
    echo   Database (PostgreSQL): localhost:5432
    exit /b 1
)

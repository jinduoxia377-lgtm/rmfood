#!/bin/bash
# =============================================================================
# RMFOOD 配方平台 - 完整启动/停止脚本
# 固定端口：前端 3000，后端 8000，数据库 5432
# 用法: ./control.sh [start|stop|restart|status]
# =============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_SCRIPT="${PROJECT_ROOT}/start_backend.sh"
FRONTEND_SCRIPT="${PROJECT_ROOT}/start_frontend.sh"

PID_FILE="${PROJECT_ROOT}/.pids/platform.pids"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if process is running
is_running() {
    local pid=$1
    kill -0 "$pid" 2>/dev/null
}

# Get PIDs from file
get_pids() {
    if [ -f "${PID_FILE}" ]; then
        cat "${PID_FILE}"
    else
        echo ""
    fi
}

# Save PID to file
save_pid() {
    local pid=$1
    echo "$pid" >> "${PID_FILE}"
}

# Clean up PID file
cleanup_pids() {
    rm -f "${PID_FILE}"
}

# Start backend in background
start_backend() {
    log_info "Starting backend on port 8000..."

    # Check if already running
    local existing_pid=$(pgrep -f "python.*uvicorn.*app.main:app" 2>/dev/null | head -1)
    if [ -n "$existing_pid" ] && kill -0 "$existing_pid" 2>/dev/null; then
        log_warn "Backend is already running (PID: ${existing_pid})"
        echo "backend:$existing_pid" > "${PID_FILE}"
        return 0
    fi

    # Make sure the script is executable
    chmod +x "${BACKEND_SCRIPT}"

    # Start in background with nohup
    nohup bash "${BACKEND_SCRIPT}" > "${PROJECT_ROOT}/logs/backend.log" 2>&1 &
    BACKEND_PID=$!

    sleep 2

    # Verify it started
    if check_port 8000; then
        save_pid "${BACKEND_PID}"
        log_info "Backend started successfully (PID: ${BACKEND_PID})"
        echo "Backend running on port 8000"
    else
        log_error "Failed to start backend on port 8000"
        return 1
    fi
}

# Start frontend in background
start_frontend() {
    log_info "Starting frontend on port 3000..."

    # Check if already running
    local existing_pid=$(pgrep -f "vite" 2>/dev/null | head -1)
    if [ -n "$existing_pid" ] && kill -0 "$existing_pid" 2>/dev/null; then
        local pids=$(get_pids)
        echo "${pids}\nfrontend:${existing_pid}" > "${PID_FILE}"
        log_warn "Frontend is already running (PID: ${existing_pid})"
        echo "frontend: ${existing_pid}" >> "${PID_FILE}"
        return 0
    fi

    # Make sure the script is executable
    chmod +x "${FRONTEND_SCRIPT}"

    # Start in background with nohup
    nohup bash "${FRONTEND_SCRIPT}" > "${PROJECT_ROOT}/logs/frontend.log" 2>&1 &
    FRONTP_PID=$!

    # Wait for frontend to start
    local elapsed=0
    while ! check_port 3000 && [ ${elapsed} -lt 30 ]; do
        sleep 1
        elapsed=$((elapsed + 1))
    done

    if check_port 3000; then
        # Get the actual npm/node PID
        local node_pid=$(lsof -i :3000 -t 2>/dev/null | head -1)
        if [ -z "$node_pid" ]; then
            node_pid=${FRONTP_PID}
        fi
        save_pid "${node_pid}"
        log_info "Frontend started successfully (PID: ${node_pid})"
        echo "Frontend running on port 3000"
    else
        log_error "Failed to start frontend on port 3000 after ${elapsed}s"
        kill ${FRONTP_PID} 2>/dev/null || true
        return 1
    fi
}

# Check if database is running
check_database() {
    local db_url="${DATABASE_URL:-postgresql+asyncpg://postgres:password@localhost:5432/rmfood}"

    # Extract host and port from URL
    local host=$(echo "$db_url" | grep -oP '(?<=://)[^/@]+')
    local port=$(echo "$db_url" | grep -oP '(?<=//)[^/]+.*:(\d+)' | grep -oP '\d+$')
    port=${port:-5432}

    if check_port "${port}"; then
        log_info "Database appears to be running on port ${port}"
        return 0
    else
        log_warn "Database not found on port ${port}"
        return 1
    fi
}

# Verify port is listening
check_port() {
    local port=$1
    netstat -an 2>/dev/null | grep -q ":${port} \s*LISTENING" || ss -tlnp 2>/dev/null | grep -q ":${port} "
}

# Stop services
stop_service() {
    local service_name=$1
    local pid=$2

    if [ -n "$pid" ] && is_running "$pid"; then
        log_info "Stopping ${service_name} (PID: ${pid})..."
        kill "$pid" 2>/dev/null
        sleep 2
        if is_running "$pid"; then
            log_warn "${service_name} forced termination..."
            kill -9 "$pid" 2>/dev/null || true
        fi
    else
        log_warn "${service_name} (PID: ${pid}) is not running"
    fi
}

# Stop all services
stop_all() {
    log_info "Stopping all services..."
    cleanup_pids

    local pids=$(get_pids)
    if [ -n "$pids" ]; then
        while IFS=':' read -r service pid; do
            if [ -n "$pid" ]; then
                stop_service "${service}" "${pid}"
            fi
        done <<< "${pids}"
    fi

    # Also kill any remaining processes
    pkill -f "python.*uvicorn" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    pkill -f "npm.*run.*dev" 2>/dev/null || true

    log_info "All services stopped"
}

# Display status
status() {
    echo "========================================"
    echo "RMFOOD Platform Status"
    echo "========================================"

    # Check frontend
    if check_port 3000; then
        echo -e "${GREEN}✓ Frontend: Running on http://localhost:3000${NC}"
    else
        echo -e "${RED}✗ Frontend: Not running on port 3000${NC}"
    fi

    # Check backend
    if check_port 8000; then
        echo -e "${Green}✓ Backend: Running on http://localhost:8000${NC}"
    else
        echo -e "${Red}✗ Backend: Not running on port 8000${NC}"
    fi

    # Check database
    if check_port 5432; then
        echo -e "${Green}✓ Database: Running on localhost:5432${NC}"
    else
        echo -e "${Red}✗ Database: Not running on port 5432${NC}"
    fi

    echo "========================================"
}

# Main control logic
case "${1:-}" in
    start)
        log_info "Starting RMFOOD Platform services..."

        # Ensure logs directory exists
        mkdir -p "${PROJECT_ROOT}/logs"

        # Start database first (check if running)
        check_database || log_warn "Please ensure PostgreSQL is running on port 5432"

        # Start backend
        start_backend

        # Start frontend
        start_frontend

        log_info "All services started successfully!"
        log_info "Access:"
        log_info "  Frontend: http://localhost:3000"
        log_info "  API Docs: http://localhost:8000/docs"
        ;;

    stop)
        stop_all
        ;;

    restart)
        log_info "Restarting RMFOOD Platform services..."
        stop_all
        sleep 2
        start
        ;;

    status)
        status
        ;;

    *)
        echo "Usage: $0 {start|stop|restart|status}"
        echo ""
        echo "Fixed Ports:"
        echo "  Frontend (Vite):     http://localhost:3000"
        echo "  Backend (FastAPI):   http://localhost:8000"
        echo "  Database (PostgreSQL): localhost:5432"
        echo ""
        echo "Examples:"
        echo "  $0 start      - Start all services"
        echo "  $0 stop       - Stop all services"
        echo "  $0 restart    - Restart all services"
        echo "  $0 status     - Show service status"
        exit 1
        ;;
esac

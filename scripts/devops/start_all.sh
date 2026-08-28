#!/bin/bash
# =============================================================================
# RMFOOD 配方平台 - 完整启动脚本
# 固定端口：前端 3000，后端 8000，数据库 5432
# =============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"

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

# Check if a port is listening
check_port() {
    local port=$1
    ss -tlnp 2>/dev/null | grep -q ":${port} " || netstat -an 2>/dev/null | grep -q ":${port} \s*LISTEN"
    return $?
}

# Wait for service to be available on a port
wait_for_port() {
    local port=$1
    local max_wait=$2
    local elapsed=0

    echo "Waiting for port ${port} to become available..."
    while ! check_port ${port}; do
        sleep 1
        elapsed=$((elapsed + 1))
        if [ ${elapsed} -ge ${max_wait} ]; then
            log_warn "Port ${port} did not become ready within ${max_wait}s"
            return 1
        fi
    done
    log_warn "Port ${port} is ready!"
    return 0
}

# Start PostgreSQL database (using Docker if available, else try alternative)
start_database() {
    log_info "Starting PostgreSQL database on port 5432..."

    # Try Docker Compose first
    if command -v docker-compose &> /dev/null || command -v docker &> /dev/null; then
        log_warn "Docker detected, using Docker Compose for database"
        if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "rmfood_postgres"; then
            log_info "Database container already running, skipping start"
        else
            cd "${PROJECT_ROOT}/deploy"
            docker-compose up -d postgres redis
            wait_for_port 5432 30
        fi
        return 0
    fi

    # Check if database is already running
    if check_port 5432; then
        log_info "PostgreSQL is already running on port 5432"
        return 0
    fi

    log_error "PostgreSQL is not running and Docker is unavailable."
    log_error "Please start PostgreSQL manually:"
    log_error "  1. Install PostgreSQL locally, or"
    log_error "  2. Run: docker-compose up -d postgres from deploy directory"
    log_error "  3. Ensure DATABASE_URL points to your database"
    return 1
}

# Start FastAPI backend
start_backend() {
    log_info "Starting RMFOOD Backend on port 8000..."

    if check_port 8000; then
        log_info "Backend is already running on port 8000"
        return 0
    fi

    # Set environment variables
    export ENV=development
    export DEBUG=False
    export SECRET_KEY=rmfood-development-secret-key-change-in-production-with-random-32-char-string
    export DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/rmfood
    export REDIS_URL=redis://localhost:6379/0
    export CORS_ORIGINS='["http://localhost:3000","http://127.0.0.1:3000"]'
    export LOG_LEVEL=INFO

    cd "${BACKEND_DIR}"
    log_info "Starting backend with uvicorn..."
    python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --reload 2>&1 &
    BACKED_PID=$!

    # Wait for backend to be ready
    log_info "Waiting for backend to initialize..."
    local elapsed=0
    while ! check_port 8000; do
        sleep 1
        elapsed=$((elapsed + 1))
        if [ ${elapsed} -gt 30 ]; then
            log_error "Backend failed to start on port 8000"
            kill ${BACKED_PID} 2>/dev/null || true
            return 1
        fi
    done
    log_info "Backend running on port 8000 (PID: ${BACKED_PID})"

    # Keep background process alive
    wait ${BACKED_PID} 2>&1 || log_warn "Backend process exited"
}

# Start Vite frontend
start_frontend() {
    log_info "Starting RMFOOD Frontend on port 3000..."

    if check_port 3000; then
        log_info "Frontend is already running on port 3000"
        return 0
    fi

    cd "${FRONTEND_DIR}"

    # Check if node_modules exist
    if [ ! -d "node_modules" ]; then
        log_warn "Installing dependencies..."
        pnpm install 2>&1 || npm install 2>&1
    fi

    log_info "Starting Vite dev server on port 3000..."
    # Override port in vite.config.ts if needed
    export PORT=3000
    export HOST=0.0.0.0
    npm run dev 2>&1 &
    FRONTP_PID=$!

    # Wait for frontend to be ready
    log_info "Waiting for frontend to start..."
    local elapsed=0
    while ! check_port 3000; do
        sleep 1
        elapsed=$((elapsed + 1))
        if [ ${elapsed} -gt 60 ]; then
            log_error "Failed to start frontend on port 3000"
            kill ${FRONTP_PID} 2>/dev/null || true
            return 1
        fi
    done
    log_info "Frontend running on port 3000 (PID: ${FRONTP_PID})"

    wait ${FRONTP_PID} 2>&1 || log_warn "Frontend process exited"
}

# Main execution
main() {
    log_info "========================================"
    log_info "RMFOOD Platform - Starting All Services"
    log_info "========================================"
    log_info "Fixed Ports: Frontend(3000), Backend(8000), Database(5432)"
    log_info ""

    # Start database (in background)
    log_info "[1/3] Starting database..."
    start_database &
    DB_PID=$!

    # Wait a moment for database to start
    sleep 2

    # Start backend
    log_info "[2/3] Starting backend..."
    start_backend &
    BEH_PID=$!

    # Wait for backend to be ready
    sleep 5

    # Start frontend
    log_info "[3/3] Starting frontend..."
    start_frontend &
    FRO_PID=$!

    # Wait for all processes
    log_info ""
    log_info "All services launched in background!"
    log_info "Monitor logs to see real-time output."
    log_info ""
    log_info "Access URLs:"
    log_info "  Frontend: http://localhost:3000"
    log_info "  Backend API: http://localhost:8000/docs (Swagger)"
    log_info "  Database: localhost:5432"

    # Wait for child processes
    wait ${DB_PID} 2>/dev/null || true
    wait ${BEH_PID} 2>/dev/null || true
    wait ${FRO_PID} 2>/dev/null || true
}

main "$@"
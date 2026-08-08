#!/bin/bash
# =============================================================================
# RMFOOD 配方平台 - 后端启动脚本
# 固定端口：8000
# =============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"

# Ensure we're in the project root
cd "${PROJECT_ROOT}"

# Load environment variables from .env
if [ -f ".env" ]; then
    set -a
    source ".env"
    set +a
fi

# Set environment variables for backend
export ENV="${ENV:-development}"
export DEBUG="${DEBUG:-False}"
export SECRET_KEY="${SECRET_KEY:-rmfood-development-secret-key-change-in-production-with-random-32-char-string}"
export DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://postgres:password@localhost:5432/rmfood}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379/0}"
export LOG_LEVEL="${LOG_LEVEL:-INFO}"

# Check if port 8000 is already occupied
check_port() {
    local port=$1
    netstat -an 2>/dev/null | grep -q ":${port} \s*LISTENING" || ss -tlnp 2>/dev/null | grep -q ":${port} "
}

if check_port 8000; then
    echo "[WARN] Port 8000 is already occupied. Checking if it's the backend..."
    # Check if it's our process
    existing_pid=$(netstat -an 2>/dev/null | grep ":8000 \s*LISTENING" | awk '{print $5}' | cut -d: -f1 | head -1)
    if [ -n "$existing_pid" ]; then
        echo "[WARN] Process on port 8000 (PID: $existing_pid) is already running."
        exit 1
    fi
fi

echo "========================================"
echo "RMFOOD Backend starting on port 8000..."
echo "Environment: ${ENV}"
echo "Database: ${DATABASE_URL:0:40}..."
echo "========================================"

cd "${BACKEND_DIR}"
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1

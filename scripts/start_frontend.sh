#!/bin/bash
# =============================================================================
# RMFOOD 配方平台 - 前端启动脚本
# 固定端口：3000
# =============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"

# Check if port 3000 is already occupied
check_port() {
    local port=$1
    netstat -an 2>/dev/null | grep -q ":${port} \s*LISTENING" || ss -tlnp 2>/dev/null | grep -q ":${port} "
}

if check_port 3000; then
    echo "[WARN] Port 3000 is already occupied. Checking if it's the frontend..."
    existing_pid=$(netstat -an 2>/dev/null | grep ":3000 \s*LISTENING" | awk '{print $5}' | cut -d: -f1 | head -1)
    if [ -n "$existing_pid" ]; then
        echo "[WARN] Process on port 3000 (PID: $existing_pid) is already running."
        exit 1
    fi
fi

echo "========================================"
echo "RMFOOD Frontend starting on port 3000..."
echo "========================================"

cd "${FRONTEND_DIR}"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    pnpm install 2>&1 || npm ci --prefer-offline 2>&1 || npm install 2>&1
fi

# Start Vite dev server
exec npm run dev -- --host 0.0.0.0 --port 3000

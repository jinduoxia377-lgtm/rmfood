#!/bin/bash
set -e

echo "=== 开始重启后端服务 ==="
cd /d/RMFOODFP/backend

# Set debug environment for better error visibility
export DEBUG=True
export LOG_LEVEL=DEBUG

# Start backend with explicit port
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --log-level debug > /d/RMFOODFP/logs/backend_debug.log 2>&1 &
BACKEND_PID=$!

echo "Backend started with PID: $BACKEND_PID"
sleep 5

# Check if it's still running
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "Backend is still running"
else
    echo "Backend crashed, checking log..."
    tail -50 /d/RMFOODFP/logs/backend_debug.log
fi

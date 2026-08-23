#!/bin/bash
# RMFOOD Backend Startup Script

echo "=================================="
echo "  RMFOOD Backend Startup"
echo "=================================="

BACKEND_DIR="D:/RMFOODFP/backend"
PYTHON=".venv/Scripts/python.exe"
LOG_FILE="$BACKEND_DIR/logs/startup_$(date +%Y%m%d_%H%M%S).log"

# Create logs directory
mkdir -p "$BACKEND_DIR/logs"

echo ""
echo "[1] Checking Python environment..."
if [ ! -f "$BACKEND_DIR/$PYTHON" ]; then
    echo "ERROR: Python not found at $BACKEND_DIR/$PYTHON"
    exit 1
fi
echo "  Python found: $BACKEND_DIR/$PYTHON"

echo ""
echo "[2] Checking dependencies..."
cd "$BACKEND_DIR"
"$PYTHON" -m pip show uvicorn fastapi apscheduler > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "  Installing missing dependencies..."
    "$PYTHON" -m pip install uvicorn fastapi apscheduler -q
fi
echo "  Dependencies OK"

echo ""
echo "[3] Testing app import..."
"$PYTHON" -c "from app.main import app; print('App import OK')" > "$LOG_FILE" 2>&1
if [ $? -ne 0 ]; then
    echo "  Import failed!"
    cat "$LOG_FILE"
    exit 1
fi
echo "  App import OK"

echo ""
echo "[4] Starting backend server on port 8000..."
echo "  Log file: $LOG_FILE"
"$PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > "$LOG_FILE" 2>&1 &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

echo ""
echo "[5] Waiting for server to start..."
for i in {1..15}; do
    sleep 1
    if curl -s --max-time 2 http://localhost:8000/health > /dev/null 2>&1; then
        echo ""
        echo "=================================="
        echo "  Backend started successfully!"
        echo "=================================="
        echo "  URL: http://localhost:8000"
        echo "  API Docs: http://localhost:8000/docs"
        echo "  Health: http://localhost:8000/health"
        echo ""
        echo "  PID: $BACKEND_PID"
        echo "  Press Ctrl+C to stop"
        echo ""
        wait $BACKEND_PID
        break
    fi
    echo "  ... waiting ($i/15)"
done

echo ""
echo "ERROR: Backend failed to start within 15 seconds"
echo "Check log: $LOG_FILE"
cat "$LOG_FILE"
exit 1

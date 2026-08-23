"""Debug script to diagnose backend startup issues"""
import os
import sys
import traceback

# Add backend to path
os.chdir(r"D:\RMFOODFP\backend")
sys.path.insert(0, r"D:\RMFOODFP\backend")

log_file = r"D:\RMFOODFP\backend\logs\debug_start.log"

def log(msg):
    print(msg)
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

log("=" * 60)
log("Backend Debug Start")
log("=" * 60)

# Check Python version
log(f"\nPython version: {sys.version}")
log(f"Python executable: {sys.executable}")

# Check working directory
log(f"\nWorking directory: {os.getcwd()}")

# Try to import dependencies
log("\n[1] Checking dependencies...")
deps = ["fastapi", "uvicorn", "sqlalchemy", "asyncpg", "pydantic", "apscheduler"]
for dep in deps:
    try:
        __import__(dep)
        log(f"  [OK] {dep}")
    except ImportError as e:
        log(f"  [FAIL] {dep}: {e}")

# Try to import app
log("\n[2] Testing app imports...")
try:
    from app.main import app
    log("  [OK] app.main imported successfully")
except Exception as e:
    log(f"  [FAIL] app.main import error: {e}")
    log("\nFull traceback:")
    traceback.print_exc()
    sys.exit(1)

# Try to start uvicorn
log("\n[3] Starting uvicorn server...")
try:
    import uvicorn
    config = uvicorn.Config(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
    server = uvicorn.Server(config)
    log(f"  [OK] Uvicorn server configured on port 8000")
    log(f"  [INFO] PID: {os.getpid()}")
    log("\nStarting server... (this may take a moment)")
    # Don't actually run - just verify config
    log("\nDebug complete. To start server, run:")
    log(f"  {sys.executable} -m uvicorn app.main:app --host 0.0.0.0 --port 8000")
except Exception as e:
    log(f"  [FAIL] Uvicorn error: {e}")
    traceback.print_exc()

log("\n" + "=" * 60)
log("Debug complete")
log("=" * 60)

"""RMFOOD Backend Startup Script"""
import os
import sys
import subprocess
import time
import urllib.request

# Change to backend directory
os.chdir(r"D:\RMFOODFP\backend")

print("=" * 50)
print("   RMFOOD Backend Startup")
print("=" * 50)

# Check Python version
print("\n[1] Checking Python environment...")
python_exe = r"D:\RMFOODFP\backend\.venv\Scripts\python.exe"
if not os.path.exists(python_exe):
    print(f"ERROR: Python virtual environment not found at {python_exe}")
    sys.exit(1)
print(f"  Python: {python_exe}")

# Check dependencies
print("\n[2] Checking dependencies...")
try:
    import uvicorn
    print("  [OK] uvicorn")
except ImportError:
    print("  [FAIL] uvicorn not installed")
    subprocess.run([python_exe, "-m", "pip", "install", "uvicorn", "-q"])

try:
    import apscheduler
    print("  [OK] apscheduler")
except ImportError:
    print("  [WARN] apscheduler not installed, installing...")
    subprocess.run([python_exe, "-m", "pip", "install", "apscheduler", "-q"])

try:
    import fastapi
    print("  [OK] fastapi")
except ImportError:
    print("  [FAIL] fastapi not installed")

# Test app import
print("\n[3] Testing app import...")
try:
    from app.main import app
    print("  [OK] App imports successfully")
except Exception as e:
    print(f"  [FAIL] Import error: {e}")
    sys.exit(1)

# Start server
print("\n[4] Starting backend server on port 8000...")
print("  Press Ctrl+C to stop")

process = subprocess.Popen(
    [python_exe, "-m", "uvicorn", "app.main:app",
     "--host", "0.0.0.0", "--port", "8000"],
    cwd=r"D:\RMFOODFP\backend"
)

print(f"\n  Backend PID: {process.pid}")
print("\n  Waiting for server to be ready...")

# Wait for server to start
for i in range(30):
    time.sleep(1)
    try:
        response = urllib.request.urlopen("http://localhost:8000/health", timeout=2)
        if response.status == 200:
            print(f"\n  [SUCCESS] Backend server is running on http://localhost:8000")
            print("  [INFO] API docs: http://localhost:8000/docs")
            break
    except:
        print(f"  ... waiting ({i+1}/30)", end="\r")

print("\n" + "=" * 50)
print("  Backend server is ready!")
print("=" * 50 + "\n")

# Keep running
try:
    process.wait()
except KeyboardInterrupt:
    print("\n  Stopping backend server...")
    process.terminate()
    print("  Backend server stopped.")

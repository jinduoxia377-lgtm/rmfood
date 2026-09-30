import subprocess, sys, time, os, urllib.request

backend = r"D:\RMFOODFP\backend"
env = {
    "SECRET_KEY": "rmfood-development-secret-key-change-in-production-with-random-32-char-string",
    "ENV": "development",
}
# Simulate start.ps1: launch backend with reload, capture output to log file
log = open(r"D:\RMFOODFP\logs\backend-start.log", "ab")
err = open(r"D:\RMFOODFP\logs\backend-start.err.log", "ab")
proc = subprocess.Popen(
    [r"D:\RMFOODFP\backend\venv\Scripts\python.exe", "-m", "uvicorn", "app.main:app",
     "--host", "0.0.0.0", "--port", "8000", "--reload"],
    cwd=backend, stdout=log, stderr=err,
    env={**os.environ, **env},
)
time.sleep(30)
alive = proc.poll() is None
print("backend process alive after 30s:", alive)
try:
    r = urllib.request.urlopen("http://127.0.0.1:8000/api/v1/health", timeout=5)
    print("HEALTH:", r.status, r.read()[:150])
except Exception as e:
    print("HEALTH ERR:", e)
if alive:
    proc.terminate()
    time.sleep(5)
    if proc.poll() is None:
        proc.kill()
print("final state:", "running" if alive else "exited")

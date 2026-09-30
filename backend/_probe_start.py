import subprocess, sys, time, socket
from pathlib import Path

backend = Path(r"D:\RMFOODFP\backend")
env = {
    "SECRET_KEY": "rmfood-development-secret-key-change-in-production-with-random-32-char-string",
}

# capture output to a file
log = open(r"D:\RMFOODFP\backend\_probe.log", "wb")
proc = subprocess.Popen(
    [str(backend / "venv\\Scripts\\python.exe"), "-m", "uvicorn", "app.main:app",
     "--host", "127.0.0.1", "--port", "8000", "--reload"],
    cwd=str(backend), stdout=log, stderr=subprocess.STDOUT,
    env={**__import__("os").environ, **env},
    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
)
time.sleep(25)
ok = not proc.poll()
# try http
try:
    import urllib.request
    r = urllib.request.urlopen("http://127.0.0.1:8000/api/v1/health", timeout=5)
    print("HEALTH:", r.status, r.read()[:200])
except Exception as e:
    print("HEALTH ERR:", e)
proc.terminate()
try:
    proc.wait(timeout=10)
except Exception:
    proc.kill()
print("proc alive during probe:", ok)

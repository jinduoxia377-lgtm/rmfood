"""Start uvicorn backend in the background, detached from this process.

Run:  backend\\venv\\Scripts\\python.exe backend\\start_uvicorn_bg.py

It writes stdout/stderr to backend/uvicorn_bg.log and exits immediately.
The uvicorn process survives because we use CREATE_NEW_PROCESS_GROUP +
unbuffered pipes, then close our handle.
"""
import os, sys, subprocess, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENV_PY = os.path.join(ROOT, "backend", "venv", "Scripts", "python.exe")
LOG = os.path.join(ROOT, "backend", "uvicorn_bg.log")

CREATE_NEW_PROCESS_GROUP = 0x00000100
DETACHED_PROCESS = 0x00000008

cmd = [VENV_PY, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

with open(LOG, "ab") as logf:
    proc = subprocess.Popen(
        cmd,
        cwd=os.path.join(ROOT, "backend"),
        stdout=logf,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        creationflags=CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS,
        close_fds=True,
    )
    print(f"started uvicorn pid={proc.pid} log={LOG}")
    # give it a moment to bind
    time.sleep(3)
    # don't wait — the detached process will keep running
    sys.exit(0)

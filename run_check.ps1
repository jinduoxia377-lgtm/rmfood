import subprocess
import sys

# Run SSH check via Python
result = subprocess.run(
    [sys.executable, r"D:\RMFOODFP\check_server.py"],
    capture_output=True, text=True, timeout=60
)
print(result.stdout)
if result.stderr:
    print(f"STDERR: {result.stderr}", file=sys.stderr)
sys.exit(result.returncode)

#!/usr/bin/env python3
"""
Run import in a clean subprocess with proper environment settings.
This bypasses the current process's encoding issues.
"""
import os
import sys
import subprocess

# Set up a clean environment with UTF-8 mode
env = os.environ.copy()
env['PYTHONUTF8'] = '1'
env['PYTHONCASELESS'] = '0'
env['LC_ALL'] = 'C'
env['LANG'] = 'C'
env['DATABASE_URL'] = 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood'
env['ENV'] = 'development'
env['DEBUG'] = 'False'

# Work directory - use a path without Unicode chars if possible
work_dir = r"D:\RMFOOD配方平台\backend"

# Check if we can find a short path version
try:
    import ctypes
    from ctypes.wintypes import CHAR, DWORD, BOOL, HANDLE, LPSTR, LPVOID
    kernel32 = ctypes.windll.kernel32

    buffer = ctypes.create_string_buffer(260)
    long_path = work_dir.encode('utf-16-le')
    result = kernel32.GetShortPathNameW(long_path, buffer, 260)
    if result > 0 and result < 260:
        short_work_dir = buffer.value.decode('mbcs')
        logger = logging.getLogger(__name__)
        logger.info(f"Using short work dir: {short_work_dir}")
        work_dir = short_work_dir
except:
    pass

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

print(f"Starting import in clean environment...")
print(f"Work directory: {work_dir}")
print(f"PYTHONUTF8: {env.get('PYTHONUTF8')}")

try:
    result = subprocess.run(
        [sys.executable, 'scripts/import_offsync.py', '--test-limit', '500', '--no-drop-index'],
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace',
        env=env,
        cwd=work_dir,
        timeout=600
    )

    print(f"\n{'='*60}")
    print(f"Exit code: {result.returncode}")
    print(f"{'='*60}")

    if result.stdout:
        lines = result.stdout.strip().split('\n')
        # Print last 20 lines
        for line in lines[-20:]:
            print(line)

    if result.stderr:
        print("\n--- STDERR ---")
        # Try to decode safely
        try:
            print(result.stderr[-1000:])
        except:
            print("STDERR has encoding issues, check file output")

    # Save full output to file
    with open('import_final_result.txt', 'w', encoding='utf-8') as f:
        f.write(f"Exit Code: {result.returncode}\n\n")
        f.write("STDOUT:\n")
        f.write(result.stdout)
        f.write("\n\nSTDERR:\n")
        f.write(result.stderr if result.stderr else "(empty)\n")

    print(f"\nFull log saved to import_final_result.txt")

except Exception as e:
    print(f"Error running subprocess: {e}")
    import traceback
    traceback.print_exc()

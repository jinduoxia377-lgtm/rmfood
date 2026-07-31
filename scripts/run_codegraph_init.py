#!/usr/bin/env python3
"""Run codegraph init from the RMFOOD project directory."""
import subprocess
import sys
import os

# Node and script paths (WSL mapped to Windows temp)
node_exe = r"C:\Users\ADMINI~1\AppData\Local\Temp\codegraph-win32-x64\node.exe"
js_file = r"C:\Users\ADMINI~1\AppData\Local\Temp\codegraph-win32-x64\lib\dist\bin\codegraph.js"

# Project path - use current working directory if none specified
project_path = "."
if len(sys.argv) > 1:
    project_path = sys.argv[1]

cmd = [
    node_exe,
    "--liftoff-only",
    "--disable-warning=ExperimentalWarning",
    js_file,
    "init",
    project_path
]

try:
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=project_path
    )
    print(result.stdout, end='')
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    sys.exit(result.returncode)
except Exception as e:
    print(f"Error running codegraph init: {e}", file=sys.stderr)
    sys.exit(1)

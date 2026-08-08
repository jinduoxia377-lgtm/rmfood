#!/usr/bin/env python3
import subprocess
import sys
import os

# Locate the extracted codegraph files (Windows path via WSL)
base = r"C:\tmp\codegraph-win32-x64"
node_exe = os.path.join(base, "node.exe")
js_file = os.path.join(base, "lib", "dist", "bin", "codegraph.js")

args = sys.argv[1:] if len(sys.argv) > 1 else ["--version"]

try:
    result = subprocess.run(
        [node_exe, "--liftoff-only", "--disable-warning=ExperimentalWarning", js_file] + args,
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=os.getcwd()
    )
    print(result.stdout, end='')
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    sys.exit(result.returncode)
except Exception as e:
    print(f"Error running codegraph: {e}", file=sys.stderr)
    sys.exit(1)

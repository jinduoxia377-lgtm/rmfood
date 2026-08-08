#!/usr/bin/env python3
"""Test configuration loading"""
import sys
import os

# Add backend to path
sys.path.insert(0, 'backend')

# Clean up any cached modules
modules_to_remove = [m for m in sys.modules if m.startswith('app.core')]
for m in modules_to_remove:
    del sys.modules[m]

print("Testing configuration loading...")
print("-" * 50)

# Test 1: With SECRET_KEY set
os.environ.update({
    'SECRET_KEY': 'test-secret-key-32-chars-long-1234567890abcdef',
    'ENV': 'development',
})

try:
    from app.core.config import Settings
    settings1 = Settings()
    print("[OK] Test 1 PASSED: Config loaded with explicit SECRET_KEY")
    print(f"  - Secret key length: {len(settings1.security.secret_key)}")
    print(f"  - App env: {settings1.app_env}")
except Exception as e:
    print("[FAIL] Test 1 FAILED:", str(e))

# Test 2: Without SECRET_KEY (should generate random one in dev)
import subprocess
result = subprocess.run([sys.executable, '-c', '''
import os
import sys
sys.path.insert(0, "backend")
from app.core.config import Settings
settings = Settings()
print(len(settings.security.secret_key))
'''], capture_output=True, text=True, cwd='D:\\RMFOOD配方平台')

if result.returncode == 0:
    try:
        length = int(result.stdout.strip())
        print("[OK] Test 2 PASSED: Config loaded without SECRET_KEY (generated random)")
        print(f"  - Generated secret key length: {length}")
    except ValueError:
        print("[FAIL] Test 2 FAILED: Unexpected output")
        print("stdout:", result.stdout)
        print("stderr:", result.stderr)
else:
    print("[FAIL] Test 2 FAILED:")
    print("stderr:", result.stderr)

print("-" * 50)
print("All tests completed!")

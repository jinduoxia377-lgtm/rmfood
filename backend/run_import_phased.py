#!/usr/bin/env python3
"""OpenFoodFacts CSV 导入 - 分阶段执行脚本"""
import os
import sys
import subprocess
import time

os.chdir("d:/RMFOOD配方平台/backend")

def run_cmd(cmd, description):
    print(f"\n{'='*60}")
    print(f"[EXECUTING] {description}")
    print(f"CMD: {cmd}")
    print('='*60)

    start = time.time()
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding='utf-8', errors='replace')
    elapsed = time.time() - start

    print(f"\n[RESULT] Exit code: {result.returncode}")
    print(f"[TIME] Elapsed: {elapsed:.1f}s")

    if result.stdout:
        print("[OUTPUT]")
        print(result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout)

    if result.returncode != 0:
        print("\n[ERROR] Command failed!")
        if result.stderr:
            print("STDERR:", result.stderr[-500:])
        return False

    return True

print("\n" + "="*60)
print("OPENFOODFACTS DATA IMPORT - PHASED EXECUTION")
print("="*60)
print(f"Current directory: {os.getcwd()}")
print()

# Step 1: Small test (500 rows)
print("\n[STEP 1/3] SMALL TEST RUN (500 rows, no index drop)")
success = run_cmd(
    'python scripts/import_openfoodfacts_csv.py --test-limit 500 --no-drop-index',
    "Import 500 products with safety options"
)

if not success:
    print("\n❌ Test import FAILED. Check error above and fix before proceeding.")
    sys.exit(1)

print("\n✅ STEP 1 COMPLETED successfully!")

# Wait a bit before next step
time.sleep(2)

# Step 2: Medium test (10000 rows)
print("\n[STEP 2/3] MEDIUM TEST RUN (10,000 rows)")
success = run_cmd(
    'python scripts/import_openfoodfacts_csv.py --test-limit 10000 --chunk-size 10000',
    "Import 10,000 products for performance testing"
)

if not success:
    print("\n⚠️  Medium test had issues. Review above output.")
    # Don't exit - let user decide

print("\n✅ STEP 2 completed!")

# Wait a bit before final step
time.sleep(2)

# Step 3: Full production import
print("\n[STEP 3/3] FULL PRODUCTION IMPORT")
confirm = input("⚠️  This will import ~4 million products. Continue? (y/n): ")
if confirm.lower() != 'y':
    print("Full import cancelled by user.")
else:
    success = run_cmd(
        'python scripts/import_openfoodfacts_csv.py --chunk-size 20000',
        "Full production import of all OpenFoodFacts data"
    )
    if success:
        print("\n🎉 ALL STAGES COMPLETED SUCCESSFULLY!")
    else:
        print("\n⚠️  Full import had issues.")

"""Execute OpenFoodFacts CSV import with elevated database permissions."""
import os
import sys
import asyncio

# Set environment variables FIRST
os.environ['SECRET_KEY'] = 'rmfood-long-secret-key-32-characters-minimum'
os.environ['ENV'] = 'development'
os.environ['DATABASE_URL'] = 'postgresql://postgres@localhost:5432/rmfood_db'  # Use postgres for permission reasons
os.environ['ADMIN_USERNAME'] = 'admin_import'
os.environ['ADMIN_PASSWORD'] = ''

# Setup paths BEFORE any imports
project_root = os.path.dirname(os.path.abspath(__file__))  # scripts/ dir
project_root = os.path.dirname(project_root)  # Go to project root

# Add backend to path so "from app.core.config" works
backend_dir = os.path.join(project_root, 'backend')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

print(f"Added backend to path: {backend_dir}")
print(f"Python path: {[p for p in sys.path if 'backend' in p or project_root in p]}")

# Now we can safely import the import function
sys.path.insert(0, project_root)  # Also add project root

from backend.scripts.import_openfoodfacts_csv import import_csv

print("Starting import with postgres user...")
try:
    import_csv(chunk_size=10000, drop_index=True, test_limit=0, dry_run=False)
    print("\n✓ Import completed successfully!")
except Exception as e:
    print(f"\n✗ Import failed: {e}")
    traceback.print_exc()

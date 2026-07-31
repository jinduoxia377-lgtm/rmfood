#!/usr/bin/env python
"""Import OpenFoodFacts CSV with better error handling and progress reporting."""
import os
import sys
import traceback

def setup():
    """Setup environment and paths."""
    project_root = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(project_root)
    os.chdir(project_root)

    # Set environment variables
    os.environ['SECRET_KEY'] = 'rmfood-long-secret-key-32-characters-minimum'
    os.environ['ENV'] = 'development'
    os.environ['DATABASE_URL'] = 'postgresql://postgres@localhost:5432/rmfood_db'
    os.environ['ADMIN_USERNAME'] = 'admin_import'
    os.environ['ADMIN_PASSWORD'] = ''

    # Setup Python path - add project root so 'backend' can be imported as package
    if project_root not in sys.path:
        sys.path.insert(0, project_root)

    backend_dir = os.path.join(project_root, 'backend')
    # We don't need to add backend dir explicitly since project_root contains it as a subpackage

    print(f"Working directory: {os.getcwd()}")
    print(f"Project root: {project_root}")
    print(f"Backend exists: {os.path.exists(backend_dir)}")


def main():
    setup()

    from backend.scripts.import_openfoodfacts_csv import import_csv

    csv_path = os.path.join(os.getcwd(), 'openfoodfacts', 'en.openfoodfacts.org.products.csv')
    print(f"\nCSV file: {csv_path}")
    print(f"File size: {os.path.getsize(csv_path):,} bytes")

    try:
        import_csv(
            chunk_size=10000,
            drop_index=True,
            test_limit=0,
            dry_run=False,
        )
        print("\n✓ SUCCESS: Import completed!")
        return 0
    except Exception as e:
        print(f"\n✗ FAILED: {e}")
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())

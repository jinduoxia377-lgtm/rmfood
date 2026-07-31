#!/usr/bin/env python
"""Wrapper script to properly configure and run OpenFoodFacts CSV import."""
import os
import sys
import traceback


def setup_environment():
    """Set up all necessary environment variables before importing app modules."""
    # Change to project root
    project_root = os.path.dirname(os.path.abspath(__file__))  # scripts/ dir
    project_root = os.path.dirname(project_root)  # Go up one level
    os.chdir(project_root)
    print(f"Changed working directory to: {os.getcwd()}")

    # Set required environment variables
    os.environ['SECRET_KEY'] = 'rmfood-long-secret-key-32-characters-minimum'
    os.environ['ENV'] = 'development'
    os.environ['DEBUG'] = 'False'
    os.environ['ADMIN_USERNAME'] = 'admin_import'
    os.environ['ADMIN_PASSWORD'] = ''
    os.environ['DATABASE_URL'] = 'postgresql://rmfood:rmfood_secure_password_123@localhost:5432/rmfood_db'

    # Add paths
    if project_root not in sys.path:
        sys.path.insert(0, project_root)

    scripts_dir = os.path.join(project_root, 'scripts')
    backend_dir = os.path.join(project_root, 'backend')
    for path in [scripts_dir, backend_dir]:
        if path not in sys.path:
            sys.path.insert(0, path)

    print("Environment configured successfully!")


def run_import():
    """Execute the CSV import."""
    from backend.scripts.import_openfoodfacts_csv import import_csv

    csv_path = os.path.join(
        os.getcwd(), 'openfoodfacts', 'en.openfoodfacts.org.products.csv'
    )
    print(f"\nStarting import from: {csv_path}")
    print(f"File size: {os.path.getsize(csv_path)} bytes")

    try:
        import_csv(
            chunk_size=10000,
            drop_index=True,
            test_limit=0,
            dry_run=False,
        )
        print("\n✓ Import completed successfully!")
        return 0
    except Exception as e:
        print(f"\n✗ Import failed: {e}")
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    setup_environment()
    exit_code = run_import()
    sys.exit(exit_code)
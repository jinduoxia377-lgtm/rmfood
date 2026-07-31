"""Run OpenFoodFacts CSV import with proper logging."""
import sys
import os

# Change to backend directory and import
os.chdir('backend')
sys.path.insert(0, 'scripts')  # Add scripts to path so we can import from it

from import_openfoodfacts_csv import import_csv

if __name__ == '__main__':
    # Set chunk_size to 10000 for performance
    import_csv(
        csv_path=None,  # default
        chunk_size=10000,
        dry_run=False,
        test_limit=0,
        drop_index=True,
    )
    print("Import completed!", file=sys.stderr)

"""Run OpenFoodFacts import with direct control."""
import os
import sys
import logging

# Set up basic logging to console with UTF-8 support
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)
logger = logging.getLogger(__name__)

# Setup environment first
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # Go to project root

os.environ['SECRET_KEY'] = 'rmfood-long-secret-key-32-characters-minimum'
os.environ['ENV'] = 'development'
os.environ['DATABASE_URL'] = 'postgresql://postgres@localhost:5432/rmfood_db'
os.environ['ADMIN_USERNAME'] = 'admin_import'
os.environ['ADMIN_PASSWORD'] = ''

# Add project root to path for imports
project_root = os.getcwd()
if project_root not in sys.path:
    sys.path.insert(0, project_root)

logger.info(f"Project root: {project_root}")
logger.info(f"CWD: {os.getcwd()}")

# Now import and run
try:
    from backend.scripts.import_openfoodfacts_csv import import_csv

    csv_path = os.path.join(project_root, 'openfoodfacts', 'en.openfoodfacts.org.products.csv')
    logger.info(f"CSV path: {csv_path}")
    logger.info(f"File exists: {os.path.exists(csv_path)}")
    if os.path.exists(csv_path):
        logger.info(f"File size: {os.path.getsize(csv_path):,} bytes")

    logger.info("\n=== Starting Import ===")
    import_csv(
        chunk_size=10000,
        drop_index=True,
        test_limit=0,
        dry_run=False,
    )
    logger.info("\n=== Import Completed Successfully! ===")
except Exception as e:
    logger.error(f"Import failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

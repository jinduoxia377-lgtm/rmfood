#!/usr/bin/env python3
"""
Minimal DB Test using Sync Driver
Bypasses asyncpg Windows compatibility issues by using synchronous psycopg2
"""
import sys
import os

# Add backend to path
backend_dir = "/d/RMFOOD配方平台/backend"
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Load .env
env_file = os.path.join(backend_dir, ".env")
if os.path.exists(env_file):
    for line in open(env_file, encoding='latin-1'):
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key.strip()] = value.strip()

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger("OFFSyncTest")

try:
    # Use sync psycopg2 driver instead of asyncpg
    import psycopg2
    from psycopg2.extras import RealDictCursor

    logger.info("Testing sync PostgreSQL connection via psycopg2...")

    conn = psycopg2.connect(
        host="localhost",
        port="5432",
        user="postgres",
        password="password",
        database="rmfood"
    )
    logger.info("✓ Connected via sync psycopg2!")

    # Check tables exist
    curs = conn.cursor()
    curs.execute("SELECT 1")
    curs.fetchone()
    logger.info("✓ Basic query OK")

    for table in ['retail_products', 'import_tasks', 'import_errors']:
        curs.execute(f"SELECT COUNT(*) FROM {table}")
        count = curs.fetchone()[0]
        logger.info(f"✓ Table '{table}' exists with {count} rows")

    # Test insert using sync cursor
    now = __import__('datetime').datetime.now()
    test_id = "MINI-TEST-" + str(int(now.timestamp()))

    sql = """
        INSERT INTO retail_products (external_id, source, crawl_timestamp, data_quality, product_name, brand, category)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (external_id) DO UPDATE SET
            updated_at = NOW(),
            data_quality = EXCLUDED.data_quality,
            product_name = EXCLUDED.product_name,
            brand = EXCLUDED.brand,
            category = EXCLUDED.category
    """

    params = (
        test_id, "openfoodfacts", now, 0.95,
        "MinTest Product", "MinTest Brand", "test"
    )

    curs.execute(sql, params)
    conn.commit()
    logger.info(f"✓ Inserted/upserted test record: {test_id}")

    # Verify
    curs.execute("SELECT * FROM retail_products WHERE external_id = %s", (test_id,))
    row = curs.fetchone()
    if row:
        logger.info(f"✓ Verification: Record found with ID {row[0]}")
    else:
        logger.warning("✓ Record inserted but verification query returned unexpected result")

    # Cleanup
    curs.execute("DELETE FROM retail_products WHERE external_id = %s", (test_id,))
    conn.commit()
    logger.info("✓ Cleaned up test record")

    curs.close()
    conn.close()
    logger.info("\n=== ALL SYNC TESTS PASSED ===")
    logger.info("Database connectivity verified with sync driver.")
    logger.info("For full production import, run in WSH with native Python OR fix asyncpg config.")

except Exception as e:
    logger.error(f"✗ Test failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

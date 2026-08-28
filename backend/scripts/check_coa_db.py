"""Check COA database state."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('PYTHONIOENCODING', 'utf-8')

from sqlalchemy import text
from app.core.database import engine

with engine.connect() as conn:
    # List COA-related tables
    r = conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%coa%'"))
    print("COA tables:")
    for row in r.fetchall():
        print(f"  {row[0]}")

    # Count records
    r2 = conn.execute(text("SELECT COUNT(*) FROM peptide_batch_coas"))
    print(f"\npeptide_batch_coas: {r2.scalar()} records")

    r3 = conn.execute(text("SELECT COUNT(*) FROM coa_test_items"))
    print(f"coa_test_items: {r3.scalar()} records")

    # Show sample COA
    r4 = conn.execute(text("SELECT id, batch_no, product_name_cn, test_conclusion, qualified FROM peptide_batch_coas LIMIT 3"))
    print("\nSample COA records:")
    for row in r4.fetchall():
        print(f"  id={row[0]}, batch={row[1]}, product={row[2]}, conclusion={row[3]}, qualified={row[4]}")

    # Show sample test items
    r5 = conn.execute(text("SELECT id, coa_id, category, item_name, judgment FROM coa_test_items LIMIT 5"))
    print("\nSample test items:")
    for row in r5.fetchall():
        print(f"  id={row[0]}, coa_id={row[1]}, cat={row[2]}, item={row[3]}, result={row[4]}")

    # Alembic version
    r6 = conn.execute(text("SELECT version FROM alembic_version"))
    print(f"\nAlembic version: {r6.scalar()}")

print("\nDB check complete.")

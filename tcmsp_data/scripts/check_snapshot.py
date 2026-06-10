"""Check DataSnapshot table and find root cause using psycopg2 (sync)"""
import psycopg2

conn = psycopg2.connect(host="localhost", port=5432, dbname="rmfood_platform", user="postgres", password="postgres")
cur = conn.cursor()

# 1. Check if data_snapshots table exists
cur.execute("""
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'data_snapshots'
    )
""")
print(f"data_snapshots table exists: {cur.fetchone()[0]}")

# 2. Check table structure
try:
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'data_snapshots' ORDER BY ordinal_position")
    cols = cur.fetchall()
    print(f"\ndata_snapshots columns ({len(cols)}):")
    for c in cols:
        print(f"  {c[0]}: {c[1]}")
except Exception as e:
    print(f"Column check error: {e}")

# 3. Check data in data_snapshots
try:
    cur.execute("SELECT COUNT(*) FROM data_snapshots")
    print(f"\ndata_snapshots row count: {cur.fetchone()[0]}")
    cur.execute("SELECT source_db, total_records, created_at, is_active FROM data_snapshots LIMIT 5")
    rows = cur.fetchall()
    for r in rows:
        print(f"  {r}")
except Exception as e:
    print(f"Data query error: {e}")

# 4. Check tcm_herbs count via psycopg2
cur.execute("SELECT COUNT(*) FROM tcm_herbs")
print(f"\ntcm_herbs count (psycopg2): {cur.fetchone()[0]}")

# 5. Check is_food_homology distribution
cur.execute("SELECT is_food_homology, COUNT(*) FROM tcm_herbs GROUP BY is_food_homology")
print(f"\nis_food_homology distribution: {cur.fetchall()}")

# 6. Check category distribution (compare with API response)
cur.execute("SELECT category, COUNT(*) FROM tcm_herbs GROUP BY category ORDER BY COUNT(*) DESC LIMIT 15")
rows = cur.fetchall()
print(f"\nTop categories (DB):")
for r in rows:
    print(f"  {r[0]}: {r[1]}")

conn.close()

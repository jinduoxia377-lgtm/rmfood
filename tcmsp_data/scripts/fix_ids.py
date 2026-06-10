"""Fix tcm_herbs id=NULL - v2"""
import psycopg2

conn = psycopg2.connect(host='localhost', port=5432, dbname='rmfood_platform', user='postgres')
cur = conn.cursor()
conn.autocommit = True

# Check current state
cur.execute("SELECT COUNT(*) FROM tcm_herbs")
cnt = cur.fetchone()[0]
print(f"Current tcm_herbs: {cnt} rows")

# Create new table
cur.execute("DROP TABLE IF EXISTS tcm_herbs_new")
cur.execute("CREATE TABLE tcm_herbs_new (LIKE tcm_herbs INCLUDING ALL)")

# Copy with sequential IDs
cur.execute("""
    INSERT INTO tcm_herbs_new (id, name_cn, name_latin, name_pinyin, category,
        compounds, targets, diseases, ob_percent, dl_value, effects,
        is_food_homology, tcmsp_id, source_version, synced_at, created_at)
    SELECT ROW_NUMBER() OVER (ORDER BY name_cn),
        name_cn, name_latin, name_pinyin, category,
        compounds, targets, diseases, ob_percent, dl_value, effects,
        is_food_homology, tcmsp_id, source_version, synced_at, NOW()
    FROM tcm_herbs
""")
print(f"Inserted {cur.rowcount} rows")

# Swap
cur.execute("DROP TABLE tcm_herbs")
cur.execute("ALTER TABLE tcm_herbs_new RENAME TO tcm_herbs")

# Create sequence for future inserts
try:
    cur.execute("CREATE SEQUENCE IF NOT EXISTS tcm_herbs_id_seq AS INTEGER START WITH 499")
    cur.execute("ALTER TABLE tcm_herbs ALTER COLUMN id SET DEFAULT nextval('tcm_herbs_id_seq')")
except Exception as e:
    print(f"Sequence note: {e}")

# Verify
cur.execute("SELECT COUNT(*), MIN(id), MAX(id), COUNT(*) FILTER (WHERE id IS NOT NULL) FROM tcm_herbs")
r = cur.fetchone()
print(f"Result: total={r[0]}, min_id={r[1]}, max_id={r[2]}, non_null_ids={r[3]}")

cur.execute("SELECT id, name_cn, ob_percent, dl_value FROM tcm_herbs ORDER BY id LIMIT 5")
for r in cur.fetchall():
    print(f"  {r}")

cur.close()
conn.close()
print("DONE!")

import psycopg2
import json

conn = psycopg2.connect(
    host='localhost',
    database='rmfood',
    user='postgres',
    password='password'
)
cur = conn.cursor()

# 统计已更新的记录
cur.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(latin_name) as with_latin,
        COUNT(category) as with_category,
        COUNT(max_dosage) as with_dosage
    FROM herb_food_herbs
""")
row = cur.fetchone()
print(f"Total: {row[0]}, With Latin: {row[1]}, With Category: {row[2]}, With Dosage: {row[3]}")

# 显示前5条完整记录
cur.execute("""
    SELECT id, name_cn, latin_name, category, max_dosage, status
    FROM herb_food_herbs
    WHERE latin_name IS NOT NULL
    LIMIT 5
""")
rows = cur.fetchall()
print(f"\nSample records:")
for r in rows:
    print(f"  {r[1]} | {r[2]} | {r[3]} | {r[4]} | {r[5]}")

cur.close()
conn.close()

import psycopg2

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
        COUNT(max_dosage) as with_dosage,
        COUNT(CASE WHEN restrictions IS NOT NULL AND array_length(restrictions, 1) > 0 THEN 1 END) as with_restrictions
    FROM herb_food_herbs
""")
row = cur.fetchone()
print(f"Total: {row[0]}")
print(f"With Latin: {row[1]}")
print(f"With Category: {row[2]}")
print(f"With Dosage: {row[3]}")
print(f"With Restrictions: {row[4]}")

# 显示前5条完整记录
cur.execute("""
    SELECT name_cn, latin_name, category, max_dosage, status
    FROM herb_food_herbs
    WHERE latin_name IS NOT NULL AND latin_name != ''
    LIMIT 5
""")
rows = cur.fetchall()
print(f"\nSample records:")
for r in rows:
    print(f"  {r[0]} | {r[1]} | {r[2]} | {r[3]} | {r[4]}")

cur.close()
conn.close()

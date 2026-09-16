import psycopg2
import json

conn = psycopg2.connect(
    host='localhost',
    database='rmfood',
    user='postgres',
    password='password'
)
cur = conn.cursor()

# 查看所有记录
print("所有记录:")
cur.execute("SELECT id, source_id, name_cn, name_en FROM herb_food_herbs ORDER BY id")
rows = cur.fetchall()
for row in rows:
    print(f"  id={row[0]}, source_id={row[1]}, name_cn={row[2]}, name_en={row[3]}")

print(f"\n总记录数: {len(rows)}")

# 搜索包含"人"的记录
print("\n搜索包含'人'的记录:")
cur.execute("SELECT name_cn FROM herb_food_herbs WHERE name_cn LIKE '%人%'")
results = cur.fetchall()
for row in results:
    print(f"  - {row[0]}")

cur.close()
conn.close()

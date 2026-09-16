import psycopg2
import json

try:
    conn = psycopg2.connect(
        host='localhost',
        database='rmfood',
        user='postgres',
        password='password'
    )
    cur = conn.cursor()
    
    # 测试1: 总记录数
    cur.execute("SELECT COUNT(*) FROM herb_food_herbs")
    total = cur.fetchone()[0]
    print(f"总记录数: {total}")
    
    # 测试2: 搜索'人参'
    cur.execute("SELECT name_cn FROM herb_food_herbs WHERE name_cn LIKE '%人参%'")
    results = cur.fetchall()
    print(f"搜索'人参': {len(results)} 条")
    for row in results:
        print(f"  - {row[0]}")
    
    # 测试3: 查看前5条记录
    cur.execute("SELECT id, source_id, name_cn, name_en FROM herb_food_herbs ORDER BY id LIMIT 5")
    rows = cur.fetchall()
    print(f"\n前5条记录:")
    for row in rows:
        print(f"  id={row[0]}, source_id={row[1]}, name_cn={row[2]}, name_en={row[3]}")
    
    # 测试4: 检查是否有空name_cn
    cur.execute("SELECT COUNT(*) FROM herb_food_herbs WHERE name_cn IS NULL OR name_cn = ''")
    empty_count = cur.fetchone()[0]
    print(f"\n空name_cn记录数: {empty_count}")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"错误: {e}")

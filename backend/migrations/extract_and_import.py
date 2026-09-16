import psycopg2
import json
import requests

# 获取API数据
response = requests.get("http://localhost:8000/api/v1/compliance/food-homology")
data = response.json()

print(f"获取到 {data['data']['count']} 条数据")

# 连接数据库
conn = psycopg2.connect(
    host='localhost',
    database='rmfood',
    user='postgres',
    password='password'
)
cur = conn.cursor()

# 更新数据库
updated = 0
for mat in data['data']['materials']:
    # 处理JSON字段
    restrictions = mat.get('restrictions', [])
    usage_forms = mat.get('usage_forms', [])
    
    cur.execute("""
        UPDATE herb_food_herbs 
        SET latin_name = %s,
            category = %s,
            approval_date = %s,
            status = %s,
            restrictions = %s,
            usage_forms = %s,
            max_dosage = %s,
            updated_at = NOW()
        WHERE name_cn = %s
    """, (
        mat.get('latin_name', ''),
        mat.get('category', ''),
        mat.get('approval_date', ''),
        mat.get('status', ''),
        restrictions if isinstance(restrictions, list) else [],
        usage_forms if isinstance(usage_forms, list) else [],
        mat.get('max_dosage', ''),
        mat.get('name')
    ))
    updated += 1

conn.commit()
print(f"成功更新 {updated} 条记录")

cur.close()
conn.close()

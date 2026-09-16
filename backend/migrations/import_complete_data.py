import psycopg2
import urllib.request
import json
import ssl

# 创建SSL上下文（忽略证书验证用于本地开发）
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

# 从API获取数据
try:
    req = urllib.request.Request(
        'http://localhost:8000/api/v1/compliance/food-homology',
        headers={'Accept': 'application/json'}
    )
    with urllib.request.urlopen(req, context=ssl_context, timeout=10) as response:
        data = json.loads(response.read().decode('utf-8'))
except Exception as e:
    print(f"ERROR: Failed to get data from API: {e}")
    exit(1)

print(f"Got {data['data']['count']} materials from API")

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
    # 处理JSON数组字段
    restrictions = mat.get('restrictions', [])
    usage_forms = mat.get('usage_forms', [])
    
    # 确保是Python列表
    if not isinstance(restrictions, list):
        restrictions = []
    if not isinstance(usage_forms, list):
        usage_forms = []
    
    # 转换日期格式
    approval_date = mat.get('approval_date', '')
    if approval_date and len(approval_date) > 10:
        approval_date = approval_date[:10]  # 只取日期部分
    
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
        approval_date,
        mat.get('status', ''),
        restrictions,
        usage_forms,
        mat.get('max_dosage', ''),
        mat.get('name')
    ))
    updated += 1

conn.commit()
print(f"Successfully updated {updated} records")

cur.close()
conn.close()

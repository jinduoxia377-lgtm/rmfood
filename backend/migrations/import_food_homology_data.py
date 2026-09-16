import psycopg2
import json
import re
from datetime import datetime

# 连接数据库
conn = psycopg2.connect(
    host='localhost',
    database='rmfood',
    user='postgres',
    password='password'
)
cur = conn.cursor()

# 读取china_food_regulations.py
with open('D:/RMFOODFP/backend/app/services/data_sources/china_food_regulations.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 提取FOOD_HOMOLOGY_MATERIALS内容
match = re.search(r'FOOD_HOMOLOGY_MATERIALS\s*=\s*\[(.*?)\]', content, re.DOTALL)
if not match:
    print("ERROR: FOOD_HOMOLOGY_MATERIALS not found")
    exit(1)

materials_str = match.group(1)

# 解析每个材料 - 改进正则表达式
pattern = r'\{\s*"name":\s*"([^"]+)",\s*"latin_name":\s*"([^"]*)",\s*"category":\s*"([^"]*)",\s*"approval_date":\s*"([^"]*)",\s*"status":\s*"([^"]*)",\s*"restrictions":\s*\[(.*?)\],\s*"usage_forms":\s*\[(.*?)\],\s*"max_dosage":\s*"([^"]*)"'
matches = re.findall(pattern, materials_str, re.DOTALL)

print(f"Found {len(matches)} materials")

# 更新数据库
updated = 0
for match in matches:
    name, latin_name, category, approval_date, status, restrictions, usage_forms, max_dosage = match
    
    # 处理数组字段
    try:
        restrictions_list = json.loads('[' + restrictions + ']') if restrictions.strip() else []
    except:
        restrictions_list = []
    
    try:
        usage_forms_list = json.loads('[' + usage_forms + ']') if usage_forms.strip() else []
    except:
        usage_forms_list = []
    
    # 更新数据库
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
        latin_name, category, approval_date, status,
        restrictions_list, usage_forms_list, max_dosage, name
    ))
    updated += 1

conn.commit()
print(f"SUCCESS: Updated {updated} records")

cur.close()
conn.close()

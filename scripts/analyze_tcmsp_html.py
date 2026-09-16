# -*- coding: utf-8 -*-
"""
深入分析TCMSP HTML数据结构
"""
import json
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

html_path = r'D:\RMFOODFP\data\TCMSP\data_ingredients.html'
with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"HTML size: {len(content)} bytes")

# 查找表格
table_matches = re.findall(r'<table[^>]*>(.*?)</table>', content, re.DOTALL)
print(f"Tables found: {len(table_matches)}")

if table_matches:
    first_table = table_matches[0]
    print(f"First table size: {len(first_table)} bytes")
    
    # 查找表头
    headers = re.findall(r'<th[^>]*>(.*?)</th>', first_table, re.DOTALL)
    print(f"Headers: {headers[:10]}")
    
    # 查找数据行
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', first_table, re.DOTALL)
    print(f"Rows: {len(rows)}")
    
    if rows:
        print(f"First row HTML: {rows[0][:500]}")

# 查找所有herb_id引用
herb_ids = re.findall(r'herb_id["\s:=]+(\d+)', content)
print(f"\nHerb ID references: {len(herb_ids)}")
if herb_ids:
    print(f"Sample: {herb_ids[:10]}")

# 查找MOL_ID引用
mol_ids = re.findall(r'MOL\d+', content)
print(f"MOL_ID references: {len(mol_ids)}")
if mol_ids:
    print(f"Sample: {mol_ids[:10]}")

# 查找JSON数据块
json_blocks = re.findall(r'\{[^{}]*herb_id[^{}]*mol_id[^{}]*\}', content)
print(f"\nJSON blocks with herb-mol: {len(json_blocks)}")
if json_blocks:
    print(f"Sample: {json_blocks[0][:300]}")

# 检查是否有JavaScript数据
js_data = re.findall(r'var\s+\w+\s*=\s*(\[[^\]]*\])', content)
print(f"\nJavaScript array data: {len(js_data)}")

# 查找数据属性
data_attrs = re.findall(r'data-(\w+)="([^"]*)"', content)
print(f"Data attributes: {len(data_attrs)}")
if data_attrs:
    print(f"Sample: {data_attrs[:5]}")

# 查找链接中的ID
links = re.findall(r'href="[^"]*id=(\d+)[^"]*"', content)
print(f"\nLink IDs: {len(links)}")
if links:
    print(f"Sample: {links[:10]}")

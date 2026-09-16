# -*- coding: utf-8 -*-
"""
RMCHM 数据补全执行 - 正确版本
"""
import json
import openpyxl
from collections import defaultdict
from datetime import datetime

print("=" * 70)
print("  RMCHM 数据补全执行")
print("=" * 70)

# 加载数据
with open(r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v321.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

with open(r'D:\RMFOODFP\data\SymMap\symmap_herbs.json', 'r', encoding='utf-8') as f:
    symmap_herbs = json.load(f)

# 检查SMHB
wb = openpyxl.load_workbook(r'D:\RMFOODFP\data\SymMap\SymMap v2.0, SMHB file.xlsx', read_only=True)
smhb_rows = list(wb.active.iter_rows(values_only=True))
wb.close()

smhb_header = smhb_rows[0]
smhb_by_name = {}
smhb_by_id = {}
for row in smhb_rows[1:]:
    d = dict(zip(smhb_header, row))
    if d.get('Chinese_name'):
        smhb_by_name[d['Chinese_name']] = d
    if d.get('Herb_id'):
        smhb_by_id[str(d['Herb_id'])] = d

# 构建SymMap查找表
symmap_by_id = {str(h['Herb_id']): h for h in symmap_herbs}
symmap_by_name = {h['Chinese_name']: h for h in symmap_herbs}

print(f"\n数据加载完成:")
print(f"  RMCHM: {len(data)}")
print(f"  SymMap: {len(symmap_by_id)}")
print(f"  SMHB by name: {len(smhb_by_name)}")

# 检查一个样本
test_name = "八角"
if test_name in symmap_by_name:
    print(f"\nSymMap中{test_name}的数据:")
    h = symmap_by_name[test_name]
    print(f"  Herb_id: {h.get('Herb_id')}")
    print(f"  English_name: {h.get('English_name')}")
    print(f"  UsePart: {h.get('UsePart')}")
    print(f"  Alias: {h.get('Alias')}")

if test_name in smhb_by_name:
    print(f"\nSMHB中{test_name}的数据:")
    h = smhb_by_name[test_name]
    print(f"  UsePart: {h.get('UsePart')}")
    print(f"  Alias: {h.get('Alias')}")

# 检查缺失数据的药材
print("\n缺失name_eng的药材示例:")
missing = [d for d in data if not d.get('name_eng')]
for d in missing[:5]:
    cn = d.get('name_cn')
    sid = d.get('symmap_id')
    in_symmap = str(sid) in symmap_by_id if sid else False
    print(f"  {cn} (symmap_id={sid}, in_symmap={in_symmap})")
    if in_symmap:
        sym = symmap_by_id[str(sid)]
        print(f"    -> English_name: {sym.get('English_name')}")

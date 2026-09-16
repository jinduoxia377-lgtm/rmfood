# -*- coding: utf-8 -*-
"""
RMCHM 数据补全执行脚本
"""
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

# 加载当前数据
with open(r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v321.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("=" * 60)
print("  RMCHM 数据诊断报告")
print("=" * 60)

# 检查字段状态
fields = ['name_eng', 'use_part', 'alias', 'is_toxic', 'image_path', 'compounds']
for field in fields:
    if isinstance(data[0].get(field), list):
        has = sum(1 for d in data if isinstance(d.get(field), list) and len(d[field]) > 0)
    else:
        has = sum(1 for d in data if d.get(field))
    print(f"{field}: {has}/{len(data)}")

# 检查几个具体药材
print("\n样本药材数据:")
for d in data[:3]:
    cn = d.get('name_cn', 'N/A')
    sid = d.get('symmap_id')
    tid = d.get('tcmsp_id')
    print(f"\n{name_cn} (symmap_id={sid}, tcmsp_id={tid}):")
    print(f"  name_eng: {d.get('name_eng', 'NULL')}")
    print(f"  use_part: {d.get('use_part', 'NULL')}")
    print(f"  alias: {d.get('alias', 'NULL')}")
    print(f"  is_toxic: {d.get('is_toxic', 'NULL')}")

# 检查缺失数据的药材
print("\n缺失name_eng的药材:")
missing_eng = [d for d in data if not d.get('name_eng')]
for d in missing_eng[:5]:
    print(f"  {d.get('name_cn')} (symmap_id={d.get('symmap_id')})")

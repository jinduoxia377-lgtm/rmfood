# -*- coding: utf-8 -*-
"""
诊断RMCHM数据补全问题
"""
import json, sys
sys.stdout.reconfigure(encoding='utf-8')

# 加载当前数据
with open(r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v321.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("=" * 60)
print("  RMCHM 数据诊断报告")
print("=" * 60)

# 检查字段状态
fields = ['name_eng', 'use_part', 'alias', 'is_toxic', 'image_path', 'compounds']
for f in fields:
    if isinstance(data[0].get(f), list):
        has = sum(1 for d in data if isinstance(d.get(f), list) and len(d[f]) > 0)
    else:
        has = sum(1 for d in data if d.get(f))
    print(f"{f}: {has}/{len(data)}")

# 检查几个具体药材
print("\n样本药材数据:")
for d in data[:3]:
    cn = d.get('name_cn', 'N/A')
    sid = d.get('symmap_id')
    tid = d.get('tcmsp_id')
    print(f"\n{name_cn := cn}:")
    print(f"  symmap_id: {sid}")
    print(f"  tcmsp_id: {tid}")
    print(f"  name_eng: {d.get('name_eng', 'NULL')}")
    print(f"  use_part: {d.get('use_part', 'NULL')}")
    print(f"  alias: {d.get('alias', 'NULL')}")
    print(f"  is_toxic: {d.get('is_toxic', 'NULL')}")
